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

Domoticz.settings = function(accessory, completion, error) {
  if (baseHttpRequest === false) {
    return;
  }

  var url = accessory.platform.apiBaseURL + "type=settings";
  baseHttpRequest.get({
    url: url
  }, function(err, response, json) {
    if (!err && response.statusCode == 200 && json !== undefined)
    {
      if (typeof completion !== 'undefined' && completion !== false) {
        completion(json);
      }
    }
    else
    {
      Helper.LogConnectionError(this.platform, response, err);
      if (typeof error !== 'undefined' && error !== false) {
        error();
      }
    }
  }.bind(accessory));
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
        error(response, err);
      }
    }
  });
};

Domoticz.hardware = function(baseURL, completion, error) {
  if (baseHttpRequest === false) {
    return;
  }

  var url = baseURL + "type=hardware";

  baseHttpRequest.get({
    url: url
  }, function(err, response, json) {
    if (!err && response.statusCode == 200 && json.result !== undefined)
    {
      var hardware = [];
      var sArray = Helper.sortByKey(json.result, "Name");
      sArray.map(function(s) {
        hardware.push(s);
      });

      if (typeof completion !== 'undefined' && completion !== false) {
        completion(hardware);
      }
    }
    else
    {
      if (typeof error !== 'undefined' && error !== false) {
        error(response, err);
      }
    }
  });
};

Domoticz.deviceStatus = function(accessory, completion, error) {
  if (baseHttpRequest === false) {
    return;
  }

  var url = accessory.platform.apiBaseURL + "type=devices&rid=" + accessory.idx;
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
      Helper.LogConnectionError(this.platform, response, err);
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

  var url = accessory.platform.apiBaseURL + "type=command&param=" + encodeURI(command) + "&idx=" + accessory.idx;

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
    else {
      Helper.LogConnectionError(this.platform, response, err);
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
};