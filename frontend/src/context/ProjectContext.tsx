import type { Project,ProjectDetails,ProjectDetailsPayload,FileTree,createProjectPayload,DeleteProjectPayload,SendFollowUpPromptPayload,FollowUpPromptResult } from "@/types/project.types";
import type { FileStreamStartEvent, FileStreamEndEvent } from "@/types/agent.types";
import { createContext,useState,useEffect,type ReactNode } from "react";
import axios from "axios";
import { createProject,getAllProjects,getProjectDetails,deleteProject,sendFollowUpPrompt } from "@/services/project.api";
import socket from "@/sockets/socket";


type ProjectContextType = {
    projects: Project[];
    project: ProjectDetails | null;
    fileTree: FileTree;
    loading: boolean;

    selectedFile: string | null;
    setSelectedFile: React.Dispatch<React.SetStateAction<string | null>>;
    setFileTree: React.Dispatch<React.SetStateAction<FileTree>>

    handleCreateProject: (payload: createProjectPayload) => Promise<void>;
    handleGetAllProjects: () => Promise<void>;
    handleGetProjectDetails: (payload: ProjectDetailsPayload) => Promise<void>;
    handleDeleteProject: (payload: DeleteProjectPayload) => Promise<void>;
    handleSendFollowUpPrompt: (payload: SendFollowUpPromptPayload) => Promise<FollowUpPromptResult>;

    /** path -> current agent activity, for file-tree badges. Absent = idle. */
    fileActivity: Record<string, "writing" | "done">;
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
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [fileActivity, setFileActivity] = useState<Record<string, "writing" | "done">>({});

    useEffect(() => {
        const handleStreamStart = ({ path }: FileStreamStartEvent) => {
            setFileActivity((prev) => ({ ...prev, [path]: "writing" }));
            setSelectedFile(path);
        };

        const handleStreamEnd = ({ path }: FileStreamEndEvent) => {
            setFileActivity((prev) => ({ ...prev, [path]: "done" }));

            // Clear the "done" flash after a moment so it doesn't linger forever.
            setTimeout(() => {
                setFileActivity((prev) => {
                    if (prev[path] !== "done") return prev;
                    const next = { ...prev };
                    delete next[path];
                    return next;
                });
            }, 1800);
        };

        socket.on("agent:file-stream-start", handleStreamStart);
        socket.on("agent:file-stream-end", handleStreamEnd);

        return () => {
            socket.off("agent:file-stream-start", handleStreamStart);
            socket.off("agent:file-stream-end", handleStreamEnd);
        };
    }, []);
    

    const handleCreateProject = async(payload:createProjectPayload) => {
       setLoading(true)
       try {
           const data = await createProject(
               payload.name,
               payload.prompt,
               payload.setupPrompt,
               payload.framework,
               payload.backend,
               payload.database,
               payload.architecture,
               payload.connectionString
           )
   
           setProjects(prev => [...prev, data.project]);
   
           return data.project;
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


    const handleSendFollowUpPrompt = async (payload: SendFollowUpPromptPayload): Promise<FollowUpPromptResult> => {
        try {
            await sendFollowUpPrompt(payload.projectId, payload.prompt, payload.force)
            return { requiresConfirmation: false }
        } catch (err) {
            if (
                axios.isAxiosError(err) &&
                err.response?.status === 409 &&
                err.response.data?.requiresConfirmation
            ) {
                return {
                    requiresConfirmation: true,
                    message: err.response.data?.message,
                }
            }
            console.error(err)
            throw err
        }
    }


    return (
        <ProjectContext.Provider value={{
            fileTree,
            project,
            projects,
            handleCreateProject,
            handleGetAllProjects,
            handleDeleteProject,
            handleGetProjectDetails,
            handleSendFollowUpPrompt,
            fileActivity,
            selectedFile,
            setSelectedFile,
            loading,
            setFileTree
        }}>
            {children}
        </ProjectContext.Provider>
    )
}