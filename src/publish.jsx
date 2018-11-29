import {moduleExec} from './utils'
import {wait, retry} from '@nebulario/core-process';
import axios from 'axios'
import {event} from './io';

export const publish = async (params, cxt) => {
  const {module: {
      type
    }} = params;
  console.log('http://localbuild:8000/build/' + type);
  const response = await axios.post('http://localbuild:8000/build/' + type, params, {responseType: 'stream'});

  let publishStreamFinished = false;
  //response.data.pipe(process.stdout);

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

  //console.log(JSON.stringify(queryLocal.data));
  //const res = queryLocal.data;

  //if (!res.success) {
  //throw new Error(res.error);
  //}

  while (publishStreamFinished === false) {
    await wait(100);
  }

  //throw new Error("FORCED");

  return {stdout: "published", stderr: ""};
}
