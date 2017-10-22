import * as vscode from "vscode-languageserver";

export interface InitializeParams extends vscode.InitializeParams {
    capabilities: ClientCapabilities;
}

export interface ClientCapabilities extends vscode.ClientCapabilities {

    /**
     * The client provides support for workspace/xfiles.
     */
    xfilesProvider?: boolean;

    /**
     * The client provides support for textDocument/xcontent.
     */
    xcontentProvider?: boolean;
}

export interface TextDocumentContentParams {

    /**
     * The text document to receive the content for.
     */
    textDocument: vscode.TextDocumentIdentifier;
}

export interface WorkspaceFilesParams {

    /**
     * The URI of a directory to search.
     * Can be relative to the rootPath.
     * If not given, defaults to rootPath.
     */
    base?: string;
}
