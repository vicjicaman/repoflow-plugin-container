import _ from 'lodash';
import path from 'path';
import fs from 'fs';
import YAML from 'yamljs'
const uuidv4 = require('uuid/v4');
import {exec, spawn, wait, retry} from '@nebulario/core-process';

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

export const saveJson = (pathIn, json) => fs.writeFileSync(pathIn, JSON.stringify(json, null, 2), 'utf8');
export const loadJson = (pathIn) => JSON.parse(fs.readFileSync(pathIn, 'utf8'));

export function addPrefix(str, prefix) {
  let tmp = str.split('\n'),
    res = [];

  for (const frag of tmp) {
    res.push(prefix + ' > ' + frag);
  }

  return res.join('\n');
}

export const moduleExec = async (folder, cmds, opt, cxt) => {
  const out = await exec([
    'cd ' + folder,
    ...cmds
  ], opt, cxt);

  return out;
}
