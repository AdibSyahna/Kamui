import { ChannelType, DMChannel, Message, MessageType, TextChannel } from "discord.js";
import { DiscordBot } from "../bot";
import { LLMInvokeResult, LLMService } from "../services/llm_service";
import { ToolCall } from "@langchain/core/messages/tool";
import { LLMTool } from "../abstract_class/llm_tool";

export class LLMHandler {
    private bot: DiscordBot;
    private llmService: LLMService;
    private coolDown: Map<string, boolean> = new Map(); // channelId -> coolDown?
    private listening: Map<string, boolean> = new Map(); // channelId -> listening?
    private listeningTimeout: Map<string, NodeJS.Timeout> = new Map(); // channelId -> setTimeout

    constructor(bot: DiscordBot, llmService: LLMService) {
        this.bot = bot;
        this.llmService = llmService;
    }

    public async handleMessage(message: Message): Promise<void> {
        if (message.author.bot) return; // Don't respond to bots
        if (!(await this.shouldRespond(message))) return;

        const channelId = message.channelId;

        // Rate limiting: prevent spam (one response per user per 30 seconds)
        const coolDownStatus = this.coolDown.get(channelId);
        if (coolDownStatus) return;
        this.coolDown.set(channelId, true);

        // if channel is guild channel, set listening
        if (message.channel.type !== ChannelType.DM) this.refreshListeningTimeout(channelId);

        try {
            await this.recursiveGenerateResponse(message);
            this.coolDown.set(channelId, false);
        } catch (error) {
            console.error("Error generating LLM response:", error);
            // Optionally send a fallback message
            await message.reply("Sorry, I'm having trouble thinking right now.");
        }
    }

    private async refreshListeningTimeout(channelId: string) {
        if (!this.bot.config.llm.response_gating.enabled) return;

        if (!this.listening.get(channelId)) {
            const Channel = await this.bot.client.channels.fetch(channelId);
            Channel?.isSendable() && Channel.send(`\`👂${this.bot.config.self.name} is listening... \``);
        }

        this.listening.set(channelId, true);
        const PreviousTimeout = this.listeningTimeout.get(channelId);
        if (PreviousTimeout) PreviousTimeout.close();
        this.listeningTimeout.set(channelId,
            setTimeout(() => this.timeoutListening(channelId),
                this.bot.config.llm.response_gating.listening_timeout_second * 1000));
    }

    private async timeoutListening(channelId: string) {
        this.listening.set(channelId, false);
        const Channel = await this.bot.client.channels.fetch(channelId);
        Channel?.isSendable() && Channel.send(`\`💤${this.bot.config.self.name} is no longer listening. \``);
    }

    private async recursiveGenerateResponse(message: Message, tool_response: boolean = false) {
        (<DMChannel | TextChannel>message.channel).sendTyping();
        const Invocation = await this.generateResponse(message, tool_response);
        if (!Invocation) throw new Error("Invocation is null");

        if (Invocation.response.length) { // LLM says something
            for (let i = 0; i < Invocation.response.length; i++) {
                await message.reply(Invocation.response[i]!);
            }
        }
        if (Invocation.tool_calls && Invocation.tool_calls.length > 0) { // tool call
            const promises: Promise<void>[] = [];
            for (const tool_call of Invocation.tool_calls) {
                const tool = this.llmService.getTool(tool_call.name);
                if (tool) {
                    promises.push(this.runTool(tool, tool_call, message));
                } // TODO: handle invalid tool call
            }
            await Promise.all(promises);
            await this.recursiveGenerateResponse(message, true);
        }
    }

    private async runTool(tool: LLMTool, tool_call: ToolCall, message: Message) {
        const CanSend = message.channel.isSendable();
        let status: Message | undefined;
        if (CanSend) {
            status = await message.channel.send(`\`⚙️${this.bot.config.self.name} ${tool.statusMessage}\``);
        }

        await this.llmService.runTool(tool, tool_call, message.channelId);

        if (status && status.editable) {
            status.edit(`\`✅${this.bot.config.self.name} ${tool.finishedMessage}\``);
        }

    }

    private async shouldRespond(message: Message): Promise<boolean> {
        const botUser = this.bot.client.user;
        if (!botUser) return false;

        // Check channel toggle settings first (only for guild channels)
        if (message.guild) {
            const chatSettings = await this.bot.db!.collection<ChatSettingsDocument>("chat_settings")
                .findOne({ channelId: message.channelId });

            // If toggle is not enabled, don't respond
            if (!chatSettings || !chatSettings.enabled) {
                return false;
            }
            // If no setting exists or enabled is true, continue with normal logic
        } else {
            // For DMs, check response gating
            if (this.bot.config.llm.response_gating.enabled) {
                // in DM, the response gating mode is always listening
                return await this.llmService.responseGatingService.filterListening(message);
            } else return true; // if response gating is disabled, always respond to every message in DM channel.
        }

        // Don't respond to @everyone or @here mentions
        if (message.mentions.everyone) return false;

        // Check if bot is mentioned
        if (message.mentions.has(botUser)) return true;

        // Check if it's a reply to bot's message
        if (message.type === MessageType.Reply && message.reference?.messageId) {
            try {
                const referencedMessage = await message.channel.messages.fetch(message.reference.messageId);
                return referencedMessage.author.id === botUser.id;
            } catch (error) {
                console.error("Error fetching referenced message:", error);
                return false;
            }
        }

        // Check if bot is listening
        if (this.listening.get(message.channelId)) {
            return await this.llmService.responseGatingService.filterListening(message);
        } else {
            return await this.llmService.responseGatingService.filterIdle(message);
        }
    }

    private async generateResponse(message: Message, tool_response: boolean): Promise<LLMInvokeResult | null> {
        return await this.llmService.generateResponse(
            message,
            tool_response
        );
    }
}
