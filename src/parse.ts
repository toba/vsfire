import { Position, TextDocument } from "vscode";

/** Match last word in text preceded by space or open paren/bracket. */
const priorWordPattern = new RegExp("[\\s\\(\\[]([A-Za-z0-9_\\.]+)\\s*$");

/**
 * Get the previous word adjacent to the current position by getting the
 * substring of the current line up to the current position then use a compiled
 * regular expression to match the word nearest the end.
 */
export function priorWord(doc:TextDocument, pos:Position):string {
   const match = priorWordPattern.exec(doc.lineAt(pos.line).text.substring(0, pos.character));
   return (match && match.length > 1) ? match[1] : null;
}

/**
 * Get the word at the current position.
 */
export function currentWord(doc:TextDocument, pos:Position):string {
   const range = doc.getWordRangeAtPosition(pos);
   return (range.isEmpty) ? null : doc.getText(range);
}