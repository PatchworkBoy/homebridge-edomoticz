//         ____                        _   _
//     ___|  _ \  ___  _ __ ___   ___ | |_(_) ___ ____
//    / _ | | | |/ _ \| '_ ` _ \ / _ \| __| |/ __|_  /
//   |  __| |_| | (_) | | | | | | (_) | |_| | (__ / /
//    \___|____/ \___/|_| |_| |_|\___/ \__|_|\___/___|
//       www.npmjs.com/package/homebridge-edomoticz
//
//   A Platform Plugin for HomeBridge by Marci & TheRamon
//           [http://twitter.com/marcisshadow]
//           [http://domoticz.com/forum/memberlist.php?mode=viewprofile&u=10884]
//
var Domoticz = require('./lib/domoticz.js').Domoticz;
var Mqtt = require('./lib/mqtt.js').Mqtt;
var eDomoticzAccessory = require('./lib/domoticz_accessory.js');
var Constants = require('./lib/constants.js');
var Helper = require('./lib/helper.js').Helper;
var eDomoticzServices = require('./lib/services.js').eDomoticzServices;
const util = require('util');

module.exports = function(homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    Categories = homebridge.hap.Accessory.Categories;
    Types = homebridge.hapLegacyTypes;
    UUID = homebridge.hap.uuid;

    util.inherits(eDomoticzServices.TotalConsumption, Characteristic);
    util.inherits(eDomoticzServices.CurrentConsumption, Characteristic);
    util.inherits(eDomoticzServices.GasConsumption, Characteristic);
    util.inherits(eDomoticzServices.TempOverride, Characteristic);
    util.inherits(eDomoticzServices.MeterDeviceService, Service);
    util.inherits(eDomoticzServices.GasDeviceService, Service);
    util.inherits(eDomoticzServices.Ampere, Characteristic);
    util.inherits(eDomoticzServices.AMPDeviceService, Service);
    util.inherits(eDomoticzServices.Volt, Characteristic);
    util.inherits(eDomoticzServices.VOLTDeviceService, Service);
    util.inherits(eDomoticzServices.CurrentUsage, Characteristic);
    util.inherits(eDomoticzServices.UsageDeviceService, Service);
    util.inherits(eDomoticzServices.TodayConsumption, Characteristic);
    util.inherits(eDomoticzServices.Barometer, Characteristic);
    util.inherits(eDomoticzServices.WaterFlow, Characteristic);
    util.inherits(eDomoticzServices.TotalWaterFlow, Characteristic);
    util.inherits(eDomoticzServices.WaterDeviceService, Service);
    util.inherits(eDomoticzServices.WeatherService, Service);
    util.inherits(eDomoticzServices.WindSpeed, Characteristic);
    util.inherits(eDomoticzServices.WindChill, Characteristic);
    util.inherits(eDomoticzServices.WindDirection, Characteristic);
    util.inherits(eDomoticzServices.WindDeviceService, Service);
    util.inherits(eDomoticzServices.Rainfall, Characteristic);
    util.inherits(eDomoticzServices.RainDeviceService, Service);
    util.inherits(eDomoticzServices.Visibility, Characteristic);
    util.inherits(eDomoticzServices.VisibilityDeviceService, Service);
    util.inherits(eDomoticzServices.SolRad, Characteristic);
    util.inherits(eDomoticzServices.SolRadDeviceService, Service);
    util.inherits(eDomoticzServices.LocationService, Service);
    util.inherits(eDomoticzServices.Location, Characteristic);
    util.inherits(eDomoticzServices.InfotextDeviceService, Service);
    util.inherits(eDomoticzServices.Infotext, Characteristic);
    util.inherits(eDomoticzServices.UVDeviceService, Service);
    util.inherits(eDomoticzServices.UVIndex, Characteristic);

    //homebridge.registerAccessory("homebridge-edomoticz", "eDomoticz", eDomoticzAccessory);
    homebridge.registerPlatform("homebridge-edomoticz", "eDomoticz", eDomoticzPlatform, true);
};

