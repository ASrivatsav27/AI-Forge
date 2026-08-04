import Editor, { type OnMount } from "@monaco-editor/react";
import { useEffect, useRef, useState } from "react";
import type * as Monaco from "monaco-editor";

import { useProject } from "@/hooks/useProject";
import socket from "@/sockets/socket";

const MonacoEditor = () => {
  const { selectedFile } = useProject();

  const editorRef =
    useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);

  const [content, setContent] = useState("");

  const handleMount: OnMount = (editor) => {
    editorRef.current = editor;
    editor.focus();
  };

  useEffect(() => {
    if (!selectedFile) return;

    socket.emit("file:read", {
      relativePath: selectedFile,
    });

    const handleFileContent = ({
      relativePath,
      content,
    }: {
      relativePath: string;
      content: string;
    }) => {
      if (relativePath !== selectedFile) return;

      setContent(content);
    };

    socket.on("file:content", handleFileContent);
    
      
    return () => {
      socket.off("file:content", handleFileContent);
    };
  }, [selectedFile]);

  const handleChange = (value?: string) => {
    const newContent = value ?? "";

    setContent(newContent);

  
    socket.emit("file:save", {
      relativePath: selectedFile!,
      content: newContent,
    });
  };

  const getLanguage = (file?: string | null) => {
    if (!file) return "plaintext";

    const ext = file.split(".").pop();

    switch (ext) {
      case "ts":
      case "tsx":
        return "typescript";

      case "js":
      case "jsx":
        return "javascript";

      case "json":
        return "json";

      case "html":
        return "html";

      case "css":
        return "css";

      case "scss":
        return "scss";

      case "md":
        return "markdown";

      case "py":
        return "python";

      case "java":
        return "java";

      case "cpp":
        return "cpp";

      case "c":
        return "c";

      default:
        return "plaintext";
    }
  };

  if (!selectedFile) {
    return (
      <div className="flex h-full items-center justify-center bg-[#1e1e1e] text-zinc-500">
        Select a file to begin editing
      </div>
    );
  }

  return (
    <Editor
      height="100%"
      theme="vs-dark"
      language={getLanguage(selectedFile)}
      value={content}
      onMount={handleMount}
      onChange={handleChange}
      options={{
        fontSize: 14,
        minimap: {
          enabled: false,
        },
        automaticLayout: true,
        scrollBeyondLastLine: false,
        wordWrap: "off",
        tabSize: 2,
        renderWhitespace: "selection",
        padding: {
          top: 16,
        },
      }}
    />
  );
};

export default MonacoEditor;