// @we-the-rebel-alliance/source-contract 0.1.0. Built by scripts/build.mjs; do not edit.
import {
  read
} from "./chunks/chunk-6VCWF7CE.js";
import "./chunks/chunk-GTAX4NNR.js";
import "./chunks/chunk-ELPJD3ND.js";
import "./chunks/chunk-RYNKNCPP.js";
import "./chunks/chunk-36GA4GB4.js";
import "./chunks/chunk-YM6B7BCV.js";
import "./chunks/chunk-3F4IRHS5.js";
import "./chunks/chunk-HLVAKAYG.js";

// src/broker-client.ts
var BROKER_VERSION = 1;
function isUsableBroker(offered) {
  if (typeof offered !== "object" || offered === null) return false;
  const broker = offered;
  return broker.version === BROKER_VERSION && typeof broker.read === "function";
}
function sourceReader(options) {
  const { host, offered } = options;
  if (isUsableBroker(offered)) {
    return {
      mode: "broker",
      read: (request) => offered.read(
        {
          package: request.installed.package,
          version: request.installed.version,
          descriptorHash: request.installed.hash,
          source: request.source,
          consumer: request.consumer,
          grant: request.grant,
          context: request.context,
          ...request.scope === void 0 ? {} : { scope: request.scope },
          ...request.cursor === void 0 ? {} : { cursor: request.cursor },
          ...request.since === void 0 ? {} : { since: request.since },
          ...request.limit === void 0 ? {} : { limit: request.limit },
          ...request.params === void 0 ? {} : { params: request.params },
          ...request.pick === void 0 ? {} : { pick: request.pick }
        },
        request.signal
      )
    };
  }
  return { mode: "embedded", read: (request) => read(host, request) };
}
export {
  BROKER_VERSION,
  isUsableBroker,
  sourceReader
};
