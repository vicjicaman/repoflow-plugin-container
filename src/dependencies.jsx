import fs from 'fs';
import _ from 'lodash';
import path from 'path';
import YAML from 'yamljs'


export const list = async ({
  module: {
    code: {
      paths: {
        absolute: {
          folder
        }
      }
    }
  }
}, cxt) => {
  const dependencies = [];
  
  const packageFile = path.join(folder, "package.json");
  const containerFile = path.join(folder, "container.json");


  if (fs.existsSync(containerFile)) {
    const containerJson = JSON.parse(fs.readFileSync(containerFile, 'utf8'));
    const {
      name,
      version
    } = containerJson;

    dependencies.push({
      dependencyid: 'dependency|container.json|name',
      kind: "inner",
      filename: "container.json",
      path: "version",
      fullname: name,
      version
    });
  }

  if (fs.existsSync(packageFile)) {
    const packageJson = JSON.parse(fs.readFileSync(packageFile, 'utf8'));

    const dependencyid = 'dependency|package.json|';
    const secs = ['dependencies'];

    for (const s in secs) {
      const section = secs[s];

      for (const pkg in packageJson[section]) {
        const pathToVersion = section + "." + pkg
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
}

export const sync = async ({
  module: {
    code: {
      paths: {
        absolute: {
          folder
        }
      }
    }
  },
  dependency,
  dependency: {
    filename,
    path,
    version
  }
}, cxt) => {

  console.log("DEPENDENCY IN CONTAINER");
  console.log(JSON.stringify(dependency, null, 2));

  if (filename === "docker-compose.yml") {
    syncRegexDependency(folder, {
      filename,
      path,
      version
    });
  } else {
    syncJSONDependency(folder, {
      filename,
      path,
      version
    });
  }

  return {};
}

export const syncJSONDependency = (folder, {
  filename,
  path: pathToVersion,
  version
}, isYaml = false) => {

  const contentFile = path.join(folder, filename);
  const content = fs.readFileSync(contentFile, 'utf8')
  const native = isYaml ?
    YAML.parse(content) :
    JSON.parse(content);

  const modNative = _.set(native, pathToVersion, version)

  fs.writeFileSync(
    contentFile, isYaml ?
    YAML.stringify(modNative, 10, 2) :
    JSON.stringify(modNative, null, 2));
}

export const syncRegexDependency = (folder, {
  filename,
  path: pathToVersion,
  version
}) => {

  const contentFile = path.join(folder, filename);
  const content = fs.readFileSync(contentFile, 'utf8');

  const versionRegex = new RegExp(pathToVersion);
  const versionMatch = versionRegex.exec(content);

  if (versionMatch) {
    const syncFullmatch = versionMatch[0].replace(versionMatch[1], version);
    const syncContent = content.replace(versionRegex, syncFullmatch);
    fs.writeFileSync(contentFile, syncContent);
  }

}
