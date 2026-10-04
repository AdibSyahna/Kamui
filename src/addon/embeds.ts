import { ColorResolvable, EmbedBuilder } from "discord.js";
import { DiscordBot } from "../bot";

export class EmbedBuilders {
    public honeyTrapEmbed(client: DiscordBot, title: string, description: string, settings?: HoneytrapSettings | null) {
        const Embed = new EmbedBuilder();

        Embed.setColor(client.config.self.color as ColorResolvable);
        Embed.setTitle(title);
        Embed.setDescription(description);
        Embed.setFooter({ text: `Total ban: ${settings ? settings.totalBan : 0}` });
        return Embed;
    }
}