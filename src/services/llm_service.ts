import fs from "fs";
import path from "path";
import { ToolCall } from "@langchain/core/messages/tool";
import { ToolMessage } from "@langchain/core/messages";
import { LLMTool } from "../abstract_class/llm_tool";
import { Message } from "discord.js";
import { DiscordBot } from "../bot";
import { ConversationMemoryManager } from "./memory_manager";
import { UserCacheService } from "./user_cache_service";
import { ContentPreprocessingService } from "./content_preprocessing_service";
import { MessageChainService } from "./message_chain_service";
import { MetadataService } from "./metadata_service";
import { ResponseGatingService } from "./response_gating_service";

export interface LLMInvokeResult {
    response: string[];
    tool_calls?: ToolCall[];
}

export class LLMService {
    public responseGatingService: ResponseGatingService;

    private systemPrompt: string;
    private bot: DiscordBot;
    private memoryManager: ConversationMemoryManager;
    private tools: LLMTool[];

    // Service dependencies
    private userCacheService: UserCacheService;
    private contentPreprocessingService: ContentPreprocessingService;
    private metadataService: MetadataService;
    private messageChainService: MessageChainService;

    constructor(bot: DiscordBot, memoryManager: ConversationMemoryManager, tools: LLMTool[]) {
        this.bot = bot;
        this.tools = tools;
        this.systemPrompt = this.loadSystemPrompt();
        this.memoryManager = memoryManager;

        // Initialize services
        this.userCacheService = new UserCacheService(bot);
        this.contentPreprocessingService = new ContentPreprocessingService(this.userCacheService);
        this.metadataService = new MetadataService(bot, this.contentPreprocessingService);
        this.responseGatingService = new ResponseGatingService(bot, this.metadataService, this.contentPreprocessingService, this.systemPrompt);
        this.messageChainService = new MessageChainService(
            bot,
            memoryManager,
            this.contentPreprocessingService,
            this.metadataService,
            tools,
            this.systemPrompt
        );
    }

    public getTool(name: string): LLMTool | null {
        return this.tools.find(tool => tool.name === name) ?? null;
    }

    private loadSystemPrompt(): string {
        const systemPromptPath = path.resolve("./system_prompt.txt");
        return fs.readFileSync(systemPromptPath, "utf-8");
    }

    private splitResponse(response: string): string[] {
        const chunks: string[] = [];
        let start = 0;
        while (start < response.length) {
            let end = start + 1900;
            if (end >= response.length) {
                chunks.push(response.substring(start));
                break;
            }
            // Find the last \n before end
            let splitPoint = response.lastIndexOf('\n', end);
            if (splitPoint > start) {
                chunks.push(response.substring(start, splitPoint + 1));
                start = splitPoint + 1;
            } else {
                // No \n, find last whitespace
                let wsPoint = response.lastIndexOf(' ', end);
                if (wsPoint > start) {
                    chunks.push(response.substring(start, wsPoint + 1));
                    start = wsPoint + 1;
                } else {
                    // No whitespace, just cut at 1900
                    chunks.push(response.substring(start, end));
                    start = end;
                }
            }
        }
        return chunks;
    }

    public async runTool(tool: LLMTool, tool_call: ToolCall, channelId: string) {
        const MemoryConfig = this.bot.config.llm.memory;

        const ToolMessage: ToolMessage = await tool.invoke(tool_call);

        // Validate JSON serialization before saving
        let serializedContent: string;
        try {
            serializedContent = JSON.stringify(ToolMessage.toJSON());
            // Test parsing to ensure it's valid
            JSON.parse(serializedContent);
        } catch (error) {
            console.error('Failed to serialize tool message:', error);
            // Last resort: create a simple valid JSON object directly
            serializedContent = JSON.stringify({
                lc: 1,
                type: 'constructor',
                id: ['langchain_core', 'messages', 'ToolMessage'],
                kwargs: {
                    content: 'Error: Failed to serialize tool result',
                    tool_call_id: tool_call.id || 'unknown',
                    name: tool.name,
                    status: 'error'
                }
            });
        }

        await this.memoryManager.saveMessage(
            channelId,
            'tool',
            serializedContent,
            this.bot.client.user!.id,
            MemoryConfig
        );
    }

    public async generateResponse(
        message: Message,
        tool_response: boolean
    ): Promise<LLMInvokeResult | null> {
        try {
            const MemoryConfig = this.bot.config.llm.memory;

            // Use message chain service to build and invoke
            const result = await this.messageChainService.buildAndInvoke(message, tool_response);

            // Save to memory if enabled
            if (MemoryConfig.enabled) {
                if (!tool_response) { // don't save last human response if invocation is to return tool result
                    const processedContent = await this.contentPreprocessingService.preprocessContent(message.content);
                    const Content = `[${new Date(message.createdTimestamp).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                    })}, ${message.author.id}, ${message.author.displayName || message.author.username || 'unknown'}] ${processedContent}`;
                    await this.memoryManager.saveMessage(
                        message.channelId,
                        'user',
                        Content,
                        message.author.id,
                        MemoryConfig
                    );
                }

                await this.memoryManager.saveMessage(
                    message.channelId,
                    'assistant',
                    result.response.join(''),
                    this.bot.client.user!.id,
                    MemoryConfig
                );
            }

            // Split response if necessary
            result.response = this.splitResponse(result.response.join(''));

            return result;
        } catch (error) {
            console.error("Error in generateResponse:", error);
            return null;
        }
    }
}
