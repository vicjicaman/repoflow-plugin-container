import { wait, spawn, exec } from "@nebulario/core-process";
import _ from "lodash";
import fs from "fs";
import path from "path";
import * as Remote from "@nebulario/core-remote";
import * as Utils from "../utils";
import { Utils as NpmPluginUtils } from "@nebulario/repoflow-plugin-npm";

export const start = async (operation, params, cxt) => {
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
    await NpmPluginUtils.init(
      operation,
      {
        performer,
        performers,
        folders: {
          code: folder,
          output: outputFolder
        }
      },
      cxt
    );

    if (cluster) {
      operation.print(
        "warning",
        "Copy container files to " + cluster.user + "@" + cluster.host,
        cxt
      );
      const remotePath = Utils.getContainerBuildPath(params);
      const remps = await Remote.context(
        { host: cluster.host, user: cluster.user },
        [{ path: folder, type: "folder" }],
        async ([folder], cxt) => {
          const cmds = [
            "rm -Rf " + remotePath,
            "mkdir -p " + remotePath,
            "cp -rf " + path.join(folder, "*") + " " + remotePath
          ];
          return cmds.join(";");
        },
        {
          spawn: operation.spawn
        },
        cxt
      );

      await remps.promise;
    }

    operation.print("info", performer.performerid + " initialized", cxt);
  }
};
