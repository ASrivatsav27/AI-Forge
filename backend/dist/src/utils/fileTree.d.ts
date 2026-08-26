export type FileTree = {
    [key: string]: FileTree | null;
};
export declare function generateFileTree(directory: string): Promise<FileTree>;
//# sourceMappingURL=fileTree.d.ts.map