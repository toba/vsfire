import { Debug, binarySearch, createMapFromTemplate } from "./core";
import {
    CharacterCodes,
    LanguageVersion,
    LineAndCharacter,
    Map,
    NumericLiteralFlags,
    SourceFile,
    SourceFileLike,
    SyntaxKind
} from "./types";

export interface ErrorCallback {
    (message: string, length: number): void;
}

export interface Scanner {
    getStartPos(): number;
    getToken(): SyntaxKind;
    getTextPos(): number;
    getTokenPos(): number;
    getTokenText(): string;
    getTokenValue(): string;
    hasPrecedingLineBreak(): boolean;
    isIdentifier(): boolean;
    isReservedWord(): boolean;
    isUnterminated(): boolean;
    /* @internal */
    getNumericLiteralFlags(): NumericLiteralFlags;
    reScanGreaterToken(): SyntaxKind;
    scan(): SyntaxKind;
    getText(): string;
    // Sets the text for the scanner to scan.  An optional subrange starting point and length
    // can be provided to have the scanner only scan a portion of the text.
    setText(text: string, start?: number, length?: number): void;
    setOnError(onError: ErrorCallback): void;
    setTextPos(textPos: number): void;
    setLanguageVersion(version: LanguageVersion): void;
}

const textToToken = createMapFromTemplate({
    "abstract": SyntaxKind.AbstractKeyword,
    "address": SyntaxKind.AddressKeyword,
    "after": SyntaxKind.AfterKeyword,
    "anonymous": SyntaxKind.AnonymousKeyword,
    "as": SyntaxKind.AsKeyword,
    "assembly": SyntaxKind.AssemblyKeyword,
    "bool": SyntaxKind.BoolKeyword,
    "break": SyntaxKind.BreakKeyword,
    "byte": SyntaxKind.ByteKeyword,
    "bytes": SyntaxKind.BytesKeyword,
    "case": SyntaxKind.CaseKeyword,
    "catch": SyntaxKind.CatchKeyword,
    "constant": SyntaxKind.ConstantKeyword,
    "continue": SyntaxKind.ContinueKeyword,
    "contract": SyntaxKind.ContractKeyword,
    "days": SyntaxKind.DaysKeyword,
    "default": SyntaxKind.DefaultKeyword,
    "delete": SyntaxKind.DeleteKeyword,
    "do": SyntaxKind.DoKeyword,
    "else": SyntaxKind.ElseKeyword,
    "enum": SyntaxKind.EnumKeyword,
    "ether": SyntaxKind.EtherKeyword,
    "event": SyntaxKind.EventKeyword,
    "external": SyntaxKind.ExternalKeyword,
    "false": SyntaxKind.FalseKeyword,
    "final": SyntaxKind.FinalKeyword,
    "finney": SyntaxKind.FinneyKeyword,
    "fixed": SyntaxKind.FixedKeyword,
    "for": SyntaxKind.ForKeyword,
    "function": SyntaxKind.FunctionKeyword,
    "hex": SyntaxKind.HexKeyword,
    "hours": SyntaxKind.HoursKeyword,
    "if": SyntaxKind.IfKeyword,
    "import": SyntaxKind.ImportKeyword,
    "in": SyntaxKind.InKeyword,
    "indexed": SyntaxKind.IndexedKeyword,
    "inline": SyntaxKind.InlineKeyword,
    "int": SyntaxKind.IntKeyword,
    "interface": SyntaxKind.InterfaceKeyword,
    "internal": SyntaxKind.InternalKeyword,
    "is": SyntaxKind.IsKeyword,
    "let": SyntaxKind.LetKeyword,
    "library": SyntaxKind.LibraryKeyword,
    "mapping": SyntaxKind.MappingKeyword,
    "match": SyntaxKind.MatchKeyword,
    "memory": SyntaxKind.MemoryKeyword,
    "minutes": SyntaxKind.MinutesKeyword,
    "modifier": SyntaxKind.ModifierKeyword,
    "new": SyntaxKind.NewKeyword,
    "null": SyntaxKind.NullKeyword,
    "of": SyntaxKind.OfKeyword,
    "payable": SyntaxKind.PayableKeyword,
    "pragma": SyntaxKind.PragmaKeyword,
    "private": SyntaxKind.PrivateKeyword,
    "public": SyntaxKind.PublicKeyword,
    "pure": SyntaxKind.PureKeyword,
    "relocatable": SyntaxKind.RelocatableKeyword,
    "return": SyntaxKind.ReturnKeyword,
    "returns": SyntaxKind.ReturnsKeyword,
    "seconds": SyntaxKind.SecondsKeyword,
    "static": SyntaxKind.StaticKeyword,
    "storage": SyntaxKind.StorageKeyword,
    "string": SyntaxKind.StringKeyword,
    "struct": SyntaxKind.StructKeyword,
    "switch": SyntaxKind.SwitchKeyword,
    "szabo": SyntaxKind.SzaboKeyword,
    "this": SyntaxKind.ThisKeyword,
    "throw": SyntaxKind.ThrowKeyword,
    "true": SyntaxKind.TrueKeyword,
    "try": SyntaxKind.TryKeyword,
    "type": SyntaxKind.TypeKeyword,
    "typeof": SyntaxKind.TypeofKeyword,
    "ufixed": SyntaxKind.UfixedKeyword,
    "uint": SyntaxKind.UintKeyword,
    "using": SyntaxKind.UsingKeyword,
    "var": SyntaxKind.VarKeyword,
    "weeks": SyntaxKind.WeeksKeyword,
    "wei": SyntaxKind.WeiKeyword,
    "while": SyntaxKind.WhileKeyword,
    "years": SyntaxKind.YearsKeyword,
    "{": SyntaxKind.OpenBraceToken,
    "}": SyntaxKind.CloseBraceToken,
    "(": SyntaxKind.OpenParenToken,
    ")": SyntaxKind.CloseParenToken,
    "[": SyntaxKind.OpenBracketToken,
    "]": SyntaxKind.CloseBracketToken,
    ".": SyntaxKind.DotToken,
    "...": SyntaxKind.DotDotDotToken,
    ";": SyntaxKind.SemicolonToken,
    ",": SyntaxKind.CommaToken,
    "<": SyntaxKind.LessThanToken,
    ">": SyntaxKind.GreaterThanToken,
    "<=": SyntaxKind.LessThanEqualsToken,
    ">=": SyntaxKind.GreaterThanEqualsToken,
    "==": SyntaxKind.EqualsEqualsToken,
    "!=": SyntaxKind.ExclamationEqualsToken,
    "=>": SyntaxKind.EqualsGreaterThanToken,
    "+": SyntaxKind.PlusToken,
    "-": SyntaxKind.MinusToken,
    "**": SyntaxKind.AsteriskAsteriskToken,
    "*": SyntaxKind.AsteriskToken,
    "/": SyntaxKind.SlashToken,
    "%": SyntaxKind.PercentToken,
    "++": SyntaxKind.PlusPlusToken,
    "--": SyntaxKind.MinusMinusToken,
    "<<": SyntaxKind.LessThanLessThanToken,
    "</": SyntaxKind.LessThanSlashToken,
    ">>": SyntaxKind.GreaterThanGreaterThanToken,
    ">>>": SyntaxKind.GreaterThanGreaterThanGreaterThanToken,
    "&": SyntaxKind.AmpersandToken,
    "|": SyntaxKind.BarToken,
    "^": SyntaxKind.CaretToken,
    "!": SyntaxKind.ExclamationToken,
    "~": SyntaxKind.TildeToken,
    "&&": SyntaxKind.AmpersandAmpersandToken,
    "||": SyntaxKind.BarBarToken,
    "?": SyntaxKind.QuestionToken,
    ":": SyntaxKind.ColonToken,
    "=": SyntaxKind.EqualsToken,
    "+=": SyntaxKind.PlusEqualsToken,
    "-=": SyntaxKind.MinusEqualsToken,
    "*=": SyntaxKind.AsteriskEqualsToken,
    "/=": SyntaxKind.SlashEqualsToken,
    "%=": SyntaxKind.PercentEqualsToken,
    "<<=": SyntaxKind.LessThanLessThanEqualsToken,
    ">>=": SyntaxKind.GreaterThanGreaterThanEqualsToken,
    ">>>=": SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken,
    "&=": SyntaxKind.AmpersandEqualsToken,
    "|=": SyntaxKind.BarEqualsToken,
    "^=": SyntaxKind.CaretEqualsToken,
    "@": SyntaxKind.AtToken,
});

