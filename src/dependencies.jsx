import path from 'path';
import fs from 'fs';
import {event} from './io'
import {generateJSONDependency, generateRegexDependency} from './utils';

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

    if (packageJson.name === "container-app") {
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
