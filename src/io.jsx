import _ from 'lodash'
const uuidv4 = require('uuid/v4');

export const getEncodedEvents = (data, cxt) => {
  const rawInput = data.split("\n");
  const rawEvents = _.filter(rawInput, l => l.startsWith("MIO{"));
  return _.map(rawEvents, re => JSON.parse(re.substr(3)))
}

export const event = (event, payload, cxt) => {
  console.log("SENDING EVENT " + event);
  const {request: {
      requestid
    }} = cxt;

  const ev = {
    id: uuidv4(),
    requestid,
    event,
    payload
  }
  console.log("SIO" + JSON.stringify(ev));
}
