import { EventEmitter } from "events";

import { FileSystemEntries, matchFiles } from "../compiler/core";
import { ModuleResolutionHost } from "../compiler/types";
import { Logger, NoopLogger } from "./logging";
import { path2uri, uri2path } from "./utilities";

/**
 * In-memory file cache node which represents either a folder or a file.
 */
export interface FileSystemNode {
    file: boolean;
    children: Map<string, FileSystemNode>;
}

export class InMemoryFileSystem extends EventEmitter implements ModuleResolutionHost {
    /**
     * Contains a Map of all URIs that exist in the workspace, optionally with a content.
     * File contents for URIs in it do not neccessarily have to be fetched already.
     */
    private files = new Map<string, string | undefined>();

    /**
     * Map (URI -> string content) of temporary files made while user modifies local file(s)
     */
    public overlay: Map<string, string>;

    /**
     * Should we take into account register when performing a file name match or not.
     * On Windows when using local file system, file names are case-insensitive.
     */
    public useCaseSensitiveFileNames: boolean;

    /**
     * Root path
     */
    public path: string;

    /**
     * File tree root
     */
    public rootNode: FileSystemNode;

    constructor(path: string, private logger: Logger = new NoopLogger()) {
        super();
        this.path = path;
        this.overlay = new Map<string, string>();
        this.rootNode = { file: false, children: new Map<string, FileSystemNode>() };
    }

    /**
     * Emitted when a file was added
     */
    public on(event: "add", listener: (uri: string, content?: string) => void): this {
        return super.on(event, listener);
    }

    /**
     * Returns an IterableIterator for all URIs known to exist in the workspace (content loaded or not)
     */
    public uris(): IterableIterator<string> {
        return this.files.keys();
    }

    /**
     * Adds a file to the local cache
     *
     * @param uri The URI of the file
     * @param content The optional content
     */
    public add(uri: string, content?: string): void {
        // Make sure not to override existing content with undefined
        if (content !== undefined || !this.files.has(uri)) {
            this.files.set(uri, content);
        }
        // Add to directory tree
        const filePath = uri2path(uri);
        const components = filePath.split(/[\/\\]/).filter(c => c);
        let node = this.rootNode;
        for (const [i, component] of components.entries()) {
            const n = node.children.get(component);
            if (!n) {
                if (i < components.length - 1) {
                    const n = { file: false, children: new Map<string, FileSystemNode>() };
                    node.children.set(component, n);
                    node = n;
                } else {
                    node.children.set(component, { file: true, children: new Map<string, FileSystemNode>() });
                }
            } else {
                node = n;
            }
        }
        this.emit("add", uri, content);
    }

    /**
     * Returns true if the given file is known to exist in the workspace (content loaded or not)
     *
     * @param uri URI to a file
     */
    public has(uri: string): boolean {
        return this.files.has(uri) || this.fileExists(uri2path(uri));
    }

    /**
     * Returns the file content for the given URI.
     * Will throw an Error if no available in-memory.
     * Use FileSystemUpdater.ensure() to ensure that the file is available.
     */
    public getContent(uri: string): string {
        let content = this.overlay.get(uri);
        if (content === undefined) {
            content = this.files.get(uri);
        }
        if (content === undefined) {
            throw new Error(`Content of ${uri} is not available in memory`);
        }
        return content;
    }

    /**
     * Tells if a file denoted by the given name exists in the workspace (does not have to be loaded)
     *
     * @param path File path or URI (both absolute or relative file paths are accepted)
     */
    public fileExists(path: string): boolean {
        const uri = path2uri(path);
        return this.overlay.has(uri) || this.files.has(uri);
    }

    /**
     * @param path file path (both absolute or relative file paths are accepted)
     * @return file's content in the following order (overlay then cache).
     * If there is no such file, returns empty string to match expected signature
     */
    public readFile(path: string): string {
        const content = this.readFileIfExists(path);
        if (content === undefined) {
            this.logger.warn(`readFile ${path} requested by Solidity but content not available`);
            return "";
        }
        return content;
    }

    /**
     * @param path file path (both absolute or relative file paths are accepted)
     * @return file's content in the following order (overlay then cache).
     * If there is no such file, returns undefined
     */
    private readFileIfExists(path: string): string | undefined {
        const uri = path2uri(path);
        let content = this.overlay.get(uri);
        if (content !== undefined) {
            return content;
        }

        // TODO This assumes that the URI was a file:// URL.
        //      In reality it could be anything, and the first URI matching the path should be used.
        //      With the current Map, the search would be O(n), it would require a tree to get O(log(n))
        content = this.files.get(uri);
        if (content !== undefined) {
            return content;
        }
    }

    /**
     * Invalidates temporary content denoted by the given URI
     * @param uri file's URI
     */
    public didClose(uri: string) {
        this.overlay.delete(uri);
    }

    /**
     * Adds temporary content denoted by the given URI
     * @param uri file's URI
     */
    public didSave(uri: string) {
        const content = this.overlay.get(uri);
        if (content !== undefined) {
            this.add(uri, content);
        }
    }

    /**
     * Updates temporary content denoted by the given URI
     * @param uri file's URI
     */
    public didChange(uri: string, text: string) {
        this.overlay.set(uri, text);
    }

    /**
     * Called by Solidity service to scan virtual directory when Solidity service looks for source files that belong to a project
     */
    public readDirectory(rootDir: string, extensions: string[], excludes: string[], includes: string[]): string[] {
        return matchFiles(rootDir,
            extensions,
            excludes,
            includes,
            true,
            this.path,
            undefined,
            p => this.getFileSystemEntries(p));
    }

    /**
     * Called by Solidity service to scan virtual directory when Solidity service looks for source files that belong to a project
     */
    public getFileSystemEntries(path: string): FileSystemEntries {
        const ret: { files: string[], directories: string[] } = { files: [], directories: [] };
        let node = this.rootNode;
        const components = path.split("/").filter(c => c);
        if (components.length !== 1 || components[0]) {
            for (const component of components) {
                const n = node.children.get(component);
                if (!n) {
                    return ret;
                }
                node = n;
            }
        }
        node.children.forEach((value, name) => {
            if (value.file) {
                ret.files.push(name);
            } else {
                ret.directories.push(name);
            }
        });
        return ret;
    }


    public trace(message: string) {
        this.logger.log(message);
    }
}
