import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { CommandTemplate } from "../../abstract_class/dc_command";

export class CommandDeclaration extends CommandTemplate {
    protected override commandName = "clear_memory";
    protected override commandDescription: string = "Clear the conversation memory for this channel";
    protected override adminOnly: boolean = true;

    public override data = new SlashCommandBuilder()
        .setName(this.commandName)
        .setDescription(this.commandDescription);

    public override async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        try {
            const memoryManager = this.client!.memoryManager!;
            const channelId = interaction.channel!.id;

            await memoryManager.clearChannelMemory(channelId);

            await interaction.reply("Conversation memory for this channel has been cleared.");
        } catch (error) {
            console.error("Error clearing memory:", error);
            await interaction.reply({ content: "Failed to clear conversation memory. Please try again later.", ephemeral: true });
        }
    }
}
