import { allowedNodeEnvironmentFlags } from "process";

export interface AppConfig {
  readonly mqtt: {
    address: string;
    user?: string;
    password?: string;
    topicPrefix: string;
  };
  readonly gateway: {
    ip: string;
    psk: string;
    identity: string;
  };
}

export function parse(): AppConfig {
  return {
    mqtt: {
      address: getOrError("MQTT_ADDRESS"),
      user: process.env["MQTT_USER"]?.trim(),
      password: process.env["MQTT_PASSWORD"]?.trim(),
      topicPrefix: process.env["MQTT_TOPIC_PREFIX"]?.trim() || "tradfri",
    },
    gateway: {
      ip: getOrError("TRADFRI_GATEWAY"),
      psk: getOrError("TRADFRI_PSK"),
      identity: getOrError("TRADFRI_IDENTITY"),
    },
  };
}

function getOrError(key: string) {
  const val = process.env[key]?.trim();
  if (!val || !val.length) {
    throw new Error(`Missing parameters ${key}`);
  }
  return val;
}
