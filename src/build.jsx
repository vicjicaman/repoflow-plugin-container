import {
  wait,
  spawn,
  exec
} from '@nebulario/core-process';
import {
  Operation,
  IO,
  JSON as JUtils,
  Config,
  Repository,
  Watcher
} from '@nebulario/core-plugin-request';
import * as Dependencies from './dependencies'
import _ from 'lodash'
import fs from 'fs-extra'
import path from 'path'
import YAML from 'yamljs';

export const init = async (params, cxt) => {

  const {
    performer: {
      type,
      code: {
        paths: {
          absolute: {
            folder
          }
        }
      }
    }
  } = params;

  if (type !== "instanced") {
    throw new Error("PERFORMER_NOT_INSTANCED");
  }


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
      type,
      code
    }
  } = params;

  if (type !== "instanced") {
    throw new Error("PERFORMER_NOT_INSTANCED");
  }

  const {
    paths: {
      absolute: {
        folder
      }
    }
  } = code;

  /*
  KUBE env

  {
    DOCKER_TLS_VERIFY: "1",
    DOCKER_HOST: "tcp://192.168.99.100:2376",
    DOCKER_CERT_PATH: "/home/victor/.minikube/certs",
    DOCKER_API_VERSION: "1.35"
  }

  */

  const dockerFile = path.join(folder, "Dockerfile");

  const watcher = async (operation, cxt) => {

    const {
      operationid
    } = operation;

    await wait(100);

    /*IO.sendEvent("started", {
      operationid,
      data: ""
    }, cxt);*/


    IO.sendEvent("out", {
      operationid,
      data: "Watching changes for " + dockerFile
    }, cxt);

    await build(operation, params, cxt);
    const watcher = Watcher.watch(dockerFile, () => {

      IO.sendEvent("out", {
        operationid,
        data: "Dockerfile changed..."
      }, cxt);

      build(operation, params, cxt);

    })

    while (operation.status !== "stopping") {
      /*IO.sendEvent("out", {
        operationid,
        data: "..."
      }, cxt);*/
      await wait(2500);
    }

    watcher.close();
    await wait(100);

    IO.sendEvent("stopped", {
      operationid,
      data: ""
    }, cxt);
  }


  return {
    promise: watcher,
    process: null
  };

}



const build = async (operation, params, cxt) => {

  const {
    performer: {
      code: {
        paths: {
          absolute: {
            folder
          }
        }
      }
    }
  } = params;
  const {
    operationid
  } = operation;

  const deps = await Dependencies.list({
    module: {
      code: {
        paths: {
          absolute: {
            folder
          }
        }
      }
    }
  }, cxt);

  const dep = _.find(deps, {
    kind: "inner"
  });

  if(!dep){
    return null;
  }

  try {

    IO.sendEvent("out", {
      operationid,
      data: "Start building container..."
    }, cxt);

    try {

      const {
        stdout,
        stderr /* --no-cache */
      } = await exec(['docker build  -t ' + dep.fullname + ":" + dep.version + ' -t ' + dep.fullname + ":linked --build-arg CACHEBUST=$(date +%s) ."], {
        cwd: folder
      }, {}, cxt);

      stdout && IO.sendEvent("done", {
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

  } catch (e) {
    IO.sendEvent("error", {
      operationid,
      data: e.toString()
    }, cxt);
  }



}
