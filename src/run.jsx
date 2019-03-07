import _ from 'lodash'
import fs from 'fs-extra'
import path from 'path'
import YAML from 'yamljs';
import {spawn} from '@nebulario/core-process';
import {IO} from '@nebulario/core-plugin-request';

/* docker run --hostname dns.mageddo --name dns-proxy-server -p 5380:5380 \
-v /var/run/docker.sock:/var/run/docker.sock \
-v /etc/resolv.conf:/etc/resolv.conf \
defreitas/dns-proxy-server */

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

  const filesToCopy = [".env", "docker-compose.yml"];
  const outputPath = path.join(folder, "dist");

  if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath);
  }

  for (const compFile of filesToCopy) {
    const srcDockerCompose = path.join(folder, compFile);
    const destDockerCompose = path.join(outputPath, compFile);
    fs.copySync(srcDockerCompose, destDockerCompose);
  }

  console.log("DEPS IN PLUGIN: " + instanceid);
  console.log(JSON.stringify(dependencies, null, 2));

  const depApp = _.find(dependencies, {kind: "app"});

  if (depApp) {
    const appMod = _.find(modules, {moduleid: depApp.moduleid})

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

    const hostname = instanceid + "." + moduleid + ".com";
    compose.services.app.hostname = hostname;

    if (config.build.linked) {

      //compose.services.app.volumes.push(path.join(appModuleFolder, "node_modules") + ":/workspace/app/node_modules");
      for (const featMod of modules) {
        const {
          fullname,
          type,
          code: {
            paths: {
              absolute: {
                folder: featModuleFolder
              }
            }
          }
        } = featMod;
        if (type === "npm") {
          compose.services.app.volumes.push(featModuleFolder + ":/app/node_modules/" + fullname);
        }

      }

    }
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
