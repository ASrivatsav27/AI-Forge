import type { Project,ProjectDetails,ProjectDetailsPayload,FileTree, createProjectPayload, DeleteProjectPayload } from "@/types/project.types";
import { createContext, useState, type ReactNode } from "react";
import { createProject,getAllProjects,getProjectDetails,deleteProject } from "@/services/project.api";


type ProjectContextType = {
    projects: Project[];
    project: ProjectDetails | null;
    fileTree: FileTree;
    loading: boolean;

    handleCreateProject: (payload: createProjectPayload) => Promise<void>;
    handleGetAllProjects: () => Promise<void>;
    handleGetProjectDetails: (payload: ProjectDetailsPayload) => Promise<void>;
    handleDeleteProject: (payload: DeleteProjectPayload) => Promise<void>;
};


export const ProjectContext = createContext<ProjectContextType | null>(null)

type ProjectProps = {
    children:ReactNode
}


export function ProjectProvider({ children }: ProjectProps) {
    
    const [projects, setProjects] = useState<Project[]>([]);
    const [project, setProject] = useState<ProjectDetails | null>(null);
    const [loading, setLoading] = useState(false);
    const [fileTree, setFileTree] = useState<FileTree>({});

    const handleCreateProject = async(payload:createProjectPayload) => {
        setLoading(true)
        try {
            const data = await createProject(payload.name)
            setProjects(prev => [...prev, data.project]);
        } catch (err) {
            console.error(err)
            throw err
        } finally {
            setLoading(false)
        }
    }
    
    

    const handleGetProjectDetails = async (payload:ProjectDetailsPayload) => {
        setLoading(true)
        try {
            const data = await getProjectDetails(payload.id)
            setProject(data.project)
            setFileTree(data.fileTree)
        }catch (err) {
            console.error(err)
            throw err
        } finally {
            setLoading(false)
        }
    }

    const handleGetAllProjects = async () => {
        setLoading(true)
        try {
            const data = await getAllProjects()
            setProjects(data.projects)
        } catch (err) {
            console.error(err)
            throw err
        } finally {
            setLoading(false)
        }
    }
   
    const handleDeleteProject = async (payload:DeleteProjectPayload) => {
        setLoading(true)
        try {
            await deleteProject(payload.id)
            
        setProjects(prev =>
            prev.filter(project => project.id !== payload.id)
        );
        } catch (err) {
            console.log(err)
            throw err
        } finally {
            setLoading(false)
        }
    }


    return (<ProjectContext.Provider value={{fileTree,project,projects,handleCreateProject,handleGetAllProjects,handleDeleteProject,handleGetProjectDetails,loading}}>
            {children}
           </ProjectContext.Provider>
        )
}