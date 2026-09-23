import { ExternalLink } from "lucide-react";

type Props = {
  port: string | null;
};

const ProjectPreview = ({ port }: Props) => {
  const previewUrl = port ? `http://localhost:${port}` : null;

  if (!previewUrl) {
    return (
      <div className="flex h-full items-center justify-center bg-zinc-950">
        <p className="text-sm text-zinc-600">Waiting for preview…</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-[#1f1f1f] bg-[#111] px-3">
        <span className="truncate font-mono text-[11.5px] text-zinc-600">
          localhost:{port}
        </span>

        <a
          href={previewUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Open in new tab"
          className="ml-2 flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[5px] text-zinc-600 transition-colors duration-100 hover:bg-[#1f1f1f] hover:text-zinc-200"
        >
          <ExternalLink size={13} />
        </a>
      </div>

      {/* iframe */}
      <iframe
        src={previewUrl}
        title="Project Preview"
        className="min-h-0 w-full flex-1 border-0"
      />
    </div>
  );
};

export default ProjectPreview;