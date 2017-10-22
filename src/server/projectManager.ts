import { Observable } from "@reactivex/rxjs";
import * as glob from "glob";
import iterate from "iterare";

import { flatMap, isEthPmJsonFile, isPackageJsonFile, isSolidityFile, noop } from "../compiler/core";
import { resolveModuleName } from "../compiler/moduleNameResolver";
import { CompilerOptions, Program } from "../compiler/types";
import { preProcessFile } from "../services/preProcess";
import { createLanguageService } from "../services/services";
import { LanguageService, LanguageServiceHost } from "../services/types";
import { FileSystemUpdater } from "./fs";
import { Logger, NoopLogger } from "./logging";
import { InMemoryFileSystem } from "./memfs";
import { observableFromIterable, path2uri, toUnixPath, uri2path } from "./utilities";

export class ProjectManager {
    /**
     * Root path with slashes
     */
    private rootPath: string;

    /**
     * URI -> version map. Every time file content is about to change or changed (didChange/didOpen/...), we are incrementing it's version
     * signalling that file is changed and file's user must invalidate cached and requery file content
     */
    private versions: Map<string, number>;

    /**
     * (Workspace subtree (folder) -> Solidity configuration) mapping.
     * Configuration settings for a source file A are located in the closest parent folder of A.
     * Map keys are relative (to workspace root) paths
     */
    private configs = new Map<string, ProjectConfiguration>();

    /**
     * Local side of file content provider which keeps cache of fetched files
     */
    private inMemoryFs: InMemoryFileSystem;

    /**
     * File system updater that takes care of updating the in-memory file system
     */
    private updater: FileSystemUpdater;


    /**
     * @return local side of file content provider which keeps cached copies of fethed files
     */
    getFs(): InMemoryFileSystem {
        return this.inMemoryFs;
    }

    /**
     * @param filePath file path (both absolute or relative file paths are accepted)
     * @return true if there is a fetched file with a given path
     */
    hasFile(filePath: string) {
        return this.inMemoryFs.fileExists(filePath);
    }

    /**
     * Flag indicating that we fetched module struture (package.json files) from the remote file system.
     * Without having this information we won't be able to split workspace to sub-projects
     */
    private ensuredModuleStructure?: Observable<never>;

    /**
     * Observable that completes when `ensureAllFiles` completed
     */
    private ensuredAllFiles?: Observable<never>;

    /**
     * Observable that completes when `ensureOwnFiles` completed
     */
    private ensuredOwnFiles?: Observable<never>;

    /**
     * A URI Map from file to files referenced by the file, so files only need to be pre-processed once
     */
    private referencedFiles = new Map<string, Observable<string>>();

    /**
     * @param rootPath root path as passed to `initialize`
     * @param inMemoryFileSystem File system that keeps structure and contents in memory
     */
    constructor(
        rootPath: string,
        inMemoryFileSystem: InMemoryFileSystem,
        updater: FileSystemUpdater,
        compilerOptions: CompilerOptions,
        protected logger: Logger = new NoopLogger()
    ) {
        this.rootPath = rootPath;
        this.updater = updater;
        this.inMemoryFs = inMemoryFileSystem;
        this.versions = new Map<string, number>();

        const trimmedRootPath = this.rootPath.replace(/\/+$/, "");
        const solidityConfig: SolidityConfig = {
            compilerOptions,
            include: ["**/*.sol"]
        };
        const config = new ProjectConfiguration(
            this.inMemoryFs,
            trimmedRootPath,
            this.versions,
            solidityConfig,
            this.logger);
        this.configs.set(trimmedRootPath, config);
    }

    /**
     * @return all sub-projects we have identified for a given workspace.
     * Sub-project is mainly a folder which contains tsconfig.json, jsconfig.json, package.json,
     * or a root folder which serves as a fallback
     */
    public configurations(): IterableIterator<ProjectConfiguration> {
        return iterate(this.configs.values());
    }

    /**
     * @param filePath source file path, absolute
     * @return project configuration for a given source file. Climbs directory tree up to workspace root if needed
     */
    public getConfiguration(filePath: string): ProjectConfiguration {
        const config = this.getConfigurationIfExists(filePath);
        if (!config) {
            throw new Error(`Solidity config file for ${filePath} not found`);
        }
        return config;
    }

