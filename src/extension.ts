import { ExtensionContext, languages } from 'vscode';
import RuleCompletionProvider from './providers/completion';
import RuleHoverProvider from './providers/hover';

export function activate(context: ExtensionContext) {
   context.subscriptions.push(
      languages.registerCompletionItemProvider(
         'firerules',
         new RuleCompletionProvider(),
         '.',
         ' '
      ),
      languages.registerHoverProvider('firerules', new RuleHoverProvider())
   );
}
