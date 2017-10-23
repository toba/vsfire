import * as vscode from "vscode";
import { PLSQLDefinitionProvider } from "./providers/definition";
import { RuleSymbolProvider } from "./providers/symbol";
import { RuleCompletionProvider } from "./providers/completion";

export function activate(context:vscode.ExtensionContext) {
   // context.subscriptions.push(vscode.languages.registerHoverProvider('plsql', new PLSQLHoverProvider()));
   context.subscriptions.push(vscode.languages.registerCompletionItemProvider('plsql', new RuleCompletionProvider(), '.', '\"'));
   context.subscriptions.push(vscode.languages.registerDefinitionProvider('plsql', new PLSQLDefinitionProvider()));
   // context.subscriptions.push(vscode.languages.registerReferenceProvider('plsql', new PLSQLReferenceProvider()));
   // context.subscriptions.push(vscode.languages.registerDocumentFormattingEditProvider('plsql', new PLSQLDocumentFormattingEditProvider()));
   context.subscriptions.push(vscode.languages.registerDocumentSymbolProvider('plsql', new RuleSymbolProvider()));
   // context.subscriptions.push(vscode.languages.registerWorkspaceSymbolProvider(new PLSQLWorkspaceSymbolProvider()));
   // context.subscriptions.push(vscode.languages.registerRenameProvider('plsql', new PLSQLRenameProvider()));
   // context.subscriptions.push(vscode.languages.registerSignatureHelpProvider('plsql', new PLSQLSignatureHelpProvider(), '(', ','));
   // context.subscriptions.push(vscode.languages.registerCodeActionsProvider('plsql', new PLSQLCodeActionProvider()));
}