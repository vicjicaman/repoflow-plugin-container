import {spawn} from '@nebulario/core-process';
import {Operation, IO} from '@nebulario/core-plugin-request';

export const init = async (params, cxt) => {
  const {folder, mode, dependencies} = params;

  for (const cnfdep of dependencies) {
    const {
      kind,
      fullname,
      config: {
        build: {
          moduleid,
          enabled
        }
      }
    } = cnfdep;
  }

  await Operation.exec('yarn', [
    'install', '--check-files'
  ], {
    cwd: folder
  }, {
    onOutput: async function(data) {
      event("init.out", {
        data
      }, cxt);
    },
    onError: async (data) => {
      event("init.err", {
        data
      }, cxt);
    }
  }, cxt);

  return {};
}
