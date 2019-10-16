import fs from "fs";
import _ from "lodash";
import path from "path";
import * as JsonUtils from "@nebulario/core-json";

export const list = async (
  {
    module: {
      code: {
        paths: {
          absolute: { folder }
        }
      }
    }
  },
  cxt
) => {
  const dependencies = [];

  const packageFile = path.join(folder, "package.json");
  const containerFile = path.join(folder, "container.json");

  if (fs.existsSync(containerFile)) {
    const containerJson = JSON.parse(fs.readFileSync(containerFile, "utf8"));
    const { name, version } = containerJson;

    dependencies.push({
      dependencyid: "dependency|container.json|name",
      kind: "inner",
      filename: "container.json",
      path: "version",
      fullname: name,
      version
    });
  }

  if (fs.existsSync(packageFile)) {
    const packageJson = JSON.parse(fs.readFileSync(packageFile, "utf8"));

    const dependencyid = "dependency|package.json|";
    const secs = ["dependencies"];

    for (const s in secs) {
      const section = secs[s];

      for (const pkg in packageJson[section]) {
        const pathToVersion = section + "." + pkg;
        dependencies.push({
          dependencyid: dependencyid + pathToVersion,
          kind: "app",
          filename: "package.json",
          path: pathToVersion,
          fullname: pkg,
          version: packageJson[section][pkg]
        });
      }
    }
  }

  return dependencies;
};

export const sync = async ({
  module: {
    code: {
      paths: {
        absolute: { folder }
      }
    }
  },
  dependency: { filename, path, version }
}) => {
  if (version) {
    JsonUtils.sync(folder, { filename, path, version });
  }
};
