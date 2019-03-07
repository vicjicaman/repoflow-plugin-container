import fs from 'fs';
import _ from 'lodash';
import path from 'path';
import YAML from 'yamljs'

export const dependencies = async ({
  moduleid,
  folder,
  baseline: {
    modules: baselineModules
  },
  modules: modulesLocal
}, cxt) => {
  const {pluginid} = cxt;
  const dependencies = [];
  const fullnameIndex = {};

  for (const mod of baselineModules) {
    const {fullname, version, moduleid} = mod;
    fullnameIndex[fullname] = {
      version,
      moduleid
    };
  }

  for (const mod of modulesLocal) {
    const {moduleid, fullname, version} = mod;
    fullnameIndex[fullname] = {
      version,
      moduleid
    };
  }

  const innerPkgDep = generateJSONDependency(fullnameIndex, {
    kind: "inner",
    folder,
    filename: "container.json",
    paths: {
      fullname: "name",
      version: "version"
    }
  }, cxt);

  if (innerPkgDep) {
    dependencies.push(innerPkgDep);
  }

  const innerComposeDep = generateRegexDependency(fullnameIndex, {
    kind: "inner",
    folder,
    filename: "docker-compose.yml",
    regex: {
      fullname: ".+app:\\s+image:(?:\\s+|)(.+):(?:.+)",
      version: ".+app:\\s+image:(?:\\s+|)(?:.+):(.+)"
    }
  }, cxt);

  if (innerComposeDep) {
    dependencies.push(innerComposeDep);
  }

  const packageFile = path.join(folder, "package.json");

  if (fs.existsSync(packageFile)) {
    let packageJson = JSON.parse(fs.readFileSync(packageFile, 'utf8'));

    if (packageJson.name === "container") {
      const secs = ['dependencies'];

      for (const s in secs) {
        const section = secs[s];

        const dependencyid = 'dependency|package.json|';

        for (const pkg in packageJson[section]) {
          if (fullnameIndex[pkg]) {
            const pathToVersion = section + "." + pkg
            dependencies.push({
              dependencyid: dependencyid + pathToVersion,
              moduleid: fullnameIndex[pkg].moduleid,
              kind: "app",
              filename: "package.json",
              path: pathToVersion,
              fullname: pkg,
              version: packageJson[section][pkg],
              pluginid
            });
          }
        }
      }
    }

  }

  return dependencies;
}

export const sync = async ({
  folder,
  filename,
  path,
  version
}, cxt) => {

  if (filename === "docker-compose.yml") {
    syncRegexDependency(folder, {filename, path, version});
  } else {
    syncJSONDependency(folder, {filename, path, version});
  }

  return {};
}

export const generateRegexDependency = (fullnameIndex, {
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

      const fullnameModule = fullnameIndex[fullnameValue];

      if (fullnameModule) {
        return {
          dependencyid: kind + "|" + filename + "|" + RegexToVersion,
          moduleid: fullnameModule.moduleid,
          kind,
          filename,
          path: RegexToVersion,
          pluginid,
          fullname: fullnameValue,
          version: versionValue
        };
      }
    }
  }

  return null;
}

// check thde device!
export const generateJSONDependency = (fullnameIndex, {
  kind,
  folder,
  filename,
  paths: {
    fullname: pathToFullname,
    version: pathToVersion
  },
  isYaml
}, cxt) => {
  const {pluginid} = cxt;
  const contentFile = path.join(folder, filename);

  if (fs.existsSync(contentFile)) {
    const content = fs.readFileSync(contentFile, 'utf8')
    const native = isYaml
      ? YAML.parse(content)
      : JSON.parse(content);

    const fullnameValue = _.get(native, pathToFullname);
    const versionValue = _.get(native, pathToVersion);

    const fullnameModule = fullnameIndex[fullnameValue];

    if (fullnameModule) {
      return {
        dependencyid: kind + "|" + filename + "|" + pathToVersion,
        moduleid: fullnameModule.moduleid,
        kind,
        filename,
        path: pathToVersion,
        pluginid,
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
    console.log("SYNC REGEX DEPENDENCY");
    fs.writeFileSync(contentFile, syncContent);
  }

}
