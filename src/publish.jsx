import { Publish } from "@nebulario/core-plugin-request";

export const publish = async (params, cxt) => {
  let serverUrl = "http://build.repoflow.local:8000/build";

  if (params.config.build) {
    serverUrl = params.config.build.url;
  }

  return await Publish.publish(serverUrl, params, cxt);
};
