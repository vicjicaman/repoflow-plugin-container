import _ from 'lodash'
import path from 'path'
import {moduleExec} from './utils';
import {exec, spawn, wait, retry} from '@nebulario/core-process';
import killTree from 'tree-kill';
import {event} from './io';
import * as Request from './request';

export const start = async (params, cxt) => {

  const {fullname, dependencies} = params;

  //docker run --rm 919446158824.dkr.ecr.us-east-1.amazonaws.com/repoflow.com/graph
  // -v /c/Users:/myVolData
  const startParams = [
    'run',
    '--rm',
    '--env-file',
    './.env',
    '-p',
    '4000:4000',
    '-v',
    '/home/victor/nodeflow/workspace',
    '-t',
    fullname
  ];

  const depApp = _.find(dependencies, {kind: "app"});

  if (depApp) {

    const {
      config: {
        build: {
          enabled
        }
      }
    } = depApp;


    console.log("App is " + enabled + " " + depApp.fullname + " will be mounted from module. ");

    /*const appDepModId = "nodeflow-local-graph";
    const appDepFullname = "@nebulario/nodeflow-local-graph";
    const appDepKind = "app";

    if (enabled) { // check if appDepModId is enabled to build
      startParams.push('-v');
      const depModFolder = "";
      const packageDep = path.join(depModFolder, "node_modules");
      startParams.push(packageDep + ':' + "/app/node_modules");
      startParams.push('-v');
      const distDep = path.join(depModFolder, "dist");
      startParams.push(distDep + ':' + "/app/dist");
    }*/

  }

  await Request.handle(({
    folder,
    fullname,
    mode
  }, cxt) => spawn('docker', startParams, {
    cwd: folder
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
