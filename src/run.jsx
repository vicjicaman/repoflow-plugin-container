import _ from 'lodash'
import fs from 'fs-extra'
import path from 'path'
import YAML from 'yamljs';
import {moduleExec} from './utils';
import {exec, spawn, wait, retry} from '@nebulario/core-process';
import killTree from 'tree-kill';
import {event} from './io';
import * as Request from './request';

/* docker run --hostname dns.mageddo --name dns-proxy-server -p 5380:5380 \
-v /var/run/docker.sock:/var/run/docker.sock \
-v /etc/resolv.conf:/etc/resolv.conf \
defreitas/dns-proxy-server */

export const start = async (params, cxt) => {
  const {
    moduleid,
    fullname,
    dependencies,
    folder,
    outputPath,
    feature: {
      featureid,
      modules
    }
  } = params;

  //docker run --rm 919446158824.dkr.ecr.us-east-1.amazonaws.com/repoflow.com/graph
  // -v /c/Users:/myVolData

  const filesToCopy = [".env", "docker-compose.yml"];

  for (const compFile of filesToCopy) {
    const srcDockerCompose = path.join(folder, compFile);
    const destDockerCompose = path.join(outputPath, compFile);
    fs.copySync(srcDockerCompose, destDockerCompose);
  }

  console.log("DEPS IN PLUGIN: ");
  console.log(JSON.stringify(modules, null, 2));

  const depApp = _.find(dependencies, {kind: "app"});

  if (depApp) {

    const {
      config: {
        build: {
          enabled,
          dependencies
        }
      },
      module: {
        folder: appModuleFolder
      }
    } = depApp;

    console.log("App is " + enabled + " " + depApp.fullname + " will be mounted from module. ");
    const composePath = path.join(outputPath, "docker-compose.yml");
    const compose = YAML.load(composePath);

    console.log("Getting app service for module: " + moduleid)

    if (!compose.services.app.volumes) {
      compose.services.app.volumes = [];
    }
    if (!compose.services.app.environment) {
      compose.services.app.environment = [];
    }

    //compose.services.app.volumes.push(path.join(appModuleFolder, "node_modules") + ":/workspace/app/node_modules");
    for (const featMod of modules) {
      const {moduleid: featModId, folder} = featMod;
      compose.services.app.volumes.push(folder + ":/workspace/" + featModId);
    }
    const hostname = featureid + "." + moduleid + ".com";
    compose.services.app.hostname = hostname;

    //compose.services.app.environment.push({VIRTUAL_HOST: hostname});
    compose.services.app.environment.push("VIRTUAL_HOST=" + hostname);
    compose.services.app.volumes.push(path.join(appModuleFolder, "node_modules") + ":/workspace/app/node_modules");
    compose.services.app.volumes.push(path.join(appModuleFolder, "dist") + ":/workspace/app/dist");
    const featureNetwork = "network-" + featureid;
    compose.services.app.networks = [featureNetwork];
    compose.services.app.networks = {
      [featureNetwork]: {
        aliases: [hostname]
      }
    };

    compose.services.app.extra_hosts = ["localbuild:${DOCKERHOST}"];

    compose.networks = {
      [featureNetwork]: {
        external: true
      }
    }

    const ymlContent = YAML.stringify(compose, 4);
    console.log(ymlContent);
    fs.writeFileSync(composePath, ymlContent, 'utf8');

  }

  await Request.handle(({
    folder,
    fullname,
    mode
  }, cxt) => spawn('docker-compose', [
    '-p', featureid + "_" + moduleid,
    'up',
    '--remove-orphans',
    '--no-color'
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
