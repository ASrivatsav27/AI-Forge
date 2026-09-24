import { ExternalLink, RefreshCw } from "lucide-react";
import { useRef } from "react";

type Props = {
  port: string | null;
};

const ProjectPreview = ({ port }: Props) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const previewUrl = port
    ? `http://localhost:${port}`
    : null;

  const refresh = () => {
    if (iframeRef.current) {
      iframeRef.current.src =
        iframeRef.current.src;
    }
  };

  if (!previewUrl) {
    return (
      <div
        className="flex h-full items-center justify-center"
        style={{
          background: "#121314",
        }}
      >
        <p
          className="text-[12px]"
          style={{
            color: "#686D75",
          }}
        >
          Waiting for preview…
        </p>
      </div>
    );
  }

  return (
    <div
      className="flex h-full flex-col"
      style={{
        background: "#121314",
      }}
    >
      {/* Preview toolbar */}
      <div
        className="flex h-8 shrink-0 items-center justify-between border-b px-2"
        style={{
          background: "#0B0C0D",
          borderColor: "#25282C",
        }}
      >
        {/* URL */}
        <span
          className="truncate font-mono text-[10.5px]"
          style={{
            color: "#686D75",
          }}
        >
          localhost:{port}
        </span>

        {/* Controls */}
        <div className="flex items-center gap-0.5">
          {/* Open in new tab */}
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Open in new tab"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] transition-colors duration-100"
            style={{
              color: "#858A93",
              textDecoration: "none",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background =
                "#191B1F";
              e.currentTarget.style.color =
                "#E4E4E7";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background =
                "transparent";
              e.currentTarget.style.color =
                "#858A93";
            }}
          >
            <ExternalLink size={12} />
          </a>

          {/* Refresh */}
          <button
            onClick={refresh}
            title="Refresh preview"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] transition-colors duration-100"
            style={{
              color: "#858A93",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background =
                "#191B1F";
              e.currentTarget.style.color =
                "#E4E4E7";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background =
                "transparent";
              e.currentTarget.style.color =
                "#858A93";
            }}
          >
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {/* Preview iframe */}
      <iframe
        ref={iframeRef}
        src={previewUrl}
        title="Project Preview"
        className="min-h-0 w-full flex-1 border-0"
      />
    </div>
  );
};

export default ProjectPreview;