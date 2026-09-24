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
const CHARS_PER_FRAME = 8;

type StreamState = {
  streaming: boolean;
  content: string;
  preStreamContent: string | null;
};

const MonacoEditor = () => {
  const { selectedFile } = useProject();

  const editorRef =
    useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);

  const monacoRef =
    useRef<typeof Monaco | null>(null);

  const selectedFileRef =
    useRef<string | null>(selectedFile);

  const contentRef = useRef("");

  const [content, setContent] = useState("");
  const [isAgentWriting, setIsAgentWriting] = useState(false);

  /*
   * Every currently active stream lives here.
   */
  const streamsRef =
    useRef<Map<string, StreamState>>(new Map());

  /*
   * Deltas are buffered per file.
   */
  const pendingDeltasRef =
    useRef<Map<string, string>>(new Map());

  const rafRef =
    useRef<number | null>(null);

  const decorationsRef =
    useRef<string[]>([]);

  const highlightTimeoutRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  /*
   * Keep selectedFile immediately available to socket handlers.
   */
  selectedFileRef.current = selectedFile;

  /*
   * --------------------------------------------------------------------------
   * Monaco theme
   * --------------------------------------------------------------------------
   *
   * This intentionally uses the dark editor surface from your reference:
   *
   * Editor background: #121314
   * Text:              #D4D4D4
   * Line numbers:      #858585
   * Cursor:            #FFFFFF
   * Selection:         #264F78
   *
   * This is NOT the purple IDE background.
   */

  const defineEditorTheme = (
    monacoInstance: typeof Monaco
  ) => {
    monacoInstance.editor.defineTheme(
      "ai-forge-dark",
      {
        base: "vs-dark",
        inherit: true,

        colors: {
          "editor.background": "#121314",
          "editor.foreground": "#D4D4D4",

          "editorGutter.background": "#121314",

          "editorLineNumber.foreground": "#858585",
          "editorLineNumber.activeForeground": "#D4D4D4",

          "editorCursor.foreground": "#FFFFFF",

          "editor.selectionBackground": "#264F78",
          "editor.inactiveSelectionBackground": "#2A2D2E",

          "editor.lineHighlightBackground": "#121314",
          "editor.lineHighlightBorder": "#121314",

          "editorIndentGuide.background": "#292B2D",
          "editorIndentGuide.activeBackground": "#3A3D40",

          "editorWhitespace.foreground": "#292B2D",

          "editorWidget.background": "#1E1E1E",
          "editorWidget.border": "#333333",

          "editorSuggestWidget.background": "#1E1E1E",
          "editorSuggestWidget.border": "#333333",
          "editorSuggestWidget.foreground": "#D4D4D4",
          "editorSuggestWidget.selectedBackground": "#264F78",

          "editorHoverWidget.background": "#1E1E1E",
          "editorHoverWidget.border": "#333333",

          "scrollbarSlider.background": "#3A3D40",
          "scrollbarSlider.hoverBackground": "#4A4D50",
          "scrollbarSlider.activeBackground": "#5A5D60",

          "minimap.background": "#121314",
          "minimap.selectionHighlight": "#264F78",
        },

        rules: [
          {
            token: "comment",
            foreground: "6A9955",
          },
          {
            token: "string",
            foreground: "CE9178",
          },
          {
            token: "string.quote",
            foreground: "CE9178",
          },
          {
            token: "number",
            foreground: "B5CEA8",
          },
          {
            token: "keyword",
            foreground: "569CD6",
          },
          {
            token: "keyword.control",
            foreground: "C586C0",
          },
          {
            token: "type",
            foreground: "4EC9B0",
          },
          {
            token: "type.identifier",
            foreground: "4EC9B0",
          },
          {
            token: "class",
            foreground: "4EC9B0",
          },
          {
            token: "function",
            foreground: "DCDCAA",
          },
          {
            token: "function.call",
            foreground: "DCDCAA",
          },
          {
            token: "variable",
            foreground: "9CDCFE",
          },
          {
            token: "variable.predefined",
            foreground: "4FC1FF",
          },
          {
            token: "constant",
            foreground: "4FC1FF",
          },
          {
            token: "delimiter",
            foreground: "D4D4D4",
          },
          {
            token: "operator",
            foreground: "D4D4D4",
          },
          {
            token: "tag",
            foreground: "569CD6",
          },
          {
            token: "attribute.name",
            foreground: "9CDCFE",
          },
        ],
      }
    );
  };

  /*
   * beforeMount runs BEFORE Monaco creates the editor.
   * This prevents the initial white/light-theme flash.
   */
  const handleBeforeMount = (
    monacoInstance: typeof Monaco
  ) => {
    defineEditorTheme(monacoInstance);
  };

  const handleMount: OnMount = (
    editor,
    monacoInstance
  ) => {
    editorRef.current = editor;
    monacoRef.current = monacoInstance;

    monacoInstance.editor.setTheme(
      "ai-forge-dark"
    );

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

    decorationsRef.current =
      editor.deltaDecorations(
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

    if (
      !editor ||
      !monacoInstance ||
      !currentFile
    ) {
      return;
    }

    const pending =
      pendingDeltasRef.current.get(
        currentFile
      );

    if (!pending) return;

    /*
     * Drain at a fixed pace instead of dumping
     * the whole buffer.
     */
    const chunk = pending.slice(
      0,
      CHARS_PER_FRAME
    );

    const remainder =
      pending.slice(CHARS_PER_FRAME);

    if (remainder) {
      pendingDeltasRef.current.set(
        currentFile,
        remainder
      );
    } else {
      pendingDeltasRef.current.delete(
        currentFile
      );
    }

    const model = editor.getModel();

    if (!model) return;

    const lastLine = model.getLineCount();

    const lastCol =
      model.getLineMaxColumn(lastLine);

    model.applyEdits([
      {
        range: new monacoInstance.Range(
          lastLine,
          lastCol,
          lastLine,
          lastCol
        ),
        text: chunk,
        forceMoveMarkers: true,
      },
    ]);

    /*
     * Immediate scrolling prevents jitter
     * while following generated content.
     */
    editor.revealLine(
      model.getLineCount(),
      monacoInstance.editor.ScrollType.Immediate
    );
  };

  const startFlushLoop = () => {
    if (rafRef.current !== null) {
      return;
    }

    const loop = () => {
      flushPending();

      if (hasActiveStreams()) {
        rafRef.current =
          requestAnimationFrame(loop);
      } else {
        rafRef.current = null;
      }
    };

    rafRef.current =
      requestAnimationFrame(loop);
  };

  const stopFlushLoop = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(
        rafRef.current
      );

      rafRef.current = null;
    }
  };

  const showDiffHighlights = (
    previousContent: string,
    finalContent: string
  ) => {
    const editor = editorRef.current;
    const monacoInstance = monacoRef.current;

    if (
      !editor ||
      !monacoInstance
    ) {
      return;
    }

    const addedLines =
      diffAddedLines(
        previousContent,
        finalContent
      );

    if (addedLines.length === 0) {
      return;
    }

    requestAnimationFrame(() => {
      decorationsRef.current =
        editor.deltaDecorations(
          decorationsRef.current,
          addedLines.map((line) => ({
            range:
              new monacoInstance.Range(
                line,
                1,
                line,
                1
              ),

            options: {
              isWholeLine: true,
              className:
                "agent-edit-highlight-line",
            },
          }))
        );

      highlightTimeoutRef.current =
        setTimeout(() => {
          decorationsRef.current =
            editor.deltaDecorations(
              decorationsRef.current,
              []
            );
        }, HIGHLIGHT_MS);
    });
  };

  /*
   * --------------------------------------------------------------------------
   * Socket listeners
   * --------------------------------------------------------------------------
   */

  useEffect(() => {
    const handleStreamStart = ({
      path,
    }: FileStreamStartEvent) => {
      const editor = editorRef.current;

      const currentSelectedFile =
        selectedFileRef.current;

      clearHighlightTimer();
      clearDecorations();

      let preStreamContent:
        string | null = null;

      if (
        path === currentSelectedFile
      ) {
        const model =
          editor?.getModel();

        preStreamContent =
          model?.getValue() ??
          contentRef.current;

        model?.setValue("");

        contentRef.current = "";

        setContent("");

        setIsAgentWriting(true);
      }

      streamsRef.current.set(
        path,
        {
          streaming: true,
          content: "",
          preStreamContent,
        }
      );

      pendingDeltasRef.current.set(
        path,
        ""
      );

      startFlushLoop();
    };

    const handleDelta = ({
      path,
      delta,
    }: FileDeltaEvent) => {
      const stream =
        streamsRef.current.get(path);

      if (
        !stream ||
        !stream.streaming
      ) {
        return;
      }

      stream.content += delta;

      const previousPending =
        pendingDeltasRef.current.get(
          path
        ) ?? "";

      pendingDeltasRef.current.set(
        path,
        previousPending + delta
      );

      startFlushLoop();
    };

    const handleStreamEnd = ({
      path,
      content: finalContent,
    }: FileStreamEndEvent) => {
      const stream =
        streamsRef.current.get(path);

      if (!stream) {
        if (
          selectedFileRef.current ===
          path
        ) {
          const editor =
            editorRef.current;

          editor
            ?.getModel()
            ?.setValue(
              finalContent
            );

          contentRef.current =
            finalContent;

          setContent(
            finalContent
          );

          setIsAgentWriting(false);
        }

        return;
      }

      stream.streaming = false;
      stream.content = finalContent;

      pendingDeltasRef.current.delete(
        path
      );

      const currentSelectedFile =
        selectedFileRef.current;

      if (
        currentSelectedFile === path
      ) {
        stopFlushLoop();

        const editor =
          editorRef.current;

        editor
          ?.getModel()
          ?.setValue(
            finalContent
          );

        contentRef.current =
          finalContent;

        setContent(
          finalContent
        );

        setIsAgentWriting(false);

        if (
          stream.preStreamContent !==
          null
        ) {
          showDiffHighlights(
            stream.preStreamContent,
            finalContent
          );
        }
      }

      streamsRef.current.delete(
        path
      );

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
    selectedFileRef.current =
      selectedFile;

    if (!selectedFile) {
      setIsAgentWriting(false);
      return;
    }

    clearHighlightTimer();
    clearDecorations();

    const activeStream =
      streamsRef.current.get(
        selectedFile
      );

    if (
      activeStream?.streaming
    ) {
      const editor =
        editorRef.current;

      const model =
        editor?.getModel();

      const streamedContent =
        activeStream.content;

      model?.setValue(
        streamedContent
      );

      contentRef.current =
        streamedContent;

      setContent(
        streamedContent
      );

      setIsAgentWriting(true);

      startFlushLoop();

      return;
    }

    setIsAgentWriting(false);

    socket.emit(
      "file:read",
      {
        relativePath:
          selectedFile,
      }
    );
  }, [selectedFile]);

  /*
   * --------------------------------------------------------------------------
   * file:content
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
      const currentSelectedFile =
        selectedFileRef.current;

      if (!currentSelectedFile) {
        return;
      }

      if (
        relativePath !==
        currentSelectedFile
      ) {
        return;
      }

      const activeStream =
        streamsRef.current.get(
          relativePath
        );

      if (
        activeStream?.streaming
      ) {
        return;
      }

      contentRef.current =
        fileContent;

      setContent(
        fileContent
      );

      const model =
        editorRef.current?.getModel();

      if (
        model &&
        model.getValue() !==
          fileContent
      ) {
        model.setValue(
          fileContent
        );
      }
    };

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
    contentRef.current =
      content;
  }, [content]);

  /*
   * --------------------------------------------------------------------------
   * Manual editing
   * --------------------------------------------------------------------------
   */

  const handleChange = (
    value?: string
  ) => {
    if (isAgentWriting) {
      return;
    }

    if (!selectedFile) {
      return;
    }

    const newContent =
      value ?? "";

    contentRef.current =
      newContent;

    setContent(
      newContent
    );

    socket.emit(
      "file:save",
      {
        relativePath:
          selectedFile,
        content:
          newContent,
      }
    );
  };

  /*
   * --------------------------------------------------------------------------
   * Language detection
   * --------------------------------------------------------------------------
   */

  const getLanguage = (
    file?: string | null
  ) => {
    if (!file) {
      return "plaintext";
    }

    const ext =
      file
        .split(".")
        .pop()
        ?.toLowerCase();

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
      <div
        className="
          flex
          h-full
          items-center
          justify-center
          bg-[#121314]
          text-zinc-500
        "
      >
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
    <div
      className="relative h-full"
      style={{
        background: "#121314",
      }}
    >
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
        theme="ai-forge-dark"
        beforeMount={
          handleBeforeMount
        }
        language={getLanguage(
          selectedFile
        )}
        value={content}
        onMount={handleMount}
        onChange={handleChange}
        options={{
          fontSize: 14,

          fontFamily:
            '"JetBrains Mono", "SFMono-Regular", Consolas, monospace',

          lineHeight: 21,

          minimap: {
            enabled: false,
          },

          automaticLayout: true,

          scrollBeyondLastLine: false,

          wordWrap: "off",

          tabSize: 2,

          renderWhitespace:
            "selection",

          readOnly:
            isAgentWriting,

          smoothScrolling: true,

          cursorSmoothCaretAnimation:
            "on",

          cursorBlinking:
            "smooth",

          renderValidationDecorations:
            isAgentWriting
              ? "off"
              : "editable",

          padding: {
            top: 16,
          },

          lineNumbersMinChars: 3,

          glyphMargin: false,

          folding: true,

          overviewRulerBorder: false,

          scrollbar: {
            verticalScrollbarSize: 7,
            horizontalScrollbarSize: 7,
            useShadows: false,
          },
        }}
      />
    </div>
  );
};

export default MonacoEditor;