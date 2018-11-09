import {moduleExec} from './utils'
import {wait, retry} from '@nebulario/core-process';

export const publish = async ({
  folder,
  fullname,
  version
}, cxt) => {

  // create-repository --repository-name <<NAME>>
  // docker push 919446158824.dkr.ecr.us-east-1.amazonaws.com/nodeflow.io/test/nodejs:latest
  // docker tag nodeflow.io/test/nodejs:latest 919446158824.dkr.ecr.us-east-1.amazonaws.com/nodeflow.io/test/nodejs
  //

  throw new Error("HOLD DEBUG");
  return {stdout: "", stderr: "Not implemented"};

}
