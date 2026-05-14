import mqtt from 'mqtt';

let platform;
let client;

let config = { host: '', port: 0, credentials: false, channel: '' };

class Mqtt {
  constructor(aPlatform, host, port, channel, credentials) {
    platform = aPlatform;
    config = { host, port, credentials, channel };

    if (
      typeof config.credentials === 'undefined' ||
      typeof config.credentials.username === 'undefined' ||
      config.credentials.username.length === 0
    ) {
      config.credentials = false;
    }

    this.connect();
  }

  connect() {
    const connectOptions = { host: config.host, port: config.port };

    if (config.credentials) {
      connectOptions.username = config.credentials.username;
      connectOptions.password = config.credentials.password;
    }

    client = mqtt.connect(connectOptions);

    client.on('connect', () => {
      platform.forceLog('Successfully connected to MQTT broker.');
      client.subscribe(config.channel);
    });

    client.on('close', (error) => {
      client.end(true, () => {
        this.error('Retrying in 5 seconds...');
        setTimeout(() => {
          platform.forceLog('Retrying connection to MQTT broker...');
          this.connect();
        }, 5000);
      });
    });

    client.on('error', (error) => {
      client.end(true, () => {
        this.error(error);
      });
    });

    client.on('message', (topic, buffer) => {
      let message;

      try {
        message = JSON.parse(buffer.toString());
      } catch (e) {
        if (e instanceof SyntaxError) {
          platform.log('[ERR] JSON Syntax Error - misconstructed MQTT message received');
          platform.log(e);
          platform.log('[ERR] The offending message follows:');
          platform.log(buffer.toString());
        } else {
          platform.log(e);
          platform.log('[ERR] The offending message follows:');
          platform.log(buffer.toString());
        }
        message = false;
      }

      if (message !== false) {
        if (typeof message.nvalue !== 'undefined' || typeof message.svalue1 !== 'undefined') {
          const accessory = platform.accessories.find((acc) => acc.idx == message.idx);
          if (!accessory) {
            return;
          }

          accessory.handleMQTTMessage(message, (characteristic, value) => {
            if (typeof value !== 'undefined' && typeof characteristic !== 'undefined') {
              characteristic.setValue(value, null, 'eDomoticz-MQTT');
            }
          });
        } else {
          platform.log('[ERR] MQTT message received, but no nvalue or svalue1 was found:');
          platform.log(message);
        }
      }
    });
  }

  send(message) {
    if (!client) return;

    let payload = message;
    if (typeof payload !== 'string') {
      payload = JSON.stringify(payload);
    }

    // Keep the original fixed publish topic from the legacy plugin.
    client.publish('domoticz/in', payload);
  }

  error(error) {
    let logMessage = `Could not connect to MQTT broker! (${config.host}:${config.port})\n`;

    if (config.credentials !== false) {
      logMessage +=
        "Note: You're using a username and password to connect. Please verify your username and password too.\n";
    }

    if (error) {
      logMessage += error;
    }

    platform.forceLog(logMessage);
  }
}

export { Mqtt };
export default Mqtt;
