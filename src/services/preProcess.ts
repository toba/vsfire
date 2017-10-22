import { FileReference, SyntaxKind } from "../compiler/types";
import { PreProcessedFileInfo } from "./types";
import { scanner } from "./utilities";

export function preProcessFile(sourceText: string): PreProcessedFileInfo {
    const importedFiles: FileReference[] = [];

    function nextToken() {
        return scanner.scan();
    }

    function tokenText() {
        return scanner.getTokenText();
    }

    function getFileReference() {
        const fileName = scanner.getTokenValue();
        const pos = scanner.getTokenPos();
        return { fileName, pos, end: pos + fileName.length };
    }

    function recordModuleName() {
        importedFiles.push(getFileReference());
    }

    /**
     * Returns true if at least one token was consumed from the stream
     */
    function tryConsumeImport(): boolean {
        let token = scanner.getToken();
        if (token === SyntaxKind.ImportKeyword) {
            token = nextToken();
            if (token === SyntaxKind.StringLiteral) {
                // import "mod";
                recordModuleName();
                return true;
            }
            else {
                if (token === SyntaxKind.OpenBraceToken) {
                    token = nextToken();
                    // consume "{ a as B, c, d as D}" clauses
                    // make sure that it stops on EOF
                    while (token !== SyntaxKind.CloseBraceToken && token !== SyntaxKind.EndOfFileToken) {
                        token = nextToken();
                    }

                    if (token === SyntaxKind.CloseBraceToken) {
                        token = nextToken();
                        if (token === SyntaxKind.StringLiteral && tokenText() === "from") {
                            token = nextToken();
                            if (token === SyntaxKind.StringLiteral) {
                                // import {a as A} from "mod";
                                recordModuleName();
                            }
                        }
                    }
                }
                else if (token === SyntaxKind.AsteriskToken) {
                    token = nextToken();
                    if (token === SyntaxKind.AsKeyword) {
                        token = nextToken();
                        if (token === SyntaxKind.Identifier) {
                            token = nextToken();
                            if (token === SyntaxKind.StringLiteral && tokenText() === "from") {
                                token = nextToken();
                                if (token === SyntaxKind.StringLiteral) {
                                    // import * as NS from "mod"
                                    recordModuleName();
                                }
                            }
                        }
                    }
                }
            }

            return true;
        }

        return false;
    }

    function processImports(): void {
        scanner.setText(sourceText);
        nextToken();
        // Look for:
        //    import "mod";
        //    import {a as A } from "mod";
        //    import * as NS  from "mod"

        while (true) {
            if (scanner.getToken() === SyntaxKind.EndOfFileToken) {
                break;
            }

            if (tryConsumeImport()) {
                continue;
            }
            else {
                nextToken();
            }
        }

        scanner.setText(undefined);
    }

    processImports();
    return { importedFiles };
}