    /**
     * @param filePath source file path, absolute
     * @return closest configuration for a given file path or undefined if there is no such configuration
     */
    public getConfigurationIfExists(filePath: string): ProjectConfiguration | undefined {
        let dir = toUnixPath(filePath);
        let config: ProjectConfiguration | undefined;
        const configs = this.configs;
        const rootPath = this.rootPath.replace(/\/+$/, "");
        while (dir && dir !== rootPath) {
            config = configs.get(dir);
            if (config) {
                return config;
            }
            const pos = dir.lastIndexOf("/");
            if (pos <= 0) {
                dir = "";
            } else {
                dir = dir.substring(0, pos);
            }
        }
        return configs.get(rootPath);
    }


    /**
     * Returns the ProjectConfiguration a file belongs to
     */
    public getParentConfiguration(uri: string): ProjectConfiguration | undefined {
        return this.getConfigurationIfExists(uri2path(uri));
    }

    /**
     * Returns all ProjectConfigurations contained in the given directory or one of its childrens
     *
     * @param uri URI of a directory
     */
    public getChildConfigurations(uri: string): IterableIterator<ProjectConfiguration> {
        const pathPrefix = uri2path(uri);
        return iterate(this.configs)
            .filter(([folderPath, _]: any) => folderPath.startsWith(pathPrefix))
            .map(([_, config]: any) => config);
    }

    /**
     * Called when file was opened by client. Current implementation
     * does not differenciates open and change events
     * @param uri file's URI
     * @param text file's content
     */
    public didOpen(uri: string, text: string) {
        this.didChange(uri, text);
    }

    /**
     * Called when file was closed by client. Current implementation invalidates compiled version
     * @param uri file's URI
     */
    public didClose(uri: string) {
        const filePath = uri2path(uri);
        this.inMemoryFs.didClose(uri);
        let version = this.versions.get(uri) || 0;
        this.versions.set(uri, ++version);
        const config = this.getConfigurationIfExists(filePath);
        if (!config) {
            return;
        }
        config.ensureConfigFile();
        config.getHost().incProjectVersion();
    }

    /**
     * Called when file was changed by client. Current implementation invalidates compiled version
     * @param uri file's URI
     * @param text file's content
     */
    public didChange(uri: string, text: string) {
        const filePath = uri2path(uri);
        this.inMemoryFs.didChange(uri, text);
        let version = this.versions.get(uri) || 0;
        this.versions.set(uri, ++version);
        const config = this.getConfigurationIfExists(filePath);
        if (!config) {
            return;
        }
        config.ensureConfigFile();
        config.ensureSourceFile(filePath);
        config.getHost().incProjectVersion();
    }

    /**
     * Called when file was saved by client
     * @param uri file's URI
     */
    public didSave(uri: string) {
        this.inMemoryFs.didSave(uri);
    }

    /**
     * Ensures that the module structure of the project exists in memory.
     * Solidity module structure is determined by package.json.
     * Then creates new ProjectConfigurations, resets existing and invalidates
     * file references.
     */
    public ensureModuleStructure(): Observable<never> {
        if (!this.ensuredModuleStructure) {
            this.ensuredModuleStructure = this.updater.ensureStructure()
                // Ensure content of all all global .d.ts, [tj]sconfig.json, package.json files
                .concat(Observable.defer(() => observableFromIterable(this.inMemoryFs.uris())))
                .filter(uri => isPackageJsonFile(uri) || isEthPmJsonFile(uri))
                .mergeMap(uri => this.updater.ensure(uri))
                .do(noop, (_err: any) => {
                    this.ensuredModuleStructure = undefined;
                }, () => {
                    // Reset all compilation state
                    // TODO ze incremental compilation instead
                    for (const config of this.configurations()) {
                        config.reset();
                    }
                    // Require re-processing of file references
                    this.invalidateReferencedFiles();
                })
                .publishReplay()
                .refCount() as Observable<never>;
        }
        return this.ensuredModuleStructure;
    }

