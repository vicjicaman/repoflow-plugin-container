import _ from 'lodash'
import {spawn} from '@nebulario/core-process';
import {Operation, IO} from '@nebulario/core-plugin-request';

export const init = async (params, cxt) => {

  const {
    module: {
      moduleid,
      mode,
      fullname,
      code: {
        paths: {
          absolute: {
            folder
          }
        }
      }
    },
    modules
  } = params;

  const initHandlerCnf = {
    onOutput: async function({data}) {
      IO.sendEvent("init.out", {
        data
      }, cxt);
    },
    onError: async ({data}) => {
      IO.sendEvent("init.err", {
        data
      }, cxt);
    }
  };

  const ModInfo = _.find(modules, {moduleid});

  if (ModInfo && ModInfo.config.build.enabled) {

    await Operation.exec('yarn', [
      'install', '--check-files'
    ], {
      cwd: folder
    }, initHandlerCnf, cxt);

  }

  return {};
}
