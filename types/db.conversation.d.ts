import { ObjectId } from "mongodb";

export { };

declare global {
    interface StoredMessage {
            role: 'user' | 'assistant' | 'tool';
            content: string;
            timestamp: Date;
            authorId: string;
    }

    interface ConversationDocument {
        _id?: ObjectId;
        channelId: string;
        messages: StoredMessage[];
        lastUpdated: Date;
        tokenCount: number;
    }
}