    /**
     * Ensures all files were fetched from the remote file system.
     * Invalidates project configurations after execution
     */
    public ensureAllFiles(): Observable<never> {
        if (!this.ensuredAllFiles) {
            this.ensuredAllFiles = this.updater.ensureStructure()
                .concat(Observable.defer(() => observableFromIterable(this.inMemoryFs.uris())))
                .filter(uri => isSolidityFile(uri) || isPackageJsonFile(uri))
                .mergeMap(uri => this.updater.ensure(uri))
                .do(noop, (_err: any) => {
                    this.ensuredAllFiles = undefined;
                })
                .publishReplay()
                .refCount() as Observable<never>;
        }
        return this.ensuredAllFiles;
    }

    /**
     * Ensures all files not in node_modules were fetched.
     * This includes all js/ts files, tsconfig files and package.json files.
     * Invalidates project configurations after execution
     */
    public ensureOwnFiles(): Observable<never> {
        if (!this.ensuredOwnFiles) {
            this.ensuredOwnFiles = this.updater.ensureStructure()
                .concat(Observable.defer(() => observableFromIterable(this.inMemoryFs.uris())))
                .filter((uri: string) => !uri.includes("/node_modules/") && isSolidityFile(uri) || isPackageJsonFile(uri))
                .mergeMap((uri: string) => this.updater.ensure(uri))
                .do(noop, (_err: any) => {
                    this.ensuredOwnFiles = undefined;
                })
                .publishReplay()
                .refCount() as Observable<never>;
        }
        return this.ensuredOwnFiles;
    }

    /**
     * Recursively collects file(s) dependencies up to given level.
     * Dependencies are extracted by TS compiler from import and reference statements
     *
     * Dependencies include:
     * - all the configuration files
     * - files referenced by the given file
     * - files included by the given file
     *
     * The return values of this method are not cached, but those of the file fetching and file processing are.
     *
     * @param uri File to process
     * @param maxDepth Stop collecting when reached given recursion level
     * @param ignore Tracks visited files to prevent cycles
     * @param childOf OpenTracing parent span for tracing
     * @return Observable of file URIs ensured
     */
    public ensureReferencedFiles(uri: string, maxDepth = 30, ignore = new Set<string>()): Observable<string> {
        ignore.add(uri);
        return this.ensureModuleStructure()
            // If max depth was reached, don't go any further
            .concat(Observable.defer(() => maxDepth === 0 ? Observable.empty<never>() : this.resolveReferencedFiles(uri)))
            // Prevent cycles
            .filter(referencedUri => !ignore.has(referencedUri))
            // Call method recursively with one less dep level
            .mergeMap(referencedUri =>
                this.ensureReferencedFiles(referencedUri, maxDepth - 1, ignore)
                    // Continue even if an import wasn't found
                    .catch((err: any) => {
                        this.logger.error(`Error resolving file references for ${uri}:`, err);
                        return [];
                    })
            );
    }

    /**
     * Returns the files that are referenced from a given file.
     * If the file has already been processed, returns a cached value.
     *
     * @param uri URI of the file to process
     * @return URIs of files referenced by the file
     */
    private resolveReferencedFiles(uri: string): Observable<string> {
        let observable = this.referencedFiles.get(uri);
        if (observable) {
            return observable;
        }
        observable = this.updater.ensure(uri)
            .concat(Observable.defer(() => {
                const referencingFilePath = uri2path(uri);
                const config = this.getConfiguration(referencingFilePath);
                config.ensureConfigFile();
                const contents = this.inMemoryFs.getContent(uri);
                const info = preProcessFile(contents);
                const compilerOpt = config.getHost().getCompilationSettings();
                // Iterate imported files
                return Observable.from(info.importedFiles)
                    .map(importedFile => resolveModuleName(importedFile.fileName, toUnixPath(referencingFilePath), compilerOpt, this.inMemoryFs))
                    .filter(resolved => !!(resolved && resolved.resolvedModule))
                    .map(resolved => resolved.resolvedModule!.resolvedFileName);
            }))
            // Use same scheme, slashes, host for referenced URI as input file
            .map(filePath => path2uri(filePath))
            // Don't cache errors
            .do(noop, (_err: any) => {
                this.referencedFiles.delete(uri);
            })
            // Make sure all subscribers get the same values
            .publishReplay()
            .refCount();
        this.referencedFiles.set(uri, observable);
        return observable;
    }

