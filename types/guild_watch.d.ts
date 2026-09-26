import { Message } from "discord.js";

export { };

declare global {

    type LinkSpamEntry = {
        count: number;
        phrase: string;
        timeout: NodeJS.Timeout;
    };

    type SuspectEntry = {
        user: User;
        firstMessage: Message;
        warningMessage?: Message;
        expectedAnswer?: number;
    };

    type PhishingFilterConfig = {
        linkSpamTimeoutMinutes: number;
        linkSpamLimit: number;
        banDeleteMessageSeconds: number;
        ownerId: string;
    };
}