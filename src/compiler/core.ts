import { Diagnostic } from "vscode-languageserver";

import { CharacterCodes, Extension, Map, Path } from "./types";

const enum Comparison {
    LessThan = -1,
    EqualTo = 0,
    GreaterThan = 1,
}

const reservedCharacterPattern = /[^\w\s\/]/g;

export function toPath(fileName: string, basePath: string, getCanonicalFileName: (path: string) => string): Path {
    const nonCanonicalizedPath = isRootedDiskPath(fileName)
        ? normalizePath(fileName)
        : getNormalizedAbsolutePath(fileName, basePath);
    return <Path>getCanonicalFileName(nonCanonicalizedPath);
}

export function getNormalizedAbsolutePath(fileName: string, currentDirectory: string) {
    return getNormalizedPathFromPathComponents(getNormalizedPathComponents(fileName, currentDirectory));
}

export function getNormalizedPathFromPathComponents(pathComponents: ReadonlyArray<string>) {
    if (pathComponents && pathComponents.length) {
        return pathComponents[0] + pathComponents.slice(1).join(directorySeparator);
    }
}

export function getDirectoryPath(path: Path): Path;
export function getDirectoryPath(path: string): string;
export function getDirectoryPath(path: string): string {
    return path.substr(0, Math.max(getRootLength(path), path.lastIndexOf(directorySeparator)));
}

/**
 * Returns length of path root (i.e. length of "/", "x:/", "//server/share/, file:///user/files")
 */
export function getRootLength(path: string): number {
    if (path.charCodeAt(0) === CharacterCodes.slash) {
        if (path.charCodeAt(1) !== CharacterCodes.slash) return 1;
        const p1 = path.indexOf("/", 2);
        if (p1 < 0) return 2;
        const p2 = path.indexOf("/", p1 + 1);
        if (p2 < 0) return p1 + 1;
        return p2 + 1;
    }
    if (path.charCodeAt(1) === CharacterCodes.colon) {
        if (path.charCodeAt(2) === CharacterCodes.slash) return 3;
        return 2;
    }
    // Per RFC 1738 'file' URI schema has the shape file://<host>/<path>
    // if <host> is omitted then it is assumed that host value is 'localhost',
    // however slash after the omitted <host> is not removed.
    // file:///folder1/file1 - this is a correct URI
    // file://folder2/file2 - this is an incorrect URI
    if (path.lastIndexOf("file:///", 0) === 0) {
        return "file:///".length;
    }
    const idx = path.indexOf("://");
    if (idx !== -1) {
        return idx + "://".length;
    }
    return 0;
}

/**
 * Gets the actual offset into an array for a relative offset. Negative offsets indicate a
 * position offset from the end of the array.
 */
function toOffset(array: ReadonlyArray<any>, offset: number) {
    return offset < 0 ? array.length + offset : offset;
}

/**
 * Appends a range of value to an array, returning the array.
 *
 * @param to The array to which `value` is to be appended. If `to` is `undefined`, a new array
 * is created if `value` was appended.
 * @param from The values to append to the array. If `from` is `undefined`, nothing is
 * appended. If an element of `from` is `undefined`, that element is not appended.
 * @param start The offset in `from` at which to start copying values.
 * @param end The offset in `from` at which to stop copying values (non-inclusive).
 */
export function addRange<T>(to: T[] | undefined, from: ReadonlyArray<T> | undefined, start?: number, end?: number): T[] | undefined {
    if (from === undefined || from.length === 0) return to;
    if (to === undefined) return from.slice(start, end);
    start = start === undefined ? 0 : toOffset(from, start);
    end = end === undefined ? from.length : toOffset(from, end);
    for (let i = start; i < end && i < from.length; i++) {
        const v = from[i];
        if (v !== undefined) {
            to.push(from[i]);
        }
    }
    return to;
}

/**
 * Returns the element at a specific offset in an array if non-empty, `undefined` otherwise.
 * A negative offset indicates the element should be retrieved from the end of the array.
 */
export function elementAt<T>(array: ReadonlyArray<T> | undefined, offset: number): T | undefined {
    if (array) {
        offset = toOffset(array, offset);
        if (offset < array.length) {
            return array[offset];
        }
    }
    return undefined;
}

/**
 * Returns the first element of an array if non-empty, `undefined` otherwise.
 */
export function firstOrUndefined<T>(array: ReadonlyArray<T>): T | undefined {
    return elementAt(array, 0);
}

/**
 * Returns the last element of an array if non-empty, `undefined` otherwise.
 */
export function lastOrUndefined<T>(array: ReadonlyArray<T>): T | undefined {
    return elementAt(array, -1);
}

export type Comparer<T> = (a: T, b: T) => Comparison;

/**
 * Performs a binary search, finding the index at which 'value' occurs in 'array'.
 * If no such index is found, returns the 2's-complement of first index at which
 * number[index] exceeds number.
 * @param array A sorted array whose first element must be no larger than number
 * @param number The value to be searched for in the array.
 */
