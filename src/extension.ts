import * as path from "path";

// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind
} from "vscode-languageclient";

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "solidity-language-server" is now active!');

    const serverModule = path.join(__dirname, "server", "languageServerIpc.js");

    const serverOptions: ServerOptions = {
        debug: {
            module: serverModule,
            options: {
                execArgv: ["--nolazy", "--debug=6004"],
            },
            transport: TransportKind.ipc,
        },
        run: {
            module: serverModule,
            transport: TransportKind.ipc,
        },
    };

    const clientOptions: LanguageClientOptions = {
        documentSelector: ["solidity"],
        synchronize: {
            configurationSection: "solidity" // Synchronize the setting section 'solidity' to the server
        }
    };

    const clientDisposible = new LanguageClient(
        "solidity",
        "Solidity Language Server",
        serverOptions,
        clientOptions).start();

    // Push the disposable to the context's subscriptions so that the
    // client can be deactivated on extension deactivation
    context.subscriptions.push(clientDisposible);
}

// this method is called when your extension is deactivated
export function deactivate() {
}
