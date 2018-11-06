import _ from 'lodash'
import {moduleExec} from './utils';
import {exec, spawn, wait, retry} from '@nebulario/core-process';
import killTree from 'tree-kill';
import {event} from './io';

export const get = (requestid, cxt) => {
  return cxt.requests[requestid];
}

export const handle = async (handler, params, cxt) => {
  const request = cxt.request;
  request.params = params;

  const control = async (params, cxt) => {
    const request = cxt.request;

    while (request.status !== "stopped") {

      if (request.commandid === "run.start") {
        console.log("Request control loop " + request.requestid);
      }

      if (request.command === "stop" || request.command === "restart") {

        console.log("Stop/Restart request run " + request.requestid);
        if (request.process) {
          console.log("REQUEST KILLED " + request.process.pid);
          killTree(request.process.pid, 'SIGINT');
          request.process = null;
        }

        request.status = "stopped";
        break;
      }

      await wait(100);
    }

  }

  const executor = async (params, cxt) => {
    const request = cxt.request;
    console.log("Request executor " + request.requestid);

    const {promise: runtimePromise, process: runtimeProcess} = handler(params, cxt);
    console.log("Request executor " + request.requestid);
    request.process = runtimeProcess;
    console.log("REQUEST TO BE KILLED " + request.process.pid);

    try {
      await runtimePromise;
    } finally {
      request.status = "stopped";
    }
  }

  let k = 0;
  while (k++ < 5) {

    console.log("MAIN handle request " + request.requestid + " >>>>>>>>>>>>>>>>>>>> " + k);
    try {

      request.status = "running";
      await Promise.all([
        control(params, cxt),
        executor(params, cxt)
      ]);

      if (request.command !== "restart") {
        break;
      }

    } catch (e) {
      console.log("CATCH EXCEPTION IN REQUEST LOOP " + e.toString());
      if (request.command !== "restart") {
        throw e;
      }
    }

    request.command = null;
  }

}

export const restart = async ({
  requestid
}, cxt) => {
  const request = get(requestid, cxt);

  console.log("Restart request " + requestid);
  if (request) {
    console.log("REQUEST STATUS RESTART ");
    request.command = "restart";
  }
}

export const stop = async ({
  requestid
}, cxt) => {
  const request = get(requestid, cxt);

  console.log("Stop request " + requestid);
  if (request) {
    console.log("REQUEST STATUS STOPED ");
    request.command = "stop";
  }

}
