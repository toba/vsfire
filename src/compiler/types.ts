import { Diagnostic } from "vscode-languageserver";

// branded string type used to store absolute, normalized and canonicalized paths
// arbitrary file name can be converted to Path via toPath function
export type Path = string & { __pathBrand: any };

export interface LineAndCharacter {
    line: number;
    /*
     * This value denotes the character position in line and is different from the 'column' because of tab characters.
     */
    character: number;
}

// token > SyntaxKind.Identifer => token is a keyword
// Also, If you add a new SyntaxKind be sure to keep the `Markers` section at the bottom in sync
export const enum SyntaxKind {
    Unknown,
    EndOfFileToken,
    SingleLineCommentTrivia,
    MultiLineCommentTrivia,
    NewLineTrivia,
    WhitespaceTrivia,
    // We detect and preserve #! on the first line
    ShebangTrivia,
    // We detect and provide better error recovery when we encounter a git merge marker.  This
    // allows us to edit files with git-conflict markers in them in a much more pleasant manner.
    ConflictMarkerTrivia,
    // Literals
    NumericLiteral,
    StringLiteral,
    // Punctuation
    OpenBraceToken,
    CloseBraceToken,
    OpenParenToken,
    CloseParenToken,
    OpenBracketToken,
    CloseBracketToken,
    DotToken,
    DotDotDotToken,
    SemicolonToken,
    CommaToken,
    LessThanToken,
    LessThanSlashToken,
    GreaterThanToken,
    LessThanEqualsToken,
    GreaterThanEqualsToken,
    EqualsEqualsToken,
    ExclamationEqualsToken,
    EqualsGreaterThanToken,
    PlusToken,
    MinusToken,
    AsteriskToken,
    AsteriskAsteriskToken,
    SlashToken,
    PercentToken,
    PlusPlusToken,
    MinusMinusToken,
    LessThanLessThanToken,
    GreaterThanGreaterThanToken,
    GreaterThanGreaterThanGreaterThanToken,
    AmpersandToken,
    BarToken,
    CaretToken,
    ExclamationToken,
    TildeToken,
    AmpersandAmpersandToken,
    BarBarToken,
    QuestionToken,
    ColonToken,
    AtToken,
    // Assignments
    EqualsToken,
    PlusEqualsToken,
    MinusEqualsToken,
    AsteriskEqualsToken,
    SlashEqualsToken,
    PercentEqualsToken,
    LessThanLessThanEqualsToken,
    GreaterThanGreaterThanEqualsToken,
    GreaterThanGreaterThanGreaterThanEqualsToken,
    AmpersandEqualsToken,
    BarEqualsToken,
    CaretEqualsToken,
    // Identifiers
    Identifier,
    // Keywords
    AnonymousKeyword,
    AsKeyword,
    AssemblyKeyword,
    BreakKeyword,
    ConstantKeyword,
    ContinueKeyword,
    ContractKeyword,
    DeleteKeyword,
    DoKeyword,
    ElseKeyword,
    EnumKeyword,
    EventKeyword,
    ExternalKeyword,
    FalseKeyword,
    ForKeyword,
    FunctionKeyword,
    HexKeyword,
    IfKeyword,
    ImportKeyword,
    IndexedKeyword,
    InterfaceKeyword,
    InternalKeyword,
    IsKeyword,
    LibraryKeyword,
    MappingKeyword,
    MemoryKeyword,
    ModifierKeyword,
    NewKeyword,
    PayableKeyword,
    PragmaKeyword,
    PrivateKeyword,
    PublicKeyword,
    PureKeyword,
    ReturnKeyword,
    ReturnsKeyword,
    StorageKeyword,
    StructKeyword,
    ThisKeyword,
    ThrowKeyword,
    TrueKeyword,
    UsingKeyword,
    VarKeyword,
    WhileKeyword,
    // Types
    IntKeyword,
    UintKeyword,
    BytesKeyword,
    ByteKeyword,
    StringKeyword,
    AddressKeyword,
    BoolKeyword,
    FixedKeyword,
    UfixedKeyword,
    // Denomination
    EtherKeyword,
    FinneyKeyword,
    SzaboKeyword,
    WeiKeyword,
    // Time
    DaysKeyword,
    HoursKeyword,
    MinutesKeyword,
    SecondsKeyword,
    WeeksKeyword,
    YearsKeyword,
    // Future reserverd word
    AbstractKeyword,
    AfterKeyword,
    CaseKeyword,
    CatchKeyword,
    DefaultKeyword,
    FinalKeyword,
    InKeyword,
    InlineKeyword,
    LetKeyword,
    MatchKeyword,
    NullKeyword,
    OfKeyword,
    RelocatableKeyword,
    StaticKeyword,
    SwitchKeyword,
    TryKeyword,
    TypeKeyword,
    TypeofKeyword, // LastKeyword and LastToken

    // Markers
    FirstAssignment = EqualsToken,
    LastAssignment = CaretEqualsToken,
    FirstCompoundAssignment = PlusEqualsToken,
    LastCompoundAssignment = CaretEqualsToken,
    FirstReservedWord = AnonymousKeyword,
    LastReservedWord = TypeofKeyword,
    FirstKeyword = AnonymousKeyword,
    LastKeyword = TypeofKeyword,
    FirstFutureReservedWord = AbstractKeyword,
    LastFutureReservedWord = TypeofKeyword,
    FirstPunctuation = OpenBraceToken,
    LastPunctuation = CaretEqualsToken,
    FirstToken = Unknown,
    LastToken = LastKeyword,
    FirstTriviaToken = SingleLineCommentTrivia,
    LastTriviaToken = ConflictMarkerTrivia,
    FirstLiteralToken = NumericLiteral,
    LastLiteralToken = StringLiteral,
    FirstBinaryOperator = LessThanToken,
    LastBinaryOperator = CaretEqualsToken,
}

