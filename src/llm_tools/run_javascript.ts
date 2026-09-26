// import { SafeEval } from "../addon/eval";
import { z } from "zod";
import { LLMTool } from "../abstract_class/llm_tool";

const Schema = z.object({
  code: z.string()
    .describe("The JavaScript code to execute safely."),
});

export default class RunJavascriptTool extends LLMTool {
  name = "run_javascript";
  description = "Executes JavaScript code safely inside an isolated VM.";
  schema = Schema;
  override statusMessage: string = "is evaluating JavaScript code...";
  override finishedMessage: string = "has finished evaluating JavaScript code.";
  // private safeEval = new SafeEval();

  async _call(input: { code: string }): Promise<string> {
    return `Error: JavaScript Safe Eval has been disabled by admin.`;
    // try {
    //   const result = await this.safeEval.isolatedEval(input.code);
    //   if (result === undefined) return "Tool responded with `undefined`."
    //   else return typeof result === "string" ? result : JSON.stringify(result);
    // } catch (err: any) {
    //   return `Error: ${err.message || String(err)}`;
    // }
  }
}
