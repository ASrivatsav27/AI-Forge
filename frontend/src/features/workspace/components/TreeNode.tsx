import { useState, useEffect } from "react";
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  File,
  FilePlus2,
  FolderPlus,
} from "lucide-react";

import { useProject } from "@/hooks/useProject";
import InlineInput from "./InLineInput";
import type { CreatingState } from "@/types/explorer.types";
import type { FileTree } from "@/types/project.types";

type Props = {
  name: string;
  node: FileTree[string]; // adjust if your FileTree node type differs
  path: string;

  creating: CreatingState;
  setCreating: React.Dispatch<React.SetStateAction<CreatingState>>;
  onCreateSubmit: (name: string) => void;
  onCreateCancel: () => void;
};

const TreeNode = ({
  name,
  node,
  path,
  creating,
  setCreating,
  onCreateSubmit,
  onCreateCancel,
}: Props) => {
  const isFolder = node !== null;
  const [open, setOpen] = useState(true);
  const { setSelectedFile } = useProject();

  // auto-open this folder when something starts being created inside it
  useEffect(() => {
    if (isFolder && creating?.parentPath === path && !open) {
      setOpen(true);
    }
  }, [creating, isFolder, path, open]);

  if (!isFolder) {
    return (
      <button
        onClick={() => setSelectedFile(path)}
        className="flex w-full items-center gap-2 rounded px-2 py-1 text-sm text-zinc-300 hover:bg-zinc-800"
      >
        <File size={16} className="shrink-0 text-zinc-400" />
        <span className="truncate">{name}</span>
      </button>
    );
  }

  return (
    <div>
      <div className="group flex items-center justify-between rounded hover:bg-zinc-800">
        <button
          onClick={() => setOpen((prev) => !prev)}
          className="flex flex-1 items-center gap-1 overflow-hidden px-2 py-1 text-left text-sm text-zinc-300"
        >
          {open ? (
            <ChevronDown size={14} className="shrink-0" />
          ) : (
            <ChevronRight size={14} className="shrink-0" />
          )}

          {open ? (
            <FolderOpen size={16} className="shrink-0 text-sky-400" />
          ) : (
            <Folder size={16} className="shrink-0 text-sky-400" />
          )}

          <span className="truncate">{name}</span>
        </button>

        <div className="mr-1 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!open) setOpen(true);
              setCreating({ type: "file", parentPath: path });
            }}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-700 hover:text-white"
            title="New File"
          >
            <FilePlus2 size={12} />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!open) setOpen(true);
              setCreating({ type: "folder", parentPath: path });
            }}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-700 hover:text-white"
            title="New Folder"
          >
            <FolderPlus size={12} />
          </button>
        </div>
      </div>

      {open && (
        <div className="ml-5">
          {Object.entries(node).map(([childName, childNode]) => (
            <TreeNode
              key={`${path}/${childName}`}
              name={childName}
              node={childNode}
              path={`${path}/${childName}`}
              creating={creating}
              setCreating={setCreating}
              onCreateSubmit={onCreateSubmit}
              onCreateCancel={onCreateCancel}
            />
          ))}

          {creating?.parentPath === path && (
            <InlineInput
              type={creating.type}
              onSubmit={onCreateSubmit}
              onCancel={onCreateCancel}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default TreeNode;