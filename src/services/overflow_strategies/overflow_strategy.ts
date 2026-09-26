import { BaseMessage } from "@langchain/core/messages";

export interface IOverflowStrategy {
    /**
     * Handles overflow for the given messages when token limit is exceeded
     * @param messages Current message array
     * @param tokenLimit Maximum allowed tokens
     * @param config Full overflow config (for summarization params)
     * @param channelId Channel context
     * @returns Processed messages with overflow handled
     */
    handleOverflow(
        messages: BaseMessage[],
        tokenLimit: number,
        config: OverflowConfig,
        channelId: string
    ): Promise<BaseMessage[]>;
}