function makeReverseMap(source: Map<number>): string[] {
    const result: string[] = [];
    source.forEach((value, name) => {
        result[value] = name;
    });
    return result;
}

const tokenStrings = makeReverseMap(textToToken);

export function tokenToString(t: SyntaxKind): string | undefined {
    return tokenStrings[t];
}

/* @internal */
export function stringToToken(s: string): SyntaxKind {
    return textToToken.get(s);
}

/* @internal */
export function computeLineStarts(text: string): number[] {
    const result: number[] = new Array();
    let pos = 0;
    let lineStart = 0;
    while (pos < text.length) {
        const ch = text.charCodeAt(pos);
        pos++;
        switch (ch) {
            case CharacterCodes.carriageReturn:
                if (text.charCodeAt(pos) === CharacterCodes.lineFeed) {
                    pos++;
                }
            // falls through
            case CharacterCodes.lineFeed:
                result.push(lineStart);
                lineStart = pos;
                break;
            default:
                if (ch > CharacterCodes.maxAsciiCharacter && isLineBreak(ch)) {
                    result.push(lineStart);
                    lineStart = pos;
                }
                break;
        }
    }
    result.push(lineStart);
    return result;
}

export function getPositionOfLineAndCharacter(sourceFile: SourceFile, line: number, character: number): number {
    return computePositionOfLineAndCharacter(getLineStarts(sourceFile), line, character, sourceFile.text);
}

