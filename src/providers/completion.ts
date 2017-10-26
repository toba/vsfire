import {
   CancellationToken,
   CompletionItem,
   CompletionItemKind,
   CompletionItemProvider,
   Position,
   SnippetString,
   TextDocument } from "vscode";
import { find, MethodInfo, TypeInfo } from "../grammar";

const cache:{[key:string]:CompletionItem[]} = {};
/** Match last word in text preceded by space or open paren/bracket. */
const priorWord = new RegExp("[\\s\\(\\[]([A-Za-z0-9_\\.]+)\\s*$");

/**
 * Provide suggestions for previous word or partial word.
 */
export class RuleCompletionProvider implements CompletionItemProvider {
   public provideCompletionItems(doc:TextDocument, pos:Position, _tok:CancellationToken):Thenable<CompletionItem[]> {
      const word = adjacentWord(doc, pos);
      if (word == null || word == "") {
         return null;
      } else if (word.slice(-1) == ".") {
         return members(word.slice(0, -1));
      } else {
         return directives(word);
      }
   }
}

/**
 * Get the word adjacent (previous) to the current position. Get the substring
 * of the current line up to the current position then use a compiled regular
 * expression to match the word nearest the end.
 */
function adjacentWord(doc:TextDocument, pos:Position):string {
   const match = priorWord.exec(doc.lineAt(pos.line).text.substring(0, pos.character));
   return (match && match.length > 1) ? match[1] : null;
}

async function directives(name:string):Promise<CompletionItem[]> {
   if (cache[name]) { return Promise.resolve(cache[name]); }

   const access = ["get", "list", "read", "update", "delete", "write"];
   let items:CompletionItem[] = null;

   if (name == "allow" || access.indexOf(name) >= 0) {
      items = access.map(a => {
         const i = new CompletionItem(a, CompletionItemKind.Keyword);
         i.
         return i;
      });
   }

   return Promise.resolve(items);
}

/**
 * Build `CompletionItem`s from `TypeInfo` and `MethodInfo` lists compiled in
 * the `grammar` module.
 */
async function members(name:string):Promise<CompletionItem[]> {
   if (cache[name]) { return Promise.resolve(cache[name]); }

   const info = await find(name);
   let items:CompletionItem[] = null;

   if (info) {
      items = [];
      if (info.fields) { addFields(items, info.fields); }
      if (info.methods) { addMethods(items, info.methods); }
      if (items.length == 0) { items = null; }
   }
   cache[name] = items;
   return items;
}

function addFields(items:CompletionItem[], fields:{[key:string]:TypeInfo}) {
   Reflect.ownKeys(fields).forEach(key => {
      const name = key as string;
      const f = fields[name];
      const c = new CompletionItem(name, CompletionItemKind.Field);

      c.documentation = f.about;
      items.push(c);
   });
}

function addMethods(items:CompletionItem[], methods:{[key:string]:MethodInfo}) {
   Reflect.ownKeys(methods).forEach(key => {
      const name = key as string;
      const m = methods[name];
      const c = new CompletionItem(name, CompletionItemKind.Method);

      c.documentation = m.about;
      if (m.snippet) {
         c.insertText = new SnippetString(m.snippet);
      }
      items.push(c);
   });
}