export function binarySearch<T>(array: ReadonlyArray<T>, value: T, comparer?: Comparer<T>, offset?: number): number {
    if (!array || array.length === 0) {
        return -1;
    }

    let low = offset || 0;
    let high = array.length - 1;
    comparer = comparer !== undefined
        ? comparer
        : (v1, v2) => (v1 < v2 ? -1 : (v1 > v2 ? 1 : 0));

    while (low <= high) {
        const middle = low + ((high - low) >> 1);
        const midValue = array[middle];

        if (comparer(midValue, value) === 0) {
            return middle;
        }
        else if (comparer(midValue, value) > 0) {
            high = middle - 1;
        }
        else {
            low = middle + 1;
        }
    }

    return ~low;
}

/**
 * Iterates through `array` by index and performs the callback on each element of array until the callback
 * returns a falsey value, then returns false.
 * If no such value is found, the callback is applied to each element of array and `true` is returned.
 */
export function every<T>(array: ReadonlyArray<T>, callback: (element: T, index: number) => boolean): boolean {
    if (array) {
        for (let i = 0; i < array.length; i++) {
            if (!callback(array[i], i)) {
                return false;
            }
        }
    }

    return true;
}

export function some<T>(array: ReadonlyArray<T>, predicate?: (value: T) => boolean): boolean {
    if (array) {
        if (predicate) {
            for (const v of array) {
                if (predicate(v)) {
                    return true;
                }
            }
        }
        else {
            return array.length > 0;
        }
    }
    return false;
}

export interface MultiMap<T> extends Map<T[]> {
    /**
     * Adds the value to an array of values associated with the key, and returns the array.
     * Creates the array if it does not already exist.
     */
    add(key: string, value: T): T[];
    /**
     * Removes a value from an array of values associated with the key.
     * Does not preserve the order of those values.
     * Does nothing if `key` is not in `map`, or `value` is not in `map[key]`.
     */
    remove(key: string, value: T): void;
}

export function createMultiMap<T>(): MultiMap<T> {
    const map = createMap<T[]>() as MultiMap<T>;
    map.add = multiMapAdd;
    map.remove = multiMapRemove;
    return map;
}
function multiMapAdd<T>(this: MultiMap<T>, key: string, value: T) {
    let values = this.get(key);
    if (values) {
        values.push(value);
    }
    else {
        this.set(key, values = [value]);
    }
    return values;

}
function multiMapRemove<T>(this: MultiMap<T>, key: string, value: T) {
    const values = this.get(key);
    if (values) {
        unorderedRemoveItem(values, value);
        if (!values.length) {
            this.delete(key);
        }
    }
}

/** Remove the *first* occurrence of `item` from the array. */
export function unorderedRemoveItem<T>(array: T[], item: T): void {
    unorderedRemoveFirstItemWhere(array, element => element === item);
}

/** Remove the *first* element satisfying `predicate`. */
function unorderedRemoveFirstItemWhere<T>(array: T[], predicate: (element: T) => boolean): void {
    for (let i = 0; i < array.length; i++) {
        if (predicate(array[i])) {
            unorderedRemoveItemAt(array, i);
            break;
        }
    }
}

export function unorderedRemoveItemAt<T>(array: T[], index: number): void {
    // Fill in the "hole" left at `index`.
    array[index] = array[array.length - 1];
    array.pop();
}

/**
 * Internally, we represent paths as strings with '/' as the directory separator.
 * When we make system calls (eg: LanguageServiceHost.getDirectory()),
 * we expect the host to correctly handle paths in our specified format.
 */
export const directorySeparator = "/";
const directorySeparatorCharCode = CharacterCodes.slash;

export function normalizeSlashes(path: string): string {
    return path.replace(/\\/g, "/");
}

function getNormalizedParts(normalizedSlashedPath: string, rootLength: number): string[] {
    const parts = normalizedSlashedPath.substr(rootLength).split(directorySeparator);
    const normalized: string[] = [];
    for (const part of parts) {
        if (part !== ".") {
            if (part === ".." && normalized.length > 0 && lastOrUndefined(normalized) !== "..") {
                normalized.pop();
            }
            else {
                // A part may be an empty string (which is 'falsy') if the path had consecutive slashes,
                // e.g. "path//file.ts".  Drop these before re-joining the parts.
                if (part) {
                    normalized.push(part);
                }
            }
        }
    }

    return normalized;
}

/** A path ending with '/' refers to a directory only, never a file. */
export function pathEndsWithDirectorySeparator(path: string): boolean {
    return path.charCodeAt(path.length - 1) === directorySeparatorCharCode;
}

