import { Client as MqttClient } from "mqtt";
import { Accessory, TradfriClient } from "node-tradfri-client";

export class Bridge {
  constructor(private mqtt: MqttClient, private tradfri: TradfriClient) {}

  public start() {
    this.tradfri
      .on("device updated", this.onDeviceUpdate)
      .on("device removed", this.onDeviceRemoval)
      .observeDevices();
  }

  public async stop() {
    console.log("Shutting down tradfri");
    this.tradfri.destroy();
    console.log("Shutting down mqtt");
    await new Promise((res) => this.mqtt.end(false, {}, res));
    console.log("Shutdown complete");
  }

  private onDeviceUpdate(device: Accessory) {
    console.log("Got update ", device);
  }

  private onDeviceRemoval(instance: number) {
    console.log("Device removed ", instance);
  }
}
