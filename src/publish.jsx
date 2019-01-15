import {moduleExec} from './utils'
import {wait, retry} from '@nebulario/core-process';
import axios from 'axios'
import {event} from './io';

export const publish = async (params, cxt) => {
  const {
    keyPath,
    module: {
      moduleid,
      type,
      mode,
      version,
      fullname,
      url,
      commitid,
      branchid
    }
  } = params;

  const response = await axios.post('http://localbuild:8000/build/' + type, {
    moduleid,
    type,
    mode,
    version,
    fullname,
    url,
    commitid,
    branchid,
    keyPath
  }, {responseType: 'stream'});

  let publishStreamFinished = false;
  let publishStreamError = false;

  response.data.on('error', (data) => {
    console.log("STREAM_PUBLISH_ERROR");
    publishStreamError = data.toString();
    event("publish.error", {
      data: data.toString()
    }, cxt);
  });

  response.data.on('data', (raw) => {
    console.log("STREAM_PUBLISH_OUTPUT");
    const rawString = raw.toString();
    let data = {};

    try {
      data = JSON.parse(raw.toString())
    } catch (e) {
      console.log("STREAM_PUBLISH_PARSE:" + rawString);
    }

    if (data.error) {
      publishStreamError = data.error;
    }

    event("publish.out", {
      data: rawString
    }, cxt);

  });

  response.data.on('end', function() {
    publishStreamFinished = true;
    event("publish.finished", {}, cxt);
  });

  while (publishStreamFinished === false) {
    await wait(100);
  }

  if (publishStreamError) {
    return {stdout: "", stderr: publishStreamError};
  }

  return {stdout: "published", stderr: ""};
}
