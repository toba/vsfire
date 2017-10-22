import { Observable } from "@reactivex/rxjs";
import { Operation } from "fast-json-patch";
import * as _ from "lodash";
import {
    CompletionList,
    DidChangeConfigurationParams,
    DidChangeTextDocumentParams,
    DidCloseTextDocumentParams,
    DidOpenTextDocumentParams,
    DidSaveTextDocumentParams,
    InitializeResult,
    TextDocumentPositionParams,
    TextDocumentSyncKind
} from "vscode-languageserver";

import { getDirectoryPath } from "../compiler/core";
import { CompilerOptions } from "../compiler/types";
import { getDefaultCompilerOptions } from "../services/services";
import { FileSystemUpdater, LocalFileSystem, RemoteFileSystem } from "./fs";
import { LanguageClient } from "./languageClient";
import { LSPLogger, Logger } from "./logging";
import { InMemoryFileSystem } from "./memfs";
import { ProjectManager } from "./projectManager";
import { InitializeParams } from "./requestType";
import { normalizeUri, path2uri, uri2path } from "./utilities";

export interface SolidityServiceOptions {
}

/**
 * Settings synced through `didChangeConfiguration`
 */
export interface Settings {
    solidity: SoliditySettings;
}

interface SoliditySettings {
    solium: {
        enabled: boolean;
        rules: any;
    };
    compilerOptions: CompilerOptions;
}

const defaultSoliumRules = {
    "array-declarations": true,
    "blank-lines": false,
    "camelcase": true,
    "deprecated-suicide": true,
    "double-quotes": true,
    "imports-on-top": true,
    "indentation": false,
    "lbrace": true,
    "mixedcase": true,
    "no-empty-blocks": true,
    "no-unused-vars": true,
    "no-with": true,
    "operator-whitespace": true,
    "pragma-on-top": true,
    "uppercase": true,
    "variable-declarations": true,
    "whitespace": true
};

/**
 * Handles incoming requests and return responses. There is a one-to-one-to-one
 * correspondence between TCP connection, SolidityService instance, and
 * language workspace. SolidityService caches data from the compiler across
 * requests. The lifetime of the SolidityService instance is tied to the
 * lifetime of the TCP connection, so its caches are deleted after the
 * connection is torn down.
 *
 * Methods are camelCase versions of the LSP spec methods and dynamically
 * dispatched. Methods not to be exposed over JSON RPC are prefixed with an
 * underscore.
 */
export class SolidityService {
    private globalProjectManager: ProjectManager;

    private perDirectoryProjectManagerCache: Map<string, ProjectManager>;

    /**
     * The rootPath as passed to `initialize` or converted from `rootUri`
     */
    public root: string;

    /**
     * The root URI as passed to `initialize` or converted from `rootPath`
     */
    protected rootUri: string;

    protected logger: Logger;

    protected accessDisk: boolean;

    /**
     * Settings synced though `didChangeConfiguration`
     */
    protected settings: Settings = {
        solidity: {
            solium: {
                enabled: true,
                rules: defaultSoliumRules
            },
            compilerOptions: getDefaultCompilerOptions()
        }
    };

    constructor(protected client: LanguageClient, protected options: SolidityServiceOptions = {}) {
        this.logger = new LSPLogger(client);
    }

