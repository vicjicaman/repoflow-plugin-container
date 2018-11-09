import path from 'path';
import {moduleExec, loadJson} from './utils';

export const build = async ({
  folder,
  mode
}, cxt) => {
  const {name, version} = loadJson(path.join(folder, "container.json"));
  return await moduleExec(folder, ['docker build . -t ' + name + ':' + version], {}, cxt);
}
