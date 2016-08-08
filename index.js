//         ____                        _   _
//     ___|  _ \  ___  _ __ ___   ___ | |_(_) _v0.2.1
//    / _ | | | |/ _ \| '_ ` _ \ / _ \| __| |/ __|_  /
//   |  __| |_| | (_) | | | | | | (_) | |_| | (__ / /
//    \___|____/ \___/|_| |_| |_|\___/ \__|_|\___/___|
//       www.npmjs.com/package/homebridge-edomoticz
//
//       A Platform Plugin for HomeBridge by Marci
//           [http://twitter.com/marcisshadow]
//
//
//     ** Remember to add platform to config.json **
//
// Example ~/.homebridge/config.json content:
//
// {
//  "bridge": {
//         "name": "Homebridge",
//         "username": "CC:21:3E:E4:DE:33", // << Randomize this...
//         "port": 51826,
//         "pin": "031-45-154",
//      },
//
//  "platforms": [{
//         "platform": "eDomoticz",
//         "name": "eDomoticz",
//         "server": "127.0.0.1",   // or "user:pass@ip"
//         "port": "8080",
//         "roomid": 0 ,  // 0 = all sensors, otherwise, room idx as shown at http://server:port/#/Roomplan
//         "ssl": 0,
//         "mqttenable": 1,
//         "mqttserver": "127.0.0.1",
//         "mqttport": "1883",
//         "mqttauth": 1,          //only needed if you've password protected mosquitto via mosquitto.conf
//         "mqttuser": "username", //only needed if you've password protected mosquitto via mosquitto.conf
//         "mqttpass": "password"  //only needed if you've password protected mosquitto via mosquitto.conf
//      }],
//
//  "accessories":[]
// }
//

//var Service, Characteristic, types, uuid, hapLegacyTypes;
global.Service;
global.Characteristic;
global.types;
global.uuid;
global.hapLegacyTypes;
var request = require("request");
var Mqtt = require('./lib/mqtt.js').Mqtt;
var eDomoticzAccessory = require('./lib/domoticz_accessory.js');
var Helper = require('./lib/helper.js').Helper;

module.exports = function(homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    types = homebridge.hapLegacyTypes;
    uuid = homebridge.hap.uuid;

    Helper.fixInheritance(eDomoticzPlatform.TotalConsumption, Characteristic);
    Helper.fixInheritance(eDomoticzPlatform.CurrentConsumption, Characteristic);
    Helper.fixInheritance(eDomoticzPlatform.GasConsumption, Characteristic);
    Helper.fixInheritance(eDomoticzPlatform.TempOverride, Characteristic);
    Helper.fixInheritance(eDomoticzPlatform.MeterDeviceService, Service);
    Helper.fixInheritance(eDomoticzPlatform.GasDeviceService, Service);
    Helper.fixInheritance(eDomoticzPlatform.CurrentUsage, Characteristic);
    Helper.fixInheritance(eDomoticzPlatform.UsageDeviceService, Service);
    Helper.fixInheritance(eDomoticzPlatform.TodayConsumption, Characteristic);
    Helper.fixInheritance(eDomoticzPlatform.Barometer, Characteristic);
    Helper.fixInheritance(eDomoticzPlatform.WindSpeed, Characteristic);
    Helper.fixInheritance(eDomoticzPlatform.WindChill, Characteristic);
    Helper.fixInheritance(eDomoticzPlatform.WindDirection, Characteristic);
    Helper.fixInheritance(eDomoticzPlatform.WindDeviceService, Service);
    Helper.fixInheritance(eDomoticzPlatform.Rainfall, Characteristic);
    Helper.fixInheritance(eDomoticzPlatform.RainDeviceService, Service);
    Helper.fixInheritance(eDomoticzPlatform.Visibility, Characteristic);
    Helper.fixInheritance(eDomoticzPlatform.VisibilityDeviceService, Service);
    Helper.fixInheritance(eDomoticzPlatform.SolRad, Characteristic);
    Helper.fixInheritance(eDomoticzPlatform.SolRadDeviceService, Service);
    Helper.fixInheritance(eDomoticzPlatform.LocationService, Service);
    homebridge.registerAccessory("homebridge-edomoticz", "eDomoticz", eDomoticzAccessory);
    homebridge.registerPlatform("homebridge-edomoticz", "eDomoticz", eDomoticzPlatform);
};

