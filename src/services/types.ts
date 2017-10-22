import {
    CompletionItem,
    Position
} from "vscode-languageserver";
import { Diagnostic } from "vscode-languageserver";

import { CompilerOptions, FileReference, HasInvalidatedResolution, Program } from "../compiler/types";

//
// Public services of a language service instance associated
// with a language service host instance
//
export interface LanguageService {
    getCompletionsAtPosition(fileName: string, position: Position): CompletionItem[];
    getCompilerDiagnostics(fileName: string): Diagnostic[];
    getLinterDiagnostics(fileName: string, soliumRules?: any): Diagnostic[];

    getProgram(): Program;
}

//
// Public interface of the host of a language service instance.
//
export interface LanguageServiceHost {
    getCompilationSettings(): CompilerOptions;
    getNewLine?(): string;
    getProjectVersion?(): string;
    getScriptFileNames(): string[];
    getScriptVersion(fileName: string): string;
    getCurrentDirectory(): string;
    log?(s: string): void;
    trace?(s: string): void;
    error?(s: string): void;
    useCaseSensitiveFileNames?(): boolean;

    readDirectory?(path: string, extensions?: string[], exclude?: string[], include?: string[]): string[];
    readFile?(path: string, encoding?: string): string;
    fileExists?(path: string): boolean;
    directoryExists?(directoryName: string): boolean;

    /* @internal */ hasInvalidatedResolution?: HasInvalidatedResolution;

    /*
     * getDirectories is also required for full import and type reference completions. Without it defined, certain
     * completions will not be provided
     */
    getDirectories?(directoryName: string): string[];
}

export interface PreProcessedFileInfo {
    importedFiles: FileReference[];
}
