import docker from "../config/docker.js";

export async function createContainer(projectId: string, workspacePath: string) {
    
  const container = await docker.createContainer({
    name: `project-${projectId}`,
    Image: "node:20-alpine",
    Tty: true,
    Cmd: ["/bin/sh"],
    WorkingDir: "/app",

    ExposedPorts: {
      "3000/tcp": {},
      "5173/tcp": {},
      "8000/tcp": {},
    },

    HostConfig: {
      Binds: [`${workspacePath}:/app`],
      PortBindings: {
        "3000/tcp": [{ HostPort: "0" }],
        "5173/tcp": [{ HostPort: "0" }],
        "8000/tcp": [{ HostPort: "0" }],
      },
    },
  });

  await container.start();

  return container;
}

export async function deleteContainer(projectId: string) {
  const container = docker.getContainer(`project-${projectId}`);

  await container.stop();
  await container.remove();
}


export async function ensureContainerRunning(containerId: string) {
  const container = docker.getContainer(containerId);

  const info = await container.inspect();

  if (!info.State.Running) {
    await container.start();
  }

  return container;
}