import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import { DiscordBot } from "../bot";
import { ConversationMemoryManager } from "./memory_manager";
import { LLMTool } from "../abstract_class/llm_tool";
import { Message } from "discord.js";
import { ContentPreprocessingService } from "./content_preprocessing_service";
import { MetadataService } from "./metadata_service";
import { LLMInvokeResult } from "./llm_service";

export class MessageChainService {
    constructor(
        private bot: DiscordBot,
        private memoryManager: ConversationMemoryManager,
        private contentPreprocessingService: ContentPreprocessingService,
        private metadataService: MetadataService,
        private tools: LLMTool[],
        private systemPrompt: string
    ) {}

    private getMessageWithMetadata(message: Message, content: string): string {
        const time = new Date(message.createdTimestamp).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
        const username = message.author.displayName || message.author.username || 'unknown';
        return `[${time}, ${message.author.id}, ${username}] ${content}`;
    }

    public async buildMessageChain(
        processedContent: string,
        message: Message,
        tool_response: boolean
    ): Promise<(SystemMessage | HumanMessage | AIMessage | ToolMessage)[]> {
        const messages: (SystemMessage | HumanMessage | AIMessage | ToolMessage)[] = [];
        const { system_prompt_index_strategy: SystemPromptStrategy, memory: MemoryConfig } = this.bot.config.llm;

        // Add initial system prompt if needed
        if (SystemPromptStrategy === "first" ||
            SystemPromptStrategy === "first_and_penultimate") {
            messages.push(new SystemMessage(this.systemPrompt));
        }

        // Add conversation history
        if (MemoryConfig.enabled) {
            const historyMessages = await this.memoryManager.getChannelMessages(message.channelId, MemoryConfig);
            messages.push(...historyMessages);
        }

        // Add current user message
        if (!tool_response) { // last message is human message
            const metadata = await this.metadataService.buildMetadata(message);

            // Add penultimate system prompt if needed
            if (SystemPromptStrategy === "penultimate" ||
                SystemPromptStrategy === "first_and_penultimate") {
                messages.push(new SystemMessage(this.systemPrompt));
            }

            const lastUserMessage = `${metadata}\n${this.getMessageWithMetadata(message, processedContent)}`;

            messages.push(new HumanMessage(lastUserMessage));
        }

        return messages;
    }

    private logMessages(messages: (SystemMessage | HumanMessage | AIMessage)[]): void {
        console.log('=== PROCESSED MESSAGES SENT TO LLM ===');
        messages.forEach((msg, index) => {
            const content = typeof msg.content === 'string'
                ? msg.content
                : String(msg.content);
            console.log(`[${index}] ${msg.constructor.name}: ${content}`);
        });
        console.log('=== END PROCESSED MESSAGES ===');
    }

    private async handleLLMInvocation(messages: (SystemMessage | HumanMessage | AIMessage)[]): Promise<LLMInvokeResult> {
        const llm = new ChatOpenAI({
            apiKey: 'not-needed',
            modelName: this.bot.config.llm.model,
            temperature: this.bot.config.llm.temperature,
            maxTokens: this.bot.config.llm.max_tokens,
            configuration: {
                baseURL: this.bot.config.llm.server_url + "/v1",
            },
        });

        const result = await llm.invoke(messages, { tools: this.tools });
        const response: LLMInvokeResult = {
            response: [result.content.toString()],
            tool_calls: result.tool_calls
        };

        return response;
    }

    public async buildAndInvoke(
        message: Message,
        tool_response: boolean
    ): Promise<LLMInvokeResult> {
        const processedContent = await this.contentPreprocessingService.preprocessContent(message.content);
        const messages = await this.buildMessageChain(processedContent, message, tool_response);

        // Log messages for debugging
        this.logMessages(messages);

        // Invoke LLM
        return await this.handleLLMInvocation(messages);
    }
}
