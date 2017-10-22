import {
    CompletionItem,
    Diagnostic,
    Position
} from "vscode-languageserver";

import {
    Debug,
    arrayFrom,
    createGetCanonicalFileName,
    createMap,
    isString,
    returnFalse,
    toPath
} from "../compiler/core";
import { directoryProbablyExists } from "../compiler/moduleNameResolver";
import { createProgram, createSourceFile, isProgramUptoDate } from "../compiler/program";
import {
    CompilerHost,
    CompilerOptions,
    HasInvalidatedResolution,
    Map,
    Path,
    Program,
    SourceFile
} from "../compiler/types";
import * as completions from "./completions";
import { LanguageService, LanguageServiceHost } from "./types";

export function createLanguageService(host: LanguageServiceHost): LanguageService {
    let program: Program;
    let lastProjectVersion: string;

    const useCaseSensitivefileNames = host.useCaseSensitiveFileNames && host.useCaseSensitiveFileNames();
    const getCanonicalFileName = createGetCanonicalFileName(useCaseSensitivefileNames);
    const currentDirectory = host.getCurrentDirectory();

    function getValidSourceFile(fileName: string): SourceFile {
        const sourceFile = program.getSourceFile(fileName);
        if (!sourceFile) {
            throw new Error("Could not find file: '" + fileName + "'.");
        }
        return sourceFile;
    }

    function synchronizeHostData(): void {
        // perform fast check if host supports it
        if (host.getProjectVersion) {
            const hostProjectVersion = host.getProjectVersion();
            if (hostProjectVersion) {
                if (lastProjectVersion === hostProjectVersion) {
                    return;
                }

                lastProjectVersion = hostProjectVersion;
            }
        }

        const hasInvalidatedResolution: HasInvalidatedResolution = host.hasInvalidatedResolution || returnFalse;
        // Get a fresh cache of the host information
        let hostCache = new HostCache(host, getCanonicalFileName);
        const rootFileNames = hostCache.getRootFileNames();

        // If the program is already up-to-date, we can reuse it
        if (isProgramUptoDate(program, rootFileNames, host.getCompilationSettings(), path => host.getScriptVersion(path), host.fileExists, hasInvalidatedResolution)) {
            return;
        }

        const newSettings = hostCache.compilationSettings();

        // Now create a new compiler
        const compilerHost: CompilerHost = {
            getSourceFile: getOrCreateSourceFile,
            getSourceFileByPath: getOrCreateSourceFileByPath,
            getCanonicalFileName,
            useCaseSensitiveFileNames: () => useCaseSensitivefileNames,
            getCurrentDirectory: () => currentDirectory,
            fileExists,
            readFile(fileName) {
                return host.readFile && host.readFile(fileName);
            },
            directoryExists: (directoryName: string) => {
                return directoryProbablyExists(directoryName, host);
            },
            getDirectories: (path: string) => {
                return host.getDirectories ? host.getDirectories(path) : [];
            },
            hasInvalidatedResolution
        };
        if (host.trace) {
            compilerHost.trace = (message: string) => host.trace(message);
        }

        // IMPORTANT - It is critical from this moment onward that we do not check
        // cancellation tokens.  We are about to mutate source files from a previous program
        // instance.  If we cancel midway through, we may end up in an inconsistent state where
        // the program points to old source files that have been invalidated because of
        // incremental parsing.
        program = createProgram(rootFileNames, newSettings, compilerHost);

        // hostCache is captured in the closure for 'getOrCreateSourceFile' but it should not be used past this point.
        // It needs to be cleared to allow all collected snapshots to be released
        hostCache = undefined;

        return;

        function fileExists(fileName: string) {
            const path = toPath(fileName, currentDirectory, getCanonicalFileName);
            const entry = hostCache.getEntryByPath(path);
            return entry ?
                !isString(entry) :
                (host.fileExists && host.fileExists(fileName));
        }

        function getOrCreateSourceFile(fileName: string, onError?: (message: string) => void, shouldCreateNewSourceFile?: boolean): SourceFile {
            return getOrCreateSourceFileByPath(fileName, toPath(fileName, currentDirectory, getCanonicalFileName), onError, shouldCreateNewSourceFile);
        }

        function getOrCreateSourceFileByPath(fileName: string, path: Path, _onError?: (message: string) => void, _shouldCreateNewSourceFile?: boolean): SourceFile {
            Debug.assert(hostCache !== undefined);
            // The program is asking for this file, check first if the host can locate it.
            // If the host can not locate the file, then it does not exist. return undefined
            // to the program to allow reporting of errors for missing files.
            const hostFileInformation = hostCache.getOrCreateEntryByPath(fileName, path);
            if (!hostFileInformation) {
                return undefined;
            }

            const text = host.readFile(path);
            return createSourceFile(fileName, text);
        }
    }

    function getProgram(): Program {
        synchronizeHostData();

        return program;
    }

    function getCompletionsAtPosition(fileName: string, position: Position): CompletionItem[] {
        return completions.getCompletionsAtPosition(host, fileName, position);
    }

    /// Diagnostics
    function getCompilerDiagnostics(fileName: string): Diagnostic[] {
        synchronizeHostData();

        return program.getCompilerDiagnostics(getValidSourceFile(fileName)).slice();
    }

    function getLinterDiagnostics(fileName: string, soliumRules: any): Diagnostic[] {
        synchronizeHostData();

        return program.getLinterDiagnostics(getValidSourceFile(fileName), soliumRules).slice();
    }

    return {
        getProgram,
        getCompletionsAtPosition,
        getCompilerDiagnostics,
        getLinterDiagnostics
    };
}

