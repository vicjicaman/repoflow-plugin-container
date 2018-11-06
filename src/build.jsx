import {moduleExec} from './utils';

export const build = async ({
  folder,
  mode
}, cxt) => {
  return await moduleExec(folder, ['yarn build:' + mode], {}, cxt);
}