/* @internal */
export function computePositionOfLineAndCharacter(lineStarts: ReadonlyArray<number>, line: number, character: number, debugText?: string): number {
    Debug.assert(line >= 0 && line < lineStarts.length);
    const res = lineStarts[line] + character;
    if (line < lineStarts.length - 1) {
        Debug.assert(res < lineStarts[line + 1]);
    }
    else if (debugText !== undefined) {
        Debug.assert(res <= debugText.length); // Allow single character overflow for trailing newline
    }
    return res;
}

/* @internal */
export function getLineStarts(sourceFile: SourceFileLike): ReadonlyArray<number> {
    return sourceFile.lineMap || (sourceFile.lineMap = computeLineStarts(sourceFile.text));
}

/* @internal */
/**
 * We assume the first line starts at position 0 and 'position' is non-negative.
 */
export function computeLineAndCharacterOfPosition(lineStarts: ReadonlyArray<number>, position: number) {
    let lineNumber = binarySearch(lineStarts, position);
    if (lineNumber < 0) {
        // If the actual position was not found,
        // the binary search returns the 2's-complement of the next line start
        // e.g. if the line starts at [5, 10, 23, 80] and the position requested was 20
        // then the search will return -2.
        //
        // We want the index of the previous line start, so we subtract 1.
        // Review 2's-complement if this is confusing.
        lineNumber = ~lineNumber - 1;
        Debug.assert(lineNumber !== -1, "position cannot precede the beginning of the file");
    }
    return {
        line: lineNumber,
        character: position - lineStarts[lineNumber]
    };
}

export function getLineAndCharacterOfPosition(sourceFile: SourceFileLike, position: number): LineAndCharacter {
    return computeLineAndCharacterOfPosition(getLineStarts(sourceFile), position);
}

/** Does not include line breaks. For that, see isWhiteSpaceLike. */
export function isWhiteSpaceSingleLine(ch: number): boolean {
    // Note: nextLine is in the Zs space, and should be considered to be a whitespace.
    // It is explicitly not a line-break as it isn't in the exact set specified by EcmaScript.
    return ch === CharacterCodes.space ||
        ch === CharacterCodes.tab ||
        ch === CharacterCodes.verticalTab ||
        ch === CharacterCodes.formFeed ||
        ch === CharacterCodes.nonBreakingSpace ||
        ch === CharacterCodes.nextLine ||
        ch === CharacterCodes.ogham ||
        ch >= CharacterCodes.enQuad && ch <= CharacterCodes.zeroWidthSpace ||
        ch === CharacterCodes.narrowNoBreakSpace ||
        ch === CharacterCodes.mathematicalSpace ||
        ch === CharacterCodes.ideographicSpace ||
        ch === CharacterCodes.byteOrderMark;
}

export function isLineBreak(ch: number): boolean {
    // ES5 7.3:
    // The ECMAScript line terminator characters are listed in Table 3.
    //     Table 3: Line Terminator Characters
    //     Code Unit Value     Name                    Formal Name
    //     \u000A              Line Feed               <LF>
    //     \u000D              Carriage Return         <CR>
    //     \u2028              Line separator          <LS>
    //     \u2029              Paragraph separator     <PS>
    // Only the characters in Table 3 are treated as line terminators. Other new line or line
    // breaking characters are treated as white space but not as line terminators.

    return ch === CharacterCodes.lineFeed ||
        ch === CharacterCodes.carriageReturn ||
        ch === CharacterCodes.lineSeparator ||
        ch === CharacterCodes.paragraphSeparator;
}

function isDigit(ch: number): boolean {
    return ch >= CharacterCodes._0 && ch <= CharacterCodes._9;
}

/* @internal */
export function isOctalDigit(ch: number): boolean {
    return ch >= CharacterCodes._0 && ch <= CharacterCodes._7;
}

// All conflict markers consist of the same character repeated seven times.  If it is
// a <<<<<<< or >>>>>>> marker then it is also followed by a space.
const mergeConflictMarkerLength = "<<<<<<<".length;

function isConflictMarkerTrivia(text: string, pos: number) {
    Debug.assert(pos >= 0);

    // Conflict markers must be at the start of a line.
    if (pos === 0 || isLineBreak(text.charCodeAt(pos - 1))) {
        const ch = text.charCodeAt(pos);

        if ((pos + mergeConflictMarkerLength) < text.length) {
            for (let i = 0; i < mergeConflictMarkerLength; i++) {
                if (text.charCodeAt(pos + i) !== ch) {
                    return false;
                }
            }

            return ch === CharacterCodes.equals ||
                text.charCodeAt(pos + mergeConflictMarkerLength) === CharacterCodes.space;
        }
    }

    return false;
}

