import { APIEmbed } from "discord.js";
import { WithId } from "mongodb";

export { };

declare global {
    type HoneytrapSettings = WithId<{
        enabled: boolean;
        channelId: string;
        guildId: string;
        embedTitle: string;
        embedDesc: string;
        embed: APIEmbed;
        lastUpdateByMemberId: string;
        embedMessageId: string;
        totalBan: number;
    }>;

}
