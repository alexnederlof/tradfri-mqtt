import { config as loadEnv, config } from "dotenv";
import { Client as MqttClient, connect as newMqttClient } from "mqtt";
import { Accessory, AccessoryTypes, TradfriClient } from "node-tradfri-client";
import { Bridge } from "./Bridge";
import { AppConfig, parse } from "./Config";

async function main() {
  await loadEnv();
  const config = parse();
  const tradfri = await setupTradfriClient(config);
  const mqtt = await connectToMqtt(config);
  const bridge = new Bridge(mqtt, tradfri);

  process.on("SIGTERM", () => bridge.stop);
  process.on("SIGINT", () => bridge.stop);

  bridge.start();
}

async function setupTradfriClient(config: AppConfig) {
  const tradfri = new TradfriClient(config.gateway.ip);
  console.log(`Authenticating with ${config.gateway.ip}`);
  const identity = await tradfri.authenticate(config.gateway.psk);
  console.log(`Auth successfull as ${identity.identity}. Connecting...`);
  await tradfri.connect(identity.identity, identity.psk);
  console.log("Connected! Starting to listen to devices.");

  const result = await tradfri.ping();
  console.log("Ping is ", result);
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

console.log("Let's go");
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
