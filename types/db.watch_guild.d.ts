export { };
import { WithId } from "mongodb";

declare global {
    type DatabaseWatchGuild = WithId<{
        guildId: string,
        isWatched: boolean,
        totalBan: number,
        watchedSince: number,
        enabledByUserId: string
    }>;
}