function eDomoticzPlatform(log, config, api) {
    this._cachedAccessories = [];
    this.log = log;
    this.config = config;
    this.server = config.server;
    if (this.server.indexOf(":") > -1 && this.server.indexOf("@") > -1) {
        tmparr = this.server.split("@");
        var Base64 = {
            _keyStr: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",
            encode: function(e) {
                var t = "";
                var n, r, i, s, o, u, a;
                var f = 0;
                e = Base64._utf8_encode(e);
                while (f < e.length) {
                    n = e.charCodeAt(f++);
                    r = e.charCodeAt(f++);
                    i = e.charCodeAt(f++);
                    s = n >> 2;
                    o = (n & 3) << 4 | r >> 4;
                    u = (r & 15) << 2 | i >> 6;
                    a = i & 63;
                    if (isNaN(r)) {
                        u = a = 64;
                    } else if (isNaN(i)) {
                        a = 64;
                    }
                    t = t + this._keyStr.charAt(s) + this._keyStr.charAt(o) + this._keyStr.charAt(u) + this._keyStr.charAt(a);
                }
                return t;
            },
            _utf8_encode: function(e) {
                e = e.replace(/\r\n/g, "\n");
                var t = "";
                for (var n = 0; n < e.length; n++) {
                    var r = e.charCodeAt(n);
                    if (r < 128) {
                        t += String.fromCharCode(r);
                    } else if (r > 127 && r < 2048) {
                        t += String.fromCharCode(r >> 6 | 192);
                        t += String.fromCharCode(r & 63 | 128);
                    } else {
                        t += String.fromCharCode(r >> 12 | 224);
                        t += String.fromCharCode(r >> 6 & 63 | 128);
                        t += String.fromCharCode(r & 63 | 128);
                    }
                }
                return t;
            }
        };
        this.authstr = Base64.encode(tmparr[0]);
        this.server = tmparr[1];
    }
    this.mqttenable = config.mqttenable;
    this.ssl = config.ssl;
    this.port = config.port;
    this.room = config.roomid;
    this.api = api;

    if (config.mqttenable===1 && this.api)
    {
        this.api.on("domoticzAccessoriesLoaded", function() {
            this.Mqtt = new Mqtt(this, 'mqtt://'+config.mqttserver+':'+config.mqttport, [{"username":config.mqttuser,"password":config.mqttpass}]);
        }.bind(this));
    }
}

