import { Observable } from "@reactivex/rxjs";
import {
    Message,
    NotificationMessage,
    RequestMessage,
    ResponseMessage,
    isResponseMessage
} from "vscode-jsonrpc/lib/messages";
import {
    LogMessageParams,
    PublishDiagnosticsParams,
    TextDocumentIdentifier,
    TextDocumentItem
} from "vscode-languageserver";

import { HasMeta, MessageEmitter, MessageWriter } from "./connection";
import { TextDocumentContentParams, WorkspaceFilesParams } from "./requestType";

export interface LanguageClient {
    /**
     * The content request is sent from the server to the client to request the current content of
     * any text document. This allows language servers to operate without accessing the file system
     * directly.
     */
    textDocumentXcontent(params: TextDocumentContentParams): Observable<TextDocumentItem>;

    /**
     * The files request is sent from the server to the client to request a list of all files in the
     * workspace or inside the directory of the `base` parameter, if given.
     */
    workspaceXfiles(params: WorkspaceFilesParams): Observable<TextDocumentIdentifier[]>;

    /**
     * The log message notification is sent from the server to the client to ask
     * the client to log a particular message.
     */
    windowLogMessage(params: LogMessageParams): void;

    /**
     * Diagnostics are sent from the server to the client to notify the user of errors/warnings
     * in a source file
     * @param params The diagnostics to send to the client
     */
    textDocumentPublishDiagnostics(params: PublishDiagnosticsParams): void;
}

/**
 * Provides an interface to call methods on the remote client.
 * Methods are named after the camelCase version of the LSP method name
 */
export class RemoteLanguageClient {
    /** The next request ID to use */
    private idCounter = 1;

    /**
     * @param input MessageEmitter to listen on for responses
     * @param output MessageWriter to write requests/notifications to
     */
    constructor(private input: MessageEmitter, private output: MessageWriter) { }

    /**
     * Sends a Request
     *
     * @param method The method to call
     * @param params The params to pass to the method
     * @return Emits the value of the result field or the error
     */
    private request(method: string, params: any[] | { [attr: string]: any }): Observable<any> {
        return new Observable<any>(subscriber => {
            // Generate a request ID
            const id = this.idCounter++;
            const message: RequestMessage & HasMeta = { jsonrpc: "2.0", method, id, params, meta: {} };
            // Send request
            this.output.write(message);
            let receivedResponse = false;
            // Subscribe to message events
            const messageSub = Observable.fromEvent<Message>(this.input, "message")
                // Find response message with the correct ID
                .filter(msg => isResponseMessage(msg) && msg.id === id)
                .take(1)
                // Emit result or error
                .map((msg: ResponseMessage): any => {
                    receivedResponse = true;
                    if (msg.error) {
                        throw Object.assign(new Error(msg.error.message), msg.error);
                    }
                    return msg.result;
                })
                // Forward events to subscriber
                .subscribe(subscriber);
            // Handler for unsubscribe()
            return () => {
                // Unsubscribe message event subscription (removes listener)
                messageSub.unsubscribe();
                if (!receivedResponse) {
                    // Send LSP $/cancelRequest to client
                    this.notify("$/cancelRequest", { id });
                }
            };
        });
    }

    /**
     * The content request is sent from the server to the client to request the current content of
     * any text document. This allows language servers to operate without accessing the file system
     * directly.
     */
    textDocumentXcontent(params: TextDocumentContentParams): Observable<TextDocumentItem> {
        return this.request("textDocument/xcontent", params);
    }

    /**
     * The files request is sent from the server to the client to request a list of all files in the
     * workspace or inside the directory of the `base` parameter, if given.
     */
    public workspaceXfiles(params: WorkspaceFilesParams): Observable<TextDocumentIdentifier[]> {
        return this.request("workspace/xfiles", params);
    }

    /**
     * Sends a Notification
     *
     * @param method The method to notify
     * @param params The params to pass to the method
     */
    private notify(method: string, params: any[] | { [attr: string]: any }): void {
        const message: NotificationMessage = { jsonrpc: "2.0", method, params };
        this.output.write(message);
    }

    /**
     * The log message notification is sent from the server to the client to ask
     * the client to log a particular message.
     */
    public windowLogMessage(params: LogMessageParams): void {
        this.notify("window/logMessage", params);
    }

    /**
     * Diagnostics are sent from the server to the client to notify the user of errors/warnings
     * in a source file
     * @param params The diagnostics to send to the client
     */
    public textDocumentPublishDiagnostics(params: PublishDiagnosticsParams): void {
        this.notify("textDocument/publishDiagnostics", params);
    }
}
