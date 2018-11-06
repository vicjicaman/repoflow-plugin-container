import {syncJSONDependency} from './utils';

export const sync = async ({
  folder,
  filename,
  path,
  version
}, cxt) => {
  syncJSONDependency(folder, {filename, path, version});
  return {};
}
