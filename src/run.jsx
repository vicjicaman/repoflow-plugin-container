import _ from 'lodash'
import {moduleExec} from './utils';
import {exec, spawn, wait, retry} from '@nebulario/core-process';
import killTree from 'tree-kill';
import {event} from './io';
import * as Request from './request';

export const start = async (params, cxt) => {

  await Request.handle( ({
    folder,
    mode
  }, cxt) => spawn('yarn', ['start:' + mode], {
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
