import { useState, useEffect } from "react";
import {
  ChevronDown,
  ChevronRight,
  Ellipsis,
  File,
  FilePlus2,
  Folder,
  FolderOpen,
  FolderPlus,
  RefreshCw,
} from "lucide-react";

import socket from "@/sockets/socket";
import { useProject } from "@/hooks/useProject";
import TreeNode from "./TreeNode";
import type { FileTree } from "@/types/project.types";

const Explorer = () => {
  const {
    project,
    fileTree,
    setFileTree,
  } = useProject();

  const [rootOpen, setRootOpen] = useState(true);

  const [creatingFile, setCreatingFile] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    const handleFileTreeUpdate = (tree: FileTree) => {
      setFileTree(tree);
    };

    socket.on("filetree:update", handleFileTreeUpdate);

    return () => {
      socket.off("filetree:update", handleFileTreeUpdate);
    };
  }, [setFileTree]);

  const handleRefresh = () => {
    socket.emit("filetree:refresh");
  };

  const handleCreate = () => {
    const name = newName.trim();

    if (!name) {
      setCreatingFile(false);
      setCreatingFolder(false);
      return;
    }

    if (creatingFile) {
      socket.emit("file:create", {
        relativePath: name,
        content: "",
      });
    }

    if (creatingFolder) {
      socket.emit("folder:create", {
        relativePath: name,
      });
    }

    setNewName("");
    setCreatingFile(false);
    setCreatingFolder(false);
  };

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
              setCreatingFolder(false);
              setNewName("");
              setCreatingFile(true);
            }}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
          >
            <FilePlus2 size={14} />
          </button>

          <button
            onClick={() => {
              setCreatingFile(false);
              setNewName("");
              setCreatingFolder(true);
            }}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
          >
            <FolderPlus size={14} />
          </button>

          <button
            onClick={handleRefresh}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
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

            {(creatingFile || creatingFolder) && (
              <div className="flex items-center gap-2 px-2 py-1">
                {creatingFolder ? (
                  <FolderOpen
                    size={16}
                    className="text-sky-400"
                  />
                ) : (
                  <File
                    size={16}
                    className="text-zinc-400"
                  />
                )}

                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onBlur={() => {
                    setCreatingFile(false);
                    setCreatingFolder(false);
                    setNewName("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleCreate();
                    }

                    if (e.key === "Escape") {
                      setCreatingFile(false);
                      setCreatingFolder(false);
                      setNewName("");
                    }
                  }}
                  placeholder={
                    creatingFile
                      ? "New file..."
                      : "New folder..."
                  }
                  className="w-full rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5 text-sm text-zinc-200 outline-none focus:border-blue-500"
                />
              </div>
            )}

            {Object.entries(fileTree).map(([name, node]) => (
              <TreeNode
                key={name}
                name={name}
                node={node}
                path={name}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Explorer;