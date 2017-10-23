import * as vscode from "vscode";
import { RuleCompletionProvider } from "./providers/completion";

//const selector:vscode.DocumentFilter = { language: "firerules", scheme: "file" };

/**
 * Compare https://github.com/andersea/HTMLClassSuggestionsVSCode/blob/master/src/extension.ts
 */
export function activate(context:vscode.ExtensionContext) {
   context.subscriptions.push(
      vscode.languages.registerCompletionItemProvider("firerules", new RuleCompletionProvider(), ".")
   );
}