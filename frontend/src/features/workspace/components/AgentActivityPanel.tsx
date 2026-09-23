// src/components/AgentActivityPanel.tsx

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Send } from "lucide-react";

import socket from "@/sockets/socket";
import type { AgentStatusEvent, AgentStage } from "@/types/agent.types";
import { useProject } from "@/hooks/useProject";

type Props = {
  projectId: string;
};

const isTerminal = (phase: string) => phase.endsWith(":done") || phase === "error";

const STAGE_HEADLINE: Record<AgentStage, string> = {
  setup: "Setting up your project",
  coding: "Building your app",
};

const AgentActivityPanel = ({ projectId }: Props) => {
  const [current, setCurrent] = useState<AgentStatusEvent | null>(null);

  const { handleSendFollowUpPrompt } = useProject();

  const [prompt, setPrompt] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<string | null>(null);

  useEffect(() => {
    const handleAgentStatus = (evt: AgentStatusEvent) => {
      setCurrent(evt);

      // A run just started or completed — any stale confirmation prompt no longer applies.
      setPendingConfirm(null);
    };

    socket.on("agent:status", handleAgentStatus);

    return () => {
      socket.off("agent:status", handleAgentStatus);
    };
  }, [projectId]);

  const active = current && !isTerminal(current.phase);
  const headline = current ? STAGE_HEADLINE[current.stage] : null;

  async function submitPrompt(force: boolean) {
    if (!prompt.trim() || sending) return;

    setSending(true);

    try {
      const result = await handleSendFollowUpPrompt({
        projectId,
        prompt: prompt.trim(),
        force,
      });

      if (result.requiresConfirmation) {
        setPendingConfirm(
          result.message ?? "A run is already in progress. Stop it and continue?"
        );
        return;
      }

      setPrompt("");
      setPendingConfirm(null);
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    submitPrompt(false);
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
      `}</style>

      <div className="border-b border-zinc-800 px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
          Agent
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center px-4">
        {!current && (
          <p className="text-[13px] text-zinc-600">Waiting for agent…</p>
        )}

        {current && (
          <div className="flex items-center gap-2.5">
            {active ? (
              <>
                <span className="agent-dot shrink-0" />
                <span className="text-[14px] font-medium shimmer-text">
                  {headline}…
                </span>
              </>
            ) : current.phase === "error" ? (
              <>
                <XCircle size={15} className="shrink-0 text-red-400" />
                <span className="text-[14px] font-medium text-zinc-300">
                  {headline} failed
                </span>
              </>
            ) : (
              <>
                <CheckCircle2 size={15} className="shrink-0 text-emerald-400" />
                <span className="text-[14px] font-medium text-zinc-300">
                  {headline} done
                </span>
              </>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-zinc-800 p-2.5">
        {pendingConfirm && (
          <div className="mb-2 rounded-md border border-amber-900/50 bg-amber-950/30 p-2.5">
            <p className="text-[12px] leading-snug text-amber-200">
              {pendingConfirm}
            </p>

            <div className="mt-2 flex gap-2">
              <button
                type="button"
                disabled={sending}
                onClick={() => submitPrompt(true)}
                className="
                  rounded
                  bg-amber-500/90
                  px-2.5
                  py-1
                  text-[12px]
                  font-medium
                  text-black
                  hover:bg-amber-400
                  disabled:opacity-50
                "
              >
                Stop it, continue
              </button>

              <button
                type="button"
                disabled={sending}
                onClick={() => setPendingConfirm(null)}
                className="
                  rounded
                  border
                  border-zinc-700
                  px-2.5
                  py-1
                  text-[12px]
                  font-medium
                  text-zinc-300
                  hover:bg-zinc-900
                  disabled:opacity-50
                "
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex items-end gap-1.5">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submitPrompt(false);
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
