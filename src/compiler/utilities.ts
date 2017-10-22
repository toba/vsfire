import { createMap, getDirectoryPath } from "./core";
import { PackageId, ResolvedModuleFull, SourceFile } from "./types";

export const emptyArray: never[] = [] as never[];

export function packageIdIsEqual(a: PackageId | undefined, b: PackageId | undefined): boolean {
    return a === b || a && b && a.name === b.name && a.subModuleName === b.subModuleName && a.version === b.version;
}

/** Calls `callback` on `directory` and every ancestor directory it has, returning the first defined result. */
export function forEachAncestorDirectory<T>(directory: string, callback: (directory: string) => T): T {
    while (true) {
        const result = callback(directory);
        if (result !== undefined) {
            return result;
        }

        const parentPath = getDirectoryPath(directory);
        if (parentPath === directory) {
            return undefined;
        }

        directory = parentPath;
    }
}

export function setResolvedModule(sourceFile: SourceFile, moduleNameText: string, resolvedModule: ResolvedModuleFull): void {
    if (!sourceFile.resolvedModules) {
        sourceFile.resolvedModules = createMap<ResolvedModuleFull>();
    }

    sourceFile.resolvedModules.set(moduleNameText, resolvedModule);
}

export function compareDataObjects(dst: any, src: any): boolean {
    if (!dst || !src || Object.keys(dst).length !== Object.keys(src).length) {
        return false;
    }

    for (const e in dst) {
        if (typeof dst[e] === "object") {
            if (!compareDataObjects(dst[e], src[e])) {
                return false;
            }
        }
        else if (typeof dst[e] !== "function") {
            if (dst[e] !== src[e]) {
                return false;
            }
        }
    }
    return true;
}