export function normalizePath(path: string): string {
    path = normalizeSlashes(path);
    const rootLength = getRootLength(path);
    const root = path.substr(0, rootLength);
    const normalized = getNormalizedParts(path, rootLength);
    if (normalized.length) {
        const joinedParts = root + normalized.join(directorySeparator);
        return pathEndsWithDirectorySeparator(path) ? joinedParts + directorySeparator : joinedParts;
    }
    else {
        return root;
    }
}

export function normalizePathAndParts(path: string): { path: string, parts: string[] } {
    path = normalizeSlashes(path);
    const rootLength = getRootLength(path);
    const root = path.substr(0, rootLength);
    const parts = getNormalizedParts(path, rootLength);
    if (parts.length) {
        const joinedParts = root + parts.join(directorySeparator);
        return { path: pathEndsWithDirectorySeparator(path) ? joinedParts + directorySeparator : joinedParts, parts };
    }
    else {
        return { path: root, parts };
    }
}

export function combinePaths(path1: string, path2: string) {
    if (!(path1 && path1.length)) return path2;
    if (!(path2 && path2.length)) return path1;
    if (getRootLength(path2) !== 0) return path2;
    if (path1.charAt(path1.length - 1) === directorySeparator) return path1 + path2;
    return path1 + directorySeparator + path2;
}

export function pathIsRelative(path: string): boolean {
    return /^\.\.?($|[\\/])/.test(path);
}

export function isExternalModuleNameRelative(moduleName: string): boolean {
    // TypeScript 1.0 spec (April 2014): 11.2.1
    // An external module name is "relative" if the first term is "." or "..".
    // Update: We also consider a path like `C:\foo.ts` "relative" because we do not search for it in `node_modules` or treat it as an ambient module.
    return pathIsRelative(moduleName) || isRootedDiskPath(moduleName);
}

export function isRootedDiskPath(path: string) {
    return getRootLength(path) !== 0;
}

export interface FileSystemEntries {
    files: string[];
    directories: string[];
}

/** Works like Array.prototype.findIndex, returning `-1` if no element satisfying the predicate is found. */
export function findIndex<T>(array: ReadonlyArray<T>, predicate: (element: T, index: number) => boolean): number {
    for (let i = 0; i < array.length; i++) {
        if (predicate(array[i], i)) {
            return i;
        }
    }
    return -1;
}

/**
 * Flattens an array containing a mix of array or non-array elements.
 *
 * @param array The array to flatten.
 */
export function flatten<T>(array: ReadonlyArray<T | ReadonlyArray<T>>): T[] {
    let result: T[];
    if (array) {
        result = [];
        for (const v of array) {
            if (v) {
                if (isArray(v)) {
                    addRange(result, v);
                }
                else {
                    result.push(v);
                }
            }
        }
    }

    return result;
}

export function matchFiles(path: string, extensions: ReadonlyArray<string>, excludes: ReadonlyArray<string>, includes: ReadonlyArray<string>, useCaseSensitiveFileNames: boolean, currentDirectory: string, depth: number | undefined, getFileSystemEntries: (path: string) => FileSystemEntries): string[] {
    path = normalizePath(path);
    currentDirectory = normalizePath(currentDirectory);

    const patterns = getFileMatcherPatterns(path, excludes, includes, useCaseSensitiveFileNames, currentDirectory);

    const regexFlag = useCaseSensitiveFileNames ? "" : "i";
    const includeFileRegexes = patterns.includeFilePatterns && patterns.includeFilePatterns.map(pattern => new RegExp(pattern, regexFlag));
    const includeDirectoryRegex = patterns.includeDirectoryPattern && new RegExp(patterns.includeDirectoryPattern, regexFlag);
    const excludeRegex = patterns.excludePattern && new RegExp(patterns.excludePattern, regexFlag);

    // Associate an array of results with each include regex. This keeps results in order of the "include" order.
    // If there are no "includes", then just put everything in results[0].
    const results: string[][] = includeFileRegexes ? includeFileRegexes.map(() => []) : [[]];

    const comparer = useCaseSensitiveFileNames ? compareStrings : compareStringsCaseInsensitive;
    for (const basePath of patterns.basePaths) {
        visitDirectory(basePath, combinePaths(currentDirectory, basePath), depth);
    }

    return flatten<string>(results);

    function visitDirectory(path: string, absolutePath: string, depth: number | undefined) {
        let { files, directories } = getFileSystemEntries(path);
        files = files.slice().sort(comparer);

        for (const current of files) {
            const name = combinePaths(path, current);
            const absoluteName = combinePaths(absolutePath, current);
            if (extensions && !fileExtensionIsOneOf(name, extensions)) continue;
            if (excludeRegex && excludeRegex.test(absoluteName)) continue;
            if (!includeFileRegexes) {
                results[0].push(name);
            }
            else {
                const includeIndex = findIndex(includeFileRegexes, re => re.test(absoluteName));
                if (includeIndex !== -1) {
                    results[includeIndex].push(name);
                }
            }
        }

        if (depth !== undefined) {
            depth--;
            if (depth === 0) {
                return;
            }
        }

        directories = directories.slice().sort(comparer);
        for (const current of directories) {
            const name = combinePaths(path, current);
            const absoluteName = combinePaths(absolutePath, current);
            if ((!includeDirectoryRegex || includeDirectoryRegex.test(absoluteName)) &&
                (!excludeRegex || !excludeRegex.test(absoluteName))) {
                visitDirectory(name, absoluteName, depth);
            }
        }
    }
}

