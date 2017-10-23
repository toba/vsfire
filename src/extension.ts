import { workspace, ExtensionContext } from "vscode";
import {
   LanguageClient,
   LanguageClientOptions,
   ServerOptions, 
   TransportKind } from "vscode-languageclient";

/**
 * Activate the Firestore Security Rules language client.
 */
export function activate(context: ExtensionContext) {
	let serverModule = context.asAbsolutePath("server.js");
   let debugOptions = { execArgv: ["--nolazy", "--debug=6009"] };
	let serverOptions:ServerOptions = {
		run : {
         module: serverModule,
         transport: TransportKind.ipc
      },
		debug: {
         module: serverModule,
         transport: TransportKind.ipc,
         options: debugOptions
      }
	};
	
	let clientOptions:LanguageClientOptions = {
		// Register the server for plain text documents
		documentSelector: [{ scheme: "file", language: "plaintext" }],
		synchronize: {
			// Synchronize the setting section 'languageServerExample' to the server
			configurationSection: 'lspSample',
			// Notify the server about file changes to '.clientrc files contain in the workspace
			fileEvents: workspace.createFileSystemWatcher("**/.clientrc")
		}
	};
	
	let client = new LanguageClient("firerules", "Firestore Security Rules", serverOptions, clientOptions).start();
	
	// register client so it can later be disposed
	context.subscriptions.push(client);
}