function scanConflictMarkerTrivia(text: string, pos: number, error?: ErrorCallback) {
    if (error) {
        error("Merge conflict marker encountered", mergeConflictMarkerLength);
    }

    const ch = text.charCodeAt(pos);
    const len = text.length;

    if (ch === CharacterCodes.lessThan || ch === CharacterCodes.greaterThan) {
        while (pos < len && !isLineBreak(text.charCodeAt(pos))) {
            pos++;
        }
    }
    else {
        Debug.assert(ch === CharacterCodes.bar || ch === CharacterCodes.equals);
        // Consume everything from the start of a ||||||| or ======= marker to the start
        // of the next ======= or >>>>>>> marker.
        while (pos < len) {
            const currentChar = text.charCodeAt(pos);
            if ((currentChar === CharacterCodes.equals || currentChar === CharacterCodes.greaterThan) && currentChar !== ch && isConflictMarkerTrivia(text, pos)) {
                break;
            }

            pos++;
        }
    }

    return pos;
}


export function isDecimalDigit(ch: number) {
    return CharacterCodes._0 <= ch && ch <= CharacterCodes._9;
}

export function isIdentifierStart(ch: number) {
    return ch === CharacterCodes._ || ch === CharacterCodes.$ || (CharacterCodes.a <= ch && ch <= CharacterCodes.z) || (CharacterCodes.A <= ch && ch <= CharacterCodes.Z);
}

export function isIdentifierPart(ch: number) {
    return isIdentifierStart(ch) || isDecimalDigit(ch);
}

/* @internal */
export function isIdentifierText(name: string): boolean {
    if (!isIdentifierStart(name.charCodeAt(0))) {
        return false;
    }

    for (let i = 1; i < name.length; i++) {
        if (!isIdentifierPart(name.charCodeAt(i))) {
            return false;
        }
    }

    return true;
}

