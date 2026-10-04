import { Message } from "discord.js";

export abstract class MessageListenersTemplate {
    public abstract handleMessage(message: Message): unknown;
}