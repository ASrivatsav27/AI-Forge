import { useState, useEffect, useRef } from "react";
import {
  ChevronDown,
  ChevronRight,
  Ellipsis,
  FilePlus2,
  Folder,
  FolderOpen,
  FolderPlus,
  RefreshCw,
} from "lucide-react";

import socket from "@/sockets/socket";
import { useProject } from "@/hooks/useProject";
import TreeNode from "./TreeNode";
import InlineInput from "./InLineInput";
import type { FileTree } from "@/types/project.types";
import type { CreatingState } from "@/types/explorer.types";

const Explorer = () => {
  const { project, fileTree, setFileTree, setSelectedFile } = useProject();

  const [rootOpen, setRootOpen] = useState(true);
  const [creating, setCreating] = useState<CreatingState>(null);

  // holds the path we should auto-select once it shows up in the next tree update
  const pendingSelectRef = useRef<string | null>(null);

  useEffect(() => {
    const handleFileTreeUpdate = (tree: FileTree) => {
      setFileTree(tree);

      if (pendingSelectRef.current) {
        setSelectedFile(pendingSelectRef.current);
        pendingSelectRef.current = null;
      }
    };

    socket.on("filetree:update", handleFileTreeUpdate);

    return () => {
      socket.off("filetree:update", handleFileTreeUpdate);
    };
  }, [setFileTree, setSelectedFile]);

  const handleRefresh = () => {
    socket.emit("filetree:refresh");
  };

  const handleCreateSubmit = (name: string) => {
    if (!creating) return;

    const trimmed = name.trim();
    if (!trimmed) {
      setCreating(null);
      return;
    }

    const fullPath = creating.parentPath
      ? `${creating.parentPath}/${trimmed}`
      : trimmed;

    if (creating.type === "file") {
      socket.emit("file:create", {
        relativePath: fullPath,
        content: "",
      });
      pendingSelectRef.current = fullPath;
    } else {
      socket.emit("folder:create", {
        relativePath: fullPath,
      });
    }

    setCreating(null);
  };

  const handleCreateCancel = () => setCreating(null);

  return (
    <div className="flex h-full flex-col border-r border-zinc-800 bg-black">
      {/* Header */}
      <div className="border-b border-zinc-800 px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
          Explorer
        </p>
      </div>

      {/* Workspace */}
      <div className="group flex items-center justify-between hover:bg-zinc-900">
        <button
          onClick={() => setRootOpen((prev) => !prev)}
          className="flex flex-1 items-center gap-1 overflow-hidden px-2 py-1 text-left"
        >
          {rootOpen ? (
            <ChevronDown size={14} className="text-zinc-400" />
          ) : (
            <ChevronRight size={14} className="text-zinc-400" />
          )}

          {rootOpen ? (
            <FolderOpen size={16} className="text-sky-400" />
          ) : (
            <Folder size={16} className="text-sky-400" />
          )}

          <span className="truncate text-sm font-medium text-zinc-200">
            {project?.name ?? "Loading..."}
          </span>
        </button>

        <div className="mr-1 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={() => {
              if (!rootOpen) setRootOpen(true);
              setCreating({ type: "file", parentPath: "" });
            }}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
            title="New File"
          >
            <FilePlus2 size={14} />
          </button>

          <button
            onClick={() => {
              if (!rootOpen) setRootOpen(true);
              setCreating({ type: "folder", parentPath: "" });
            }}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
            title="New Folder"
          >
            <FolderPlus size={14} />
          </button>

          <button
            onClick={handleRefresh}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
            title="Refresh"
          >
            <RefreshCw size={14} />
          </button>

          <button className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white">
            <Ellipsis size={14} />
          </button>
        </div>
      </div>

      {/* Tree */}
      {rootOpen && (
        <div className="flex-1 overflow-y-auto py-1">
          <div className="ml-4">
            {Object.entries(fileTree).map(([name, node]) => (
              <TreeNode
                key={name}
                name={name}
                node={node}
                path={name}
                creating={creating}
                setCreating={setCreating}
                onCreateSubmit={handleCreateSubmit}
                onCreateCancel={handleCreateCancel}
              />
            ))}

            {creating?.parentPath === "" && (
              <InlineInput
                type={creating.type}
                onSubmit={handleCreateSubmit}
                onCancel={handleCreateCancel}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Explorer;