import { useParams } from "react-router-dom"
import Terminal from "../components/Terminal"

const WorkSpacePage = () => {


  const {projectId} = useParams()
  return (
      <div>
          <Terminal projectId={projectId!}/>
    </div>
  )
}

export default WorkSpacePage