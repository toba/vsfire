import {
   CancellationToken,
   Hover,
   HoverProvider,
   ProviderResult,
   Position,
   TextDocument
} from 'vscode';
import { findAny } from '../grammar';
import { currentWord } from '../parse';

const cache: { [key: string]: Hover | null } = {};

export default class RuleHoverProvider implements HoverProvider {
   public provideHover(
      doc: TextDocument,
      pos: Position,
      _tok: CancellationToken
   ): ProviderResult<Hover> {
      const word = currentWord(doc, pos);
      if (word == null || word == '') {
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
async function members(name: string): Promise<Hover | null> {
   if (cache[name]) {
      return Promise.resolve(cache[name]);
   }

   const info = await findAny(name);
   let h: Hover | null = null;

   if (info) {
      h = new Hover(info.about);
   }
   cache[name] = h;
   return h;
}
