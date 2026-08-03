import { useParams } from "react-router-dom"
import Terminal from "../components/Terminal"
import ProjectPreview from "../components/ProjectPreview"
import { useState } from "react"

const WorkSpacePage = () => {
 const [previewPort, setPreviewPort] = useState<string | null>(null);

  const {projectId} = useParams()
  return (
      <div className="flex h-screen">
      <Terminal projectId={projectId!}
        setPreviewPort={setPreviewPort}
      />
      <ProjectPreview  port={previewPort}/>
    </div>
  )
}

export default WorkSpacePage