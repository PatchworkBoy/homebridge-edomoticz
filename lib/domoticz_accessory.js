var request = require("request");
var Constants = require('./constants.js');
var Helper = require('./helper.js').Helper;
var Domoticz = require('./domoticz.js').Domoticz;
var eDomoticzServices = require('./services.js').eDomoticzServices;
module.exports = eDomoticzAccessory;

function eDomoticzAccessory(platform, platformAccessory, IsScene, status, idx, name, uuid, haveDimmer, maxDimLevel, subType, Type, batteryRef, swType, swTypeVal, hwType, image, eve) {

    if ((haveDimmer) || (swType == "Dimmer")) {
        if ((hwType !== 51) && (swType !== "On/Off")) {
            this.haveDimmer = true;
            this.maxDimLevel = maxDimLevel;
        } else {
            this.haveDimmer = false;
        }
    } else {
        this.haveDimmer = false;
    }

    this.services = [];
    this.platform = platform;
    this.IsScene = IsScene; // Domoticz Scenes ignored for now...
    this.status = status;
    this.idx = idx;
    this.name = name;
    this.eve = eve;
    this.subType = subType;
    this.swType = swType;
    this.image = image;
    this.swTypeVal = swTypeVal;
    this.isSwitch = (typeof this.swTypeVal !== 'undefined' && this.swTypeVal >= 0 && this.name.indexOf("Occupied") == -1);
    switch (hwType) {
    case 67: // Domoticz Security Panel
        this.swTypeVal = Constants.DeviceTypeSecuritySystem;
        break;

    default:
        break;
    }

    this.Type = Type;
    this.batteryRef = batteryRef;
    this.CounterToday = 1;
    this.onValue = "On";
    this.offValue = "Off";
    this.cachedValues = {};
    this.hwType = hwType;

    // Initialize default values, e.g. to get the "factor"
    var voidCallback = function () {};
    switch (true) {
    case this.swTypeVal == Constants.DeviceTypeDimmer:
    case this.swTypeVal == Constants.DeviceTypeBlindsPercentage:
    case this.swTypeVal == Constants.DeviceTypeBlindsPercentageInverted:
        {
            if (this.swTypeVal == Constants.DeviceTypeBlindsPercentage) {
                this.isPercentageBlind = Constants.DeviceTypeBlindsPercentage;
            }
            if (this.swTypeVal == Constants.DeviceTypeBlindsPercentageInverted) {
                this.isInvertedBlind = Constants.DeviceTypeBlindsPercentageInverted;
            }
            this.getdValue(voidCallback);
            break;
        }
    default:
        break;
    }

    this.platformAccessory = platformAccessory;
    if (!this.platformAccessory) {
        this.platformAccessory = new platform.api.platformAccessory(this.name, uuid);
    }
    this.platformAccessory.reachable = true;
    this.publishServices();
}

