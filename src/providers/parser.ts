import { CompletionItem, CompletionItemKind, SnippetString } from "vscode";
import { find, MethodInfo, TypeInfo } from "../grammar";

const cache:{[key:string]:CompletionItem[]} = {};

/**
 * Build `CompletionItem`s from `TypeInfo` and `MethodInfo` lists.
 */
export async function completions(name:string):Promise<CompletionItem[]> {
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