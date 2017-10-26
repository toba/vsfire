import {
   CancellationToken,
   CompletionItem,
   CompletionItemKind,
   CompletionItemProvider,
   Position,
   SnippetString,
   TextDocument } from "vscode";
import {
   find,
   allowances,
   MethodInfo,
   TypeInfo } from "../grammar";
import { priorWord } from "../parse";

const cache:{[key:string]:CompletionItem[]} = {};

/**
 * Provide suggestions for previous word or partial word.
 * https://code.visualstudio.com/docs/extensionAPI/language-support#_show-code-completion-proposals
 */
export default class RuleCompletionProvider implements CompletionItemProvider {
   public provideCompletionItems(doc:TextDocument, pos:Position, _tok:CancellationToken):Thenable<CompletionItem[]> {
      const word = priorWord(doc, pos);
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
 * Completions for stand-alone directives `service`, `match` and `allow`.
 */
async function directives(name:string):Promise<CompletionItem[]> {
   if (cache[name]) { return Promise.resolve(cache[name]); }

   let items:CompletionItem[] = null;

   if (name == "allow") {
      const allows = await allowances();
      items = allows.map(a => {
         const i = new CompletionItem(a.name, CompletionItemKind.Keyword);
         i.documentation = a.about;
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