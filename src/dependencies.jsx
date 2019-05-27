import fs from 'fs';
import _ from 'lodash';
import path from 'path';
import YAML from 'yamljs'

export const getComposeDependency = (folder, cxt) => {
  return generateRegexDependency({
    kind: "inner",
    folder,
    filename: "docker-compose.yml",
    regex: {
      fullname: ".+app:\\s+image:(?:\\s+|)(.+):(?:.+)",
      version: ".+app:\\s+image:(?:\\s+|)(?:.+):(.+)"
    }
  }, cxt);
}

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
  const {pluginid} = cxt;
  const dependencies = [];

  const innerComposeDep = getComposeDependency(folder, cxt);

  if (innerComposeDep) {
    dependencies.push(innerComposeDep);
  }

  const packageFile = path.join(folder, "package.json");

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
    syncRegexDependency(folder, {filename, path, version});
  } else {
    syncJSONDependency(folder, {filename, path, version});
  }

  return {};
}

export const generateRegexDependency = ({
  kind,
  folder,
  filename,
  regex: {
    fullname: RegexToFullname,
    version: RegexToVersion
  }
}, cxt) => {
  const {pluginid} = cxt;
  const contentFile = path.join(folder, filename);

  if (fs.existsSync(contentFile)) {
    const content = fs.readFileSync(contentFile, 'utf8');

    const fullnameRegex = new RegExp(RegexToFullname, "gm");
    const versionRegex = new RegExp(RegexToVersion, "gm");

    const fullnameMatch = fullnameRegex.exec(content);
    const versionMatch = versionRegex.exec(content);

    if (fullnameMatch && versionMatch) {
      const fullnameValue = fullnameMatch[1];
      const versionValue = versionMatch[1];

      return {
        dependencyid: kind + "|" + filename + "|" + RegexToVersion,
        kind,
        filename,
        path: RegexToVersion,
        fullname: fullnameValue,
        version: versionValue
      };

    }
  }

  return null;
}

export const syncJSONDependency = (folder, {
  filename,
  path: pathToVersion,
  version
}, isYaml = false) => {

  const contentFile = path.join(folder, filename);
  const content = fs.readFileSync(contentFile, 'utf8')
  const native = isYaml
    ? YAML.parse(content)
    : JSON.parse(content);

  const modNative = _.set(native, pathToVersion, version)

  fs.writeFileSync(
    contentFile, isYaml
    ? YAML.stringify(modNative, 10, 2)
    : JSON.stringify(modNative, null, 2));
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
