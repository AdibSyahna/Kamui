import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, ColorResolvable } from "discord.js";
import { CommandTemplate } from "../../abstract_class/dc_command";
import Sagiri from 'sagiri';

export class CommandDeclaration extends CommandTemplate {
    protected override commandName = "sauce";
    protected override commandDescription: string = "Reverse search an image or GIF using SauceNAO";

    public override data = new SlashCommandBuilder();

    public constructor() {
        super();
        this.data
            .setName(this.commandName)
            .setDescription(this.commandDescription)
            .addStringOption(option =>
                option.setName('url')
                    .setDescription('URL of the image to search')
                    .setRequired(false))
            .addAttachmentOption(option =>
                option.setName('image')
                    .setDescription('Upload an image to search')
                    .setRequired(false))
            .addStringOption(option =>
                option.setName('message_link')
                    .setDescription('Discord message link containing an image')
                    .setRequired(false))
            .addBooleanOption(option =>
                option.setName('show_all')
                    .setDescription('Show all results (not just the best ones)')
                    .setRequired(false));
    }

    public override async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        const apiKey = this.client?.config.saucenao.api_key;
        if (!apiKey) {
            await interaction.reply({
                content: "SauceNAO API key is not configured.",
                flags: ["Ephemeral"]
            });
            return;
        }

        const sagiri = Sagiri(apiKey);
        const checked_sites: string[] = [];
        const url = interaction.options.getString('url');
        const attachment = interaction.options.getAttachment('image');
        const messageLink = interaction.options.getString('message_link');
        const showAll = interaction.options.getBoolean('show_all') || false;

        // Helper function to parse Discord message link
        const parseMessageLink = (link: string) => {
            const match = link.match(/https:\/\/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/);
            if (!match) return null;

            return {
                guildId: match[1],
                channelId: match[2],
                messageId: match[3]
            };
        };

        // Helper function to process message link
        const processMessageLink = async (link: string) => {
            const parsed = parseMessageLink(link);
            if (!parsed || !parsed.guildId || !parsed.channelId || !parsed.messageId) {
                await interaction.editReply("Please provide a valid Discord message link.\nFormat: https://discord.com/channels/guild_id/channel_id/message_id");
                return false;
            }

            try {
                // Check if bot has access to the channel
                const channel = await interaction.guild?.channels.fetch(parsed.channelId);
                if (!channel) {
                    await interaction.editReply("I don't have access to that channel or it doesn't exist.");
                    return false;
                }

                // Ensure it's a text-based channel
                if (!channel.isTextBased()) {
                    await interaction.editReply("That channel is not a text channel.");
                    return false;
                }

                // Fetch the message
                const message = await channel.messages.fetch(parsed.messageId);
                if (!message) {
                    await interaction.editReply("Message not found. It may have been deleted.");
                    return false;
                }

                // Check for image attachments
                const imageAttachments = message.attachments.filter((att: any) => att.contentType?.startsWith('image/'));
                if (imageAttachments.size === 0) {
                    await interaction.editReply("That message doesn't contain any images.");
                    return false;
                }

                // Use the first image attachment for search
                const firstImage = imageAttachments.first();
                if (firstImage) {
                    return await executeSearch(firstImage.url);
                }

                return false;
            } catch (error) {
                console.error('Message link processing error:', error);
                await interaction.editReply("Failed to process the message link. Please check if the link is correct and I have access to the channel.");
                return false;
            }
        };

        const executeSearch = async (searchUrl: string) => {
            try {
                const sauce = await sagiri(searchUrl);

                const embed = new EmbedBuilder()
                    .setFooter({
                        text: `${this.client?.client?.user?.username || 'Me'}: "This reverse search is powered by SauceNAO."`,
                        iconURL: this.client?.client?.user?.avatarURL() || undefined
                    })
                    .setColor(this.client?.config.self.color! as ColorResolvable)
                    .setTitle(":mag: **Results from SauceNAO are coming in!**");

                let resultCount = 0;
                for (let i = 0; i < sauce.length; i++) {
                    const item = sauce[i];
                    if (!item) continue;

                    // Skip if we've already shown this site (unless show_all is true)
                    if (!showAll && checked_sites.includes(item.site)) continue;

                    let level: string;
                    if (item.similarity >= 90) {
                        level = 'Great';
                    } else if (item.similarity >= 70) {
                        level = 'Good';
                    } else if (item.similarity >= 50) {
                        level = 'Low';
                    } else {
                        level = 'Bad';
                    }

                    embed.addFields({
                        name: item.site,
                        value: `[${level} Similarity (${item.similarity}%)](${item.url})`
                    });

                    checked_sites.push(item.site);
                    resultCount++;

                    // Limit results if not showing all
                    if (!showAll && resultCount >= 5) break;
                }

                if (resultCount === 0) {
                    embed.setDescription("No results found with sufficient similarity.");
                }

                await interaction.followUp({ embeds: [embed] });
                return true;
            } catch (err) {
                console.error('SauceNAO search error:', err);
                await interaction.followUp({
                    content: "Sorry! Something bad happened...\nPlease make sure you send a valid image file format.",
                    flags: ["Ephemeral"]
                });
                return false;
            }
        };

        // Defer the reply since SauceNAO search might take time
        await interaction.deferReply();

        let searchPerformed = false;

        // Check for message link first
        if (messageLink && !searchPerformed) {
            searchPerformed = await processMessageLink(messageLink);
        }

        // Check for attachment
        if (attachment) {
            if (attachment.contentType?.startsWith('image/')) {
                searchPerformed = await executeSearch(attachment.url);
            } else {
                await interaction.editReply("Please upload a valid image file.");
                return;
            }
        }

        // Check for URL
        if (url && !searchPerformed) {
            const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.svg'];
            const isImageUrl = imageExtensions.some(ext => url.toLowerCase().includes(ext));

            if (isImageUrl) {
                searchPerformed = await executeSearch(url);
            } else {
                await interaction.editReply("Please provide a valid image URL.");
                return;
            }
        }

        // If no search was performed, show usage help
        if (!searchPerformed) {
            await interaction.editReply(
                "Please provide one of the following:\n" +
                "• A Discord message link using the `message_link` option\n" +
                "• An image URL using the `url` option\n" +
                "• Upload an image using the `image` option\n\n" +
                "**Examples:**\n" +
                "• `/sauce message_link:https://discord.com/channels/123456789/987654321/111111111`\n" +
                "• `/sauce url:https://example.com/image.jpg`\n" +
                "• `/sauce image:[upload image]`"
            );
        }
    }
}