export function contains<T>(array: ReadonlyArray<T>, value: T): boolean {
    if (array) {
        for (const v of array) {
            if (v === value) {
                return true;
            }
        }
    }
    return false;
}

export function indexOfAnyCharCode(text: string, charCodes: ReadonlyArray<number>, start?: number): number {
    for (let i = start || 0; i < text.length; i++) {
        if (contains(charCodes, text.charCodeAt(i))) {
            return i;
        }
    }
    return -1;
}


/**
 * Removes a trailing directory separator from a path.
 * @param path The path.
 */
export function removeTrailingDirectorySeparator(path: Path): Path;
export function removeTrailingDirectorySeparator(path: string): string;
export function removeTrailingDirectorySeparator(path: string) {
    if (path.charAt(path.length - 1) === directorySeparator) {
        return path.substr(0, path.length - 1);
    }

    return path;
}

export function compareValues<T>(a: T, b: T): Comparison {
    if (a === b) return Comparison.EqualTo;
    if (a === undefined) return Comparison.LessThan;
    if (b === undefined) return Comparison.GreaterThan;
    return a < b ? Comparison.LessThan : Comparison.GreaterThan;
}

function compareStrings(a: string, b: string, ignoreCase?: boolean): Comparison {
    if (a === b) return Comparison.EqualTo;
    if (a === undefined) return Comparison.LessThan;
    if (b === undefined) return Comparison.GreaterThan;
    if (ignoreCase) {
        if (String.prototype.localeCompare) {
            const result = a.localeCompare(b, /*locales*/ undefined, { usage: "sort", sensitivity: "accent" });
            return result < 0 ? Comparison.LessThan : result > 0 ? Comparison.GreaterThan : Comparison.EqualTo;
        }

        a = a.toUpperCase();
        b = b.toUpperCase();
        if (a === b) return Comparison.EqualTo;
    }

    return a < b ? Comparison.LessThan : Comparison.GreaterThan;
}

function compareStringsCaseInsensitive(a: string, b: string) {
    return compareStrings(a, b, /*ignoreCase*/ true);
}

const wildcardCharCodes = [CharacterCodes.asterisk, CharacterCodes.question];

function getIncludeBasePath(absolute: string): string {
    const wildcardOffset = indexOfAnyCharCode(absolute, wildcardCharCodes);
    if (wildcardOffset < 0) {
        // No "*" or "?" in the path
        return !hasExtension(absolute)
            ? absolute
            : removeTrailingDirectorySeparator(getDirectoryPath(absolute));
    }
    return absolute.substring(0, absolute.lastIndexOf(directorySeparator, wildcardOffset));
}

/**
 * Computes the unique non-wildcard base paths amongst the provided include patterns.
 */
function getBasePaths(path: string, includes: ReadonlyArray<string>, useCaseSensitiveFileNames: boolean) {
    // Storage for our results in the form of literal paths (e.g. the paths as written by the user).
    const basePaths: string[] = [path];

    if (includes) {
        // Storage for literal base paths amongst the include patterns.
        const includeBasePaths: string[] = [];
        for (const include of includes) {
            // We also need to check the relative paths by converting them to absolute and normalizing
            // in case they escape the base path (e.g "..\somedirectory")
            const absolute: string = isRootedDiskPath(include) ? include : normalizePath(combinePaths(path, include));
            // Append the literal and canonical candidate base paths.
            includeBasePaths.push(getIncludeBasePath(absolute));
        }

        // Sort the offsets array using either the literal or canonical path representations.
        includeBasePaths.sort(useCaseSensitiveFileNames ? compareStrings : compareStringsCaseInsensitive);

        // Iterate over each include base path and include unique base paths that are not a
        // subpath of an existing base path
        for (const includeBasePath of includeBasePaths) {
            if (every(basePaths, basePath => !containsPath(basePath, includeBasePath, path, !useCaseSensitiveFileNames))) {
                basePaths.push(includeBasePath);
            }
        }
    }

    return basePaths;
}

function containsPath(parent: string, child: string, currentDirectory: string, ignoreCase?: boolean) {
    if (parent === undefined || child === undefined) return false;
    if (parent === child) return true;
    parent = removeTrailingDirectorySeparator(parent);
    child = removeTrailingDirectorySeparator(child);
    if (parent === child) return true;
    const parentComponents = getNormalizedPathComponents(parent, currentDirectory);
    const childComponents = getNormalizedPathComponents(child, currentDirectory);
    if (childComponents.length < parentComponents.length) {
        return false;
    }

    for (let i = 0; i < parentComponents.length; i++) {
        const result = compareStrings(parentComponents[i], childComponents[i], ignoreCase);
        if (result !== Comparison.EqualTo) {
            return false;
        }
    }

    return true;
}

