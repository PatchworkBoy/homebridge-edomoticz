// www.npmjs.com/package/homebridge-edomoticz
//
// A Platform Plugin for HomeBridge by Marci & TheRamon
// [http://twitter.com/marcisshadow]
// [http://domoticz.com/forum/memberlist.php?mode=viewprofile&u=10884]

import util from 'node:util';

import { Domoticz } from './lib/domoticz.js';
import { Mqtt } from './lib/mqtt.js';
import eDomoticzAccessory from './lib/domoticz_accessory.js';
import Constants from './lib/constants.js';
import { Helper } from './lib/helper.js';
//import { initEDomoticzServices } from './lib/services.js';

// Homebridge injects the API object via this exported initializer
export default function(homebridge) {
  // Avoid implicit globals (strict mode + ESM would otherwise throw)
  const Service = homebridge.hap.Service;
  const Characteristic = homebridge.hap.Characteristic;
  const Categories = homebridge.hap.Accessory.Categories; // kept even if unused
  const Types = homebridge.hapLegacyTypes;               // kept even if unused
  const UUID = homebridge.hap.uuid;

  //initEDomoticzServices(homebridge.hap);

  // Register platform (same as original)
  homebridge.registerPlatform('homebridge-edomoticz', 'eDomoticz', eDomoticzPlatform, true);

  // eslint-disable-next-line no-unused-vars
  function eDomoticzPlatform(log, config, api) {
    this.isSynchronizingAccessories = false;
    this.accessories = [];
    this.forceLog = log;

    this.log = function(...args) {
      if (typeof process.env.DEBUG !== 'undefined') {
        log(util.format(...args));
      }
    };

    this.config = config;

    try {
      this.server = config.server;
      this.authorizationToken = false;

      if (this.server.indexOf(':') > -1 && this.server.indexOf('@') > -1) {
        const tmparr = this.server.split('@');
        this.authorizationToken = Helper.Base64.encode(tmparr[0]);
        this.server = tmparr[1];
      }

      this.ssl = (config.ssl == 1);
      this.port = config.port;
      this.webroot = config.webroot;
      this.room = config.roomid;
      this.api = api;

      this.apiBaseURL =
        'http' +
        (this.ssl ? 's' : '') +
        '://' +
        this.server +
        ':' +
        this.port +
        ((this.webroot === undefined) ? '' : '/' + this.webroot) +
        '/json.htm?';

      this.mqtt = false;
    } catch (e) {
      this.forceLog(e);
      return;
    }

    const requestHeaders = {};
    if (this.authorizationToken) {
      requestHeaders.Authorization = 'Basic ' + this.authorizationToken;
    }

    Domoticz.initialize(this.ssl, requestHeaders);

    if (this.api) {
      this.api.once('didFinishLaunching', function() {
        const syncDevices = function() {
          this.synchronizeAccessories();
          setTimeout(syncDevices.bind(this), 600000); // Sync devices every 10 minutes
        }.bind(this);

        syncDevices();

        if (config.mqtt) {
          setupMqttConnection(this);
        }
      }.bind(this));
    }
  }

  eDomoticzPlatform.prototype = {
    synchronizeAccessories: function() {
      if (this.isSynchronizingAccessories) {
        return;
      }

      this.isSynchronizingAccessories = true;
      this.forceLog('synchronizeAccessories in progress...');

      const excludedDevices =
        (typeof this.config.excludedDevices !== 'undefined')
          ? this.config.excludedDevices
          : [];

      Domoticz.devices(this.apiBaseURL, this.room, function(devices) {
        const removedAccessories = [];
        const externalAccessories = [];

        for (let i = 0; i < devices.length; i++) {
          const device = devices[i];
          let exclude = false;

          if (!(excludedDevices.indexOf(device.idx) <= -1)) {
            exclude = true;
            this.log(`${device.Name} (idx:${device.idx}) excluded via config array`);
          }

          if (device.Image == undefined) {
            device.Image = 'Switch';
          }

          const existingAccessory = this.accessories.find(function(existingAccessory) {
            return existingAccessory.idx == device.idx;
          });

          if (existingAccessory) {
            if ((device.SwitchTypeVal > 0 && device.SwitchTypeVal !== existingAccessory.swTypeVal) || exclude == true) {
              if (exclude == false) {
                this.forceLog(`Device ${existingAccessory.name} has changed it's type. Recreating...`);
              } else {
                this.forceLog(`Device ${existingAccessory.name} has been excluded. Removing...`);
              }

              removedAccessories.push(existingAccessory);

              try {
                this.api.unregisterPlatformAccessories('homebridge-edomoticz', 'eDomoticz', [existingAccessory.platformAccessory]);
              } catch (e) {
                this.forceLog(`Could not unregister platform accessory! (${existingAccessory.name})\n${e}`);
              }
            } else {
              continue;
            }
          }

          if (exclude == false) {
            const uuid = UUID.generate(`${device.idx}_${device.Name}`);

            this.forceLog(`Device: ${device.Name} (${device.idx})`);

            const accessory = new eDomoticzAccessory(
              this,
              false,
              false,
              device.Used,
              device.idx,
              device.Name,
              uuid,
              device.HaveDimmer,
              device.MaxDimLevel,
              device.SubType,
              device.Type,
              device.BatteryLevel,
              device.SwitchType,
              device.SwitchTypeVal,
              device.HardwareID,
              device.HardwareTypeVal,
              device.Image,
              this.eve,
              device.HaveTimeout,
              device.Description
            );

            this.accessories.push(accessory);

            try {
              accessory.platformAccessory.context = { device, uuid, eve: this.eve };

              if ((device.SwitchTypeVal == Constants.DeviceTypeMedia) ||
                  (device.SwitchTypeVal == Constants.DeviceTypeSelector && device.Image == 'TV')) {
                externalAccessories.push(accessory);
              } else {
                this.api.registerPlatformAccessories('homebridge-edomoticz', 'eDomoticz', [accessory.platformAccessory]);
              }
            } catch (e) {
              this.forceLog(`Could not register platform accessory! (${accessory.name})\n${e}`);
            }
          }
        }

        // Publish external (ie: TV) accessories now that they're fully assembled
        for (let ei = 0; ei < externalAccessories.length; ei++) {
          const externalAccessory = externalAccessories[ei];

          if (externalAccessory.subType !== 'Selector Switch') {
            // NOTE: Homebridge v2 deprecations may affect this call in future.
            // If this breaks, swap to api.publishExternalAccessories() as per v2 guidance.
            this.api.publishExternalAccessories('homebridge-edomoticz', [externalAccessory.platformAccessory]);
            this.forceLog(`External Device: ${externalAccessory.platformAccessory.context.device.Name} (${externalAccessory.platformAccessory.context.device.idx})`);
          }
        }

        // Remove the old accessories
        for (let i = 0; i < this.accessories.length; i++) {
          const removedAccessory = this.accessories[i];

          const existingDevice = devices.find(function(existingDevice) {
            return existingDevice.idx == removedAccessory.idx;
          });

          if (!existingDevice) {
            removedAccessories.push(removedAccessory);

            try {
              this.api.unregisterPlatformAccessories('homebridge-edomoticz', 'eDomoticz', [removedAccessory.platformAccessory]);
            } catch (e) {
              this.forceLog(`Could not unregister platform accessory! (${removedAccessory.name})\n${e}`);
            }
          }
        }

        for (let i = 0; i < removedAccessories.length; i++) {
          const removedAccessory = removedAccessories[i];
          removedAccessory.removed();

          const index = this.accessories.indexOf(removedAccessory);
          this.accessories.splice(index, 1);
        }

        this.isSynchronizingAccessories = false;
      }.bind(this), function(response, err) {
        Helper.LogConnectionError(this, response, err);
        this.isSynchronizingAccessories = false;
      }.bind(this));
    },

    configureAccessory: function(platformAccessory) {
      if (!platformAccessory.context || !platformAccessory.context.device) {
        try {
          this.api.unregisterPlatformAccessories('homebridge-edomoticz', 'eDomoticz', [platformAccessory]);
        } catch (e) {
          this.forceLog(`Could not unregister cached platform accessory!\n${e}`);
        }
        return;
      }

      const device = platformAccessory.context.device;
      const uuid = platformAccessory.context.uuid;
      const eve = platformAccessory.context.eve;

      const accessory = new eDomoticzAccessory(
        this,
        platformAccessory,
        false,
        device.Used,
        device.idx,
        device.Name,
        uuid,
        device.HaveDimmer,
        device.MaxDimLevel,
        device.SubType,
        device.Type,
        device.BatteryLevel,
        device.SwitchType,
        device.SwitchTypeVal,
        device.HardwareID,
        device.HardwareTypeVal,
        device.Image,
        eve,
        device.HaveTimeout,
        device.Description
      );

      this.accessories.push(accessory);
    }
  };

  function setupMqttConnection(platform) {
    const connectionInformation = {
      host: (typeof platform.config.mqtt.host !== 'undefined' ? platform.config.mqtt.host : '127.0.0.1'),
      port: (typeof platform.config.mqtt.port !== 'undefined' ? platform.config.mqtt.port : 1883),
      topic: (typeof platform.config.mqtt.topic !== 'undefined' ? platform.config.mqtt.topic : 'domoticz/out'),
      username: (typeof platform.config.mqtt.username !== 'undefined' ? platform.config.mqtt.username : ''),
      password: (typeof platform.config.mqtt.password !== 'undefined' ? platform.config.mqtt.password : '')
    };

    const mqttError = function() {
      platform.forceLog(
        'There was an error while getting the MQTT Hardware Device from Domoticz.\n' +
        'Please verify that you have added the MQTT Hardware Device and that the hardware device is enabled.'
      );
    };

    Domoticz.hardware(platform.apiBaseURL, function(hardware) {
      let mqttHardware = false;

      for (let i = 0; i < hardware.length; i++) {
        if (hardware[i].Type == Constants.HardwareTypeMQTT) {
          mqttHardware = hardware[i];
          break;
        }
      }

      if (mqttHardware === false || (mqttHardware.Enabled != 'true')) {
        mqttError();
        return;
      }

      if (typeof platform.config.mqtt.host === 'undefined') {
        connectionInformation.host = mqttHardware.Address;
      }
      if (typeof platform.config.mqtt.port === 'undefined') {
        connectionInformation.port = mqttHardware.Port;
      }
      if (typeof platform.config.mqtt.username === 'undefined') {
        connectionInformation.username = mqttHardware.Username;
      }
      if (typeof platform.config.mqtt.password === 'undefined') {
        connectionInformation.password = mqttHardware.Password;
      }

      platform.mqtt = new Mqtt(
        platform,
        connectionInformation.host,
        connectionInformation.port,
        connectionInformation.topic,
        { username: connectionInformation.username, password: connectionInformation.password }
      );
    }, mqttError);
  }
}