/* @internal */
export const enum NumericLiteralFlags {
    None = 0,
    Scientific = 1 << 1,        // e.g. `10e2`
    Octal = 1 << 2,             // e.g. `0777`
    HexSpecifier = 1 << 3,      // e.g. `0x00000000`
    BinarySpecifier = 1 << 4,   // e.g. `0b0110010000000000`
    OctalSpecifier = 1 << 5,    // e.g. `0o777`
    BinaryOrOctalSpecifier = BinarySpecifier | OctalSpecifier,
}

export const enum Extension {
    Sol = ".sol"
}

/** ES6 Map interface, only read methods included. */
export interface ReadonlyMap<T> {
    get(key: string): T | undefined;
    has(key: string): boolean;
    forEach(action: (value: T, key: string) => void): void;
    readonly size: number;
    keys(): Iterator<string>;
    values(): Iterator<T>;
    entries(): Iterator<[string, T]>;
}

/** ES6 Map interface. */
export interface Map<T> extends ReadonlyMap<T> {
    set(key: string, value: T): this;
    delete(key: string): boolean;
    clear(): void;
}

/* @internal */
export interface RedirectInfo {
    /** Source file this redirects to. */
    readonly redirectTarget: SourceFile;
    /**
     * Source file for the duplicate package. This will not be used by the Program,
     * but we need to keep this around so we can watch for changes in underlying.
     */
    readonly unredirected: SourceFile;
}

/* @internal */
/**
 * Subset of properties from SourceFile that are used in multiple utility functions
 */
export interface SourceFileLike {
    readonly text: string;
    lineMap: ReadonlyArray<number>;
}

export interface SourceFile {
    fileName: string;
    /* @internal */ path: Path;
    text: string;

    /**
     * If two source files are for the same version of the same package, one will redirect to the other.
     * (See `createRedirectSourceFile` in program.ts.)
     * The redirect will have this set. The other will not have anything set, but see Program#sourceFileIsRedirectedTo.
     */
    /* @internal */ redirectInfo?: RedirectInfo | undefined;

    // Stores a line map for the file.
    // This field should never be used directly to obtain line map, use getLineMap function instead.
    /* @internal */ lineMap: ReadonlyArray<number>;
    /* @internal */ resolvedModules: Map<ResolvedModuleFull>;
    /* @internal */ imports: ReadonlyArray<string>;
    /* @internal */ version: string;
}