function eDomoticzPlatform(log, config, api) {
    this.isSynchronizingAccessories = false;
    this.accessories = [];
    this.forceLog = log;
    this.log = function() {
        if (typeof process.env.DEBUG !== 'undefined') {
            log(util.format.apply(this, arguments));
        }
    };

    this.config = config;
    try {
        this.server = config.server;
        this.authorizationToken = false;
        if (this.server.indexOf(":") > -1 && this.server.indexOf("@") > -1) {
            var tmparr = this.server.split("@");
            this.authorizationToken = Helper.Base64.encode(tmparr[0]);
            this.server = tmparr[1];
        }

        this.ssl = (config.ssl == 1);
        this.port = config.port;
        this.webroot = config.webroot;
        this.room = config.roomid;
        this.api = api;
        this.apiBaseURL = "http" + (this.ssl ? "s" : "") + "://" + this.server + ":" + this.port + ((this.webroot === undefined) ? "" : "/" + this.webroot ) + "/json.htm?";
        this.mqtt = false;
    } catch (e) {
        this.forceLog(e);
        return;
    }
    var requestHeaders = {};
    if (this.authorizationToken) {
        requestHeaders['Authorization'] = 'Basic ' + this.authorizationToken;
    }
    Domoticz.initialize(this.ssl, requestHeaders);

    if (this.api) {
        this.api.once("didFinishLaunching", function() {
            var syncDevices = function() {
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
        var excludedDevices = (typeof this.config.excludedDevices !== 'undefined') ? this.config.excludedDevices : [];

        Domoticz.devices(this.apiBaseURL, this.room, function(devices) {
            var removedAccessories = [],
                externalAccessories = [];


            for (var i = 0; i < devices.length; i++) {
                var device = devices[i], exclude = !1;
                if (!(excludedDevices.indexOf(device.idx) <= -1)) {
                    exclude = !0;
                    this.log(device.Name + ' (idx:' + device.idx + ') excluded via config array');
                }

                if (device.Image == undefined) {
                    device.Image = 'Switch';
                }

                var existingAccessory = this.accessories.find(function(existingAccessory) {
                    return existingAccessory.idx == device.idx;
                });

                if (existingAccessory) {
                    if ((device.SwitchTypeVal > 0 && device.SwitchTypeVal !== existingAccessory.swTypeVal) || exclude == !0) {
                        if (exclude == !1) {
                            this.forceLog("Device " + existingAccessory.name + " has changed it's type. Recreating...");
                        } else {
                            this.forceLog("Device " + existingAccessory.name + " has been excluded. Removing...");
                        }
                        removedAccessories.push(existingAccessory);
                        try {
                            this.api.unregisterPlatformAccessories("homebridge-edomoticz", "eDomoticz", [existingAccessory.platformAccessory]);
                        } catch (e) {
                            this.forceLog("Could not unregister platform accessory! (" + existingAccessory.name + ")\n" + e);
                        }
                    } else {
                        continue;
                    }
                }

                if (exclude == !1) {
                    // Generate a new accessory
                    var uuid = UUID.generate(device.idx + "_" + device.Name);
                    this.forceLog("Device: " + device.Name + " (" + device.idx + ")");
                    var accessory = new eDomoticzAccessory(this, false, false, device.Used, device.idx, device.Name, uuid, device.HaveDimmer, device.MaxDimLevel, device.SubType, device.Type, device.BatteryLevel, device.SwitchType, device.SwitchTypeVal, device.HardwareID, device.HardwareTypeVal, device.Image, this.eve, device.HaveTimeout, device.Description);
                    this.accessories.push(accessory);

                    // Register the accessories
                    try {
                        accessory.platformAccessory.context = {
                            device: device,
                            uuid: uuid,
                            eve: this.eve
                        };
                        if ((device.SwitchTypeVal == Constants.DeviceTypeMedia) || (device.SwitchTypeVal == Constants.DeviceTypeSelector && device.Image == "TV")) {
                            externalAccessories.push(accessory);
                        } else {
                            this.api.registerPlatformAccessories("homebridge-edomoticz", "eDomoticz", [accessory.platformAccessory]);
                        }

                    } catch (e) {
                        this.forceLog("Could not register platform accessory! (" + accessory.name + ")\n" + e);
                    }

                }
            }
            // Publish external (ie: TV) accessories now that they're fully assembled
            for (var ei = 0; ei < externalAccessories.length; ei++) {
                var externalAccessory = externalAccessories[ei];
                if (externalAccessory.subType !== 'Selector Switch')
                {
                    this.api.publishExternalAccessories("homebridge-edomoticz", [externalAccessory.platformAccessory]);
                    this.forceLog("External Device: " + externalAccessory.platformAccessory.context.device.Name + " (" + externalAccessory.platformAccessory.context.device.idx + ")");
                }
            }

            // Remove the old accessories
            for (var i = 0; i < this.accessories.length; i++) {
                var removedAccessory = this.accessories[i];
                var existingDevice = devices.find(function(existingDevice) {
                    return existingDevice.idx == removedAccessory.idx;
                });

                if (!existingDevice) {
                    removedAccessories.push(removedAccessory);
                    try {
                        this.api.unregisterPlatformAccessories("homebridge-edomoticz", "eDomoticz", [removedAccessory.platformAccessory]);
                    } catch (e) {
                        this.forceLog("Could not unregister platform accessory! (" + removedAccessory.name + ")\n" + e);
                    }
                }
            }

            for (var i = 0; i < removedAccessories.length; i++) {
                var removedAccessory = removedAccessories[i];
                removedAccessory.removed();
                var index = this.accessories.indexOf(removedAccessory);
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
            // Remove this invalid device from the cache.
            try {
                this.api.unregisterPlatformAccessories("homebridge-edomoticz", "eDomoticz", [platformAccessory]);
            } catch (e) {
                this.forceLog("Could not unregister cached platform accessory!\n" + e);
            }
            return;
        }

        var device = platformAccessory.context.device;
        var uuid = platformAccessory.context.uuid;
        var eve = platformAccessory.context.eve;

        // Generate the already cached accessory again
        var accessory = new eDomoticzAccessory(this, platformAccessory, false, device.Used, device.idx, device.Name, uuid, device.HaveDimmer, device.MaxDimLevel, device.SubType, device.Type, device.BatteryLevel, device.SwitchType, device.SwitchTypeVal, device.HardwareID, device.HardwareTypeVal, device.Image, eve, device.HaveTimeout, device.Description);
        this.accessories.push(accessory);
    }
};

function setupMqttConnection(platform) {
    var connectionInformation = {
        host: (typeof platform.config.mqtt.host !== 'undefined' ? platform.config.mqtt.host : '127.0.0.1'),
        port: (typeof platform.config.mqtt.port !== 'undefined' ? platform.config.mqtt.port : 1883),
        topic: (typeof platform.config.mqtt.topic !== 'undefined' ? platform.config.mqtt.topic : 'domoticz/out'),
        username: (typeof platform.config.mqtt.username !== 'undefined' ? platform.config.mqtt.username : ''),
        password: (typeof platform.config.mqtt.password !== 'undefined' ? platform.config.mqtt.password : ''),
    };

    var mqttError = function() {
        platform.forceLog("There was an error while getting the MQTT Hardware Device from Domoticz.\nPlease verify that you have added the MQTT Hardware Device and that the hardware device is enabled.");
    };

    Domoticz.hardware(platform.apiBaseURL, function(hardware) {
        var mqttHardware = false;
        for (var i = 0; i < hardware.length; i++) {
            if (hardware[i].Type == Constants.HardwareTypeMQTT) {
                mqttHardware = hardware[i];
                break;
            }
        }

        if (mqttHardware === false || (mqttHardware.Enabled != "true")) {
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

        platform.mqtt = new Mqtt(platform, connectionInformation.host, connectionInformation.port, connectionInformation.topic, {
            username: connectionInformation.username,
            password: connectionInformation.password
        });
    }, mqttError);
}
