import {
  wait,
  spawn,
  exec
} from '@nebulario/core-process';
import {
  Operation,
  IO,
  Watcher
} from '@nebulario/core-plugin-request';
import * as Dependencies from './dependencies'
import _ from 'lodash'
import fs from 'fs-extra'
import path from 'path'
import * as JsonUtils from '@nebulario/core-json';

export const init = async (params, cxt) => {

  const {
    performers,
    performer: {
      dependents,
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

  IO.sendEvent("out", {
    data: JSON.stringify(params, null, 2)
  }, cxt);


  for (const depSrv of dependents) {
    const depSrvPerformer = _.find(performers, {
      performerid: depSrv.moduleid
    });

    if (depSrvPerformer) {
      IO.sendEvent("out", {
        data: "Performing dependent found " + depSrv.moduleid
      }, cxt);

      if (depSrvPerformer.linked.includes("build")) {

        IO.sendEvent("info", {
          data: " - Linked " + depSrv.moduleid
        }, cxt);

        JsonUtils.sync(folder, {
          filename: "package.json",
          path: "dependencies." + depSrvPerformer.module.fullname,
          version: "link:./../" + depSrv.moduleid
        });

      } else {
        IO.sendEvent("warning", {
          data: " - Not linked " + depSrv.moduleid
        }, cxt);
      }


    }

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
    performers,
    performer: {
      dependents,
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
      },
      payload
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

  if (!dep) {
    return null;
  }

  try {

    IO.sendEvent("out", {
      operationid,
      data: "Start building container..." + payload
    }, cxt);

    let ops = {};
    try {
      ops = JSON.parse(payload);
    } catch (e) {
      IO.sendEvent("warning", {
        data: e.toString()
      }, cxt);
    }


    try {
      const cmds = ['docker build  -t ' + dep.fullname + ":" + dep.version + ' -t ' + dep.fullname + ":linked --build-arg CACHEBUST=$(date +%s) ."];

      if (ops.registry === "minikube") {
        IO.sendEvent("info", {
          data: "Building container to minikube..."
        }, cxt);
        cmds.unshift("eval $(minikube docker-env)")
      }

      const {
        stdout,
        stderr /* --no-cache */
      } = await exec(cmds, {
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