/* @internal */
export interface HasInvalidatedResolution {
    (sourceFile: Path): boolean;
}

export interface ScriptReferenceHost {
    getCompilerOptions(): CompilerOptions;
    getSourceFile(fileName: string): SourceFile;
    getSourceFileByPath(path: Path): SourceFile;
    getCurrentDirectory(): string;
}

export interface Program extends ScriptReferenceHost {
    /**
     * Get a list of root file names that were passed to a 'createProgram'
     */
    getRootFileNames(): ReadonlyArray<string>;

    /**
     * Get a list of files in the program
     */
    getSourceFiles(): ReadonlyArray<SourceFile>;

    /**
     * Get a list of file names that were passed to 'createProgram' or referenced in a
     * program source file but could not be located.
     */
    /* @internal */
    getMissingFilePaths(): ReadonlyArray<Path>;

    getCompilerDiagnostics(sourceFile?: SourceFile): ReadonlyArray<Diagnostic>;
    getLinterDiagnostics(sourceFile?: SourceFile, soliumRules?: any): ReadonlyArray<Diagnostic>;

    /* @internal */ getFileProcessingDiagnostics(): Diagnostic[];

    /** Given a source file, get the name of the package it was imported from. */
    /* @internal */ sourceFileToPackageName: Map<string>;
    /** Set of all source files that some other source file redirects to. */
    /* @internal */ redirectTargetsSet: Map<true>;
    /** Returns true when file in the program had invalidated resolution at the time of program creation. */
    /* @internal */ hasInvalidatedResolution: HasInvalidatedResolution;
}

export interface CompilerOptions {
    remappings?: ReadonlyArray<string>;
    optimizer?: {
        enabled: boolean;
    };
}

export interface ModuleResolutionHost {
    fileExists(fileName: string): boolean;
    readFile(fileName: string): string;
    trace?(s: string): void;
    directoryExists?(directoryName: string): boolean;
    /**
     * Resolve a symbolic link.
     * @see https://nodejs.org/api/fs.html#fs_fs_realpathsync_path_options
     */
    realpath?(path: string): string;
    getCurrentDirectory?(): string;
    getDirectories?(path: string): string[];
}

export interface CompilerHost extends ModuleResolutionHost {
    getSourceFile(fileName: string, onError?: (message: string) => void, shouldCreateNewSourceFile?: boolean): SourceFile | undefined;
    getSourceFileByPath?(fileName: string, path: Path, onError?: (message: string) => void, shouldCreateNewSourceFile?: boolean): SourceFile | undefined;
    getCanonicalFileName(fileName: string): string;

    useCaseSensitiveFileNames(): boolean;

    /* @internal */ hasInvalidatedResolution?: HasInvalidatedResolution;
}

