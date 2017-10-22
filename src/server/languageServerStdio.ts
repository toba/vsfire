import { isNotificationMessage } from "vscode-jsonrpc/lib/messages";
import {
    StreamMessageReader,
    StreamMessageWriter
} from "vscode-languageserver";

import {
    MessageEmitter,
    MessageLogOptions,
    MessageWriter,
    RegisterLanguageHandlerOptions,
    registerLanguageHandler
} from "./connection";
import { RemoteLanguageClient } from "./languageClient";
import { FileLogger, StderrLogger } from "./logging";
import { SolidityService, SolidityServiceOptions } from "./solidityService";

const program = require("commander");
const packageJson = require("../package.json");

program
    .version(packageJson.version)
    .option("-l, --logfile [file]", "log to this file")
    .parse(process.argv);

const logger = program.logfile ? new FileLogger(program.logfile) : new StderrLogger();

const options: SolidityServiceOptions & MessageLogOptions & RegisterLanguageHandlerOptions = {
    logger
};

const messageEmitter = new MessageEmitter(new StreamMessageReader(process.stdin), options);
const messageWriter = new MessageWriter(new StreamMessageWriter(process.stdout), options);
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
