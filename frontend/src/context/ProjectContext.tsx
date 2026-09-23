import type {
    Project,
    ProjectDetails,
    ProjectDetailsPayload,
    FileTree,
    createProjectPayload,
    DeleteProjectPayload,
    SendFollowUpPromptPayload,
    FollowUpPromptResult,
} from "@/types/project.types";

import type {
    FileStreamStartEvent,
    FileDeltaEvent,
    FileStreamEndEvent,
    AgentStatusEvent,
} from "@/types/agent.types";

import { createContext, useState, useEffect, useRef, type ReactNode } from "react";
import axios from "axios";

import {
    createProject,
    getAllProjects,
    getProjectDetails,
    deleteProject,
    sendFollowUpPrompt,
} from "@/services/project.api";

import socket from "@/sockets/socket";

type FileGenerationState = {
    status: "generating" | "done";
    content: string;
    startedAt: number;
};

type ProjectContextType = {
    projects: Project[];
    project: ProjectDetails | null;
    fileTree: FileTree;
    loading: boolean;

    selectedFile: string | null;
    setSelectedFile: React.Dispatch<React.SetStateAction<string | null>>;
    setFileTree: React.Dispatch<React.SetStateAction<FileTree>>;

    handleCreateProject: (payload: createProjectPayload) => Promise<void>;
    handleGetAllProjects: () => Promise<void>;
    handleGetProjectDetails: (
        payload: ProjectDetailsPayload
    ) => Promise<void>;
    handleDeleteProject: (
        payload: DeleteProjectPayload
    ) => Promise<void>;
    handleSendFollowUpPrompt: (
        payload: SendFollowUpPromptPayload
    ) => Promise<FollowUpPromptResult>;

    /** path -> current agent activity, for file-tree badges. Absent = idle. */
    fileActivity: Record<string, "writing" | "done">;

    /** path -> live generation state for the current coding run. */
    fileGenState: Record<string, FileGenerationState>;

    /** Total files in the current run's plan. */
    planTotalFiles: number | null;
};

export const ProjectContext = createContext<ProjectContextType | null>(null);

type ProjectProps = {
    children: ReactNode;
};

