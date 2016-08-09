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

var request = require("request");
var Mqtt = require('./lib/mqtt.js').Mqtt;
var eDomoticzAccessory = require('./lib/domoticz_accessory.js');
var Constants = require('./lib/constants.js');
var Helper = require('./lib/helper.js').Helper;
var eDomoticzServices = require('./lib/services.js').eDomoticzServices;

module.exports = function(homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    Types = homebridge.hapLegacyTypes;
    UUID = homebridge.hap.uuid;

    Helper.fixInheritance(eDomoticzServices.TotalConsumption, Characteristic);
    Helper.fixInheritance(eDomoticzServices.CurrentConsumption, Characteristic);
    Helper.fixInheritance(eDomoticzServices.GasConsumption, Characteristic);
    Helper.fixInheritance(eDomoticzServices.TempOverride, Characteristic);
    Helper.fixInheritance(eDomoticzServices.MeterDeviceService, Service);
    Helper.fixInheritance(eDomoticzServices.GasDeviceService, Service);
    Helper.fixInheritance(eDomoticzServices.CurrentUsage, Characteristic);
    Helper.fixInheritance(eDomoticzServices.UsageDeviceService, Service);
    Helper.fixInheritance(eDomoticzServices.TodayConsumption, Characteristic);
    Helper.fixInheritance(eDomoticzServices.Barometer, Characteristic);
    Helper.fixInheritance(eDomoticzServices.WindSpeed, Characteristic);
    Helper.fixInheritance(eDomoticzServices.WindChill, Characteristic);
    Helper.fixInheritance(eDomoticzServices.WindDirection, Characteristic);
    Helper.fixInheritance(eDomoticzServices.WindDeviceService, Service);
    Helper.fixInheritance(eDomoticzServices.Rainfall, Characteristic);
    Helper.fixInheritance(eDomoticzServices.RainDeviceService, Service);
    Helper.fixInheritance(eDomoticzServices.Visibility, Characteristic);
    Helper.fixInheritance(eDomoticzServices.VisibilityDeviceService, Service);
    Helper.fixInheritance(eDomoticzServices.SolRad, Characteristic);
    Helper.fixInheritance(eDomoticzServices.SolRadDeviceService, Service);
    Helper.fixInheritance(eDomoticzServices.LocationService, Service);
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