interface WildcardMatcher {
    singleAsteriskRegexFragment: string;
    doubleAsteriskRegexFragment: string;
    replaceWildcardCharacter: (match: string) => string;
}

export const commonPackageFolders: ReadonlyArray<string> = ["node_modules", "bower_components", "jspm_packages"];

const implicitExcludePathRegexPattern = `(?!(${commonPackageFolders.join("|")})(/|$))`;

const filesMatcher: WildcardMatcher = {
    /**
     * Matches any single directory segment unless it is the last segment and a .min.js file
     * Breakdown:
     *  [^./]                   # matches everything up to the first . character (excluding directory seperators)
     *  (\\.(?!min\\.js$))?     # matches . characters but not if they are part of the .min.js file extension
     */
    singleAsteriskRegexFragment: "([^./]|(\\.(?!min\\.js$))?)*",
    /**
     * Regex for the ** wildcard. Matches any number of subdirectories. When used for including
     * files or directories, does not match subdirectories that start with a . character
     */
    doubleAsteriskRegexFragment: `(/${implicitExcludePathRegexPattern}[^/.][^/]*)*?`,
    replaceWildcardCharacter: match => replaceWildcardCharacter(match, filesMatcher.singleAsteriskRegexFragment)
};

const directoriesMatcher: WildcardMatcher = {
    singleAsteriskRegexFragment: "[^/]*",
    /**
     * Regex for the ** wildcard. Matches any number of subdirectories. When used for including
     * files or directories, does not match subdirectories that start with a . character
     */
    doubleAsteriskRegexFragment: `(/${implicitExcludePathRegexPattern}[^/.][^/]*)*?`,
    replaceWildcardCharacter: match => replaceWildcardCharacter(match, directoriesMatcher.singleAsteriskRegexFragment)
};

const excludeMatcher: WildcardMatcher = {
    singleAsteriskRegexFragment: "[^/]*",
    doubleAsteriskRegexFragment: "(/.+?)?",
    replaceWildcardCharacter: match => replaceWildcardCharacter(match, excludeMatcher.singleAsteriskRegexFragment)
};

const wildcardMatchers = {
    files: filesMatcher,
    directories: directoriesMatcher,
    exclude: excludeMatcher
};

function getRegularExpressionsForWildcards(specs: ReadonlyArray<string>, basePath: string, usage: "files" | "directories" | "exclude"): string[] | undefined {
    if (specs === undefined || specs.length === 0) {
        return undefined;
    }

    return flatMap(specs, spec =>
        spec && getSubPatternFromSpec(spec, basePath, usage, wildcardMatchers[usage]));
}

/**
 * An "includes" path "foo" is implicitly a glob "foo/** /*" (without the space) if its last component has no extension,
 * and does not contain any glob characters itself.
 */
export function isImplicitGlob(lastPathComponent: string): boolean {
    return !/[.*?]/.test(lastPathComponent);
}

function getSubPatternFromSpec(spec: string, basePath: string, usage: "files" | "directories" | "exclude", { singleAsteriskRegexFragment, doubleAsteriskRegexFragment, replaceWildcardCharacter }: WildcardMatcher): string | undefined {
    let subpattern = "";
    let hasRecursiveDirectoryWildcard = false;
    let hasWrittenComponent = false;
    const components = getNormalizedPathComponents(spec, basePath);
    const lastComponent = lastOrUndefined(components);
    if (usage !== "exclude" && lastComponent === "**") {
        return undefined;
    }

    // getNormalizedPathComponents includes the separator for the root component.
    // We need to remove to create our regex correctly.
    components[0] = removeTrailingDirectorySeparator(components[0]);

    if (isImplicitGlob(lastComponent)) {
        components.push("**", "*");
    }

    let optionalCount = 0;
    for (let component of components) {
        if (component === "**") {
            if (hasRecursiveDirectoryWildcard) {
                return undefined;
            }

            subpattern += doubleAsteriskRegexFragment;
            hasRecursiveDirectoryWildcard = true;
        }
        else {
            if (usage === "directories") {
                subpattern += "(";
                optionalCount++;
            }

            if (hasWrittenComponent) {
                subpattern += directorySeparator;
            }

            if (usage !== "exclude") {
                let componentPattern = "";
                // The * and ? wildcards should not match directories or files that start with . if they
                // appear first in a component. Dotted directories and files can be included explicitly
                // like so: **/.*/.*
                if (component.charCodeAt(0) === CharacterCodes.asterisk) {
                    componentPattern += "([^./]" + singleAsteriskRegexFragment + ")?";
                    component = component.substr(1);
                }
                else if (component.charCodeAt(0) === CharacterCodes.question) {
                    componentPattern += "[^./]";
                    component = component.substr(1);
                }

                componentPattern += component.replace(reservedCharacterPattern, replaceWildcardCharacter);

                // Patterns should not include subfolders like node_modules unless they are
                // explicitly included as part of the path.
                //
                // As an optimization, if the component pattern is the same as the component,
                // then there definitely were no wildcard characters and we do not need to
                // add the exclusion pattern.
                if (componentPattern !== component) {
                    subpattern += implicitExcludePathRegexPattern;
                }

                subpattern += componentPattern;
            }
            else {
                subpattern += component.replace(reservedCharacterPattern, replaceWildcardCharacter);
            }
        }

        hasWrittenComponent = true;
    }

    while (optionalCount > 0) {
        subpattern += ")?";
        optionalCount--;
    }

    return subpattern;
}

