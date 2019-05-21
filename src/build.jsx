import {
  spawn,
  exec
} from '@nebulario/core-process';
import {
  Operation,
  IO
} from '@nebulario/core-plugin-request';
import {
  getComposeDependency
} from './dependencies'
import _ from 'lodash'

export const init = async (params, cxt) => {

  const {
    performer: {
      instanced
    }
  } = params;

  if (!instanced) {
    throw new Error("PERFORMER_NOT_INSTANCED");
  }

  const {
    code: {
      paths: {
        absolute: {
          folder
        }
      }
    }
  } = instanced;


  try {

    const {
      stdout,
      stderr
    } = await exec([
      'yarn install --check-files'
    ], {
      cwd: folder
    }, {}, cxt);

    stdout && IO.sendEvent("out", {
      data: stdout
    }, cxt);

    stderr && IO.sendEvent("warning", {
      data: stderr
    }, cxt);

  } catch (e) {
    IO.sendEvent("error", {
      data: e.toString()
    }, cxt);
    throw e;
  }

  return "App package initialized";
}


export const start = (params, cxt) => {

  const {
    performer: {
      instanced
    }
  } = params;

  if (!instanced) {
    throw new Error("PERFORMER_NOT_INSTANCED");
  }

  const {
    code: {
      paths: {
        absolute: {
          folder
        }
      }
    }
  } = instanced;

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
    onOutput: async function({
      data
    }) {

      if (data.includes("Successfully tagged")) {
        IO.sendEvent("done", {
          data
        }, cxt);
      } else {
        IO.sendEvent("out", {
          data
        }, cxt);
      }

    },
    onError: async ({
      data
    }) => {
      IO.sendEvent("warning", {
        data
      }, cxt);
    }
  });
}
