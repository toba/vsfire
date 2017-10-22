import { Diagnostic, DiagnosticSeverity, Range } from "vscode-languageserver";

import * as core from "./core";
import { arrayFrom, flatMap, getDirectoryPath, getRootLength, memoize, returnFalse, sortAndDeduplicateDiagnostics } from "./core";
import { Debug, createMap, forEach, getNormalizedAbsolutePath, normalizePath } from "./core";
import { SolcError, solcErrToDiagnostic, soliumErrObjectToDiagnostic } from "./diagnostics";
import { createModuleResolutionCache, resolveModuleName } from "./moduleNameResolver";
import { sys } from "./sys";
import { CompilerHost, CompilerOptions, HasInvalidatedResolution, PackageId, Path, Program, SourceFile } from "./types";
import { compareDataObjects, emptyArray, setResolvedModule } from "./utilities";

const solparse = require("solparse");
const solc = require("solc");
const Solium = require("solium");

/**
 * Create a new 'Program' instance. A Program is an immutable collection of 'SourceFile's and a 'CompilerOptions'
 * that represent a compilation unit.
 *
 * Creating a program proceeds from a set of root files, expanding the set of inputs by following imports and
 * triple-slash-reference-path directives transitively. '@types' and triple-slash-reference-types are also pulled in.
 *
 * @param rootNames - A set of root files.
 * @param options - The compiler options which should be used.
 * @param host - The host interacts with the underlying file system.
 * @returns A 'Program' object.
 */
