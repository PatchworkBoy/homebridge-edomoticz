var request = require("request");
var Helper = require('./helper.js').Helper;
var extend = require('util')._extend;

module.exports = {
    Domoticz: Domoticz
}

var baseHttpRequest = false;

function Domoticz() {

}

Domoticz.initialize = function(useSSL, requestHeaders) {
  var defaultRequestOptions = {
    headers: requestHeaders,
    json: true
  };

  if (useSSL)
  {
    defaultRequestOptions.agentOptions = {
      rejectUnauthorized: false
    };
  }

  baseHttpRequest = request.defaults(defaultRequestOptions);
};

Domoticz.devices = function(baseURL, roomID, completion, error) {
  if (baseHttpRequest === false) {
    return;
  }

  var url = baseURL + "type=devices&used=true&order=Name";
  if (roomID) {
      url += "&plan=" + roomID;
  }

  baseHttpRequest.get({
    url: url
  }, function(err, response, json) {
    if (!err && response.statusCode == 200 && json.result !== undefined)
    {
      var devices = [];
      var sArray = Helper.sortByKey(json.result, "Name");
      sArray.map(function(s) {
        devices.push(s);
      });

      if (typeof completion !== 'undefined' && completion !== false) {
        completion(devices);
      }
    }
    else
    {
      if (typeof error !== 'undefined' && error !== false) {
        error();
      }
    }
  });
};

Domoticz.deviceStatus = function(accessory, completion, error) {
  if (baseHttpRequest === false) {
    return;
  }

  var url = accessory.baseURL + "type=devices&rid=" + accessory.idx;
  baseHttpRequest.get({
    url: url
  }, function(err, response, json) {
    if (!err && response.statusCode == 200 && json.result !== undefined)
    {
      this.platform.log("Data Received for " + this.name + ".");
      if (typeof completion !== 'undefined' && completion !== false) {
        completion(json);
      }
    }
    else
    {
      this.platform.log("There was a problem connecting to Domoticz. (HTTP Status " + response.statusCode + ")\n- " + err);
      if (typeof error !== 'undefined' && error !== false) {
        error();
      }
    }
  }.bind(accessory));
};

Domoticz.updateDeviceStatus = function(accessory, command, parameters, completion) {
  if (accessory.platform.mqtt && this.isMQTTSupportedCommand(command, parameters))
  {
    var message = {"command": command, "idx": parseInt(accessory.idx)};
    extend(message, parameters);

    accessory.platform.mqtt.send(message);
    if (typeof completion !== 'undefined' && completion !== false) {
      completion(true);
    }
    return;
  }

  var url = accessory.baseURL + "type=command&param=" + encodeURI(command) + "&idx=" + accessory.idx;

  for (var key in parameters) {
    url += "&" + encodeURI(key) + "=" + encodeURI(parameters[key]);
  }

  Domoticz.updateWithURL(accessory, url, completion);
};

Domoticz.updateWithURL = function(accessory, url, completion) {
  if (baseHttpRequest === false) {
    return;
  }

  baseHttpRequest.put({
    url: url,
    header: this.requestHeaders,
    json: true
  },
  function(err, response) {
    var success = (typeof err === 'undefined' || !err);

    if (success) {
      this.platform.log(this.name + " sent command succesfully.");
    }
    else
    {
      this.platform.log("There was a problem sending command to " + this.name + ". (HTTP Status " + response.statusCode + ")\n- " + err);
      this.platform.log(response.body);
    }

    if (typeof completion !== 'undefined' && completion !== false) {
      completion(success);
    }
  }.bind(accessory));
};

Domoticz.isMQTTSupportedCommand = function(command, parameters) {
  if (command == "setcolbrightnessvalue") {
      return false;
  }

  return true;
}