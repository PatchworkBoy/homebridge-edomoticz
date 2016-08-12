var request = require("request");
var Constants = require('./constants.js');
var Helper = require('./helper.js').Helper;
var eDomoticzServices = require('./services.js').eDomoticzServices;
module.exports = eDomoticzAccessory;

function eDomoticzAccessory(log, server, port, IsScene, status, idx, name, haveDimmer, maxDimLevel, subType, Type, batteryRef, auth, swType, swTypeVal, prot, hwType) {
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
	this.authstr = (auth) ? auth : '';
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
				'Authorization': 'Basic ' + that.authstr
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
				'Authorization': 'Basic ' + that.authstr
			},
			json: true
		}, function(err, response, json) {
			if (!err && response.statusCode == 200) {
				var value;
				if (json.result !== undefined) {
					var sArray = Helper.sortByKey(json.result, "Name");
					sArray.map(function(s) {
						value = (s.Status == "Off") ? 0 : 1;
					});
				}
				that.log("Data Received for " + that.name + ": " + value);
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
				'Authorization': 'Basic ' + that.authstr
			},
			json: true
		}, function(err, response, json) {
			if (!err && response.statusCode == 200) {
				var value;
				if (json.result !== undefined) {
					var sArray = Helper.sortByKey(json.result, "Name");
					sArray.map(function(s) {
						value = s.Rain + "mm";
					});
				}
				that.log("Data Received for " + that.name + ": " + value);
				callback(null, value);
			} else {
				that.log("There was a problem connecting to Domoticz.");
			}
		}.bind(this));
	},
	setdValue: function(level, callback) {
		var url, that = this;
		if (!(that.factor)) {
			request.get({
				url: that.status_url,
				header: {
					'Authorization': 'Basic ' + that.authstr
				},
				json: true
			}, function(err, response, json) {
				if (!err && response.statusCode == 200) {
					if (json.result !== undefined) {
						var sArray = Helper.sortByKey(json.result, "Name");
						sArray.map(function(s) {
							that.factor = 100 / s.MaxDimLevel;
						});
					}
				} else {
					that.log("There was a problem connecting to Domoticz.");
				}
			});
		}
		var dim = (level / that.factor == 15) ? 16 : level / that.factor;
		url = that.control_url + "&switchcmd=Set%20Level&level=" + dim;
		request.put({
			url: url,
			header: {
				'Authorization': 'Basic ' + that.authstr
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
				'Authorization': 'Basic ' + that.authstr
			},
			json: true
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
							that.factor = 100 / s.MaxDimLevel;
							value = value * that.factor;
						}
					});
				}
				that.log("Data Received for " + that.name + ": " + value);
				callback(null, value);
			} else {
				that.log("There was a problem connecting to Domoticz.");
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
	setHueValue: function(type, value, callback) {
		var that = this;
		if (type == 'Hue') {
			that.hueValue = value;
			that.hueSemaphore = (that.hueSemaphore === undefined ? 0 : that.hueSemaphore + 1);
		} else if (type == 'Saturation') {
			that.saturationValue = value;
			that.hueSemaphore = (that.hueSemaphore === undefined ? 0 : that.hueSemaphore + 1);
		}
		if (that.hueValue !== undefined && that.saturationValue !== undefined && that.hueSemaphore !== undefined && that.hueSemaphore > 0) {
			var parameters = "&hue=" + that.hueValue + "&brightness=100&sat=" + that.saturationValue + "&iswhite=" + (that.saturationValue < 3 && that.hueValue < 3 ? "true" : "false");
			var url = that.control_url.replace(that.param, "setcolbrightnessvalue") + parameters;
			that.hueSemaphore = undefined;
			request.put({
				url: url,
				header: {
					'Authorization': 'Basic ' + that.authstr
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
		} else {
			callback();
		}
	},
	getValue: function(callback) {
		var that = this;
		request.get({
			url: that.status_url,
			header: {
				'Authorization': 'Basic ' + that.authstr
			},
			json: true
		}, function(err, response, json) {
			if (!err && response.statusCode == 200) {
				var value;
				if (json.result !== undefined) {
					var sArray = Helper.sortByKey(json.result, "Name");
					sArray.map(function(s) {
						value = Helper.oneDP(s.Data.replace(/[^\d.-]/g, ''));
					});
				}
				that.log("Data Received for " + that.name + ": " + value);
				callback(null, value);
			} else {
				that.log("There was a problem connecting to Domoticz.");
			}
		}.bind(this));
	},
	getQualValue: function(callback) {
		var that = this;
		request.get({
			url: that.status_url,
			header: {
				'Authorization': 'Basic ' + that.authstr
			},
			json: true
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
					});
				}
				that.log("Data Received for " + that.name + ": " + value);
				callback(null, value);
			} else {
				that.log("There was a problem connecting to Domoticz.");
			}
		}.bind(this));
	},
	getStringValue: function(callback) {
		var that = this;
		request.get({
			url: that.status_url,
			header: {
				'Authorization': 'Basic ' + that.authstr
			},
			json: true
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
						} else if (that.Type == "Lux") { //motion
							value = parseInt(s.Data, 10);
						} else {
							if (that.name.indexOf("Gas") > -1 && that.Type == "General" && that.subType == "kWh") {
								value = s.Usage;
							} else {
								value = s.Data;
							}
						}
					});
				}
				that.log("Data Received for " + that.name + ": " + value);
				callback(null, value);
			} else {
				that.log("There was a problem connecting to Domoticz.");
			}
		}.bind(this));
	},
	getYLTodayValue: function(callback) {
		var that = this;
		request.get({
			url: that.status_url,
			header: {
				'Authorization': 'Basic ' + that.authstr
			},
			json: true
		}, function(err, response, json) {
			if (!err && response.statusCode == 200) {
				var value;
				if (json.result !== undefined) {
					var sArray = Helper.sortByKey(json.result, "Name");
					sArray.map(function(s) {
						value = s.CounterToday;
					});
				}
				that.log("Data Received for " + that.name + ": " + value);
				callback(null, value);
			} else {
				that.log("There was a problem connecting to Domoticz.");
			}
		}.bind(this));
	},
	getYLTotalValue: function(callback) {
		var that = this;
		request.get({
			url: that.status_url,
			header: {
				'Authorization': 'Basic ' + that.authstr
			},
			json: true
		}, function(err, response, json) {
			if (!err && response.statusCode == 200) {
				var value;
				if (json.result !== undefined) {
					var sArray = Helper.sortByKey(json.result, "Name");
					sArray.map(function(s) {
						value = Helper.oneDP(s.Counter) + " kWh";
					});
				}
				that.log("Data Received for " + that.name + ": " + value);
				callback(null, value);
			} else {
				that.log("There was a problem connecting to Domoticz.");
			}
		}.bind(this));
	},
	getWindSpeed: function(callback) {
		var that = this;
		request.get({
			url: that.status_url,
			header: {
				'Authorization': 'Basic ' + that.authstr
			},
			json: true
		}, function(err, response, json) {
			if (!err && response.statusCode == 200) {
				var value;
				if (json.result !== undefined) {
					var sArray = Helper.sortByKey(json.result, "Name");
					sArray.map(function(s) {
						value = s.Speed;
					});
				}
				that.log("Data Received for " + that.name + ": " + value);
				callback(null, value);
			} else {
				that.log("There was a problem connecting to Domoticz.");
			}
		}.bind(this));
	},
	getWindChill: function(callback) {
		var that = this;
		request.get({
			url: that.status_url,
			header: {
				'Authorization': 'Basic ' + that.authstr
			},
			json: true
		}, function(err, response, json) {
			if (!err && response.statusCode == 200) {
				var value;
				if (json.result !== undefined) {
					var sArray = Helper.sortByKey(json.result, "Name");
					sArray.map(function(s) {
						value = String(s.Chill);
					});
				}
				that.log("Data Received for " + that.name + ": " + value);
				callback(null, value);
			} else {
				that.log("There was a problem connecting to Domoticz.");
			}
		}.bind(this));
	},
	getWindDirection: function(callback) {
		var that = this;
		request.get({
			url: that.status_url,
			header: {
				'Authorization': 'Basic ' + that.authstr
			},
			json: true
		}, function(err, response, json) {
			if (!err && response.statusCode == 200) {
				var value;
				if (json.result !== undefined) {
					var sArray = Helper.sortByKey(json.result, "Name");
					sArray.map(function(s) {
						value = s.Direction + " (" + s.DirectionStr + ")";
					});
				}
				that.log("Data Received for " + that.name + ": " + value);
				callback(null, value);
			} else {
				that.log("There was a problem connecting to Domoticz.");
			}
		}.bind(this));
	},
	getCPower: function(callback) {
		var that = this;
		request.get({
			url: that.status_url,
			header: {
				'Authorization': 'Basic ' + that.authstr
			},
			json: true
		}, function(err, response, json) {
			if (!err && response.statusCode == 200) {
				var value;
				if (json.result !== undefined) {
					var sArray = Helper.sortByKey(json.result, "Name");
					sArray.map(function(s) {
						value = (that.Type == "Usage" && that.subType == "Electric") ? s.Data : s.Usage;
					});
				}
				that.log("Data Received for " + that.name + ": " + value);
				callback(null, value);
			} else {
				that.log("There was a problem connecting to Domoticz.");
			}
		}.bind(this));
	},
	getState: function(callback) {
		value = 1;
		this.log("Static Data for " + this.name + ": " + value);
		callback(null, value);
	},
	getTemperature: function(callback) {
		var that = this;
		request.get({
			url: that.status_url,
			header: {
				'Authorization': 'Basic ' + that.authstr
			},
			json: true
		}, function(err, response, json) {
			if (!err && response.statusCode == 200) {
				var value;
				if (json.result !== undefined) {
					var sArray = Helper.sortByKey(json.result, "Name");
					sArray.map(function(s) {
						var heat = (that.subType == "Zone") ? true : false;
						var therm = (that.subType == "SetPoint") ? true : false;
						value = ((heat) || (therm)) ? Helper.oneDP(s.SetPoint) : Helper.oneDP(s.Temp);
					});
				}
				that.log("Data Received for " + that.name + ": " + value);
				callback(null, value);
			} else {
				that.log("There was a problem connecting to Domoticz.");
			}
		}.bind(this));
	},
	setPoint: function(setpoint, callback) {
		var url, that = this;
		if (that.subType == "SetPoint") {
			url = that.access_url + "type=command&param=udevice&idx=" + that.idx;
			url = url + "&nvalue=0&svalue=" + setpoint;
		} else if (that.subType == "Zone") {
			url = that.access_url + "type=setused&idx=" + that.idx + "&setpoint=";
			url = url + setpoint + "&mode=PermanentOverride&used=true";
		}
		that.log("Setting thermostat SetPoint to " + setpoint);
		request.put({
			url: url,
			header: {
				'Authorization': 'Basic ' + that.authstr
			}
		}, function(err, response) {
			if (err) {
				that.log("There was a problem sending command to" + that.name);
				that.log(response);
			} else {
				that.log(that.name + " sent command succesfully");
			}
			callback(null, setpoint);
		}.bind(this));
	},
	setTempOverride: function(setuntil, callback) {
		var url, that = this,
			temp;
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
		request.get({
			url: that.status_url,
			header: {
				'Authorization': 'Basic ' + that.authstr
			},
			json: true
		}, function(err, response, json) {
			if (!err && response.statusCode == 200) {
				var value;
				if (json.result !== undefined) {
					var sArray = Helper.sortByKey(json.result, "Name");
					sArray.map(function(s) {
						var heat = (that.Type == "Heating" && that.subType == "Zone") ? true : false;
						var therm = (that.Type == "Thermostat" && that.subType == "SetPoint") ? true : false;
						temp = (heat || therm) ? Helper.oneDP(s.SetPoint) : Helper.oneDP(s.Temp);
						url = that.access_url + "type=setused&idx=" + that.idx + "&setpoint=";
						url = url + temp + "&mode=" + mode;
						url = (mode == "TemporaryOverride") ? url + "&until=" + isonow + "&used=true" : url + "&used=true";
						that.log("Setting thermostat SetPoint to " + temp + ", mode to " + mode);
						var putme = request.put({
							url: url,
							header: {
								'Authorization': 'Basic ' + that.authstr
							}
						}, function(err, response) {
							if (err) {
								that.log("There was a problem sending command to" + that.name);
								that.log(response);
							} else {
								that.log(that.name + " sent command succesfully");
							}
							callback(null, setuntil);
						});
					});
				}
			} else {
				that.log("There was a problem connecting to Domoticz.");
				callback();
			}
		}.bind(this));
	},
	getTempOverride: function(callback) {
		var that = this;
		request.get({
			url: that.status_url,
			header: {
				'Authorization': 'Basic ' + that.authstr
			},
			json: true
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
					});
				}
				that.log("Data Received for " + that.name + ": " + value);
				callback(null, value);
			} else {
				that.log("There was a problem connecting to Domoticz.");
			}
		}.bind(this));
	},
	getHumidity: function(callback) {
		var that = this;
		request.get({
			url: that.status_url,
			header: {
				'Authorization': 'Basic ' + that.authstr
			},
			json: true
		}, function(err, response, json) {
			if (!err && response.statusCode == 200) {
				var value;
				if (json.result !== undefined) {
					var sArray = Helper.sortByKey(json.result, "Name");
					sArray.map(function(s) {
						value = Helper.oneDP(s.Humidity);
					});
				}
				that.log("Data Received for " + that.name + ": " + value);
				callback(null, value);
			} else {
				that.log("There was a problem connecting to Domoticz.");
			}
		}.bind(this));
	},
	getPressure: function(callback) {
		var that = this;
		request.get({
			url: that.status_url,
			header: {
				'Authorization': 'Basic ' + that.authstr
			},
			json: true
		}, function(err, response, json) {
			if (!err && response.statusCode == 200) {
				var value;
				if (json.result !== undefined) {
					var sArray = Helper.sortByKey(json.result, "Name");
					sArray.map(function(s) {
						value = Helper.oneDP(s.Barometer) + "hPa";
					});
				}
				that.log("Data Received for " + that.name + ": " + value);
				callback(null, value);
			} else {
				that.log("There was a problem connecting to Domoticz.");
			}
		}.bind(this));
	},
	getLowBatteryStatus: function(callback) {
		var that = this;
		request.get({
			url: that.status_url,
			header: {
				'Authorization': 'Basic ' + that.authstr
			},
			json: true
		}, function(err, response, json) {
			if (!err && response.statusCode == 200) {
				var value;
				if (json.result !== undefined) {
					var sArray = Helper.sortByKey(json.result, "Name");
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
				that.log("There was a problem connecting to Domoticz.");
			}
		}.bind(this));
	},
	getBlindStatus: function(callback) {
		var that = this;
		if (this.isPercentageBlind) {
			that.getdValue(callback);
			return;
		}
		request.get({
			url: that.status_url,
			header: {
				'Authorization': 'Basic ' + that.authstr
			},
			json: true
		}, function(err, response, json) {
			if (!err && response.statusCode == 200) {
				var value;
				if (json.result !== undefined) {
					var sArray = Helper.sortByKey(json.result, "Name");
					sArray.map(function(s) {
						value = s.Data;
					});
				}
				if (value == "Open") {
					callback(null, 100);
				} else {
					callback(null, 0);
				}
			} else {
				that.log("There was a problem connecting to Domoticz.");
			}
		}.bind(this));
	},
	setBlindStatus: function(blindService, pos, callback) {
		var url, that = this;
		var shouldOpen = (pos <= 50);
		if (that.isInvertedBlind) {
			shouldOpen = !shouldOpen;
		}
		var command = (shouldOpen ? "On" : "Off");
		if (that.isPercentageBlind && pos > 0 && pos < 100) {
			that.setdValue(pos, function() {
				blindService.getCharacteristic(Characteristic.CurrentPosition).setValue(pos, false, that);
				callback();
			});
			return;
		}
		url = that.control_url + "&switchcmd=" + command;
		request.put({
			url: url,
			header: {
				'Authorization': 'Basic ' + that.authstr
			}
		}, function(err, response) {
			if (err) {
				that.log("There was a problem sending command to" + that.name);
				that.log(response);
			} else {
				that.log(that.name + " sent command succesfully");
			}
			callback();
			blindService.getCharacteristic(Characteristic.CurrentPosition).setValue(pos, false, that);
		}.bind(this));
	},
	getBlindPStatus: function(callback) {
		var that = this;
		callback(null, Characteristic.PositionState.STOPPED);
	},
	handleMQTTMessage: function(message, callback) {
		this.log('MQTT Message received for ' + this.name + ' (Type: ' + this.Type + ', SubType: ' + this.subType + ', swType: ' + this.swTypeVal + ')');
		if ((this.Type == "P1 Smart Meter" && this.swTypeVal == 1 && this.subType == "Gas") || (this.Type == "General" && this.swTypeVal == 2 && this.subType == "Counter Incremental") || (this.name.indexOf("Occupied") > -1) || (this.Type == "General" && this.swTypeVal == 1 && this.subType == "Visibility") || (this.Type == "General" && this.swTypeVal === 0 && this.subType == "kWh") || (this.Type == "General" && this.subType == "Solar Radiation" && this.swTypeVal === 0)) {
			this.swTypeVal = false;
			this.isSwitch = false;
			//cludgey fix for a P1 SmartMeter Virtual Sensor being ID'd as a doorbell in Domoticz, and Incremental COunters being id'd as contact switches
			//and other such Domoticz-generated oddities
		}
		if (this.isSwitch) {
			switch (true) {
			case this.swTypeVal == Constants.DeviceTypeSwitch:
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
								callback(CurrentConsumptionCharacteristic, message.svalue1);
								if ('undefined' !== typeof message.svalue2) {
									var TotalConsumptionCharacteristic = this.getService(eDomoticzServices.MeterDeviceService).getCharacteristic(eDomoticzServices.TotalConsumption);
									callback(TotalConsumptionCharacteristic, message.svalue2);
								}
							} else if (this.subType == "YouLess counter") {
								if ('undefined' !== typeof message.svalue2) {
									var CurrentConsumptionCharacteristic2 = this.getService(eDomoticzServices.MeterDeviceService).getCharacteristic(eDomoticzServices.CurrentConsumption);
									var newval2 = message.svalue2;
									callback(CurrentConsumptionCharacteristic2, newval2);
								}
								var TotalConsumptionCharacteristic2 = this.getService(eDomoticzServices.MeterDeviceService).getCharacteristic(eDomoticzServices.TotalConsumption);
								var newval = Helper.oneDP(message.svalue1 / 1000) + " kWh";
								callback(TotalConsumptionCharacteristic2, newval);
							}
							if (this.subType !== "Electric") {
								if ('undefined' !== typeof message.svalue2) {
									var TodayConsumptionCharacteristic3 = this.getService(eDomoticzServices.MeterDeviceService).getCharacteristic(eDomoticzServices.TodayConsumption);
									callback(TodayConsumptionCharacteristic3, message.svalue2);
								}
							}

							break;
						} else if (this.subType == "Percentage") {
							var UsageDeviceCharacteristic = this.getService(eDomoticzServices.UsageDeviceService).getCharacteristic(eDomoticzServices.CurrentUsage);
							callback(UsageDeviceCharacteristic, message.svalue1.toString() + '%');
							break;
						} else if (this.subType == "Visibility") {
							var VisibilityDeviceCharacteristic = this.getService(eDomoticzServices.VisibilityDeviceService).getCharacteristic(eDomoticzServices.Visibility);
							callback(VisibilityDeviceCharacteristic, message.svalue1);
							break;
						} else if (this.subType == "Solar Radiation" || this.subType == "UVN800") {
							var SolRadDeviceCharacteristic = this.getService(eDomoticzServices.SolRadDeviceService).getCharacteristic(eDomoticzServices.SolRad);
							callback(SolRadDeviceCharacteristic, message.svalue1);
							break;
						} else if ((this.subType) == "Text" && (this.name.indexOf('Location') > -1)) {
							var LocationDeviceCharacteristic = this.getService(eDomoticzServices.LocationService).getCharacteristic(Characteristic.Version);
							callback(LocationDeviceCharacteristic, message.svalue1);
							break;
						} else if (this.subType == "Counter Incremental") {
							var wMeterDeviceCharacteristic = this.getService(eDomoticzServices.MeterDeviceService).getCharacteristic(eDomoticzServices.CurrentConsumption);
							callback(wMeterDeviceCharacteristic, message.svalue1);
							break;
						} else if (this.subType == "Lux") {
							var lightSensorCharacteristic = this.getService(Service.LightSensor).getCharacteristic(Characteristic.CurrentAmbientLightLevel);
							callback(lightSensorCharacteristic, message.svalue1);
							break;
						} else {
							var dMeterDeviceCharacteristic = this.getService(eDomoticzServices.MeterDeviceService).getCharacteristic(eDomoticzServices.CurrentConsumption);
							callback(dMeterDeviceCharacteristic, message.svalue1);
							break;
						}
					}
					break;
				}
			case this.Type == "Air Quality":
				{
					if ('undefined' !== typeof message.nvalue){
						var airQualityServiceCharacteristic = this.getService(Service.AirQualitySensor).getCharacteristic(Characteristic.AirParticulateDensity);
						callback(airQualityServiceCharacteristic, message.nvalue);
					}
					break;
				}
			case this.Type == "Wind":
				{
					if ('undefined' !== typeof message.svalue5) {
						var windServiceCurrentCharacteristic = this.getService(eDomoticzServices.WindDeviceService).getCharacteristic(Characteristic.CurrentTemperature);
						callback(windServiceCurrentCharacteristic, message.svalue5);
					}
					if ('undefined' !== typeof message.svalue3) {
						var windServiceWindSpeedCharacteristic = this.getService(eDomoticzServices.WindDeviceService).getCharacteristic(eDomoticzServices.WindSpeed);
						var wspeed = (message.svalue3 / 10);
						var newval1 = wspeed.toString() + ' m/s';
						callback(windServiceWindSpeedCharacteristic, message.newval1);
					}
					if ('undefined' !== typeof message.svalue6) {
						var windServiceWindChillCharacteristic = this.getService(eDomoticzServices.WindDeviceService).getCharacteristic(eDomoticzServices.WindChill);
						callback(windServiceWindChillCharacteristic, message.svalue6);
					}
					if ('undefined' !== typeof message.svalue2 && 'undefined' !== typeof message.svalue1) {
						var windServiceWindDirectionCharacteristic = this.getService(eDomoticzServices.WindDeviceService).getCharacteristic(eDomoticzServices.WindDirection);
						var windeg = message.svalue1;
						var windir = message.svalue2;
						var newval4 = windeg.toString() + ' (' + windir.toString() + ')';
						callback(windServiceWindDirectionCharacteristic, newval4);
					} else if ('undefined' !== typeof message.svalue1){
						var windServiceWindDirectionCharacteristic = this.getService(eDomoticzServices.WindDeviceService).getCharacteristic(eDomoticzServices.WindDirection);
						callback(windServiceWindDirectionCharacteristic, message.svalue1);
					}
					break;
				}
			case this.Type == "Rain":
				{
					if ('undefined' !== typeof message.svalue1){
						var rainServiceCharacteristic = this.getService(eDomoticzServices.RainDeviceService).getCharacteristic(eDomoticzServices.Rainfall);
						var rainfall = message.svalue1;
						var newval3 = rainfall.toString() + 'mm';
						callback(rainServiceCharacteristic, newval3);
					}
					break;
				}
			case this.Type == "Temp" || this.Type == "Temp + Humidity" || this.Type == "Temp + Humidity + Baro":
				{
					if ('undefined' !== typeof message.svalue1){
						var temperatureSensorCharacteristic = this.getService(Service.TemperatureSensor).getCharacteristic(Characteristic.CurrentTemperature);
						var temperature = Helper.oneDP(message.svalue1);
						callback(temperatureSensorCharacteristic, temperature);
						if (this.Type == "Temp + Humidity" || this.Type == "Temp + Humidity + Baro") {
							var HumidityCharacteristic = this.getService(Service.TemperatureSensor).getCharacteristic(Characteristic.CurrentRelativeHumidity);
							var humidity = Helper.oneDP(message.svalue1);
							callback(HumidityCharacteristic, humidity);
							if (this.Type == "Temp + Humidity + Baro") {
								var BarometerCharacteristic = this.getService(Service.TemperatureSensor).getCharacteristic(eDomoticzServices.Barometer);
								var pressure = Helper.oneDP(message.svalue1);
								var newval5 = pressure.toString() + 'hpa';
								callback(BarometerCharacteristic, newval5);
							}
						}
					}
					break;
				}
			case this.Type == "P1 Smart Meter":
				{
					if ('undefined' !== typeof message.svalue1){
						if (this.subType == "Gas") {
							var P1GasMeterDeviceCharacteristic = this.getService(eDomoticzServices.GasDeviceService).getCharacteristic(eDomoticzServices.GasConsumption);
							var newval6 = (message.svalue1 / 1000);
							callback(P1GasMeterDeviceCharacteristic, newval6);
						} else if (this.subType == "kWh" || this.subType == "Energy") {
							var P1ElecMeterDeviceCharacteristic = this.getService(eDomoticzServices.MeterDeviceService).getCharacteristic(eDomoticzServices.CurrentConsumption);
							callback(P1ElecMeterDeviceCharacteristic, message.svalue1);
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
							var infotextServiceCharacteristic = this.getService(eDomoticzServices.InfotextDeviceService).getCharacteristic(eDomoticzServices.Infotext);
							callback(infotextServiceCharacteristic, message.svalue1);
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
		if ((this.Type == "P1 Smart Meter" && this.swTypeVal == 1 && this.subType == "Gas") || (this.Type == "General" && this.swTypeVal == 2 && this.subType == "Counter Incremental") || (this.name.indexOf("Occupied") > -1) || (this.Type == "General" && this.swTypeVal == 1 && this.subType == "Visibility") || (this.Type == "General" && this.swTypeVal === 0 && this.subType == "kWh") || (this.Type == "General" && this.subType == "Solar Radiation" && this.swTypeVal === 0)) {
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
						var MeterDeviceService = new eDomoticzServices.MeterDeviceService("Power Usage");
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
						var UsageDeviceService = new eDomoticzServices.UsageDeviceService("Current Usage");
						UsageDeviceService.getCharacteristic(eDomoticzServices.CurrentUsage).on('get', this.getStringValue.bind(this));
						this.services.push(UsageDeviceService);
						break;
					} else if (this.subType == "Visibility") {
						var VisibilityDeviceService = new eDomoticzServices.VisibilityDeviceService("Current Distance");
						VisibilityDeviceService.getCharacteristic(eDomoticzServices.Visibility).on('get', this.getStringValue.bind(this));
						this.services.push(VisibilityDeviceService);
						break;
					} else if (this.subType == "Solar Radiation" || this.subType == "UVN800") {
						var SolRadDeviceService = new eDomoticzServices.SolRadDeviceService("Current radiation");
						SolRadDeviceService.getCharacteristic(eDomoticzServices.SolRad).on('get', this.getStringValue.bind(this));
						this.services.push(SolRadDeviceService);
						break;
					} else if ((this.subType) == "Text" && (this.name.indexOf('Location') > -1)) {
						var LocationDeviceService = new eDomoticzServices.LocationService("Current Location");
						LocationDeviceService.getCharacteristic(Characteristic.Version).on('get', this.getStringValue.bind(this));
						this.services.push(LocationDeviceService);
						break;
					} else if (this.subType == "Counter Incremental") {
						var wMeterDeviceService = new eDomoticzServices.MeterDeviceService("Water Usage");
						wMeterDeviceService.getCharacteristic(eDomoticzServices.CurrentConsumption).on('get', this.getStringValue.bind(this));
						this.services.push(wMeterDeviceService);
						break;
					} else if (this.subType == "Lux") {
						var lightSensorService = new Service.LightSensor("Current Luminiscence");
						lightSensorService.getCharacteristic(Characteristic.CurrentAmbientLightLevel).on('get', this.getStringValue.bind(this));
						this.services.push(lightSensorService);
						break;
					} else {
						var dMeterDeviceService = new eDomoticzServices.MeterDeviceService("Power Usage");
						dMeterDeviceService.getCharacteristic(eDomoticzServices.CurrentConsumption).on('get', this.getStringValue.bind(this));
						this.services.push(dMeterDeviceService);
						break;
					}
					break;
				}
			case this.Type == "Temp" || this.Type == "Temp + Humidity" || this.Type == "Temp + Humidity + Baro":
				{
					var temperatureSensorService = new Service.TemperatureSensor(this.name);
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
