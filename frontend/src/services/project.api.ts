import axios from "axios"

const api = axios.create({
    baseURL: "http://localhost:8000/project",
    withCredentials: true
})



export async function createProject(
    name: string,
    prompt: string,
    setupPrompt:string,
    framework: string,
    backend?: string,
    database?: string,
    architecture?: string,
    connectionString?: string
) {
    const response = await api.post("/createProject", {
        name,
        prompt,
        setupPrompt,
        framework,
        backend,
        database,
        architecture,
        connectionString,
    })

    return response.data
}




export async function getAllProjects() {
    const response = await api.get("/")
    return response.data
}



export async function getProjectDetails(projectId:string) {
    const response = await api.get(`/${projectId}`)
    return response.data
}



export async function deleteProject(projectId:string) {
    const response = await api.delete(`/${projectId}`)
    return response.data
}



export async function sendFollowUpPrompt(projectId: string, prompt: string, force?: boolean) {
    const response = await api.post(`/${projectId}/prompt`, { prompt, force })
    return response.data
}