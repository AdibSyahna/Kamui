import { DiscordBot } from "../bot";

export class UserCacheService {
    private userCache: Map<string, { name: string; timestamp: number }> = new Map();
    private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    constructor(private bot: DiscordBot) {}

    public async getCachedUserDisplayName(userId: string): Promise<string> {
        const now = Date.now();
        const cached = this.userCache.get(userId);

        if (cached && (now - cached.timestamp) < this.CACHE_TTL) {
            return cached.name;
        }

        try {
            const user = await this.bot.client.users.fetch(userId);
            const displayName = user.displayName ?? user.username ?? 'unknown';

            this.userCache.set(userId, {
                name: displayName,
                timestamp: now
            });

            return displayName;
        } catch (error) {
            console.error(`Failed to fetch user ${userId}:`, error);
            throw error;
        }
    }
}
