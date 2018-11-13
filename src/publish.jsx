import {moduleExec} from './utils'
import {wait, retry} from '@nebulario/core-process';
import axios from 'axios'

export const publish = async (params, cxt) => {
  const {module: {
      type
    }} = params;
  console.log('http://localbuild:8000/build/' + type);
  const queryLocal = await axios.post('http://localbuild:8000/build/' + type, params);
  console.log(JSON.stringify(queryLocal.data));
  const res = queryLocal.data;

  if (!res.success) {
    throw new Error(res.error);
  }

  return {stdout: res.message, stderr: ""};
}
