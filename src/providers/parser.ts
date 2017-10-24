import { CompletionItem, CompletionItemKind } from "vscode";
import { find } from "../grammar";

export function suggestions(name:string):CompletionItem[] {
   const info = find(name);
   if (info && info.fields || info.methods) {
      const items:CompletionItem[] = [];

      Reflect.ownKeys(info.fields).forEach(key => {
         const f = info.fields[key];
         const item = new CompletionItem(key as string, CompletionItemKind.Field);

         item.detail = f.about;

         items.push(item);
      });
      return items;
   }
   return null;
}
