import { isNotificationMessage } from "vscode-jsonrpc/lib/messages";
import {
    IPCMessageReader,
    IPCMessageWriter,
} from "vscode-languageserver";

import {
    MessageEmitter,
    MessageLogOptions,
    MessageWriter,
    RegisterLanguageHandlerOptions,
    registerLanguageHandler
} from "./connection";
import { RemoteLanguageClient } from "./languageClient";
import { StderrLogger } from "./logging";
import { SolidityService, SolidityServiceOptions } from "./solidityService";

const logger = new StderrLogger();

const options: SolidityServiceOptions & MessageLogOptions & RegisterLanguageHandlerOptions = {
    logger
};

const messageEmitter = new MessageEmitter(new IPCMessageReader(process), options);
const messageWriter = new MessageWriter(new IPCMessageWriter(process), options);
const remoteClient = new RemoteLanguageClient(messageEmitter, messageWriter);
const service = new SolidityService(remoteClient, options);

// Add an exit notification handler to kill the process
messageEmitter.on("message", message => {
    if (isNotificationMessage(message) && message.method === "exit") {
        logger.log(`Exit notification`);
        process.exit(0);
    }
});

registerLanguageHandler(messageEmitter, messageWriter, service, options);
