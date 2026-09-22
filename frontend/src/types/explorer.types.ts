export type CreatingState = {
  type: "file" | "folder";
  parentPath: string;
} | null;