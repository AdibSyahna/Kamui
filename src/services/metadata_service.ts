import { Message } from "discord.js";
import { DiscordBot } from "../bot";
import { ContentPreprocessingService } from "./content_preprocessing_service";

export class MetadataService {
    static Indent = "    ";

    constructor(
        private bot: DiscordBot,
        private contentPreprocessingService: ContentPreprocessingService
    ) { }

    private getMessageWithMetadata(message: Message, content: string): string {
        const time = new Date(message.createdTimestamp).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
        const username = message.author.displayName || message.author.username || 'unknown';
        return `[${time}, ${message.author.id}, ${username}] ${content}`;
    }

    public async getLastNMessages(message: Message, n = 0, withContext = true, includeLastBotMessage = false): Promise<string> {
        if (n < 1) n = this.bot.config.llm.metadata.previous_message_limit;
        const botId = this.bot.client.user!.id;
        const messages: Message[] = [];
        let lastId = message.id;
        let foundBotMessage = false;

        while (!foundBotMessage && messages.length < n + 100) {
            const fetched = await message.channel.messages.fetch({ before: lastId, limit: 100 });
            if (fetched.size === 0) break;
            const fetchedArray = Array.from(fetched.values()).sort((a, b) => b.createdTimestamp - a.createdTimestamp);
            for (const msg of fetchedArray) {
                if (msg.author.id === botId && !includeLastBotMessage) {
                    foundBotMessage = true;
                    break;
                } 
                messages.push(msg);
            }
            lastId = fetchedArray[fetchedArray.length - 1]!.id;
            if (fetched.size < 100) break;
        }

        // Reverse to oldest to newest
        messages.reverse();

        const lastMessages = messages.length > n ? messages.slice(-n) : messages;
        const trimmed = messages.length > n;

        // Preprocess content for each message
        const lastMessagesProcessed = await Promise.all(lastMessages.map(async m => {
            const processedContent = await this.contentPreprocessingService.preprocessContent(m.content);
            return { message: m, processedContent };
        }));

        let content = lastMessagesProcessed
            .map(({ message, processedContent }) => this.getMessageWithMetadata(message, processedContent))
            .join('\n' + (withContext ? MetadataService.Indent + MetadataService.Indent : ''))
            .trim();
        if (trimmed && withContext) {
            content += '\n\nNote: The conversation history has been trimmed to the most recent ' + n + ' messages.';
        }

        return content.length
            ? `${withContext ? '<LAST_MESSAGES>\n' : ''}`
            + (withContext ? MetadataService.Indent : '')
            + (withContext ? MetadataService.Indent : '')
            + content
            + "\n"
            + (withContext ? MetadataService.Indent : '')
            + `${withContext ? '</LAST_MESSAGES>' : ''}`
            : '';
    }

    private getDateMetadata() {
        // return DD-MM-YYYY date
        return "<DATE>\n"
            + MetadataService.Indent
            + MetadataService.Indent
            + new Date().toLocaleDateString('en-UK', { day: '2-digit', month: '2-digit', year: 'numeric' })
            + "\n"
            + MetadataService.Indent
            + "</DATE>"
    }

    public async buildMetadata(message: Message) {
        const Metadata = [
            this.getDateMetadata(),
            await this.getLastNMessages(message)
        ];
        const MetadataContent = Metadata.filter(Boolean).join('\n' + MetadataService.Indent).trim();

        return "<METADATA>\n"
            + MetadataService.Indent
            + MetadataContent
            + MetadataService.Indent
            + "\n</METADATA>";
    }
}
