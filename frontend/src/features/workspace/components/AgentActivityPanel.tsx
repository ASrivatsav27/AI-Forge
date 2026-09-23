// src/components/AgentActivityPanel.tsx

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Send, Sparkles, Loader2 } from "lucide-react";

import socket from "@/sockets/socket";
import type { AgentStatusEvent, AgentStage } from "@/types/agent.types";
import { useProject } from "@/hooks/useProject";
import LiveFileGenCard from "./LiveFileGenCard";

type Props = {
  projectId: string;
};

const isTerminal = (phase: string) => phase.endsWith(":done") || phase === "error";

const STAGE_HEADLINE: Record<AgentStage, string> = {
  setup: "Setting up your project",
  coding: "Building your app",
};

const MAX_FEATURED_CARDS = 3;

const AgentActivityPanel = ({ projectId }: Props) => {
  const [current, setCurrent] = useState<AgentStatusEvent | null>(null);

  const { handleSendFollowUpPrompt, fileGenState, planTotalFiles, selectedFile, setSelectedFile } = useProject();

  const [prompt, setPrompt] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const handleAgentStatus = (evt: AgentStatusEvent) => setCurrent(evt);

    socket.on("agent:status", handleAgentStatus);

    return () => {
      socket.off("agent:status", handleAgentStatus);
    };
  }, []);

  const active = current && !isTerminal(current.phase);
  const headline = current ? STAGE_HEADLINE[current.stage] : null;

  const showLiveGen = planTotalFiles !== null && active;

  const filesArr = Object.entries(fileGenState).sort((a, b) => a[1].startedAt - b[1].startedAt);
  // The file currently shown live in Monaco is never also rendered as a
  // generation card — it already has a dedicated, more detailed view.
  const generating = filesArr.filter(
    ([path, s]) => s.status === "generating" && path !== selectedFile
  );
  const completed = filesArr.filter(([, s]) => s.status === "done");

  const featured = generating.slice(0, MAX_FEATURED_CARDS);
  const extraGenerating = generating.slice(MAX_FEATURED_CARDS);

  const totalFiles = planTotalFiles ?? 0;
  const accountedFor = filesArr.length;
  const notStartedCount = Math.max(0, totalFiles - accountedFor);
  const progressPct = totalFiles > 0 ? Math.min(100, (completed.length / totalFiles) * 100) : 0;

  async function submitPrompt() {
    if (!prompt.trim() || sending) return;

    setSending(true);

    try {
      await handleSendFollowUpPrompt({
        projectId,
        prompt: prompt.trim(),
      });

      setPrompt("");
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
    <div className="flex h-full flex-col bg-black">
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .shimmer-text {
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
          animation: shimmer 2s linear infinite;
        }
        @keyframes dot-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.75); }
        }
        .agent-dot {
          width: 7px;
          height: 7px;
          border-radius: 9999px;
          background: #d4d4d8;
          animation: dot-pulse 1.1s ease-in-out infinite;
        }
        @keyframes caret-blink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
        .agent-caret-blink {
          animation: caret-blink 1s step-end infinite;
        }
      `}</style>

      <div className="border-b border-zinc-800 px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
          Agent
        </p>
      </div>

      {!showLiveGen && (
        <div className="flex flex-1 items-center justify-center px-4">
          {!current && <p className="text-[13px] text-zinc-600">Waiting for agent…</p>}

          {current && (
            <div className="flex items-center gap-2.5">
              {active ? (
                <>
                  <span className="agent-dot shrink-0" />
                  <span className="text-[14px] font-medium shimmer-text">{headline}…</span>
                </>
              ) : current.phase === "error" ? (
                <>
                  <XCircle size={15} className="shrink-0 text-red-400" />
                  <span className="text-[14px] font-medium text-zinc-300">{headline} failed</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={15} className="shrink-0 text-emerald-400" />
                  <span className="text-[14px] font-medium text-zinc-300">{headline} done</span>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {showLiveGen && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="border-b border-zinc-800 px-3 py-2.5">
            <div className="flex items-center gap-1.5">
              <Sparkles size={13} className="shrink-0 text-violet-400" />
              <span className="text-[13px] font-medium text-zinc-200">{headline}…</span>
            </div>
            <p className="mt-0.5 text-[11px] text-zinc-500">
              Generating {totalFiles} files in parallel
            </p>

            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-violet-500 transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="mt-1 text-right text-[10.5px] text-zinc-500">
              {completed.length} / {totalFiles}
            </p>
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-2.5">
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
                className="flex w-full items-center justify-between rounded px-1.5 py-1 text-left hover:bg-zinc-900"
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <Loader2 size={11} className="shrink-0 animate-spin text-violet-400" />
                  <span className="truncate text-[12px] text-zinc-300">
                    {path.split("/").pop()}
                  </span>
                </span>
                <span className="shrink-0 text-[11px] text-zinc-500">Generating…</span>
              </button>
            ))}

            {completed.map(([path]) => (
              <button
                key={path}
                onClick={() => setSelectedFile(path)}
                className="flex w-full items-center justify-between rounded px-1.5 py-1 text-left hover:bg-zinc-900"
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <CheckCircle2 size={12} className="shrink-0 text-emerald-400" />
                  <span className="truncate text-[12px] text-zinc-300">
                    {path.split("/").pop()}
                  </span>
                </span>
                <span className="shrink-0 text-[11px] text-zinc-500">Done</span>
              </button>
            ))}

            {notStartedCount > 0 && (
              <p className="px-1.5 py-1 text-[11px] text-zinc-600">
                + {notStartedCount} more file{notStartedCount === 1 ? "" : "s"}…
              </p>
            )}
          </div>

          <div className="flex items-start gap-2 border-t border-zinc-800 px-3 py-2">
            <Sparkles size={12} className="mt-0.5 shrink-0 text-zinc-600" />
            <p className="text-[10.5px] leading-snug text-zinc-600">
              These updates are temporary. They&apos;ll disappear once the build is complete.
            </p>
          </div>
        </div>
      )}

      <div className="border-t border-zinc-800 p-2.5">
        <form onSubmit={handleSubmit} className="flex items-end gap-1.5">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submitPrompt();
              }
            }}
            placeholder="Ask the agent for changes…"
            rows={2}
            disabled={sending}
            className="
              flex-1
              resize-none
              rounded-md
              border
              border-zinc-800
              bg-zinc-900
              px-2.5
              py-2
              text-[13px]
              text-white
              outline-none
              placeholder:text-zinc-600
              focus:border-zinc-600
              disabled:opacity-60
            "
          />

          <button
            type="submit"
            disabled={sending || !prompt.trim()}
            className="
              flex
              h-[34px]
              w-[34px]
              shrink-0
              items-center
              justify-center
              rounded-md
              bg-white
              text-black
              hover:bg-zinc-200
              disabled:opacity-40
            "
          >
            <Send size={14} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default AgentActivityPanel;
