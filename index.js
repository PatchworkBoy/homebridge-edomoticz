// _Extended_ (e)Domoticz Platform Plugin for HomeBridge by Marci [http://twitter.com/marcisshadow]
// V0.1.11 - 2016/02/10
//    - rewritten switch detection to use SwitchTypeVal=0>17
//    - de-verbosed object selectors & jshint'd end-to-end
//    - added: smoke detector, motion detector
//    - fixed: dimmmer allocation, contact sensors
// V0.1.10 - 2016/02/08
//    - more work relating to dimmers and contact sensors
// V0.1.9 - 2016/02/07
//    - hopefully fixes an oopsie related to brightness on EVERY switch.
// V0.1.8 - 2016/02/07
//    - add support for SwitchType: Contact (basic open / closed)
// V0.1.6 - 2016/02/07
//    - add another identifier for Current
// V0.1.5 - 2016/02/07
//    - add another identifier for a dimming light
// V0.1.4 - 2016/02/06
//    - removed extraneous cruft from Base64
//    - enable dimming
// V0.1.2 - 2016/02/05
//    - Added SSL Protocol support
//    - authorization header rather than within URL
// V0.0.7 - 2016/02/05
//    - Fixed Today counter and WindChill characteristic
// V0.0.6 - 2016/02/03
//    - Full DarkSkies Virtual Sensor support (Rain, Wind, Barometer, Solar Radiation, Visibility
// V0.0.5 - 2016/02/03
//    - Added YouLess counter support (Type: YouLess Meter, SubType: YouLess counter)
//    - Expanded Temp sensor to include humidity & pressure (if present)
//    - fixed UUID generation
// V0.0.4 - 2016/01/31
//      - Fixed 'Siri Name' disappearance
// V0.0.3 - 2016/01/31
//      - Added General Usage Sensors (Type: General, SubType: Percentage)
// V0.0.2 - 2016/01/31
//      - Added Electric Consumption sensors (Type: General, SubType: kWh)
// V0.0.1 - 2016/01/31
//      - Initial version
//      - I make no claims to the quality of this shim. Function over form!
//
// ** Remember to add platform to config.json **
//
// Example config.json content:
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
//           "roomid": 0 ,  // 0 = all sensors, otherwise, room idx as shown at http://server:port/#/Roomplan
//         "ssl": 0
//      }],
//
//  "accessories":[]
// }
//
//
// SUPPORTED TYPES:
// - Lightbulb              (haveDimmer, onValue, offValue options)
// - Switch                 (onValue, offValue options)
// - TemperatureSensor      ()
// - Contact                ()
// - Temp & Humidity Sensor
// - Temp & Humidity & Barometer
// - YouLess Meter
// - Battery                (batteryThreshold option)
// - Power Meter            ()
// - Usage Sensors          () [eg: CPU Load, Disk Load, Mem Load from Motherboard Sensors Hardware Device]


var Service, Characteristic, types, uuid, hapLegacyTypes;
var request = require("request");
var inherits = require('util').inherits;
module.exports = function(homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    types = homebridge.hapLegacyTypes;
    uuid = homebridge.hap.uuid;
    fixInheritance(eDomoticzPlatform.TotalConsumption, Characteristic);
    fixInheritance(eDomoticzPlatform.CurrentConsumption, Characteristic);
    fixInheritance(eDomoticzPlatform.MeterDeviceService, Service);
    fixInheritance(eDomoticzPlatform.CurrentUsage, Characteristic);
    fixInheritance(eDomoticzPlatform.UsageDeviceService, Service);
    fixInheritance(eDomoticzPlatform.TodayConsumption, Characteristic);
    fixInheritance(eDomoticzPlatform.Barometer, Characteristic);
    fixInheritance(eDomoticzPlatform.WindSpeed, Characteristic);
    fixInheritance(eDomoticzPlatform.WindChill, Characteristic);
    fixInheritance(eDomoticzPlatform.WindDirection, Characteristic);
    fixInheritance(eDomoticzPlatform.WindDeviceService, Service);
    fixInheritance(eDomoticzPlatform.Rainfall, Characteristic);
    fixInheritance(eDomoticzPlatform.RainDeviceService, Service);
    fixInheritance(eDomoticzPlatform.Visibility, Characteristic);
    fixInheritance(eDomoticzPlatform.VisibilityDeviceService, Service);
    fixInheritance(eDomoticzPlatform.SolRad, Characteristic);
    fixInheritance(eDomoticzPlatform.SolRadDeviceService, Service);
    homebridge.registerAccessory("homebridge-edomoticz", "eDomoticz", eDomoticzAccessory);
    homebridge.registerPlatform("homebridge-edomoticz", "eDomoticz", eDomoticzPlatform);
};

