import {
    Diagnostic,
    DiagnosticSeverity
} from "vscode-languageserver";

export interface SolcError {
    sourceLocation?: {
        file: string;
        start: number;
        end: number;
    };
    type: string;
    component: string;
    severity: "error" | "warning";
    message: string;
    formattedMessage?: string;
}

export function solcErrToDiagnostic(error: SolcError): Diagnostic {
    const { message, formattedMessage, severity } = error;
    const errorSegments = formattedMessage.split(":");
    const line = parseInt(errorSegments[1]);
    const column = parseInt(errorSegments[2]);

    return {
        message,
        range: {
            start: {
                line: line - 1,
                character: column
            },
            end: {
                line: line - 1,
                character: column
            },
        },
        severity: getDiagnosticSeverity(severity)
    };
}

function getDiagnosticSeverity(severity: "error" | "warning"): DiagnosticSeverity {
    switch (severity) {
        case "error":
            return DiagnosticSeverity.Error;
        case "warning":
            return DiagnosticSeverity.Warning;
        default:
            return DiagnosticSeverity.Error;
    }
}

export function soliumErrObjectToDiagnostic(errObject: any): Diagnostic {
    const line = errObject.line - 1;
    const severity = errObject.type === "warning" ? DiagnosticSeverity.Warning : DiagnosticSeverity.Error;

    return {
        message: `${errObject.ruleName}: ${errObject.message}`,
        range: {
            start: { character: errObject.column, line },
            end: { character: errObject.node.end, line }
        },
        severity,
    };
}
