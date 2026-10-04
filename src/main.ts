import path from "path";
import { DiscordBot } from "./bot";



// Initialize and run the bot
(async () => {
    const commandsDirectoryPath = path.resolve(__dirname, "./commands/");
    const modalHandlersDirectoryPath = path.resolve(__dirname, "./modal_handlers/");
    const toolsDirectoryPath = path.resolve(__dirname, "./llm_tools/");

    const app = new DiscordBot(commandsDirectoryPath, modalHandlersDirectoryPath, toolsDirectoryPath);
    await app.start();
})();
