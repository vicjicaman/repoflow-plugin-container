import _ from "lodash";
import fs from "fs-extra";
import path from "path";
import YAML from "yamljs";
import { exec, spawn, wait } from "@nebulario/core-process";
import {
  Operation,
  IO,
  Watcher,
  Performer
} from "@nebulario/core-plugin-request";
import * as Cluster from "@nebulario/core-cluster";
import * as JsonUtils from "@nebulario/core-json";
var kill = require('tree-kill');

export const listen = async (params, cxt) => {
  const {
    performerid, // TRIGGER DEP
    operation: {
      params: opParams,
      params: {
        performer: { type },
        performers
      }
    }
  } = params;

  if (type === "instanced") {
    const triggerPerf = Performer.find(performerid, performers);

    if (triggerPerf && triggerPerf.module.type === "npm") {
      restart(opParams, cxt);
    }
  }
};

const getLinkedApp = (performer, performers) => {
  let appPerf = null;
  Performer.link(performer, performers, {
    onLinked: depPerformer => {
      if (depPerformer.module.type === "npm") {
        appPerf = depPerformer;
      }
    }
  });

  return appPerf;
};

export const start = (params, cxt) => {
  const {
    instance: { instanceid },
    performers,
    performer,
    performer: {
      performerid,
      type,
      output: {
        paths: {
          absolute: { folder: outputFolder }
        }
      },
      code,
      code: {
        paths: {
          absolute: { folder: sourceFolder }
        }
      },
      dependents,
      module: { dependencies }
    }
  } = params;

  const tmpPath = path.join(sourceFolder, "tmp");
  const distPath = path.join(sourceFolder);

  const depSrvAppPerformer = getLinkedApp(performer, performers);
  const dockerFile = path.join(sourceFolder, "Dockerfile");

  const startOp = async (operation, cxt) => {
    const serviceDevPath = await Cluster.Dev.transform(
      "docker-compose.yml",
      distPath,
      tmpPath,
      async content => {
        const service = "app";
        const currServ = content.services[service];

        IO.sendEvent(
          "out",
          {
            data: " - Service " + service
          },
          cxt
        );

        if (depSrvAppPerformer) {
          IO.sendEvent(
            "info",
            {
              data: " - NPM linked " + depSrvAppPerformer.performerid
            },
            cxt
          );

          const {
            module: { fullname, type },
            code: {
              paths: {
                absolute: { folder: featModuleFolder }
              }
            },
            linked
          } = depSrvAppPerformer;

          const entry =
            featModuleFolder +
            ":/app/node_modules/" +
            depSrvAppPerformer.module.fullname;

          if (!currServ.volumes) {
            currServ.volumes = [];
          }
          currServ.volumes.push(entry);
        }

        return content;
      }
    );

    await restart(params, cxt);

    while (operation.status !== "stopping") {
      await wait(100); //wait(2500);
    }

  };

  return {
    promise: startOp,
    process: null
  };
};

let currentComposeProcess = null;
const restart = async (params, cxt) => {
  const {
    instance: { instanceid },
    performer: {
      performerid,
      code: {
        paths: {
          absolute: { folder: sourceFolder }
        }
      },
      payload
    },
    config: { remote }
  } = params;

  IO.sendEvent(
    "warning",
    {
      data: "Restarting... "
    },
    cxt
  );

  if (currentComposeProcess) {
    //process.kill(currentComposeProcess.process.pid);
    kill(currentComposeProcess.process.pid);
    await wait(1000);
  }

  const tmpPath = path.join(sourceFolder, "tmp");

  currentComposeProcess = spawn(
    "docker-compose",
    [
      "-p",
      instanceid + "_" + performerid,
      "up",
      "--remove-orphans",
      "--no-color"
    ],
    {
      cwd: tmpPath
    },
    {
      onOutput: async function({ data }) {
        if (data.includes("exited with code")) {
          IO.sendEvent(
            "done",
            {
              data
            },
            cxt
          );
        }

        IO.sendEvent(
          "out",
          {
            data
          },
          cxt
        );
      },
      onError: async ({ data }) => {
        IO.sendEvent(
          "warning",
          {
            data
          },
          cxt
        );
      }
    },
    cxt
  );

  await currentComposeProcess.promise;
};
