import * as vscode from 'vscode';
import { RuleController, RuleSnippet } from './controller';

const lang = "firerule";

export class RuleCompletionProvider implements vscode.CompletionItemProvider {
   private controller = new RuleController();
   private completions:vscode.CompletionItem[];
   private snippets:vscode.CompletionItem[];

   public provideCompletionItems(
      document:vscode.TextDocument,
      position:vscode.Position,
      _token:vscode.CancellationToken):Thenable<vscode.CompletionItem[]> {

      return new Promise<vscode.CompletionItem[]>((resolve, _reject) => {
         const completions:vscode.CompletionItem[] = [];
         const lineText = document.lineAt(position.line).text;
         const text = document.getText();
         const wordRange = document.getWordRangeAtPosition(position);
         const word = wordRange && document.getText(wordRange);
         const item = this.getItem(document, position, lineText, text);
         
         if (item) {
            completions.push(item);
         }

         // PLDOC - custom items
         if (!this.completions) {
            this.completions = this.getCompletions();
         }
         Array.prototype.push.apply(completions, filter(this.completions, word));

         if (!this.snippets) { this.snippets = getSnippets(); }

         Array.prototype.push.apply(completions, filter(this.snippets, word));

         // TODO...
         // Other completion
         /*
         const lineTillCurrentPosition = lineText.substr(0, position.character);
         // TODO: collection with '.' !
         const regEx = /((?:\w)*)\.((?:\w)*)$/i;
         let found;
         if (found = regEx.exec(lineTillCurrentPosition)) {
               Array.prototype.push.apply(completeItems, this.getPackageItems(found[1], found[2]));
         } else {
               // TODO: limit the suggestions useful for the context...
               const wordAtPosition = document.getWordRangeAtPosition(position);
               if (wordAtPosition) {
                  // currentWord = document.getText(wordAtPosition);
                  Array.prototype.push.apply(completeItems, this.getKeyWordItems());
               }
         }
         */

         // completionItems must be filtered and if empty return undefined
         // otherwise word suggestion are lost ! (https://github.com/Microsoft/vscode/issues/21611)
         resolve(completions.length > 0 ? completions : undefined);
      });
   }

   private getItem(
      document:vscode.TextDocument,
      position:vscode.Position, 
      lineText:string, 
      text:string):vscode.CompletionItem {

      // Empty line, above a function or procedure
      if ((text !== "") && (lineText.trim() === "") && (document.lineCount > position.line + 1)) {
         const nextPos = new vscode.Position(position.line + 1, 0);
         const nextText = text.substr(document.offsetAt(nextPos));
         const snippet = this.controller.getDocSnippet(nextText);

         if (snippet) {
            return createSnippet(snippet, lang);
         }
      };
    }

   private getCompletions():vscode.CompletionItem[] {
      const snippets = this.controller.getCustomSnippets();
      return (snippets) ? snippets.map(s => createSnippet(s)) : [];
   }

/*
    private getPackageItems(pkg, func): vscode.CompletionItem[] {
        // TODO
        return [];
    }

    private getKeyWordItems(): vscode.CompletionItem[] {
        // TODO : Terminate...
        if (!this.plsqlKeyWordItems) {
            const parsedJSON = require('../../syntaxes/plsql.completion.json');
            return parsedJSON.keywords.map(value => this.createCompleteItem(vscode.CompletionItemKind.Keyword, value));
        }
        return [];
    }
*/
}

/**
 * Must return undefined if the completio array is empty otherwise the
 * suggestions are lost (https://github.com/Microsoft/vscode/issues/21611)
 */
function filter(completions:vscode.CompletionItem[], word:string) {
   if (completions && word) {
      return completions.filter(item => item.label.startsWith(word));
   } else if (completions) {
      return completions;
   } else {
      return [];
   }
}

const createSnippet = (snippet:RuleSnippet, origin = "") => createCompletion(
   vscode.CompletionItemKind.Snippet,
   snippet.prefix,
   snippet.description, 
   snippet.body.join('\n'), 
   origin);


function getSnippets():vscode.CompletionItem[] {
   if (vscode.workspace.getConfiguration("plsql-language").get<boolean>("snippets.enable")) {
      const parsedJSON = require("../../snippets/plsql.snippets.json");
      return Object.keys(parsedJSON).map(key => createSnippet(parsedJSON[key], "plsql.snippets"));
   }
   return [];
}

function createCompletion(
   type:vscode.CompletionItemKind, 
   label:string, 
   doc = "", 
   text = label, 
   origin = ""):vscode.CompletionItem {

   const completion = new vscode.CompletionItem(label, type);
   completion.insertText = (type === vscode.CompletionItemKind.Snippet)
      ? new vscode.SnippetString(text)
      : text;
   completion.documentation = doc;
   completion.detail = origin;

   return completion;
}