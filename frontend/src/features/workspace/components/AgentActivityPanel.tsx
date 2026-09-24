import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  Check,
  CheckCircle2,
  Loader2,
  Paperclip,
  Send,
  Sparkles,
  X,
} from "lucide-react";

import socket from "@/sockets/socket";
import type { AgentStatusEvent } from "@/types/agent.types";
import { useProject } from "@/hooks/useProject";

type Props = {
  projectId: string;
};

const isTerminal = (phase: string) =>
  phase.endsWith(":done") || phase === "error";

const getFileName = (path: string) => {
  const parts = path.split("/");
  return parts[parts.length - 1] || path;
};

const getExtension = (path: string) => {
  const name = getFileName(path);
  const parts = name.split(".");

  if (parts.length < 2) return "FILE";

  return parts[parts.length - 1].toUpperCase();
};

const getUserFacingStatus = (current: AgentStatusEvent) => {
  if (current.phase === "error") {
    return current.stage === "setup"
      ? "Project setup failed"
      : "Building your project failed";
  }

  if (current.phase.endsWith(":done")) {
    return current.stage === "setup"
      ? "Project setup done"
      : "Building your project done";
  }

  return current.stage === "setup"
    ? "Setting up your project"
    : "Building your project";
};

const AgentActivityPanel = ({ projectId }: Props) => {
  const {
    chatMessages,
    fileGenState,
    planTotalFiles,
    handleSendFollowUpPrompt,
  } = useProject();

  const [current, setCurrent] = useState<AgentStatusEvent | null>(null);
  const [prompt, setPrompt] = useState("");
  const [sending, setSending] = useState(false);

  const [image, setImage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleAgentStatus = (evt: AgentStatusEvent) => {
      setCurrent(evt);
    };

    socket.on("agent:status", handleAgentStatus);

    return () => {
      socket.off("agent:status", handleAgentStatus);
    };
  }, [projectId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [chatMessages]);

  /*
   * Clipboard image support.
   *
   * This intentionally only handles images. Normal text paste is left
   * completely untouched so the input behaves like a normal text field.
   */
  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    // Rich-text sources (Word, Docs, Notion, PDFs, etc.) often carry both a
    // plain-text representation AND an embedded image/thumbnail alongside
    // it. Real text always wins — only fall through to image-attach when
    // there's no text on the clipboard at all (a genuine image copy).
    const text = event.clipboardData.getData("text/plain");
    if (text) return;

    const items = Array.from(event.clipboardData.items);

    const imageItem = items.find((item) =>
      item.type.startsWith("image/")
    );

    if (!imageItem) return;

    event.preventDefault();

    const file = imageItem.getAsFile();

    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        setImage(reader.result);
      }
    };

    reader.readAsDataURL(file);
  };

  const handleImageFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      event.target.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        setImage(reader.result);
      }
    };

    reader.readAsDataURL(file);

    event.target.value = "";
  };

  const removeImage = () => {
    setImage(null);
  };

  const parseDataUrl = (dataUrl: string): { mediaType: string; data: string } | null => {
    const match = dataUrl.match(/^data:(image\/(?:png|jpeg|gif|webp));base64,(.+)$/);
    if (!match) return null;
    return { mediaType: match[1]!, data: match[2]! };
  };

  const generationFiles = useMemo(
    () => Object.entries(fileGenState),
    [fileGenState]
  );

  const generatingFiles = generationFiles.filter(
    ([, file]) => file.status === "generating"
  );

  const completedFiles = generationFiles.filter(
    ([, file]) => file.status === "done"
  );

  const completedCount = completedFiles.length;

  const total =
    planTotalFiles && planTotalFiles > 0
      ? planTotalFiles
      : generationFiles.length;

  const progress =
    total > 0 ? Math.min(100, (completedCount / total) * 100) : 0;

  const isGenerating =
    current?.stage === "coding" &&
    current.phase !== "coding:done" &&
    current.phase !== "error" &&
    (generatingFiles.length > 0 || total > 0);

  const liveCards = generatingFiles.slice(0, 3);

  const remainingGenerating = Math.max(
    0,
    generatingFiles.length - liveCards.length
  );

  const sendPrompt = async (event?: FormEvent) => {
    event?.preventDefault();

    const value = prompt.trim();

    if ((!value && !image) || sending) return;

    setSending(true);

    const currentImage = image;

    setPrompt("");
    setImage(null);

    const parsedImage = currentImage ? parseDataUrl(currentImage) : null;

    try {
      await handleSendFollowUpPrompt({
        projectId,
        prompt: value,
        force: false,
        image: parsedImage ?? undefined,
      });
    } catch (error) {
      console.error("Failed to send agent prompt:", error);

      setPrompt(value);
      setImage(currentImage);
    } finally {
      setSending(false);
    }
  };

  const active = current && !isTerminal(current.phase);

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-black text-zinc-200">
      <style>{`
        @keyframes agent-shimmer {
          0% {
            background-position: 200% 0;
          }

          100% {
            background-position: -200% 0;
          }
        }

        .agent-shimmer {
          background: linear-gradient(
            90deg,
            #52525b 0%,
            #52525b 35%,
            #f4f4f5 50%,
            #52525b 65%,
            #52525b 100%
          );
          background-size: 200% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          animation: agent-shimmer 2s linear infinite;
        }

        @keyframes agent-pulse {
          0%,
          100% {
            opacity: 1;
            transform: scale(1);
          }

          50% {
            opacity: 0.4;
            transform: scale(0.75);
          }
        }

        .agent-pulse {
          animation: agent-pulse 1.1s ease-in-out infinite;
        }

        .agent-scroll::-webkit-scrollbar {
          width: 6px;
        }

        .agent-scroll::-webkit-scrollbar-track {
          background: #000000;
        }

        .agent-scroll::-webkit-scrollbar-thumb {
          background: #202020;
          border-radius: 999px;
        }

        .agent-scroll::-webkit-scrollbar-thumb:hover {
          background: #2a2a2a;
        }
      `}</style>

      {/* HEADER */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-[#1F1F1F] bg-black px-3">
        <div className="flex items-center gap-2">
          <Sparkles
            size={12}
            strokeWidth={1.7}
            className="text-violet-400"
          />

          <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-400">
            Agent
          </span>
        </div>

        {active && (
          <span className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.08em] text-zinc-600">
            <span className="agent-pulse h-1.5 w-1.5 rounded-full bg-violet-400" />
            Working
          </span>
        )}
      </div>

      {/* CONTENT */}
      <div className="agent-scroll min-h-0 flex-1 overflow-y-auto bg-black">
        <div className="flex min-h-full flex-col">

          {/* EMPTY */}
          {!chatMessages.length && !isGenerating && !current && (
            <div className="flex flex-1 items-center justify-center px-5">
              <div className="text-center">
                <p className="text-[12px] font-normal leading-[1.5] text-zinc-600">
                  Waiting for agent…
                </p>
              </div>
            </div>
          )}

          {/* CHAT */}
          {chatMessages.length > 0 && (
            <div className="space-y-3 bg-black px-3 py-3">
              {chatMessages.map((message) => {
                if (message.pending) {
                  return (
                    <div
                      key={message.id}
                      className="flex items-center gap-2 px-1"
                    >
                      <span className="agent-pulse h-1.5 w-1.5 rounded-full bg-blue-400" />

                      <span className="text-[10px] font-normal text-zinc-600">
                        Agent is thinking…
                      </span>
                    </div>
                  );
                }

                if (message.role === "system") {
                  return (
                    <div
                      key={message.id}
                      className="flex items-center gap-2 py-1"
                    >
                      <div className="h-px flex-1 bg-[#171717]" />

                      <span className="shrink-0 text-[9px] font-normal uppercase tracking-[0.06em] text-zinc-700">
                        {message.text}
                      </span>

                      <div className="h-px flex-1 bg-[#171717]" />
                    </div>
                  );
                }

                const isAgent = message.role === "agent";

                return (
                  <div
                    key={message.id}
                    className={`flex ${
                      isAgent ? "justify-start" : "justify-end"
                    }`}
                  >
                    <div
                      className={[
                        "max-w-[92%]",
                        "rounded-[6px]",
                        "border",
                        "px-2.5 py-2",
                        "text-[12px]",
                        "font-normal",
                        "leading-[1.55]",
                        isAgent
                          ? "border-blue-500/20 bg-blue-500/[0.07] text-zinc-300"
                          : "border-[#242424] bg-[#151515] text-zinc-300",
                      ].join(" ")}
                    >
                      {isAgent && (
                        <div className="mb-1.5 flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />

                          <span className="text-[9px] font-medium uppercase tracking-[0.08em] text-blue-400/80">
                            Agent
                          </span>
                        </div>
                      )}

                      {message.imageDataUrl && (
                        <img
                          src={message.imageDataUrl}
                          alt="Attached"
                          className="mb-1.5 max-h-40 w-auto rounded-[4px] object-cover"
                        />
                      )}

                      <div className="whitespace-pre-wrap break-words">
                        {message.text}
                      </div>
                    </div>
                  </div>
                );
              })}

              <div ref={messagesEndRef} />
            </div>
          )}

          {/* GENERATION */}
          {isGenerating && (
            <div className="border-t border-[#171717] bg-black px-3 pb-4 pt-3">
              <div className="mb-3">
                <div className="flex items-center gap-2">
                  <span className="agent-pulse h-1.5 w-1.5 rounded-full bg-violet-400" />

                  <span className="text-[12px] font-medium leading-[1.4] text-zinc-300">
                    Building your app...
                  </span>
                </div>

                <div className="mt-1 pl-3.5 text-[10px] font-normal text-zinc-600">
                  Generating {total || "—"} files in parallel
                </div>
              </div>

              <div className="mb-3">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[9px] font-normal uppercase tracking-[0.06em] text-zinc-700">
                    Progress
                  </span>

                  <span className="font-mono text-[9px] text-zinc-500">
                    {completedCount} / {total || 0}
                  </span>
                </div>

                <div className="h-[2px] overflow-hidden rounded-full bg-[#1A1A1A]">
                  <div
                    className="h-full rounded-full bg-violet-500 transition-[width] duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                {liveCards.map(([path, file]) => (
                  <div
                    key={path}
                    className="overflow-hidden rounded-[6px] border border-[#202020] bg-[#111111]"
                  >
                    <div className="flex h-7 items-center justify-between border-b border-[#1C1C1C] px-2">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className="agent-pulse h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />

                        <span className="truncate font-mono text-[9px] font-normal text-zinc-400">
                          {getFileName(path)}
                        </span>
                      </div>

                      <span className="ml-2 shrink-0 rounded-[3px] border border-violet-500/20 bg-violet-500/[0.07] px-1 py-0.5 font-mono text-[8px] font-normal text-violet-300/70">
                        {getExtension(path)}
                      </span>
                    </div>

                    <div className="relative max-h-[88px] overflow-hidden bg-[#0A0A0A] px-2 py-1.5">
                      <pre className="overflow-hidden font-mono text-[8px] font-normal leading-[1.55] text-zinc-600">
                        {file.content
                          ? file.content.slice(-900)
                          : "// generating..."}
                      </pre>

                      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[#0A0A0A] to-transparent" />

                      <span className="absolute bottom-2 right-2 h-2 w-[1px] bg-violet-400/70" />
                    </div>
                  </div>
                ))}

                {remainingGenerating > 0 && (
                  <div className="px-1 pt-0.5 text-[9px] font-normal text-zinc-700">
                    + {remainingGenerating} more file
                    {remainingGenerating !== 1 ? "s" : ""}...
                  </div>
                )}
              </div>

              {completedFiles.length > 0 && (
                <div className="mt-3 space-y-1 border-t border-[#171717] pt-2">
                  {completedFiles
                    .slice(-4)
                    .reverse()
                    .map(([path]) => (
                      <div
                        key={path}
                        className="flex items-center gap-1.5 px-1 py-0.5"
                      >
                        <Check
                          size={10}
                          strokeWidth={2}
                          className="text-emerald-500"
                        />

                        <span className="truncate font-mono text-[9px] font-normal text-zinc-600">
                          {getFileName(path)}
                        </span>

                        <span className="ml-auto text-[8px] font-normal text-emerald-500/60">
                          Done
                        </span>
                      </div>
                    ))}
                </div>
              )}

              <div className="mt-3 rounded-[5px] border border-[#1A1A1A] bg-[#0B0B0B] px-2 py-1.5">
                <div className="flex gap-1.5">
                  <Sparkles
                    size={10}
                    className="mt-0.5 shrink-0 text-violet-400/70"
                  />

                  <div>
                    <p className="text-[9px] font-normal text-zinc-500">
                      These updates are temporary
                    </p>

                    <p className="mt-0.5 text-[8px] font-normal text-zinc-700">
                      They'll disappear once the build is complete.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STATUS */}
          {!isGenerating && current && !chatMessages.length && (
            <div className="flex flex-1 items-center justify-center bg-black px-4">
              <div className="flex items-center gap-2.5">
                {active ? (
                  <>
                    <span className="agent-pulse h-[7px] w-[7px] shrink-0 rounded-full bg-zinc-300" />

                    <span className="agent-shimmer text-[12px] font-medium">
                      {getUserFacingStatus(current)}…
                    </span>
                  </>
                ) : current.phase === "error" ? (
                  <>
                    <X
                      size={14}
                      strokeWidth={1.7}
                      className="shrink-0 text-red-400"
                    />

                    <span className="text-[12px] font-normal text-zinc-400">
                      {getUserFacingStatus(current)}
                    </span>
                  </>
                ) : (
                  <>
                    <CheckCircle2
                      size={14}
                      strokeWidth={1.7}
                      className="shrink-0 text-emerald-500"
                    />

                    <span className="text-[12px] font-normal text-zinc-400">
                      {getUserFacingStatus(current)}
                    </span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* INPUT */}
      <form
        onSubmit={sendPrompt}
        className="shrink-0 border-t border-[#1F1F1F] bg-black p-2"
      >
        {image && (
          <div className="mb-2 flex items-center gap-2 rounded-[6px] border border-[#202020] bg-[#111111] p-1.5">
            <img
              src={image}
              alt="Attachment preview"
              className="h-10 w-10 rounded-[4px] object-cover"
            />

            <div className="min-w-0 flex-1">
              <p className="text-[10px] text-zinc-400">
                Image attached
              </p>

              <p className="text-[8px] text-zinc-700">
                Ready to send to the agent
              </p>
            </div>

            <button
              type="button"
              onClick={removeImage}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] text-zinc-600 hover:bg-[#1A1A1A] hover:text-zinc-300"
            >
              <X size={12} />
            </button>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageFile}
          className="hidden"
        />

        <div className="flex min-h-[38px] items-center gap-1 rounded-[6px] border border-[#242424] bg-[#111111] px-2 transition-colors focus-within:border-[#303030]">
          <button
            type="button"
            title="Attach image"
            onClick={() => fileInputRef.current?.click()}
            disabled={sending}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[5px] text-zinc-600 transition-colors hover:bg-[#1A1A1A] hover:text-zinc-300 disabled:opacity-40"
          >
            <Paperclip size={13} strokeWidth={1.7} />
          </button>

          <input
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onPaste={handlePaste}
            disabled={sending}
            placeholder="Ask the agent..."
            className="min-w-0 flex-1 bg-transparent px-1 text-[12px] font-normal leading-none text-zinc-300 outline-none placeholder:text-zinc-700"
          />

          <button
            type="submit"
            disabled={(!prompt.trim() && !image) || sending}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[5px] text-zinc-600 transition-colors hover:bg-violet-500/10 hover:text-violet-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {sending ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Send size={12} strokeWidth={1.7} />
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AgentActivityPanel;