export interface FileMatcherPatterns {
    /** One pattern for each "include" spec. */
    includeFilePatterns: ReadonlyArray<string>;
    /** One pattern matching one of any of the "include" specs. */
    includeFilePattern: string;
    includeDirectoryPattern: string;
    excludePattern: string;
    basePaths: ReadonlyArray<string>;
}


export function getFileMatcherPatterns(path: string, excludes: ReadonlyArray<string>, includes: ReadonlyArray<string>, useCaseSensitiveFileNames: boolean, currentDirectory: string): FileMatcherPatterns {
    path = normalizePath(path);
    currentDirectory = normalizePath(currentDirectory);
    const absolutePath = combinePaths(currentDirectory, path);

    return {
        includeFilePatterns: map(getRegularExpressionsForWildcards(includes, absolutePath, "files"), pattern => `^${pattern}$`),
        includeFilePattern: getRegularExpressionForWildcard(includes, absolutePath, "files"),
        includeDirectoryPattern: getRegularExpressionForWildcard(includes, absolutePath, "directories"),
        excludePattern: getRegularExpressionForWildcard(excludes, absolutePath, "exclude"),
        basePaths: getBasePaths(path, includes, useCaseSensitiveFileNames)
    };
}

function replaceWildcardCharacter(match: string, singleAsteriskRegexFragment: string) {
    return match === "*" ? singleAsteriskRegexFragment : match === "?" ? "[^/]" : "\\" + match;
}

export function getRegularExpressionForWildcard(specs: ReadonlyArray<string>, basePath: string, usage: "files" | "directories" | "exclude"): string | undefined {
    const patterns = getRegularExpressionsForWildcards(specs, basePath, usage);
    if (!patterns || !patterns.length) {
        return undefined;
    }

    const pattern = patterns.map(pattern => `(${pattern})`).join("|");
    // If excluding, match "foo/bar/baz...", but if including, only allow "foo".
    const terminator = usage === "exclude" ? "($|/)" : "$";
    return `^(${pattern})${terminator}`;
}

function getNormalizedPathComponents(path: string, currentDirectory: string) {
    path = normalizeSlashes(path);
    let rootLength = getRootLength(path);
    if (rootLength === 0) {
        // If the path is not rooted it is relative to current directory
        path = combinePaths(normalizeSlashes(currentDirectory), path);
        rootLength = getRootLength(path);
    }

    return normalizedPathComponents(path, rootLength);
}

function normalizedPathComponents(path: string, rootLength: number) {
    const normalizedParts = getNormalizedParts(path, rootLength);
    return [path.substr(0, rootLength)].concat(normalizedParts);
}

function endsWith(str: string, suffix: string): boolean {
    const expectedPos = str.length - suffix.length;
    return expectedPos >= 0 && str.indexOf(suffix, expectedPos) === expectedPos;
}

function fileExtensionIs(path: string, extension: string): boolean {
    return path.length > extension.length && endsWith(path, extension);
}

const solidityPattern = /\.sol$/;

export function isSolidityFile(filename: string): boolean {
    return solidityPattern.test(filename);
}

const packageJsonPattern = /(^|\/)package\.json$/;

export function isPackageJsonFile(filename: string): boolean {
    return packageJsonPattern.test(filename);
}

const ethPmJsonPattern = /(^|\/)ethpm\.json$/;

export function isEthPmJsonFile(filename: string): boolean {
    return ethPmJsonPattern.test(filename);
}

// The global Map object. This may not be available, so we must test for it.
declare const Map: { new <T>(): Map<T> } | undefined;

/**
 * Type of objects whose values are all of the same type.
 * The `in` and `for-in` operators can *not* be safely used,
 * since `Object.prototype` may be modified by outside code.
 */
export interface MapLike<T> {
    [index: string]: T;
}

/** Create a new map. If a template object is provided, the map will copy entries from it. */
export function createMap<T>(): Map<T> {
    return new Map<T>();
}

const hasOwnProperty = Object.prototype.hasOwnProperty;