eDomoticzAccessory.prototype = {
    identify: function (callback) {
        callback();
    },
    publishServices: function () {
        var services = this.getServices();
        for (var i = 0; i < services.length; i++) {
            var service = services[i];

            var existingService = this.platformAccessory.services.find(function (eService) {
                return eService.UUID == service.UUID;
            });

            if (!existingService) {
                this.platformAccessory.addService(service, this.name);
            }
        }
    },
    getService: function (name) {
        var service = false;
        try {
            service = this.platformAccessory.getService(name);
        } catch (e) {
            service = false;
        }

        if (!service) {
            var targetService = new name();
            service = this.platformAccessory.services.find(function (existingService) {
                return existingService.UUID == targetService.UUID;
            });
        }

        return service;
    },
    getCharacteristic: function (service, name) {
        var characteristic = false;
        try {
            characteristic = service.getCharacteristic(name);
        } catch (e) {
            console.log("^ For: " + service.displayName);
            characteristic = false;
        }

        if (!characteristic) {
            var targetCharacteristic = new name();
            characteristic = service.characteristics.find(function (existingCharacteristic) {
                return existingCharacteristic.UUID == targetCharacteristic.UUID;
            });
        }

        return characteristic;
    },
    gracefullyAddCharacteristic: function (service, characteristicType) {
        var characteristic = this.getCharacteristic(service, characteristicType);
        if (characteristic) {
            return characteristic;
        }

        return service.addCharacteristic(new characteristicType());
    },
    setPowerState: function (powerOn, callback, context) {
        if ((context && context == "eDomoticz-MQTT") || (this.cachedValues[Characteristic.On.UUID] == powerOn && powerOn)) {
            callback();
            return;
        }

        this.cachedValues[Characteristic.On.UUID] = powerOn;
        Domoticz.updateDeviceStatus(this, "switchlight", {
            "switchcmd": (powerOn ? "On" : "Off")
        }, function (success) {
            callback();
        }.bind(this));
    },
    getPowerState: function (callback) {
        var cachedValue = this.cachedValues[Characteristic.On.UUID];
        if (cachedValue) {
            callback(null, cachedValue);
        }

        Domoticz.deviceStatus(this, function (json) {
            var value;
            var sArray = Helper.sortByKey(json.result, "Name");
            sArray.map(function (s) {
                if (this.swTypeVal == Constants.DeviceTypePushOn) {
                    value = (s.Data == "Off") ? !1 : !0;
                } else {
                    value = (s.Status == "Off") ? 0 : 1;
                }
            }.bind(this));

            if (!cachedValue) {
                callback(null, value);
            }

            this.cachedValues[Characteristic.On.UUID] = value;
        }.bind(this));
    },
    getRainfall: function (callback) {
        Domoticz.deviceStatus(this, function (json) {
            var value;
            var sArray = Helper.sortByKey(json.result, "Name");
            sArray.map(function (s) {
                value = Helper.cleanFloat(s.Rain);
            }.bind(this));
            this.platform.log("Data Received for " + this.name + ": " + value);
            callback(null, value);
        }.bind(this));
    },
    setdValue: function (level, callback, context) {
        this.cachedValues[Characteristic.Brightness.UUID] = level;
        if (context && context == "eDomoticz-MQTT") {
            callback();
            return;
        }

        if (!(this.factor)) {
            Domoticz.deviceStatus(this, function (json) {
                var sArray = Helper.sortByKey(json.result, "Name");
                sArray.map(function (s) {
                    this.factor = 100 / s.MaxDimLevel;
                }.bind(this));
            }.bind(this));
        }

        var dim = this.platform.config.dimFix == 1 ? Math.floor(level / this.factor) + 1 : Math.floor(level / this.factor);
        Domoticz.updateDeviceStatus(this, "switchlight", {
            "switchcmd": "Set Level",
            "level": dim
        }, function (success) {
            callback();
        }.bind(this));
    },
    getdValue: function (callback) {
        var cachedValue = (this.isPercentageBlind || this.isInvertedBlind) ? this.cachedValues[Characteristic.CurrentPosition.UUID] : this.cachedValues[Characteristic.Brightness.UUID];
        if (cachedValue) {
            callback(null, cachedValue);
        }

        Domoticz.deviceStatus(this, function (json) {
            var value;
            var sArray = Helper.sortByKey(json.result, "Name");
            sArray.map(function (s) {
                this.factor = 100 / s.MaxDimLevel;
                value = Math.floor(s.LevelInt * this.factor);
            }.bind(this));
            this.platform.log("Data Received for " + this.name + ": " + value);

            if (!cachedValue) {
                callback(null, value);
            }

            if (value > 0) {
                this.cachedValues[Characteristic.Brightness.UUID] = value;
            }
        }.bind(this));
    },
    getHueValue: function (type, callback) {
        // TODO: Wait for Domoticz to add RGB/HSB status to their lights. Return last known value or 'white' for now.
        if (type == 'Hue') {
            callback(null, (this.hueValue !== undefined ? this.hueValue : 0));
        } else if (type == 'Saturation') {
            callback(null, (this.saturationValue !== undefined ? this.saturationValue : 0));
        } else {
            callback(null, 0);
        }
    },
    setHueValue: function (type, value, callback, context) {
        if (context && context == "eDomoticz-MQTT") {
            callback();
            return;
        }
        if (type == 'Hue') {
            this.hueValue = value;
            this.hueSemaphore = (this.hueSemaphore === undefined ? 0 : this.hueSemaphore + 1);
        } else if (type == 'Saturation') {
            this.saturationValue = value;
            this.hueSemaphore = (this.hueSemaphore === undefined ? 0 : this.hueSemaphore + 1);
        }
        if (this.hueValue !== undefined && this.saturationValue !== undefined && this.hueSemaphore !== undefined && this.hueSemaphore > 0) {
            this.hueSemaphore = undefined;
            //Domoticz.updateDeviceStatus(this, "setcolbrightnessvalue", {"hue": this.hueValue, "brightness": 100, "sat": this.saturationValue, "iswhite": (this.saturationValue < 15)}, function(success) { // MQTT...
            Domoticz.updateDeviceStatus(this, "setcolbrightnessvalue", {
                "hex": Helper.HSVtoRGB([this.hueValue, this.saturationValue, 100])
            }, function (success) {
                callback();
            }.bind(this));
        } else {
            callback();
        }
    },
    getValue: function (callback) {
        Domoticz.deviceStatus(this, function (json) {
            var value;
            var sArray = Helper.sortByKey(json.result, "Name");
            sArray.map(function (s) {
                value = Helper.cleanFloat(s.Data);
                value = Helper.oneDP(value);
            }.bind(this));
            this.platform.log("Data Received for " + this.name + ": " + value);
            callback(null, value);
        }.bind(this));
    },
    getQualValue: function (callback) {
        Domoticz.deviceStatus(this, function (json) {
            var value;
            var sArray = Helper.sortByKey(json.result, "Name");
            sArray.map(function (s) {
                value = s.Quality;
                switch (value) {
                case "Unknown":
                    {
                        value = Characteristic.AirQuality.UNKNOWN;
                        break;
                    }
                case "Excellent":
                    {
                        value = Characteristic.AirQuality.EXCELLENT;
                        break;
                    }
                case "Good":
                    {
                        value = Characteristic.AirQuality.GOOD;
                        break;
                    }
                case "Fair":
                    {
                        value = Characteristic.AirQuality.FAIR;
                        break;
                    }
                case "Mediocre":
                case "Inferior":
                    {
                        value = Characteristic.AirQuality.INFERIOR;
                        break;
                    }
                case "Bad":
                case "Poor":
                    {
                        value = Characteristic.AirQuality.POOR;
                        break;
                    }
                default:
                    {
                        value = Characteristic.AirQuality.FAIR;
                        break;
                    }
                }
            }.bind(this));
            this.platform.log("Data Received for " + this.name + ": " + value);
            callback(null, value);
        }.bind(this));
    },
    getDoorbellSensorValue: function(callback) {
        callback(null, false);
    },
    getStringValue: function (callback) {
        Domoticz.deviceStatus(this, function (json) {
            var value;
            var sArray = Helper.sortByKey(json.result, "Name");
            sArray.map(function (s) {
                if (s.SwitchTypeVal == Constants.DeviceTypeContact || s.SwitchTypeVal == Constants.DeviceTypeDoorContact) {
                    if (s.Data == "Closed") {
                        value = Characteristic.ContactSensorState.CONTACT_DETECTED;
                    } else {
                        value = Characteristic.ContactSensorState.CONTACT_NOT_DETECTED;
                    }
                } else if (s.SwitchTypeVal == Constants.DeviceTypeSmoke) {
                    if (s.Data == "Off" || s.Data == "Normal") {
                        value = Characteristic.SmokeDetected.SMOKE_NOT_DETECTED;
                    } else {
                        value = Characteristic.SmokeDetected.SMOKE_DETECTED;
                    }
                } else if (s.SwitchTypeVal == Constants.DeviceTypeMotion) {
                    if (s.Data == "Off") {
                        value = false;
                    } else {
                        value = true;
                    }
                } else if (this.Type == "Lux") { //Lux
                    value = parseInt(s.Data, 10);
                    value = (value == 0) ? 0.0001 : value;
                } else if (this.subType == "Waterflow" || (this.name.indexOf("Gas") > -1 && this.Type == "General" && this.subType == "kWh")) {
                    value = Helper.cleanFloat(s.Data);
} else if (this.subType == "RFXMeter counter" || this.subType == "Percentage" || this.subType == "kWh" || this.subType == "Energy" || this.subType == "Solar Radiation" || this.subType == "UVN800" || this.subType == "UVN128,UV138" || this.subType == "Visibility") {
                    value = (s.Counter !== undefined) ? Helper.cleanFloat(s.Counter) : Helper.cleanFloat(s.Data);
                } else if (this.subType == "Text") {
                    value = s.Data.toString();
                    value = encodeURIComponent(value);
                } else {
                    value = s.Data.toString();
                    value = encodeURIComponent(value);
                }
            }.bind(this));
            callback(null, value);
        }.bind(this));
    },
    getYLTodayValue: function (callback) {
        Domoticz.deviceStatus(this, function (json) {
            var value;
            var sArray = Helper.sortByKey(json.result, "Name");
            sArray.map(function (s) {
                value = Helper.cleanFloat(s.CounterToday);
            }.bind(this));
            this.platform.log("Data Received for " + this.name + ": " + value);
            callback(null, value);
        }.bind(this));
    },
    getYLTotalValue: function (callback) {
        Domoticz.deviceStatus(this, function (json) {
            var value;
            var sArray = Helper.sortByKey(json.result, "Name");
            sArray.map(function (s) {
                value = Helper.cleanFloat(s.Counter);
            }.bind(this));
            this.platform.log("Data Received for " + this.name + ": " + value);
            callback(null, value);
        }.bind(this));
    },
    getWindSpeed: function (callback) {
        Domoticz.deviceStatus(this, function (json) {
            var value;
            var sArray = Helper.sortByKey(json.result, "Name");
            sArray.map(function (s) {
                value = Helper.cleanFloat(s.Speed);
                value = Helper.oneDP(value);
            }.bind(this));
            this.platform.log("Data Received for " + this.name + ": " + value);
            callback(null, value);
        }.bind(this));
    },
    getWindChill: function (callback) {
        Domoticz.deviceStatus(this, function (json) {
            var value;
            var sArray = Helper.sortByKey(json.result, "Name");
            sArray.map(function (s) {
                value = Helper.cleanFloat(s.Chill);
                value = Helper.oneDP(value);
            }.bind(this));
            this.platform.log("Data Received for " + this.name + ": " + value);
            callback(null, value);
        }.bind(this));
    },
    getWindDirection: function (callback) {
        Domoticz.deviceStatus(this, function (json) {
            var value;
            var sArray = Helper.sortByKey(json.result, "Name");
            sArray.map(function (s) {
                value = s.Direction.toString() + " (" + s.DirectionStr.toString() + ")";
            }.bind(this));
            this.platform.log("Data Received for " + this.name + ": " + value);
            callback(null, value);
        }.bind(this));
    },
    getCPower: function (callback) {
        Domoticz.deviceStatus(this, function (json) {
            var value;
            var sArray = Helper.sortByKey(json.result, "Name");
            sArray.map(function (s) {
                value = (this.Type == "Usage" && this.subType == "Electric") ? Helper.cleanFloat(s.Data) : Helper.cleanFloat(s.Usage);
            }.bind(this));
            this.platform.log("Data Received for " + this.name + ": " + value);
            callback(null, value);
        }.bind(this));
    },
    getState: function (callback) {
        value = 1;
        this.platform.log("Static Data for " + this.name + ": " + value);
        callback(null, value);
    },
    getTemperature: function (callback) {
        Domoticz.deviceStatus(this, function (json) {
            var value;
            var sArray = Helper.sortByKey(json.result, "Name");
            sArray.map(function (s) {
                var heat = (this.subType == "Zone") ? true : false;
                var therm = (this.subType == "SetPoint") ? true : false;
                value = ((heat) || (therm)) ? Helper.oneDP(Helper.cleanFloat(s.SetPoint)) : Helper.oneDP(Helper.cleanFloat(s.Temp));
            }.bind(this));
            this.platform.log("Data Received for " + this.name + ": " + value);
            callback(null, value);
        }.bind(this));
    },
    getTemperatureAlternative: function (callback) {
        Domoticz.deviceStatus(this, function (json) {
            var value;
            var sArray = Helper.sortByKey(json.result, "Name");
            sArray.map(function (s) {
                var heat = (this.subType == "Zone") ? true : false;
                var therm = (this.subType == "SetPoint") ? true : false;
                value = Helper.oneDP(Helper.cleanFloat(s.Temp));
            }.bind(this));
            this.platform.log("Data Received for " + this.name + ": " + value);
            callback(null, value);
        }.bind(this));
    },
    setPoint: function (setpoint, callback, context) {
        if (context && context == "eDomoticz-MQTT") {
            callback();
            return;
        }
        var url = "";
        if (this.subType == "SetPoint") {
            url = this.platform.apiBaseURL + "type=command&param=udevice&idx=" + this.idx;
            url = url + "&nvalue=0&svalue=" + setpoint;
        } else if (this.subType == "Zone") {
            url = this.platform.apiBaseURL + "type=setused&idx=" + this.idx + "&setpoint=";
            url = url + setpoint + "&mode=PermanentOverride&used=true";
        }
        this.platform.log("Setting thermostat SetPoint to " + setpoint);
        Domoticz.updateWithURL(this, url, function (success) {
            callback(null, setpoint);
        }.bind(this));
    },
    setTempOverride: function (setuntil, callback, context) {
        if (context && context == "eDomoticz-MQTT") {
            callback();
            return;
        }
        var url = "";
        var temp;
        var now = new Date();
        var newnow, isonow;
        var mode;
        if (setuntil < 1) {
            mode = "Auto";
        } else if (setuntil > 480) {
            mode = "PermanentOverride";
        } else {
            mode = "TemporaryOverride";
            newnow = new Date(now.getTime() + (setuntil * 60 * 1000));
            isonow = newnow.toISOString();
        }

        Domoticz.deviceStatus(this, function (json) {
            var value;
            var sArray = Helper.sortByKey(json.result, "Name");
            sArray.map(function (s) {
                var heat = (this.Type == "Heating" && this.subType == "Zone") ? true : false;
                var therm = (this.Type == "Thermostat" && this.subType == "SetPoint") ? true : false;
                temp = (heat || therm) ? Helper.oneDP(Helper.cleanFloat(s.SetPoint)) : Helper.oneDP(Helper.cleanFloat(s.Temp));
                url = this.platform.apiBaseURL + "type=setused&idx=" + this.idx + "&setpoint=";
                url = url + temp + "&mode=" + mode;
                url = (mode == "TemporaryOverride") ? url + "&until=" + isonow + "&used=true" : url + "&used=true";
                this.platform.log("Setting thermostat SetPoint to " + temp + ", mode to " + mode);
                Domoticz.updateWithURL(this, url, function (success) {
                    callback(null, setuntil);
                }.bind(this));
            }.bind(this));
        }.bind(this), function (error) {
            callback();
        });
    },
    getTempOverride: function (callback) {
        Domoticz.deviceStatus(this, function (json) {
            var value;
            var sArray = Helper.sortByKey(json.result, "Name");
            sArray.map(function (s) {
                var d1 = new Date(s.Until);
                var now = new Date().getTime();
                var diff = d1 - now;
                value = (diff / (60 * 1000));
            }.bind(this));
            this.platform.log("Data Received for " + this.name + ": " + value);
            callback(null, value);
        }.bind(this));
    },
    getHumidity: function (callback) {
        Domoticz.deviceStatus(this, function (json) {
            var value;
            var sArray = Helper.sortByKey(json.result, "Name");
            sArray.map(function (s) {
                value = Helper.cleanFloat(s.Humidity);
                value = Helper.oneDP(value);
            }.bind(this));
            this.platform.log("Data Received for " + this.name + ": " + value);
            callback(null, value);
        }.bind(this));
    },
    getPressure: function (callback) {
        Domoticz.deviceStatus(this, function (json) {
            var value;
            var sArray = Helper.sortByKey(json.result, "Name");
            sArray.map(function (s) {
                var val = Helper.cleanFloat(s.Barometer);
                val = Math.ceil(val);
                value = val;
            }.bind(this));
            this.platform.log("Data Received for " + this.name + ": " + value);
            callback(null, value);
        }.bind(this));
    },
    getLowBatteryStatus: function (callback) {
        Domoticz.deviceStatus(this, function (json) {
            var value;
            var sArray = Helper.sortByKey(json.result, "Name");
            sArray.map(function (s) {
                value = Helper.cleanFloat(s.BatteryLevel);
            }.bind(this));
            if (value > 20) {
                callback(null, 0);
            } else {
                callback(null, 1);
            }
        }.bind(this));
    },
    getBlindStatus: function (callback) {
        if (this.isPercentageBlind) {
            this.getdValue(callback);
            return;
        }

        Domoticz.deviceStatus(this, function (json) {
            var value;
            var sArray = Helper.sortByKey(json.result, "Name");
            sArray.map(function (s) {
                value = s.Data.toString();
            }.bind(this));
            if (value == "Open") {
                callback(null, 100);
            } else {
                callback(null, 0);
            }
        }.bind(this));
    },
    setBlindStatus: function (blindService, pos, callback, context) {
        var shouldOpen = (pos <= 50);
        if (this.isInvertedBlind) {
            shouldOpen = !shouldOpen;
        }

        var finish = function (position) {
            callback();

            if (!this.isPercentageBlind) {
                this.getCharacteristic(blindService, Characteristic.CurrentPosition).setValue(position, false, this);
            }
        }.bind(this);

        if (context && context == "eDomoticz-MQTT") {
            finish(pos);
            return;
        }

        if (this.isPercentageBlind && pos > 0 && pos < 100) {
            this.setdValue(pos, function () {
                finish(pos);
            });
            return;
        }

        var command = (shouldOpen ? "On" : "Off");
        Domoticz.updateDeviceStatus(this, "switchlight", {
            "switchcmd": command
        }, function (success) {
            finish(pos);
        }.bind(this));
    },
    getBlindPStatus: function (callback) {
        callback(null, Characteristic.PositionState.STOPPED);
    },
    getLockStatus: function (callback) {
        Domoticz.deviceStatus(this, function (json) {
            var value;
            var sArray = Helper.sortByKey(json.result, "Name");
            sArray.map(function (s) {
                value = (s.Data == "Open" || s.Data == "Unlocked") ? Characteristic.LockCurrentState.UNSECURED : Characteristic.LockCurrentState.SECURED;
            }.bind(this));
            this.platform.log("Data Received for " + this.name + ": " + value);
            callback(null, value);
        }.bind(this));
    },
    setLockStatus: function (doorstate, callback, context) {
        if (context && context == "eDomoticz-MQTT") {
            callback();
            return;
        }

        var command = (doorstate == Characteristic.LockTargetState.UNSECURED);
        if (this.swTypeVal == Constants.DeviceTypeDoorLock) {
            command = !command;
        }

        Domoticz.updateDeviceStatus(this, "switchlight", {
            "switchcmd": (command ? "On" : "Off")
        }, function (success) {
            callback();
        }.bind(this));
    },
    setLockInvertedStatus: function (doorstate, callback, context) {
        if (context && context == "eDomoticz-MQTT") {
            callback();
            return;
        }

        var command = (doorstate == Characteristic.LockTargetState.SECURED);
        if (this.swTypeVal == Constants.DeviceTypeDoorLockInverted) {
            command = !command;
        }

        Domoticz.updateDeviceStatus(this, "switchlight", {
            "switchcmd": (command ? "On" : "Off")
        }, function (success) {
            callback();
        }.bind(this));
    },
    getDoorStatus: function (callback) {
        Domoticz.deviceStatus(this, function (json) {
            var value;
            var sArray = Helper.sortByKey(json.result, "Name");
            sArray.map(function (s) {
                value = (s.Data == "Open" || s.Data == "Unlocked") ? Characteristic.CurrentDoorState.OPEN : Characteristic.CurrentDoorState.CLOSED;
            }.bind(this));
            this.platform.log("Data Received for " + this.name + ": " + value);
            callback(null, value);
        }.bind(this));
    },
    setDoorStatus: function (doorstate, callback, context) {
        if (context && context == "eDomoticz-MQTT") {
            callback();
            return;
        }

        var command = (doorstate == Characteristic.TargetDoorState.OPEN);
        if (this.swTypeVal == Constants.DeviceTypeDoorLock) {
            command = !command;
        }

        Domoticz.updateDeviceStatus(this, "switchlight", {
            "switchcmd": (command ? "On" : "Off")
        }, function (success) {
            callback();
        }.bind(this));
    },
    getSecuritySystemStatus: function (callback) {
        var cachedValue = this.cachedValues[Characteristic.SecuritySystemCurrentState.UUID];
        if (cachedValue) {
            callback(null, cachedValue);
        }

        Domoticz.deviceStatus(this, function (json) {
            var value;
            var sArray = Helper.sortByKey(json.result, "Name");
            sArray.map(function (s) {
                switch (s.Data) {
                case "Arm Home":
                    value = Characteristic.SecuritySystemCurrentState.STAY_ARM;
                    break;

                case "Arm Away":
                    value = Characteristic.SecuritySystemCurrentState.AWAY_ARM;
                    break;

                case "Normal":
                default:
                    value = Characteristic.SecuritySystemCurrentState.DISARMED;
                    break;
                }
            }.bind(this));

            if (!cachedValue) {
                callback(null, value);
            }

            this.cachedValues[Characteristic.SecuritySystemCurrentState.UUID] = value;
        }.bind(this));
    },
    setSecuritySystemStatus: function (securityService, alarmState, callback, context) {
        if (context && (context == "eDomoticz-MQTT" || context == "callback-self")) {
            if (callback) {
                callback();
            }
            return;
        }

        Domoticz.settings(this, function (settings) {
            var secStatus = "0";
            var targetState = alarmState;
            switch (alarmState) {
            case Characteristic.SecuritySystemCurrentState.STAY_ARM:
            case Characteristic.SecuritySystemCurrentState.NIGHT_ARM:
                secStatus = "1";

                if (Characteristic.SecuritySystemCurrentState.NIGHT_ARM) {
                    targetState = Characteristic.SecuritySystemCurrentState.STAY_ARM;
                }
                break;

            case Characteristic.SecuritySystemCurrentState.AWAY_ARM:
                secStatus = "2";
                break;

            case Characteristic.SecuritySystemCurrentState.DISARMED:
            default:
                secStatus = "0";
                targetState = Characteristic.SecuritySystemCurrentState.DISARMED;
                break;
            }

            var url = this.platform.apiBaseURL + "type=command&param=setsecstatus&secstatus=" + secStatus + "&seccode=" + settings.SecPassword;
            Domoticz.updateWithURL(this, url, function (success) {
                this.cachedValues[Characteristic.SecuritySystemCurrentState.UUID] = targetState;
                callback();
                this.getCharacteristic(securityService, Characteristic.SecuritySystemCurrentState).setValue(targetState, false, "callback-self");

                setTimeout(function () {
                    this.getCharacteristic(securityService, Characteristic.SecuritySystemTargetState).setValue(targetState, false, "callback-self");
                }.bind(this), 200);
            }.bind(this));
        }.bind(this));
    },
    getSelectorValue: function (callback) {
        Domoticz.deviceStatus(this, function (json) {
            var value;
            var sArray = Helper.sortByKey(json.result, "Name");
            sArray.map(function (s) {
                switch (s.Level){
                    case "10":
                        value = Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS;
                        break;
                    case "20":
                        value = Characteristic.ProgrammableSwitchEvent.DOUBLE_PRESS;
                        break;
                    case "30":
                        value = Characteristic.ProgrammableSwitchEvent.LONG_PRESS;
                        break;
                }
            }.bind(this));
            this.platform.log("Data Received for " + this.name + ": " + value);
            callback(null, value);
        }.bind(this));
    },
    handleMQTTMessage: function (message, callback) {
        this.platform.log("MQTT Message received for %s.\nName:\t\t%s\nDevice:\t\t%s,%s\nIs Switch:\t%s\nSwitchTypeVal:\t%s\nMQTT Message:\n%s", this.name, this.name, this.Type, this.subType, this.isSwitch, this.swTypeVal, JSON.stringify(message, null, 4));

        if ((this.Type == "P1 Smart Meter" && this.swTypeVal == 0 && this.subType == "Energy") || (this.Type == "P1 Smart Meter" && this.swTypeVal == 1 && this.subType == "Gas") || (this.Type == "General" && this.swTypeVal == 2 && this.subType == "Counter Incremental") || (this.name.indexOf("Occupied") > -1) || (this.Type == "General" && this.swTypeVal == 1 && this.subType == "Visibility") || (this.Type == "General" && this.swTypeVal === 0 && this.subType == "kWh") || (this.Type == "General" && this.subType == "Solar Radiation" && this.swTypeVal === 0) || (this.Type == "YouLess Meter" && this.swTypeVal === 0) || (this.name.indexOf("Location") > -1) || (this.Type == "RFXMeter")) {
            this.swTypeVal = false;
            this.isSwitch = false;
            //cludgey fix for a P1 SmartMeter Virtual Sensor being ID'd as a doorbell in Domoticz, and Incremental Counters being id'd as contact switches
            //and other such Domoticz-generated oddities
        }
        if (this.isSwitch) {
            switch (true) {
            case this.swTypeVal == Constants.DeviceTypeSwitch || this.swTypeVal == Constants.DeviceTypePushOn:
                {
                    this.cachedValues[Characteristic.On.UUID] = message.nvalue;


                    var service = false;
                    if (this.image !== undefined && this.swTypeVal !== Constants.DeviceTypePushOn) {
                        if (this.image.indexOf("Fan") > -1) {
                            service = this.getService(Service.Fan);

                        } else if (this.image.indexOf("Light") > -1) {
                            service = this.getService(Service.Lightbulb);

                        } else if (this.image.indexOf("WallSocket") > -1) {
                            service = this.getService(Service.Outlet);

                        } else {
                            service = this.getService(Service.Switch);

                        }
                    } else {
                        service = this.getService(Service.Switch);

                    }

                    if (!service) {
                        break;
                    }

                    var characteristic = this.getCharacteristic(service, Characteristic.On);
                    callback(characteristic, message.nvalue);
                    break;
                }
            case this.swTypeVal == Constants.DeviceTypeContact:
            case this.swTypeVal == Constants.DeviceTypeDoorContact:
                {
                    var service = this.getService(Service.ContactSensor);
                    var characteristic = this.getCharacteristic(service, Characteristic.ContactSensorState);
                    callback(characteristic, message.nvalue);
                    break;
                }
            case this.swTypeVal == Constants.DeviceTypeSmoke:
                {
                    var service = this.getService(Service.SmokeSensor);
                    var characteristic = this.getCharacteristic(service, Characteristic.SmokeDetected);
                    callback(characteristic, message.nvalue);
                    break;
                }
            case this.swTypeVal == Constants.DeviceTypeDimmer:
            case this.swTypeVal == Constants.DeviceTypeMedia:
                {
                    var isFan = this.image && this.image.indexOf("Fan") > -1
                    var service = this.getService(isFan ? Service.Fan : Service.Lightbulb);
                    var powerCharacteristic = this.getCharacteristic(service, Characteristic.On);
                    var dimCharacteristic = this.getCharacteristic(service, isFan ? Characteristic.RotationSpeed : Characteristic.Brightness);
                    var isOn = (message.nvalue > 0);
                    var wasOn = this.cachedValues[Characteristic.On.UUID];
                    var dimCallbackDelay = 1;
                    if (message.svalue1 == 0 || isOn != wasOn) {
                        callback(powerCharacteristic, isOn);
                        this.cachedValues[Characteristic.On.UUID] = isOn;

                        if (isOn) {
                            dimCallbackDelay = 200;
                        }
                    }

                    if (isOn && this.factor) {
                        var handleDimLevelChange = function (level) {
                            level = Math.floor(level);
                            if (level > 0) {
                                setTimeout(function () {
                                    this.cachedValues[Characteristic.Brightness.UUID] = level;
                                    callback(dimCharacteristic, level);
                                }.bind(this), dimCallbackDelay);
                            }
                        }.bind(this);

                        // Switch is a dimmer but MQTT didn't return level
                        if (typeof message.svalue1 == 'undefined') {
                            this.cachedValues[Characteristic.Brightness.UUID] = 0;

                            dimCharacteristic.getValue(function (sender, level) {
                                handleDimLevelChange(level);
                            }.bind(this));
                            return;
                        }

                        var level = message.svalue1 * this.factor;
                        handleDimLevelChange(level);
                    }
                    break;
                }
            case this.swTypeVal == Constants.DeviceTypeMotion:
                {
                    var service = this.getService(Service.MotionSensor);
                    var characteristic = this.getCharacteristic(service, Characteristic.MotionDetected);
                    callback(characteristic, message.nvalue);
                    break;
                }
            case this.swTypeVal == Constants.DeviceTypeDoorbell:
                {
		    			var service = this.getService(Service.StatelessProgrammableSwitch);
                    var characteristic = this.getCharacteristic(service, Characteristic.ProgrammableSwitchEvent);
                    callback(characteristic, Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS);

                    var service = this.getService(Service.Doorbell);
                    var characteristic = this.getCharacteristic(service, Characteristic.ProgrammableSwitchEvent);
                    callback(characteristic, Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS);
                    break;
                }
            case this.swTypeVal == Constants.DeviceTypeSelector:
                {
                    var service = this.getService(Service.StatelessProgrammableSwitch);
                    var characteristic = this.getCharacteristic(service, Characteristic.ProgrammableSwitchEvent);
                    var value;
                    switch (message.svalue1) {
                        case "10":
                            value = Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS;
                            break;
                        case "20":
                            value = Characteristic.ProgrammableSwitchEvent.DOUBLE_PRESS;
                            break;
                        case "30":
                            value = Characteristic.ProgrammableSwitchEvent.LONG_PRESS;
                            break;
                    }
                    callback(characteristic, value);
                    break;
                }
            case this.swTypeVal == Constants.DeviceTypeDoorLock:
                {
                    if (this.name.indexOf("garage") > -1) {
                        var command = (parseInt(message.nvalue) == 1);

                        if (this.swTypeVal == Constants.DeviceTypeDoorLock) {
                            command = command;
                        }

                        var garageState = (command ? Characteristic.TargetDoorState.UNSECURED : Characteristic.TargetDoorState.SECURED);

                        var service = this.getService(Service.GarageDoorOpener);
                        var targetCharacteristic = this.getCharacteristic(service, Characteristic.TargetDoorState);
                        callback(targetCharacteristic, garageState);

                        var currentCharacteristic = this.getCharacteristic(service, Characteristic.CurrentDoorState);
                        callback(currentCharacteristic, garageState);
                        break;


                    } else {
                        var command = (parseInt(message.nvalue) == 1);

                        if (this.swTypeVal == Constants.DeviceTypeDoorLock) {
                            command = !command;
                        }

                        var doorState = (command ? Characteristic.LockTargetState.UNSECURED : Characteristic.LockTargetState.SECURED);

                        var service = this.getService(Service.LockMechanism);
                        var targetCharacteristic = this.getCharacteristic(service, Characteristic.LockTargetState);
                        callback(targetCharacteristic, doorState);

                        var currentCharacteristic = this.getCharacteristic(service, Characteristic.LockCurrentState);
                        callback(currentCharacteristic, doorState);
                        break;
                    }
                }
            case this.swTypeVal == Constants.DeviceTypeDoorLockInverted:
                {
                    if (this.name.indexOf("garage") > -1) {
                        var command = (parseInt(message.nvalue) == 1);

                        if (this.swTypeVal == Constants.DeviceTypeDoorLockInverted) {
                            command = command;
                        }

                        var garageState = (command ? Characteristic.TargetDoorState.UNSECURED : Characteristic.TargetDoorState.SECURED);

                        var service = this.getService(Service.GarageDoorOpener);
                        var targetCharacteristic = this.getCharacteristic(service, Characteristic.TargetDoorState);
                        callback(targetCharacteristic, garageState);

                        var currentCharacteristic = this.getCharacteristic(service, Characteristic.CurrentDoorState);
                        callback(currentCharacteristic, garageState);
                        break;


                    } else {
                        var command = (parseInt(message.nvalue) == 1);

                        if (this.swTypeVal == Constants.DeviceTypeDoorLockInverted) {
                            command = !command;
                        }

                        var doorState = (command ? Characteristic.LockTargetState.SECURED : Characteristic.LockTargetState.UNSECURED);

                        var service = this.getService(Service.LockMechanism);
                        var targetCharacteristic = this.getCharacteristic(service, Characteristic.LockTargetState);
                        callback(targetCharacteristic, doorState);

                        var currentCharacteristic = this.getCharacteristic(service, Characteristic.LockCurrentState);
                        callback(currentCharacteristic, doorState);
                        break;
                	}
                }
            case this.swTypeVal == Constants.DeviceTypeBlinds:
            case this.swTypeVal == Constants.DeviceTypeBlindsInverted:
            case this.swTypeVal == Constants.DeviceTypeBlindsVenetianUS:
            case this.swTypeVal == Constants.DeviceTypeBlindsVenetianEU:
            case this.swTypeVal == Constants.DeviceTypeBlindsPercentage:
            case this.swTypeVal == Constants.DeviceTypeBlindsPercentageInverted:
                {
                    var position = 0;
                    if (this.isPercentageBlind && message.nvalue > 1) {
                        position = message.svalue1 * this.factor;
                    } else if ((this.swTypeVal == Constants.DeviceTypeBlindsVenetianUS || this.swTypeVal == Constants.DeviceTypeBlindsVenetianEU) && message.nvalue > 1) {
                        position = (message.nvalue == 15 ? 100 : 0);
                    } else {
                        position = (message.nvalue == 1 ? 0 : 100);
                        if (message.stype == 'RFY') {
                            position = 100 - position;
                        }

                        if (this.isInvertedBlind) {
                            position = 100 - position;
                        }
                    }

                    var lastActivity = false;
                    if (this.cachedValues["lastActivity"]) {
                        lastActivity = this.cachedValues["lastActivity"];
                    }

                    this.cachedValues["lastActivity"] = new Date();

                    if (this.isPercentageBlind) {
                        this.cachedValues[Characteristic.Brightness.UUID] = position;
                    }

                    var service = this.getService(Service.WindowCovering);
                    var currentPositionCharacteristic = this.getCharacteristic(service, Characteristic.CurrentPosition);
                    var targetPositionCharacteristic = this.getCharacteristic(service, Characteristic.TargetPosition);

                    if (this.isPercentageBlind)
                    {
                        if (!lastActivity || (new Date()) - lastActivity > 500)
                        {
                            callback(currentPositionCharacteristic, position);
                            callback(targetPositionCharacteristic, position);
                        }
                        else {
                            callback(currentPositionCharacteristic, position);
                        }
                    }
                    else
                    {
                        callback(currentPositionCharacteristic, position);
                        callback(targetPositionCharacteristic, position);
                    }
                    break;
                }
            case this.swTypeVal == Constants.DeviceTypeSecuritySystem:
                {
                    var systemState = Characteristic.SecuritySystemCurrentState.STAY_ARM;
                    switch (message.nvalue) {
                    case 0: //Disarm
                    case 1: //Normal Delay
                    case 13: //Disarm
                        systemState = Characteristic.SecuritySystemCurrentState.DISARMED;
                        break;
                    case 9: //Arm Away
                    case 10: //Arm Away Delayed
                        systemState = Characteristic.SecuritySystemCurrentState.AWAY_ARM;
                        break;
                    case 11: //Arm Home
                    case 12: //Arm Home Delayed
                        systemState = Characteristic.SecuritySystemCurrentState.STAY_ARM;
                        break;
                    case 6:
                        systemState = Characteristic.SecuritySystemCurrentState.ALARM_TRIGGERED;
                        break;
                    default:
                    case 2: //Alarm
                    case 3: //Alarm Delayed
                    case 4: //Motion
                    case 5: //No Motion
                    case 6: //Panic
                    case 7: //Panic End
                    case 8:
                    }

                    this.cachedValues[Characteristic.SecuritySystemCurrentState.UUID] = systemState;
                    var service = this.getService(Service.SecuritySystem);
                    var currentStateCharacteristic = this.getCharacteristic(service, Characteristic.SecuritySystemCurrentState);
                    var targetStateCharacteristic = this.getCharacteristic(service, Characteristic.SecuritySystemTargetState);
                    callback(currentStateCharacteristic, systemState);
                    callback(targetStateCharacteristic, systemState);
                    break;
                }

            default:
                break;
            }
        } else { // Accessory is a sensor
            switch (true) {
            case this.Type == "General" || this.Type == "YouLess Meter" || this.Type == "Current" || this.Type == "UV" || this.Type == "Usage" || this.Type == "Lux":
                {
                    if ('undefined' !== typeof message.svalue1) {
                        if (this.subType == "kWh" || this.subType == "YouLess counter" || this.subType == "Electric") {
                            if (this.subType == "kWh") {
                                var service = this.getService(eDomoticzServices.MeterDeviceService);
                                var CurrentConsumptionCharacteristic = this.getCharacteristic(service, eDomoticzServices.CurrentConsumption);
                                var ccc = Helper.cleanFloat(message.svalue1);
                                callback(CurrentConsumptionCharacteristic, ccc);
                                if ('undefined' !== typeof message.svalue2) {
                                    var service = this.getService(eDomoticzServices.MeterDeviceService);
                                    var TotalConsumptionCharacteristic = this.getCharacteristic(service, eDomoticzServices.TotalConsumption);
                                    var val1 = Helper.cleanFloat(message.svalue2);
                                    val1 = (this.name.indexOf('Gas') > -1) ? val1 / 1000 : val1;
                                    callback(TotalConsumptionCharacteristic, val1);
                                }
                            } else if (this.subType == "YouLess counter") {
                                var service = this.getService(eDomoticzServices.MeterDeviceService);
                                if ('undefined' !== typeof message.svalue2) {
                                    var CurrentConsumptionCharacteristic2 = this.getCharacteristic(service, eDomoticzServices.CurrentConsumption);
                                    var newval2 = Helper.cleanFloat(message.svalue2);
                                    callback(CurrentConsumptionCharacteristic2, newval2);
                                }
                                var TotalConsumptionCharacteristic2 = this.getCharacteristic(service, eDomoticzServices.TotalConsumption);
                                var newval = Helper.oneDP(Helper.cleanFloat(message.svalue1) / 1000);
                                callback(TotalConsumptionCharacteristic2, newval);
                            }
                            if (this.name.indexOf('Gas') < 1 && this.subType !== "Electric" && this.subType !== "Youless counter" && this.subType !== "Energy") {
                                if ('undefined' !== typeof message.svalue2) {
                                    var service = this.getService(eDomoticzServices.MeterDeviceService);
                                    var TodayConsumptionCharacteristic3 = this.getCharacteristic(service, eDomoticzServices.TodayConsumption);
                                    var val3 = Helper.cleanFloat(message.svalue2);
                                    callback(TodayConsumptionCharacteristic3, val3);
                                }
                            }
                            break;
                        } else if (this.subType == "Percentage") {
                            var service = this.getService(eDomoticzServices.UsageDeviceService);
                            var UsageDeviceCharacteristic = this.getCharacteristic(service, eDomoticzServices.CurrentUsage);
                            var val4 = Helper.cleanFloat(message.svalue1);
                            callback(UsageDeviceCharacteristic, val4);
                            break;
                        } else if (this.subType == "Visibility") {
                            var service = this.getService(eDomoticzServices.VisibilityDeviceService);
                            var VisibilityDeviceCharacteristic = this.getCharacteristic(service, eDomoticzServices.Visibility);
                            var val5 = Helper.cleanFloat(message.svalue1);
                            callback(VisibilityDeviceCharacteristic, val5);
                            break;
                        } else if (this.subType == "Solar Radiation" || this.subType == "UVN800") {
                            var service = this.getService(eDomoticzServices.SolRadDeviceService);
                            var SolRadDeviceCharacteristic = this.getCharacteristic(service, eDomoticzServices.SolRad);
                            var val6 = Helper.cleanFloat(message.svalue1);
                            callback(SolRadDeviceCharacteristic, val6);
                            break;
                        } else if ((this.subType) == "Text" && (this.name.indexOf('Location') > -1)) {
                            var service = this.getService(eDomoticzServices.LocationService);
                            var LocationDeviceCharacteristic = this.getCharacteristic(service, Characteristic.Version);
                            var text = message.svalue1.toString();
                            callback(LocationDeviceCharacteristic, text);
                            break;
                        } else if (this.subType == "Counter Incremental") {
                            var service = this.getService(eDomoticzServices.MeterDeviceService);
                            var wMeterDeviceCharacteristic = this.getCharacteristic(service, eDomoticzServices.CurrentConsumption);
                            var val8 = Helper.cleanFloat(message.svalue1);
                            callback(wMeterDeviceCharacteristic, val8);
                            break;
                        } else if (this.subType == "Lux") {
                            var service = this.getService(Service.LightSensor);
                            var lightSensorCharacteristic = this.getCharacteristic(service, Characteristic.CurrentAmbientLightLevel);
                            var val9 = Helper.cleanFloat(message.svalue1);
                            callback(lightSensorCharacteristic, val9);
                            break;
                        } else if (this.subType == "Waterflow") {
                            var service = this.getService(eDomoticzServices.WaterDeviceService);
                            var WaterMeterDeviceCharacteristic = this.getCharacteristic(service, eDomoticzServices.WaterFlow);
                            var newval8 = Helper.cleanFloat(message.svalue1);
                            callback(WaterMeterDeviceCharacteristic, newval8);
                        } else if (this.subType == "UVN128,UV138") {
                            var service = this.getService(eDomoticzServices.UVDeviceService);
                            var UVDeviceCharacteristic = this.getCharacteristic(service, eDomoticzServices.UVIndex);
                            var newval8 = Helper.cleanFloat(message.svalue1);
                            callback(UVDeviceCharacteristic, newval8);
                        } else if (this.subType == "Current") {
                            var service = this.getService(eDomoticzServices.AMPDeviceService);
                                var AMPDeviceCharacteristic = this.getCharacteristic(service, eDomoticzServices.Ampere);
                                var val11 = Helper.cleanFloat(message.svalue1);
                                callback(AMPDeviceCharacteristic, val11);
                                break;
                         } else if (this.subType == "Voltage") {
                            var service = this.getService(eDomoticzServices.VOLTDeviceService);
                                var VOLTDeviceCharacteristic = this.getCharacteristic(service, eDomoticzServices.Volt);
                                var val12 = Helper.cleanFloat(message.svalue1);
                                callback(VOLTDeviceCharacteristic, val12);
                                break;
                        } else {
                            var service = this.getService(eDomoticzServices.MeterDeviceService);
                            var dMeterDeviceCharacteristic = this.getCharacteristic(service, eDomoticzServices.CurrentConsumption);
                            var val10 = Helper.cleanFloat(message.svalue1);
                            callback(dMeterDeviceCharacteristic, val10);
                            break;
                        }
                    }
                    break;
                }
            case this.Type == "Air Quality":
                {
                    if ('undefined' !== typeof message.nvalue) {
                        var service = this.getService(Service.AirQualitySensor);
                        var airQualityServiceCharacteristic = this.getCharacteristic(service, Characteristic.AirParticulateDensity);
                        var airQual = Helper.cleanFloat(message.nvalue);
                        callback(airQualityServiceCharacteristic, airQual);
                    }
                    break;
                }
            case this.Type == "Wind":
                {
                    if ('undefined' !== typeof message.svalue5) {
                        var service = this.getService(Service.TemperatureSensor);
                        var temperatureSensorServiceCurrentCharacteristic = this.getCharacteristic(service, Characteristic.CurrentTemperature);
                        var tempCurr = Helper.cleanFloat(message.svalue5);
                        callback(temperatureSensorServiceCurrentCharacteristic, tempCurr);
                    }
                    if ('undefined' !== typeof message.svalue3) {
                        var service = this.getService(eDomoticzServices.WindDeviceService);
                        var windServiceWindSpeedCharacteristic = this.getCharacteristic(service, eDomoticzServices.WindSpeed);
                        var wspeed = Helper.cleanFloat(message.svalue3);
                        var newval1 = wspeed / 10;
                        callback(windServiceWindSpeedCharacteristic, newval1);
                    }
                    if ('undefined' !== typeof message.svalue6) {
                        var service = this.getService(eDomoticzServices.WindDeviceService);
                        var windServiceWindChillCharacteristic = this.getCharacteristic(service, eDomoticzServices.WindChill);
                        var windChill = Helper.cleanFloat(message.svalue6);
                        callback(windServiceWindChillCharacteristic, windChill);
                    }
                    if ('undefined' !== typeof message.svalue1) {
                        var service = this.getService(eDomoticzServices.WindDeviceService);
                        var windServiceWindDirectionCharacteristic = this.getCharacteristic(service, eDomoticzServices.WindDirection);
                        var windeg = Helper.cleanFloat(message.svalue1);
                        var winDeg = Math.round(windeg);
                        callback(windServiceWindDirectionCharacteristic, winDeg);
                    }
                    break;
                }
            case this.Type == "Rain":
                {
                    if ('undefined' !== typeof message.svalue1) {
                        var service = this.getService(eDomoticzServices.RainDeviceService);
                        var rainServiceCharacteristic = this.getCharacteristic(service, eDomoticzServices.Rainfall);
                        var rainfall = Helper.cleanFloat(message.svalue1);
                        callback(rainServiceCharacteristic, rainfall);
                    }
                    break;
                }
            case this.Type == "Humidity":
                {
                    if (typeof message.nvalue !== 'undefined') {
                        var service = this.getService(Service.HumiditySensor);
                        var characteristic = this.getCharacteristic(service, Characteristic.CurrentRelativeHumidity);
                        var humidity = Helper.oneDP(Helper.cleanFloat(message.nvalue));
                        callback(characteristic, humidity);
                    }
                    break;
                }
            case this.Type == "Temp" || this.Type == "Temp + Humidity":
                {
                    if ('undefined' !== typeof message.svalue1) {
                        var service = this.getService(Service.TemperatureSensor);
                        var temperatureSensorCharacteristic = this.getCharacteristic(service, Characteristic.CurrentTemperature);
                        var temperature = Helper.oneDP(Helper.cleanFloat(message.svalue1));
                        callback(temperatureSensorCharacteristic, temperature);
                        if (this.Type == "Temp + Humidity") {
                            var HumidityCharacteristic = this.getCharacteristic(service, Characteristic.CurrentRelativeHumidity);
                            var humidity = Helper.oneDP(Helper.cleanFloat(message.svalue2));
                            callback(HumidityCharacteristic, humidity);
                        }
                    }
                    break;
                }
            case this.Type == "Temp + Humidity + Baro":
                {
                    if ('undefined' !== typeof message.svalue1) {
                        var service = this.getService(eDomoticzServices.WeatherService);
                        var temperatureSensorCharacteristic = this.getCharacteristic(service, Characteristic.CurrentTemperature);
                        var temperature = Helper.cleanFloat(message.svalue1);
                        temperature = Helper.oneDP(temperature);
                        callback(temperatureSensorCharacteristic, temperature);
                    }
                    if ('undefined' !== typeof message.svalue2) {
                        var service = this.getService(eDomoticzServices.WeatherService);
                        var HumidityCharacteristic = this.getCharacteristic(service, Characteristic.CurrentRelativeHumidity);
                        var humidity = Helper.cleanFloat(message.svalue2);
                        humidity = Helper.oneDP(humidity);
                        callback(HumidityCharacteristic, humidity);
                    }
                    if ('undefined' !== typeof message.svalue4) {
                        var service = this.getService(eDomoticzServices.WeatherService);
                        var BarometerCharacteristic = this.getCharacteristic(service, eDomoticzServices.Barometer);
                        var pressure = Helper.cleanFloat(message.svalue4);
                        pressure = Math.ceil(pressure);
                        callback(BarometerCharacteristic, pressure);
                    }
                    break;
                }
            case this.Type == "P1 Smart Meter" || this.Type == "RFXMeter":
                {
                    if ('undefined' !== typeof message.svalue1) {
                        if (this.subType == "Gas") {
                            var service = this.getService(eDomoticzServices.GasDeviceService);
                            var P1GasMeterDeviceCharacteristic = this.getCharacteristic(service, eDomoticzServices.GasConsumption);
                            var newval6 = Helper.cleanFloat(message.svalue1);
                            newval6 = Helper.oneDP(newval6 / 1000);
                            callback(P1GasMeterDeviceCharacteristic, newval6);
                        } else if (this.subType == "kWh" || this.subType == "Energy") {
                            var service = this.getService(eDomoticzServices.MeterDeviceService);
                            var P1ElecMeterDeviceCharacteristic = this.getCharacteristic(service, eDomoticzServices.CurrentConsumption);
                            var newval7 = Helper.cleanFloat(message.svalue1);
                            callback(P1ElecMeterDeviceCharacteristic, newval7);
                        } else if (this.subType == "RFXMeter counter") {
                            var service = this.getService(eDomoticzServices.WaterDeviceService);
                            var RFXMeterDeviceCharacteristic = this.getCharacteristic(service, eDomoticzServices.WaterFlow);
                            var newval8 = Helper.cleanFloat(message.svalue1);
                            newval8 = Helper.oneDP(newval8 / 1000);
                            callback(RFXMeterDeviceCharacteristic, newval8);
                        }
                    }
                    break;
                }
            default:
                {
                    if (this.name.indexOf("Occupied") > -1) {
                        if ('undefined' !== typeof message.nvalue) {
                            var service = this.getService(Service.OccupancySensor);
                            var occServiceCharacteristic = this.getCharacteristic(service, Characteristic.OccupancyDetected);
                            callback(occServiceCharacteristic, message.nvalue);
                        }
                        break;
                    } else {
                        if ('undefined' !== typeof message.nvalue) {
                            var infoTextService = this.getService(eDomoticzServices.InfotextDeviceService);
                            if (infoTextService) {
                                var infoTextCharacteristic = this.getCharacteristic(infoTextService, eDomoticzServices.Infotext);
                                if (infoTextCharacteristic) {
                                    callback(infoTextCharacteristic, message.svalue1.toString());
                                }
                            }
                        }
                        break;
                    }
                }
            }
        }
    },
    getServices: function () {
        this.services = [];
        var informationService = this.getService(Service.AccessoryInformation);
        if (!informationService) {
            informationService = new Service.AccessoryInformation();
        }
        informationService.setCharacteristic(Characteristic.Manufacturer, "eDomoticz").setCharacteristic(Characteristic.Model, this.Type).setCharacteristic(Characteristic.SerialNumber, "Domoticz IDX " + this.idx);
        this.services.push(informationService);

        if ((this.Type == "P1 Smart Meter" && this.swTypeVal == 0 && this.subType == "Energy") || (this.Type == "P1 Smart Meter" && this.swTypeVal == 1 && this.subType == "Gas") || (this.Type == "General" && this.swTypeVal == 2 && this.subType == "Counter Incremental") || (this.name.indexOf("Occupied") > -1) || (this.Type == "General" && this.swTypeVal == 1 && this.subType == "Visibility") || (this.Type == "General" && this.swTypeVal === 0 && this.subType == "kWh") || (this.Type == "General" && this.subType == "Solar Radiation" && this.swTypeVal === 0) || (this.Type == "YouLess Meter" && this.swTypeVal === 0) || (this.name.indexOf("Location") > -1) || (this.Type == "RFXMeter")) {
            this.swTypeVal = false;
            this.isSwitch = false;
            //cludgey fix for a P1 SmartMeter Virtual Sensor being ID'd as a doorbell in Domoticz, and Incremental Counters being id'd as contact switches
            //and other Domoticz-generated oddities...
        }
        if (this.isSwitch) {
            switch (true) {
            case this.swTypeVal == Constants.DeviceTypeSwitch || this.swTypeVal == Constants.DeviceTypePushOn:
                {

                    var service = false;
                    if (this.image !== undefined && this.swTypeVal !== Constants.DeviceTypePushOn) {
                        if (this.image.indexOf("Fan") > -1) {
                            service = this.getService(Service.Fan);
                            if (!service) {
                                service = new Service.Fan(this.name);
                            }
                        } else if (this.image.indexOf("Light") > -1) {
                            service = this.getService(Service.Lightbulb);
                            if (!service) {
                                service = new Service.Lightbulb(this.name);
                            }
                        } else if (this.image.indexOf("WallSocket") > -1) {
                            service = this.getService(Service.Outlet);
                            if (!service) {
                                service = new Service.Outlet(this.name);
                            }
                        } else {
                            service = this.getService(Service.Switch);
                            if (!service) {
                                service = new Service.Switch(this.name);
                            }
                        }
                    } else {
                        service = this.getService(Service.Switch);
                        if (!service) {
                            service = new Service.Switch(this.name);
                        }
                    }
                    this.getCharacteristic(service, Characteristic.On).on('set', this.setPowerState.bind(this)).on('get', this.getPowerState.bind(this));
                    this.services.push(service);
                    break;
                }
            case this.swTypeVal == Constants.DeviceTypeContact:
            case this.swTypeVal == Constants.DeviceTypeDoorContact:
                {
                    var contactService = this.getService(Service.ContactSensor);
                    if (!contactService) {
                        contactService = new Service.ContactSensor(this.name);
                    }
                    this.getCharacteristic(contactService, Characteristic.ContactSensorState).on('get', this.getStringValue.bind(this));
                    this.services.push(contactService);
                    break;
                }
            case this.swTypeVal == Constants.DeviceTypeSmoke:
                {
                    var smokeService = this.getService(Service.SmokeSensor);
                    if (!smokeService) {
                        smokeService = new Service.SmokeSensor(this.name);
                    }
                    this.getCharacteristic(smokeService, Characteristic.SmokeDetected).on('get', this.getStringValue.bind(this));
                    if (this.batteryRef && this.batteryRef !== 255) { // if batteryRef == 255 we're running on mains
                        this.gracefullyAddCharacteristic(smokeService, Characteristic.StatusLowBattery).on('get', this.getLowBatteryStatus.bind(this));
                    }
                    this.services.push(smokeService);
                    break;
                }
            case this.swTypeVal == Constants.DeviceTypeDimmer:
            case this.swTypeVal == Constants.DeviceTypeMedia:
                {
                    var isFan = this.image && this.image.indexOf("Fan") > -1
                    var service = this.getService(isFan ? Service.Fan : Service.Lightbulb);
                    if (!service) {
                        service = isFan ? new Service.Fan(this.name) : new Service.Lightbulb(this.name);
                    }
                    this.getCharacteristic(service, Characteristic.On).on('set', this.setPowerState.bind(this)).on('get', this.getPowerState.bind(this));
                    if (isFan) {
                        service.getCharacteristic(Characteristic.RotationSpeed).setProps({
                            minValue: 0,
                            maxValue: 100
                        }).on('set', this.setdValue.bind(this)).on('get', this.getdValue.bind(this));
                    } else {
                        this.gracefullyAddCharacteristic(service, Characteristic.Brightness).on('set', this.setdValue.bind(this)).on('get', this.getdValue.bind(this));
                        if (this.subType == "RGBW" || this.subType == "RGBWW" || this.subType == "RGBWWZ") {
                            this.gracefullyAddCharacteristic(service, Characteristic.Hue).on('set', this.setHueValue.bind(this, 'Hue')).on('get', this.getHueValue.bind(this, 'Hue'));
                            this.gracefullyAddCharacteristic(service, Characteristic.Saturation).on('set', this.setHueValue.bind(this, 'Saturation')).on('get', this.getHueValue.bind(this, 'Saturation'));
                        }
                    }
                    this.services.push(service);
                    break;
                }
            case this.swTypeVal == Constants.DeviceTypeSelector:
                {
                    var selectorService = this.getService(Service.StatelessProgrammableSwitch);
                    if (!selectorService) {
                        selectorService = new Service.StatelessProgrammableSwitch(this.name);
                    }
                    this.getCharacteristic(selectorService, Characteristic.ProgrammableSwitchEvent).on('get', this.getSelectorValue.bind(this));
                    if (this.batteryRef && this.batteryRef !== 255) { // if batteryRef == 255 we're running on mains
                        this.gracefullyAddCharacteristic(selectorService, Characteristic.StatusLowBattery).on('get', this.getLowBatteryStatus.bind(this));
                    }
                    this.services.push(selectorService);
                    break;
                }

            case this.swTypeVal == Constants.DeviceTypeMotion:
                {
                    var motionService = this.getService(Service.MotionSensor);
                    if (!motionService) {
                        motionService = new Service.MotionSensor(this.name);
                    }
                    this.getCharacteristic(motionService, Characteristic.MotionDetected).on('get', this.getStringValue.bind(this));
                    if (this.batteryRef && this.batteryRef !== 255) { // if batteryRef == 255 we're running on mains
                        this.gracefullyAddCharacteristic(motionService, Characteristic.StatusLowBattery).on('get', this.getLowBatteryStatus.bind(this));
                    }
                    this.services.push(motionService);
                    break;
                }

            case this.swTypeVal == Constants.DeviceTypeDoorbell:
                {
                    var doorbellButtonService = this.getService(Service.StatelessProgrammableSwitch);
                    if (!doorbellButtonService) {
                        doorbellButtonService = new Service.StatelessProgrammableSwitch(this.name);
                    }
                    this.getCharacteristic(doorbellButtonService, Characteristic.ProgrammableSwitchEvent).on('get', this.getSelectorValue.bind(this));
		    			this.services.push(doorbellButtonService);

                    var doorbellSensorService = this.getService(Service.Doorbell);
                    if (!doorbellSensorService) {
                        doorbellSensorService = new Service.Doorbell(this.name);
                    }
                    this.getCharacteristic(doorbellSensorService, Characteristic.ProgrammableSwitchEvent).on('get', this.getDoorbellSensorValue.bind(this));
                    if (this.batteryRef && this.batteryRef !== 255) { // if batteryRef == 255 we're running on mains
                        this.gracefullyAddCharacteristic(doorbellSensorService, Characteristic.StatusLowBattery).on('get', this.getLowBatteryStatus.bind(this));
                    }
                    this.services.push(doorbellSensorService);
                    break;
                }
            case this.swTypeVal == Constants.DeviceTypeDoorLock:
                {
                    if (this.name.indexOf("garage") > -1) {
                        var garageService = this.getService(Service.GarageDoorOpener);
                        if (!garageService) {
                            garageService = new Service.GarageDoorOpener(this.name);
                        }
                        this.getCharacteristic(garageService, Characteristic.CurrentDoorState).on('get', this.getDoorStatus.bind(this));
                        this.getCharacteristic(garageService, Characteristic.TargetDoorState).on('get', this.getDoorStatus.bind(this)).on('set', this.setDoorStatus.bind(this));
                        //this.getCharacteristic(garageService, Characteristic.ObstructionDetected).on('get', this.getDoorStatus.bind(this));

                        this.services.push(garageService);
                        break;
                    } else {

                        var lockService = this.getService(Service.LockMechanism);
                        if (!lockService) {
                            lockService = new Service.LockMechanism(this.name);
                        }
                        this.getCharacteristic(lockService, Characteristic.LockCurrentState).on('get', this.getLockStatus.bind(this));
                        this.getCharacteristic(lockService, Characteristic.LockTargetState).on('get', this.getLockStatus.bind(this)).on('set', this.setLockStatus.bind(this));
                        this.services.push(lockService);
                        break;
                    }
                }
            case this.swTypeVal == Constants.DeviceTypeDoorLockInverted:
                {
                    if (this.name.indexOf("garage") > -1) {
                        var garageService = this.getService(Service.GarageDoorOpener);
                        if (!garageService) {
                            garageService = new Service.GarageDoorOpener(this.name);
                        }
                        this.getCharacteristic(garageService, Characteristic.CurrentDoorState).on('get', this.getDoorStatus.bind(this));
                        this.getCharacteristic(garageService, Characteristic.TargetDoorState).on('get', this.getDoorStatus.bind(this)).on('set', this.setDoorStatus.bind(this));
                        //this.getCharacteristic(garageService, Characteristic.ObstructionDetected).on('get', this.getDoorStatus.bind(this));

                        this.services.push(garageService);
                        break;
                    } else {

                        var lockService = this.getService(Service.LockMechanism);
                        if (!lockService) {
                            lockService = new Service.LockMechanism(this.name);
                        }
                        this.getCharacteristic(lockService, Characteristic.LockCurrentState).on('get', this.getLockStatus.bind(this));
                        this.getCharacteristic(lockService, Characteristic.LockTargetState).on('get', this.getLockStatus.bind(this)).on('set', this.setLockInvertedStatus.bind(this));
                        this.services.push(lockService);
                        break;
                    }
                }
            case this.swTypeVal == Constants.DeviceTypeBlinds:
            case this.swTypeVal == Constants.DeviceTypeBlindsInverted:
            case this.swTypeVal == Constants.DeviceTypeBlindsVenetianUS:
            case this.swTypeVal == Constants.DeviceTypeBlindsVenetianEU:
            case this.swTypeVal == Constants.DeviceTypeBlindsPercentage:
            case this.swTypeVal == Constants.DeviceTypeBlindsPercentageInverted:
                {
                    this.isInvertedBlind = (this.swTypeVal == Constants.DeviceTypeBlindsInverted || this.swTypeVal == Constants.DeviceTypeBlindsPercentageInverted);
                    this.isPercentageBlind = (this.swTypeVal == Constants.DeviceTypeBlindsPercentage || this.swTypeVal == Constants.DeviceTypeBlindsPercentageInverted);

                    var blindService = this.getService(Service.WindowCovering);
                    if (!blindService) {
                        blindService = new Service.WindowCovering(this.name);
                    }
                    this.getCharacteristic(blindService, Characteristic.CurrentPosition).on('get', this.getBlindStatus.bind(this));
                    this.getCharacteristic(blindService, Characteristic.TargetPosition).on('get', this.getBlindStatus.bind(this)).on('set', this.setBlindStatus.bind(this, blindService));
                    this.getCharacteristic(blindService, Characteristic.PositionState).on('get', this.getBlindPStatus.bind(this));
                    if (this.batteryRef && this.batteryRef !== 255) { // if batteryRef == 255 we're running on mains
                        this.gracefullyAddCharacteristic(blindService, Characteristic.StatusLowBattery).on('get', this.getLowBatteryStatus.bind(this));
                    }
                    this.services.push(blindService);
                    break;
                }
            case this.swTypeVal == Constants.DeviceTypeSecuritySystem:
                {
                    var securityService = this.getService(Service.SecuritySystem);
                    if (!securityService) {
                        securityService = new Service.SecuritySystem(this.name);
                    }
                    this.getCharacteristic(securityService, Characteristic.SecuritySystemCurrentState).on('get', this.getSecuritySystemStatus.bind(this));
                    this.getCharacteristic(securityService, Characteristic.SecuritySystemTargetState).on('get', this.getSecuritySystemStatus.bind(this)).on('set', this.setSecuritySystemStatus.bind(this, securityService));
                    this.services.push(securityService);
                    break;
                }

            default:
                break;
            }
        } else // Accessory is a sensor
        {
            switch (true) {
            case this.Type == "General" || this.Type == "RFXMeter" || this.Type == "YouLess Meter" || this.Type == "Current" || this.Type == "UV" || this.Type == "Usage" || this.Type == "Lux":
                {
                    if (this.subType == "kWh" || this.subType == "YouLess counter" || this.subType == "Electric") {
                        var MeterDeviceService = this.getService(eDomoticzServices.MeterDeviceService)
                        if (!MeterDeviceService) {
                            MeterDeviceService = new eDomoticzServices.MeterDeviceService(this.name);
                        }

                        this.getCharacteristic(MeterDeviceService, eDomoticzServices.CurrentConsumption).on('get', this.getCPower.bind(this));
                        if (this.subType == "kWh") {
                            this.getCharacteristic(MeterDeviceService, eDomoticzServices.TotalConsumption).on('get', this.getStringValue.bind(this));
                        } else if (this.subType == "YouLess counter") {
                            this.getCharacteristic(MeterDeviceService, eDomoticzServices.TotalConsumption).on('get', this.getYLTotalValue.bind(this));
                        }
                        if (this.subType !== "Electric") {
                            this.getCharacteristic(MeterDeviceService, eDomoticzServices.TodayConsumption).on('get', this.getYLTodayValue.bind(this));
                        }
                        this.services.push(MeterDeviceService);
                        break;
                    } else if (this.subType == "Percentage") {
                        var UsageDeviceService = this.getService(eDomoticzServices.UsageDeviceService);
                        if (!UsageDeviceService) {
                            UsageDeviceService = new eDomoticzServices.UsageDeviceService(this.name);
                        }
                        this.getCharacteristic(UsageDeviceService, eDomoticzServices.CurrentUsage).on('get', this.getStringValue.bind(this));
                        this.services.push(UsageDeviceService);
                        break;
                    } else if (this.subType == "Visibility") {
                        var VisibilityDeviceService = this.getService(eDomoticzServices.VisibilityDeviceService);
                        if (!VisibilityDeviceService) {
                            VisibilityDeviceService = new eDomoticzServices.VisibilityDeviceService(this.name);
                        }
                        this.getCharacteristic(VisibilityDeviceService, eDomoticzServices.Visibility).on('get', this.getStringValue.bind(this));
                        this.services.push(VisibilityDeviceService);
                        break;
                    } else if (this.subType == "Solar Radiation" || this.subType == "UVN800") {
                        var SolRadDeviceService = this.getService(eDomoticzServices.SolRadDeviceService);
                        if (!SolRadDeviceService) {
                            SolRadDeviceService = new eDomoticzServices.SolRadDeviceService(this.name);
                        }
                        this.getCharacteristic(SolRadDeviceService, eDomoticzServices.SolRad).on('get', this.getStringValue.bind(this));
                        this.services.push(SolRadDeviceService);
                        break;
                    } else if ((this.subType) == "Text" && (this.name.indexOf("Location") > -1)) {
                        var LocationDeviceService = this.getService(eDomoticzServices.LocationService);
                        if (!LocationDeviceService) {
                            LocationDeviceService = new eDomoticzServices.LocationService(this.name);
                        }
                        this.getCharacteristic(LocationDeviceService, eDomoticzServices.Location).on('get', this.getStringValue.bind(this));
                        this.services.push(LocationDeviceService);
                        break;
                    } else if (this.subType == "Counter Incremental") {
                        var wMeterDeviceService = this.getService(eDomoticzServices.MeterDeviceService);
                        if (!wMeterDeviceService) {
                            wMeterDeviceService = new eDomoticzServices.MeterDeviceService(this.name);
                        }
                        this.getCharacteristic(wMeterDeviceService, eDomoticzServices.CurrentConsumption).on('get', this.getStringValue.bind(this));
                        this.services.push(wMeterDeviceService);
                        break;
                    } else if (this.subType == "Lux") {
                        var lightSensorService = this.getService(Service.LightSensor);
                        if (!lightSensorService) {
                            lightSensorService = new Service.LightSensor(this.name);
                        }
                        this.getCharacteristic(lightSensorService, Characteristic.CurrentAmbientLightLevel).on('get', this.getStringValue.bind(this));
                        this.services.push(lightSensorService);
                        break;
                    } else if (this.subType == "RFXMeter counter" || this.subType == "Waterflow") {
                        var WaterMeterService = this.getService(eDomoticzServices.WaterDeviceService);
                        if (!WaterMeterService) {
                            WaterMeterService = new eDomoticzServices.WaterDeviceService(this.name);
                        }
                        this.getCharacteristic(WaterMeterService, eDomoticzServices.WaterFlow).on('get', this.getStringValue.bind(this));
                        if (this.subType == "RFXMeter counter") {
                            this.getCharacteristic(WaterMeterService, eDomoticzServices.TotalWaterFlow).on('get', this.getYLTodayValue.bind(this));
                        }
                        this.services.push(WaterMeterService);
                        break;
                    } else if (this.subType == "UVN128,UV138") {
                        var UVservice = this.getService(eDomoticzServices.UVDeviceService);
                        if (!UVservice) {
                            UVservice = new eDomoticzServices.UVDeviceService(this.name);
                        }
                        this.getCharacteristic(UVservice, eDomoticzServices.UVIndex).on('get', this.getStringValue.bind(this));
                        this.services.push(UVservice);
                        break;
                    } else if (this.subType == "Current") {
                        var AMPDeviceService = this.getService(eDomoticzServices.AMPDeviceService);
                        if (!AMPDeviceService) {
                            AMPDeviceService = new eDomoticzServices.AMPDeviceService(this.name);
                        }
                        this.getCharacteristic(AMPDeviceService, eDomoticzServices.Ampere).on('get', this.getStringValue.bind(this));
                        this.services.push(AMPDeviceService);
                        break;
                     } else if (this.subType == "Voltage") {
                        var VOLTDeviceService = this.getService(eDomoticzServices.VOLTDeviceService);
                        if (!VOLTDeviceService) {
                            VOLTDeviceService = new eDomoticzServices.VOLTDeviceService(this.name);
                        }
                        this.getCharacteristic(VOLTDeviceService, eDomoticzServices.Volt).on('get', this.getStringValue.bind(this));
                        this.services.push(VOLTDeviceService);
                        break;
                    } else {
                        var dMeterDeviceService = this.getService(eDomoticzServices.MeterDeviceService);
                        if (!dMeterDeviceService) {
                            dMeterDeviceService = new eDomoticzServices.MeterDeviceService(this.name);
                        }
                        this.getCharacteristic(dMeterDeviceService, eDomoticzServices.CurrentConsumption).on('get', this.getStringValue.bind(this));
                        this.services.push(dMeterDeviceService);
                        break;
                    }
                    break;
                }
            case this.Type == "Humidity":
                {
                    var service = this.getService(Service.HumiditySensor)
                    if (!service) {
                        service = new Service.HumiditySensor(this.name);
                    }
                    this.getCharacteristic(service, Characteristic.CurrentRelativeHumidity).on('get', this.getHumidity.bind(this));
                    this.services.push(service);
                    break;
                }
            case this.Type == "Temp" || this.Type == "Temp + Humidity" || this.Type == "Temp + Humidity + Baro":
                {
                    var temperatureSensorService = ((this.Type == "Temp + Humidity + Baro") ? this.getService(eDomoticzServices.WeatherService) : this.getService(Service.TemperatureSensor));
                    if (!temperatureSensorService) {
                        temperatureSensorService = ((this.Type == "Temp + Humidity + Baro") ? new eDomoticzServices.WeatherService(this.name) : new Service.TemperatureSensor(this.name));
                    }
                    this.getCharacteristic(temperatureSensorService, Characteristic.CurrentTemperature).on('get', this.getTemperature.bind(this));
                    this.getCharacteristic(temperatureSensorService, Characteristic.CurrentTemperature).setProps({
                        minValue: -50
                    });
                    if (this.Type == "Temp + Humidity" || this.Type == "Temp + Humidity + Baro") {
                        this.gracefullyAddCharacteristic(temperatureSensorService, Characteristic.CurrentRelativeHumidity).on('get', this.getHumidity.bind(this));
                        if (this.Type == "Temp + Humidity + Baro") {
                            this.gracefullyAddCharacteristic(temperatureSensorService, eDomoticzServices.Barometer).on('get', this.getPressure.bind(this));
                        }
                    }
                    if (this.batteryRef && this.batteryRef !== 255) {
                        this.gracefullyAddCharacteristic(temperatureSensorService, Characteristic.StatusLowBattery).on('get', this.getLowBatteryStatus.bind(this));
                    }
                    this.services.push(temperatureSensorService);
                    break;
                }
            case this.Type == "Air Quality":
                {
                    var airQualityService = this.getService(Service.AirQualitySensor);
                    if (!airQualityService) {
                        airQualityService = new Service.AirQualitySensor(this.name);
                    }
                    this.getCharacteristic(airQualityService, Characteristic.AirQuality).on('get', this.getQualValue.bind(this));
                    var airParticulateDensityCharacteristic = this.getCharacteristic(airQualityService, Characteristic.AirParticulateDensity);
                    if (!airParticulateDensityCharacteristic) {
                        airQualityService.addOptionalCharacteristic(Characteristic.AirParticulateDensity);
                        airParticulateDensityCharacteristic = this.getCharacteristic(airQualityService, Characteristic.AirParticulateDensity);
                    }
                    airParticulateDensityCharacteristic.on('get', this.getValue.bind(this));
                    this.services.push(airQualityService);
                    break;
                }
            case this.Type == "Wind":
                {
                    var windService = this.getService(eDomoticzServices.WindDeviceService);
                    if (!windService) {
                        windService = new eDomoticzServices.WindDeviceService(this.name);
                    }
                    this.getCharacteristic(windService, eDomoticzServices.WindSpeed).on('get', this.getWindSpeed.bind(this));
                    this.getCharacteristic(windService, eDomoticzServices.WindChill).on('get', this.getWindChill.bind(this));
                    this.getCharacteristic(windService, eDomoticzServices.WindDirection).on('get', this.getWindDirection.bind(this));
                    this.services.push(windService);

		    			var temperatureSensorService = this.getService(Service.TemperatureSensor);
		    			if (!temperatureSensorService) {
		    				temperatureSensorService = new Service.TemperatureSensor(this.name);
		    			}

		    			this.getCharacteristic(temperatureSensorService, Characteristic.CurrentTemperature).on('get', this.getTemperature.bind(this));
                    this.getCharacteristic(temperatureSensorService, Characteristic.CurrentTemperature).setProps({
                        minValue: -50
                    });
		    			this.services.push(temperatureSensorService);
                    break;
                }
            case this.Type == "Rain":
                {
                    var rainService = this.getService(eDomoticzServices.RainDeviceService);
                    if (!rainService) {
                        rainService = new eDomoticzServices.RainDeviceService(this.name);
                    }
                    this.getCharacteristic(rainService, eDomoticzServices.Rainfall).on('get', this.getRainfall.bind(this));
                    this.services.push(rainService);
                    break;
                }
            case this.Type == "Heating" || this.Type == "Thermostat":
                {
                    var HeatingDeviceService = this.getService(Service.Thermostat);
                    if (!HeatingDeviceService) {
                        HeatingDeviceService = new Service.Thermostat(this.name);
                    }
                    this.getCharacteristic(HeatingDeviceService, Characteristic.CurrentHeatingCoolingState).on('get', this.getState.bind(this));
                    this.getCharacteristic(HeatingDeviceService, Characteristic.TargetHeatingCoolingState).on('get', this.getState.bind(this));
                    // If this is an HGI80, get the current temperature slightly differently
                    if (this.hwType == Constants.DeviceTypeHoneywellHGI80) {
                        this.getCharacteristic(HeatingDeviceService, Characteristic.CurrentTemperature).on('get', this.getTemperatureAlternative.bind(this));
                    } else {
                        this.getCharacteristic(HeatingDeviceService, Characteristic.CurrentTemperature).on('get', this.getTemperature.bind(this));
                    }
                    this.getCharacteristic(HeatingDeviceService, Characteristic.TargetTemperature).on('get', this.getTemperature.bind(this)).on('set', this.setPoint.bind(this));
                    this.getCharacteristic(HeatingDeviceService, Characteristic.TargetTemperature).setProps({
                        minValue: 4
                    });
                    if (this.subType == "Zone") {
                        this.gracefullyAddCharacteristic(HeatingDeviceService, eDomoticzServices.TempOverride).on('set', this.setTempOverride.bind(this)).on('get', this.getTempOverride.bind(this));
                    }
                    this.services.push(HeatingDeviceService);
                    break;
                }
            case this.Type == "P1 Smart Meter":
                {
                    if (this.subType == "Gas") {
                        var P1GasMeterDeviceService = this.getService(eDomoticzServices.GasDeviceService);
                        if (!P1GasMeterDeviceService) {
                            P1GasMeterDeviceService = new eDomoticzServices.GasDeviceService(this.name);
                        }
                        this.getCharacteristic(P1GasMeterDeviceService, eDomoticzServices.GasConsumption).on('get', this.getStringValue.bind(this));
                        this.services.push(P1GasMeterDeviceService);
                    } else if (this.subType == "kWh" || this.subType == "Energy") {
                        var P1ElecMeterDeviceService = this.getService(eDomoticzServices.MeterDeviceService);
                        if (!P1ElecMeterDeviceService) {
                            P1ElecMeterDeviceService = new eDomoticzServices.MeterDeviceService(this.name);
                        }
                        this.getCharacteristic(P1ElecMeterDeviceService, eDomoticzServices.CurrentConsumption).on('get', this.getCPower.bind(this));
                        this.getCharacteristic(P1ElecMeterDeviceService, eDomoticzServices.TotalConsumption).on('get', this.getStringValue.bind(this));
                        this.getCharacteristic(P1ElecMeterDeviceService, eDomoticzServices.TodayConsumption).on('get', this.getYLTodayValue.bind(this));
                        this.services.push(P1ElecMeterDeviceService);
                    }
                    break;
                }
            default:
                {
                    if (this.name.indexOf("Occupied") > -1) {
                        var occServiceB = this.getService(Service.OccupancySensor);
                        if (!occServiceB) {
                            occServiceB = new Service.OccupancySensor(this.name);
                        }
                        this.getCharacteristic(occServiceB, Characteristic.OccupancyDetected).on('get', this.getPowerState.bind(this));
                        this.services.push(occServiceB);
                        break;
                    } else {
                        var infotextService = this.getService(eDomoticzServices.InfotextDeviceService);
                        if (!infotextService) {
                            infotextService = new eDomoticzServices.InfotextDeviceService(this.name);
                        }
                        this.getCharacteristic(infotextService, eDomoticzServices.Infotext).on('get', this.getStringValue.bind(this));
                        this.services.push(infotextService);
                        break;
                    }
                }
            }
        }
        return this.services;
    }
};
