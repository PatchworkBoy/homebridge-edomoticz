// IDEAS BEING BORROWED FROM @CFLURIN'S HOMEBRIDGE-MQTT PLUGIN - see https://github.com/cflurin/homebridge-mqtt
var mqtt = require('mqtt');
var platform;
var accessories = [];

module.exports = {
  Mqtt: Mqtt
}

function Mqtt(aPlatform, url, credentials)
{
  platform = aPlatform;
  platform.accessories(function(rawAccessories) {
    for (var i = 0; i < rawAccessories.length; i++)
    {
      var accessory = rawAccessories[i];
      accessories["idx_" + accessory.idx] = accessory;
    }

    this.connect(url, credentials);
  }.bind(this));
}

Mqtt.prototype.connect = function(url) {
  client = mqtt.connect(url);

  client.on('connect', function() {
    platform.forceLog("Successfully connected to MQTT broker.");
    client.subscribe('domoticz/out');
  });
  client.on('close', function(error) {
    platform.forceLog("Could not connect to MQTT broker! Retrying...");
  });

  client.on('message', function (topic, buffer) {
    var message = JSON.parse(buffer.toString());
    if (typeof message.nvalue !== 'undefined' || typeof message.svalue1 !== 'undefined') {
      var accessory = accessories["idx_" + message.idx];
      if (!accessory) {
        return;
      }

      accessory.handleMQTTMessage(message, function(characteristic, value) {
        if (typeof value !== 'undefined' && typeof characteristic !== 'undefined') {
          characteristic.setValue(value, null, "eDomoticz-MQTT");
        }
      });

    } else {
		  platform.log('[ERR] MQTT message received, but no nvalue or svalue1 was found:');
		  platform.log(message);
	  }
  });
}

Mqtt.prototype.send = function(message)
{
  if (client)
  {
    var payload = message;
    if (typeof payload !== 'string') {
      payload = JSON.stringify(payload);
    }
    client.publish('domoticz/in', payload);
  }
}