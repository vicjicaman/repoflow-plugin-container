import _ from "lodash";
import fs from "fs";
import path from "path";
import { exec, spawn, wait } from "@nebulario/core-process";
import { Operation, IO } from "@nebulario/core-plugin-request";
import * as JsonUtil from "@nebulario/core-json";
import * as Performer from "@nebulario/core-performer";
import chokidar from "chokidar";

export const start = async (operation, params, cxt) => {
  const {
    performer,
    performer: { type }
  } = params;

  if (type !== "instanced") {
    throw new Error("PERFORMER_NOT_INSTANCED");
  }

  const {
    code: {
      paths: {
        absolute: { folder }
      }
    },
    module: {
      iteration: { mode }
    }
  } = performer;

  const state = {
    started: false,
    scripts: 0
  };

  const packageJson = JsonUtil.load(path.join(folder, "package.json"));
  const buildCmd = "build:watch:" + mode;

  let signaling = false;

  const buildps = operation.spawn(
    "yarn",
    [buildCmd],
    {
      cwd: folder
    },
    {
      onOutput: async function({ data }) {
        if (data.includes("watching the files")) {
          state.scripts++;
          console.log("Detected script: " + state.scripts);
        }

        if (data.includes("Hash: ")) {
          if (!data.includes("ERROR in")) {
            state.scripts--;
            console.log("Script to go: " + state.scripts);
            if (state.started === false && state.scripts === 0) {
              state.started = true;
            }

            if (state.started === true) {
              if (!signaling) {
                signaling = true;
                setTimeout(function() {
                  operation.print("info", "Webpack build done", cxt);
                  operation.event("done");
                  signaling = false;
                }, 1000);
              }

              operation.print("out", data, cxt);
              return;
            }
          } else {
            operation.print("warning", data, cxt);
            return;
          }
        }

        operation.print("out", data, cxt);
      },
      onError: async ({ data }) => {
        operation.print("warning", data, cxt);
      }
    }
  );

  await buildps.promise;
};