// Information about a specific host file.
interface HostFileInformation {
    hostFileName: string;
    version: string;
}

// Either it will be file name if host doesnt have file or it will be the host's file information
type CachedHostFileInformation = HostFileInformation | string;

// Cache host information about script Should be refreshed
// at each language service public entry point, since we don't know when
// the set of scripts handled by the host changes.
class HostCache {
    private fileNameToEntry: Map<CachedHostFileInformation>;
    private _compilationSettings: CompilerOptions;
    private currentDirectory: string;

    constructor(private host: LanguageServiceHost, getCanonicalFileName: (fileName: string) => string) {
        // script id => script index
        this.currentDirectory = host.getCurrentDirectory();
        this.fileNameToEntry = createMap<CachedHostFileInformation>();

        // Initialize the list with the root file names
        const rootFileNames = host.getScriptFileNames();
        for (const fileName of rootFileNames) {
            this.createEntry(fileName, toPath(fileName, this.currentDirectory, getCanonicalFileName));
        }

        // store the compilation settings
        this._compilationSettings = host.getCompilationSettings() || getDefaultCompilerOptions();
    }

    public compilationSettings() {
        return this._compilationSettings;
    }

    private createEntry(fileName: string, path: Path) {
        let entry: CachedHostFileInformation;
        entry = {
            hostFileName: fileName,
            version: this.host.getScriptVersion(fileName)
        };

        this.fileNameToEntry.set(path, entry);
        return entry;
    }

    public getEntryByPath(path: Path): CachedHostFileInformation | undefined {
        return this.fileNameToEntry.get(path);
    }

    public getHostFileInformation(path: Path): HostFileInformation | undefined {
        const entry = this.fileNameToEntry.get(path);
        return !isString(entry) ? entry : undefined;
    }

    public getOrCreateEntryByPath(fileName: string, path: Path): HostFileInformation {
        const info = this.getEntryByPath(path) || this.createEntry(fileName, path);
        return isString(info) ? undefined : info;
    }

    public getRootFileNames(): string[] {
        return arrayFrom(this.fileNameToEntry.values(), entry => {
            return isString(entry) ? entry : entry.hostFileName;
        });
    }

    public getVersion(path: Path): string {
        const file = this.getHostFileInformation(path);
        return file && file.version;
    }
}

export function getDefaultCompilerOptions(): CompilerOptions {
    return {
        optimizer: {
            enabled: false
        }
    };
}
