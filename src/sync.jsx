import {syncJSONDependency, syncRegexDependency} from './utils';

export const sync = async ({
  folder,
  filename,
  path,
  version
}, cxt) => {

  if (filename === "docker-compose.yml") {
    syncRegexDependency(folder, {filename, path, version});
  } else {
    syncJSONDependency(folder, {filename, path, version});
  }

  return {};
}
