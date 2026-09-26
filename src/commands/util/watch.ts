import { ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { CommandTemplate } from "../../abstract_class/dc_command";
import { DiscordDatabaseCollections } from "../../addon/enum";
import { Collection, Document } from "mongodb";

export class CommandDeclaration extends CommandTemplate {
    protected override commandName = "watch";
    protected override commandDescription: string = "Watch server for phisher / spammer bot.";
    protected override adminOnly: boolean = true;
    protected override guildOnly: boolean = true;

    public override data = new SlashCommandBuilder();

    public override async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        const me = await interaction.guild!.members.fetchMe();

        // Check if I have BanMembers permission
        if (!me.permissions.has(PermissionFlagsBits.BanMembers)) {
            interaction.reply({ content: 'I do not have permission to ban members.', ephemeral: true });
            return;
        }

        const Collection = this.client!.db!.collection(DiscordDatabaseCollections.watch_guild);
        const Document = await Collection.findOne({ guildId: interaction.guildId }) as DatabaseWatchGuild | null;

        if (Document && Document.isWatched) return this.stopWatching(interaction, Collection);
        return this.startWatching(interaction, Collection);
    }

    private stopWatching(interaction: ChatInputCommandInteraction, Collection: Collection<Document>) {
        Collection.updateOne({ guildId: interaction.guildId }, { $set: { isWatched: false } as DatabaseWatchGuild }, { upsert: true });
        interaction.reply("Successfully removed guild from the watch list.");
        return;
    }

    private startWatching(interaction: ChatInputCommandInteraction, Collection: Collection<Document>) {
        Collection.updateOne({ guildId: interaction.guildId }, {
            $set: {
                isWatched: true,
                watchedSince: Date.now(),
                enabledByUserId: interaction.member!.user.id,
                guildId: interaction.guildId
            } as DatabaseWatchGuild
        }, { upsert: true });
        interaction.reply("Successfully added guild to the watch list.");
        return;
    }
}