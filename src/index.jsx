import {IO, Plugin} from '@nebulario/core-plugin-request';

import * as Dependencies from './dependencies';
import * as Build from './build';
import * as Run from './run';
import {publish} from './publish';
import {init} from './init';

(async () => {

  await Plugin.run({
    dependencies: {
      list: Dependencies.list,
      sync: Dependencies.sync
    },
    run: {
      start: Run.start
    },
    build: {
      init,
      start: Build.start
    },
    publish
  });

})().catch(e => {
  IO.sendEvent("plugin.fatal", {data: e.message});
  throw e;
});
