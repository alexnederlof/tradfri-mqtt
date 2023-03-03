import { config as loadEnv, config } from "dotenv";
import { IRouterHandler } from "express";
import { Client as MqttClient, connect as newMqttClient } from "mqtt";
import { TradfriClient } from "node-tradfri-client";
import { Bridge } from "./Bridge";
import { AppConfig, parse } from "./Config";

async function main() {
  await loadEnv();
  const config = parse();
  const tradfri = await setupTradfriClient(config);
  const mqtt = await connectToMqtt(config);
  const bridge = new Bridge(mqtt, tradfri, config);

  process.on("SIGTERM", () => bridge.stop());
  process.on("SIGINT", () => bridge.stop());

  bridge.start();
}

async function setupTradfriClient(config: AppConfig) {
  const { ip, identity, psk } = config.gateway;
  console.log(`Connecting to Tradfri ${ip} as ${identity}`);
  const tradfri = new TradfriClient(ip);
  await tradfri.connect(identity, psk);
  console.log("Connected! Starting to listen to devices.");
  return tradfri;
}

async function connectToMqtt(config: AppConfig) {
  return new Promise<MqttClient>((res, reject) => {
    console.log("Connecting to MQTT " + config.mqtt.address);
    const client = newMqttClient({
      host: config.mqtt.address,
      username: config.mqtt.user,
      password: config.mqtt.password,
      clientId: "tradfri2mqtt",
    });
    let connectedBefore = false;
    client.on("connect", () => {
      if (!connectedBefore) {
        connectedBefore = true;
        console.log("Connected to MQTT!");
        res(client);
      }
    });
    client.on("error", (e) => reject(e));
  });
}

async function getIdentity(host: string, token: string) {
  console.log(`Authenticating to ${host}`);
  const tradfri = new TradfriClient(host);
  try {
    const { identity, psk } = await tradfri.authenticate(token);
    console.log(`Auth success:`);
    console.log(`TRADFRI_IDENTITY=${identity}`);
    console.log(`TRADFRI_PSK=${psk}`);
    process.exit(0);
  } catch (e) {
    console.error("Auth failed: " + e, e);
  }
}

let args = [...process.argv];
if (args.includes("auth")) {
  while (args.shift() !== "auth") {}
  const [host, token] = args;
  getIdentity(host, token).catch((e) => {
    console.error(e);
    process.exit(1);
  });
} else {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
