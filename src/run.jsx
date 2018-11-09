import _ from 'lodash'
import fs from 'fs-extra'
import path from 'path'
import YAML from 'yamljs';
import {moduleExec} from './utils';
import {exec, spawn, wait, retry} from '@nebulario/core-process';
import killTree from 'tree-kill';
import {event} from './io';
import * as Request from './request';

export const start = async (params, cxt) => {
  const {fullname, dependencies, folder, outputPath} = params;

  //docker run --rm 919446158824.dkr.ecr.us-east-1.amazonaws.com/repoflow.com/graph
  // -v /c/Users:/myVolData

  const filesToCopy = [".env", "docker-compose.yml"];

  for (const compFile of filesToCopy) {
    const srcDockerCompose = path.join(folder, compFile);
    const destDockerCompose = path.join(outputPath, compFile);
    fs.copySync(srcDockerCompose, destDockerCompose);
  }

  const depApp = _.find(dependencies, {kind: "app"});

  if (depApp) {

    const {
      config: {
        build: {
          enabled
        }
      },
      module: {
        folder: appModuleFolder
      }
    } = depApp;

    console.log("App is " + enabled + " " + depApp.fullname + " will be mounted from module. ");
    const composePath = path.join(outputPath, "docker-compose.yml");
    const compose = YAML.load(composePath);

    compose.services.app.volumes.push(path.join(appModuleFolder, "node_modules") + ":/app/node_modules");
    compose.services.app.volumes.push(path.join(appModuleFolder, "dist") + ":/app/dist");

    const ymlContent = YAML.stringify(compose, 4);
    console.log(ymlContent);
    fs.writeFileSync(composePath, ymlContent, 'utf8');

  }

  await Request.handle(({
    folder,
    fullname,
    mode
  }, cxt) => spawn('docker-compose', [
    'up', '--no-color'
  ], {
    cwd: outputPath
  }, {
    onOutput: async function(data) {

      if (data.includes("Running server at")) {
        event("run.started", {
          data
        }, cxt);
      }

      event("run.out", {
        data
      }, cxt);
    },
    onError: async (data) => {
      event("run.err", {
        data
      }, cxt);
    }
  }), params, cxt);

}
// Testing device
export const restart = async ({
  requestid
}, cxt) => {
  Request.restart({
    requestid
  }, cxt);
}

export const stop = async ({
  requestid
}, cxt) => {

  Request.stop({
    requestid
  }, cxt);
}
