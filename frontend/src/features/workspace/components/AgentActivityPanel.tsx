// src/components/AgentActivityPanel.tsx

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

import socket from "@/sockets/socket";
import type { AgentStatusEvent, AgentStage } from "@/types/agent.types";

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

  useEffect(() => {
    const handleAgentStatus = (evt: AgentStatusEvent) => {
      setCurrent(evt);
    };

    socket.on("agent:status", handleAgentStatus);

    return () => {
      socket.off("agent:status", handleAgentStatus);
    };
  }, [projectId]);

  const active = current && !isTerminal(current.phase);
  const headline = current ? STAGE_HEADLINE[current.stage] : null;

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
    </div>
  );
};

export default AgentActivityPanel;