    public initialize(params: InitializeParams): Observable<Operation> {
        this.accessDisk = !(params.capabilities.xcontentProvider && params.capabilities.xfilesProvider);

        if (params.rootUri || params.rootPath) {
            this.root = params.rootPath || uri2path(params.rootUri!);
            this.rootUri = params.rootUri || path2uri(params.rootPath!);

            // The root URI always refers to a directory
            if (!this.rootUri.endsWith("/")) {
                this.rootUri += "/";
            }

            this.globalProjectManager = this._createProjectManager({ root: this.root, rootUri: this.rootUri });
        } else {
            this.perDirectoryProjectManagerCache = new Map<string, ProjectManager>();
        }

        const result: InitializeResult = {
            capabilities: {
                // Tell the client that the server works in FULL text document sync mode
                textDocumentSync: TextDocumentSyncKind.Full,
                hoverProvider: false,
                signatureHelpProvider: {
                    triggerCharacters: ["(", ","]
                },
                definitionProvider: false,
                referencesProvider: false,
                documentSymbolProvider: false,
                workspaceSymbolProvider: false,
                completionProvider: {
                    resolveProvider: false,
                    triggerCharacters: ["."]
                },
                codeActionProvider: false,
                renameProvider: false,
                executeCommandProvider: {
                    commands: []
                }
            }
        };
        return Observable.of({
            op: "add",
            path: "",
            value: result
        } as Operation);
    }
    /*
     * Creates a new ProjectManager for the given path.
     *
     * @param rootPath the root path
     * @param accessDisk Whether the language server is allowed to access the local file system
     */
    private _createProjectManager(params: { root: string, rootUri: string }): ProjectManager {
        // The remote (or local), asynchronous, file system to fetch files from
        const fileSystem = this.accessDisk ? new LocalFileSystem(params.rootUri) : new RemoteFileSystem(this.client);
        // Holds file contents and workspace structure in memory
        const inMemoryFileSystem = new InMemoryFileSystem(params.root, this.logger);
        // Syncs the remote file system with the in-memory file system
        const updater = new FileSystemUpdater(fileSystem, inMemoryFileSystem);

        return new ProjectManager(
            params.root,
            inMemoryFileSystem,
            updater,
            this.settings.solidity.compilerOptions,
            this.logger
        );
    }

    private getProjectManager(uri: string): ProjectManager {
        const path = uri2path(uri);

        // If the root path is set, return the global ProjectManager.
        if (this.root) return this.globalProjectManager;

        const root = getDirectoryPath(path);
        let projectManager = this.perDirectoryProjectManagerCache.get(root);
        if (!projectManager) {
            projectManager = this._createProjectManager({ root, rootUri: path2uri(root) });
            this.perDirectoryProjectManagerCache.set(root, projectManager);
        }
        return projectManager;
    }

    /**
     * The initialized notification is sent from the client to the server after the client received the
     * result of the initialize request but before the client is sending any other request or notification
     * to the server. The server can use the initialized notification for example to dynamically register
     * capabilities.
     */
    public async initialized(): Promise<void> {
        // No op.
    }

    /**
     * The shutdown request is sent from the client to the server. It asks the server to shut down,
     * but to not exit (otherwise the response might not be delivered correctly to the client).
     * There is a separate exit notification that asks the server to exit.
     *
     * @return Observable of JSON Patches that build a `null` result
     */
    public shutdown(_params = {}): Observable<Operation> {
        return Observable.of({ op: "add", path: "", value: null } as Operation);
    }

    /**
     * A notification sent from the client to the server to signal the change of configuration
     * settings.
     */
    public workspaceDidChangeConfiguration(params: DidChangeConfigurationParams): void {
        _.merge(this.settings, params.settings);
    }

    /**
     * The document open notification is sent from the client to the server to signal newly opened
     * text documents. The document's truth is now managed by the client and the server must not try
     * to read the document's truth using the document's uri.
     */
    public async textDocumentDidOpen(params: DidOpenTextDocumentParams): Promise<void> {
        const uri = normalizeUri(params.textDocument.uri);
        const text = params.textDocument.text;
        // Ensure files needed for most operations are fetched
        const projectManager = this.getProjectManager(uri);
        await projectManager.ensureReferencedFiles(uri).toPromise();
        projectManager.didOpen(uri, text);
        await new Promise(resolve => setTimeout(resolve, 200));
        this._publishDiagnostics(uri);
    }