export const enum CharacterCodes {
    nullCharacter = 0,
    maxAsciiCharacter = 0x7F,

    lineFeed = 0x0A,              // \n
    carriageReturn = 0x0D,        // \r
    lineSeparator = 0x2028,
    paragraphSeparator = 0x2029,
    nextLine = 0x0085,

    // Unicode 3.0 space characters
    space = 0x0020,   // " "
    nonBreakingSpace = 0x00A0,   //
    enQuad = 0x2000,
    emQuad = 0x2001,
    enSpace = 0x2002,
    emSpace = 0x2003,
    threePerEmSpace = 0x2004,
    fourPerEmSpace = 0x2005,
    sixPerEmSpace = 0x2006,
    figureSpace = 0x2007,
    punctuationSpace = 0x2008,
    thinSpace = 0x2009,
    hairSpace = 0x200A,
    zeroWidthSpace = 0x200B,
    narrowNoBreakSpace = 0x202F,
    ideographicSpace = 0x3000,
    mathematicalSpace = 0x205F,
    ogham = 0x1680,

    _ = 0x5F,
    $ = 0x24,

    _0 = 0x30,
    _1 = 0x31,
    _2 = 0x32,
    _3 = 0x33,
    _4 = 0x34,
    _5 = 0x35,
    _6 = 0x36,
    _7 = 0x37,
    _8 = 0x38,
    _9 = 0x39,

    a = 0x61,
    b = 0x62,
    c = 0x63,
    d = 0x64,
    e = 0x65,
    f = 0x66,
    g = 0x67,
    h = 0x68,
    i = 0x69,
    j = 0x6A,
    k = 0x6B,
    l = 0x6C,
    m = 0x6D,
    n = 0x6E,
    o = 0x6F,
    p = 0x70,
    q = 0x71,
    r = 0x72,
    s = 0x73,
    t = 0x74,
    u = 0x75,
    v = 0x76,
    w = 0x77,
    x = 0x78,
    y = 0x79,
    z = 0x7A,

    A = 0x41,
    B = 0x42,
    C = 0x43,
    D = 0x44,
    E = 0x45,
    F = 0x46,
    G = 0x47,
    H = 0x48,
    I = 0x49,
    J = 0x4A,
    K = 0x4B,
    L = 0x4C,
    M = 0x4D,
    N = 0x4E,
    O = 0x4F,
    P = 0x50,
    Q = 0x51,
    R = 0x52,
    S = 0x53,
    T = 0x54,
    U = 0x55,
    V = 0x56,
    W = 0x57,
    X = 0x58,
    Y = 0x59,
    Z = 0x5a,

    ampersand = 0x26,             // &
    asterisk = 0x2A,              // *
    at = 0x40,                    // @
    backslash = 0x5C,             // \
    backtick = 0x60,              // `
    bar = 0x7C,                   // |
    caret = 0x5E,                 // ^
    closeBrace = 0x7D,            // }
    closeBracket = 0x5D,          // ]
    closeParen = 0x29,            // )
    colon = 0x3A,                 // :
    comma = 0x2C,                 // ,
    dot = 0x2E,                   // .
    doubleQuote = 0x22,           // "
    equals = 0x3D,                // =
    exclamation = 0x21,           // !
    greaterThan = 0x3E,           // >
    hash = 0x23,                  // #
    lessThan = 0x3C,              // <
    minus = 0x2D,                 // -
    openBrace = 0x7B,             // {
    openBracket = 0x5B,           // [
    openParen = 0x28,             // (
    percent = 0x25,               // %
    plus = 0x2B,                  // +
    question = 0x3F,              // ?
    semicolon = 0x3B,             // ;
    singleQuote = 0x27,           // '
    slash = 0x2F,                 // /
    tilde = 0x7E,                 // ~

    backspace = 0x08,             // \b
    formFeed = 0x0C,              // \f
    byteOrderMark = 0xFEFF,
    tab = 0x09,                   // \t
    verticalTab = 0x0B,           // \v
}

/**
 * Represents the result of module resolution.
 */
export interface ResolvedModule {
    /** Path of the file the module was resolved to. */
    resolvedFileName: string;
    /** True if `resolvedFileName` comes from `node_modules`. */
    isExternalLibraryImport?: boolean;
}

export interface ResolvedModuleFull extends ResolvedModule {
    /**
     * Extension of resolvedFileName. This must match what's at the end of resolvedFileName.
     * This is optional for backwards-compatibility, but will be added if not provided.
     */
    extension: Extension;
    packageId?: PackageId;
}

export interface ResolvedModuleWithFailedLookupLocations {
    readonly resolvedModule: ResolvedModuleFull | undefined;
    /* @internal */
    readonly failedLookupLocations: ReadonlyArray<string>;
}

/**
 * Unique identifier with a package name and version.
 * If changing this, remember to change `packageIdIsEqual`.
 */
export interface PackageId {
    /**
     * Name of the package.
     * Should not include `@types`.
     * If accessing a non-index file, this should include its name e.g. "foo/bar".
     */
    name: string;
    /**
     * Name of a submodule within this package.
     * May be "".
     */
    subModuleName: string;
    /** Version of the package, e.g. "1.2.3" */
    version: string;
}

export interface TextRange {
    pos: number;
    end: number;
}

export interface FileReference extends TextRange {
    fileName: string;
}

export const enum LanguageVersion {
    Solidity_0_4,
    Solidity_0_5,
}
