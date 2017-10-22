import { EventEmitter } from "events";
import { PassThrough } from "stream";

import * as sinon from "sinon";
import { ErrorCodes } from "vscode-jsonrpc";
import {
    StreamMessageReader,
    StreamMessageWriter
} from "vscode-languageserver";

import { MessageEmitter, MessageWriter, registerLanguageHandler } from "../../src/server/connection";
import { NoopLogger } from "../../src/server/logging";
import { SolidityService } from "../../src/server/solidityService";

describe("connection", () => {
    describe("registerLanguageHandler()", () => {
        test("should return MethodNotFound error when the method does not exist on handler", async () => {
            const handler: SolidityService = Object.create(SolidityService.prototype);
            const emitter = new EventEmitter();
            const writer = {
                write: sinon.spy()
            };
            registerLanguageHandler(emitter as MessageEmitter, writer as any as MessageWriter, handler as SolidityService);
            const params = [1, 1];
            emitter.emit("message", { jsonrpc: "2.0", id: 1, method: "whatever", params });
            sinon.assert.calledOnce(writer.write);
            sinon.assert.calledWithExactly(writer.write, sinon.match({ jsonrpc: "2.0", id: 1, error: { code: ErrorCodes.MethodNotFound } }));
        });
        test("should ignore exit notifications", async () => {
            const handler = {
                exit: sinon.spy()
            };
            const emitter = new EventEmitter();
            const writer = {
                write: sinon.spy()
            };
            registerLanguageHandler(emitter as MessageEmitter, writer as any, handler as any);
            emitter.emit("message", { jsonrpc: "2.0", id: 1, method: "exit" });
            sinon.assert.notCalled(handler.exit);
            sinon.assert.notCalled(writer.write);
        });
        test("should ignore responses", async () => {
            const handler = {
                whatever: sinon.spy()
            };
            const emitter = new EventEmitter();
            const writer = {
                write: sinon.spy()
            };
            registerLanguageHandler(emitter as MessageEmitter, writer as any, handler as any);
            emitter.emit("message", { jsonrpc: "2.0", id: 1, method: "whatever", result: 123 });
            sinon.assert.notCalled(handler.whatever);
        });
        test("should log invalid messages", async () => {
            const handler = {
                whatever: sinon.spy()
            };
            const emitter = new EventEmitter();
            const writer = {
                write: sinon.spy()
            };
            const logger = new NoopLogger() as NoopLogger & { error: sinon.SinonStub };
            sinon.stub(logger, "error");
            registerLanguageHandler(emitter as MessageEmitter, writer as any, handler as any, { logger });
            emitter.emit("message", { jsonrpc: "2.0", id: 1 });
            sinon.assert.calledOnce(logger.error);
        });
    });
    describe("MessageEmitter", () => {
        test("should log messages if enabled", async () => {
            const logger = new NoopLogger() as NoopLogger & { log: sinon.SinonStub };
            sinon.stub(logger, "log");
            const emitter = new MessageEmitter(new StreamMessageReader(new PassThrough()), { logMessages: true, logger });
            emitter.emit("message", { jsonrpc: "2.0", method: "whatever" });
            sinon.assert.calledOnce(logger.log);
            sinon.assert.calledWith(logger.log, "-->");
        });
        test("should not log messages if disabled", async () => {
            const logger = new NoopLogger() as NoopLogger & { log: sinon.SinonStub };
            sinon.stub(logger, "log");
            const emitter = new MessageEmitter(new StreamMessageReader(new PassThrough()), { logMessages: false, logger });
            emitter.emit("message", { jsonrpc: "2.0", method: "whatever" });
            sinon.assert.notCalled(logger.log);
        });
    });
    describe("MessageWriter", () => {
        test("should log messages if enabled", async () => {
            const logger = new NoopLogger() as NoopLogger & { log: sinon.SinonStub };
            sinon.stub(logger, "log");
            const writer = new MessageWriter(new StreamMessageWriter(new PassThrough()), { logMessages: true, logger });
            writer.write({ jsonrpc: "2.0", method: "whatever" });
            sinon.assert.calledOnce(logger.log);
            sinon.assert.calledWith(logger.log, "<--");
        });
        test("should not log messages if disabled", async () => {
            const logger = new NoopLogger() as NoopLogger & { log: sinon.SinonStub };
            sinon.stub(logger, "log");
            const writer = new MessageWriter(new StreamMessageWriter(new PassThrough()), { logMessages: false, logger });
            writer.write({ jsonrpc: "2.0", method: "whatever" });
            sinon.assert.notCalled(logger.log);
        });
    });
});
