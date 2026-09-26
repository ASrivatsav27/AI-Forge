import Docker from "dockerode"

const docker = new Docker({
  //socketPath: process.env.WINDOWS_DOCKER_SOCKET!, //For running locally without containerization
  socketPath: process.env.CONTAINER_DOCKER_SOCKET!, //For running with containerization on production 
})

export default docker