import { wait, spawn, exec } from "@nebulario/core-process";
import {
  Operation,
  IO,
  Watcher,
  Performer
} from "@nebulario/core-plugin-request";
import * as Dependencies from "./dependencies";
import _ from "lodash";
import fs from "fs-extra";
import path from "path";
import * as JsonUtils from "@nebulario/core-json";

import * as Cluster from "@nebulario/core-cluster";

export const init = async (params, cxt) => {
  const {
    performers,
    performer,
    performer: {
      dependents,
      type,
      code: {
        paths: {
          absolute: { folder }
        }
      },
      module: { dependencies }
    }
  } = params;

  if (type === "instanced") {
    Performer.link(performer, performers, {
      onLinked: depPerformer => {
        if (depPerformer.module.type === "npm") {
          IO.sendEvent(
            "info",
            {
              data: depPerformer.performerid + " npm linked!"
            },
            cxt
          );

          const dependentDependencies = _.filter(
            dependencies,
            dependency => dependency.moduleid === depPerformer.performerid
          );

          for (const depdep of dependentDependencies) {
            const { filename, path } = depdep;

            JsonUtils.sync(folder, {
              filename,
              path,
              version: "link:./../" + depPerformer.performerid
            });
          }
        }
      }
    });
  }

  const instout = await exec(
    ["yarn install --check-files"],
    {
      cwd: folder
    },
    {},
    cxt
  );

  IO.sendOutput(instout, cxt);
};

export const start = (params, cxt) => {
  const {
    performers,
    performer: { dependents, type, code }
  } = params;

  if (type === "instanced") {
    const {
      paths: {
        absolute: { folder }
      }
    } = code;

    const dockerFile = path.join(folder, "Dockerfile");

    const startOp = async (operation, cxt) => {
      await build(operation, params, cxt);
      const watcher = Watcher.watch(dockerFile, () => {
        IO.sendEvent(
          "warning",
          {
            data: "Dockerfile changed..."
          },
          cxt
        );

        build(operation, params, cxt);
      });

      while (operation.status !== "stopping") {
        await wait(100); //wait(2500);
      }

      Watcher.stop(watcher);
    };

    return {
      promise: startOp,
      process: null
    };
  }
};

const build = async (operation, params, cxt) => {
  const {
    performer: {
      code: {
        paths: {
          absolute: { folder }
        }
      },
      payload
    },
    config: { remote }
  } = params;

  const deps = await Dependencies.list(
    {
      module: {
        code: {
          paths: {
            absolute: {
              folder
            }
          }
        }
      }
    },
    cxt
  );

  const dep = _.find(deps, {
    kind: "inner"
  });

  if (!dep) {
    return null;
  }

  try {

    if (remote && remote.registry === "minikube") {
      IO.sendEvent(
        "info",
        {
          data: "Building container to minikube..."
        },
        cxt
      );
    }

    const buildout = await Cluster.Control.exec(
      [{ path: folder, type: "folder" }],
      async ([folder], innerClusterContext, cxt) => {
        const cmds = [
          "docker build  -t " +
            dep.fullname +
            ":" +
            dep.version +
            " -t " +
            dep.fullname +
            ":linked --build-arg CACHEBUST=$(date +%s) " +
            folder
        ];

        if (remote && remote.registry === "minikube") {
          cmds.unshift("eval $(minikube docker-env)");
        }

        return await innerClusterContext(cmds.join(";"), {}, cxt);
      },
      {},
      cxt
    );

    IO.sendOutput(buildout, cxt);
  } catch (e) {
    IO.sendEvent(
      "warning",
      {
        data: e.toString()
      },
      cxt
    );
  }

  IO.sendEvent("done", {}, cxt);
};