function eDomoticzPlatform(log, config) {
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
    this.ssl = config.ssl;
    this.port = config.port;
    this.room = config.roomid;
}

 /* Handy Utility Functions */
function sortByKey(array, key) {
    return array.sort(function(a, b) {
        var x = a[key];
        var y = b[key];
        return ((x < y) ? -1 : ((x > y) ? 1 : 0));
    });
}

function roundToHalf(value) {
    var converted = parseFloat(value);
    var decimal = (converted - parseInt(converted, 10));
    decimal = Math.round(decimal * 10);
    if (decimal == 5) {
        return (parseInt(converted, 10) + 0.5);
    }
    if ((decimal < 3) || (decimal > 7)) {
        return Math.round(converted);
    } else {
        return (parseInt(converted, 10) + 0.5);
    }
}

function fixInheritance(subclass, superclass) {
    var proto = subclass.prototype;
    inherits(subclass, superclass);
    subclass.prototype.parent = superclass.prototype;
    for (var mn in proto) {
        subclass.prototype[mn] = proto[mn];
    }
}
/* End of Utility Functions */

/* Define Custom Services & Characteristics */
// PowerMeter Characteristics
eDomoticzPlatform.TotalConsumption = function() {
    var charUUID = uuid.generate('eDomoticz:customchar:TotalConsumption');
    Characteristic.call(this, 'Total', charUUID);
    this.setProps({
        format: 'string',
        perms: [Characteristic.Perms.READ]
    });
    this.value = this.getDefaultValue();
};
eDomoticzPlatform.TodayConsumption = function() {
    var charUUID = uuid.generate('eDomoticz:customchar:TodayConsumption');
    Characteristic.call(this, 'Today', charUUID);
    this.setProps({
        format: 'string',
        perms: [Characteristic.Perms.READ]
    });
    this.value = this.getDefaultValue();
};
eDomoticzPlatform.CurrentConsumption = function() {
    var charUUID = uuid.generate('eDomoticz:customchar:CurrentConsumption');
    Characteristic.call(this, 'Current', charUUID);
    this.setProps({
        format: 'string',
        perms: [Characteristic.Perms.READ]
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
// Usage Meter Characteristics
eDomoticzPlatform.CurrentUsage = function() {
    var charUUID = uuid.generate('eDomoticz:customchar:CurrentUsage');
    Characteristic.call(this, 'Current Usage', charUUID);
    this.setProps({
        format: 'string',
        perms: [Characteristic.Perms.READ]
    });
    this.value = this.getDefaultValue();
};
// The Usage Meter itself
eDomoticzPlatform.UsageDeviceService = function(displayName, subtype) {
    var serviceUUID = uuid.generate('eDomoticz:usagedevice:customservice');
    Service.call(this, displayName, serviceUUID, subtype);
    this.addCharacteristic(new eDomoticzPlatform.CurrentUsage());
};
// DarkSkies WindSpeed Characteristic
eDomoticzPlatform.WindSpeed = function() {
    var charUUID = uuid.generate('eDomoticz:customchar:WindSpeed');
    Characteristic.call(this, 'Wind Speed', charUUID);
    this.setProps({
        format: 'string',
        perms: [Characteristic.Perms.READ]
    });
    this.value = this.getDefaultValue();
};
// DarkSkies WindChill Characteristic
eDomoticzPlatform.WindChill = function() {
    var charUUID = uuid.generate('eDomoticz:customchar:WindChill');
    Characteristic.call(this, 'Wind Chill', charUUID);
    this.setProps({
        format: 'string',
        perms: [Characteristic.Perms.READ]
    });
    this.value = this.getDefaultValue();
};
// DarkSkies WindDirection Characteristic
eDomoticzPlatform.WindDirection = function() {
    var charUUID = uuid.generate('eDomoticz:customchar:WindDirection');
    Characteristic.call(this, 'Wind Direction', charUUID);
    this.setProps({
        format: 'string',
        perms: [Characteristic.Perms.READ]
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
        perms: [Characteristic.Perms.READ]
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
        perms: [Characteristic.Perms.READ]
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
        perms: [Characteristic.Perms.READ]
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
        perms: [Characteristic.Perms.READ]
    });
    this.value = this.getDefaultValue();
}; /* End of Custom Services & Characteristics */
eDomoticzPlatform.prototype = {
    accessories: function(callback) {
        var that = this;
        var foundAccessories = [];
        var asyncCalls = 0;

        function callbackLater() {
            if (--asyncCalls === 0) callback(foundAccessories);
        }
        this.log("Fetching Domoticz lights and switches...");
        asyncCalls++;
        var domurl;
        var prot = (this.ssl == 1) ? "https://" : "http://";
        if (!(this.room) || this.room === 0) {
            domurl = prot + this.server + ":" + this.port + "/json.htm?type=devices&used=true&order=Name";
        } else {
            domurl = prot + this.server + ":" + this.port + "/json.htm?type=devices&plan=" + this.room + "&used=true&order=Name";
        }
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
                    var sArray = sortByKey(json.result, "Name");
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

function eDomoticzAccessory(log, server, port, IsScene, status, idx, name, haveDimmer, maxDimLevel, subType, Type, batteryRef, auth, swType, swTypeVal, prot, hwType) {
    if ((haveDimmer) || (swType == "Dimmer")) {
        if ((hwType!==51)&&(swType!=="On/Off")){
          this.haveDimmer = true;
          this.maxDimLevel = maxDimLevel;
        } else {
            this.haveDimmer = false;
        }
    } else {
        this.haveDimmer = false;
    }
    this.log = log;
    this.server = server;
    this.port = port;
    this.IsScene = IsScene; // Domoticz Scenes ignored for now...
    this.status = status;
    this.idx = idx;
    this.name = name;
    this.subType = subType;
    this.swType = swType;
    this.swTypeVal = swTypeVal;
    this.Type = Type;
    this.batteryRef = batteryRef;
    this.CounterToday = 1;
    this.onValue = "On";
    this.offValue = "Off";
    this.param = "switchlight"; //need an if(this.Type=='Lighting 1' || 'Lighting 2'){} etc to set param for all other types.
    this.access_url = prot + this.server + ":" + this.port + "/json.htm?";
    this.control_url = this.access_url + "type=command&param=" + this.param + "&idx=" + this.idx;
    this.status_url = this.access_url + "type=devices&rid=" + this.idx;
    this.authstr = (auth) ? auth : '';
}

eDomoticzAccessory.prototype = {
    identify: function(callback) {
        callback();
    },
    setPowerState: function(powerOn, callback) {
        var url, that = this;
        if (powerOn) {
            url = that.control_url + "&switchcmd=On";
            that.log("Setting power state to on");
        } else {
            url = that.control_url + "&switchcmd=Off";
            that.log("Setting power state to off");
        }
        request.put({
            url: url,
            header: {
                'Authorization': 'Basic '+that.authstr
            }
        }, function(err, response) {
            if (err) {
                that.log("There was a problem sending command to" + that.name);
                that.log(response);
            } else {
                that.log(that.name + " sent command succesfully");
            }
            callback();
        }.bind(this));
    },
    getPowerState: function(callback) {
        var that = this;
        request.get({
            url: that.status_url,
            header: {
                'Authorization': 'Basic '+that.authstr
            },
            json: true
        }, function(err, response, json) {
            if (!err && response.statusCode == 200) {
                var value;
                if (json.result !== undefined) {
                    var sArray = sortByKey(json.result, "Name");
                    sArray.map(function(s) {
                        value = (s.Data == "On") ? 1 : 0;
                    });
                }
                callback(null, value);
            } else {
                that.log("There was a problem connecting to Domoticz.");
            }
        }.bind(this));
    },
    getRainfall: function(callback) {
        var that = this;
        request.get({
            url: that.status_url,
            header: {
                'Authorization': 'Basic '+that.authstr
            },
            json: true
        }, function(err, response, json) {
            if (!err && response.statusCode == 200) {
                var value;
                if (json.result !== undefined) {
                    var sArray = sortByKey(json.result, "Name");
                    sArray.map(function(s) {
                        value = s.Rain + "mm";
                    });
                }
                callback(null, value);
            } else {
                this.log("There was a problem connecting to Domoticz.");
            }
        }.bind(this));
    },
    setdValue: function(level, callback) {
        var url, that = this;
        if (!(that.factor)) {
            request.get({
                url: that.status_url,
                header: {
                    'Authorization': 'Basic '+that.authstr
                },
                json: true
            }, function(err, response, json) {
                if (!err && response.statusCode == 200) {
                    if (json.result !== undefined) {
                        var sArray = sortByKey(json.result, "Name");
                        sArray.map(function(s) {
                            that.factor = 100 / s.MaxDimLevel;
                        });
                    }
                } else {
                    this.log("There was a problem connecting to Domoticz.");
                }
            });
        }
        var dim = (level / that.factor == 15) ? 16 : level / that.factor;
        url = that.control_url + "&switchcmd=Set%20Level&level=" + dim;
        request.put({
            url: url,
            header: {
                'Authorization': 'Basic '+that.authstr
            }
        }, function(err, response) {
            if (err) {
                that.log("There was a problem sending command to" + that.name);
                that.log(response);
            } else {
                that.log(that.name + " sent command succesfully");
            }
            callback();
        }.bind(this));
    },
    getdValue: function(callback) {
        var that = this;
        request.get({
            url: that.status_url,
            header: {
                'Authorization': 'Basic '+that.authstr
            },
            json: true
        }, function(err, response, json) {
            if (!err && response.statusCode == 200) {
                var value;
                if (json.result !== undefined) {
                    var sArray = sortByKey(json.result, "Name");
                    sArray.map(function(s) {
                        value = s.LevelInt;
                        that.factor = 100 / s.MaxDimLevel;
                        value = value * that.factor;
                    });
                }
                callback(null, value);
            } else {
                this.log("There was a problem connecting to Domoticz.");
            }
        }.bind(this));
    },
    getValue: function(callback) {
        var that = this;
        request.get({
            url: that.status_url,
            header: {
                'Authorization': 'Basic '+that.authstr
            },
            json: true
        }, function(err, response, json) {
            if (!err && response.statusCode == 200) {
                var value;
                if (json.result !== undefined) {
                  var sArray = sortByKey(json.result, "Name");
                    sArray.map(function(s) {
                        value = roundToHalf(s.Data.replace(/[^\d.-]/g, ''));
                    });
                }
                callback(null, value);
            } else {
                this.log("There was a problem connecting to Domoticz.");
            }
        }.bind(this));
    },
    getStringValue: function(callback) {
        var that = this;
        request.get({
            url: that.status_url,
            header: {
                'Authorization': 'Basic '+that.authstr
            },
            json: true
        }, function(err, response, json) {
            if (!err && response.statusCode == 200) {
                var value;
                if (json.result !== undefined) {
                  var sArray = sortByKey(json.result, "Name");
                    sArray.map(function(s) {
                        if (s.SwitchTypeVal == 2) { //contact
                            if(s.Data=="Closed"){
                              value = Characteristic.ContactSensorState.CONTACT_DETECTED;
                            } else {
                              value = Characteristic.ContactSensorState.CONTACT_NOT_DETECTED;
                            }
                        } else if (s.SwitchTypeVal == 5) { //smoke
                            if(s.Data=="Off"){
                              value = Characteristic.SmokeDetected.SMOKE_NOT_DETECTED;
                            } else {
                              value = Characteristic.SmokeDetected.SMOKE_DETECTED;
                            }
                        } else if (s.SwitchTypeVal == 8) { //motion
                            if(s.Data=="Off"){
                              value = false;
                            } else {
                              value = true;
                            }
                        } else { //just return Data prop
                            value = s.Data;
                        }
                    });
                }
                callback(null, value);
            } else {
                this.log("There was a problem connecting to Domoticz.");
            }
        }.bind(this));
    },
    getYLTodayValue: function(callback) {
        var that = this;
        request.get({
            url: that.status_url,
            header: {
                'Authorization': 'Basic '+that.authstr
            },
            json: true
        }, function(err, response, json) {
            if (!err && response.statusCode == 200) {
                var value;
                if (json.result !== undefined) {
                  var sArray = sortByKey(json.result, "Name");
                    sArray.map(function(s) {
                        value = s.CounterToday;
                    });
                }
                callback(null, value);
            } else {
                this.log("There was a problem connecting to Domoticz.");
            }
        }.bind(this));
    },
    getYLTotalValue: function(callback) {
        var that = this;
        request.get({
            url: that.status_url,
            header: {
                'Authorization': 'Basic '+that.authstr
            },
            json: true
        }, function(err, response, json) {
            if (!err && response.statusCode == 200) {
                var value;
                if (json.result !== undefined) {
                  var sArray = sortByKey(json.result, "Name");
                    sArray.map(function(s) {
                        value = roundToHalf(s.Counter) + " kWh";
                    });
                }
                callback(null, value);
            } else {
                this.log("There was a problem connecting to Domoticz.");
            }
        }.bind(this));
    },
    getWindSpeed: function(callback) {
        var that = this;
        request.get({
            url: that.status_url,
            header: {
                'Authorization': 'Basic '+that.authstr
            },
            json: true
        }, function(err, response, json) {
            if (!err && response.statusCode == 200) {
                var value;
                if (json.result !== undefined) {
                  var sArray = sortByKey(json.result, "Name");
                    sArray.map(function(s) {
                        value = s.Speed;
                    });
                }
                callback(null, value);
            } else {
                this.log("There was a problem connecting to Domoticz.");
            }
        }.bind(this));
    },
    getWindChill: function(callback) {
        var that = this;
        request.get({
            url: that.status_url,
            header: {
                'Authorization': 'Basic '+that.authstr
            },
            json: true
        }, function(err, response, json) {
            if (!err && response.statusCode == 200) {
                var value;
                if (json.result !== undefined) {
                  var sArray = sortByKey(json.result, "Name");
                    sArray.map(function(s) {
                        value = String(s.Chill);
                    });
                }
                callback(null, value);
            } else {
                this.log("There was a problem connecting to Domoticz.");
            }
        }.bind(this));
    },
    getWindDirection: function(callback) {
        var that = this;
        request.get({
            url: that.status_url,
            header: {
                'Authorization': 'Basic '+that.authstr
            },
            json: true
        }, function(err, response, json) {
            if (!err && response.statusCode == 200) {
                var value;
                if (json.result !== undefined) {
                  var sArray = sortByKey(json.result, "Name");
                    sArray.map(function(s) {
                        value = s.Direction + " (" + s.DirectionStr + ")";
                    });
                }
                callback(null, value);
            } else {
                this.log("There was a problem connecting to Domoticz.");
            }
        }.bind(this));
    },
    getCPower: function(callback) {
        var that = this;
        request.get({
            url: that.status_url,
            header: {
                'Authorization': 'Basic '+that.authstr
            },
            json: true
        }, function(err, response, json) {
            if (!err && response.statusCode == 200) {
                var value;
                if (json.result !== undefined) {
                  var sArray = sortByKey(json.result, "Name");
                    sArray.map(function(s) {
                        value = s.Usage;
                    });
                }
                callback(null, value);
            } else {
                this.log("There was a problem connecting to Domoticz.");
            }
        }.bind(this));
    },
    getTemperature: function(callback) {
        var that = this;
        request.get({
            url: that.status_url,
            header: {
                'Authorization': 'Basic '+that.authstr
            },
            json: true
        }, function(err, response, json) {
            if (!err && response.statusCode == 200) {
                var value;
                if (json.result !== undefined) {
                  var sArray = sortByKey(json.result, "Name");
                    sArray.map(function(s) {
                        value = roundToHalf(s.Temp);
                    });
                }
                callback(null, value);
            } else {
                this.log("There was a problem connecting to Domoticz.");
            }
        }.bind(this));
    },
    getHumidity: function(callback) {
        var that = this;
        request.get({
            url: that.status_url,
            header: {
                'Authorization': 'Basic '+that.authstr
            },
            json: true
        }, function(err, response, json) {
            if (!err && response.statusCode == 200) {
                var value;
                if (json.result !== undefined) {
                  var sArray = sortByKey(json.result, "Name");
                    sArray.map(function(s) {
                        value = roundToHalf(s.Humidity);
                    });
                }
                callback(null, value);
            } else {
                this.log("There was a problem connecting to Domoticz.");
            }
        }.bind(this));
    },
    getPressure: function(callback) {
        var that = this;
        request.get({
            url: that.status_url,
            header: {
                'Authorization': 'Basic '+that.authstr
            },
            json: true
        }, function(err, response, json) {
            if (!err && response.statusCode == 200) {
                var value;
                if (json.result !== undefined) {
                  var sArray = sortByKey(json.result, "Name");
                    sArray.map(function(s) {
                        value = roundToHalf(s.Barometer) + "hPa";
                    });
                }
                callback(null, value);
            } else {
                this.log("There was a problem connecting to Domoticz.");
            }
        }.bind(this));
    },
    getLowBatteryStatus: function(callback) {
        var that = this;
        request.get({
            url: that.status_url,
            header: {
                'Authorization': 'Basic '+that.authstr
            },
            json: true
        }, function(err, response, json) {
            if (!err && response.statusCode == 200) {
                var value;
                if (json.result !== undefined) {
                  var sArray = sortByKey(json.result, "Name");
                    sArray.map(function(s) {
                        value = s.BatteryLevel;
                    });
                }
                if (value > 20) {
                    callback(null, 0);
                } else {
                    callback(null, 1);
                }
            } else {
                this.log("There was a problem connecting to Domoticz.");
            }
        }.bind(this));
    },
    getServices: function() {
        var services = [];
        var informationService = new Service.AccessoryInformation();
        informationService.setCharacteristic(Characteristic.Manufacturer, "eDomoticz").setCharacteristic(Characteristic.Model, this.Type).setCharacteristic(Characteristic.SerialNumber, "DomDev" + this.idx);
        services.push(informationService);
        if (typeof this.swTypeVal !=='undefined' && this.swTypeVal){ // is a switch
          switch (true) {
            case this.swTypeVal == 2:{ //contact
              var contactService = new Service.ContactSensor(this.name);
              contactService.getCharacteristic(Characteristic.ContactSensorState).on('get', this.getStringValue.bind(this));
              services.push(contactService);
              break;
            }

            case this.swTypeVal == 5:{ //smoke
              var smokeService = new Service.SmokeSensor(this.name);
              smokeService.getCharacteristic(Characteristic.SmokeDetected).on('get', this.getStringValue.bind(this));
              if (this.batteryRef && this.batteryRef !== 255) { // if batteryRef == 255 we're running on mains
                  smokeService.addCharacteristic(new Characteristic.StatusLowBattery()).on('get', this.getLowBatteryStatus.bind(this));
              }
              services.push(smokeService);
              break;
            }

            case this.swTypeVal == 7:{ //dimmer
              var lightbulbService = new Service.Lightbulb(this.name);
              lightbulbService.getCharacteristic(Characteristic.On).on('set', this.setPowerState.bind(this)).on('get', this.getPowerState.bind(this));
              lightbulbService.addCharacteristic(new Characteristic.Brightness()).on('set', this.setdValue.bind(this)).on('get', this.getdValue.bind(this));
              services.push(lightbulbService);
              break;
            }
            case this.swTypeVal == 8:{ //motion
              var motionService = new Service.MotionSensor(this.name);
              motionService.getCharacteristic(Characteristic.MotionDetected).on('get', this.getStringValue.bind(this));
              if (this.batteryRef && this.batteryRef !== 255) { // if batteryRef == 255 we're running on mains
                  motionService.getCharacteristic(new Characteristic.StatusLowBattery()).on('get', this.getLowBatteryStatus.bind(this));
              }
              services.push(motionService);
              break;
            }
            /* Following sensors not supported yet...
            case this.swTypeVal == 1:{ //doorbell
              break;
            }
            case this.swTypeVal == 3:{ //blinds
              break;
            }
            case this.swTypeVal == 4:{ //x10siren
              break;
            }
            case this.swTypeVal == 6:{ //blinds inv
              break;
            }
            case this.swTypeVal == 9:{ //pushon
              break;
            }
            case this.swTypeVal == 10:{ //pushoff
              break;
            }
            case this.swTypeVal == 11:{ //doorlock
              break;
            }
            case this.swTypeVal == 12:{ //dusk
              break;
            }
            case this.swTypeVal == 13:{ //blinds%
              break;
            }
            case this.swTypeVal == 14:{ //venetianus
              break;
            }
            case this.swTypeVal == 15:{ //venetianeu
              break;
            }
            case this.swTypeVal == 16:{ //blinds% inv
              break;
            }
            case this.swTypeVal == 17:{ //media
              break;
            }
            ...so instead, default to switch */
            default:{
              var switchService = new Service.Switch(this.name);
              switchService.getCharacteristic(Characteristic.On).on('set', this.setPowerState.bind(this)).on('get', this.getPowerState.bind(this));
              services.push(switchService);
              break;
            }
          }
        } else { // is a custom sensor
          switch(true){
            case this.Type == "General" || this.Type == "YouLess Meter" || this.Type == "Current":{
              if (this.subType == "kWh" || this.subType == "YouLess counter") {
                  var MeterDeviceService = new eDomoticzPlatform.MeterDeviceService("Power Usage");
                  MeterDeviceService.getCharacteristic(eDomoticzPlatform.CurrentConsumption).on('get', this.getCPower.bind(this));
                  if (this.subType == "kWh") {
                      MeterDeviceService.getCharacteristic(eDomoticzPlatform.TotalConsumption).on('get', this.getStringValue.bind(this));
                  } else if (this.subType == "YouLess counter") {
                      MeterDeviceService.getCharacteristic(eDomoticzPlatform.TotalConsumption).on('get', this.getYLTotalValue.bind(this));
                  }
                  MeterDeviceService.getCharacteristic(eDomoticzPlatform.TodayConsumption).on('get', this.getYLTodayValue.bind(this));
                  services.push(MeterDeviceService);
                  break;
              } else if (this.subType == "Percentage") {
                  var UsageDeviceService = new eDomoticzPlatform.UsageDeviceService("Current Usage");
                  UsageDeviceService.getCharacteristic(eDomoticzPlatform.CurrentUsage).on('get', this.getStringValue.bind(this));
                  services.push(UsageDeviceService);
                  break;
              } else if (this.subType == "Visibility") {
                  var VisibilityDeviceService = new eDomoticzPlatform.VisibilityDeviceService("Current Distance");
                  VisibilityDeviceService.getCharacteristic(eDomoticzPlatform.Visibility).on('get', this.getStringValue.bind(this));
                  services.push(VisibilityDeviceService);
                  break;
              } else if (this.subType == "Solar Radiation") {
                  var SolRadDeviceService = new eDomoticzPlatform.SolRadDeviceService("Current radiation");
                  SolRadDeviceService.getCharacteristic(eDomoticzPlatform.SolRad).on('get', this.getStringValue.bind(this));
                  services.push(SolRadDeviceService);
                  break;
              } else {
                  var dMeterDeviceService = new eDomoticzPlatform.MeterDeviceService("Power Usage");
                  dMeterDeviceService.getCharacteristic(eDomoticzPlatform.CurrentConsumption).on('get', this.getStringValue.bind(this));
                  services.push(dMeterDeviceService);
                  break;
              }
              break;
            }
            case this.Type == "Temp" || this.Type == "Temp + Humidity" || this.Type == "Temp + Humidity + Baro":{
                var temperatureSensorService = new Service.TemperatureSensor(this.name);
                temperatureSensorService.getCharacteristic(Characteristic.CurrentTemperature).on('get', this.getTemperature.bind(this));
                temperatureSensorService.getCharacteristic(Characteristic.CurrentTemperature).setProps({
                    minValue: -100
                });
                if (this.Type == "Temp + Humidity" || this.Type == "Temp + Humidity + Baro") {
                    temperatureSensorService.addCharacteristic(new Characteristic.CurrentRelativeHumidity()).on('get', this.getHumidity.bind(this));
                    if (this.Type == "Temp + Humidity + Baro") {
                        temperatureSensorService.addCharacteristic(new eDomoticzPlatform.Barometer()).on('get', this.getPressure.bind(this));
                    }
                }
                if (this.batteryRef && this.batteryRef !== 255) { // if batteryRef == 255 we're running on mains
                    temperatureSensorService.addCharacteristic(new Characteristic.StatusLowBattery()).on('get', this.getLowBatteryStatus.bind(this));
                }
                services.push(temperatureSensorService);
                break;
            }
            case this.Type == "Wind":{
                var windService = new eDomoticzPlatform.WindDeviceService(this.name);
                windService.getCharacteristic(Characteristic.CurrentTemperature).on('get', this.getTemperature.bind(this));
                windService.getCharacteristic(eDomoticzPlatform.WindSpeed).on('get', this.getWindSpeed.bind(this));
                windService.getCharacteristic(eDomoticzPlatform.WindChill).on('get', this.getWindChill.bind(this));
                windService.getCharacteristic(eDomoticzPlatform.WindDirection).on('get', this.getWindDirection.bind(this));
                services.push(windService);
                break;
            }
            case this.Type == "Rain":{
                var rainService = new eDomoticzPlatform.RainDeviceService(this.name);
                rainService.getCharacteristic(eDomoticzPlatform.Rainfall).on('get', this.getRainfall.bind(this));
                services.push(rainService);
                break;
            }
          }
        }
        return services;
    }
};
