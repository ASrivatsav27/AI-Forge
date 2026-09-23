import Editor, { type OnMount } from "@monaco-editor/react";
import { useEffect, useRef, useState } from "react";
import type * as Monaco from "monaco-editor";
import { Sparkles } from "lucide-react";

import { useProject } from "@/hooks/useProject";
import socket from "@/sockets/socket";
import type {
  FileStreamStartEvent,
  FileDeltaEvent,
  FileStreamEndEvent,
} from "@/types/agent.types";
import { diffAddedLines } from "@/lib/lineDiff";

const HIGHLIGHT_MS = 2500;

type StreamState = {
  streaming: boolean;
  content: string;
  preStreamContent: string | null;
};

const MonacoEditor = () => {
  const { selectedFile } = useProject();

  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);

  const selectedFileRef = useRef<string | null>(selectedFile);
  const contentRef = useRef("");

  const [content, setContent] = useState("");
  const [isAgentWriting, setIsAgentWriting] = useState(false);

  /*
   * Every currently active stream lives here.
   *
   * This is important because the agent can emit stream:start BEFORE
   * React has finished switching selectedFile to the new file.
   */
  const streamsRef = useRef<Map<string, StreamState>>(new Map());

  /*
   * Deltas are buffered per file.
   */
  const pendingDeltasRef = useRef<Map<string, string>>(new Map());

  const rafRef = useRef<number | null>(null);

  const decorationsRef = useRef<string[]>([]);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  /*
   * Keep selectedFile immediately available to socket handlers.
   */
  selectedFileRef.current = selectedFile;

  const handleMount: OnMount = (editor, monacoInstance) => {
    editorRef.current = editor;
    monacoRef.current = monacoInstance;
    editor.focus();
  };

  /*
   * --------------------------------------------------------------------------
   * Helpers
   * --------------------------------------------------------------------------
   */

  const clearHighlightTimer = () => {
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = null;
    }
  };

  const clearDecorations = () => {
    const editor = editorRef.current;

    if (!editor) return;

    decorationsRef.current = editor.deltaDecorations(
      decorationsRef.current,
      []
    );
  };

  const hasActiveStreams = () => {
    for (const stream of streamsRef.current.values()) {
      if (stream.streaming) {
        return true;
      }
    }

    return false;
  };

  const flushPending = () => {
    const editor = editorRef.current;
    const monacoInstance = monacoRef.current;
    const currentFile = selectedFileRef.current;

    if (!editor || !monacoInstance || !currentFile) return;

    const pending = pendingDeltasRef.current.get(currentFile);

    if (!pending) return;

    pendingDeltasRef.current.delete(currentFile);

    const model = editor.getModel();

    if (!model) return;

    const lastLine = model.getLineCount();
    const lastCol = model.getLineMaxColumn(lastLine);

    model.applyEdits([
      {
        range: new monacoInstance.Range(
          lastLine,
          lastCol,
          lastLine,
          lastCol
        ),
        text: pending,
        forceMoveMarkers: true,
      },
    ]);

    editor.revealLine(
      model.getLineCount(),
      monacoInstance.editor.ScrollType.Smooth
    );
  };

  const startFlushLoop = () => {
    if (rafRef.current !== null) {
      return;
    }

    const loop = () => {
      flushPending();

      if (hasActiveStreams()) {
        rafRef.current = requestAnimationFrame(loop);
      } else {
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(loop);
  };

  const stopFlushLoop = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const showDiffHighlights = (
    previousContent: string,
    finalContent: string
  ) => {
    const editor = editorRef.current;
    const monacoInstance = monacoRef.current;

    if (!editor || !monacoInstance) return;

    const addedLines = diffAddedLines(previousContent, finalContent);

    if (addedLines.length === 0) {
      return;
    }

    requestAnimationFrame(() => {
      decorationsRef.current = editor.deltaDecorations(
        decorationsRef.current,
        addedLines.map((line) => ({
          range: new monacoInstance.Range(line, 1, line, 1),
          options: {
            isWholeLine: true,
            className: "agent-edit-highlight-line",
          },
        }))
      );

      highlightTimeoutRef.current = setTimeout(() => {
        decorationsRef.current = editor.deltaDecorations(
          decorationsRef.current,
          []
        );
      }, HIGHLIGHT_MS);
    });
  };

  /*
   * --------------------------------------------------------------------------
   * Socket listeners
   *
   * IMPORTANT:
   * These listeners intentionally DO NOT depend on selectedFile.
   *
   * They must stay mounted while the agent is working so that changing
   * selectedFile cannot cause us to miss agent:file-stream-start.
   * --------------------------------------------------------------------------
   */

  useEffect(() => {
    const handleStreamStart = ({ path }: FileStreamStartEvent) => {
      const editor = editorRef.current;
      const currentSelectedFile = selectedFileRef.current;

      clearHighlightTimer();
      clearDecorations();

      /*
       * Capture the before-state only if this file was already open.
       *
       * For a file that wasn't open yet, we intentionally store null because
       * there is no trustworthy before snapshot.
       */
      let preStreamContent: string | null = null;

      if (path === currentSelectedFile) {
        const model = editor?.getModel();

        preStreamContent = model?.getValue() ?? contentRef.current;

        /*
         * Immediately clear the visible editor if the file is already open.
         */
        model?.setValue("");

        contentRef.current = "";
        setContent("");
        setIsAgentWriting(true);
      }

      /*
       * Create/replace the stream state.
       */
      streamsRef.current.set(path, {
        streaming: true,
        content: "",
        preStreamContent,
      });

      /*
       * Start with an empty pending buffer for this path.
       */
      pendingDeltasRef.current.set(path, "");

      /*
       * If ProjectContext changes selectedFile as a result of this event,
       * the selectedFile effect below will notice the active stream and
       * attach the stream to Monaco.
       */
      startFlushLoop();
    };

    const handleDelta = ({ path, delta }: FileDeltaEvent) => {
      const stream = streamsRef.current.get(path);

      /*
       * Ignore deltas for streams we don't know about.
       */
      if (!stream || !stream.streaming) {
        return;
      }

      /*
       * Keep the authoritative streamed content in memory.
       */
      stream.content += delta;

      /*
       * Keep a separate rendering buffer.
       */
      const previousPending = pendingDeltasRef.current.get(path) ?? "";

      pendingDeltasRef.current.set(
        path,
        previousPending + delta
      );

      /*
       * If this file is currently visible, Monaco will consume the pending
       * buffer on the next animation frame.
       */
      startFlushLoop();
    };

    const handleStreamEnd = ({
      path,
      content: finalContent,
    }: FileStreamEndEvent) => {
      const stream = streamsRef.current.get(path);

      if (!stream) {
        /*
         * Still handle the event gracefully if for some reason the client
         * missed stream:start.
         */
        if (selectedFileRef.current === path) {
          const editor = editorRef.current;

          editor?.getModel()?.setValue(finalContent);

          contentRef.current = finalContent;
          setContent(finalContent);
          setIsAgentWriting(false);
        }

        return;
      }

      /*
       * Mark the stream finished.
       */
      stream.streaming = false;
      stream.content = finalContent;

      /*
       * Remove any remaining buffered deltas.
       */
      pendingDeltasRef.current.delete(path);

      const currentSelectedFile = selectedFileRef.current;

      /*
       * Only modify the visible Monaco instance if this is the file
       * currently selected.
       */
      if (currentSelectedFile === path) {
        stopFlushLoop();

        const editor = editorRef.current;

        /*
         * IMPORTANT:
         * The stream itself is visualized live, but the final file returned
         * by the backend is authoritative.
         */
        editor?.getModel()?.setValue(finalContent);

        contentRef.current = finalContent;
        setContent(finalContent);
        setIsAgentWriting(false);

        /*
         * Diff only when we actually had a before snapshot.
         */
        if (stream.preStreamContent !== null) {
          showDiffHighlights(
            stream.preStreamContent,
            finalContent
          );
        }
      }

      /*
       * The final content is now safely written on the backend.
       *
       * We can remove the stream state. If the user opens the file later,
       * normal file:read will retrieve the authoritative content.
       */
      streamsRef.current.delete(path);

      if (!hasActiveStreams()) {
        stopFlushLoop();
      }
    };

    socket.on(
      "agent:file-stream-start",
      handleStreamStart
    );

    socket.on(
      "agent:file-delta",
      handleDelta
    );

    socket.on(
      "agent:file-stream-end",
      handleStreamEnd
    );

    return () => {
      socket.off(
        "agent:file-stream-start",
        handleStreamStart
      );

      socket.off(
        "agent:file-delta",
        handleDelta
      );

      socket.off(
        "agent:file-stream-end",
        handleStreamEnd
      );

      stopFlushLoop();
      clearHighlightTimer();
    };
  }, []);

  /*
   * --------------------------------------------------------------------------
   * Keep Monaco synchronized when selectedFile changes
   * --------------------------------------------------------------------------
   */

  useEffect(() => {
    selectedFileRef.current = selectedFile;

    if (!selectedFile) {
      setIsAgentWriting(false);
      return;
    }

    clearHighlightTimer();
    clearDecorations();

    /*
     * If the agent is currently streaming this file, DO NOT issue file:read.
     *
     * The file may not exist yet or may contain only partially generated
     * content. Instead, attach the existing stream buffer to Monaco.
     */
    const activeStream = streamsRef.current.get(selectedFile);

    if (activeStream?.streaming) {
      const editor = editorRef.current;
      const model = editor?.getModel();

      const streamedContent = activeStream.content;

      model?.setValue(streamedContent);

      contentRef.current = streamedContent;
      setContent(streamedContent);
      setIsAgentWriting(true);

      startFlushLoop();

      return;
    }

    /*
     * Normal file selection.
     *
     * Registering file:content happens in the permanent socket listener
     * below, BEFORE this event is emitted.
     */
    setIsAgentWriting(false);

    socket.emit("file:read", {
      relativePath: selectedFile,
    });
  }, [selectedFile]);

  /*
   * --------------------------------------------------------------------------
   * file:content
   *
   * This listener stays alive permanently for the same reason as the agent
   * stream listeners: changing selectedFile must never create a race.
   * --------------------------------------------------------------------------
   */

  useEffect(() => {
    const handleFileContent = ({
      relativePath,
      content: fileContent,
    }: {
      relativePath: string;
      content: string;
    }) => {
      const currentSelectedFile = selectedFileRef.current;

      if (!currentSelectedFile) {
        return;
      }

      if (relativePath !== currentSelectedFile) {
        return;
      }

      /*
       * Never allow a normal file:content response to overwrite a live
       * agent stream.
       */
      const activeStream = streamsRef.current.get(relativePath);

      if (activeStream?.streaming) {
        return;
      }

      contentRef.current = fileContent;
      setContent(fileContent);

      /*
       * Usually React/Monaco will update from the value prop.
       * Setting the model explicitly also handles cases where Monaco has
       * already mounted and the value hasn't propagated yet.
       */
      const model = editorRef.current?.getModel();

      if (model && model.getValue() !== fileContent) {
        model.setValue(fileContent);
      }
    };

    /*
     * IMPORTANT:
     * Listener is registered BEFORE file:read can be emitted.
     */
    socket.on(
      "file:content",
      handleFileContent
    );

    return () => {
      socket.off(
        "file:content",
        handleFileContent
      );
    };
  }, []);

  /*
   * --------------------------------------------------------------------------
   * Keep refs synchronized
   * --------------------------------------------------------------------------
   */

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  /*
   * --------------------------------------------------------------------------
   * Manual editing
   * --------------------------------------------------------------------------
   */

  const handleChange = (value?: string) => {
    /*
     * Never allow manual edits while the agent owns this file.
     */
    if (isAgentWriting) {
      return;
    }

    if (!selectedFile) {
      return;
    }

    const newContent = value ?? "";

    contentRef.current = newContent;
    setContent(newContent);

    socket.emit("file:save", {
      relativePath: selectedFile,
      content: newContent,
    });
  };

  /*
   * --------------------------------------------------------------------------
   * Language detection
   * --------------------------------------------------------------------------
   */

  const getLanguage = (file?: string | null) => {
    if (!file) {
      return "plaintext";
    }

    const ext = file.split(".").pop()?.toLowerCase();

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

  /*
   * --------------------------------------------------------------------------
   * Empty state
   * --------------------------------------------------------------------------
   */

  if (!selectedFile) {
    return (
      <div className="flex h-full items-center justify-center bg-[#1e1e1e] text-zinc-500">
        Select a file to begin editing
      </div>
    );
  }

  /*
   * --------------------------------------------------------------------------
   * UI
   * --------------------------------------------------------------------------
   */

  return (
    <div className="relative h-full">
      <style>{`
        .agent-edit-highlight-line {
          background: rgba(52, 211, 153, 0.14);
        }

        @keyframes agent-banner-pulse {
          0%, 100% {
            opacity: 1;
          }

          50% {
            opacity: 0.55;
          }
        }

        .agent-writing-banner-icon {
          animation: agent-banner-pulse 1.3s ease-in-out infinite;
        }
      `}</style>

      {isAgentWriting && (
        <div
          className="
            pointer-events-none
            absolute
            right-3
            top-2
            z-10
            flex
            items-center
            gap-1.5
            rounded-full
            border
            border-emerald-800/60
            bg-emerald-950/80
            px-2.5
            py-1
            text-[11px]
            font-medium
            text-emerald-300
            shadow-sm
            backdrop-blur
          "
        >
          <Sparkles
            size={12}
            className="agent-writing-banner-icon"
          />

          Agent is coding…
        </div>
      )}

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

          readOnly: isAgentWriting,

          smoothScrolling: true,

          cursorSmoothCaretAnimation: "on",

          padding: {
            top: 16,
          },
        }}
      />
    </div>
  );
};

export default MonacoEditor;