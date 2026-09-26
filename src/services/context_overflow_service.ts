import { BaseMessage } from "@langchain/core/messages";
import { IOverflowStrategy } from "./overflow_strategies/overflow_strategy";
import { PruneStrategy } from "./overflow_strategies/prune_strategy";
import { SummarizationStrategy } from "./overflow_strategies/summarization_strategy";

export class ContextOverflowService {
    private strategies: Map<string, IOverflowStrategy> = new Map();

    constructor() {
        // Register available strategies
        this.strategies.set("prune", new PruneStrategy());
        this.strategies.set("summarization", new SummarizationStrategy());
    }

    /**
     * Handles context overflow using the configured strategy
     * @param messages Current message array that may exceed token limits
     * @param config Memory configuration containing overflow settings
     * @param channelId Channel context for logging/debugging
     * @returns Processed messages with overflow handled
     */
    async handleOverflow(
        messages: BaseMessage[],
        config: MemoryConfig,
        channelId: string
    ): Promise<BaseMessage[]> {
        const overflowConfig = config.overflow;
        const strategy = this.strategies.get(overflowConfig.strategy);

        if (!strategy) {
            console.error(`Unknown overflow strategy: ${overflowConfig.strategy}. Falling back to prune.`);
            // Fallback to prune strategy
            return this.strategies.get("prune")!.handleOverflow(
                messages,
                config.token_limit,
                overflowConfig,
                channelId
            );
        }

        try {
            return await strategy.handleOverflow(
                messages,
                config.token_limit,
                overflowConfig,
                channelId
            );
        } catch (error) {
            console.error(`Error in overflow strategy ${overflowConfig.strategy}:`, error);
            // Fallback to prune strategy on error
            return this.strategies.get("prune")!.handleOverflow(
                messages,
                config.token_limit,
                overflowConfig,
                channelId
            );
        }
    }

    /**
     * Registers a new overflow strategy
     * @param name Strategy name (should match OverflowStrategyType)
     * @param strategy Strategy implementation
     */
    registerStrategy(name: string, strategy: IOverflowStrategy): void {
        this.strategies.set(name, strategy);
    }

    /**
     * Gets a registered strategy by name
     * @param name Strategy name
     * @returns Strategy instance or null if not found
     */
    getStrategy(name: string): IOverflowStrategy | null {
        return this.strategies.get(name) || null;
    }
}
