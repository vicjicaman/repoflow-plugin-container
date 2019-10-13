import { wait, spawn, exec } from "@nebulario/core-process";
import { Operation, IO } from "@nebulario/core-plugin-request";
import _ from "lodash";
import fs from "fs";
import path from "path";
import * as JsonUtils from "@nebulario/core-json";
import * as Cluster from "@nebulario/core-cluster";
import * as Performer from "@nebulario/core-performer";
import chokidar from "chokidar";

const getLinkedApp = (contPerf, performers) => {
  const {
    dependents,
    module: { dependencies }
  } = contPerf;

  const appdep = _.find(dependencies, ({ kind }) => kind === "app");

  if (appdep) {
    const { moduleid } = appdep;

    const depSrvPerformer = _.find(performers, {
      performerid: moduleid
    });

    if (depSrvPerformer && depSrvPerformer.linked) {
      return depSrvPerformer;
    }
  }

  return null;
};

const containerBuildPath = ({ performer, instance: { instanceid } }) =>
  path.join(
    "${HOME}/repoflow/instances",
    instanceid,
    "containers",
    performer.performerid
  );

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
      module: { dependencies },
      output: {
        paths: {
          absolute: { folder: outputFolder }
        }
      }
    },
    config: { cluster },
    instance: { instanceid }
  } = params;

  if (type === "instanced") {
    const linkedPerformers = Performer.linked(performer, performers);

    for (const depPerformer of linkedPerformers) {
      if (depPerformer.module.type === "npm") {
        IO.print("info", depPerformer.performerid + " npm linked!", cxt);

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

    const prodFolder = outputFolder;
    const copts = {
      cwd: folder
    };

    await exec(["mkdir -p " + prodFolder], copts, {}, cxt);

    if (fs.existsSync(path.join(folder, "yarn.lock"))) {
      await exec(
        ["cp -u yarn.lock " + path.join(prodFolder, "yarn.lock ")],
        copts,
        {},
        cxt
      );
    }

    await exec(
      [
        "cp -u package.json " + path.join(prodFolder, "package.json"),
        "cd " + prodFolder,
        "yarn install --check-files --production=true"
      ],
      copts,
      {},
      cxt
    );

    IO.print("info", "Production package ready!", cxt);
  }

  IO.print("out", "Install App packages...", cxt);
  const instout = await exec(
    ["yarn install --check-files --production=true"],
    {
      cwd: folder
    },
    {},
    cxt
  );

  IO.sendOutput(instout, cxt);

  IO.print("out", "Copy container files to docker env target...", cxt);

  await Cluster.Control.exec(
    [{ path: folder, type: "folder" }],
    async ([folder], innerClusterContext, cxt) => {
      const cmds = [
        "mkdir -p " + containerBuildPath(params),
        "cp -rf " + path.join(folder, "*") + " " + containerBuildPath(params)
      ];

      return await innerClusterContext(cmds.join(";"), {}, cxt);
    },
    {},
    cxt
  );

  IO.print("info", performer.performerid + " initialized", cxt);
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

      const watcher = chokidar
        .watch(dockerFile, {
          ignoreInitial: true
        })
        .on("all", (event, path) => {
          IO.print("warning", "Dockerfile changed...", cxt);
          build(operation, params, cxt);
        });

      while (operation.status !== "stopping") {
        await wait(10);
      }

      watcher.close();
    };

    return {
      promise: startOp,
      process: null
    };
  }
};

const build = async (operation, params, cxt) => {
  const {
    performer,
    performers,
    performer: {
      code: {
        paths: {
          absolute: { folder }
        }
      },
      payload
    },
    config: { cluster }
  } = params;

  try {
    if (cluster && cluster.target === "minikube") {
      IO.print("info", "Building container to minikube..", cxt);
    }

    const dockerFile = path.join(folder, "Dockerfile");

    const buildout = await Cluster.Control.exec(
      [{ path: dockerFile, type: "file" }],
      async ([dockerFile], innerClusterContext, cxt) => {
        const cmds = [
          "cp -u " +
            dockerFile +
            " " +
            path.join(containerBuildPath(params), "Dockerfile"),
          "docker build -t " +
            performer.module.fullname +
            ":linked --build-arg CACHEBUST=$(date +%s) " +
            containerBuildPath(params)
        ];

        if (cluster && cluster.target === "minikube") {
          cmds.unshift("eval $(minikube docker-env)");
        }

        return await innerClusterContext(cmds.join(";"), {}, cxt);
      },
      {},
      cxt
    );

    IO.sendOutput(buildout, cxt);
  } catch (e) {
    IO.print("warning", e.toString(), cxt);
  }

  IO.print("done", "", cxt);
};
