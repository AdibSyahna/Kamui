import { Db } from "mongodb";
import { BaseMessage, HumanMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import { ContextOverflowService } from "./context_overflow_service";

export class ConversationMemoryManager {
    private db: Db;
    private collectionName = 'conversations';
    private channelMemories: Map<string, BaseMessage[]> = new Map();
    private contextOverflowService: ContextOverflowService;

    constructor(db: Db, contextOverflowService: ContextOverflowService) {
        this.db = db;
        this.contextOverflowService = contextOverflowService;
    }

    /**
     * Get conversation history for a channel
     */
    async getChannelMessages(channelId: string, config: MemoryConfig): Promise<BaseMessage[]> {
        if (!config.enabled) {
            return [];
        }

        if (this.channelMemories.has(channelId)) {
            return this.channelMemories.get(channelId)!;
        }

        // Load from database
        const messages = await this.loadChannelMessages(channelId);
        this.channelMemories.set(channelId, messages);
        return messages;
    }

    /**
     * Load conversation history from database
     */
    private async loadChannelMessages(channelId: string): Promise<BaseMessage[]> {
        try {
            const doc = await this.db.collection<ConversationDocument>(this.collectionName)
                .findOne({ channelId });

            if (!doc || !doc.messages.length) {
                return [];
            }

            // Convert stored messages to LangChain format
            const messages: BaseMessage[] = doc.messages.map((msg: StoredMessage) => {
                if (msg.role === 'user') {
                    return new HumanMessage(msg.content);
                } else if (msg.role === 'assistant') {
                    return new AIMessage(msg.content);
                } else {
                    try {
                        const parsed = JSON.parse(msg.content);
                        return new ToolMessage(parsed.kwargs);
                    } catch (parseError) {
                        console.error('Failed to parse stored tool message content:', msg.content, parseError);
                        // Return a placeholder message or skip
                        return new AIMessage('[Error: Malformed tool message]');
                    }
                }
            });

            return messages;

        } catch (error) {
            console.error('Error loading channel messages:', error);
            return [];
        }
    }

    /**
     * Save a message to the channel's conversation history
     */
    async saveMessage(channelId: string, role: 'user' | 'assistant' | 'tool', content: string, authorId: string, config: MemoryConfig): Promise<void> {
        if (!config.enabled) return;

        try {
            const collection = this.db.collection<ConversationDocument>(this.collectionName);

            // Get current messages
            const currentMessages = await this.getChannelMessages(channelId, config);

            // Create new message
            let newMessage: BaseMessage;
            if (role === 'user') {
                newMessage = new HumanMessage(content);
            } else if (role === 'assistant') {
                newMessage = new AIMessage(content);
            } else {
                try {
                    const parsed = JSON.parse(content);
                    newMessage = new ToolMessage(parsed.kwargs);
                } catch (error) {
                    console.error('Failed to parse tool message content:', content, error);
                    // Skip saving malformed tool message
                    return;
                }
            }

            // Estimate token count for new message
            const newTokenCount = this.estimateTokens(content);

            // Check if we need to handle overflow
            let processedMessages = [...currentMessages];
            const currentTotalTokens = currentMessages.reduce((sum: number, msg: BaseMessage) =>
                sum + this.estimateTokens(typeof msg.content === 'string' ? msg.content : String(msg.content)), 0);

            if (currentTotalTokens + newTokenCount > config.token_limit) {
                // Handle overflow using configured strategy
                processedMessages = await this.contextOverflowService.handleOverflow(
                    currentMessages,
                    config,
                    channelId
                );
            }

            // Add new message
            processedMessages.push(newMessage);

            // Save to database
            const now = new Date();
            const messages = processedMessages.map((msg: BaseMessage, index: number) => {
                const msgContent = (msg instanceof HumanMessage || msg instanceof AIMessage) ? String(msg.content) : JSON.stringify(msg.toJSON());
                const existingMsg = currentMessages[index];
                const existingTimestamp = existingMsg ? new Date() : now; // This is simplified
                const existingAuthorId = existingMsg ? authorId : authorId; // This is simplified
                const Message: StoredMessage = {
                    role: msg instanceof HumanMessage ? 'user' as const : (msg instanceof AIMessage ? 'assistant' as const : 'tool' as const),
                    content: msgContent,
                    timestamp: existingTimestamp,
                    authorId: existingAuthorId
                };

                return Message;
            });

            // Calculate final token count
            const finalTokenCount = processedMessages.reduce((sum: number, msg: BaseMessage) =>
                sum + this.estimateTokens(typeof msg.content === 'string' ? msg.content : String(msg.content)), 0);

            await collection.updateOne(
                { channelId },
                {
                    $set: {
                        messages,
                        lastUpdated: now,
                        tokenCount: finalTokenCount
                    },
                    $setOnInsert: {
                        channelId
                    }
                },
                { upsert: true }
            );

            // Update cached memory
            this.channelMemories.set(channelId, processedMessages);

        } catch (error) {
            console.error('Error saving message to memory:', error);
        }
    }

    /**
     * Clear all conversation history for a channel
     */
    async clearChannelMemory(channelId: string): Promise<void> {
        try {
            await this.db.collection(this.collectionName).deleteOne({ channelId });
            this.channelMemories.delete(channelId);
        } catch (error) {
            console.error('Error clearing channel memory:', error);
        }
    }

    /**
     * Simple token estimation (rough approximation)
     */
    private estimateTokens(text: string): number {
        // Rough estimation: 1 token ≈ 4 characters
        return Math.ceil(text.length / 4);
    }

    /**
     * Cleanup old conversations
     */
    async cleanupOldConversations(daysOld: number): Promise<void> {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysOld);

            await this.db.collection(this.collectionName).deleteMany({
                lastUpdated: { $lt: cutoffDate }
            });
        } catch (error) {
            console.error('Error cleaning up old conversations:', error);
        }
    }
}
