import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { DiscordBot } from "../bot";
import { MetadataService } from "./metadata_service";
import { ChatOpenAI } from "@langchain/openai";
import { Message } from "discord.js";
import { ContentPreprocessingService } from "./content_preprocessing_service";
import path from "path";
import fs from "fs";

export class ResponseGatingService {
    private bot: DiscordBot;
    private metadataService: MetadataService;
    private contentPreprocessingService: ContentPreprocessingService;
    private systemPrompt: string;

    constructor(bot: DiscordBot, metadataService: MetadataService, contentPreprocessingService: ContentPreprocessingService, systemPrompt: string) {
        this.bot = bot;
        this.metadataService = metadataService;
        this.contentPreprocessingService = contentPreprocessingService;
        this.systemPrompt = this.loadSystemPrompt(systemPrompt);
    }

    public async filterListening(message: Message): Promise<boolean> {
        const Strategy = this.bot.config.llm.response_gating.listening_strategy;
        
        if (Strategy == "none") return false;
        else if (Strategy == "last") {
            const systemMessage = new SystemMessage(this.systemPrompt);
            const ProcessedMessage = await this.contentPreprocessingService.preprocessContent(message.content);
            const LastMessage = new HumanMessage(ProcessedMessage);
            const Messages = [systemMessage, LastMessage];
            const Response = await this.handleLLMInvocation(Messages);
            
            if (Response.toUpperCase() !== "YES") return false;
            return true;
        } else {
            const systemMessage = new SystemMessage(this.systemPrompt);
            const PreviousMessageLimit = this.bot.config.llm.response_gating.previous_message_limit;
            const PreviousMessages = await this.metadataService.getLastNMessages(message, PreviousMessageLimit, false, true);
            const ProcessedMessage = await this.contentPreprocessingService.preprocessContent(message.content);
            const LastMessage = new HumanMessage(PreviousMessages + "\n" + ProcessedMessage);
            const Messages = [systemMessage, LastMessage];
            const Response = await this.handleLLMInvocation(Messages);

            if (Response.toUpperCase() !== "YES") return false;
            return true;
        }
    }

    public async filterIdle(message: Message): Promise<boolean> {
        const Strategy = this.bot.config.llm.response_gating.idle_strategy;

        if (Strategy == "none") return false;
        else if (Strategy == "last") {
            const systemMessage = new SystemMessage(this.systemPrompt);
            const ProcessedMessage = await this.contentPreprocessingService.preprocessContent(message.content);
            const LastMessage = new HumanMessage(ProcessedMessage);
            const Messages = [systemMessage, LastMessage];
            const Response = await this.handleLLMInvocation(Messages);
            if (Response !== "1") return false;
            return true;
        } else {
            const systemMessage = new SystemMessage(this.systemPrompt);
            const PreviousMessageLimit = this.bot.config.llm.response_gating.previous_message_limit;
            const PreviousMessages = this.metadataService.getLastNMessages(message, PreviousMessageLimit, false, true);
            const ProcessedMessage = await this.contentPreprocessingService.preprocessContent(message.content);
            const LastMessage = new HumanMessage(PreviousMessages + "\n" + ProcessedMessage);
            const Messages = [systemMessage, LastMessage];
            const Response = await this.handleLLMInvocation(Messages);

            if (Response !== "1") return false;
            return true;
        }
    }

    private loadSystemPrompt(systemPrompt: string): string {
        const systemPromptPath = path.resolve("./response_gating_prompt.txt");
        return (fs.readFileSync(systemPromptPath, "utf-8")).replace("$SYSTEM_PROMPT", systemPrompt);
    }

    private async handleLLMInvocation(messages: (SystemMessage | HumanMessage | AIMessage)[]): Promise<string> {
        const llm = new ChatOpenAI({
            apiKey: 'not-needed',
            model: this.bot.config.llm.response_gating.model,
            temperature: this.bot.config.llm.response_gating.temperature,
            maxTokens: 1, // either "YES" or "NO"
            configuration: {
                baseURL: this.bot.config.llm.response_gating.server_url + "/v1",
            },
        });

        const result = await llm.invoke(messages);
        return result.content.toString();
    }
}