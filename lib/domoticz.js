var request = require("request");

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

  console.log(accessory.status_url);
  baseHttpRequest.get({
    url: accessory.status_url,
    header: this.requestHeaders,
    json: true
  }, function(err, response, json) {
    if (!err && response.statusCode == 200 && json.result !== undefined)
    {
      this.log("Data Received for " + this.name + ".");
      if (typeof completion !== 'undefined' && completion !== false) {
        completion(json);
      }
    }
    else
    {
      this.log("There was a problem connecting to Domoticz. (HTTP Status " + response.statusCode + ")\n- " + err);
      if (typeof error !== 'undefined' && error !== false) {
        error();
      }
    }
  }.bind(accessory));
};

Domoticz.updateDeviceStatus = function(accessory, url, completion) {
  if (baseHttpRequest === false) {
    return;
  }

  baseHttpRequest.put({
    url: url,
    header: this.requestHeaders,
    json: true
  }, function(err, response) {
    var success = (typeof err === 'undefined' || !err);

    if (success) {
      this.log(this.name + " sent command succesfully.");
    }
    else
    {
      this.log("There was a problem sending command to " + this.name + ". (HTTP Status " + response.statusCode + ")\n- " + err);
      this.log(response.body);
    }

    if (typeof completion !== 'undefined' && completion !== false) {
      completion(success);
    }
  }.bind(accessory));
};