import {
   IPCMessageReader, IPCMessageWriter, createConnection, IConnection,
   TextDocuments, TextDocument, Diagnostic, DiagnosticSeverity, 
   InitializeResult, TextDocumentPositionParams, CompletionItem, 
	CompletionItemKind
} from "vscode-languageserver";

// hold the maxNumberOfProblems setting
let maxNumberOfProblems:number;
let connection:IConnection = createConnection(
   new IPCMessageReader(process),
   new IPCMessageWriter(process));

/**
 * TextDocuments support full sync only. They listen for open, change and
 * close events.
 */
let documents:TextDocuments = new TextDocuments();

interface Settings {
	lspSample: ExampleSettings;
}

// These are the example settings we defined in the client's package.json
// file
interface ExampleSettings {
	maxNumberOfProblems: number;
}

documents.listen(connection);
documents.onDidChangeContent((change) => { validateRules(change.document); });

connection.onInitialize((_params):InitializeResult => {
	//workspaceRoot = params.rootPath;
	return {
		capabilities: {
			// Tell the client that the server works in FULL text document sync mode
			textDocumentSync: documents.syncKind,
			// Tell the client that the server support code complete
			completionProvider: {
				resolveProvider: true
			}
		}
	}
});

/**
 * Revalidate open documents if settings change.
 */
connection.onDidChangeConfiguration((change) => {
	let settings = <Settings>change.settings;
	maxNumberOfProblems = settings.lspSample.maxNumberOfProblems || 100;
	documents.all().forEach(validateRules);
});

connection.onDidChangeWatchedFiles((_change) => {
	connection.console.log("We recevied a file change event");
});

// This handler provides the initial list of the completion items.
connection.onCompletion((_textDocumentPosition:TextDocumentPositionParams):CompletionItem[] => {
	// The pass parameter contains the position of the text document in 
	// which code complete got requested. For the example we ignore this
	// info and always provide the same completion items.
	return [
		{
			label: "TypeScript",
			kind: CompletionItemKind.Text,
			data: 1
		},
		{
			label: "JavaScript",
			kind: CompletionItemKind.Text,
			data: 2
		}
	]
});

// This handler resolve additional information for the item selected in
// the completion list.
connection.onCompletionResolve((item:CompletionItem):CompletionItem => {
	if (item.data === 1) {
      item.detail = "TypeScript details",
			item.documentation = "TypeScript documentation"
	} else if (item.data === 2) {
		item.detail = "JavaScript details",
			item.documentation = "JavaScript documentation"
	}
	return item;
});

/*
connection.onDidOpenTextDocument((params) => {
	// A text document got opened in VSCode.
	// params.uri uniquely identifies the document. For documents store on disk this is a file URI.
	// params.text the initial full content of the document.
	connection.console.log(`${params.textDocument.uri} opened.`);
});
connection.onDidChangeTextDocument((params) => {
	// The content of a text document did change in VSCode.
	// params.uri uniquely identifies the document.
	// params.contentChanges describe the content changes to the document.
	connection.console.log(`${params.textDocument.uri} changed: ${JSON.stringify(params.contentChanges)}`);
});
connection.onDidCloseTextDocument((params) => {
	// A text document got closed in VSCode.
	// params.uri uniquely identifies the document.
	connection.console.log(`${params.textDocument.uri} closed.`);
});
*/

function validateRules(textDocument:TextDocument):void {
	let diagnostics:Diagnostic[] = [];
	let lines = textDocument.getText().split(/\r?\n/g);
   let problems = 0;
   
	for (var i = 0; i < lines.length && problems < maxNumberOfProblems; i++) {
		let line = lines[i];
		let index = line.indexOf("typescript");
		if (index >= 0) {
			problems++;
			diagnostics.push({
				severity: DiagnosticSeverity.Warning,
				range: {
					start: { line: i, character: index },
					end: { line: i, character: index + 10 }
				},
				message: `${line.substr(index, 10)} should be spelled TypeScript`,
				source: 'ex'
			});
		}
	}
	connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

connection.listen();