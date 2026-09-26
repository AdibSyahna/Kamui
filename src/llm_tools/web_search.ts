import { z } from "zod";
import { LLMTool } from "../abstract_class/llm_tool";

const Schema = z.object({
  query: z.string()
    .describe("The search query to perform using Brave Search."),
  numResults: z.number()
    .optional()
    .default(10)
    .describe("Maximum number of search results to return (default: 10, max: 20).")
});

export default class WebSearchTool extends LLMTool {
  name = "web_search";
  description = "Performs a web search using Brave Search API and returns relevant results.";
  schema = Schema;
  override statusMessage: string = "is searching the web...";
  override finishedMessage: string = "has finished searching the web.";

  async _call(input: { query: string; numResults?: number }): Promise<string> {
    try {
      const apiKey = this.client?.config.brave.api_key;
      if (!apiKey || apiKey === "YOUR_BRAVE_API_KEY_HERE") {
        return "Error: Brave Search API key not configured. Please add a valid API key to the 'brave.api_key' field in config.json.";
      }

      const numResults = Math.min(input.numResults || 10, 20); // Cap at 20 results max
      const encodedQuery = encodeURIComponent(input.query);

      const response = await fetch(
        `https://api.search.brave.com/res/v1/web/search?q=${encodedQuery}&count=${numResults}&country=JP&safesearch=off`,
        {
          method: "GET",
          headers: {
            "Accept": "application/json",
            "X-Subscription-Token": apiKey,
            "X-Loc-Country": "JP"
          }
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        return `Error: Brave Search API request failed with status ${response.status}: ${errorText}`;
      }

      const data = await response.json() as BraveSearchResult;
      if (!data.web?.results || data.web.results.length === 0) {
        return `No search results found for query: "${input.query}"`;
      }

      // Format the results
      const results = data.web.results.map((result: any, index: number) => {
        const title = result.title || "No title";
        const url = result.url || "No URL";
        const description = result.description || "No description available";
        const displayedLink = result.displayed_link || url;

        return `${index + 1}. **${title}**\n   ${displayedLink}\n   ${description}\n`;
      }).join("\n");

      const totalResults = data.web.results.length;
      const summary = `Found ${totalResults} results for "${input.query}". Showing top ${numResults}:\n\n`;

      console.log(summary + results);
      
      return summary + results;
    } catch (error: unknown) {
      console.error("Brave Search API error:", error);
      return `Error: Failed to perform web search: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}
