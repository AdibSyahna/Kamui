import fs from "fs";
import { ChatOpenAI } from "@langchain/openai";
import { BaseMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { IOverflowStrategy } from "./overflow_strategy";

export class SummarizationStrategy implements IOverflowStrategy {
    private summarizationPrompt: string;

    constructor() {
        this.summarizationPrompt = fs.readFileSync("./summarization_prompt.txt", "utf-8");
    }

    async handleOverflow(
        messages: BaseMessage[],
        tokenLimit: number,
        config: OverflowConfig,
        channelId: string
    ): Promise<BaseMessage[]> {
        if (messages.length <= 1) {
            return messages; // Need at least 2 messages to summarize
        }

        try {
            // Identify messages to summarize (oldest 50% of messages)
            const messagesToSummarize = messages.slice(0, Math.floor(messages.length / 2));
            const remainingMessages = messages.slice(Math.floor(messages.length / 2));

            // Generate summary
            const summaryContent = await this.generateSummary(messagesToSummarize, config);

            // Create summary message
            const summaryMessage = new HumanMessage(`**Conversation Summary:**\n${summaryContent}`);

            // Combine summary with remaining messages
            const newMessages = [summaryMessage, ...remainingMessages];

            // Ensure result is under token limit (fallback to pruning if needed)
            return this.ensureUnderLimit(newMessages, tokenLimit);

        } catch (error) {
            console.error('Error in summarization strategy:', error);
            // Fallback to pruning strategy
            return this.fallbackPruning(messages, tokenLimit);
        }
    }

    private async generateSummary(messages: BaseMessage[], config: OverflowConfig): Promise<string> {
        // Prepare messages for summarization
        const messagesText = messages.map((msg, index) => {
            const role = msg.constructor.name.replace('Message', '').toLowerCase();
            const content = typeof msg.content === 'string' ? msg.content : String(msg.content);
            return `[${index + 1}] ${role}: ${content}`;
        }).join('\n\n');

        // Create LLM instance with overflow config
        const llm = new ChatOpenAI({
            apiKey: 'not-needed',
            modelName: config.model,
            temperature: config.temperature,
            maxTokens: 500, // Limit summary length
            configuration: {
                baseURL: config.server_url + "/v1",
            },
        });

        const messagesForLLM = [
            new SystemMessage(this.summarizationPrompt),
            new HumanMessage(messagesText)
        ];

        const result = await llm.invoke(messagesForLLM);
        return result.content.toString().trim();
    }

    private ensureUnderLimit(messages: BaseMessage[], tokenLimit: number): BaseMessage[] {
        const estimateTokens = (text: string): number => Math.ceil(text.length / 4);

        let totalTokens = messages.reduce((sum, msg) =>
            sum + estimateTokens(typeof msg.content === 'string' ? msg.content : String(msg.content)), 0);

        const result = [...messages];
        while (totalTokens > tokenLimit && result.length > 1) {
            const removed = result.shift();
            if (removed) {
                totalTokens -= estimateTokens(typeof removed.content === 'string' ? removed.content : String(removed.content));
            }
        }

        return result;
    }

    private fallbackPruning(messages: BaseMessage[], tokenLimit: number): BaseMessage[] {
        console.warn('Summarization failed, falling back to pruning strategy');
        const estimateTokens = (text: string): number => Math.ceil(text.length / 4);

        let totalTokens = messages.reduce((sum, msg) =>
            sum + estimateTokens(typeof msg.content === 'string' ? msg.content : String(msg.content)), 0);

        const result = [...messages];
        while (totalTokens > tokenLimit && result.length > 0) {
            const removed = result.shift();
            if (removed) {
                totalTokens -= estimateTokens(typeof removed.content === 'string' ? removed.content : String(removed.content));
            }
        }

        return result;
    }
}
