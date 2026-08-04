import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  File,
} from "lucide-react";

import { useProject } from "@/hooks/useProject";

type Props = {
  name: string;
  node: any;
  path: string;
};

const TreeNode = ({ name, node, path }: Props) => {
  const isFolder = node !== null;
  const [open, setOpen] = useState(true);
  const { setSelectedFile } = useProject();
  if (!isFolder) {
    return (
        <button onClick={() => setSelectedFile(path)}
            className="flex w-full items-center gap-2 rounded px-2 py-1 text-sm text-zinc-300 hover:bg-zinc-800">
        <File size={16} className="shrink-0 text-zinc-400" />
        <span className="truncate">{name}</span>
      </button>
    );
  }

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1 rounded px-2 py-1 text-sm text-zinc-300 hover:bg-zinc-800"
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

      {open && (
        <div className="ml-5">
          {Object.entries(node).map(([childName, childNode]) => (
            <TreeNode
              key={`${path}/${childName}`}
              name={childName}
              node={childNode}
              path={`${path}/${childName}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default TreeNode;