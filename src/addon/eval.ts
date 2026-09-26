// temporarily disabled
// reason: failed to compile dependency on dev environment
//         pending investigation.

// import { Isolate } from "isolated-vm";

// export class SafeEval {
//     private Isolate = new Isolate({ memoryLimit: 128 });

//     public async isolatedEval(code: string) {
//         const context = this.Isolate.createContextSync();

//         // !!! crude hack
//         // Split code by newlines and semicolons to handle multi-line code and statements
//         const lines = code.split(/[\n;]/).map(line => line.trim()).filter(line => line);

//         if (lines.length === 0) {
//             context.release();
//             return undefined;
//         }

//         // Replace console.log() at the last line with JSON.stringify() of its argument, otherwise wrap the last line in JSON.stringify
//         const lastLine = lines[lines.length - 1]!;
//         if (lastLine.startsWith('console.log(') && lastLine.endsWith(')')) {
//             const argMatch = lastLine.match(/console\.log\s*\((.*)\)/);
//             if (argMatch) {
//                 lines[lines.length - 1] = `JSON.stringify(${argMatch[1]})`;
//             } else {
//                 lines[lines.length - 1] = `JSON.stringify(${lastLine})`;
//             }
//         } else {
//             lines[lines.length - 1] = `JSON.stringify(${lastLine})`;
//         }

//         const modifiedCode = lines.join('\n');
//         // \!!!

//         const result = await context.eval(modifiedCode);
//         context.release();
//         return result;
//     }
// }
