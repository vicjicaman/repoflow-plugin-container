import {spawn} from '@nebulario/core-process';
import {Operation, IO} from '@nebulario/core-plugin-request';
import {getComposeDependency} from './dependencies'

export const start = (params, cxt) => {

  const {
    module: {
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

  const dep = getComposeDependency(folder, cxt);

  return spawn('docker', [
    'build', '.', '-t', dep.fullname + ":" + dep.version
  ], {
    cwd: folder
  }, {
    onOutput: async function({data}) {

      if (data.includes("Successfully tagged")) {
        IO.sendEvent("build.out.done", {
          data
        }, cxt);
      } else {
        IO.sendEvent("build.out.building", {
          data
        }, cxt);
      }

    },
    onError: async ({data}) => {
      IO.sendEvent("build.err", {
        data
      }, cxt);
    }
  });
}
