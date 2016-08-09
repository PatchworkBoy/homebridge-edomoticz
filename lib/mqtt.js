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
    client.subscribe('domoticz/out');
  });

  client.on('message', function (topic, buffer) {
    var message = JSON.parse(buffer.toString());

    var accessory = accessories["idx_" + message.idx];
    if (!accessory) {
      return;
    }

    accessory.handleMQTTMessage(message, function(characteristic, value) {
      silentlyUpdateCharacteristicValue(characteristic, value);
    });
  });
}

/*
  This function updates the characteristic silently. This means that it's not calling any eventlisteners.
  If we were to call the eventlisteners on the characteristic _without_ this function we'd get an infinite loop:

  - Turn on switch in Domoticz
  - MQTT sends "turned on" message
  - We pick this message up, overwrite the characteristic
  - Because of the on("set") handlers for the accessory, the value is then updated again through the JSON api
  - Domoticz sends another "turned on" message over MQTT
  - Repeat.
*/
function silentlyUpdateCharacteristicValue(characteristic, value)
{
    var existingListeners = characteristic.listeners('set');
    characteristic.removeAllListeners('set');
    characteristic.setValue(value, function() {
      for (var i = 0; existingListeners && i < existingListeners.length; i++) {
        characteristic.on("set", existingListeners[i]);
      }
    });

    // TODO: Find out if it's better to use the function below instead. We'd have to update the oldvalue with the newvalue manually.
    //characteristic.emit('change', { oldValue: !message.nvalue, newValue:message.nvalue, context:undefined });
}
