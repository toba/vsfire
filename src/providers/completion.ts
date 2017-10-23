import * as vscode from "vscode";
import { find } from "../grammar";

export class RuleCompletionProvider implements vscode.CompletionItemProvider {
   public provideCompletionItems(
      document:vscode.TextDocument,
      position:vscode.Position,
      token:vscode.CancellationToken):Thenable<vscode.CompletionItem[]> {

      return new Promise<vscode.CompletionItem[]>((resolve, _reject) => {
         //const completions:vscode.CompletionItem[] = [];
         // const lineText = document.lineAt(position.line).text;
         // const text = document.getText();
         // const wordRange = document.getWordRangeAtPosition(position);
         // const word = wordRange && document.getText(wordRange);
         // const item = this.getItem(document, position, lineText, text);

         const item = new vscode.CompletionItem("test", vscode.CompletionItemKind.Field);
         console.log("document", document);
         console.log("position", position);
         console.log("token", token);

         resolve([item]);
      });
   }
}