    /**
     * The document change notification is sent from the client to the server to signal changes to a
     * text document. In 2.0 the shape of the params has changed to include proper version numbers
     * and language ids.
     */
    public async textDocumentDidChange(params: DidChangeTextDocumentParams): Promise<void> {
        const uri = normalizeUri(params.textDocument.uri);
        let text: string | undefined;
        for (const change of params.contentChanges) {
            if (change.range || change.rangeLength) {
                throw new Error("incremental updates in textDocument/didChange not supported for file " + uri);
            }
            text = change.text;
        }
        if (!text) {
            return;
        }
        this.getProjectManager(uri).didChange(uri, text);
        await new Promise(resolve => setTimeout(resolve, 200));
        this._publishDiagnostics(uri);
    }

    /**
     * The document save notification is sent from the client to the server when the document was
     * saved in the client.
     */
    public async textDocumentDidSave(params: DidSaveTextDocumentParams): Promise<void> {
        const uri = normalizeUri(params.textDocument.uri);
        const projectManager = this.getProjectManager(uri);
        await projectManager.ensureReferencedFiles(uri).toPromise();
        projectManager.didSave(uri);
    }

    /**
     * The document close notification is sent from the client to the server when the document got
     * closed in the client. The document's truth now exists where the document's uri points to
     * (e.g. if the document's uri is a file uri the truth now exists on disk).
     */
    public async textDocumentDidClose(params: DidCloseTextDocumentParams): Promise<void> {
        const uri = normalizeUri(params.textDocument.uri);

        // Ensure files needed to suggest completions are fetched
        const projectManager = this.getProjectManager(uri);
        await projectManager.ensureReferencedFiles(uri).toPromise();

        projectManager.didClose(uri);

        // Clear diagnostics
        this.client.textDocumentPublishDiagnostics({ uri, diagnostics: [] });
    }

    /**
     * Generates and publishes diagnostics for a given file
     *
     * @param uri URI of the file to check
     */
    private _publishDiagnostics(uri: string): void {
        const config = this.getProjectManager(uri).getParentConfiguration(uri);
        if (!config) {
            return;
        }
        const fileName = uri2path(uri);
        const diagnostics = config.getService().getCompilerDiagnostics(fileName);
        if (this.settings.solidity.solium.enabled) {
            const linterDiagnostics = config.getService().getLinterDiagnostics(fileName, this.settings.solidity.solium.rules);
            diagnostics.push(...linterDiagnostics);
        }

        this.client.textDocumentPublishDiagnostics({ uri, diagnostics });
    }

    /**
     * The Completion request is sent from the client to the server to compute completion items at a
     * given cursor position. Completion items are presented in the
     * [IntelliSense](https://code.visualstudio.com/docs/editor/editingevolved#_intellisense) user
     * interface. If computing full completion items is expensive, servers can additionally provide
     * a handler for the completion item resolve request ('completionItem/resolve'). This request is
     * sent when a completion item is selected in the user interface. A typically use case is for
     * example: the 'textDocument/completion' request doesn't fill in the `documentation` property
     * for returned completion items since it is expensive to compute. When the item is selected in
     * the user interface then a 'completionItem/resolve' request is sent with the selected
     * completion item as a param. The returned completion item should have the documentation
     * property filled in.
     *
     * @return Observable of JSON Patches that build a `CompletionList` result
     */
    public textDocumentCompletion(params: TextDocumentPositionParams): Observable<Operation> {
        const uri = normalizeUri(params.textDocument.uri);

        const projectManager = this.getProjectManager(uri);
        // Ensure files needed to suggest completions are fetched
        return projectManager.ensureReferencedFiles(uri, undefined, undefined)
            .toArray()
            .mergeMap(() => {
                const fileName: string = uri2path(uri);

                const configuration = projectManager.getConfiguration(fileName);
                configuration.ensureConfigFile();

                const completions = configuration.getService().getCompletionsAtPosition(fileName, params.position);

                return Observable.from(completions)
                    .map(item => {
                        return { op: "add", path: "/items/-", value: item } as Operation;
                    })
                    .startWith({ op: "add", path: "/isIncomplete", value: false } as Operation);
            })
            .startWith({ op: "add", path: "", value: { isIncomplete: true, items: [] } as CompletionList } as Operation);
    }
}
