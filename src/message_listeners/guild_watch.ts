import { Message, User, Guild, TextChannel, DMChannel, MessageCollector, Message as DiscordMessage } from "discord.js";
import { DiscordBot } from "../bot";
import { Collection, Db, Document } from "mongodb";
import { DiscordDatabaseCollections } from "../addon/enum";

/* ---------- Constants ---------- */
const URL_REGEX = /(https?:\/\/[^\s]+)|(\.co)/i;
const WATCH_UPDATE_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const DM_RESPONSE_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

/* ---------- Watched Guilds Service ---------- */
class WatchedGuildsService {
    private collection: Collection<Document>;
    private watchedGuilds: Set<string> = new Set();

    constructor(collection: Collection<Document>) {
        this.collection = collection;
    }

    public getSet(): Set<string> {
        return this.watchedGuilds;
    }

    public async refresh(): Promise<void> {
        try {
            const guilds = await this.collection.find({ isWatched: true }).toArray();
            this.watchedGuilds = new Set(guilds.map(g => g.guildId));
        } catch (err) {
            console.error("Failed to update phishing watch list:", err);
        }
    }

    public scheduleRefresh(intervalMs: number): NodeJS.Timeout {
        return setInterval(() => this.refresh(), intervalMs);
    }
}

/* ---------- Link Spam Tracker ---------- */
class LinkSpamTracker {
    private cache = new Map<string, LinkSpamEntry>();
    private timeoutMinutes: number;
    private limit: number;

    constructor(timeoutMinutes: number, limit: number) {
        this.timeoutMinutes = timeoutMinutes;
        this.limit = limit;
    }

    /**
     * Track a message. Returns true if the user has reached the spam limit.
     */
    public track(message: Message): boolean {
        if (!message.guild || !message.author) return false;
        const key = `${message.author.id}_${message.guild.id}`;
        const existing = this.cache.get(key);

        const scheduleDelete = (entry: LinkSpamEntry) => {
            clearTimeout(entry.timeout);
            entry.timeout = setTimeout(() => this.cache.delete(key), this.timeoutMinutes * 60 * 1000);
        };

        if (existing) {
            if (existing.phrase === message.content) {
                existing.count++;
                scheduleDelete(existing);
                return existing.count >= this.limit;
            } else {
                existing.phrase = message.content;
                existing.count = 1;
                scheduleDelete(existing);
                return false;
            }
        } else {
            const timeout = setTimeout(() => this.cache.delete(key), this.timeoutMinutes * 60 * 1000);
            this.cache.set(key, { count: 1, phrase: message.content, timeout });
            return false;
        }
    }
}

/* ---------- Suspect Manager ---------- */
class SuspectManager {
    private suspects = new Map<string, Map<string, SuspectEntry>>();

    public setSuspect(guildId: string, userId: string, entry: SuspectEntry): void {
        if (!this.suspects.has(guildId)) this.suspects.set(guildId, new Map());
        this.suspects.get(guildId)!.set(userId, entry);
    }

    public getSuspect(guildId: string, userId: string): SuspectEntry | undefined {
        return this.suspects.get(guildId)?.get(userId);
    }

    public removeSuspect(guildId: string, userId: string): void {
        this.suspects.get(guildId)?.delete(userId);
    }

    public hasSuspect(guildId: string, userId: string): boolean {
        return this.suspects.get(guildId)?.has(userId) ?? false;
    }
}

/* ---------- Verification Service ---------- */
class VerificationService {
    /**
     * Returns generated question and expected numeric answer.
     */
    public static generateChallenge(): { question: string; answer: number } {
        const n1 = Math.floor(Math.random() * 100);
        const n2 = Math.floor(Math.random() * 10);
        return {
            question: `To verify you are not a bot, please solve this simple math problem:\n\n**${n1} + ${n2} = ?**\n\nReply with only the numerical answer. Failure to answer or sending a link will result in a ban.`,
            answer: n1 + n2,
        };
    }

    public static async sendDMForVerification(dmChannel: DMChannel, guild: Guild, questionText: string): Promise<void> {
        await dmChannel.send(
            `You've triggered the Anti-Phishing filter in **${guild.name}**.\n${questionText}`
        );
    }

    /**
     * Awaits a single reply from specified user in the DM channel.
     * Resolves to the collected message or undefined if none.
     */
    public static async awaitReply(dmChannel: DMChannel, user: User, timeoutMs = DM_RESPONSE_TIMEOUT_MS): Promise<Message | undefined> {
        try {
            const collected = await dmChannel.awaitMessages({
                filter: (m: Message) => m.author.id === user.id,
                max: 1,
                time: timeoutMs,
                errors: ['time'],
            });
            return collected.first();
        } catch {
            return undefined;
        }
    }

    public static containsUrl(text: string): boolean {
        return URL_REGEX.test(text);
    }
}

/* ---------- Main Handler (Facade) ---------- */
export class PhishingFilterHandler {
    private db: Db;
    private collection: Collection<Document>;
    private config: PhishingFilterConfig;
    private watchedService: WatchedGuildsService;
    private watchedInterval?: NodeJS.Timeout;
    private linkTracker: LinkSpamTracker;
    private suspectManager: SuspectManager;

    constructor(client: DiscordBot) {
        if (!client.db) {
            throw new Error("Database is not initialized on the client.");
        }

        this.db = client.db;
        this.collection = this.db.collection(DiscordDatabaseCollections.watch_guild);

        // config defaults
        this.config = {
            linkSpamTimeoutMinutes: client.config.phishing_filter.link_spam_timeout_minute || 5,
            linkSpamLimit: client.config.phishing_filter.link_spam_limit || 3,
            banDeleteMessageSeconds: 24 * 60 * 60,
            ownerId: client.config.owner_id,
        };

        this.watchedService = new WatchedGuildsService(this.collection);
        this.linkTracker = new LinkSpamTracker(this.config.linkSpamTimeoutMinutes, this.config.linkSpamLimit);
        this.suspectManager = new SuspectManager();

        // initial load + schedule
        this.watchedService.refresh().catch(err => console.error("Initial watched refresh failed:", err));
        this.watchedInterval = this.watchedService.scheduleRefresh(WATCH_UPDATE_INTERVAL_MS);
    }

