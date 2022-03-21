import { allowedNodeEnvironmentFlags } from "process";

export interface AppConfig {
  readonly mqtt: {
    address: string;
    user: string;
    password: string;
  };
  readonly gateway: {
    ip: string;
    psk: string;
  };
}

export function parse(): AppConfig {
  return {
    mqtt: {
      address: getOrError("MQTT_ADDRESS"),
      user: getOrError("MQTT_USER"),
      password: getOrError("MQTT_PASSWORD"),
    },
    gateway: {
      ip: getOrError("TRADFRI_GATEWAY"),
      psk: getOrError("TRADFRI_PSK"),
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
