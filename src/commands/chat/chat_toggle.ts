import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { CommandTemplate } from "../../abstract_class/dc_command";

export class CommandDeclaration extends CommandTemplate {
    protected override commandName = "chat_toggle";
    protected override commandDescription: string = "Toggle LLM responses for this channel";
    protected override adminOnly: boolean = true;
    protected override guildOnly: boolean = true;

    public override data = new SlashCommandBuilder()
        .setName(this.commandName)
        .setDescription(this.commandDescription);

    public override async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        try {
            const db = this.client!.db!;
            const channelId = interaction.channel!.id;
            const collection = db.collection<ChatSettingsDocument>("chat_settings");

            // Get current settings
            const currentSettings = await collection.findOne({ channelId });
            const newEnabled = !currentSettings?.enabled; // Toggle the current state

            // Upsert the new settings
            await collection.updateOne(
                { channelId },
                {
                    $set: {
                        channelId,
                        enabled: newEnabled,
                        lastUpdated: new Date()
                    }
                },
                { upsert: true }
            );

            const statusMessage = newEnabled
                ? "✅ LLM responses are now **enabled** for this channel."
                : "❌ LLM responses are now **disabled** for this channel.";

            await interaction.reply({ content: statusMessage, ephemeral: true });

        } catch (error) {
            console.error("Error toggling chat settings:", error);
            await interaction.reply({ content: "Failed to toggle chat settings. Please try again later.", ephemeral: true });
        }
    }
}