    // Call when shutting down to clear timers if desired
    public shutdown(): void {
        if (this.watchedInterval) clearInterval(this.watchedInterval);
    }

    /**
     * Public entry point to scan a message.
     */
    public async scanMessage(message: Message): Promise<void> {
        if (!message.guild) return;
        if (!this.watchedService.getSet().has(message.guild.id)) return;

        const content = message.content;
        const normalized = this.normalize(content);
        const hasUrl = URL_REGEX.test(content);

        if (this.isPhishingAttempt(normalized, hasUrl)) {
            await this.handleSuspectedUser(message);
            return;
        }

        if (hasUrl) {
            const reached = this.linkTracker.track(message);
            if (reached) {
                await this.handleSuspectedUser(message).catch(err => console.error("handleSuspectedUser error:", err));
            }
        }
    }

    private normalize(str: string): string {
        return str.toUpperCase().replace(/\s/g, "");
    }

    private isPhishingAttempt(normContent: string, hasUrl: boolean): boolean {
        if (!hasUrl) return false;

        const mentionsEveryone = normContent.includes("@EVERYONE") || normContent.includes("@HERE");
        const isNitroScam = normContent.includes("NITRO") || normContent.includes("DISCORD") || normContent.includes("GIVEAWAY") || normContent.includes("FREE");
        const isCsgoScam = (normContent.includes("CS") || normContent.includes("TRADE")) && normContent.includes("SKIN");

        return mentionsEveryone && (isNitroScam || isCsgoScam || hasUrl);
    }

    private async handleSuspectedUser(message: Message): Promise<void> {
        if (!message.guild || !message.author) return;
        const guildId = message.guild.id;
        const userId = message.author.id;

        if (this.suspectManager.hasSuspect(guildId, userId)) {
            // second strike -> ban
            await this.banUser(message.guild, message.author, "Triggered the Anti-Phishing filter twice.");
            this.suspectManager.removeSuspect(guildId, userId);
            return;
        }

        await this.initiateVerification(message);
    }

    private async initiateVerification(message: Message): Promise<void> {
        if (!message.guild) return;
        const { guild, author } = message;
        const guildId = guild.id;
        const userId = author.id;

        // Create suspect entry and store it immediately so other flows can see it
        const suspectEntry: SuspectEntry = { user: author, firstMessage: message };
        this.suspectManager.setSuspect(guildId, userId, suspectEntry);

        // Public reply (best-effort)
        try {
            const warning = await message.reply("Oops! You've triggered my Anti-Phishing filter! Please check the DM I sent to you!");
            suspectEntry.warningMessage = warning;
        } catch (err) {
            console.warn("Failed to send public warning reply:", err);
        }

        // DM & verification
        try {
            const dmChannel = await author.createDM();
            const { question, answer } = VerificationService.generateChallenge();

            // store expected answer in suspect entry (fixes original bug)
            suspectEntry.expectedAnswer = answer;

            await VerificationService.sendDMForVerification(dmChannel, guild, question);
            const replyMsg = await VerificationService.awaitReply(dmChannel, author);

            if (!replyMsg) {
                // no reply -> do nothing further (could ban; original waited)
                await dmChannel.send("No response received. If this was you, avoid sending links to continue.");
                // remove suspect after timeout? Keep original logic: they remain suspect until second offense.
                return;
            }

            const replyContent = replyMsg.content.trim();

            // immediate ban if they send a link in DM
            if (VerificationService.containsUrl(replyContent)) {
                await this.banUser(guild, author, "Replied with a link in DM verification.");
                this.cleanupSuspect(guildId, userId);
                return;
            }

            const parsed = parseInt(replyContent, 10);
            const correct = !isNaN(parsed) && suspectEntry.expectedAnswer !== undefined && parsed === suspectEntry.expectedAnswer;

            // Inform the user privately what happened
            try {
                await author.send(correct ? "Correct! Thank you." : "Your answer was incorrect, but you may now continue.");
            } catch {
                // ignore DM send errors
            }

            // Cleanup public warning if possible
            if (suspectEntry.warningMessage?.deletable) {
                suspectEntry.warningMessage.delete().catch(() => { /* noop */ });
            }

            // Remove suspect record regardless — user either passed or was informed.
            this.suspectManager.removeSuspect(guildId, userId);
        } catch (err) {
            console.error("Failed to DM user for verification:", err);
            // keep suspect state — second offense will ban.
        }
    }

    private cleanupSuspect(guildId: string, userId: string): void {
        const se = this.suspectManager.getSuspect(guildId, userId);
        if (se?.warningMessage?.deletable) {
            se.warningMessage.delete().catch(() => { /* noop */ });
        }
        this.suspectManager.removeSuspect(guildId, userId);
    }

    private async banUser(guild: Guild, user: User, reason: string): Promise<void> {
        try {
            const member = await guild.members.fetch(user.id);
            await member.ban({
                deleteMessageSeconds: this.config.banDeleteMessageSeconds,
                reason: `Kamui: Anti-Phishing - ${reason}`,
            });
            console.log(`Banned ${user.id} (${user.username}) for: ${reason}`);
        } catch (err) {
            console.error(`Failed to ban ${user.id}:`, err);
        }
    }
}
