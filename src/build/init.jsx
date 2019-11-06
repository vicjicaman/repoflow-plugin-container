import { wait, spawn, exec } from "@nebulario/core-process";
import { execSync } from "child_process";
import _ from "lodash";
import fs from "fs";
import path from "path";
import * as Repository from "@nebulario/core-repository";
import * as Remote from "@nebulario/core-remote";
import * as Utils from "../utils";
import * as JsonUtils from "@nebulario/core-json";
import * as Performer from "@nebulario/core-performer";
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
    const sourceContent = JsonUtils.load(path.join(folder, "container.json"));
    const { source } = sourceContent;

    operation.print("info", "Source " + JSON.stringify(source, null, 2), cxt);
    const containerDistFolder = path.join(folder, "dist");

    const linkedPerformers = Performer.linked(performer, performers);
    const isLinked = _.find(
      linkedPerformers,
      ({ module: { fullname } }) => source.fullname === fullname
    );

    execSync(`rm -Rf ${containerDistFolder}`);
    if (source.type === "npm") {
      execSync(`mkdir -p ${containerDistFolder}`);

      const linkedVersion = isLinked
        ? `link:./../../${isLinked.performerid}`
        : source.version;

      const packageJson = {
        dependencies: {
          [source.fullname]: linkedVersion
        }
      };

      JsonUtils.save(
        path.join(containerDistFolder, "package.json"),
        packageJson
      );

      await NpmPluginUtils.initDevelopment(
        operation,
        {
          code: containerDistFolder
        },
        cxt
      );
    }

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
    }

    if (source.type === "folder") {
      if (isLinked) {

        const relativeSourceFolder = `../${isLinked.performerid}`;
        operation.print("warning", `Linked to ../${isLinked.performerid}`, cxt);
        fs.symlinkSync(relativeSourceFolder, containerDistFolder, "dir");

        if (cluster && cluster.node && performer.linked) {
          const remotePath = Utils.getRemotePath(params);
          const remoteDistPath = path.join(remotePath, "dist");

          const remdistps = await Remote.context(
            cluster.node,
            [{ path: containerDistFolder, type: "folder" }],
            async ([distFolder, dockerFile], cxt) => {
              const cmds = [
                "rm -Rf " + remoteDistPath,
                "ln -s " + relativeSourceFolder + " " + remoteDistPath
              ];
              return cmds.join(";");
            },
            {
              spawn: operation.spawn
            },
            cxt
          );

          await remdistps.promise;
        }
      } else {
        execSync(`mkdir -p ${containerDistFolder}`);
        const sourceRepositoryId = containerDistFolder;
        try {
          await Repository.clone(source.fullname, sourceRepositoryId);
        } catch (e) {
          const estr = e.toString();
          cxt.logger.debug("container.source.error", { error: e.toString() });
          if (!estr.includes("already exists and is not an empty directory")) {
            throw e;
          }
        }

        await Repository.checkout(sourceRepositoryId, source.version);

        if (cluster && cluster.node && performer.linked) {
          const remotePath = Utils.getRemotePath(params);
          const remoteDistPath = path.join(remotePath, "dist");

          const remdistps = await Remote.context(
            cluster.node,
            [{ path: containerDistFolder, type: "folder" }],
            async ([distFolder, dockerFile], cxt) => {
              const cmds = [
                "rm -Rf " + remoteDistPath,
                "mkdir -p " + remoteDistPath,
                "cp -rf " + path.join(distFolder, "*") + " " + remoteDistPath
              ];
              return cmds.join(";");
            },
            {
              spawn: operation.spawn
            },
            cxt
          );

          await remdistps.promise;
        }
      }
    }

    if (cluster && cluster.node && performer.linked) {
      const remotePath = Utils.getRemotePath(params);
      const dockerFile = path.join(folder, "Dockerfile");
      const remoteDockerFile = path.join(remotePath, "Dockerfile");

      const remdistps = await Remote.context(
        cluster.node,
        [{ path: dockerFile, type: "file" }],
        async ([dockerFile], cxt) => {
          const cmds = [
            "mkdir -p " + remotePath,
            "cp -u " + dockerFile + " " + remoteDockerFile
          ];
          return cmds.join(";");
        },
        {
          spawn: operation.spawn
        },
        cxt
      );

      await remdistps.promise;
    }

    operation.print("info", performer.performerid + " initialized", cxt);
  }
};
