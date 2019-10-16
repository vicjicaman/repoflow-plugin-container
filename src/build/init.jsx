import _ from "lodash";
import fs from "fs";
import path from "path";
import { exec, spawn, wait } from "@nebulario/core-process";
import * as JsonUtil from "@nebulario/core-json";
import * as Performer from "@nebulario/core-performer";
import chokidar from "chokidar";

export const start = async (operation, params, cxt) => {
  const {
    payload,
    module: mod,
    performer,
    performer: {
      performerid,
      type,
      code: {
        paths: {
          absolute: { folder }
        }
      },
      dependents,
      module: { dependencies },
      output: {
        paths: {
          absolute: { folder: outputFolder }
        }
      }
    },
    performers,
    task: { taskid }
  } = params;

  const chdlr = {
    onOutput: ({ data }) => operation.print("out", data, cxt)
  };

  if (type === "instanced") {
    Performer.link(performer, performers, {
      onLinked: depPerformer => {
        if (depPerformer.module.type === "npm") {
          operation.print(
            "info",
            depPerformer.performerid + " npm linked!",
            cxt
          );

          const dependentDependencies = _.filter(
            dependencies,
            dependency => dependency.moduleid === depPerformer.performerid
          );

          for (const depdep of dependentDependencies) {
            const { filename, path } = depdep;

            JsonUtil.sync(folder, {
              filename,
              path,
              version: "link:./../" + depPerformer.performerid
            });
          }
        }
      }
    });

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
      ["cp -u package.json " + path.join(prodFolder, "package.json")],
      copts,
      {},
      cxt
    );

    const prodps = operation.spawn(
      "yarn",
      [("install", "--check-files", "--production=true")],
      {
        cwd: prodFolder
      },
      chdlr,
      cxt
    );
    await prodps.promise;
    operation.print("info", "Linked production package ready!", cxt);
  }

  const devps = operation.spawn(
    "yarn",
    ["install", "--check-files"],
    {
      cwd: folder
    },
    chdlr,
    cxt
  );

  await devps.promise;

  operation.print("info", "Linked development package ready!", cxt);
};