export function createProgram(rootNames: ReadonlyArray<string>, options: CompilerOptions, host?: CompilerHost): Program {
    let program: Program;
    const files: SourceFile[] = [];
    const fileProcessingDiagnostics: Diagnostic[] = [];

    host = host || createCompilerHost(options);

    const currentDirectory = host.getCurrentDirectory();

    let moduleResolutionCache = createModuleResolutionCache(currentDirectory, x => host.getCanonicalFileName(x));
    const resolveModuleNamesWorker = (moduleNames: string[], containingFile: string) => loadWithLocalCache(checkAllDefined(moduleNames), containingFile, loader);
    const hasInvalidatedResolution = host.hasInvalidatedResolution || returnFalse;
    const loader = (moduleName: string, containingFile: string) => resolveModuleName(moduleName, containingFile, options, host, moduleResolutionCache).resolvedModule;

    // Map from a stringified PackageId to the source file with that id.
    // Only one source file may have a given packageId. Others become redirects (see createRedirectSourceFile).
    // `packageIdToSourceFile` is only used while building the program, while `sourceFileToPackageName` and `isSourceFileTargetOfRedirect` are kept around.
    const packageIdToSourceFile = createMap<SourceFile>();
    // Maps from a SourceFile's `.path` to the name of the package it was imported with.
    const sourceFileToPackageName = createMap<string>();
    // See `sourceFileIsRedirectedTo`.
    const redirectTargetsSet = createMap<true>();

    const filesByName = createMap<SourceFile | undefined>();
    let missingFilePaths: ReadonlyArray<Path>;
    // stores 'filename -> file association' ignoring case
    // used to track cases when two file names differ only in casing
    const filesByNameIgnoreCase = host.useCaseSensitiveFileNames() ? createMap<SourceFile>() : undefined;

    forEach(rootNames, name => processRootFile(name));
    missingFilePaths = arrayFrom(filesByName.keys(), p => <Path>p).filter(p => !filesByName.get(p));

    Debug.assert(!!missingFilePaths);

    // unconditionally set moduleResolutionCache to undefined to avoid unnecessary leaks
    moduleResolutionCache = undefined;

    program = {
        getRootFileNames: () => rootNames,
        getSourceFile,
        getSourceFileByPath,
        getSourceFiles: () => files,
        getMissingFilePaths: () => missingFilePaths,
        getCompilerDiagnostics,
        getLinterDiagnostics,
        getCompilerOptions: () => options,
        getCurrentDirectory: () => currentDirectory,
        getFileProcessingDiagnostics: () => fileProcessingDiagnostics,
        sourceFileToPackageName,
        redirectTargetsSet,
        hasInvalidatedResolution
    };

    return program;

    function toPath(fileName: string): Path {
        return core.toPath(fileName, currentDirectory, getCanonicalFileName);
    }

    function getSourceFile(fileName: string): SourceFile {
        return getSourceFileByPath(toPath(fileName));
    }

    function getSourceFileByPath(path: Path): SourceFile {
        return filesByName.get(path);
    }

    function processRootFile(fileName: string) {
        processSourceFile(normalizePath(fileName),  /*packageId*/ undefined);
    }

    function collectExternalModuleReferences(file: SourceFile): void {
        if (file.imports) {
            return;
        }

        const imports: string[] = [];
        try {
            const result = solparse.parse(file.text);
            for (const element of result.body) {
                if (element.type !== "ImportStatement") {
                    continue;
                }
                imports.push(element.from);
            }
        } catch (err) {
        }

        file.imports = imports || emptyArray;
    }

    function getSourceFileFromReferenceWorker(
        fileName: string,
        getSourceFile: (fileName: string) => SourceFile | undefined,
        fail?: (diagnostic: any, ...argument: string[]) => void,
        refFile?: SourceFile): SourceFile | undefined {

        const sourceFile = getSourceFile(fileName);
        if (fail) {
            if (!sourceFile) {
                fail(undefined, fileName);
            }
            else if (refFile && host.getCanonicalFileName(fileName) === host.getCanonicalFileName(refFile.fileName)) {
                fail(undefined);
            }
        }
        return sourceFile;
    }

    /** This has side effects through `findSourceFile`. */
    function processSourceFile(fileName: string, packageId: PackageId | undefined, refFile?: SourceFile, refRange?: Range): void {
        getSourceFileFromReferenceWorker(fileName,
            fileName => findSourceFile(fileName, toPath(fileName), refFile, refRange, packageId),
            message => {
                fileProcessingDiagnostics.push({
                    message,
                    severity: DiagnosticSeverity.Error,
                    range: refRange
                });
            },
            refFile);
    }

    function createRedirectSourceFile(redirectTarget: SourceFile, unredirected: SourceFile, fileName: string, path: Path): SourceFile {
        const redirect: SourceFile = Object.create(redirectTarget);
        redirect.fileName = fileName;
        redirect.path = path;
        redirect.redirectInfo = { redirectTarget, unredirected };
        return redirect;
    }

    // Get source file from normalized fileName
    function findSourceFile(fileName: string, path: Path, refFile: SourceFile, refRange: Range, packageId: PackageId | undefined): SourceFile | undefined {
        if (filesByName.has(path)) {
            return filesByName.get(path);
        }

        // We haven't looked for this file, do so now and cache result
        const file = host.getSourceFile(fileName, hostErrorMessage => {
            fileProcessingDiagnostics.push({
                message: `Cannot read file ${fileName}:${hostErrorMessage}`,
                severity: DiagnosticSeverity.Error,
                range: refRange
            });
        }, true);

        if (packageId) {
            const packageIdKey = `${packageId.name}/${packageId.subModuleName}@${packageId.version}`;
            const fileFromPackageId = packageIdToSourceFile.get(packageIdKey);
            if (fileFromPackageId) {
                // Some other SourceFile already exists with this package name and version.
                // Instead of creating a duplicate, just redirect to the existing one.
                const dupFile = createRedirectSourceFile(fileFromPackageId, file, fileName, path);
                redirectTargetsSet.set(fileFromPackageId.path, true);
                filesByName.set(path, dupFile);
                sourceFileToPackageName.set(path, packageId.name);
                files.push(dupFile);
                return dupFile;
            }
            else if (file) {
                // This is the first source file to have this packageId.
                packageIdToSourceFile.set(packageIdKey, file);
                sourceFileToPackageName.set(path, packageId.name);
            }
        }

        filesByName.set(path, file);
        if (file) {
            file.path = path;

            if (host.useCaseSensitiveFileNames()) {
                const pathLowerCase = path.toLowerCase();
                // for case-sensitive file systems check if we've already seen some file with similar filename ignoring case
                const existingFile = filesByNameIgnoreCase.get(pathLowerCase);
                if (existingFile) {
                    reportFileNamesDifferOnlyInCasingError(fileName, existingFile.fileName, refFile, refRange);
                }
                else {
                    filesByNameIgnoreCase.set(pathLowerCase, file);
                }
            }

            // always process imported modules to record module name resolutions
            processImportedModules(file);
            files.push(file);
        }

        return file;
    }

    function reportFileNamesDifferOnlyInCasingError(fileName: string, existingFileName: string, _refFile: SourceFile, refRange: Range): void {
        fileProcessingDiagnostics.push({
            message: `File name ${fileName} differs from already included file name ${existingFileName} only in casing`,
            severity: DiagnosticSeverity.Error,
            range: refRange
        });
    }

    function getCanonicalFileName(fileName: string): string {
        return host.getCanonicalFileName(fileName);
    }

    function processImportedModules(file: SourceFile) {
        collectExternalModuleReferences(file);
        if (file.imports.length) {
            const moduleNames = getModuleNames(file);
            const resolutions = resolveModuleNamesWorker(moduleNames, getNormalizedAbsolutePath(file.fileName, currentDirectory));
            Debug.assert(resolutions.length === moduleNames.length);
            for (let i = 0; i < moduleNames.length; i++) {
                const resolution = resolutions[i];
                setResolvedModule(file, moduleNames[i], resolution);

                if (!resolution) {
                    continue;
                }

                const resolvedFileName = resolution.resolvedFileName;
                const path = toPath(resolvedFileName);
                // FIXME: Retrieve refRange from file.imports.
                findSourceFile(resolvedFileName, path, file, undefined, resolution.packageId);
            }
        }
        else {
            // no imports - drop cached module resolutions
            file.resolvedModules = undefined;
        }
    }

    function getDiagnosticsHelper(
        sourceFile: SourceFile,
        getDiagnostics: (sourceFile: SourceFile, ...rest: any[]) => ReadonlyArray<Diagnostic>, ...rest: any[]): ReadonlyArray<Diagnostic> {
        if (sourceFile) {
            return getDiagnostics(sourceFile, ...rest);
        }
        return sortAndDeduplicateDiagnostics(flatMap(program.getSourceFiles(), sourceFile => {
            return getDiagnostics(sourceFile, ...rest);
        }));
    }

    function getCompilerDiagnostics(sourceFile: SourceFile): ReadonlyArray<Diagnostic> {
        return getDiagnosticsHelper(sourceFile, getCompilerDiagnosticsForFile);
    }

    function getLinterDiagnostics(sourceFile: SourceFile, soliumRules: any): ReadonlyArray<Diagnostic> {
        return getDiagnosticsHelper(sourceFile, getLinterDiagnosticsForFile, soliumRules);
    }

    function getCompilerDiagnosticsForFile(sourceFile: SourceFile): ReadonlyArray<Diagnostic> {
        const input = { [sourceFile.fileName]: { content: sourceFile.text } };
        collectSources(sourceFile);

        return compileContracts(input);

        function collectSources(sourceFile: SourceFile) {
            if (sourceFile.resolvedModules) {
                sourceFile.resolvedModules.forEach(resolved => {
                    if (resolved) {
                        const sourceFile = program.getSourceFileByPath(toPath(resolved.resolvedFileName));
                        const moduleName = resolved.packageId ? `${resolved.packageId.name}/${resolved.packageId.subModuleName}` : sourceFile.fileName;
                        input[moduleName] = { content: sourceFile.text };
                        collectSources(sourceFile);
                    }
                });
            }
        }

        function compileContracts(sources: { [path: string]: { content: string } }): ReadonlyArray<Diagnostic> {
            const solcStandardInput = {
                language: "Solidity",
                sources,
                settings: {
                    optimizer: options.optimizer,
                    remappings: options.remappings,
                    outputSelection: {
                        "*": {
                            "*": [
                                "abi",
                                "ast",
                                "evm.bytecode.object",
                                "evm.bytecode.sourceMap",
                                "evm.deployedBytecode.object",
                                "evm.deployedBytecode.sourceMap"
                            ]
                        },
                    }
                }
            };
            const result = solc.compileStandard(JSON.stringify(solcStandardInput));
            const standardOutput = JSON.parse(result);
            const errors = standardOutput.errors || [];
            return errors.map((error: SolcError) => solcErrToDiagnostic(error));
        }
    }

    function getLinterDiagnosticsForFile(sourceFile: SourceFile, soliumRules: any): ReadonlyArray<Diagnostic> {
        try {
            const errorObjects = Solium.lint(sourceFile.text, { rules: soliumRules });
            return errorObjects.map(soliumErrObjectToDiagnostic);
        } catch (err) {
            const match = /An error .*?\nSyntaxError: (.*?) Line: (\d+), Column: (\d+)/.exec(err.message);
            if (!match) {
                // FIXME: Send an error message.
                return [];
            }

            const line = parseInt(match[2], 10) - 1;
            const character = parseInt(match[3], 10) - 1;

            return [
                {
                    message: `Syntax error: ${match[1]}`,
                    range: {
                        start: { character, line },
                        end: { character, line }
                    },
                    severity: DiagnosticSeverity.Error,
                },
            ];
        }
    }
}

