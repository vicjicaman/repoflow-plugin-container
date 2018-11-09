import {moduleExec} from './utils';

export const init = async ({
  folder
}, cxt) => {
  return await moduleExec(folder, ['yarn install'], {}, cxt);
}
