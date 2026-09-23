import { Loader2 } from "lucide-react";

const MAX_PREVIEW_LINES = 8;

// Very small regex-based tokenizer — not a real parser, just enough to give
// the preview a "syntax-like" look without pulling in a highlighting library
// for a temporary card whose content is about to be thrown away.
const TOKEN_RE =
  /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|\b(import|export|default|function|return|const|let|var|interface|type|class|extends|implements|async|await|from|new|if|else|for|while|switch|case|break|continue|try|catch|finally|throw|typeof|instanceof|public|private|protected|readonly|static|enum|namespace|as|of|in|void|null|undefined|true|false)\b/g;

function highlightLine(line: string, keyPrefix: string) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let idx = 0;
  let match: RegExpExecArray | null;

  TOKEN_RE.lastIndex = 0;

  while ((match = TOKEN_RE.exec(line)) !== null) {
    if (match.index > lastIndex) {
      parts.push(line.slice(lastIndex, match.index));
    }

    if (match[1]) {
      parts.push(
        <span key={`${keyPrefix}-${idx++}`} className="text-emerald-400/90">
          {match[1]}
        </span>
      );
    } else if (match[2]) {
      parts.push(
        <span key={`${keyPrefix}-${idx++}`} className="text-violet-400">
          {match[2]}
        </span>
      );
    }

    lastIndex = TOKEN_RE.lastIndex;
  }

  if (lastIndex < line.length) {
    parts.push(line.slice(lastIndex));
  }

  return parts.length > 0 ? parts : "\u00A0"; // keep empty lines from collapsing
}

type Props = {
  path: string;
  content: string;
  onOpen: () => void;
};

const LiveFileGenCard = ({ path, content, onOpen }: Props) => {
  const fileName = path.split("/").pop() ?? path;
  const ext = fileName.includes(".") ? fileName.split(".").pop()!.toUpperCase() : "";

  const lines = content.split("\n");
  const startLineNo = Math.max(1, lines.length - MAX_PREVIEW_LINES + 1);
  const visibleLines = lines.slice(-MAX_PREVIEW_LINES);

  return (
    <button
      onClick={onOpen}
      className="
        block
        w-full
        overflow-hidden
        rounded-md
        border
        border-zinc-800
        bg-zinc-950/60
        text-left
        transition-colors
        hover:border-zinc-700
      "
    >
      <div className="flex items-center justify-between border-b border-zinc-800 px-2.5 py-1.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <Loader2 size={12} className="shrink-0 animate-spin text-violet-400" />
          <span className="truncate text-[12px] font-medium text-zinc-200">{fileName}</span>
        </div>

        {ext && (
          <span className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-zinc-400">
            {ext}
          </span>
        )}
      </div>

      <div className="overflow-hidden px-2.5 py-1.5 font-mono text-[10.5px] leading-[15px]">
        {visibleLines.map((line, i) => {
          const isLast = i === visibleLines.length - 1;
          return (
            <div key={startLineNo + i} className="flex">
              <span className="mr-2 w-4 shrink-0 select-none text-right text-zinc-600">
                {startLineNo + i}
              </span>
              <span className="min-w-0 whitespace-pre text-zinc-300">
                {highlightLine(line, `${path}-${startLineNo + i}`)}
                {isLast && <span className="agent-caret-blink text-zinc-400">▌</span>}
              </span>
            </div>
          );
        })}
      </div>
    </button>
  );
};

export default LiveFileGenCard;
