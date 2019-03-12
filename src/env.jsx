import fs from 'fs'
import path from 'path'

export const replace = (content, env) => {
  let replaced = content;

  for (const envVar in env) {
    const envVal = env[envVar];
    replaced = replaced.replace(new RegExp("\\$\\{" + envVar + "\\}", 'g'), envVal);
  }

  return replaced;
}

export const get = (folder, env) => {

  const content = fs.readFileSync(path.join(folder, ".env"), "utf8");
  const out = {
    ...env
  };

  const lines = content.split('\n');
  for (const line of lines) {
    const i = line.indexOf('=');
    const key = line.substr(0, i);
    const val = line.substr(i + 1);

    if (val) {
      const replaced = replace(val, out);

      if (replaced.charAt(0) === '"' && replaced.charAt(replaced.length - 1) === '"') {
        out[key] = replaced.substr(1, replaced.length - 2);
      } else {
        out[key] = replaced;
      }

    }
  }

  return out;
}
