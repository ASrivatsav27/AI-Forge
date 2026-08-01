import Docker from "dockerode"

const docker = new Docker({
  socketPath: '//./pipe/docker_engine'
})

export default docker