function checkAllDefined(names: string[]): string[] {
    Debug.assert(names.every(name => name !== undefined), "A name is undefined.", () => JSON.stringify(names));
    return names;
}

function getModuleNames({ imports }: SourceFile): string[] {
    const res = imports.map(i => i);
    return res;
}

function loadWithLocalCache<T>(names: string[], containingFile: string, loader: (name: string, containingFile: string) => T): T[] {
    if (names.length === 0) {
        return [];
    }
    const resolutions: T[] = [];
    const cache = createMap<T>();
    for (const name of names) {
        let result: T;
        if (cache.has(name)) {
            result = cache.get(name);
        }
        else {
            cache.set(name, result = loader(name, containingFile));
        }
        resolutions.push(result);
    }
    return resolutions;
}

export function createCompilerHost(_options: CompilerOptions): CompilerHost {
    const existingDirectories = createMap<boolean>();

    function getCanonicalFileName(fileName: string): string {
        // if underlying system can distinguish between two files whose names differs only in cases then file name already in canonical form.
        // otherwise use toLowerCase as a canonical form.
        return sys.useCaseSensitiveFileNames ? fileName : fileName.toLowerCase();
    }

    function getSourceFile(fileName: string, onError?: (message: string) => void): SourceFile {
        let text: string;
        try {
            text = sys.readFile(fileName);
        }
        catch (e) {
            if (onError) {
                onError(e.message);
            }
            text = "";
        }

        return text !== undefined ? createSourceFile(fileName, text) : undefined;
    }

    function directoryExists(directoryPath: string): boolean {
        if (existingDirectories.has(directoryPath)) {
            return true;
        }
        if (sys.directoryExists(directoryPath)) {
            existingDirectories.set(directoryPath, true);
            return true;
        }
        return false;
    }

    function ensureDirectoriesExist(directoryPath: string) {
        if (directoryPath.length > getRootLength(directoryPath) && !directoryExists(directoryPath)) {
            const parentDirectory = getDirectoryPath(directoryPath);
            ensureDirectoriesExist(parentDirectory);
            sys.createDirectory(directoryPath);
        }
    }

    const realpath = sys.realpath && ((path: string) => sys.realpath(path));

    return {
        getSourceFile,
        getCurrentDirectory: memoize(() => sys.getCurrentDirectory()),
        useCaseSensitiveFileNames: () => sys.useCaseSensitiveFileNames,
        getCanonicalFileName,
        fileExists: fileName => sys.fileExists(fileName),
        readFile: fileName => sys.readFile(fileName),
        trace: (s: string) => sys.write(s + "\n"),
        directoryExists: directoryName => sys.directoryExists(directoryName),
        getDirectories: (path: string) => sys.getDirectories(path),
        realpath
    };
}

