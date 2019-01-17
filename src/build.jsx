import {spawn} from '@nebulario/core-process';
import {Operation, IO} from '@nebulario/core-plugin-request';

export const start = async (params, cxt) => {
  const {folder, mode, fullname} = params;

  const {version} = loadJson(path.join(folder, "container.json"));
  return spawn('docker', [
    'build', '.', '-t', fullname + ":" + version
  ], {
    cwd: folder
  }, {
    onOutput: async function(data) {

      if (data.includes("Successfully tagged")) {
        event("build.out.done", {
          data
        }, cxt);
      } else {
        event("build.out.building", {
          data
        }, cxt);
      }

    },
    onError: async (data) => {
      event("build.err", {
        data
      }, cxt);
    }
  });
}
