import { Client as MqttClient } from "mqtt";
import { AppConfig } from "./Config";
import {
  Accessory,
  AccessoryTypes,
  Light,
  Sensor,
  Plug,
  Blind,
  AirPurifier,
  TradfriClient,
} from "node-tradfri-client";

const DEVICE_TYPES: { [key in AccessoryTypes]: string } = {
  [AccessoryTypes.remote]: "remote",
  [AccessoryTypes.airPurifier]: "air-purifier",
  [AccessoryTypes.blind]: "blind",
  [AccessoryTypes.lightbulb]: "lightbulb",
  [AccessoryTypes.motionSensor]: "motion",
  [AccessoryTypes.plug]: "plug",
  [AccessoryTypes.remote]: "remote",
  [AccessoryTypes.signalRepeater]: "repeater",
  [AccessoryTypes.slaveRemote]: "slave",
  [AccessoryTypes.soundRemote]: "sound-remote",
};

export class Bridge {
  private readonly cache = new Map<number, { [key: string]: string }>();

  constructor(
    private mqtt: MqttClient,
    private tradfri: TradfriClient,
    private config: AppConfig
  ) {}

  public start() {
    this.tradfri
      .on("device updated", this.onDeviceUpdate.bind(this))
      .on("device removed", this.onDeviceRemoval.bind(this))
      .observeDevices();
  }

  public async stop() {
    console.log("Shutting down tradfri");
    this.tradfri.destroy();
    console.log("Shutting down mqtt");
    await new Promise((res) => this.mqtt.end(false, {}, res));
    console.log("Shutdown complete");
  }

  private async onDeviceUpdate(device: Accessory) {
    // console.log("Got update ", device);
    const baseMqttPath = `${this.config.mqtt.topicPrefix}/${
      DEVICE_TYPES[device.type] || device.type
    }/${device.instanceId}`;
    await this.updateAccessoryData(device, baseMqttPath);
    await this.updateDeviceInfo(device, baseMqttPath);
    switch (device.type) {
      case AccessoryTypes.remote:
      case AccessoryTypes.slaveRemote:
      case AccessoryTypes.soundRemote:
      case AccessoryTypes.signalRepeater:
        // not relevant
        break;
      case AccessoryTypes.blind:
        await this.updateDeviceSpecifics(
          device.instanceId,
          baseMqttPath,
          device.blindList,
          ["position", "trigger"]
        );
        break;
      case AccessoryTypes.airPurifier:
        await this.updateDeviceSpecifics(
          device.instanceId,
          baseMqttPath,
          device.airPurifierList,
          [
            "airQuality",
            "controlsLocked",
            "fanMode",
            "fanSpeed",
            "totalFilterLifetime",
            "filterRuntime",
            "filterRemainingLifetime",
            "filterStatus",
            "statusLEDs",
            "totalMotorRuntime",
          ]
        );
        break;
      case AccessoryTypes.lightbulb:
        await this.updateDeviceSpecifics(
          device.instanceId,
          baseMqttPath,
          device.lightList,
          ["onOff", "powerFactor", "colorTemperature", "dimmer"]
        );
        break;
      case AccessoryTypes.motionSensor:
        await this.updateDeviceSpecifics(
          device.instanceId,
          baseMqttPath,
          device.sensorList,
          [
            "sensorType",
            "minMeasuredValue",
            "maxMeasuredValue",
            "minRangeValue",
            "maxRangeValue",
            "resetMinMaxMeasureValue",
            "sensorValue",
          ]
        );
        break;
      case AccessoryTypes.plug:
        await this.updateDeviceSpecifics(
          device.instanceId,
          baseMqttPath,
          device.plugList,
          ["onOff", "powerFactor", "dimmer"]
        );
        break;
      default:
        console.log(
          `No handlers for dev type ${DEVICE_TYPES[device.type]}`,
          device
        );
    }
  }

  private async updateDeviceSpecifics<T, K extends keyof T>(
    instanceId: number,
    basePath: string,
    specifics: T[],
    interest: K[]
  ) {
    for await (const specific of specifics) {
      for await (const key of interest) {
        await this.updateIfChanged(
          instanceId,
          key as string,
          this.toStringOrEmpty(specific[key]),
          basePath
        );
      }
    }
  }

  private async updateAccessoryData(device: Accessory, baseMqttPath: string) {
    device = device.fixBuggedProperties();
    const toInspect: Array<keyof Accessory> = [
      "instanceId",
      "name",
      "alive",
      "otaUpdateState",
      "type",
    ];
    for await (const key of toInspect) {
      await this.updateIfChanged(
        device.instanceId,
        key,
        this.toStringOrEmpty(device[key]),
        baseMqttPath
      );
    }
    await this.updateIfChanged(
      device.instanceId,
      "lastSeen",
      new Date(device.lastSeen * 1000).toISOString(),
      baseMqttPath
    );
  }

  private async updateDeviceInfo(device: Accessory, baseMqttPath: string) {
    const toInspect: Array<keyof Accessory["deviceInfo"]> = [
      "battery",
      "firmwareVersion",
      "modelNumber",
      "power",
    ];
    const devInfo = device.deviceInfo.fixBuggedProperties();
    for await (const key of toInspect) {
      await this.updateIfChanged(
        device.instanceId,
        key,
        this.toStringOrEmpty(devInfo[key]),
        baseMqttPath
      );
    }
  }

  private async updateIfChanged(
    device: number,
    key: string,
    value: string,
    basePath: string
  ) {
    let changed = false;
    let path = basePath + `/` + key;
    let cached = this.cache.get(device);
    if (cached) {
      changed = cached[key] !== value;
      cached[key] = value;
    } else {
      changed = true;
      this.cache.set(device, { [key]: value });
    }
    if (changed) {
      console.debug(`Publishing ${path}: ${value}`);
      try {
        if (value === null || value === undefined) {
          await this.publish(path, "");
        } else await this.publish(path, value);
      } catch (e) {
        console.error(`Could not publish ${key} : ${value}: ${e}`, e);
      }
    }
  }

  private onDeviceRemoval(instance: number) {
    console.log("Device removed ", instance);
  }

  private async publish(key: string, value: string) {
    return new Promise<number | undefined>((res, rej) =>
      this.mqtt.publish(key, value, (err, ok) => {
        if (err) {
          rej(err);
        } else {
          res(ok?.messageId);
        }
      })
    );
  }

  private toStringOrEmpty(value: any): string {
    if (value === null || value === undefined) {
      return "";
    } else {
      return `${value}`;
    }
  }
}
