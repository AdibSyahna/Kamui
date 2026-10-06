import { Db, FindCursor, Collection as DbCollection, ChangeStreamDocument } from "mongodb";
import { DiscordBot } from "../bot";
import { DiscordDatabaseCollections } from "../addon/enum";
import { Collection, Message, TextChannel } from "discord.js";
import { MessageListenersTemplate } from "../abstract_class/message_listeners";

type GuildAndChannelID = string;

const BAN_DELETE_MESSAGES_SECCONDS = 24 * 60 * 60; // 24h

export class HoneyTrapHandler extends MessageListenersTemplate {
    public watchList: Collection<GuildAndChannelID, HoneytrapSettings>;
    private db: Db;
    private client: DiscordBot;
    private collections: DbCollection<HoneytrapSettings>;

    public constructor(client: DiscordBot) {
        super();

        if (!client.db) {
            throw new Error("Database is not initialized on the client.");
        }
        this.db = client.db;
        this.client = client;
        this.watchList = new Collection();
        this.collections = this.db.collection(DiscordDatabaseCollections.honey_trap);
        this.fetchChannelList();
    }

    private async fetchChannelList() {
        const Documents = this.collections.find({ enabled: true } as HoneytrapSettings) as FindCursor<HoneytrapSettings>;

        for await (const Settings of Documents) {
            this.watchList.set(String(Settings.guildId + Settings.channelId), Settings);
        }
    }

    public handleMessage(message: Message) {
        if (message.author.id == this.client.client.user?.id) return; // ignore self message
        const Identifier = message.guildId + message.channelId;
        const isHoneyTrapChannel = this.watchList.get(Identifier);
        if (!isHoneyTrapChannel) return;
        if (message.author.bot) {
            // only delete messages from bots
            message.delete();
            return;
        }
        this.handlePrey(message, isHoneyTrapChannel);
    }

    private async handlePrey(message: Message, settings: HoneytrapSettings) {
        const User = message.author;
        const Guild = message.guild!;
        try {
            const member = await Guild.members.fetch(User.id);
            await member.ban({
                deleteMessageSeconds: BAN_DELETE_MESSAGES_SECCONDS,
                reason: `Kamui: Honey Trap`,
            });
            console.log(`${User.id}(${User.username}) has been caught in honey trap of "${Guild.name}" server.`);
            this.increaseCounter(message, settings);
        } catch (err) {
            console.error(`Failed to ban ${User.id}:`, err);
        }
    }

    private async increaseCounter(message: Message, settings: HoneytrapSettings) {
        settings.totalBan++;
        const Channel = <TextChannel>message.channel;
        const Embed = this.client!.addOnHandler!.embedBuilders!.honeyTrapEmbed(this.client!, settings.embedTitle, settings.embedDesc, settings);
        const PreviousEmbed = await Channel.messages.fetch(settings.embedMessageId);
        let SentEmbed: Message<boolean>;

        if (PreviousEmbed.editable) {
            PreviousEmbed.edit({ embeds: [Embed] });
            SentEmbed = PreviousEmbed;
        }
        else {
            PreviousEmbed.deletable && PreviousEmbed.delete();
            SentEmbed = await Channel.send({ embeds: [Embed] });
        }

        await this.collections.updateOne({ guildId: settings.guildId } as HoneytrapSettings,
            {
                $set: { totalBan: settings.totalBan } as HoneytrapSettings
            }
        )
    }
}