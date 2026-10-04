import { Collection, ModalSubmitInteraction } from "discord.js";
import type { DiscordBot } from "../bot";

type ModalEventHandlerCollection = Collection<string, { handle: CallableFunction }>;

export abstract class ModalSubmitHandlerTemplate {
    public abstract modalId: string;
    protected client?: DiscordBot;

    public assignClient(client: DiscordBot) {
        this.client = client;
    }

    public abstract handle(interaction: ModalSubmitInteraction): void;

    public registerHandler(handler: ModalEventHandlerCollection) {
        handler.set(this.modalId, this);
    }
}