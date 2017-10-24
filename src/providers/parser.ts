import { CompletionItem, CompletionItemKind } from "vscode";
import { find, MemberInfo } from "../grammar";

export async function completions(name:string):Promise<CompletionItem[]> {
   const info = await find(name);
   if (info && info.fields || info.methods) {
      const items = [
         ...makeCompletions(info.fields, CompletionItemKind.Field),
         ...makeCompletions(info.methods, CompletionItemKind.Method)
      ];
      return items.length > 0 ? items : null;
   }
   return null;
}

function makeCompletions(members:{[key:string]:MemberInfo}, kind:CompletionItemKind) {
   const items:CompletionItem[] = [];

   if (members == undefined) { return items; }

   Reflect.ownKeys(members).forEach(key => {
      const m = members[key];
      const item = new CompletionItem(key as string, kind);

      item.detail = m.about;
      items.push(item);
   });

   return items;
}