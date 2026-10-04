import { Events } from "discord.js";
import { PhishingFilterHandler } from "./guild_watch";
import { HoneyTrapHandler } from "./honey_trap";
import { LLMHandler } from "./llm";
import { DiscordBot } from "../bot";

export class MessageListenersHandler {
    public phishingHandler?: PhishingFilterHandler;
    public llmHandler?: LLMHandler;
    public honeyTrapHandler?: HoneyTrapHandler;

    public startHandlers(client: DiscordBot) {
        this.phishingHandler = new PhishingFilterHandler(client);
        this.llmHandler = new LLMHandler(client, client.llmService!);
        this.honeyTrapHandler = new HoneyTrapHandler(client);

        client.client.on(Events.MessageCreate, (message) => {
            this.phishingHandler!.handleMessage(message);
            this.llmHandler!.handleMessage(message);
            this.honeyTrapHandler!.handleMessage(message);
        });
    }
}
