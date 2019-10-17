import { wait, spawn, exec } from "@nebulario/core-process";
import { Operation, IO } from "@nebulario/core-plugin-request";
import _ from "lodash";
import fs from "fs";
import path from "path";
import * as JsonUtils from "@nebulario/core-json";
import * as Performer from "@nebulario/core-performer";
import * as Remote from "@nebulario/core-remote";
import chokidar from "chokidar";
import * as Utils from "../utils";

export const start = async (operation, params, cxt) => {
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

    await builder(operation, params, cxt);

    const dockerFile = path.join(folder, "Dockerfile");
    const watcher = chokidar
      .watch(dockerFile, {
        ignoreInitial: true
      })
      .on("all", (event, path) => {
        operation.print("warning", "Dockerfile changed...", cxt);

        operation
          .reset()
          .then(() => builder(operation, params, cxt))
          .catch(e => operation.print("warning", e.toString(), cxt));
      });

    while (operation.status !== "stop") {
      await wait(10);
    }

    operation.print("out", "Stop watchers...", cxt);
    watcher.close();
  }
};

const builder = async (operation, params, cxt) => {
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

  operation.print("info", "Building container...", cxt);

  const dockerFile = path.join(folder, "Dockerfile");
  const buildPath = Utils.getContainerBuildPath(params);

  const buildps = await Remote.context(
    { host: "localhost", user: "victor" },
    [{ path: dockerFile, type: "file" }],
    async ([dockerFile], cxt) => {
      const cmds = [
        "cp -u " + dockerFile + " " + path.join(buildPath, "Dockerfile"),
        "docker build -t " +
          performer.module.fullname +
          ":linked --build-arg CACHEBUST=$(date +%s) " +
          buildPath
      ];

      /*if (cluster && cluster.target === "minikube") {
        cmds.unshift("eval $(minikube docker-env)");
      }*/

      return cmds.join(";");
    },
    {
      spawn: operation.spawn
    },
    cxt
  );

  await buildps.promise;

  operation.print("info", "Container build!", cxt);
  operation.event("done");
};
