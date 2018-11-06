import {moduleExec} from './utils'
import {wait, retry} from '@nebulario/core-process';

export const publish = async ({
  folder,
  fullname,
  version
}, cxt) => {

  let ready = true;
  let data = []
  try {

    const {stdout: versionsInfoString} = await moduleExec(folder, ['yarn info ' + fullname + ' versions --json'], {}, cxt);
    const info = JSON.parse(versionsInfoString);
    data = info.data;

    if (data.includes(version)) {
      ready = false;
    }
  } catch (e) {}

  if (ready) {

    const out = await retry(async i => await moduleExec(folder, ['yarn publish --new-version=' + version], {}, cxt), (re, i, time) => {

      if (re.code === 1 && (re.stderr.includes("socket hang up") || re.stderr.includes("EHOSTUNREACH") || re.stderr.includes("ETIMEDOUT"))) {
        return true;
      } else {
        return false;
      }

    }, 5);

    await wait(5000);
    return out;
  } else {
    return {
      stdout: JSON.stringify(data),
      stderr: version + " already released."
    };
  }

}
