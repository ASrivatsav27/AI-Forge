// src/components/AgentActivityPanel.tsx

import { useEffect, useState, useRef } from "react";
import {
  CheckCircle2,
  XCircle,
  Send,
  Sparkles,
  Loader2,
  Paperclip,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

import socket from "@/sockets/socket";
import type { AgentStatusEvent, AgentStage } from "@/types/agent.types";
import type { ImageAttachment } from "@/types/project.types";
import { useProject } from "@/hooks/useProject";
import LiveFileGenCard from "./LiveFileGenCard";

type Props = {
  projectId: string;
};

const isTerminal = (phase: string) =>
  phase.endsWith(":done") || phase === "error";

const isWorkflowPhase = (phase: string) =>
  phase.startsWith("setup:") ||
  phase === "coding:planning" ||
  phase === "coding:generating" ||
  phase === "coding:verifying" ||
  phase === "coding:fixing" ||
  phase === "coding:installing" ||
  phase === "coding:setup-command" ||
  phase === "coding:cancelled" ||
  phase === "coding:done";

const STAGE_HEADLINE: Record<AgentStage, string> = {
  setup: "Setting up your project",
  coding: "Building your app",
};

const MAX_FEATURED_CARDS = 3;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const TERMINAL_LINGER_MS = 2500;

// How many assistant-message chars to show before "Show more"
const PREVIEW_CHARS = 120;

const AgentActivityPanel = ({ projectId }: Props) => {
  const [current, setCurrent] = useState<AgentStatusEvent | null>(null);
  const [workflowActive, setWorkflowActive] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const lastModeRef = useRef<"chat" | "quick-edit" | "full" | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const {
    handleSendFollowUpPrompt,
    fileGenState,
    planTotalFiles,
    chatMessages,
    selectedFile,
    setSelectedFile,
  } = useProject();

  const [prompt, setPrompt] = useState("");
  const [sending, setSending] = useState(false);
  const [attachedImage, setAttachedImage] = useState<
    (ImageAttachment & { previewUrl: string }) | null
  >(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Auto-scroll chat to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  useEffect(() => {
    const handleAgentStatus = (evt: AgentStatusEvent) => {
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current);
        clearTimerRef.current = null;
      }

      if (evt.phase === "coding:triage") {
        const mode = evt.message.split(" — ")[0]?.trim();
        if (mode === "chat" || mode === "quick-edit" || mode === "full") {
          lastModeRef.current = mode;
        }
      }

      if (
        evt.phase === "coding:planning" &&
        evt.message.startsWith("Quick edit needs a full rebuild")
      ) {
        lastModeRef.current = "full";
      }

      if (evt.phase === "coding:done" && lastModeRef.current === "chat") {
        lastModeRef.current = null;
        setCurrent(null);
        setWorkflowActive(false);
        return;
      }

      if (isWorkflowPhase(evt.phase)) {
        setWorkflowActive(true);
        setCurrent(evt);

        if (isTerminal(evt.phase)) {
          clearTimerRef.current = setTimeout(() => {
            setCurrent(null);
            setWorkflowActive(false);
            clearTimerRef.current = null;
          }, TERMINAL_LINGER_MS);
        }
      }
    };

    socket.on("agent:status", handleAgentStatus);
    return () => {
      socket.off("agent:status", handleAgentStatus);
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    };
  }, []);

  const active = current && !isTerminal(current.phase);
  const headline = current ? STAGE_HEADLINE[current.stage] : null;
  const showLiveGen = planTotalFiles !== null && active && workflowActive;

  const filesArr = Object.entries(fileGenState).sort(
    (a, b) => a[1].startedAt - b[1].startedAt
  );
  const generating = filesArr.filter(
    ([path, s]) => s.status === "generating" && path !== selectedFile
  );
  const completed = filesArr.filter(([, s]) => s.status === "done");
  const featured = generating.slice(0, MAX_FEATURED_CARDS);
  const extraGenerating = generating.slice(MAX_FEATURED_CARDS);
  const totalFiles = planTotalFiles ?? 0;
  const notStartedCount = Math.max(0, totalFiles - filesArr.length);
  const progressPct =
    totalFiles > 0 ? Math.min(100, (completed.length / totalFiles) * 100) : 0;

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleAttachClick() {
    fileInputRef.current?.click();
  }

  function processImageFile(file: File) {
    setImageError(null);
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setImageError("Only PNG, JPEG, GIF, or WebP images are supported.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError("Image is too large (max 5 MB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setAttachedImage({
        mediaType: file.type as ImageAttachment["mediaType"],
        data: dataUrl.split(",")[1] ?? "",
        previewUrl: dataUrl,
      });
    };
    reader.onerror = () =>
      setImageError("Couldn't read that image — try a different file.");
    reader.readAsDataURL(file);
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) processImageFile(file);
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    for (const item of e.clipboardData?.items ?? []) {
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (!file) continue;
        e.preventDefault();
        processImageFile(file);
        break;
      }
    }
  }

  async function submitPrompt() {
    if (!prompt.trim() || sending) return;
    setSending(true);
    try {
      await handleSendFollowUpPrompt({
        projectId,
        prompt: prompt.trim(),
        ...(attachedImage
          ? { image: { mediaType: attachedImage.mediaType, data: attachedImage.data } }
          : {}),
      });
      setPrompt("");
      setAttachedImage(null);
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    submitPrompt();
  }

  return (
    <div
      className="flex h-full flex-col"
      style={{
        background: "#111",
        fontFamily:
          'Inter, "SF Pro Text", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .aap-shimmer {
          background: linear-gradient(
            90deg,
            #4b4b55 0%, #4b4b55 35%,
            #e4e4e7 50%,
            #4b4b55 65%, #4b4b55 100%
          );
          background-size: 200% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          animation: shimmer 2s linear infinite;
        }
        @keyframes blink {
          0%,49%{ opacity:1 } 50%,100%{ opacity:0 }
        }
        @keyframes pulse-dot {
          0%,100%{ opacity:1; transform:scale(1); }
          50%    { opacity:.35; transform:scale(.7); }
        }
        .aap-dot {
          display:inline-block;
          width:5px; height:5px;
          border-radius:9999px;
          background:#71717a;
          animation: pulse-dot 1.1s ease-in-out infinite;
        }
        @keyframes aap-fade-out {
          0%  { opacity:1; }
          60% { opacity:1; }
          100%{ opacity:0; }
        }
        .aap-linger { animation: aap-fade-out ${TERMINAL_LINGER_MS}ms ease forwards; }

        .aap-scroll::-webkit-scrollbar { width:4px; }
        .aap-scroll::-webkit-scrollbar-track { background:transparent; }
        .aap-scroll::-webkit-scrollbar-thumb { background:#27272a; border-radius:2px; }

        .aap-input { field-sizing: content; }
      `}</style>

      {/* ── Header ─────────────────────────────────────────── */}
      <div
        className="flex shrink-0 items-center gap-2 px-4 py-3"
        style={{ borderBottom: "1px solid #1f1f1f" }}
      >
        <Sparkles size={13} style={{ color: "#a78bfa" }} />
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "#e4e4e7",
            letterSpacing: "-0.01em",
          }}
        >
          AI Forge
        </span>
      </div>

      {/* ── Conversation ───────────────────────────────────── */}
      <div
        ref={scrollRef}
        className="aap-scroll min-h-0 flex-1 overflow-y-auto px-4 py-3"
        style={{ display: "flex", flexDirection: "column", gap: 20 }}
      >
        {chatMessages.length === 0 && !workflowActive && (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "flex-end",
              paddingBottom: 4,
            }}
          />
        )}

        {/* Message groups */}
        {chatMessages.map((m) => {
          /* ── system note ── */
          if (m.role === "system") {
            return (
              <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Sparkles size={10} style={{ color: "#7c3aed", flexShrink: 0 }} />
                <span style={{ fontSize: 11.5, color: "#52525b" }}>{m.text}</span>
              </div>
            );
          }

          const isUser = m.role === "user";
          const text = m.text ?? "";
          const isLong = !isUser && text.length > PREVIEW_CHARS;
          const expanded = expandedIds.has(m.id);
          const displayText = isLong && !expanded ? text.slice(0, PREVIEW_CHARS).trimEnd() + "…" : text;

          return (
            <div key={m.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {/* Role label */}
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "#3f3f46",
                  paddingLeft: 2,
                }}
              >
                {isUser ? "You" : "Agent"}
              </span>

              {/* Bubble */}
              <div
                style={{
                  background: "#1a1a1a",
                  border: "1px solid #252525",
                  borderRadius: 8,
                  padding: "8px 11px",
                  fontSize: 13,
                  lineHeight: 1.55,
                  color: "#d4d4d8",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {m.pending ? (
                  <span style={{ display: "inline-flex", gap: 4, alignItems: "center", padding: "2px 0" }}>
                    <span className="aap-dot" style={{ animationDelay: "0ms" }} />
                    <span className="aap-dot" style={{ animationDelay: "160ms" }} />
                    <span className="aap-dot" style={{ animationDelay: "320ms" }} />
                  </span>
                ) : (
                  displayText
                )}
              </div>

              {/* Show more / less */}
              {isLong && !m.pending && (
                <button
                  onClick={() => toggleExpand(m.id)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    background: "none",
                    border: "none",
                    padding: "2px 2px",
                    cursor: "pointer",
                    color: "#52525b",
                    fontSize: 11.5,
                  }}
                >
                  {expanded ? (
                    <>
                      <ChevronUp size={11} /> Show less
                    </>
                  ) : (
                    <>
                      <ChevronDown size={11} /> Show more
                    </>
                  )}
                </button>
              )}
            </div>
          );
        })}

        {/* ── Workflow status (inline, after messages) ─────── */}
        {workflowActive && !showLiveGen && current && (
          <div className={isTerminal(current.phase) ? "aap-linger" : ""}>
            {active ? (
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <Sparkles size={11} style={{ color: "#7c3aed", flexShrink: 0 }} />
                <span className="aap-shimmer" style={{ fontSize: 13, fontWeight: 500 }}>
                  {headline}…
                </span>
              </div>
            ) : current.phase === "error" ? (
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <XCircle size={13} style={{ color: "#f87171", flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: "#a1a1aa" }}>{headline} failed</span>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <CheckCircle2 size={13} style={{ color: "#34d399", flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: "#a1a1aa" }}>{headline} done</span>
              </div>
            )}
          </div>
        )}

        {/* ── Live file gen ─────────────────────────────────── */}
        {showLiveGen && (
          <div
            style={{
              background: "#151515",
              border: "1px solid #252525",
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            {/* Gen header */}
            <div style={{ padding: "10px 12px 8px", borderBottom: "1px solid #1f1f1f" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Sparkles size={11} style={{ color: "#7c3aed" }} />
                <span className="aap-shimmer" style={{ fontSize: 12.5, fontWeight: 500 }}>
                  {headline}…
                </span>
              </div>
              <p style={{ fontSize: 11, color: "#52525b", marginTop: 3 }}>
                Generating {totalFiles} files in parallel
              </p>

              <div
                style={{
                  marginTop: 8,
                  height: 2,
                  width: "100%",
                  background: "#1f1f1f",
                  borderRadius: 1,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${progressPct}%`,
                    background: "#7c3aed",
                    borderRadius: 1,
                    transition: "width 300ms ease",
                  }}
                />
              </div>

              <p style={{ fontSize: 10.5, color: "#3f3f46", marginTop: 4, textAlign: "right" }}>
                {completed.length} / {totalFiles}
              </p>
            </div>

            {/* File list */}
            <div style={{ padding: "6px 4px" }}>
              {featured.map(([path, state]) => (
                <LiveFileGenCard
                  key={path}
                  path={path}
                  content={state.content}
                  onOpen={() => setSelectedFile(path)}
                />
              ))}

              {extraGenerating.map(([path]) => (
                <button
                  key={path}
                  onClick={() => setSelectedFile(path)}
                  style={{
                    display: "flex",
                    width: "100%",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "none",
                    border: "none",
                    padding: "5px 8px",
                    cursor: "pointer",
                    borderRadius: 5,
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                    <Loader2 size={10} style={{ color: "#7c3aed", flexShrink: 0, animation: "spin 1s linear infinite" }} />
                    <span style={{ fontSize: 11.5, color: "#a1a1aa", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {path.split("/").pop()}
                    </span>
                  </span>
                  <span style={{ fontSize: 11, color: "#52525b", flexShrink: 0 }}>Generating…</span>
                </button>
              ))}

              {completed.map(([path]) => (
                <button
                  key={path}
                  onClick={() => setSelectedFile(path)}
                  style={{
                    display: "flex",
                    width: "100%",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "none",
                    border: "none",
                    padding: "5px 8px",
                    cursor: "pointer",
                    borderRadius: 5,
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                    <CheckCircle2 size={11} style={{ color: "#34d399", flexShrink: 0 }} />
                    <span style={{ fontSize: 11.5, color: "#a1a1aa", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {path.split("/").pop()}
                    </span>
                  </span>
                  <span style={{ fontSize: 11, color: "#52525b", flexShrink: 0 }}>Done</span>
                </button>
              ))}

              {notStartedCount > 0 && (
                <p style={{ fontSize: 11, color: "#3f3f46", padding: "4px 8px" }}>
                  + {notStartedCount} more file{notStartedCount === 1 ? "" : "s"}…
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Input ──────────────────────────────────────────── */}
      <div
        className="shrink-0"
        style={{ borderTop: "1px solid #1f1f1f", padding: "10px 12px 12px" }}
      >
        {imageError && (
          <p style={{ fontSize: 11, color: "#f87171", marginBottom: 6 }}>{imageError}</p>
        )}

        {attachedImage && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "#1a1a1a",
              border: "1px solid #252525",
              borderRadius: 7,
              padding: "6px 8px",
              marginBottom: 7,
            }}
          >
            <img
              src={attachedImage.previewUrl}
              alt="Attached"
              style={{ height: 28, width: 28, borderRadius: 4, objectFit: "cover", flexShrink: 0 }}
            />
            <span style={{ flex: 1, fontSize: 11.5, color: "#71717a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              Image attached
            </span>
            <button
              type="button"
              onClick={() => setAttachedImage(null)}
              style={{ background: "none", border: "none", padding: 2, cursor: "pointer", color: "#52525b", display: "flex" }}
            >
              <X size={12} />
            </button>
          </div>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 6,
            background: "#1a1a1a",
            border: "1px solid #252525",
            borderRadius: 9,
            padding: "7px 8px 7px 10px",
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES.join(",")}
            onChange={handleFileSelected}
            style={{ display: "none" }}
          />

          <button
            type="button"
            onClick={handleAttachClick}
            disabled={sending}
            style={{
              background: "none",
              border: "none",
              padding: "3px 4px",
              cursor: "pointer",
              color: "#52525b",
              display: "flex",
              alignItems: "center",
              flexShrink: 0,
              opacity: sending ? 0.4 : 1,
            }}
          >
            <Paperclip size={14} />
          </button>

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onPaste={handlePaste}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submitPrompt();
              }
            }}
            placeholder="Ask the agent…"
            rows={1}
            disabled={sending}
            style={{
              flex: 1,
              resize: "none",
              background: "none",
              border: "none",
              outline: "none",
              fontSize: 13,
              color: "#d4d4d8",
              lineHeight: 1.5,
              maxHeight: 120,
              overflowY: "auto",
              fontFamily: "inherit",
            }}
            className="aap-scroll"
          />

          <button
            type="button"
            onClick={submitPrompt}
            disabled={sending || !prompt.trim()}
            style={{
              background: prompt.trim() && !sending ? "#e4e4e7" : "#27272a",
              border: "none",
              borderRadius: 6,
              width: 28,
              height: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: prompt.trim() && !sending ? "pointer" : "default",
              color: prompt.trim() && !sending ? "#111" : "#52525b",
              flexShrink: 0,
              transition: "background 150ms, color 150ms",
            }}
          >
            <Send size={13} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AgentActivityPanel;
