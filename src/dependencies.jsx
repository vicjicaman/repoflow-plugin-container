import path from 'path';
import fs from 'fs';
import {event} from './io'
import {generateJSONDependency} from './utils';

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
    filename: "package.json",
    paths: {
      fullname: "name",
      version: "version"
    }
  }, cxt);

  if (innerPkgDep) {
    dependencies.push(innerPkgDep);
  }

  const packageFile = path.join(folder, "package.json");

  if (fs.existsSync(packageFile)) {
    let packageJson = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
    const secs = ['dependencies', 'devDependencies', 'peerDependencies'];

    for (const s in secs) {
      const section = secs[s];

      const dependencyid = 'dependency|package.json|';

      for (const pkg in packageJson[section]) {
        if (fullnameIndex[pkg]) {
          const pathToVersion = section + "." + pkg
          dependencies.push({
            dependencyid: dependencyid + pathToVersion,
            moduleid: fullnameIndex[pkg].moduleid,
            kind: "dependency",
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

  return dependencies;
}
