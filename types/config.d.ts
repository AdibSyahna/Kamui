export { };

declare global {
    interface ConfigJSON {
        "app_id": string,
        "db": string,
        "db_url": string,
        "token": string,
        "default_prefix": string,
        "owner_id": string,
        "owner_username": string,
        "self": ConfigSelf,
        "phishing_filter": PhishingFilter,
        "llm": LLMConfig,
        "saucenao": SauceNAOConfig,
        "brave": BraveSearchConfig
    }

    interface PhishingFilter {
        "link_spam_limit": number
        "link_spam_timeout_minute": number
    }

    interface ConfigSelf {
        "name": string,
        "color": string
    }

    interface LLMMetadata {
        "previous_message_limit": number,
    }

    interface LLMConfig {
        "server_url": string,
        "model": string,
        "temperature": number,
        "max_tokens": number,
        "memory": MemoryConfig,
        "system_prompt_index_strategy": SystemPromptIndexStrategy,
        "metadata": LLMMetadata,
        "response_gating": ResponseGating
    }

    interface ResponseGating {
        "enabled": boolean,
        "server_url": string,
        "model": string,
        "temperature": number,
        "listening_strategy": ResponseGatingStrategy,
        "idle_strategy": ResponseGatingStrategy,
        "listening_timeout_second": number,
        "previous_message_limit": number
    }

    interface MemoryConfig {
        "enabled": boolean,
        "depth": number,
        "token_limit": number,
        "cleanup_days": number,
        "overflow": OverflowConfig
    }

    interface OverflowConfig {
        "strategy": OverflowStrategyType,
        "server_url": string,
        "model": string,
        "temperature": number
    }

    type OverflowStrategyType = "prune" | "summarization";

    interface SauceNAOConfig {
        "api_key": string
    }

    interface BraveSearchConfig {
        "api_key": string
    }

    type SystemPromptIndexStrategy = "first" | "penultimate" | "first_and_penultimate";
    type ResponseGatingStrategy = "previous" | "last" | "none";
}
