import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { CommandTemplate } from "../../abstract_class/dc_command";
import util from 'util';
import * as tags from "common-tags"

export class CommandDeclaration extends CommandTemplate {
    protected override commandName = "eval";
    protected override commandDescription: string = "Evaluate JavaScript code. Owner only command!";
    protected override ownerOnly: boolean = true;

    public override data = new SlashCommandBuilder();

    private nl = '!!NL!!';
    private nlPattern = new RegExp(this.nl, 'g');
    private _sensitivePattern: RegExp | null = null;
    private hrStart: [number, number] = [0, 0];
    private lastResult: string = '';

    public constructor() {
        super();
        this.data.addStringOption((builder) => {
            return builder
                .setName("code")
                .setRequired(true)
                .setDescription("JavaScript code")
        });
    }

    public override async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        let script = String(interaction.options.get("code")?.value || '');
        if (!script) {
            interaction.reply({ content: "Something bad happened. I'm not getting any code to evaluate!", flags: ["Ephemeral"] });
            return;
        }


        // Remove any surrounding code blocks before evaluation
        if (script.startsWith('```') && script.endsWith('```')) {
            script = script.replace(/(^.*?\s)|(\n.*$)/g, '');
        }

        // Run the code and measure its execution time
        let hrDiff;
        try {
            this.hrStart = process.hrtime();
            this.lastResult = eval(script) || '';
            hrDiff = process.hrtime(this.hrStart);
        } catch (err) {
            interaction.reply(`Error while evaluating: \`${err}\``);
            return;
        }

        // Prepare for callback time and respond
        this.hrStart = process.hrtime();
        const result = this.makeResultMessages(this.lastResult, hrDiff, script);
        if (Array.isArray(result)) {
            result.map(item => interaction.reply(item));
        } else {
            interaction.reply(result);
        }
    }

    private makeResultMessages(result: string, hrDiff: [number, number], input: string | null = null) {
        const inspected = util.inspect(result, { depth: 0 })
            .replace(this.nlPattern, '\n')
            .replace(this.sensitivePattern, '--snip--');
        const split = inspected.split('\n');
        const last = inspected.length - 1;
        const prependPart = inspected[0] !== '{' && inspected[0] !== '[' && inspected[0] !== "'" ? split[0] : inspected[0];
        const appendPart = inspected[last] !== '}' && inspected[last] !== ']' && inspected[last] !== "'" ?
            split[split.length - 1] :
            inspected[last];
        const prepend = `\`\`\`javascript\n${prependPart}\n`;
        const append = `\n${appendPart}\n\`\`\``;
        if (input) {
            return splitMessage(tags.stripIndents`
				*Executed in ${hrDiff[0] > 0 ? `${hrDiff[0]}s ` : ''}${hrDiff[1] / 1000000}ms.*
				\`\`\`javascript
				${inspected}
				\`\`\`
			`, { maxLength: 1900, prepend, append });
        } else {
            return splitMessage(tags.stripIndents`
				*Callback executed after ${hrDiff[0] > 0 ? `${hrDiff[0]}s ` : ''}${hrDiff[1] / 1000000}ms.*
				\`\`\`javascript
				${inspected}
				\`\`\`
			`, { maxLength: 1900, prepend, append });
        }
    }

    private get sensitivePattern(): RegExp {
        if (!this._sensitivePattern) {
            const client = this.client;
            let pattern = '';
            if (this.client?.client.token) pattern += escapeRegex(this.client?.client.token);
            Object.defineProperty(this, '_sensitivePattern', { value: new RegExp(pattern, 'gi'), configurable: false });
        }
        return this._sensitivePattern!;
    }
}


function escapeRegex(str: string) {
    return str.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&');
}

/**
 * Resolves a StringResolvable to a string.
 * @param {StringResolvable} data The string resolvable to resolve
 * @returns {string}
 */
function resolveString(data: string | string[]) {
    if (typeof data === 'string') return data;
    if (Array.isArray(data)) return data.join('\n');
    return String(data);
}

/**
  * Splits a string into multiple chunks at a designated character that do not exceed a specific length.
  * @param {StringResolvable} text Content to split
  * @param {SplitOptions} [options] Options controlling the behavior of the split
  * @returns {string[]}
  */
function splitMessage(text: string, { maxLength = 2000, char = '\n', prepend = '', append = '' } = {}) {
    text = resolveString(text);
    if (text.length <= maxLength) return [text];
    const splitText = text.split(char);
    if (splitText.some(chunk => chunk.length > maxLength)) throw new RangeError('SPLIT_MAX_LEN');
    const messages = [];
    let msg = '';
    for (const chunk of splitText) {
        if (msg && (msg + char + chunk + append).length > maxLength) {
            messages.push(msg + append);
            msg = prepend;
        }
        msg += (msg && msg !== prepend ? char : '') + chunk;
    }
    return messages.concat(msg).filter(m => m);
}