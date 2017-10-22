import * as url from "url";

import { Observable } from "@reactivex/rxjs";

/**
 * Converts a uri to an absolute path.
 * The OS style is determined by the URI. E.g. `file:///c:/foo` always results in `c:\foo`
 *
 * @param uri a file:// uri
 */
export function uri2path(uri: string): string {
    const parts = url.parse(uri);
    if (parts.protocol !== "file:") {
        throw new Error("Cannot resolve non-file uri to path: " + uri);
    }

    let filePath = parts.pathname || "";

    // If the path starts with a drive letter, return a Windows path
    if (/^\/[a-z]:\//i.test(filePath)) {
        filePath = filePath.substr(1).replace(/\//g, "\\");
    }

    return decodeURIComponent(filePath);
}

/**
 * Converts an abolute path to a file:// uri
 *
 * @param path an absolute path
 */
export function path2uri(path: string): string {
    // Require a leading slash, on windows prefixed with drive letter
    if (!/^(?:[a-z]:)?[\\\/]/i.test(path)) {
        throw new Error(`${path} is not an absolute path`);
    }

    const parts = path.split(/[\\\/]/);

    // If the first segment is a Windows drive letter, prefix with a slash and skip encoding
    let head = parts.shift()!;
    if (head !== "") {
        head = "/" + head;
    } else {
        head = encodeURIComponent(head);
    }

    return `file://${head}/${parts.map(encodeURIComponent).join("/")}`;
}

/**
 * Normalizes URI encoding by encoding _all_ special characters in the pathname
 */
export function normalizeUri(uri: string): string {
    const parts = url.parse(uri);
    if (!parts.pathname) {
        return uri;
    }
    const pathParts = parts.pathname.split("/").map(segment => encodeURIComponent(decodeURIComponent(segment)));
    // Decode Windows drive letter colon
    if (/^[a-z]%3A$/i.test(pathParts[1])) {
        pathParts[1] = decodeURIComponent(pathParts[1]);
    }
    parts.pathname = pathParts.join("/");
    return url.format(parts);
}


/**
 * Converts an Iterable to an Observable.
 * Workaround for https://github.com/ReactiveX/rxjs/issues/2306
 */
export function observableFromIterable<T>(iterable: Iterable<T>): Observable<T> {
    return Observable.from(iterable as any);
}


/**
 * Normalizes path to match POSIX standard (slashes)
 * This conversion should only be necessary to convert windows paths when calling TS APIs.
 */
export function toUnixPath(filePath: string): string {
    return filePath.replace(/\\/g, "/");
}
