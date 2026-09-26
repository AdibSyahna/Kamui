import { ChatInputCommandInteraction, CommandInteraction, SlashCommandBuilder } from "discord.js";
import { CommandTemplate } from "../../abstract_class/dc_command";
import { DiscordDatabaseCollections } from "../../addon/enum";

export class CommandDeclaration extends CommandTemplate {
    protected override commandName = "marketplace";
    protected override commandDescription: string = "Black Desert Online Central Market tax calculator";

    public override data = new SlashCommandBuilder();

    public constructor() {
        super();
        this.data.addStringOption((builder) => {
            return builder
                .setName("item_price")
                .setRequired(true)
                .setDescription("Price of the item")
        });

        this.data.addStringOption((builder) => {
            return builder
                .setName("quantity")
                .setRequired(false)
                .setDescription("Quantity of the sale. Defaults to 1.")
        })

        this.data.addStringOption((builder) => {
            return builder
                .setName("family_fame")
                .setRequired(false)
                .setDescription("Family fame of your account. Improves accuracy of final results.")
        })
    }

    public override async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        // Get arguments
        const priceArg = String(interaction.options.get("item_price")?.value || '');
        const qtyArg = String(interaction.options.get("quantity")?.value || '');
        let ffArg = String(interaction.options.get('family_fame')?.value || '');
        const defaultQty = !qtyArg ? true : false;
        const defaultFF = !ffArg ? true : false;

        // If possible, get saved family fame of this user
        const Collection = this.client!.db!.collection(DiscordDatabaseCollections.marketplace);
        const Document = await Collection.findOne({ userId: interaction.user.id }) as DatabaseMarketplace | null;

        if (Document) {
            // If ff is given from args, update db
            if (!defaultFF) {
                Collection.updateOne({ userId: interaction.user.id }, { $set: { familyFame: ffArg } }, { upsert: true });
            } else { // If not, use FF from db
                ffArg = Document.familyFame;
                Document.familyFame
            }
        } else {
            // If ff is given from args, upsert db
            if (ffArg.length > 0)
                Collection.updateOne({ userId: interaction.user.id }, { $set: { familyFame: ffArg } }, { upsert: true });
        }


        // Parse item price and quantity from arguments
        const price = parseInt(priceArg.replace(/,?/g, ""));
        const qty = parseInt(qtyArg || "1");
        const familyFame = parseInt(ffArg);

        let ffBonus = 0;
        // Determine family fame bonus percentage based on input
        if (familyFame < 1000 || !familyFame) ffBonus = 0;
        else if (familyFame > 7000) ffBonus = 1.5;
        else if (familyFame >= 4000 && familyFame <= 6999) ffBonus = 1;
        else ffBonus = 0.5;


        // Calculate total price, tax deductions, and profits
        const total = Math.floor(price * qty);
        const noVP = Math.floor(65 * total / 100); // Profit without Value Pack (VP)
        const VP = Math.floor(84.5 * total / 100); // Profit with Value Pack (VP)
        let VPFF = 0; // Profit with VP and family fame bonus
        let noVPFF = 0; // Profit without VP but with family fame bonus

        if (ffBonus) {
            VPFF = Math.floor(VP * ffBonus / 100) + VP;
            noVPFF = Math.floor(noVP * ffBonus / 100) + noVP;
        }

        // Construct the reply message with calculated results
        const reply =
            "```javascript\n" +
            "BDO Central Market tax & final silver calculator\n" +
            `Item price: ${nwc(price)} silver\n` +
            `Item quantity: ${nwc(qty)}${defaultQty ? ' as default' : ''}\n` +
            `${ffBonus ? "Family fame bonus: " + ffBonus + "%\n" : ""}\n` +
            `Total without VP (65% profit): ${nwc(noVP)} silver\n` +
            `Total with VP (84.5% profit): ${nwc(VP)} silver\n` +
            `${ffBonus ?
                "\n" +
                `Family fame bonus (${ffBonus}%)\n` +
                `Total without VP (${65 + ffBonus}% profit): ${nwc(noVPFF)} silver\n` +
                `Total with VP (${84.5 + ffBonus}% profit): ${nwc(VPFF)} silver\n`
                : ""}`
            +
            "```";
        interaction.reply(reply);
    }
}

/**
 * Formats a number with commas as thousand separators.
 * 
 * @param {number} x - The number to format.
 * @returns {string} The formatted number as a string.
 */
function nwc(x: number) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
