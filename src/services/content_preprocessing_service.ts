import { UserCacheService } from "./user_cache_service";

export class ContentPreprocessingService {
    constructor(private userCacheService: UserCacheService) {}

    public async preprocessContent(content: string): Promise<string> {
        const mentionRegex = /<@(\d+)>/g;
        const mentions = [];
        let match;

        while ((match = mentionRegex.exec(content)) !== null) {
            const userId = match[1];
            if (userId) mentions.push(userId);
        }

        const uniqueMentions = [...new Set(mentions)];
        for (const userId of uniqueMentions) {
            try {
                const displayName = await this.userCacheService.getCachedUserDisplayName(userId);
                content = content.replace(new RegExp(`<@${userId}>`, 'g'), `@${displayName}`);
            } catch (error) {
                console.error(`Error processing mention for user ${userId}:`, error);
                content = content.replace(new RegExp(`<@${userId}>`, 'g'), '@unknown');
            }
        }

        return content;
    }
}