export function createMapFromTemplate<T>(template?: MapLike<T>): Map<T> {
    const map: Map<T> = new Map<T>();

    // Copies keys/values from template. Note that for..in will not throw if
    // template is undefined, and instead will just exit the loop.
    for (const key in template) {
        if (hasOwnProperty.call(template, key)) {
            map.set(key, template[key]);
        }
    }

    return map;
}

/**
 * Iterates through 'array' by index and performs the callback on each element of array until the callback
 * returns a truthy value, then returns that value.
 * If no such value is found, the callback is applied to each element of array and undefined is returned.
 */
export function forEach<T, U>(array: ReadonlyArray<T> | undefined, callback: (element: T, index: number) => U | undefined): U | undefined {
    if (array) {
        for (let i = 0; i < array.length; i++) {
            const result = callback(array[i], i);
            if (result) {
                return result;
            }
        }
    }
    return undefined;
}

export function getBaseFileName(path: string) {
    if (path === undefined) {
        return undefined;
    }
    const i = path.lastIndexOf(directorySeparator);
    return i < 0 ? path : path.substring(i + 1);
}

export function hasExtension(fileName: string): boolean {
    return getBaseFileName(fileName).indexOf(".") >= 0;
}

export function fileExtensionIsOneOf(path: string, extensions: ReadonlyArray<string>): boolean {
    for (const extension of extensions) {
        if (fileExtensionIs(path, extension)) {
            return true;
        }
    }

    return false;
}

const extensionsToRemove = [Extension.Sol];
export function removeFileExtension(path: string): string {
    for (const ext of extensionsToRemove) {
        const extensionless = tryRemoveExtension(path, ext);
        if (extensionless !== undefined) {
            return extensionless;
        }
    }
    return path;
}

export function tryRemoveExtension(path: string, extension: string): string | undefined {
    return fileExtensionIs(path, extension) ? removeExtension(path, extension) : undefined;
}

export function removeExtension(path: string, extension: string): string {
    return path.substring(0, path.length - extension.length);
}

/**
 *  List of supported extensions in order of file resolution precedence.
 */
export const supportedSolidityExtensions: ReadonlyArray<Extension> = [Extension.Sol];

export function hasSolidityFileExtension(fileName: string) {
    return forEach(supportedSolidityExtensions, extension => fileExtensionIs(fileName, extension));
}

/**
 * Tests whether a value is an array.
 */
export function isArray(value: any): value is ReadonlyArray<any> {
    return Array.isArray ? Array.isArray(value) : value instanceof Array;
}

/**
 * Tests whether a value is string
 */
export function isString(text: any): text is string {
    return typeof text === "string";
}

export function map<T, U>(array: ReadonlyArray<T>, f: (x: T, i: number) => U): U[] {
    let result: U[];
    if (array) {
        result = [];
        for (let i = 0; i < array.length; i++) {
            result.push(f(array[i], i));
        }
    }
    return result;
}

/**
 * Maps an array. If the mapped value is an array, it is spread into the result.
 *
 * @param array The array to map.
 * @param mapfn The callback used to map the result into one or more values.
 */
export function flatMap<T, U>(array: ReadonlyArray<T> | undefined, mapfn: (x: T, i: number) => U | ReadonlyArray<U> | undefined): U[] | undefined {
    let result: U[];
    if (array) {
        result = [];
        for (let i = 0; i < array.length; i++) {
            const v = mapfn(array[i], i);
            if (v) {
                if (isArray(v)) {
                    addRange(result, v);
                }
                else {
                    result.push(v);
                }
            }
        }
    }
    return result;
}

/**
 * Filters an array by a predicate function. Returns the same array instance if the predicate is
 * true for all elements, otherwise returns a new array instance containing the filtered subset.
 */
export function filter<T, U extends T>(array: T[], f: (x: T) => x is U): U[];
export function filter<T>(array: T[], f: (x: T) => boolean): T[];
export function filter<T, U extends T>(array: ReadonlyArray<T>, f: (x: T) => x is U): ReadonlyArray<U>;
export function filter<T, U extends T>(array: ReadonlyArray<T>, f: (x: T) => boolean): ReadonlyArray<T>;
export function filter<T>(array: T[], f: (x: T) => boolean): T[] {
    if (array) {
        const len = array.length;
        let i = 0;
        while (i < len && f(array[i])) i++;
        if (i < len) {
            const result = array.slice(0, i);
            i++;
            while (i < len) {
                const item = array[i];
                if (f(item)) {
                    result.push(item);
                }
                i++;
            }
            return result;
        }
    }
    return array;
}

export function dropWhile<T>(array: T[], f: (x: T) => boolean): T[] {
    let result: T[];
    let drop = true;
    if (array) {
        result = [];
        for (let i = 0; i < array.length; i++) {
            if (drop && !f(array[i])) {
                drop = false;
            }
            if (!drop) {
                result.push(array[i]);
            }
        }
    }
    return result;
}

