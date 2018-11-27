import Promise from 'bluebird'
import fs from 'fs'
import {wait} from '@nebulario/core-process';
import {event, getEncodedEvents} from './io';

import {dependencies} from './dependencies';
import {sync} from './sync';
import {build} from './build';
import * as Dynamic from './dynamic';
import * as Run from './run';
import {init} from './init';
import {publish} from './publish';

const payloadB64 = process.argv[2];
const cxt = JSON.parse(Buffer.from(payloadB64, 'base64').toString('ascii'));
cxt.requests = {};
cxt.status = "ready";
const {pluginid, requests} = cxt;
let terminateFlag = false;

process.on('SIGTERM', shutdown('SIGTERM')).on('SIGINT', shutdown('SIGINT')).on('uncaughtException', shutdown('uncaughtException'));

const handleCommand = async (requestid, commandid, params, cxt) => {
  let out = null;
  if (commandid === "dependencies") {
    out = await dependencies(params, cxt);
  }

  if (commandid === "sync") {
    out = await sync(params, cxt);
  }

  if (commandid === "init") {
    out = await init(params, cxt);
  }

  if (commandid === "build") {
    out = await build(params, cxt);
  }

  if (commandid === "dynamic.init") {
    out = await Dynamic.init(params, cxt);
  }

  if (commandid === "dynamic.build") {
    out = await Dynamic.build(params, cxt);
  }

  if (commandid === "dynamic.stop") {
    out = await Dynamic.stop(params, cxt);
  }

  if (commandid === "run.start") {
    out = await Run.start(params, cxt);
  }

  if (commandid === "run.restart") {
    out = await Run.restart(params, cxt);
  }

  if (commandid === "run.stop") {
    out = await Run.stop(params, cxt);
  }

  if (commandid === "publish") {
    out = await publish(params, cxt);
  }

  event("request.output", {
    output: out || {}
  }, cxt);
}

function shutdown(signal) {

  return async function(err) {
    console.log(`${signal}...`);
    if (err)
      console.error(err.stack || err);

    event("plugin.terminated", {
      data: "Plugin finished... no more request accepted"
    }, cxt);

    terminateFlag = true;

    setTimeout(() => {
      //console.log('...waited 5s, exiting.');
      process.exit(
        err
        ? 1
        : 0);
    }, 1000).unref();
  };

}(async () => {

  console.log("Starting plugin " + pluginid);

  process.stdin.on('data', async function(rawData) {
    const data = rawData.toString();

    console.log("ECHO:" + data);
    const events = getEncodedEvents(data, cxt)

    for (const evt of events) {

      if (evt.event === "request") {
        const {requestid, commandid, params} = evt.payload;
        requests[requestid] = {
          requestid,
          commandid
        };

        const reqCxt = {
          ...cxt,
          request: requests[requestid]
        };

        try {

          console.log("Handle request " + requestid);
          await handleCommand(requestid, commandid, params, reqCxt);

        } catch (e) {
          event("request.error", {
            data: e.message
          }, reqCxt);
        }
      }

      if (evt.event === "finish") {
        cxt.status = "finish";
      }
    }

  });

  while (terminateFlag === false || cxt.status === "ready") {
    await wait(100);
  }

  event("plugin.finished", {
    data: "Plugin finished... no more request accepted"
  }, cxt);

  console.log("FINISHED PLUGIN ----------------------------------------------------------------------- TERMINATED");

})().catch(e => {
  event("plugin.fatal", {
    data: e.message
  }, cxt);
  throw e;
});
