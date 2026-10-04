import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { CommandTemplate } from "../../abstract_class/dc_command";

export class CommandDeclaration extends CommandTemplate {
    protected override commandName = "test";
    protected override commandDescription: string = "Dev.";

    public override data = new SlashCommandBuilder();

    public override async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        if (!this.client || !this.client.db) {
            interaction.reply({ content: "Something bad happened. Please try again later.", flags: ["Ephemeral"] });
            return;
        }

        const OwnerId = this.client?.config.owner_id;
        if (interaction.user.id != OwnerId) {
            interaction.reply("I'm sorry, but this command is only available for Owner!")
            return;
        };

        await interaction.reply("0");

        for (let i = 0; i < 1000 * 10; i++) {
            if (i != 0 && i % 200 == 0) {
                interaction.editReply(String(i));
            }
        }
    }
}