export function createSourceFile(fileName: string, sourceText: string): SourceFile {
    return {
        fileName,
        text: sourceText
    } as SourceFile;
}

/**
 * Determines if program structure is upto date or needs to be recreated
 */
/* @internal */
export function isProgramUptoDate(
    program: Program | undefined,
    rootFileNames: string[],
    newOptions: CompilerOptions,
    getSourceVersion: (path: Path) => string,
    fileExists: (fileName: string) => boolean,
    hasInvalidatedResolution: HasInvalidatedResolution
): boolean {
    // If we haven't create a program yet or has changed automatic type directives, then it is not up-to-date
    if (!program) {
        return false;
    }

    // If number of files in the program do not match, it is not up-to-date
    if (program.getRootFileNames().length !== rootFileNames.length) {
        return false;
    }

    // If any file is not up-to-date, then the whole program is not up-to-date
    if (program.getSourceFiles().some(sourceFileNotUptoDate)) {
        return false;
    }

    // If any of the missing file paths are now created
    if (program.getMissingFilePaths().some(fileExists)) {
        return false;
    }

    const currentOptions = program.getCompilerOptions();
    // If the compilation settings do no match, then the program is not up-to-date
    if (!compareDataObjects(currentOptions, newOptions)) {
        return false;
    }

    return true;

    function sourceFileNotUptoDate(sourceFile: SourceFile): boolean {
        return sourceFile.version !== getSourceVersion(sourceFile.path) ||
            hasInvalidatedResolution(sourceFile.path);
    }
}