/* Define Custom Services & Characteristics */
// PowerMeter Characteristics
eDomoticzPlatform.TotalConsumption = function() {
    var charUUID = 'E863F10C-079E-48FF-8F27-9C2605A29F52'; //uuid.generate('eDomoticz:customchar:TotalConsumption');
    Characteristic.call(this, 'Total Consumption', charUUID);
    this.setProps({
        format: 'string',
        perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
};
eDomoticzPlatform.TodayConsumption = function() {
    var charUUID = uuid.generate('eDomoticz:customchar:TodayConsumption');
    Characteristic.call(this, 'Today', charUUID);
    this.setProps({
        format: 'string',
        perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
};
eDomoticzPlatform.CurrentConsumption = function() {
    var charUUID = 'E863F10D-079E-48FF-8F27-9C2605A29F52'; //uuid.generate('eDomoticz:customchar:CurrentConsumption');
    Characteristic.call(this, 'Consumption', charUUID);
    this.setProps({
        format: 'string',
        perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
};
eDomoticzPlatform.GasConsumption = function() {
    var charUUID = uuid.generate('eDomoticz:customchar:CurrentConsumption');
    Characteristic.call(this, 'Meter Total', charUUID);
    this.setProps({
        format: 'string',
        perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
};
// Custom SetPoint Minutes characteristic for TempOverride modes
eDomoticzPlatform.TempOverride = function() {
    var charUUID = uuid.generate('eDomoticz:customchar:OverrideTime');
    Characteristic.call(this, 'Override (Mins, 0 = Auto, 481 = Permanent)', charUUID);
    this.setProps({
        format: 'float',
        maxValue: 481,
        minValue: 0,
        minStep: 1,
        perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
};
// The PowerMeter itself
eDomoticzPlatform.MeterDeviceService = function(displayName, subtype) {
    var serviceUUID = uuid.generate('eDomoticz:powermeter:customservice');
    Service.call(this, displayName, serviceUUID, subtype);
    this.addCharacteristic(new eDomoticzPlatform.CurrentConsumption());
    this.addOptionalCharacteristic(new eDomoticzPlatform.TotalConsumption());
    this.addOptionalCharacteristic(new eDomoticzPlatform.TodayConsumption());
};
// P1 Smart Meter -> Gas
eDomoticzPlatform.GasDeviceService = function(displayName, subtype) {
    var serviceUUID = uuid.generate('eDomoticz:gasmeter:customservice');
    Service.call(this, displayName, serviceUUID, subtype);
    this.addCharacteristic(new eDomoticzPlatform.GasConsumption());
};
// Usage Meter Characteristics
eDomoticzPlatform.CurrentUsage = function() {
    var charUUID = uuid.generate('eDomoticz:customchar:CurrentUsage');
    Characteristic.call(this, 'Current Usage', charUUID);
    this.setProps({
        format: 'string',
        perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
};
// The Usage Meter itself
eDomoticzPlatform.UsageDeviceService = function(displayName, subtype) {
    var serviceUUID = uuid.generate('eDomoticz:usagedevice:customservice');
    Service.call(this, displayName, serviceUUID, subtype);
    this.addCharacteristic(new eDomoticzPlatform.CurrentUsage());
};
// Location Meter (sensor should have 'Location' in title)
eDomoticzPlatform.LocationService = function(displayName, subtype) {
    var serviceUUID = uuid.generate('eDomoticz:location:customservice');
    Service.call(this, displayName, serviceUUID, subtype);
    this.addCharacteristic(new Characteristic.Version());
};
// DarkSkies WindSpeed Characteristic
eDomoticzPlatform.WindSpeed = function() {
    var charUUID = uuid.generate('eDomoticz:customchar:WindSpeed');
    Characteristic.call(this, 'Wind Speed', charUUID);
    this.setProps({
        format: 'string',
        perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
};
// DarkSkies WindChill Characteristic
eDomoticzPlatform.WindChill = function() {
    var charUUID = uuid.generate('eDomoticz:customchar:WindChill');
    Characteristic.call(this, 'Wind Chill', charUUID);
    this.setProps({
        format: 'string',
        perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
};
// DarkSkies WindDirection Characteristic
eDomoticzPlatform.WindDirection = function() {
    var charUUID = uuid.generate('eDomoticz:customchar:WindDirection');
    Characteristic.call(this, 'Wind Direction', charUUID);
    this.setProps({
        format: 'string',
        perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
};
// DarkSkies Virtual Wind Sensor
eDomoticzPlatform.WindDeviceService = function(displayName, subtype) {
    var serviceUUID = uuid.generate('eDomoticz:winddevice:customservice');
    Service.call(this, displayName, serviceUUID, subtype);
    this.addCharacteristic(new eDomoticzPlatform.WindSpeed());
    this.addOptionalCharacteristic(new eDomoticzPlatform.WindChill());
    this.addOptionalCharacteristic(new eDomoticzPlatform.WindDirection());
    this.addOptionalCharacteristic(new Characteristic.CurrentTemperature());
};
// DarkSkies Rain Characteristics
eDomoticzPlatform.Rainfall = function() {
    var charUUID = uuid.generate('eDomoticz:customchar:Rainfall');
    Characteristic.call(this, 'Amount today', charUUID);
    this.setProps({
        format: 'string',
        perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
};
// DarkSkies Rain Meter itself
eDomoticzPlatform.RainDeviceService = function(displayName, subtype) {
    var serviceUUID = uuid.generate('eDomoticz:raindevice:customservice');
    Service.call(this, displayName, serviceUUID, subtype);
    this.addCharacteristic(new eDomoticzPlatform.Rainfall());
};
// DarkSkies Visibility Characteristics
eDomoticzPlatform.Visibility = function() {
    var charUUID = uuid.generate('eDomoticz:customchar:Visibility');
    Characteristic.call(this, 'Distance', charUUID);
    this.setProps({
        format: 'string',
        perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
};
// DarkSkies Visibility Meter itself
eDomoticzPlatform.VisibilityDeviceService = function(displayName, subtype) {
    var serviceUUID = uuid.generate('eDomoticz:visibilitydevice:customservice');
    Service.call(this, displayName, serviceUUID, subtype);
    this.addCharacteristic(new eDomoticzPlatform.Visibility());
};
// DarkSkies Solar Radiation Characteristics
eDomoticzPlatform.SolRad = function() {
    var charUUID = uuid.generate('eDomoticz:customchar:SolRad');
    Characteristic.call(this, 'Radiation', charUUID);
    this.setProps({
        format: 'string',
        perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
};
// DarkSkies Solar Radiation Meter itself
eDomoticzPlatform.SolRadDeviceService = function(displayName, subtype) {
    var serviceUUID = uuid.generate('eDomoticz:solraddevice:customservice');
    Service.call(this, displayName, serviceUUID, subtype);
    this.addCharacteristic(new eDomoticzPlatform.SolRad());
};
// Barometer Characteristic
eDomoticzPlatform.Barometer = function() {
    var charUUID = uuid.generate('eDomoticz:customchar:CurrentPressure');
    Characteristic.call(this, 'Pressure', charUUID);
    this.setProps({
        format: 'string',
        perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
};
/* End of Custom Services & Characteristics */
eDomoticzPlatform.prototype = {
    accessories: function(callback) {
        if (this._cachedAccessories && this._cachedAccessories.length > 0) {
            callback(this._cachedAccessories);
            return;
        }

        var that = this;
        var foundAccessories = [];
        var asyncCalls = 0;

        function callbackLater() {
            that._cachedAccessories = foundAccessories;
            if (--asyncCalls === 0) callback(foundAccessories);
            that.api.emit("domoticzAccessoriesLoaded");
        }
        this.log("Fetching Domoticz lights and switches...");
        asyncCalls++;
        var domurl;
        var prot = (this.ssl == 1) ? "https://" : "http://";
        domurl = (!(this.room) || this.room === 0) ? prot + this.server + ":" + this.port + "/json.htm?type=devices&used=true&order=Name" : prot + this.server + ":" + this.port + "/json.htm?type=devices&plan=" + this.room + "&used=true&order=Name";
        var myopt;
        if (this.authstr) {
            myopt = {
                'Authorization': this.authstr
            };
        }
        request.get({
            url: domurl,
            headers: myopt,
            json: true
        }, function(err, response, json) {
            if (!err && response.statusCode == 200) {
                if (json.result !== undefined) {
                    var sArray = Helper.sortByKey(json.result, "Name");
                    sArray.map(function(s) {
                        accessory = new eDomoticzAccessory(that.log, that.server, that.port, false, s.Used, s.idx, s.Name, s.HaveDimmer, s.MaxDimLevel, s.SubType, s.Type, s.BatteryLevel, s.authstr, s.SwitchType, s.SwitchTypeVal, prot, s.HardwareTypeVal);
                        foundAccessories.push(accessory);
                    });
                }
                callbackLater();
            } else {
                that.log("There was a problem connecting to Domoticz.");
            }
        }.bind(this));
    }
};
