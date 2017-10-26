import {
   CancellationToken,
   Hover,
   HoverProvider,
   ProviderResult,
   Position,
   TextDocument } from "vscode";
import { find } from "../grammar";
import { currentWord } from "../parse";

const cache:{[key:string]:Hover} = {};

export default class RuleHoverProvider implements HoverProvider {
   public provideHover(doc:TextDocument, pos:Position, _tok:CancellationToken):ProviderResult<Hover> {
      const word = currentWord(doc, pos);
      if (word == null || word == "") {
         return null;
      } else {
         return members(word);
      }
   }
}

/**
 * Build `Hover`s from `TypeInfo` and `MethodInfo` lists compiled in the
 * `grammar` module.
 */
async function members(name:string):Promise<Hover> {
   if (cache[name]) { return Promise.resolve(cache[name]); }

   const info = await find(name);
   let h:Hover = null;

   if (info) {
      h = new Hover(info.about);
   }
   cache[name] = h;
   return h;
}