/** Shims `Array.from`. */
export function arrayFrom<T, U>(iterator: Iterator<T>, map: (t: T) => U): U[];
export function arrayFrom<T>(iterator: Iterator<T>): T[];
export function arrayFrom(iterator: Iterator<any>, map?: (t: any) => any): any[] {
    const result: any[] = [];
    for (let { value, done } = iterator.next(); !done; { value, done } = iterator.next()) {
        result.push(map ? map(value) : value);
    }
    return result;
}

export function noop(): void { }

/** Do nothing and return false */
export function returnFalse(): false { return false; }

/** Do nothing and return true */
export function returnTrue(): true { return true; }

export function memoize<T>(callback: () => T): () => T {
    let value: T;
    return () => {
        if (callback) {
            value = callback();
            callback = undefined;
        }
        return value;
    };
}

export const enum AssertionLevel {
    None = 0,
    Normal = 1,
    Aggressive = 2,
    VeryAggressive = 3,
}

export namespace Debug {
    export let currentAssertionLevel = AssertionLevel.None;
    export let isDebugging = false;

    export function shouldAssert(level: AssertionLevel): boolean {
        return currentAssertionLevel >= level;
    }

    export function assert(expression: boolean, message?: string, verboseDebugInfo?: string | (() => string), stackCrawlMark?: Function): void {
        if (!expression) {
            if (verboseDebugInfo) {
                message += "\r\nVerbose Debug Information: " + (typeof verboseDebugInfo === "string" ? verboseDebugInfo : verboseDebugInfo());
            }
            fail(message ? "False expression: " + message : "False expression.", stackCrawlMark || assert);
        }
    }

    export function assertEqual<T>(a: T, b: T, msg?: string, msg2?: string): void {
        if (a !== b) {
            const message = msg ? msg2 ? `${msg} ${msg2}` : msg : "";
            fail(`Expected ${a} === ${b}. ${message}`);
        }
    }

    export function assertLessThan(a: number, b: number, msg?: string): void {
        if (a >= b) {
            fail(`Expected ${a} < ${b}. ${msg || ""}`);
        }
    }

    export function assertLessThanOrEqual(a: number, b: number): void {
        if (a > b) {
            fail(`Expected ${a} <= ${b}`);
        }
    }

    export function assertGreaterThanOrEqual(a: number, b: number): void {
        if (a < b) {
            fail(`Expected ${a} >= ${b}`);
        }
    }

    export function fail(message?: string, stackCrawlMark?: Function): never {
        debugger;
        const e = new Error(message ? `Debug Failure. ${message}` : "Debug Failure.");
        if ((<any>Error).captureStackTrace) {
            (<any>Error).captureStackTrace(e, stackCrawlMark || fail);
        }
        throw e;
    }

    export function assertNever(member: never, message?: string, stackCrawlMark?: Function): never {
        return fail(message || `Illegal value: ${member}`, stackCrawlMark || assertNever);
    }

    export function getFunctionName(func: Function) {
        if (typeof func !== "function") {
            return "";
        }
        else if (func.hasOwnProperty("name")) {
            return (<any>func).name;
        }
        else {
            const text = Function.prototype.toString.call(func);
            const match = /^function\s+([\w\$]+)\s*\(/.exec(text);
            return match ? match[1] : "";
        }
    }
}

export function createGetCanonicalFileName(useCaseSensitiveFileNames: boolean): (fileName: string) => string {
    return useCaseSensitiveFileNames
        ? ((fileName) => fileName)
        : ((fileName) => fileName.toLowerCase());
}

export function sortAndDeduplicateDiagnostics(diagnostics: Diagnostic[]): Diagnostic[] {
    return deduplicateSortedDiagnostics(diagnostics.sort(compareDiagnostics));
}

export function deduplicateSortedDiagnostics(diagnostics: Diagnostic[]): Diagnostic[] {
    if (diagnostics.length < 2) {
        return diagnostics;
    }

    const newDiagnostics = [diagnostics[0]];
    let previousDiagnostic = diagnostics[0];
    for (let i = 1; i < diagnostics.length; i++) {
        const currentDiagnostic = diagnostics[i];
        const isDupe = compareDiagnostics(currentDiagnostic, previousDiagnostic) === Comparison.EqualTo;
        if (!isDupe) {
            newDiagnostics.push(currentDiagnostic);
            previousDiagnostic = currentDiagnostic;
        }
    }

    return newDiagnostics;
}

export function compareDiagnostics(d1: Diagnostic, d2: Diagnostic): Comparison {
    return compareValues(d1.range.start, d2.range.start) ||
        compareValues(d1.range.end, d2.range.end) ||
        compareValues(d1.severity, d2.severity) ||
        compareValues(d1.code, d2.code) ||
        compareValues(d1.source, d2.source) ||
        compareStrings(d1.message, d2.message) ||
        Comparison.EqualTo;
}
