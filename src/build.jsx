import {spawn} from '@nebulario/core-process';
import {Operation, IO} from '@nebulario/core-plugin-request';
import {getComposeDependency} from './dependencies'

export const start = (params, cxt) => {

  const {
    module: {
      code: {
        paths: {
          absolute: {
            folder
          }
        }
      }
    },
    modules
  } = params;

  const dep = getComposeDependency(folder, cxt);

/*
KUBE env

{
  DOCKER_TLS_VERIFY: "1",
  DOCKER_HOST: "tcp://192.168.99.100:2376",
  DOCKER_CERT_PATH: "/home/victor/.minikube/certs",
  DOCKER_API_VERSION: "1.35"
}

*/

  return spawn('docker', [
    'build', '.', '-t', dep.fullname + ":" + dep.version,
    '-t',
    dep.fullname + ":linked"
  ], {
    cwd: folder,
    env: {}
  }, {
    onOutput: async function({data}) {

      if (data.includes("Successfully tagged")) {
        IO.sendEvent("build.out.done", {
          data
        }, cxt);
      } else {
        IO.sendEvent("build.out.building", {
          data
        }, cxt);
      }

    },
    onError: async ({data}) => {
      IO.sendEvent("build.err", {
        data
      }, cxt);
    }
  });
}
