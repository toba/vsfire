import * as vscode from "vscode";
import { RuleCompletionProvider } from "./providers/completion";

const selector:vscode.DocumentFilter = { language: "firerules", scheme: "file" };

export function activate(context:vscode.ExtensionContext) {
   context.subscriptions.push(vscode.languages.registerCompletionItemProvider(selector, new RuleCompletionProvider(), "."));
}