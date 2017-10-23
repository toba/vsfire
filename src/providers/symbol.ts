import * as vscode from "vscode";

export default class RuleSymbolProvider implements vscode.DocumentSymbolProvider {
   public provideDocumentSymbols(
      document: vscode.TextDocument,
      _token:vscode.CancellationToken):vscode.SymbolInformation[] {

      const regComment = `(?:\\/\\*[\\s\\S]*?\\*\\/)|(?:--.*)`;
      const regFind = `${regComment}|(?:create(?:\\s+or\\s+replace)?\\s+)?((\\b(?:function|procedure|package)\\b(?:\\s+body)?)\\s+(?:\\w+\\.)?\\w+)`;
      const re = new RegExp(regFind, 'gi');
      const symbols:vscode.SymbolInformation[] = [];
      const text = document.getText();

      let found;

      while (found = re.exec(text)) {
         if (found[1]) {
            let line = document.lineAt(document.positionAt(found.index));
            let symbolInfo = new vscode.SymbolInformation(
               found[1], kind(found[2].toLowerCase()),
               new vscode.Range(line.range.start, line.range.end));
            symbols.push(symbolInfo);
         }
      }
      return symbols;
   }
}

function kind(type:string):vscode.SymbolKind {
   switch (type) {
      case "function": return vscode.SymbolKind.Function;
      case "procedure": return vscode.SymbolKind.Method;
      default: return vscode.SymbolKind.Package;
   }
}