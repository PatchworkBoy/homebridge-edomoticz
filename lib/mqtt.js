// IDEAS BEING BORROWED FROM @CFLURIN'S HOMEBRIDGE-MQTT PLUGIN - see https://github.com/cflurin/homebridge-mqtt
var mqtt = require('mqtt');
var accessories

module.exports = {
  Mqtt: Mqtt
}

function Mqtt(params) {
        this.log = params.log;
        plugin_name = params.plugin_name;
        accessories = params.accessories;
        Characteristic = params.Characteristic;
}

Mqtt.prototype.connect = function(url) {
        client = mqtt.connect(url);

        client.on('connect', function () {
                var topic = 'domoticz/out';
                client.subscribe(topic);
        }.bind(this));

        client.on('message', function (topic, buffer) {
                var message = buffer.toString();
                this.log("MQTT message received on %s", topic);
                this.log("Content %s", message);
                //var accessory = JSON.parse(message);
                //accessories[accessory.name].save_and_setValue("Mqtt", accessory.characteristic, result.value);
        }.bind(this));
}

