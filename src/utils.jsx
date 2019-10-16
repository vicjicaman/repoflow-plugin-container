import _ from "lodash";
import path from "path";
import * as Performer from "@nebulario/core-performer";
import * as JsonUtils from "@nebulario/core-json";

export const getLinkedApp = (contPerf, performers) => {
  const {
    dependents,
    module: { dependencies }
  } = contPerf;

  const appdep = _.find(dependencies, ({ kind }) => kind === "app");

  if (appdep) {
    const { moduleid } = appdep;

    const depSrvPerformer = _.find(performers, {
      performerid: moduleid
    });

    if (depSrvPerformer && depSrvPerformer.linked) {
      return depSrvPerformer;
    }
  }

  return null;
};


export const getContainerBuildPath = ({ performer, instance: { instanceid } }) =>
  path.join(
    "${HOME}/repoflow/instances",
    instanceid,
    "containers",
    performer.performerid
  );
