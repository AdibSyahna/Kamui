import { StructuredTool } from "langchain";
import { DiscordBot } from "../bot";

export abstract class LLMTool extends StructuredTool {
    abstract statusMessage: string;
    abstract finishedMessage: string;
    protected client?: DiscordBot;

    public assignClient(client: DiscordBot) {
        this.client = client;
    }
}