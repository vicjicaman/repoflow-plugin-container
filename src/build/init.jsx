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
    instance: { instanceid },
    config
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
        },
        config
      },
      cxt
    );

    if (cluster && cluster.node && performer.linked) {
      operation.print(
        "warning",
        "Copy container file to " +
          cluster.node.user +
          "@" +
          cluster.node.host +
          ":" +
          cluster.node.port,
        cxt
      );

      const remotePath = Utils.getRemotePath(params);
      const dockerFile = path.join(folder, "Dockerfile");
      const remps = await Remote.context(
        cluster.node,
        [{ path: dockerFile, type: "file" }],
        async ([dockerFile], cxt) => {
          const cmds = [
            "mkdir -p " + remotePath,
            "cp -u " + dockerFile + " " + path.join(remotePath, "Dockerfile")
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
