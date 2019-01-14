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
      commitid
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
    keyPath
  }, {responseType: 'stream'});

  let publishStreamFinished = false;
  response.data.on('data', (data) => {
    event("publish.out", {
      data
    }, cxt);
  });
  response.data.on('end', function() {
    publishStreamFinished = true;
    console.log('finished');
    event("publish.finished", {}, cxt);
  });

  while (publishStreamFinished === false) {
    await wait(100);
  }

  return {stdout: "published", stderr: ""};
}