// Creates a scanner over a (possibly unspecified) range of a piece of text.
export function createScanner(skipTrivia: boolean,
    languageVersion = LanguageVersion.Solidity_0_4,
    text?: string,
    onError?: ErrorCallback,
    start?: number,
    length?: number): Scanner {
    // Current position (end position of text of current token)
    let pos: number;

    // end of text
    let end: number;

    // Start position of whitespace before current token
    let startPos: number;

    // Start position of text of current token
    let tokenPos: number;

    let token: SyntaxKind;
    let tokenValue: string;
    let precedingLineBreak: boolean;
    let hasExtendedUnicodeEscape: boolean;
    let tokenIsUnterminated: boolean;
    let numericLiteralFlags: NumericLiteralFlags;

    setText(text, start, length);

    return {
        getStartPos: () => startPos,
        getTextPos: () => pos,
        getToken: () => token,
        getTokenPos: () => tokenPos,
        getTokenText: () => text.substring(tokenPos, pos),
        getTokenValue: () => tokenValue,
        hasPrecedingLineBreak: () => precedingLineBreak,
        isIdentifier: () => token === SyntaxKind.Identifier || token > SyntaxKind.LastReservedWord,
        isReservedWord: () => token >= SyntaxKind.FirstReservedWord && token <= SyntaxKind.LastReservedWord,
        isUnterminated: () => tokenIsUnterminated,
        getNumericLiteralFlags: () => numericLiteralFlags,
        reScanGreaterToken,
        scan,
        getText,
        setText,
        setLanguageVersion,
        setOnError,
        setTextPos,
    };

    function error(message: string, length?: number): void {
        if (onError) {
            onError(message, length || 0);
        }
    }

    function scanNumber(): string {
        const start = pos;
        while (isDigit(text.charCodeAt(pos))) pos++;
        if (text.charCodeAt(pos) === CharacterCodes.dot) {
            pos++;
            while (isDigit(text.charCodeAt(pos))) pos++;
        }
        let end = pos;
        if (text.charCodeAt(pos) === CharacterCodes.E || text.charCodeAt(pos) === CharacterCodes.e) {
            pos++;
            numericLiteralFlags = NumericLiteralFlags.Scientific;
            if (text.charCodeAt(pos) === CharacterCodes.plus || text.charCodeAt(pos) === CharacterCodes.minus) pos++;
            if (isDigit(text.charCodeAt(pos))) {
                pos++;
                while (isDigit(text.charCodeAt(pos))) pos++;
                end = pos;
            }
            else {
                error("Digit expected");
            }
        }
        return "" + +(text.substring(start, end));
    }

    function scanOctalDigits(): number {
        const start = pos;
        while (isOctalDigit(text.charCodeAt(pos))) {
            pos++;
        }
        return +(text.substring(start, pos));
    }

    /**
     * Scans the given number of hexadecimal digits in the text,
     * returning -1 if the given number is unavailable.
     */
    function scanExactNumberOfHexDigits(count: number): number {
        return scanHexDigits(/*minCount*/ count, /*scanAsManyAsPossible*/ false);
    }

    /**
     * Scans as many hexadecimal digits as are available in the text,
     * returning -1 if the given number of digits was unavailable.
     */
    function scanMinimumNumberOfHexDigits(count: number): number {
        return scanHexDigits(/*minCount*/ count, /*scanAsManyAsPossible*/ true);
    }

    function scanHexDigits(minCount: number, scanAsManyAsPossible: boolean): number {
        let digits = 0;
        let value = 0;
        while (digits < minCount || scanAsManyAsPossible) {
            const ch = text.charCodeAt(pos);
            if (ch >= CharacterCodes._0 && ch <= CharacterCodes._9) {
                value = value * 16 + ch - CharacterCodes._0;
            }
            else if (ch >= CharacterCodes.A && ch <= CharacterCodes.F) {
                value = value * 16 + ch - CharacterCodes.A + 10;
            }
            else if (ch >= CharacterCodes.a && ch <= CharacterCodes.f) {
                value = value * 16 + ch - CharacterCodes.a + 10;
            }
            else {
                break;
            }
            pos++;
            digits++;
        }
        if (digits < minCount) {
            value = -1;
        }
        return value;
    }

    function scanString(allowEscapes = true): string {
        const quote = text.charCodeAt(pos);
        pos++;
        let result = "";
        let start = pos;
        while (true) {
            if (pos >= end) {
                result += text.substring(start, pos);
                tokenIsUnterminated = true;
                error("Unterminated string literal");
                break;
            }
            const ch = text.charCodeAt(pos);
            if (ch === quote) {
                result += text.substring(start, pos);
                pos++;
                break;
            }
            if (ch === CharacterCodes.backslash && allowEscapes) {
                result += text.substring(start, pos);
                result += scanEscapeSequence();
                start = pos;
                continue;
            }
            if (isLineBreak(ch)) {
                result += text.substring(start, pos);
                tokenIsUnterminated = true;
                error("Unterminated string literal");
                break;
            }
            pos++;
        }
        return result;
    }

    function scanEscapeSequence(): string {
        pos++;
        if (pos >= end) {
            error("Unexpected end of text");
            return "";
        }
        const ch = text.charCodeAt(pos);
        pos++;
        switch (ch) {
            case CharacterCodes._0:
                return "\0";
            case CharacterCodes.b:
                return "\b";
            case CharacterCodes.t:
                return "\t";
            case CharacterCodes.n:
                return "\n";
            case CharacterCodes.v:
                return "\v";
            case CharacterCodes.f:
                return "\f";
            case CharacterCodes.r:
                return "\r";
            case CharacterCodes.singleQuote:
                return "\'";
            case CharacterCodes.doubleQuote:
                return "\"";
            case CharacterCodes.u:
                // '\uDDDD'
                return scanHexadecimalEscape(/*numDigits*/ 4);

            case CharacterCodes.x:
                // '\xDD'
                return scanHexadecimalEscape(/*numDigits*/ 2);

            // when encountering a LineContinuation (i.e. a backslash and a line terminator sequence),
            // the line terminator is interpreted to be "the empty code unit sequence".
            case CharacterCodes.carriageReturn:
                if (pos < end && text.charCodeAt(pos) === CharacterCodes.lineFeed) {
                    pos++;
                }
            // falls through
            case CharacterCodes.lineFeed:
            case CharacterCodes.lineSeparator:
            case CharacterCodes.paragraphSeparator:
                return "";
            default:
                return String.fromCharCode(ch);
        }
    }

    function scanHexadecimalEscape(numDigits: number): string {
        const escapedValue = scanExactNumberOfHexDigits(numDigits);

        if (escapedValue >= 0) {
            return String.fromCharCode(escapedValue);
        }
        else {
            error("Hexadecimal digit expected");
            return "";
        }
    }

    // Current character is known to be a backslash. Check for Unicode escape of the form '\uXXXX'
    // and return code point value if valid Unicode escape is found. Otherwise return -1.
    function peekUnicodeEscape(): number {
        if (pos + 5 < end && text.charCodeAt(pos + 1) === CharacterCodes.u) {
            const start = pos;
            pos += 2;
            const value = scanExactNumberOfHexDigits(4);
            pos = start;
            return value;
        }
        return -1;
    }

    function scanIdentifierParts(): string {
        let result = "";
        let start = pos;
        while (pos < end) {
            let ch = text.charCodeAt(pos);
            if (isIdentifierPart(ch)) {
                pos++;
            }
            else if (ch === CharacterCodes.backslash) {
                ch = peekUnicodeEscape();
                if (!(ch >= 0 && isIdentifierPart(ch))) {
                    break;
                }
                result += text.substring(start, pos);
                result += String.fromCharCode(ch);
                // Valid Unicode escape is always six characters
                pos += 6;
                start = pos;
            }
            else {
                break;
            }
        }
        result += text.substring(start, pos);
        return result;
    }

    function getIdentifierToken(): SyntaxKind {
        // Reserved words are between 2 and 11 characters long and start with a lowercase letter
        const len = tokenValue.length;
        if (len >= 2 && len <= 11) {
            const ch = tokenValue.charCodeAt(0);
            if (ch >= CharacterCodes.a && ch <= CharacterCodes.z) {
                token = textToToken.get(tokenValue);
                if (token !== undefined) {
                    return token;
                }
            }
        }
        return token = SyntaxKind.Identifier;
    }

    function scan(): SyntaxKind {
        startPos = pos;
        hasExtendedUnicodeEscape = false;
        precedingLineBreak = false;
        tokenIsUnterminated = false;
        numericLiteralFlags = 0;
        while (true) {
            tokenPos = pos;
            if (pos >= end) {
                return token = SyntaxKind.EndOfFileToken;
            }
            let ch = text.charCodeAt(pos);
            switch (ch) {
                case CharacterCodes.lineFeed:
                case CharacterCodes.carriageReturn:
                    precedingLineBreak = true;
                    if (skipTrivia) {
                        pos++;
                        continue;
                    }
                    else {
                        if (ch === CharacterCodes.carriageReturn && pos + 1 < end && text.charCodeAt(pos + 1) === CharacterCodes.lineFeed) {
                            // consume both CR and LF
                            pos += 2;
                        }
                        else {
                            pos++;
                        }
                        return token = SyntaxKind.NewLineTrivia;
                    }
                case CharacterCodes.tab:
                case CharacterCodes.verticalTab:
                case CharacterCodes.formFeed:
                case CharacterCodes.space:
                    if (skipTrivia) {
                        pos++;
                        continue;
                    }
                    else {
                        while (pos < end && isWhiteSpaceSingleLine(text.charCodeAt(pos))) {
                            pos++;
                        }
                        return token = SyntaxKind.WhitespaceTrivia;
                    }
                case CharacterCodes.exclamation:
                    if (text.charCodeAt(pos + 1) === CharacterCodes.equals) {
                        return pos += 2, token = SyntaxKind.ExclamationEqualsToken;
                    }
                    pos++;
                    return token = SyntaxKind.ExclamationToken;
                case CharacterCodes.doubleQuote:
                case CharacterCodes.singleQuote:
                    tokenValue = scanString();
                    return token = SyntaxKind.StringLiteral;
                case CharacterCodes.percent:
                    if (text.charCodeAt(pos + 1) === CharacterCodes.equals) {
                        return pos += 2, token = SyntaxKind.PercentEqualsToken;
                    }
                    pos++;
                    return token = SyntaxKind.PercentToken;
                case CharacterCodes.ampersand:
                    if (text.charCodeAt(pos + 1) === CharacterCodes.ampersand) {
                        return pos += 2, token = SyntaxKind.AmpersandAmpersandToken;
                    }
                    if (text.charCodeAt(pos + 1) === CharacterCodes.equals) {
                        return pos += 2, token = SyntaxKind.AmpersandEqualsToken;
                    }
                    pos++;
                    return token = SyntaxKind.AmpersandToken;
                case CharacterCodes.openParen:
                    pos++;
                    return token = SyntaxKind.OpenParenToken;
                case CharacterCodes.closeParen:
                    pos++;
                    return token = SyntaxKind.CloseParenToken;
                case CharacterCodes.asterisk:
                    if (text.charCodeAt(pos + 1) === CharacterCodes.equals) {
                        return pos += 2, token = SyntaxKind.AsteriskEqualsToken;
                    }
                    if (text.charCodeAt(pos + 1) === CharacterCodes.asterisk) {
                        return pos += 2, token = SyntaxKind.AsteriskAsteriskToken;
                    }
                    pos++;
                    return token = SyntaxKind.AsteriskToken;
                case CharacterCodes.plus:
                    if (text.charCodeAt(pos + 1) === CharacterCodes.plus) {
                        return pos += 2, token = SyntaxKind.PlusPlusToken;
                    }
                    if (text.charCodeAt(pos + 1) === CharacterCodes.equals) {
                        return pos += 2, token = SyntaxKind.PlusEqualsToken;
                    }
                    pos++;
                    return token = SyntaxKind.PlusToken;
                case CharacterCodes.comma:
                    pos++;
                    return token = SyntaxKind.CommaToken;
                case CharacterCodes.minus:
                    if (text.charCodeAt(pos + 1) === CharacterCodes.minus) {
                        return pos += 2, token = SyntaxKind.MinusMinusToken;
                    }
                    if (text.charCodeAt(pos + 1) === CharacterCodes.equals) {
                        return pos += 2, token = SyntaxKind.MinusEqualsToken;
                    }
                    pos++;
                    return token = SyntaxKind.MinusToken;
                case CharacterCodes.dot:
                    if (isDigit(text.charCodeAt(pos + 1))) {
                        tokenValue = scanNumber();
                        return token = SyntaxKind.NumericLiteral;
                    }
                    if (text.charCodeAt(pos + 1) === CharacterCodes.dot && text.charCodeAt(pos + 2) === CharacterCodes.dot) {
                        return pos += 3, token = SyntaxKind.DotDotDotToken;
                    }
                    pos++;
                    return token = SyntaxKind.DotToken;
                case CharacterCodes.slash:
                    // Single-line comment
                    if (text.charCodeAt(pos + 1) === CharacterCodes.slash) {
                        pos += 2;

                        while (pos < end) {
                            if (isLineBreak(text.charCodeAt(pos))) {
                                break;
                            }
                            pos++;

                        }

                        if (skipTrivia) {
                            continue;
                        }
                        else {
                            return token = SyntaxKind.SingleLineCommentTrivia;
                        }
                    }
                    // Multi-line comment
                    if (text.charCodeAt(pos + 1) === CharacterCodes.asterisk) {
                        pos += 2;

                        let commentClosed = false;
                        while (pos < end) {
                            const ch = text.charCodeAt(pos);

                            if (ch === CharacterCodes.asterisk && text.charCodeAt(pos + 1) === CharacterCodes.slash) {
                                pos += 2;
                                commentClosed = true;
                                break;
                            }

                            if (isLineBreak(ch)) {
                                precedingLineBreak = true;
                            }
                            pos++;
                        }

                        if (!commentClosed) {
                            error("Asterisk Slash expected");
                        }

                        if (skipTrivia) {
                            continue;
                        }
                        else {
                            tokenIsUnterminated = !commentClosed;
                            return token = SyntaxKind.MultiLineCommentTrivia;
                        }
                    }

                    if (text.charCodeAt(pos + 1) === CharacterCodes.equals) {
                        return pos += 2, token = SyntaxKind.SlashEqualsToken;
                    }

                    pos++;
                    return token = SyntaxKind.SlashToken;

                case CharacterCodes._0:
                    if (pos + 2 < end && (text.charCodeAt(pos + 1) === CharacterCodes.X || text.charCodeAt(pos + 1) === CharacterCodes.x)) {
                        pos += 2;
                        let value = scanMinimumNumberOfHexDigits(1);
                        if (value < 0) {
                            error("Hexadecimal digit expected");
                            value = 0;
                        }
                        tokenValue = "" + value;
                        numericLiteralFlags = NumericLiteralFlags.HexSpecifier;
                        return token = SyntaxKind.NumericLiteral;
                    }
                    // Try to parse as an octal
                    if (pos + 1 < end && isOctalDigit(text.charCodeAt(pos + 1))) {
                        tokenValue = "" + scanOctalDigits();
                        numericLiteralFlags = NumericLiteralFlags.Octal;
                        return token = SyntaxKind.NumericLiteral;
                    }
                // This fall-through is a deviation from the EcmaScript grammar. The grammar says that a leading zero
                // can only be followed by an octal digit, a dot, or the end of the number literal. However, we are being
                // permissive and allowing decimal digits of the form 08* and 09* (which many browsers also do).
                // falls through
                case CharacterCodes._1:
                case CharacterCodes._2:
                case CharacterCodes._3:
                case CharacterCodes._4:
                case CharacterCodes._5:
                case CharacterCodes._6:
                case CharacterCodes._7:
                case CharacterCodes._8:
                case CharacterCodes._9:
                    tokenValue = scanNumber();
                    return token = SyntaxKind.NumericLiteral;
                case CharacterCodes.colon:
                    pos++;
                    return token = SyntaxKind.ColonToken;
                case CharacterCodes.semicolon:
                    pos++;
                    return token = SyntaxKind.SemicolonToken;
                case CharacterCodes.lessThan:
                    if (isConflictMarkerTrivia(text, pos)) {
                        pos = scanConflictMarkerTrivia(text, pos, error);
                        if (skipTrivia) {
                            continue;
                        }
                        else {
                            return token = SyntaxKind.ConflictMarkerTrivia;
                        }
                    }

                    if (text.charCodeAt(pos + 1) === CharacterCodes.lessThan) {
                        if (text.charCodeAt(pos + 2) === CharacterCodes.equals) {
                            return pos += 3, token = SyntaxKind.LessThanLessThanEqualsToken;
                        }
                        return pos += 2, token = SyntaxKind.LessThanLessThanToken;
                    }
                    if (text.charCodeAt(pos + 1) === CharacterCodes.equals) {
                        return pos += 2, token = SyntaxKind.LessThanEqualsToken;
                    }
                    pos++;
                    return token = SyntaxKind.LessThanToken;
                case CharacterCodes.equals:
                    if (isConflictMarkerTrivia(text, pos)) {
                        pos = scanConflictMarkerTrivia(text, pos, error);
                        if (skipTrivia) {
                            continue;
                        }
                        else {
                            return token = SyntaxKind.ConflictMarkerTrivia;
                        }
                    }

                    if (text.charCodeAt(pos + 1) === CharacterCodes.equals) {
                        return pos += 2, token = SyntaxKind.EqualsEqualsToken;
                    }
                    if (text.charCodeAt(pos + 1) === CharacterCodes.greaterThan) {
                        return pos += 2, token = SyntaxKind.EqualsGreaterThanToken;
                    }
                    pos++;
                    return token = SyntaxKind.EqualsToken;
                case CharacterCodes.greaterThan:
                    if (isConflictMarkerTrivia(text, pos)) {
                        pos = scanConflictMarkerTrivia(text, pos, error);
                        if (skipTrivia) {
                            continue;
                        }
                        else {
                            return token = SyntaxKind.ConflictMarkerTrivia;
                        }
                    }

                    pos++;
                    return token = SyntaxKind.GreaterThanToken;
                case CharacterCodes.question:
                    pos++;
                    return token = SyntaxKind.QuestionToken;
                case CharacterCodes.openBracket:
                    pos++;
                    return token = SyntaxKind.OpenBracketToken;
                case CharacterCodes.closeBracket:
                    pos++;
                    return token = SyntaxKind.CloseBracketToken;
                case CharacterCodes.caret:
                    if (text.charCodeAt(pos + 1) === CharacterCodes.equals) {
                        return pos += 2, token = SyntaxKind.CaretEqualsToken;
                    }
                    pos++;
                    return token = SyntaxKind.CaretToken;
                case CharacterCodes.openBrace:
                    pos++;
                    return token = SyntaxKind.OpenBraceToken;
                case CharacterCodes.bar:
                    if (isConflictMarkerTrivia(text, pos)) {
                        pos = scanConflictMarkerTrivia(text, pos, error);
                        if (skipTrivia) {
                            continue;
                        }
                        else {
                            return token = SyntaxKind.ConflictMarkerTrivia;
                        }
                    }

                    if (text.charCodeAt(pos + 1) === CharacterCodes.bar) {
                        return pos += 2, token = SyntaxKind.BarBarToken;
                    }
                    if (text.charCodeAt(pos + 1) === CharacterCodes.equals) {
                        return pos += 2, token = SyntaxKind.BarEqualsToken;
                    }
                    pos++;
                    return token = SyntaxKind.BarToken;
                case CharacterCodes.closeBrace:
                    pos++;
                    return token = SyntaxKind.CloseBraceToken;
                case CharacterCodes.tilde:
                    pos++;
                    return token = SyntaxKind.TildeToken;
                case CharacterCodes.at:
                    pos++;
                    return token = SyntaxKind.AtToken;
                case CharacterCodes.backslash:
                    const cookedChar = peekUnicodeEscape();
                    if (cookedChar >= 0 && isIdentifierStart(cookedChar)) {
                        pos += 6;
                        tokenValue = String.fromCharCode(cookedChar) + scanIdentifierParts();
                        return token = getIdentifierToken();
                    }
                    error("Invalid character");
                    pos++;
                    return token = SyntaxKind.Unknown;
                default:
                    if (isIdentifierStart(ch)) {
                        pos++;
                        while (pos < end && isIdentifierPart(ch = text.charCodeAt(pos))) pos++;
                        tokenValue = text.substring(tokenPos, pos);
                        if (ch === CharacterCodes.backslash) {
                            tokenValue += scanIdentifierParts();
                        }
                        return token = getIdentifierToken();
                    }
                    else if (isWhiteSpaceSingleLine(ch)) {
                        pos++;
                        continue;
                    }
                    else if (isLineBreak(ch)) {
                        precedingLineBreak = true;
                        pos++;
                        continue;
                    }
                    error("Invalid character");
                    pos++;
                    return token = SyntaxKind.Unknown;
            }
        }
    }

    function reScanGreaterToken(): SyntaxKind {
        if (token === SyntaxKind.GreaterThanToken) {
            if (text.charCodeAt(pos) === CharacterCodes.greaterThan) {
                if (text.charCodeAt(pos + 1) === CharacterCodes.greaterThan) {
                    if (text.charCodeAt(pos + 2) === CharacterCodes.equals) {
                        return pos += 3, token = SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken;
                    }
                    return pos += 2, token = SyntaxKind.GreaterThanGreaterThanGreaterThanToken;
                }
                if (text.charCodeAt(pos + 1) === CharacterCodes.equals) {
                    return pos += 2, token = SyntaxKind.GreaterThanGreaterThanEqualsToken;
                }
                pos++;
                return token = SyntaxKind.GreaterThanGreaterThanToken;
            }
            if (text.charCodeAt(pos) === CharacterCodes.equals) {
                pos++;
                return token = SyntaxKind.GreaterThanEqualsToken;
            }
        }
        return token;
    }

    function getText(): string {
        return text;
    }

    function setText(newText: string, start: number, length: number) {
        text = newText || "";
        end = length === undefined ? text.length : start + length;
        setTextPos(start || 0);
    }

    function setOnError(errorCallback: ErrorCallback) {
        onError = errorCallback;
    }


    function setLanguageVersion(version: LanguageVersion) {
        languageVersion = version;
    }

    function setTextPos(textPos: number) {
        Debug.assert(textPos >= 0);
        pos = textPos;
        startPos = textPos;
        tokenPos = textPos;
        token = SyntaxKind.Unknown;
        precedingLineBreak = false;

        tokenValue = undefined;
        hasExtendedUnicodeEscape = false;
        tokenIsUnterminated = false;
    }
}
