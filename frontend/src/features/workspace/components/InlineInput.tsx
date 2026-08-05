import { useEffect, useRef, useState } from "react";
import { File, Folder } from "lucide-react";

type Props = {
  type: "file" | "folder";
  onSubmit: (name: string) => void;
  onCancel: () => void;
};

const InlineInput = ({ type, onSubmit, onCancel }: Props) => {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = () => {
    if (!value.trim()) {
      onCancel();
      return;
    }
    onSubmit(value);
  };

  return (
    <div className="flex items-center gap-2 rounded px-2 py-1">
      {type === "folder" ? (
        <Folder size={16} className="shrink-0 text-sky-400" />
      ) : (
        <File size={16} className="shrink-0 text-zinc-400" />
      )}

      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
        onBlur={onCancel}
        placeholder={type === "folder" ? "folder name" : "file name"}
        className="w-full rounded border border-sky-500 bg-zinc-900 px-1 py-0.5 text-sm text-zinc-100 outline-none"
      />
    </div>
  );
};

export default InlineInput;