    /**
     * Invalidates a cache entry for `resolveReferencedFiles` (e.g. because the file changed)
     *
     * @param uri The URI that referenced files should be invalidated for. If not given, all entries are invalidated
     */
    public invalidateReferencedFiles(uri?: string): void {
        if (uri) {
            this.referencedFiles.delete(uri);
        } else {
            this.referencedFiles.clear();
        }
    }
}

/**
 * Implementaton of LanguageServiceHost that works with in-memory file system.
 * It takes file content from local cache and provides it to Solidity compiler on demand
 *
 * @implements LanguageServiceHost
 */
export class InMemoryLanguageServiceHost implements LanguageServiceHost {

    public complete: boolean;

    /**
     * Root path
     */
    private rootPath: string;

    /**
     * Compiler options to use when parsing/analyzing source files.
     * We are extracting them from tsconfig.json or jsconfig.json
     */
    private options: CompilerOptions;

    /**
     * Local file cache where we looking for file content
     */
    private fs: InMemoryFileSystem;

    /**
     * Current list of files that were implicitly added to project
     * (every time when we need to extract data from a file that we haven't touched yet).
     * Each item is a relative file path
     */
    private filePaths: string[];

    /**
     * Current project version. When something significant is changed, incrementing it to signal Solidity compiler that
     * files should be updated and cached data should be invalidated
     */
    private projectVersion: number;

    /**
     * Tracks individual files versions to invalidate Solidity compiler data when single file is changed. Keys are URIs
     */
    private versions: Map<string, number>;

    constructor(rootPath: string, options: CompilerOptions, fs: InMemoryFileSystem, versions: Map<string, number>, private logger: Logger = new NoopLogger()) {
        this.rootPath = rootPath;
        this.options = options;
        this.fs = fs;
        this.versions = versions;
        this.projectVersion = 1;
        this.filePaths = [];
    }

    /**
     * TypeScript uses this method (when present) to compare project's version
     * with the last known one to decide if internal data should be synchronized
     */
    public getProjectVersion(): string {
        return "" + this.projectVersion;
    }

    public getNewLine(): string {
        // Although this is optional, language service was sending edits with carriage returns if not specified.
        // TODO: combine with the FormatOptions defaults.
        return "\n";
    }

    /**
     * Incrementing current project version, telling TS compiler to invalidate internal data
     */
    public incProjectVersion() {
        this.projectVersion++;
    }

    public getCompilationSettings(): CompilerOptions {
        return this.options;
    }

    public getScriptFileNames(): string[] {
        return this.filePaths;
    }

    /**
     * Adds a file and increments project version, used in conjunction with getProjectVersion()
     * which may be called by TypeScript to check if internal data is up to date
     *
     * @param filePath relative file path
     */
    public addFile(filePath: string) {
        this.filePaths.push(filePath);
        this.incProjectVersion();
    }

    public readFile(filePath: string, _encoding?: string): string {
        return this.fs.readFile(filePath);
    }

    public fileExists(path: string): boolean {
        return this.fs.fileExists(path);
    }

    /**
     * @param fileName absolute file path
     */
    public getScriptVersion(filePath: string): string {
        const uri = path2uri(filePath);
        let version = this.versions.get(uri);
        if (!version) {
            version = 1;
            this.versions.set(uri, version);
        }
        return "" + version;
    }

    public getCurrentDirectory(): string {
        return this.rootPath;
    }

    public trace(_message: string) {
        // empty
    }

    public log(_message: string) {
        // empty
    }

    public error(message: string) {
        this.logger.error(message);
    }

    public useCaseSensitiveFileNames(): boolean {
        return true;
    }
}

interface SolidityConfig {
    compilerOptions: CompilerOptions;
    include: string[];
}