export function ProjectProvider({ children }: ProjectProps) {
    const [projects, setProjects] = useState<Project[]>([]);
    const [project, setProject] = useState<ProjectDetails | null>(null);
    const [loading, setLoading] = useState(false);
    const [fileTree, setFileTree] = useState<FileTree>({});
    const [selectedFile, setSelectedFile] = useState<string | null>(null);

    const [fileActivity, setFileActivity] = useState<
        Record<string, "writing" | "done">
    >({});

    const [fileGenState, setFileGenState] = useState<
        Record<string, FileGenerationState>
    >({});

    const [planTotalFiles, setPlanTotalFiles] = useState<number | null>(null);

    /*
     * Authoritative, synchronous record of which files are CURRENTLY
     * generating, in the order their streams started.
     *
     * This drives Monaco/card synchronization only. It intentionally does
     * NOT replace fileGenState (still the source of truth for rendering) —
     * it exists because React state updates are async/batched and the
     * "which file should Monaco show next" decision must be made with the
     * true current set of in-flight streams at the moment start/end fires.
     */
    const generatingOrderRef = useRef<string[]>([]);

    /*
     * Mirrors planTotalFiles synchronously so the agent:status handler
     * below (registered once, empty deps) can compare against the
     * CURRENT plan size instead of a stale closed-over value.
     */
    const planTotalFilesRef = useRef<number | null>(null);

    useEffect(() => {
        const handleStreamStart = ({ path }: FileStreamStartEvent) => {
            setFileActivity((prev) => ({
                ...prev,
                [path]: "writing",
            }));

            setFileGenState((prev) => {
                const existing = prev[path];

                /*
                 * A file that already reached agent:file-stream-end stays
                 * "done" for progress-bar purposes even if the backend
                 * restarts a stream for it later (e.g. the verify/fix
                 * phase regenerating a file to resolve a build error).
                 *
                 * Without this guard, completed/total regresses backwards
                 * (e.g. 16/16 -> 15/16) every time a finished file gets
                 * fixed, which is exactly the "progress bar is wrong"
                 * symptom — completed must only ever increment, never
                 * decrement, once a file has genuinely finished.
                 */
                if (existing?.status === "done") {
                    return prev;
                }

                return {
                    ...prev,
                    [path]: {
                        status: "generating",
                        content: "",
                        startedAt: Date.now(),
                    },
                };
            });

            if (!generatingOrderRef.current.includes(path)) {
                generatingOrderRef.current.push(path);
            }

            /*
             * Only take over Monaco if there is no other file currently
             * generating there. If the previously selected file is still
             * actively streaming, it keeps ownership of Monaco and this
             * new file surfaces as a generation card instead.
             */
            setSelectedFile((prevSelected) => {
                if (
                    prevSelected &&
                    prevSelected !== path &&
                    generatingOrderRef.current.includes(prevSelected)
                ) {
                    return prevSelected;
                }

                return path;
            });
        };

        const handleDelta = ({ path, delta }: FileDeltaEvent) => {
            setFileGenState((prev) => {
                const existing = prev[path];

                if (!existing) {
                    return prev;
                }

                return {
                    ...prev,
                    [path]: {
                        ...existing,
                        content: existing.content + delta,
                    },
                };
            });
        };

        const handleStreamEnd = ({
            path,
            content,
        }: FileStreamEndEvent) => {
            setFileActivity((prev) => ({
                ...prev,
                [path]: "done",
            }));

            setFileGenState((prev) => ({
                ...prev,
                [path]: {
                    status: "done",
                    content,
                    startedAt: prev[path]?.startedAt ?? Date.now(),
                },
            }));

            /*
             * This file is no longer generating — drop it from the
             * authoritative in-flight order.
             */
            generatingOrderRef.current = generatingOrderRef.current.filter(
                (p) => p !== path
            );

            /*
             * If the file that just finished was the one Monaco was
             * showing, deterministically hand Monaco to the
             * longest-currently-generating remaining file. If nothing else
             * is generating, leave Monaco on the finished file (showing its
             * final content) rather than switching to nothing.
             */
            setSelectedFile((prevSelected) => {
                if (prevSelected !== path) {
                    return prevSelected;
                }

                return generatingOrderRef.current[0] ?? prevSelected;
            });

            // Clear the "done" flash after a moment so it doesn't linger forever.
            setTimeout(() => {
                setFileActivity((prev) => {
                    if (prev[path] !== "done") {
                        return prev;
                    }

                    const next = { ...prev };
                    delete next[path];

                    return next;
                });
            }, 1800);
        };

        socket.on(
            "agent:file-stream-start",
            handleStreamStart
        );

        socket.on(
            "agent:file-delta",
            handleDelta
        );

        socket.on(
            "agent:file-stream-end",
            handleStreamEnd
        );

        return () => {
            socket.off(
                "agent:file-stream-start",
                handleStreamStart
            );

            socket.off(
                "agent:file-delta",
                handleDelta
            );

            socket.off(
                "agent:file-stream-end",
                handleStreamEnd
            );
        };
    }, []);

    // Tracks the current run's total file count and resets the
    // live-generation state only when a genuinely NEW plan arrives.
    useEffect(() => {
        const handleAgentStatus = (evt: AgentStatusEvent) => {
            if (evt.phase !== "coding:planning") {
                return;
            }

            if (evt.message === "Analyzing your request…") {
                /*
                 * Do NOT reset fileGenState/planTotalFiles here.
                 *
                 * The backend workflow runner can replay/re-invoke this
                 * durable function's top-level code for bookkeeping
                 * without re-running already-completed steps (see
                 * coding.worflow.ts). Because this status line sits
                 * outside step.run(), a replay of the SAME run re-emits
                 * it — resetting here would wipe real progress already
                 * collected from agent:file-stream-* events (including
                 * files still actively streaming) with nothing left to
                 * repopulate it, since the corresponding generate steps
                 * won't re-run or re-emit. The actual reset happens
                 * below, once we know whether the incoming plan is
                 * genuinely new.
                 */
                return;
            }

            const match = evt.message.match(
                /Plan ready — (\d+) files/
            );

            if (match) {
                const total = Number(match[1]);

                /*
                 * Only treat this as the start of a genuinely NEW run
                 * when the plan size differs from the one already being
                 * tracked (or nothing was tracked yet). An identical
                 * repeat is a duplicate replay echo of the current run
                 * and must not wipe progress already collected from real
                 * stream events.
                 */
                if (planTotalFilesRef.current !== total) {
                    setFileGenState({});
                    generatingOrderRef.current = [];
                }

                planTotalFilesRef.current = total;
                setPlanTotalFiles(total);
            }
        };

        socket.on("agent:status", handleAgentStatus);

        return () => {
            socket.off("agent:status", handleAgentStatus);
        };
    }, []);

    const handleCreateProject = async (
        payload: createProjectPayload
    ) => {
        setLoading(true);

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
            );

            setProjects((prev) => [
                ...prev,
                data.project,
            ]);

            return data.project;
        } catch (err) {
            console.error(err);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const handleGetProjectDetails = async (
        payload: ProjectDetailsPayload
    ) => {
        setLoading(true);

        try {
            const data = await getProjectDetails(payload.id);

            setProject(data.project);
            setFileTree(data.fileTree);
        } catch (err) {
            console.error(err);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const handleGetAllProjects = async () => {
        setLoading(true);

        try {
            const data = await getAllProjects();

            setProjects(data.projects);
        } catch (err) {
            console.error(err);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteProject = async (
        payload: DeleteProjectPayload
    ) => {
        setLoading(true);

        try {
            await deleteProject(payload.id);

            setProjects((prev) =>
                prev.filter(
                    (project) =>
                        project.id !== payload.id
                )
            );
        } catch (err) {
            console.log(err);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const handleSendFollowUpPrompt = async (
        payload: SendFollowUpPromptPayload
    ): Promise<FollowUpPromptResult> => {
        try {
            await sendFollowUpPrompt(
                payload.projectId,
                payload.prompt,
                payload.force
            );

            return {
                requiresConfirmation: false,
            };
        } catch (err) {
            if (
                axios.isAxiosError(err) &&
                err.response?.status === 409 &&
                err.response.data?.requiresConfirmation
            ) {
                return {
                    requiresConfirmation: true,
                    message: err.response.data?.message,
                };
            }

            console.error(err);
            throw err;
        }
    };

    return (
        <ProjectContext.Provider
            value={{
                fileTree,
                project,
                projects,
                handleCreateProject,
                handleGetAllProjects,
                handleDeleteProject,
                handleGetProjectDetails,
                handleSendFollowUpPrompt,
                fileActivity,
                fileGenState,
                planTotalFiles,
                selectedFile,
                setSelectedFile,
                loading,
                setFileTree,
            }}
        >
            {children}
        </ProjectContext.Provider>
    );
}