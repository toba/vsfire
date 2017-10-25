import { ExtensionContext, languages } from "vscode";
import { RuleCompletionProvider } from "./providers/completion";

/**
 * Compare https://github.com/andersea/HTMLClassSuggestionsVSCode/blob/master/src/extension.ts
 */
export function activate(context:ExtensionContext) {
   context.subscriptions.push(
      languages.registerCompletionItemProvider("firerules", new RuleCompletionProvider(), ".")
   );
}