/**
 * ProjectConfiguration instances track the compiler configuration
 * and state for a single Solidity project. It represents the world of
 * the view as presented to the compiler.
 *
 * For efficiency, a ProjectConfiguration instance may hide some files
 * from the compiler, preventing them from being parsed and
 * type-checked. Depending on the use, the caller should call one of
 * the ensure* methods to ensure that the appropriate files have been
 * made available to the compiler before calling any other methods on
 * the ProjectConfiguration or its public members. By default, no
 * files are parsed.
 */
export class ProjectConfiguration {

    private service?: LanguageService;

    /**
     * Object Solidity service will use to fetch content of source files
     */
    private host?: InMemoryLanguageServiceHost;

    /**
     * Local file cache
     */
    private fs: InMemoryFileSystem;

    /**
     * Configuration JSON object. May be used when there is no real configuration file to parse and use
     */
    private configContent: SolidityConfig;

    /**
     * Relative source file path (relative) -> version associations
     */
    private versions: Map<string, number>;

    /**
     * Root file path, relative to workspace hierarchy root
     */
    private rootFilePath: string;

    /**
     * List of files that project consist of (based on tsconfig includes/excludes and wildcards).
     * Each item is a relative file path
     */
    private expectedFilePaths = new Set<string>();

    private ensuredAllFiles = false;
    private initialized = false;

    /**
     * @param fs file system to use
     * @param rootFilePath root file path, absolute
     * @param configFilePath configuration file path, absolute
     * @param configContent optional configuration content to use instead of reading configuration file)
     */
    constructor(
        fs: InMemoryFileSystem,
        rootFilePath: string,
        versions: Map<string, number>,
        configContent?: SolidityConfig,
        private logger: Logger = new NoopLogger()
    ) {
        this.fs = fs;
        this.versions = versions;
        this.configContent = configContent;
        this.rootFilePath = rootFilePath;
    }

    private init(): void {
        if (this.initialized) {
            return;
        }
        const configObject = this.configContent;
        this.expectedFilePaths = new Set(flatMap(configObject.include, pattern => glob.sync(pattern, { cwd: this.rootFilePath })));

        this.host = new InMemoryLanguageServiceHost(
            this.fs.path,
            configObject.compilerOptions,
            this.fs,
            this.versions,
            this.logger
        );
        this.service = createLanguageService(this.host);
        this.initialized = true;
    }

    /**
     * reset resets a ProjectConfiguration to its state immediately
     * after construction. It should be called whenever the underlying
     * local filesystem (fs) has changed, and so the
     * ProjectConfiguration can no longer assume its state reflects
     * that of the underlying files.
     */
    public reset(): void {
        this.initialized = false;
        this.ensuredAllFiles = false;
        this.service = undefined;
        this.host = undefined;
        this.expectedFilePaths = new Set();
    }

    /**
     * @return language service object
     */
    public getService(): LanguageService {
        if (!this.service) {
            throw new Error("project is uninitialized");
        }
        return this.service;
    }

    /**
     * Tells Solidity service to recompile program (if needed) based on current list of files and compilation options.
     * Solidity service relies on information provided by language servide host to see if there were any changes in
     * the whole project or in some files
     *
     * @return program object (cached result of parsing and typechecking done by Solidity service)
     */
    public getProgram(): Program | undefined {
        return this.getService().getProgram();
    }

    /**
     * @return language service host that Solidity service uses to read the data
     */
    public getHost(): InMemoryLanguageServiceHost {
        if (!this.host) {
            throw new Error("project is uninitialized");
        }
        return this.host;
    }

    /**
     * Ensures we are ready to process files from a given sub-project
     */
    public ensureConfigFile(): void {
        this.init();
    }

    /**
     * Ensures a single file is available to the LanguageServiceHost
     * @param filePath
     */
    public ensureSourceFile(filePath: string): void {
        this.getHost().addFile(filePath);
    }

    /**
     * Ensures we added all project's source file
     */
    public ensureAllFiles(): void {
        if (this.ensuredAllFiles) {
            return;
        }
        this.init();
        if (this.getHost().complete) {
            return;
        }
        for (const fileName of this.expectedFilePaths) {
            this.getHost().addFile(fileName);
        }
        this.getHost().complete = true;
        this.ensuredAllFiles = true;
    }
}
