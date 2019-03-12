import _ from 'lodash'
import fs from 'fs-extra'
import path from 'path'
import YAML from 'yamljs';
import {spawn} from '@nebulario/core-process';
import {IO} from '@nebulario/core-plugin-request';
import {get as getEnv, replace as replaceEnv} from './env'

/* docker run --hostname dns.mageddo --name dns-proxy-server -p 5380:5380 \
-v /var/run/docker.sock:/var/run/docker.sock \
-v /etc/resolv.conf:/etc/resolv.conf \
defreitas/dns-proxy-server */

const dependentLink = (service, modules, dependent) => {

  const {
    fullname,
    type,
    code: {
      paths: {
        absolute: {
          folder: featModuleFolder
        }
      },
      dependents
    },
    config
  } = dependent;

  if (type === "npm" && config.build.linked) {
    const entry = featModuleFolder + ":/app/node_modules/" + fullname;
    if (!service.volumes.includes(entry)) {
      service.volumes.push(entry);
    }
  }

  for (const srvDependent of dependents) {
    const srvDependentMod = _.find(modules, {moduleid: srvDependent.moduleid});

    if (srvDependentMod) {
      dependentLink(service, modules, srvDependentMod);
    }

  }

}

export const start = (params, cxt) => {

  const {
    module: {
      moduleid,
      mode,
      fullname,
      code: {
        paths: {
          absolute: {
            folder
          }
        },
        dependencies
      },
      instance: {
        instanceid
      }
    },
    modules
  } = params;

  //docker run --rm 919446158824.dkr.ecr.us-east-1.amazonaws.com/repoflow.com/graph
  // -v /c/Users:/myVolData

  const RepoEnv = {
    "REPOFLOW_INSTANCE_ID": instanceid,
    "REPOFLOW_MODULE_ID": moduleid
  };

  const DotEnv = getEnv(folder, RepoEnv);

  console.log("DOT_ENV")
  console.log(JSON.stringify(DotEnv, null, 2));

  const filesToCopy = [".env", "docker-compose.yml"];
  const outputPath = path.join(folder, "runtime");

  if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath);
  }

  for (const compFile of filesToCopy) {
    const srcDockerCompose = path.join(folder, compFile);
    const destDockerCompose = path.join(outputPath, compFile);
    //fs.copySync(srcDockerCompose, destDockerCompose);

    const raw = fs.readFileSync(srcDockerCompose, "utf8");
    const convert = replaceEnv(raw, DotEnv);

    fs.writeFileSync(destDockerCompose, convert, "utf8");
  }

  //console.log("DEPS IN PLUGIN: " + instanceid);
  //console.log(JSON.stringify(dependencies, null, 2));

  const depApp = _.find(dependencies, {kind: "app"});

  if (depApp) {
    const appMod = _.find(modules, {moduleid: depApp.moduleid})
    if (appMod) {

      const {
        code: {
          paths: {
            absolute: {
              folder: appModuleFolder
            }
          }
        },
        config
      } = appMod;

      console.log("App is " + config.build.linked + " " + depApp.moduleid + " will be mounted from module. ");
      const composePath = path.join(outputPath, "docker-compose.yml");
      const compose = YAML.load(composePath);

      console.log("Getting app service for module: " + moduleid)

      if (!compose.services.app.volumes) {
        compose.services.app.volumes = [];
      }
      if (!compose.services.app.environment) {
        compose.services.app.environment = [];
      }

      const hostname = DotEnv["SERVICE_HOST"]; //instanceid + "." + moduleid + ".com";
      if (hostname) {
        compose.services.app.hostname = hostname;
      }

      dependentLink(compose.services.app, modules, appMod);

      const instanceNetwork = "network-" + instanceid;
      compose.services.app.networks = [instanceNetwork];
      compose.services.app.networks = {
        [instanceNetwork]: {
          aliases: [hostname]
        }
      };

      compose.services.app.extra_hosts = ["localbuild:${DOCKERHOST}"];

      compose.networks = {
        [instanceNetwork]: {
          external: true
        }
      }

      const ymlContent = YAML.stringify(compose, 4);
      fs.writeFileSync(composePath, ymlContent, 'utf8');
    }
  }

  // docker network create network-container-dependencies
  return spawn('docker-compose', [
    '-p', instanceid + "_" + moduleid,
    'up',
    '--remove-orphans',
    '--no-color'
  ], {
    cwd: outputPath
  }, {
    onOutput: async function({data}) {

      if (data.includes("Running at")) {
        IO.sendEvent("run.started", {
          data
        }, cxt);
      }

      IO.sendEvent("run.out", {
        data
      }, cxt);
    },
    onError: async ({data}) => {
      IO.sendEvent("run.err", {
        data
      }, cxt);
    }
  });

}

/*  */
