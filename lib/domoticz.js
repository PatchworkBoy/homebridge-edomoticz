var request = require("request");
var extend = require('util')._extend;

module.exports = {
    Domoticz: Domoticz
}

var baseHttpRequest = false;

function Domoticz() {

}

Domoticz.initialize = function(accessory, protocol, requestHeaders) {
  var defaultRequestOptions = {
    header: this.requestHeaders,
    json: true
  };

  if (protocol == "https://")
  {
    defaultRequestOptions.agentOptions = {
      rejectUnauthorized: false
    };
  }

  baseHttpRequest = request.defaults(defaultRequestOptions);
};

Domoticz.deviceStatus = function(accessory, completion, error) {
  if (baseHttpRequest === false) {
    return;
  }

  var url = accessory.access_url + "type=devices&rid=" + accessory.idx;
  baseHttpRequest.get({
    url: url,
    header: this.requestHeaders,
    json: true
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
  if (accessory.platform.mqtt)
  {
    var message = {"command": command, "idx": parseInt(accessory.idx)};
    extend(message, parameters);

    accessory.platform.mqtt.send(message);
    if (typeof completion !== 'undefined' && completion !== false) {
      completion(true);
    }
    return;
  }

  var url = accessory.access_url + "type=command&param=" + encodeURI(command) + "&idx=" + accessory.idx;

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