import _ from 'lodash'
import path from 'path'
import {moduleExec, loadJson} from './utils';
import {exec, spawn, wait, retry} from '@nebulario/core-process';
import killTree from 'tree-kill';
import {event} from './io';
import * as Request from './request';

export const clean = async (params, cxt) => {
  return {};
}

export const init = async (params, cxt) => {

  const {folder, mode, dependencies} = params;

  const initHandlerCnf = {
    onOutput: async function(data) {
      event("init.out", {
        data
      }, cxt);
    },
    onError: async (data) => {
      event("init.err", {
        data
      }, cxt);
    }
  };

  for (const cnfdep of dependencies) {
    const {
      kind,
      fullname,
      config: {
        build: {
          moduleid,
          enabled
        }
      }
    } = cnfdep;
  }

  await Request.handle(({
    folder
  }, cxt) => spawn('yarn', [
    'install', '--check-files'
  ], {
    cwd: folder
  }, initHandlerCnf), params, cxt);

  return {};
}

export const build = async (params, cxt) => {

  const {folder, mode, fullname} = params;

  const buildHandlerCnf = {
    onOutput: async function(data) {
      event("build.out.building", {
        data
      }, cxt);
    },
    onError: async (data) => {
      event("build.err", {
        data
      }, cxt);
    }
  };

  await Request.handle(({
    folder,
    fullname,
    mode
  }, cxt) => {
    const {version} = loadJson(path.join(folder, "container.json"));
    return spawn('docker', [
      'build', '.', '-t', fullname + ":" + version
    ], {
      cwd: folder
    }, buildHandlerCnf);
  }, params, cxt);

  event("build.out.done", {}, cxt);
  console.log("EXPECTED OUTPUT FROM FINISHED BUILD REQUEST--------------------------");

  return;

}

export const stop = async ({
  requestid
}, cxt) => {
  Request.stop({
    requestid
  }, cxt);
}
