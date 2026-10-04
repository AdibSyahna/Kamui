import { ChannelSelectMenuBuilder, ChannelType, ChatInputCommandInteraction, LabelBuilder, ModalBuilder, PermissionFlagsBits, SlashCommandBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import { CommandTemplate } from "../../abstract_class/dc_command";
import { DiscordDatabaseCollections } from "../../addon/enum";
import { CHANNEL_LABEL_ID, DESC_LABEL_ID, MODAL_ID, TITLE_LABEL_ID } from "../../modal_handlers/honey_trap";

export class CommandDeclaration extends CommandTemplate {
    protected override commandName = "honey_trap";
    protected override commandDescription: string = "Manage honey trap channel in this server.";
    protected override adminOnly: boolean = true;

    public override data = new SlashCommandBuilder()
        .setName(this.commandName)
        .setDescription(this.commandDescription);

    public constructor() {
        super();
        this.data
            .addStringOption(option =>
                option
                    .setName("options")
                    .setDescription("Enable or disable honey trap channel.")
                    .setRequired(true)
                    .setChoices([
                        { name: "Enable", value: "manage" },
                        { name: "Disable", value: "disable" }
                    ])
            )
    }

    public override async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        if (!this.client || !this.client.db) {
            interaction.reply({ content: "Something bad happened. Please try again later.", flags: ["Ephemeral"] });
            return;
        }

        await this.checkPermissions(interaction);
        if (interaction.replied) return;

        const Choice = interaction.options.get("options");
        if (Choice?.value == "disable") {
            await this.disableHoneyTrap(interaction);
            return;
        }

        const Modal = new ModalBuilder()
            .setCustomId(MODAL_ID)
            .setTitle("Honey trap options");

        await this.setEmbedTitleInput(Modal);
        await this.setEmbedDescriptionInput(Modal);
        await this.setChannelOptions(Modal);

        await interaction.showModal(Modal);
    }

    private async disableHoneyTrap(interaction: ChatInputCommandInteraction) {
        const Collection = this.client!.db!.collection(DiscordDatabaseCollections.honey_trap);
        const Settings = await Collection.findOne({ guildId: interaction.guildId }) as HoneytrapSettings | null;
        if (Settings === null) interaction.reply({ content: "Honey trap is never initialized on this server.", flags: ["Ephemeral"] });
        else {
            Collection.updateOne(
                { guildId: Settings.guildId },
                { $set: { enabled: false } as HoneytrapSettings },
                { upsert: false }
            );
            const Identifier = Settings.guildId + Settings.channelId;
            this.client?.messageListenerHandler?.honeyTrapHandler?.watchList.delete(Identifier); // remove from watch list
            interaction.reply({ content: "Honey trap has been disabled." });
        }
    }

    private setEmbedDescriptionInput(modal: ModalBuilder) {
        const EmbedTitle = new TextInputBuilder()
            .setCustomId(DESC_LABEL_ID)
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Warn other users to avoid sending message into this channel');

        const EmbedTitleLabel = new LabelBuilder()
            .setLabel("Set the honey trap embed description")
            .setDescription('Set description for the warning embed to warn users about the channel')
            .setTextInputComponent(EmbedTitle);

        modal.addLabelComponents(EmbedTitleLabel);
    }

    private setEmbedTitleInput(modal: ModalBuilder) {
        const EmbedTitle = new TextInputBuilder()
            .setCustomId(TITLE_LABEL_ID)
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Honey trap embed title');

        const EmbedTitleLabel = new LabelBuilder()
            .setLabel("Set the honey trap embed title")
            .setDescription('Set title for the warning embed to warn users about the channel')
            .setTextInputComponent(EmbedTitle);

        modal.addLabelComponents(EmbedTitleLabel);
    }

    private setChannelOptions(modal: ModalBuilder) {
        const ChannelSelect = new ChannelSelectMenuBuilder()
            .setCustomId(CHANNEL_LABEL_ID)
            .setChannelTypes(ChannelType.GuildText)
            .setPlaceholder('Select a channel')
            .setRequired(true);

        const Label = new LabelBuilder()
            .setLabel("Choose honey trap channel")
            .setChannelSelectMenuComponent(ChannelSelect);

        modal.addLabelComponents(Label);
    }

    private async checkPermissions(interaction: ChatInputCommandInteraction) {
        const me = await interaction.guild!.members.fetchMe();

        // Check if I have BanMembers permission
        if (!me.permissions.has(PermissionFlagsBits.BanMembers)) {
            interaction.reply({ content: 'I do not have permission to ban members.', flags: ["Ephemeral"] });
            return;
        }
    }
}