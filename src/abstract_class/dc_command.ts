import { SlashCommandBuilder, CommandInteraction, Collection, RESTPostAPIChatInputApplicationCommandsJSONBody, GuildMemberRoleManager, PermissionFlagsBits, GuildMember } from "discord.js";
import { DiscordBot } from "../bot";

type CommandCollection = Collection<string, { data: SlashCommandBuilder, run: CallableFunction }>;

export abstract class CommandTemplate {
    public abstract data: SlashCommandBuilder;
    protected abstract commandName: string;
    protected abstract commandDescription: string;
    protected client?: DiscordBot;
    protected ownerOnly: boolean = false;
    protected adminOnly: boolean = false;
    protected guildOnly: boolean = false;

    public assignClient(client: DiscordBot) {
        this.client = client;
    }

    public registerCommand(
        command: CommandCollection,
        registry: RESTPostAPIChatInputApplicationCommandsJSONBody[]) {

        if (!this.data) this.data = new SlashCommandBuilder();
        this.data
            .setName(this.commandName)
            .setDescription(this.commandDescription);

        command.set(this.commandName, this);
        registry.push(this.data.toJSON());
    }

    protected abstract execute(interaction: CommandInteraction): Promise<void>;

    public run(interaction: CommandInteraction) {
        if (!this.client || !this.client.db) {
            interaction.reply({ content: "Something bad happened. Please try again later.", ephemeral: true });
            return;
        }

        // checks
        if (this.ownerOnly) {
            const OwnerId = this.client.config.owner_id;
            if (interaction.user.id != OwnerId) {
                interaction.reply({ content: "I'm sorry, but this command is only available for Owner!", ephemeral: true });
                return;
            };
        } else if (this.adminOnly) {
            if (this.guildOnly && (!interaction.guild || !interaction.member)) {
                interaction.reply("This command is only available in guild / server!");
                return;
            }

            if (interaction.member instanceof GuildMember) {
                if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
                }
            }
        } else if (this.guildOnly) {
            if (!interaction.guild || !interaction.member) {
                interaction.reply("This command is only available in guild / server!");
                return;
            }
        }

        return this.execute(interaction);
    }
}
