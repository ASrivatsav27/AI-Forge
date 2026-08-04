import { useParams } from "react-router-dom";
import { useState ,useEffect} from "react";
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from "react-resizable-panels";

import Terminal from "../components/Terminal";
import ProjectPreview from "../components/ProjectPreview";
import Explorer from "../components/Explorer";
import { useProject } from "@/hooks/useProject";
import MonacoEditor from "../components/MonacoEditor";

const ResizeHandle = () => (
  <PanelResizeHandle className="bg-zinc-800 hover:bg-violet-500 transition-colors data-[panel-group-direction=horizontal]:w-1 data-[panel-group-direction=vertical]:h-1" />
);

const Placeholder = ({ title }: { title: string }) => (
  <div className="flex h-full items-center justify-center border border-zinc-800 bg-zinc-900 text-zinc-500 text-lg font-medium">
    {title}
  </div>
);

const WorkSpacePage = () => {
  const [previewPort, setPreviewPort] = useState<string | null>(null);

  const { projectId } = useParams();
  const {fileTree,handleGetProjectDetails} = useProject()

  useEffect(() => {
  handleGetProjectDetails({
    id: projectId!,
  });
}, [projectId]);


  return (
    <div className="h-screen overflow-hidden">
      <PanelGroup direction="horizontal" autoSaveId="workspace-layout">
        {/* Explorer */}
        <Panel defaultSize={18} minSize={12} maxSize={25}>
          <Explorer/>
        </Panel>

        <ResizeHandle />

        {/* Editor + Terminal */}
        <Panel defaultSize={47} minSize={30}>
          <PanelGroup
            direction="vertical"
            autoSaveId="editor-terminal-layout"
          >
            {/* Editor */}
            <Panel defaultSize={70} minSize={35}>
              <MonacoEditor/>
            </Panel>

            <ResizeHandle />

            {/* Terminal */}
            <Panel defaultSize={30} minSize={15} maxSize={50}>
              <Terminal
                projectId={projectId!}
                setPreviewPort={setPreviewPort}
              />
            </Panel>
          </PanelGroup>
        </Panel>

        <ResizeHandle />

        {/* Preview */}
        <Panel defaultSize={35} minSize={20}>
          <ProjectPreview port={previewPort} />
        </Panel>
      </PanelGroup>
    </div>
  );
};

export default WorkSpacePage;