import { ColorResolvable, EmbedBuilder, Message, ModalSubmitInteraction, TextChannel } from "discord.js";
import { ModalSubmitHandlerTemplate } from "../abstract_class/modal_handler";
import { DiscordDatabaseCollections } from "../addon/enum";

export const MODAL_ID = "honey-trap-modal";
export const CHANNEL_LABEL_ID = "honey-trap-channel";
export const TITLE_LABEL_ID = "embed-title-input";
export const DESC_LABEL_ID = "embed-desc-input";

export class ModalHandlerDeclaration extends ModalSubmitHandlerTemplate {
    public override modalId: string = MODAL_ID;

    public override async handle(interaction: ModalSubmitInteraction): Promise<void> {
        const Channel = interaction.fields.getSelectedChannels(CHANNEL_LABEL_ID)!.first()! as TextChannel;
        const EmbedTitle = interaction.fields.getTextInputValue(TITLE_LABEL_ID);
        const EmbedDesc = interaction.fields.getTextInputValue(DESC_LABEL_ID);
        const GuildID = interaction.guildId!;
        const MemberId = interaction.user.id;
        const Collection = this.client!.db!.collection(DiscordDatabaseCollections.honey_trap);

        const PreviousSettings = await Collection.findOne({ guildId: GuildID }) as HoneytrapSettings | null;
        const Embed = this.client!.addOnHandler!.embedBuilders!.honeyTrapEmbed(this.client!, EmbedTitle, EmbedDesc, PreviousSettings);

        let SentEmbed: Message<boolean>;

        if (PreviousSettings !== null) {
            const PreviousEmbed = await Channel.messages.fetch(PreviousSettings.embedMessageId);
            if (PreviousEmbed.editable) {
                PreviousEmbed.edit({ embeds: [Embed] });
                SentEmbed = PreviousEmbed;
            }
            else {
                PreviousEmbed.deletable && PreviousEmbed.delete();
                SentEmbed = await Channel.send({ embeds: [Embed] });
            }

            if (PreviousSettings.channelId != Channel.id) { // if channel selection has changed from previous settings
                const Identifier = PreviousSettings.guildId + PreviousSettings.channelId;
                this.client?.messageListenerHandler?.honeyTrapHandler?.watchList.delete(Identifier);
            }
        } else SentEmbed = await Channel.send({ embeds: [Embed] });

        const NewSettings = {
            enabled: true,
            guildId: GuildID,
            channelId: Channel.id,
            embedTitle: EmbedTitle,
            embedDesc: EmbedDesc,
            embed: Embed.toJSON(),
            lastUpdateByMemberId: MemberId,
            embedMessageId: SentEmbed.id,
            totalBan: PreviousSettings ? PreviousSettings.totalBan : 0
        } as HoneytrapSettings;
        const Identifier = NewSettings.guildId + NewSettings.channelId;

        this.client?.messageListenerHandler?.honeyTrapHandler?.watchList.set(Identifier, NewSettings);
        Collection.updateOne(
            { guildId: GuildID },
            { $set: NewSettings },
            { upsert: true }
        );

        interaction.reply("HoneyTrap enabled");
    }
}