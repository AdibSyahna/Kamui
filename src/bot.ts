import fs from "fs";
import path from "path";
import { Client, Collection, Events, GatewayIntentBits, Partials, REST, Routes, SlashCommandBuilder } from "discord.js";
import { Db, MongoClient } from "mongodb";
import { AddonHandler } from "./addon";
import { CommandTemplate } from "./abstract_class/dc_command";
import { PhishingFilterHandler } from "./message_listeners/guild_watch";
import { LLMHandler } from "./message_listeners/llm";
import { ConversationMemoryManager } from "./services/memory_manager";
import { ContextOverflowService } from "./services/context_overflow_service";
import { LLMService } from "./services/llm_service";
import { LLMTool } from "./abstract_class/llm_tool";
import { ResponseGatingService } from "./services/response_gating_service";

export class DiscordBot {
    public client: Client;
    public config: ConfigJSON;
    public db?: Db;
    public addOnHandler?: AddonHandler;
    public memoryManager?: ConversationMemoryManager;
    public llmService?: LLMService;

    private commands: Collection<string, { data: SlashCommandBuilder, run: CallableFunction }>;
    private commandsRegistry: any[];
    private commandsDirectoryPath: string;
    private commandsPool: { [commandName: string]: CommandTemplate };
    private toolsRegistry: LLMTool[];
    private toolsDirectoryPath: string;

    public constructor(commandsDirectoryPath: string, toolsDirectoryPath: string) {
        this.commands = new Collection();
        this.commandsRegistry = [];
        this.commandsDirectoryPath = commandsDirectoryPath;
        this.toolsDirectoryPath = toolsDirectoryPath;
        this.toolsRegistry = [];
        this.commandsPool = {};
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.DirectMessages
            ],
            partials: [Partials.Channel, Partials.Message]
        });
        this.config = this.loadConfig();
        this.runAddOns();
    }

    private async startServices() {
        const contextOverflowService = new ContextOverflowService();
        this.memoryManager = new ConversationMemoryManager(this.db!, contextOverflowService);
        this.llmService = new LLMService(this, this.memoryManager!, this.toolsRegistry);
    }

    // Load the config
    private loadConfig(): ConfigJSON {
        const configPath = path.resolve("./config.json");
        return JSON.parse(fs.readFileSync(configPath, "utf-8"));
    }

    // Initialize MongoDB Connection
    private async connectDatabase(): Promise<void> {
        this.db = (await MongoClient.connect(this.config.db_url)).db(this.config.db);
    }

    // initialize add-ons
    private runAddOns() {
        this.addOnHandler = new AddonHandler();
        this.addOnHandler.startAddons();
    }

    // Register Discord events
    private onReady(): void {
        this.client.once(Events.ClientReady, readyClient => {
            console.log(`Logged in as ${readyClient.user.tag}`);
        });
    }

    private listenToMessages() {
        const PhishingFilter = new PhishingFilterHandler(this);
        const LLMFilter = new LLMHandler(this, this.llmService!);
        this.client.on(Events.MessageCreate, async (message) => {
            await PhishingFilter.scanMessage(message);
            await LLMFilter.handleMessage(message);
        });
    }

    private listenToCommandInput() {
        this.client.on(Events.InteractionCreate, async (interaction): Promise<any> => {
            if (!interaction.isChatInputCommand()) return;

            const command = this.commands.get(interaction.commandName);

            if (!command) {
                console.error(`No command matching ${interaction.commandName} was found.`);
                return;
            }

            try {
                await command.run(interaction);
            } catch (error) {
                console.error(error);

                if (interaction.replied || interaction.deferred)
                    return interaction.followUp({ content: "There was an error while executing this command!", ephemeral: true });

                interaction.reply({ content: "There was an error while executing this command!", ephemeral: true });
            }
        });
    }

    // Import LLM tools from the tools directory
    private async importLLMTools(): Promise<void> {
        const StructuredToolFiles = await fs.promises.readdir(this.toolsDirectoryPath);

        // Collect all import promises
        const importPromises = StructuredToolFiles.map(tool => {
            const toolPath = path.resolve(this.toolsDirectoryPath, tool);
            return import(toolPath)
                .then(imports => {
                    const ToolClass = imports.default as (new (...args: any[]) => LLMTool);
                    if (!ToolClass) {
                        console.warn(`${tool} has no default export or it's not a StructuredTool.`);
                        return;
                    }

                    // create instance
                    const toolInstance = new ToolClass();

                    toolInstance.assignClient(this);

                    // insert to this.toolsRegistry
                    this.toolsRegistry.push(toolInstance);
                }); // Returns a promise for each import
        });

        // Wait for all imports of this group to complete
        await Promise.all(importPromises);
    }

    // Import commands from the commands directory
    private async importCommands(): Promise<void> {
        const commandGroups = await fs.promises.readdir(this.commandsDirectoryPath);

        for (const group of commandGroups) {
            const commandGroupPath = path.resolve(this.commandsDirectoryPath, group);
            const commands = await fs.promises.readdir(commandGroupPath);

            // Collect all import promises
            const importPromises = commands.map(command => {
                const commandPath = path.resolve(commandGroupPath, command);
                return import(commandPath)
                    .then(imports => {
                        const CommandDeclaration = imports.CommandDeclaration as (new (...args: any[]) => CommandTemplate);
                        if (!CommandDeclaration) {
                            console.warn(`${command} has no CommandDeclaration export class.`);
                            return;
                        }

                        // create function instance
                        const CommandInstance = new CommandDeclaration();

                        // reference client
                        CommandInstance.assignClient(this);

                        // register command
                        CommandInstance.registerCommand(this.commands, this.commandsRegistry);
                        this.commandsPool[CommandInstance.data.name] = CommandInstance;
                    }); // Returns a promise for each import
            });

            // Wait for all imports of this group to complete
            await Promise.all(importPromises);
        }
    }

    // Register slash commands
    private async registerSlashCommands(): Promise<void> {
        const rest = new REST().setToken(this.config.token);
        await rest.put(
            Routes.applicationCommands(this.config.app_id),
            { body: this.commandsRegistry }
        ).catch(err => {
            throw err;
        });
    }

    // Log in to Discord and start the bot
    public async start(): Promise<void> {
        this.onReady();
        this.listenToCommandInput();

        await this.connectDatabase();
        await this.importLLMTools();
        await this.importCommands();

        await this.startServices();
        
        // Log in to Discord with your client's token
        await this.client.login(this.config.token);

        // Register commands
        await this.registerSlashCommands();

        this.listenToMessages();
    }
}
