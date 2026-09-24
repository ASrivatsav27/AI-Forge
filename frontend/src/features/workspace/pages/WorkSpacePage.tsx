import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from "react-resizable-panels";

import Terminal from "../components/Terminal";
import ProjectPreview from "../components/ProjectPreview";
import Explorer from "../components/Explorer";
import AgentActivityPanel from "../components/AgentActivityPanel";
import { useProject } from "@/hooks/useProject";
import MonacoEditor from "../components/MonacoEditor";

const ResizeHandle = () => (
  <PanelResizeHandle
    className="
      shrink-0
      border-0
      outline-none
      shadow-none
      bg-[var(--ide-border)]
      transition-colors
      hover:bg-[var(--ide-accent)]
      data-[panel-group-direction=horizontal]:w-px
      data-[panel-group-direction=vertical]:h-px
    "
  />
);

const WorkSpacePage = () => {
  const [previewPort, setPreviewPort] = useState<string | null>(null);

  const { projectId } = useParams();

  const { handleGetProjectDetails } = useProject();

  useEffect(() => {
    handleGetProjectDetails({
      id: projectId!,
    });
  }, [projectId]);

  return (
    <div
      className="h-screen w-full overflow-hidden p-[6px]"
      style={{
        background: "#050607",
      }}
    >
      {/* =====================================================
          OUTER IDE FRAME
      ===================================================== */}
      <div
        className="h-full w-full overflow-hidden rounded-[7px]"
        style={{
          background: "var(--ide-bg)",
          border: "1px solid var(--ide-border)",
          boxShadow: "0 8px 30px rgba(0, 0, 0, 0.18)",
        }}
      >
        <PanelGroup
          direction="horizontal"
          autoSaveId="workspace-layout"
          className="h-full w-full !border-0"
        >
          {/* =====================================================
              AGENT
          ===================================================== */}
          <Panel
            defaultSize={16}
            minSize={14}
            maxSize={21}
            className="min-w-0 !border-0"
          >
            <div
              className="h-full w-full overflow-hidden rounded-l-[6px]"
              style={{
                background: "var(--ide-bg)",
              }}
            >
              <AgentActivityPanel projectId={projectId!} />
            </div>
          </Panel>

          <ResizeHandle />

          {/* =====================================================
              EXPLORER
          ===================================================== */}
          <Panel
            defaultSize={17}
            minSize={15}
            maxSize={22}
            className="min-w-0 !border-0"
          >
            <div
              className="h-full w-full overflow-hidden rounded-[4px]"
              style={{
                background: "var(--ide-panel)",
              }}
            >
              <Explorer />
            </div>
          </Panel>

          <ResizeHandle />

          {/* =====================================================
              EDITOR + FIXED TERMINAL
          ===================================================== */}
          <Panel
            defaultSize={39}
            minSize={34}
            className="min-w-0 !border-0"
          >
            <PanelGroup
              direction="vertical"
              className="h-full w-full !border-0"
            >
              {/* ---------------- Editor ---------------- */}
              <Panel
                defaultSize={74}
                minSize={74}
                maxSize={74}
                className="min-h-0 !border-0"
              >
                <div
                  className="h-full w-full overflow-hidden rounded-[4px]"
                  style={{
                    background: "var(--ide-bg)",
                  }}
                >
                  <MonacoEditor />
                </div>
              </Panel>

              {/* Fixed separator — NOT draggable */}
              <div
                className="h-px w-full shrink-0"
                style={{
                  background: "var(--ide-border)",
                }}
              />

              {/* ---------------- Fixed Terminal ---------------- */}
              <Panel
                defaultSize={26}
                minSize={26}
                maxSize={26}
                className="min-h-0 !border-0"
              >
                <div
                  className="h-full w-full overflow-hidden rounded-[4px]"
                  style={{
                    background: "var(--ide-panel)",
                  }}
                >
                  <Terminal
                    projectId={projectId!}
                    setPreviewPort={setPreviewPort}
                  />
                </div>
              </Panel>
            </PanelGroup>
          </Panel>

          <ResizeHandle />

          {/* =====================================================
              PREVIEW
          ===================================================== */}
          <Panel
            defaultSize={28}
            minSize={24}
            maxSize={34}
            className="min-w-0 !border-0"
          >
            <div
              className="h-full w-full overflow-hidden rounded-r-[6px]"
              style={{
                background: "var(--ide-bg)",
              }}
            >
              <ProjectPreview port={previewPort} />
            </div>
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
};

export default WorkSpacePage;