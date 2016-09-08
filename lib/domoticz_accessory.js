var request = require("request");
var Constants = require('./constants.js');
var Helper = require('./helper.js').Helper;
var baserequest;
var eDomoticzServices = require('./services.js').eDomoticzServices;
module.exports = eDomoticzAccessory;

function eDomoticzAccessory(log, server, port, IsScene, status, idx, name, haveDimmer, maxDimLevel, subType, Type, batteryRef, authorizationToken, swType, swTypeVal, prot, hwType, eve) {
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
	this.log = log;
	this.server = server;
	this.port = port;
	this.IsScene = IsScene; // Domoticz Scenes ignored for now...
	this.status = status;
	this.idx = idx;
	this.name = name;
	this.eve = eve;
	this.subType = subType;
	this.swType = swType;
	this.swTypeVal = swTypeVal;
	this.isSwitch = (typeof this.swTypeVal !== 'undefined' && this.swTypeVal >= 0 && this.name.indexOf("Occupied") == -1);
	this.Type = Type;
	this.batteryRef = batteryRef;
	this.CounterToday = 1;
	this.onValue = "On";
	this.offValue = "Off";
	this.param = "switchlight";
	this.access_url = prot + this.server + ":" + this.port + "/json.htm?";
	this.control_url = this.access_url + "type=command&param=" + this.param + "&idx=" + this.idx;
	this.status_url = this.access_url + "type=devices&rid=" + this.idx;
	this.requestHeaders = {};
	if (authorizationToken) {
		this.requestHeaders['Authorization'] = 'Basic ' + authorizationToken;
	}
	if (prot == "https://"){
		baserequest = request.defaults({
			header: this.requestHeaders,
			agentOptions: {
			  rejectUnauthorized: false
			},
			json: true
		});
	} else {
		baserequest = request.defaults({
			header: this.requestHeaders,
			json:true
		});
	}

	// Initialize default values, e.g. to get the "factor"
	var voidCallback = function() {};
	switch (true) {
	case this.swTypeVal == Constants.DeviceTypeDimmer:
	case this.swTypeVal == Constants.DeviceTypeBlindsPercentage:
	case this.swTypeVal == Constants.DeviceTypeBlindsPercentageInverted:
		{
			this.getdValue(voidCallback);
			break;
		}
	default:
		break;
	}
}
eDomoticzAccessory.prototype = {
	identify: function(callback) {
		callback();
	},
	getService: function(name) {
		for (var index in this.services) {
			var service = this.services[index];
			if (typeof name === 'string' && (service.displayName === name || service.name === name || service.subtype === name)) return service;
			else if (typeof name === 'function' && ((service instanceof name) || (name.UUID === service.UUID))) return service;
		}
	},
	setPowerState: function(powerOn, callback, context) {
		if (context && context == "eDomoticz-MQTT") {
			callback();
			return;
		}
		var url = this.control_url + "&switchcmd=" + (powerOn ? "On" : "Off");
		request.put({
			url: url,
			header: this.requestHeaders
		}, function(err, response) {
			if (err) {
				this.log("There was a problem sending command to" + this.name);
				this.log(response);
			} else {
				this.log(this.name + " sent " + (powerOn ? "on" : "off") + " command succesfully");
			}
			callback();
		}.bind(this));
	},
	getPowerState: function(callback) {
		baserequest.get({
			url: this.status_url
		}, function(err, response, json) {
			if (!err && response.statusCode == 200) {
				var value;
				if (json.result !== undefined) {
					var sArray = Helper.sortByKey(json.result, "Name");
					sArray.map(function(s) {
						value = (s.Status == "Off") ? 0 : 1;
					}.bind(this));
				}
				this.log("Data Received for " + this.name + ": " + value);
				callback(null, value);
			} else {
				this.log("There was a problem connecting to Domoticz.");
			}
		}.bind(this));
	},
	getRainfall: function(callback) {
		baserequest.get({
			url: this.status_url
		}, function(err, response, json) {
			if (!err && response.statusCode == 200) {
				var value;
				if (json.result !== undefined) {
					var sArray = Helper.sortByKey(json.result, "Name");
					sArray.map(function(s) {
						value = Helper.cleanFloat(s.Rain);
					}.bind(this));
				}
				this.log("Data Received for " + this.name + ": " + value);
				callback(null, value);
			} else {
				this.log("There was a problem connecting to Domoticz.");
			}
		}.bind(this));
	},
	setdValue: function(level, callback, context) {
		if (context && context == "eDomoticz-MQTT") {
			callback();
			return;
		}
		if (!(this.factor)) {
			baserequest.get({
				url: this.status_url
			}, function(err, response, json) {
				if (!err && response.statusCode == 200) {
					if (json.result !== undefined) {
						var sArray = Helper.sortByKey(json.result, "Name");
						sArray.map(function(s) {
							this.factor = 100 / s.MaxDimLevel;
						}.bind(this));
					}
				} else {
					this.log("There was a problem connecting to Domoticz.");
				}
			}.bind(this));
		}
		var dim = (level / this.factor == 15) ? 16 : level / this.factor;
		var url = this.control_url + "&switchcmd=Set%20Level&level=" + dim;
		baserequest.put({
			url: url
		}, function(err, response) {
			if (err) {
				this.log("There was a problem sending command to" + this.name);
				this.log(response);
			} else {
				this.log(this.name + " sent command succesfully");
			}
			callback();
		}.bind(this));
	},
	getdValue: function(callback) {
		baserequest.get({
			url: this.status_url
		}, function(err, response, json) {
			if (!err && response.statusCode == 200) {
				var value;
				if (json.result !== undefined) {
					var sArray = Helper.sortByKey(json.result, "Name");
					sArray.map(function(s) {
						if (s.Status == "Off") {
							value = 0;
						} else {
							value = s.LevelInt;
							this.factor = 100 / s.MaxDimLevel;
							value = value * this.factor;
						}
					}.bind(this));
				}
				this.log("Data Received for " + this.name + ": " + value);
				callback(null, value);
			} else {
				this.log("There was a problem connecting to Domoticz.");
			}
		}.bind(this));
	},
	getHueValue: function(type, callback) {
		// TODO: Wait for Domoticz to add RGB/HSB status to their lights. Return last known value or 'white' for now.
		if (type == 'Hue') {
			callback(null, (this.hueValue !== undefined ? this.hueValue : 0));
		} else if (type == 'Saturation') {
			callback(null, (this.saturationValue !== undefined ? this.saturationValue : 0));
		} else {
			callback(null, 0);
		}
	},
	setHueValue: function(type, value, callback, context) {
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
			var parameters = "&hue=" + this.hueValue + "&brightness=100&sat=" + this.saturationValue + "&iswhite=" + (this.saturationValue < 3 && this.hueValue < 3 ? "true" : "false");
			var url = this.control_url.replace(this.param, "setcolbrightnessvalue") + parameters;
			this.hueSemaphore = undefined;
			baserequest.put({
				url: url
			}, function(err, response) {
				if (err) {
					this.log("There was a problem sending command to" + this.name);
					this.log(response);
				} else {
					this.log(this.name + " sent command succesfully");
				}
				callback();
			}.bind(this));
		} else {
			callback();
		}
	},
	getValue: function(callback) {
		baserequest.get({
			url: this.status_url
		}, function(err, response, json) {
			if (!err && response.statusCode == 200) {
				var value;
				if (json.result !== undefined) {
					var sArray = Helper.sortByKey(json.result, "Name");
					sArray.map(function(s) {
						value = Helper.cleanFloat(s.Data);
						value = Helper.oneDP(value);
					}.bind(this));
				}
				this.log("Data Received for " + this.name + ": " + value);
				callback(null, value);
			} else {
				this.log("There was a problem connecting to Domoticz.");
			}
		}.bind(this));
	},
	getQualValue: function(callback) {
		baserequest.get({
			url: this.status_url
		}, function(err, response, json) {
			if (!err && response.statusCode == 200) {
				var value;
				if (json.result !== undefined) {
					var sArray = Helper.sortByKey(json.result, "Name");
					sArray.map(function(s) {
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
						case "Inferior":
							{
								value = Characteristic.AirQuality.INFERIOR;
								break;
							}
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
				}
				this.log("Data Received for " + this.name + ": " + value);
				callback(null, value);
			} else {
				this.log("There was a problem connecting to Domoticz.");
			}
		}.bind(this));
	},
	getStringValue: function(callback) {
		baserequest.get({
			url: this.status_url
		}, function(err, response, json) {
			if (!err && response.statusCode == 200) {
				var value;
				if (json.result !== undefined) {
					var sArray = Helper.sortByKey(json.result, "Name");
					sArray.map(function(s) {
						if (s.SwitchTypeVal == 2) { //contact
							if (s.Data == "Closed") {
								value = Characteristic.ContactSensorState.CONTACT_DETECTED;
							} else {
								value = Characteristic.ContactSensorState.CONTACT_NOT_DETECTED;
							}
						} else if (s.SwitchTypeVal == 5) { //smoke
							if (s.Data == "Off" || s.Data == "Normal") {
								value = Characteristic.SmokeDetected.SMOKE_NOT_DETECTED;
							} else {
								value = Characteristic.SmokeDetected.SMOKE_DETECTED;
							}
						} else if (s.SwitchTypeVal == 8) { //motion
							if (s.Data == "Off") {
								value = false;
							} else {
								value = true;
							}
						} else if (this.Type == "Lux") { //Lux
							value = parseInt(s.Data, 10);
						} else if (this.name.indexOf("Gas") > -1 && this.Type == "General" && this.subType == "kWh") {
							value = Helper.cleanFloat(s.Data);
						} else if (this.subType == "Percentage" || this.subType == "kWh" || this.subType == "Energy" || this.subType == "Solar Radiation" || this.subType == "UVN800" || this.subType == "Visibility") {
							value = (s.Counter !== undefined) ? Helper.cleanFloat(s.Counter) : Helper.cleanFloat(s.Data);
						} else if (this.subType == "Text") {
							value = s.Data.toString();
							value = encodeURIComponent(value);
						} else {
							value = s.Data.toString();
							value = encodeURIComponent(value);
						}
					}.bind(this));
				}
				this.log("Data Received for " + this.name + ": " + value);
				callback(null, value);
			} else {
				this.log("There was a problem connecting to Domoticz.");
			}
		}.bind(this));
	},
	getYLTodayValue: function(callback) {
		baserequest.get({
			url: this.status_url
		}, function(err, response, json) {
			if (!err && response.statusCode == 200) {
				var value;
				if (json.result !== undefined) {
					var sArray = Helper.sortByKey(json.result, "Name");
					sArray.map(function(s) {
						value = Helper.cleanFloat(s.CounterToday);
					}.bind(this));
				}
				this.log("Data Received for " + this.name + ": " + value);
				callback(null, value);
			} else {
				this.log("There was a problem connecting to Domoticz.");
			}
		}.bind(this));
	},
	getYLTotalValue: function(callback) {
		baserequest.get({
			url: this.status_url
		}, function(err, response, json) {
			if (!err && response.statusCode == 200) {
				var value;
				if (json.result !== undefined) {
					var sArray = Helper.sortByKey(json.result, "Name");
					sArray.map(function(s) {
						value = Helper.cleanFloat(s.Counter);
					}.bind(this));
				}
				this.log("Data Received for " + this.name + ": " + value);
				callback(null, value);
			} else {
				this.log("There was a problem connecting to Domoticz.");
			}
		}.bind(this));
	},
	getWindSpeed: function(callback) {
		baserequest.get({
			url: this.status_url
		}, function(err, response, json) {
			if (!err && response.statusCode == 200) {
				var value;
				if (json.result !== undefined) {
					var sArray = Helper.sortByKey(json.result, "Name");
					sArray.map(function(s) {
						value = Helper.cleanFloat(s.Speed);
						value = Helper.oneDP(value);
					}.bind(this));
				}
				this.log("Data Received for " + this.name + ": " + value);
				callback(null, value);
			} else {
				this.log("There was a problem connecting to Domoticz.");
			}
		}.bind(this));
	},
	getWindChill: function(callback) {
		baserequest.get({
			url: this.status_url
		}, function(err, response, json) {
			if (!err && response.statusCode == 200) {
				var value;
				if (json.result !== undefined) {
					var sArray = Helper.sortByKey(json.result, "Name");
					sArray.map(function(s) {
						value = Helper.cleanFloat(s.Chill);
						value = Helper.oneDP(value);
					}.bind(this));
				}
				this.log("Data Received for " + this.name + ": " + value);
				callback(null, value);
			} else {
				this.log("There was a problem connecting to Domoticz.");
			}
		}.bind(this));
	},
	getWindDirection: function(callback) {
		baserequest.get({
			url: this.status_url
		}, function(err, response, json) {
			if (!err && response.statusCode == 200) {
				var value;
				if (json.result !== undefined) {
					var sArray = Helper.sortByKey(json.result, "Name");
					sArray.map(function(s) {
						value = s.Direction.toString() + " (" + s.DirectionStr.toString() + ")";
					}.bind(this));
				}
				this.log("Data Received for " + this.name + ": " + value);
				callback(null, value);
			} else {
				this.log("There was a problem connecting to Domoticz.");
			}
		}.bind(this));
	},
	getCPower: function(callback) {
		baserequest.get({
			url: this.status_url
		}, function(err, response, json) {
			if (!err && response.statusCode == 200) {
				var value;
				if (json.result !== undefined) {
					var sArray = Helper.sortByKey(json.result, "Name");
					sArray.map(function(s) {
						value = (this.Type == "Usage" && this.subType == "Electric") ? Helper.cleanFloat(s.Data) : Helper.cleanFloat(s.Usage);
					}.bind(this));
				}
				this.log("Data Received for " + this.name + ": " + value);
				callback(null, value);
			} else {
				this.log("There was a problem connecting to Domoticz.");
			}
		}.bind(this));
	},
	getState: function(callback) {
		value = 1;
		this.log("Static Data for " + this.name + ": " + value);
		callback(null, value);
	},
	getTemperature: function(callback) {
		baserequest.get({
			url: this.status_url
		}, function(err, response, json) {
			if (!err && response.statusCode == 200) {
				var value;
				if (json.result !== undefined) {
					var sArray = Helper.sortByKey(json.result, "Name");
					sArray.map(function(s) {
						var heat = (this.subType == "Zone") ? true : false;
						var therm = (this.subType == "SetPoint") ? true : false;
						value = ((heat) || (therm)) ? Helper.oneDP(Helper.cleanFloat(s.SetPoint)) : Helper.oneDP(Helper.cleanFloat(s.Temp));
					}.bind(this));
				}
				this.log("Data Received for " + this.name + ": " + value);
				callback(null, value);
			} else {
				this.log("There was a problem connecting to Domoticz.");
			}
		}.bind(this));
	},
	setPoint: function(setpoint, callback, context) {
		if (context && context == "eDomoticz-MQTT") {
			callback();
			return;
		}
		var url = "";
		if (this.subType == "SetPoint") {
			url = this.access_url + "type=command&param=udevice&idx=" + this.idx;
			url = url + "&nvalue=0&svalue=" + setpoint;
		} else if (this.subType == "Zone") {
			url = this.access_url + "type=setused&idx=" + this.idx + "&setpoint=";
			url = url + setpoint + "&mode=PermanentOverride&used=true";
		}
		this.log("Setting thermostat SetPoint to " + setpoint);
		baserequest.put({
			url: url
		}, function(err, response) {
			if (err) {
				this.log("There was a problem sending command to" + this.name);
				this.log(response);
			} else {
				this.log(this.name + " sent command succesfully");
			}
			callback(null, setpoint);
		}.bind(this));
	},
	setTempOverride: function(setuntil, callback, context) {
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
		baserequest.get({
			url: this.status_url
		}, function(err, response, json) {
			if (!err && response.statusCode == 200) {
				var value;
				if (json.result !== undefined) {
					var sArray = Helper.sortByKey(json.result, "Name");
					sArray.map(function(s) {
						var heat = (this.Type == "Heating" && this.subType == "Zone") ? true : false;
						var therm = (this.Type == "Thermostat" && this.subType == "SetPoint") ? true : false;
						temp = (heat || therm) ? Helper.oneDP(Helper.cleanFloat(s.SetPoint)) : Helper.oneDP(Helper.cleanFloat(s.Temp));
						url = this.access_url + "type=setused&idx=" + this.idx + "&setpoint=";
						url = url + temp + "&mode=" + mode;
						url = (mode == "TemporaryOverride") ? url + "&until=" + isonow + "&used=true" : url + "&used=true";
						this.log("Setting thermostat SetPoint to " + temp + ", mode to " + mode);
						baserequest.put({
							url: url
						}, function(err, response) {
							if (err) {
								this.log("There was a problem sending command to" + this.name);
								this.log(response);
							} else {
								this.log(this.name + " sent command succesfully");
							}
							callback(null, setuntil);
						}.bind(this));
					}.bind(this));
				}
			} else {
				this.log("There was a problem connecting to Domoticz.");
				callback();
			}
		}.bind(this));
	},
	getTempOverride: function(callback) {
		baserequest.get({
			url: this.status_url
		}, function(err, response, json) {
			if (!err && response.statusCode == 200) {
				var value;
				if (json.result !== undefined) {
					var sArray = Helper.sortByKey(json.result, "Name");
					sArray.map(function(s) {
						var d1 = new Date(s.Until);
						var now = new Date().getTime();
						var diff = d1 - now;
						value = (diff / (60 * 1000));
					}.bind(this));
				}
				this.log("Data Received for " + this.name + ": " + value);
				callback(null, value);
			} else {
				this.log("There was a problem connecting to Domoticz.");
			}
		}.bind(this));
	},
	getHumidity: function(callback) {
		baserequest.get({
			url: this.status_url
		}, function(err, response, json) {
			if (!err && response.statusCode == 200) {
				var value;
				if (json.result !== undefined) {
					var sArray = Helper.sortByKey(json.result, "Name");
					sArray.map(function(s) {
						value = Helper.cleanFloat(s.Humidity);
						value = Helper.oneDP(value);
					}.bind(this));
				}
				this.log("Data Received for " + this.name + ": " + value);
				callback(null, value);
			} else {
				this.log("There was a problem connecting to Domoticz.");
			}
		}.bind(this));
	},
	getPressure: function(callback) {
		baserequest.get({
			url: this.status_url
		}, function(err, response, json) {
			if (!err && response.statusCode == 200) {
				var value;
				if (json.result !== undefined) {
					var sArray = Helper.sortByKey(json.result, "Name");
					sArray.map(function(s) {
						var val = Helper.cleanFloat(s.Barometer);
						val = Math.ceil(val);
						value = val;
					}.bind(this));
				}
				this.log("Data Received for " + this.name + ": " + value);
				callback(null, value);
			} else {
				this.log("There was a problem connecting to Domoticz.");
			}
		}.bind(this));
	},
	getLowBatteryStatus: function(callback) {
		baserequest.get({
			url: this.status_url
		}, function(err, response, json) {
			if (!err && response.statusCode == 200) {
				var value;
				if (json.result !== undefined) {
					var sArray = Helper.sortByKey(json.result, "Name");
					sArray.map(function(s) {
						value = Helper.cleanFloat(s.BatteryLevel);
					}.bind(this));
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
	getBlindStatus: function(callback) {
		if (this.isPercentageBlind) {
			this.getdValue(callback);
			return;
		}
		baserequest.get({
			url: this.status_url
		}, function(err, response, json) {
			if (!err && response.statusCode == 200) {
				var value;
				if (json.result !== undefined) {
					var sArray = Helper.sortByKey(json.result, "Name");
					sArray.map(function(s) {
						value = s.Data.toString();
					}.bind(this));
				}
				if (value == "Open") {
					callback(null, 100);
				} else {
					callback(null, 0);
				}
			} else {
				this.log("There was a problem connecting to Domoticz.");
			}
		}.bind(this));
	},
	setBlindStatus: function(blindService, pos, callback, context) {
		if (context && context == "eDomoticz-MQTT") {
			callback();
			return;
		}
		var url = "";
		var shouldOpen = (pos <= 50);
		if (this.isInvertedBlind) {
			shouldOpen = !shouldOpen;
		}
		var command = (shouldOpen ? "On" : "Off");
		if (this.isPercentageBlind && pos > 0 && pos < 100) {
			this.setdValue(pos, function() {
				blindService.getCharacteristic(Characteristic.CurrentPosition).setValue(pos, false, this);
				callback();
			});
			return;
		}
		url = this.control_url + "&switchcmd=" + command;
		baserequest.put({
			url: url
		}, function(err, response) {
			if (err) {
				this.log("There was a problem sending command to" + this.name);
				this.log(response);
			} else {
				this.log(this.name + " sent command succesfully");
			}
			callback();
			blindService.getCharacteristic(Characteristic.CurrentPosition).setValue(pos, false, this);
		}.bind(this));
	},
	getBlindPStatus: function(callback) {
		callback(null, Characteristic.PositionState.STOPPED);
	},
	getLockStatus: function(callback) {
		baserequest.get({
			url: this.status_url
		}, function(err, response, json) {
			if (!err && response.statusCode == 200) {
				var value;
				if (json.result !== undefined) {
					var sArray = Helper.sortByKey(json.result, "Name");
					sArray.map(function(s) {
						value = (s.Data == "Open") ? Characteristic.LockCurrentState.UNSECURED : Characteristic.LockCurrentState.SECURED;
					}.bind(this));
				}
				this.log("Data Received for " + this.name + ": " + value);
				callback(null, value);
			} else {
				this.log("There was a problem connecting to Domoticz.");
			}
		}.bind(this));
	},
	setLockStatus: function(doorstate, callback, context) {
		if (context && context == "eDomoticz-MQTT") {
			callback();
			return;
		}
		var command = (doorstate == Characteristic.LockTargetState.UNSECURED) ? "On" : "Off";
		var url = this.control_url + "&switchcmd=" + command;
		baserequest.put({
			url: url
		}, function(err, response) {
			if (err) {
				this.log("There was a problem sending command to" + this.name);
				this.log(response);
			} else {
				this.log(this.name + " sent command succesfully");
			}
			callback();
		}.bind(this));
	},
	handleMQTTMessage: function(message, callback) {
		this.log("MQTT Message received for %s.\nName:\t\t%s\nDevice:\t\t%s,%s\nIs Switch:\t%s\nSwitchTypeVal:\t%s\nMQTT Message:\n%s", this.name, this.name, this.Type, this.subType, this.isSwitch, this.swTypeVal, JSON.stringify(message, null, 4));
		if ((this.Type == "P1 Smart Meter" && this.swTypeVal == 0 && this.subType == "Energy") || (this.Type == "P1 Smart Meter" && this.swTypeVal == 1 && this.subType == "Gas") || (this.Type == "General" && this.swTypeVal == 2 && this.subType == "Counter Incremental") || (this.name.indexOf("Occupied") > -1) || (this.Type == "General" && this.swTypeVal == 1 && this.subType == "Visibility") || (this.Type == "General" && this.swTypeVal === 0 && this.subType == "kWh") || (this.Type == "General" && this.subType == "Solar Radiation" && this.swTypeVal === 0) || (this.Type == "YouLess Meter" && this.swTypeVal === 0) || (this.name.indexOf("Location") > -1)) {
			this.swTypeVal = false;
			this.isSwitch = false;
			//cludgey fix for a P1 SmartMeter Virtual Sensor being ID'd as a doorbell in Domoticz, and Incremental COunters being id'd as contact switches
			//and other such Domoticz-generated oddities
		}
		if (this.isSwitch) {
			switch (true) {
			case this.swTypeVal == Constants.DeviceTypeSwitch:
			case this.swTypeVal == Constants.DeviceTypeMedia:	
				{
					if (this.name.indexOf("Fan") > -1) {
						var characteristic = this.getService(Service.Fan).getCharacteristic(Characteristic.On);
						callback(characteristic, message.nvalue);
					} else {
						var characteristic2 = this.getService(Service.Switch).getCharacteristic(Characteristic.On);
						callback(characteristic2, message.nvalue);
					}
					break;
				}
			case this.swTypeVal == Constants.DeviceTypeSmoke:
				{
					var characteristic3 = this.getService(Service.SmokeSensor).getCharacteristic(Characteristic.SmokeDetected);
					callback(characteristic3, message.nvalue);
					break;
				}
			case this.swTypeVal == Constants.DeviceTypeDimmer:
				{
					var service = this.getService(Service.Lightbulb);
					var powerCharacteristic = service.getCharacteristic(Characteristic.On);
					var brightnessCharacteristic = service.getCharacteristic(Characteristic.Brightness);
					var isOn = (message.nvalue > 0);
					callback(powerCharacteristic, isOn);
					if (isOn && this.factor) {
						var brightness = message.svalue1 * this.factor;
						if (brightness > 0) {
							callback(brightnessCharacteristic, brightness);
						}
					}
					break;
				}
			case this.swTypeVal == Constants.DeviceTypeMotion:
				{
					var characteristic4 = this.getService(Service.MotionSensor).getCharacteristic(Characteristic.MotionDetected);
					callback(characteristic4, message.nvalue);
					break;
				}
			case this.swTypeVal == Constants.DeviceTypeDoorLock:
				{
					var service = this.getService(Service.LockMechanism);
					var doorCurrentChar = service.getCharacteristic(Characteristic.LockTargetState);
					var doorcmd = (parseInt(message.nvalue) == 1) ? Characteristic.LockTargetState.UNSECURED : Characteristic.LockTargetState.SECURED;
					callback(doorCurrentChar, doorcmd);
					var doorTargetChar = service.getCharacteristic(Characteristic.LockCurrentState);
					callback(doorTargetChar, doorcmd);
					break;
				}
			case this.swTypeVal == Constants.DeviceTypeBlinds:
			case this.swTypeVal == Constants.DeviceTypeBlindsInverted:
			case this.swTypeVal == Constants.DeviceTypeBlindsPercentage:
			case this.swTypeVal == Constants.DeviceTypeBlindsPercentageInverted:
				{
					var position = 0;
					if (this.isPercentageBlind && message.nvalue > 1) {
						position = message.svalue1 * this.factor;
					} else {
						position = (message.nvalue == 1 ? 0 : 100);
						if (this.isInvertedBlind) {
							position = 100 - position;
						}
					}
					var currentPositionCharacteristic = this.getService(Service.WindowCovering).getCharacteristic(Characteristic.CurrentPosition);
					var targetPositionCharacteristic = this.getService(Service.WindowCovering).getCharacteristic(Characteristic.TargetPosition);
					callback(currentPositionCharacteristic, position);
					callback(targetPositionCharacteristic, position);
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
								var CurrentConsumptionCharacteristic = this.getService(eDomoticzServices.MeterDeviceService).getCharacteristic(eDomoticzServices.CurrentConsumption);
								var ccc = Helper.cleanFloat(message.svalue1);
								callback(CurrentConsumptionCharacteristic, ccc);
								if ('undefined' !== typeof message.svalue2) {
									var TotalConsumptionCharacteristic = this.getService(eDomoticzServices.MeterDeviceService).getCharacteristic(eDomoticzServices.TotalConsumption);
									var val1 = Helper.cleanFloat(message.svalue2);
									val1 = val1/1000;
									callback(TotalConsumptionCharacteristic, val1);
								}
							} else if (this.subType == "YouLess counter") {
								if ('undefined' !== typeof message.svalue2) {
									var CurrentConsumptionCharacteristic2 = this.getService(eDomoticzServices.MeterDeviceService).getCharacteristic(eDomoticzServices.CurrentConsumption);
									var newval2 = Helper.cleanFloat(message.svalue2);
									callback(CurrentConsumptionCharacteristic2, newval2);
								}
								var TotalConsumptionCharacteristic2 = this.getService(eDomoticzServices.MeterDeviceService).getCharacteristic(eDomoticzServices.TotalConsumption);
								var newval = Helper.oneDP(Helper.cleanFloat(message.svalue1) / 1000);
								callback(TotalConsumptionCharacteristic2, newval);
							}
							if (this.name.indexOf('Gas')<1 && this.subType !== "Electric" && this.subType !== "YouLess counter" && this.subType !== "Energy") {
								if ('undefined' !== typeof message.svalue2) {
									var TodayConsumptionCharacteristic3 = this.getService(eDomoticzServices.MeterDeviceService).getCharacteristic(eDomoticzServices.TodayConsumption);
									var val3 = Helper.cleanFloat(message.svalue2);
									callback(TodayConsumptionCharacteristic3, val3);
								}
							}
							break;
						} else if (this.subType == "Percentage") {
							var UsageDeviceCharacteristic = this.getService(eDomoticzServices.UsageDeviceService).getCharacteristic(eDomoticzServices.CurrentUsage);
							var val4 = Helper.cleanFloat(message.svalue1);
							callback(UsageDeviceCharacteristic, val4);
							break;
						} else if (this.subType == "Visibility") {
							var VisibilityDeviceCharacteristic = this.getService(eDomoticzServices.VisibilityDeviceService).getCharacteristic(eDomoticzServices.Visibility);
							var val5 = Helper.cleanFloat(message.svalue1);
							callback(VisibilityDeviceCharacteristic, val5);
							break;
						} else if (this.subType == "Solar Radiation" || this.subType == "UVN800") {
							var SolRadDeviceCharacteristic = this.getService(eDomoticzServices.SolRadDeviceService).getCharacteristic(eDomoticzServices.SolRad);
							var val6 = Helper.cleanFloat(message.svalue1);
							callback(SolRadDeviceCharacteristic, val6);
							break;
						} else if ((this.subType) == "Text" && (this.name.indexOf('Location') > -1)) {
							var LocationDeviceCharacteristic = this.getService(eDomoticzServices.LocationService).getCharacteristic(Characteristic.Version);
							var text = message.svalue1.toString();
							callback(LocationDeviceCharacteristic, text);
							break;
						} else if (this.subType == "Counter Incremental") {
							var wMeterDeviceCharacteristic = this.getService(eDomoticzServices.MeterDeviceService).getCharacteristic(eDomoticzServices.CurrentConsumption);
							var val8 = Helper.cleanFloat(message.svalue1);
							callback(wMeterDeviceCharacteristic, val8);
							break;
						} else if (this.subType == "Lux") {
							var lightSensorCharacteristic = this.getService(Service.LightSensor).getCharacteristic(Characteristic.CurrentAmbientLightLevel);
							var val9 = Helper.cleanFloat(message.svalue1);
							callback(lightSensorCharacteristic, val9);
							break;
						} else {
							var dMeterDeviceCharacteristic = this.getService(eDomoticzServices.MeterDeviceService).getCharacteristic(eDomoticzServices.CurrentConsumption);
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
						var airQualityServiceCharacteristic = this.getService(Service.AirQualitySensor).getCharacteristic(Characteristic.AirParticulateDensity);
						var airQual = Helper.cleanFloat(message.nvalue);
						callback(airQualityServiceCharacteristic, airQual);
					}
					break;
				}
			case this.Type == "Wind":
				{
					if ('undefined' !== typeof message.svalue5) {
						var windServiceCurrentCharacteristic = this.getService(eDomoticzServices.WindDeviceService).getCharacteristic(Characteristic.CurrentTemperature);
						var windCurr = Helper.cleanFloat(message.svalue5);
						callback(windServiceCurrentCharacteristic, windCurr);
					}
					if ('undefined' !== typeof message.svalue3) {
						var windServiceWindSpeedCharacteristic = this.getService(eDomoticzServices.WindDeviceService).getCharacteristic(eDomoticzServices.WindSpeed);
						var wspeed = Helper.cleanFloat(message.svalue3);
						var newval1 = wspeed / 10;
						callback(windServiceWindSpeedCharacteristic, newval1);
					}
					if ('undefined' !== typeof message.svalue6) {
						var windServiceWindChillCharacteristic = this.getService(eDomoticzServices.WindDeviceService).getCharacteristic(eDomoticzServices.WindChill);
						var windChill = Helper.cleanFloat(message.svalue6);
						callback(windServiceWindChillCharacteristic, windChill);
					}
					if ('undefined' !== typeof message.svalue1) {
						var windServiceWindDirectionCharacteristic = this.getService(eDomoticzServices.WindDeviceService).getCharacteristic(eDomoticzServices.WindDirection);
						var windeg = Helper.cleanFloat(message.svalue1);
						var winDeg = Math.round(windeg);
						callback(windServiceWindDirectionCharacteristic, winDeg);
					}
					break;
				}
			case this.Type == "Rain":
				{
					if ('undefined' !== typeof message.svalue1) {
						var rainServiceCharacteristic = this.getService(eDomoticzServices.RainDeviceService).getCharacteristic(eDomoticzServices.Rainfall);
						var rainfall = Helper.cleanFloat(message.svalue1);
						callback(rainServiceCharacteristic, rainfall);
					}
					break;
				}
			case this.Type == "Temp" || this.Type == "Temp + Humidity":
				{
					if ('undefined' !== typeof message.svalue1) {
						var temperatureSensorCharacteristic = this.getService(Service.TemperatureSensor).getCharacteristic(Characteristic.CurrentTemperature);
						var temperature = Helper.oneDP(Helper.cleanFloat(message.svalue1));
						callback(temperatureSensorCharacteristic, temperature);
						if (this.Type == "Temp + Humidity" || this.Type == "Temp + Humidity + Baro") {
							var HumidityCharacteristic = this.getService(Service.TemperatureSensor).getCharacteristic(Characteristic.CurrentRelativeHumidity);
							var humidity = Helper.oneDP(Helper.cleanFloat(message.svalue2));
							callback(HumidityCharacteristic, humidity);
							if (this.Type == "Temp + Humidity + Baro") {
								var BarometerCharacteristic = this.getService(Service.TemperatureSensor).getCharacteristic(eDomoticzServices.Barometer);
								var pressure = Helper.oneDP(Helper.cleanFloat(message.svalue4));
								callback(BarometerCharacteristic, pressure);
							}
						}
					}
					break;
				}
			case this.Type == "Temp + Humidity + Baro":
				{
					if ('undefined' !== typeof message.svalue1) {
						var temperatureSensorCharacteristic = this.getService(eDomoticzServices.WeatherService).getCharacteristic(Characteristic.CurrentTemperature);
						var temperature = Helper.cleanFloat(message.svalue1);
						temperature = Helper.oneDP(temperature);
						callback(temperatureSensorCharacteristic, temperature);
					}
					if ('undefined' !== typeof message.svalue2) {
						var HumidityCharacteristic = this.getService(eDomoticzServices.WeatherService).getCharacteristic(Characteristic.CurrentRelativeHumidity);
						var humidity = Helper.cleanFloat(message.svalue2);
						humidity = Helper.oneDP(humidity);
						callback(HumidityCharacteristic, humidity);
					}
					if ('undefined' !== typeof message.svalue4) {
						var BarometerCharacteristic = this.getService(eDomoticzServices.WeatherService).getCharacteristic(eDomoticzServices.Barometer);
						var pressure = Helper.cleanFloat(message.svalue4);
						pressure = Math.ceil(pressure);
						callback(BarometerCharacteristic, pressure);
					}
					break;
				}
			case this.Type == "P1 Smart Meter":
				{
					if ('undefined' !== typeof message.svalue1) {
						if (this.subType == "Gas") {
							var P1GasMeterDeviceCharacteristic = this.getService(eDomoticzServices.GasDeviceService).getCharacteristic(eDomoticzServices.GasConsumption);
							var newval6 = Helper.cleanFloat(message.svalue1);
							newval6 = Helper.oneDP(newval6 / 1000);
							callback(P1GasMeterDeviceCharacteristic, newval6);
						} else if (this.subType == "kWh" || this.subType == "Energy") {
							var P1ElecMeterDeviceCharacteristic = this.getService(eDomoticzServices.MeterDeviceService).getCharacteristic(eDomoticzServices.CurrentConsumption);
							var newval7 = Helper.cleanFloat(message.svalue1);
							callback(P1ElecMeterDeviceCharacteristic, newval7);
						}
					}
					break;
				}
			default:
				{
					if (this.name.indexOf("Occupied") > -1) {
						if ('undefined' !== typeof message.nvalue) {
							var occServiceCharacteristic = this.getService(Service.OccupancySensor).getCharacteristic(Characteristic.OccupancyDetected);
							callback(occServiceCharacteristic, message.nvalue);
						}
						break;
					} else {
						if ('undefined' !== typeof message.nvalue) {
							var infoTextService = this.getService(eDomoticzServices.InfotextDeviceService);
							if (infoTextService) {
								var infoTextCharacteristic = infoTextService.getCharacteristic(eDomoticzServices.Infotext);
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
	getServices: function() {
		this.services = [];
		var informationService = new Service.AccessoryInformation();
		informationService.setCharacteristic(Characteristic.Manufacturer, "eDomoticz").setCharacteristic(Characteristic.Model, this.Type).setCharacteristic(Characteristic.SerialNumber, "DomDev" + this.idx);
		this.services.push(informationService);
		if ((this.Type == "P1 Smart Meter" && this.swTypeVal == 0 && this.subType == "Energy") || (this.Type == "P1 Smart Meter" && this.swTypeVal == 1 && this.subType == "Gas") || (this.Type == "General" && this.swTypeVal == 2 && this.subType == "Counter Incremental") || (this.name.indexOf("Occupied") > -1) || (this.Type == "General" && this.swTypeVal == 1 && this.subType == "Visibility") || (this.Type == "General" && this.swTypeVal === 0 && this.subType == "kWh") || (this.Type == "General" && this.subType == "Solar Radiation" && this.swTypeVal === 0) || (this.Type == "YouLess Meter" && this.swTypeVal === 0) || (this.name.indexOf("Location") > -1)) {
			this.swTypeVal = false;
			this.isSwitch = false;
			//cludgey fix for a P1 SmartMeter Virtual Sensor being ID'd as a doorbell in Domoticz, and Incremental Counters being id'd as contact switches
			//and other Domoticz-generated oddities...
		}
		if (this.isSwitch) {
			switch (true) {
			case this.swTypeVal == Constants.DeviceTypeSwitch:
			case this.swTypeVal == Constants.DeviceTypePushOn:
			case this.swTypeVal == Constants.DeviceTypeMedia:
				{
					var service = false;
					if (this.name.indexOf("Fan") > -1) {
						service = new Service.Fan(this.name);
					} else {
						service = new Service.Switch(this.name);
					}
					service.getCharacteristic(Characteristic.On).on('set', this.setPowerState.bind(this)).on('get', this.getPowerState.bind(this));
					this.services.push(service);
					break;
				}
			case this.swTypeVal == Constants.DeviceTypeContact:
				{
					var contactService = new Service.ContactSensor(this.name);
					contactService.getCharacteristic(Characteristic.ContactSensorState).on('get', this.getStringValue.bind(this));
					this.services.push(contactService);
					break;
				}
			case this.swTypeVal == Constants.DeviceTypeSmoke:
				{
					var smokeService = new Service.SmokeSensor(this.name);
					smokeService.getCharacteristic(Characteristic.SmokeDetected).on('get', this.getStringValue.bind(this));
					if (this.batteryRef && this.batteryRef !== 255) { // if batteryRef == 255 we're running on mains
						smokeService.addCharacteristic(new Characteristic.StatusLowBattery()).on('get', this.getLowBatteryStatus.bind(this));
					}
					this.services.push(smokeService);
					break;
				}
			case this.swTypeVal == Constants.DeviceTypeDimmer:
				{
					var lightbulbService = new Service.Lightbulb(this.name);
					lightbulbService.getCharacteristic(Characteristic.On).on('set', this.setPowerState.bind(this)).on('get', this.getPowerState.bind(this));
					lightbulbService.addCharacteristic(new Characteristic.Brightness()).on('set', this.setdValue.bind(this)).on('get', this.getdValue.bind(this));
					if (this.subType == "RGBW") {
						lightbulbService.addCharacteristic(new Characteristic.Hue()).on('set', this.setHueValue.bind(this, 'Hue')).on('get', this.getHueValue.bind(this, 'Hue'));
						lightbulbService.addCharacteristic(new Characteristic.Saturation()).on('set', this.setHueValue.bind(this, 'Saturation')).on('get', this.getHueValue.bind(this, 'Saturation'));
					}
					this.services.push(lightbulbService);
					break;
				}
			case this.swTypeVal == Constants.DeviceTypeMotion:
				{
					var motionService = new Service.MotionSensor(this.name);
					motionService.getCharacteristic(Characteristic.MotionDetected).on('get', this.getStringValue.bind(this));
					if (this.batteryRef && this.batteryRef !== 255) { // if batteryRef == 255 we're running on mains
						motionService.addCharacteristic(new Characteristic.StatusLowBattery()).on('get', this.getLowBatteryStatus.bind(this));
					}
					this.services.push(motionService);
					break;
				}
			case this.swTypeVal == Constants.DeviceTypeDoorLock:
				{
					var lockService = new Service.LockMechanism(this.name);
					lockService.getCharacteristic(Characteristic.LockCurrentState).on('get', this.getLockStatus.bind(this));
					lockService.getCharacteristic(Characteristic.LockTargetState).on('get', this.getLockStatus.bind(this)).on('set', this.setLockStatus.bind(this));
					this.services.push(lockService);
					break;
				}
			case this.swTypeVal == Constants.DeviceTypeBlinds:
			case this.swTypeVal == Constants.DeviceTypeBlindsInverted:
			case this.swTypeVal == Constants.DeviceTypeBlindsPercentage:
			case this.swTypeVal == Constants.DeviceTypeBlindsPercentageInverted:
				{
					this.isInvertedBlind = (this.swTypeVal == Constants.DeviceTypeBlindsInverted || this.swTypeVal == Constants.DeviceTypeBlindsPercentageInverted);
					this.isPercentageBlind = (this.swTypeVal == Constants.DeviceTypeBlindsPercentage || this.swTypeVal == Constants.DeviceTypeBlindsPercentageInverted);
					var blindService = new Service.WindowCovering(this.name);
					blindService.getCharacteristic(Characteristic.CurrentPosition).on('get', this.getBlindStatus.bind(this));
					blindService.getCharacteristic(Characteristic.TargetPosition).on('get', this.getBlindStatus.bind(this)).on('set', this.setBlindStatus.bind(this, blindService));
					blindService.getCharacteristic(Characteristic.PositionState).on('get', this.getBlindPStatus.bind(this));
					if (this.batteryRef && this.batteryRef !== 255) { // if batteryRef == 255 we're running on mains
						blindService.addCharacteristic(new Characteristic.StatusLowBattery()).on('get', this.getLowBatteryStatus.bind(this));
					}
					this.services.push(blindService);
					break;
				}
			default:
				break;
			}
		} else // Accessory is a sensor
		{
			switch (true) {
			case this.Type == "General" || this.Type == "YouLess Meter" || this.Type == "Current" || this.Type == "UV" || this.Type == "Usage" || this.Type == "Lux":
				{
					if (this.subType == "kWh" || this.subType == "YouLess counter" || this.subType == "Electric") {
						var MeterDeviceService = new eDomoticzServices.MeterDeviceService(this.name);
						MeterDeviceService.getCharacteristic(eDomoticzServices.CurrentConsumption).on('get', this.getCPower.bind(this));
						if (this.subType == "kWh") {
							MeterDeviceService.getCharacteristic(eDomoticzServices.TotalConsumption).on('get', this.getStringValue.bind(this));
						} else if (this.subType == "YouLess counter") {
							MeterDeviceService.getCharacteristic(eDomoticzServices.TotalConsumption).on('get', this.getYLTotalValue.bind(this));
						}
						if (this.subType !== "Electric") {
							MeterDeviceService.getCharacteristic(eDomoticzServices.TodayConsumption).on('get', this.getYLTodayValue.bind(this));
						}
						this.services.push(MeterDeviceService);
						break;
					} else if (this.subType == "Percentage") {
						var UsageDeviceService = new eDomoticzServices.UsageDeviceService(this.name);
						UsageDeviceService.getCharacteristic(eDomoticzServices.CurrentUsage).on('get', this.getStringValue.bind(this));
						this.services.push(UsageDeviceService);
						break;
					} else if (this.subType == "Visibility") {
						var VisibilityDeviceService = new eDomoticzServices.VisibilityDeviceService(this.name);
						VisibilityDeviceService.getCharacteristic(eDomoticzServices.Visibility).on('get', this.getStringValue.bind(this));
						this.services.push(VisibilityDeviceService);
						break;
					} else if (this.subType == "Solar Radiation" || this.subType == "UVN800") {
						var SolRadDeviceService = new eDomoticzServices.SolRadDeviceService(this.name);
						SolRadDeviceService.getCharacteristic(eDomoticzServices.SolRad).on('get', this.getStringValue.bind(this));
						this.services.push(SolRadDeviceService);
						break;
					} else if ((this.subType) == "Text" && (this.name.indexOf("Location") > -1)) {
						var LocationDeviceService = new eDomoticzServices.LocationService(this.name);
						LocationDeviceService.getCharacteristic(eDomoticzServices.Location).on('get', this.getStringValue.bind(this));
						this.services.push(LocationDeviceService);
						break;
					} else if (this.subType == "Counter Incremental") {
						var wMeterDeviceService = new eDomoticzServices.MeterDeviceService(this.name);
						wMeterDeviceService.getCharacteristic(eDomoticzServices.CurrentConsumption).on('get', this.getStringValue.bind(this));
						this.services.push(wMeterDeviceService);
						break;
					} else if (this.subType == "Lux") {
						var lightSensorService = new Service.LightSensor(this.name);
						lightSensorService.getCharacteristic(Characteristic.CurrentAmbientLightLevel).on('get', this.getStringValue.bind(this));
						this.services.push(lightSensorService);
						break;
					} else {
						var dMeterDeviceService = new eDomoticzServices.MeterDeviceService(this.name);
						dMeterDeviceService.getCharacteristic(eDomoticzServices.CurrentConsumption).on('get', this.getStringValue.bind(this));
						this.services.push(dMeterDeviceService);
						break;
					}
					break;
				}
			case this.Type == "Temp" || this.Type == "Temp + Humidity" || this.Type == "Temp + Humidity + Baro":
				{
					var temperatureSensorService = (this.Type == "Temp + Humidity + Baro") ? new eDomoticzServices.WeatherService(this.name) : new Service.TemperatureSensor(this.name);
					temperatureSensorService.getCharacteristic(Characteristic.CurrentTemperature).on('get', this.getTemperature.bind(this));
					temperatureSensorService.getCharacteristic(Characteristic.CurrentTemperature).setProps({
						minValue: -50
					});
					if (this.Type == "Temp + Humidity" || this.Type == "Temp + Humidity + Baro") {
						temperatureSensorService.addCharacteristic(new Characteristic.CurrentRelativeHumidity()).on('get', this.getHumidity.bind(this));
						if (this.Type == "Temp + Humidity + Baro") {
							temperatureSensorService.addCharacteristic(new eDomoticzServices.Barometer()).on('get', this.getPressure.bind(this));
						}
					}
					if (this.batteryRef && this.batteryRef !== 255) {
						temperatureSensorService.addCharacteristic(new Characteristic.StatusLowBattery()).on('get', this.getLowBatteryStatus.bind(this));
					}
					this.services.push(temperatureSensorService);
					break;
				}
			case this.Type == "Air Quality":
				{
					var airQualityService = new Service.AirQualitySensor(this.name);
					airQualityService.getCharacteristic(Characteristic.AirQuality).on('get', this.getQualValue.bind(this));
					airQualityService.getCharacteristic(Characteristic.AirParticulateDensity).on('get', this.getValue.bind(this));
					this.services.push(airQualityService);
					break;
				}
			case this.Type == "Wind":
				{
					var windService = new eDomoticzServices.WindDeviceService(this.name);
					windService.getCharacteristic(Characteristic.CurrentTemperature).on('get', this.getTemperature.bind(this));
					windService.getCharacteristic(eDomoticzServices.WindSpeed).on('get', this.getWindSpeed.bind(this));
					windService.getCharacteristic(eDomoticzServices.WindChill).on('get', this.getWindChill.bind(this));
					windService.getCharacteristic(eDomoticzServices.WindDirection).on('get', this.getWindDirection.bind(this));
					this.services.push(windService);
					break;
				}
			case this.Type == "Rain":
				{
					var rainService = new eDomoticzServices.RainDeviceService(this.name);
					rainService.getCharacteristic(eDomoticzServices.Rainfall).on('get', this.getRainfall.bind(this));
					this.services.push(rainService);
					break;
				}
			case this.Type == "Heating" || this.Type == "Thermostat":
				{
					var HeatingDeviceService = new Service.Thermostat(this.name);
					HeatingDeviceService.getCharacteristic(Characteristic.CurrentHeatingCoolingState).on('get', this.getState.bind(this));
					HeatingDeviceService.getCharacteristic(Characteristic.TargetHeatingCoolingState).on('get', this.getState.bind(this));
					HeatingDeviceService.getCharacteristic(Characteristic.CurrentTemperature).on('get', this.getTemperature.bind(this));
					HeatingDeviceService.getCharacteristic(Characteristic.TargetTemperature).on('get', this.getTemperature.bind(this)).on('set', this.setPoint.bind(this));
					HeatingDeviceService.getCharacteristic(Characteristic.TargetTemperature).setProps({
						minValue: 4
					});
					if (this.subType == "Zone") {
						HeatingDeviceService.addCharacteristic(new eDomoticzServices.TempOverride()).on('set', this.setTempOverride.bind(this)).on('get', this.getTempOverride.bind(this));
					}
					this.services.push(HeatingDeviceService);
					break;
				}
			case this.Type == "P1 Smart Meter":
				{
					if (this.subType == "Gas") {
						var P1GasMeterDeviceService = new eDomoticzServices.GasDeviceService("Gas Usage");
						P1GasMeterDeviceService.getCharacteristic(eDomoticzServices.GasConsumption).on('get', this.getStringValue.bind(this));
						this.services.push(P1GasMeterDeviceService);
					} else if (this.subType == "kWh" || this.subType == "Energy") {
						var P1ElecMeterDeviceService = new eDomoticzServices.MeterDeviceService("Power Usage");
						P1ElecMeterDeviceService.getCharacteristic(eDomoticzServices.CurrentConsumption).on('get', this.getCPower.bind(this));
						P1ElecMeterDeviceService.getCharacteristic(eDomoticzServices.TotalConsumption).on('get', this.getStringValue.bind(this));
						P1ElecMeterDeviceService.getCharacteristic(eDomoticzServices.TodayConsumption).on('get', this.getYLTodayValue.bind(this));
						this.services.push(P1ElecMeterDeviceService);
					}
					break;
				}
			default:
				{
					if (this.name.indexOf("Occupied") > -1) {
						var occServiceB = new Service.OccupancySensor(this.name);
						occServiceB.getCharacteristic(Characteristic.OccupancyDetected).on('get', this.getPowerState.bind(this));
						this.services.push(occServiceB);
						break;
					} else {
						var infotextService = new eDomoticzServices.InfotextDeviceService(this.name);
						infotextService.getCharacteristic(eDomoticzServices.Infotext).on('get', this.getStringValue.bind(this));
						this.services.push(infotextService);
						break;
					}
				}
			}
		}
		return this.services;
	}
};
