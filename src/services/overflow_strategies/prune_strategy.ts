import { BaseMessage } from "@langchain/core/messages";
import { IOverflowStrategy } from "./overflow_strategy";

export class PruneStrategy implements IOverflowStrategy {
    async handleOverflow(
        messages: BaseMessage[],
        tokenLimit: number,
        config: OverflowConfig,
        channelId: string
    ): Promise<BaseMessage[]> {
        // Simple token estimation (rough approximation)
        const estimateTokens = (text: string): number => {
            return Math.ceil(text.length / 4);
        };

        // Calculate current total tokens
        let totalTokens = messages.reduce((sum: number, msg: BaseMessage) =>
            sum + estimateTokens(typeof msg.content === 'string' ? msg.content : String(msg.content)), 0);

        // Prune oldest messages if approaching token limit
        const prunedMessages = [...messages];
        while (totalTokens > tokenLimit && prunedMessages.length > 0) {
            const removedMessage = prunedMessages.shift();
            if (removedMessage) {
                totalTokens -= estimateTokens(typeof removedMessage.content === 'string' ? removedMessage.content : String(removedMessage.content));
            }
        }

        return prunedMessages;
    }
}
