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
  const containerFile = path.join(folder, "container.json");

  if (fs.existsSync(containerFile)) {
    const containerJson = JSON.parse(fs.readFileSync(containerFile, "utf8"));
    const { name, version, source } = containerJson;
    dependencies.push({
      dependencyid: "dependency|container.json|name",
      kind: "inner",
      filename: "container.json",
      path: "version",
      fullname: name,
      version
    });

    dependencies.push({
      dependencyid: "dependency|container.json|source",
      kind: "source",
      filename: "container.json",
      path: "source.version",
      fullname: source.fullname,
      version: source.version,
      type: source.type
    });
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
