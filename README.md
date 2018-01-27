# homebridge-eDomoticz
A fully-fledged up-to-date Homebridge-Plugin
for use with [Homebridge](https://github.com/nfarina/homebridge) v0.2.1+
and [Domoticz](https://github.com/domoticz/domoticz)

## Supports:
### Standard HomeKit Types (supported by Home.app):
- Sockets (on/off) - Domoticz SwitchTypeVal: 0
- Lamps (on/off) - Domoticz SwitchTypeVal: 0
- Contact Sensors - Domoticz SwitchTypeVal: 2
- Blinds - Domoticz SwitchTypeVal: 3
- Smoke Detectors - Domoticz SwitchTypeVal: 5
- Blinds (inverted) - Domoticz SwitchTypeVal: 6
- Lamps (dimmer) - Domoticz SwitchTypeVal: 7
- Motion Sensors - Domoticz SwitchTypeVal: 8
- Push Switches -  Domoticz SwitchTypeVal: 9
- Lock Mechanisms - Domoticz SwitchTypeVal: 11
- Blinds (%) - Domoticz SwitchTypeVal: 13
- Blinds (& inverted) - Domoticz SwitchTypeVal: 16

## Provides:
### Custom HomeKit Types (supported by 3rd Party HomeKit Apps only - eg: Elgato Eve):
- General kWh power meters - Types: General, Current; SubType: kWh, mapped to Eve chars where possible
- CurrentCost USB power meter - Type: Usage, SubType: Electric, mapped to Eve chars where possible
- P1 Smart Meter (Electric & Gas), mapped to Eve chars where possible
- EvoHome** / OpenTherm Thermostat support - Types: Heating, Thermostat; SubTypes: Zone, SetPoint
- YouLess Meter (Current, Total and Today Total Consumption) - Type: YouLess Meter; SubType: YouLess counter, mapped to Eve chars where possible
- General Usage % meters (eg: Motherboard Sensors Hardware Device - CPU %, Mem %, HDD % etc) - Type: General; SubType: Percentage
- Temperature, Temp + Humidity, Temp + Humidity + Baro (Current Temperature, Current Humidity, Current Pressure in hPA) - Type: Temp, Temp + Humidty, Temp + Humidity + Baro [id'd as Eve Weather]
- DarkSkies Virtual Weather Station Sensors (Wind, Solar Radiation, Rainfall, Visibility, Barometer [id'd as Eve Weather])

** assumes the EvoHome has been setup according to [this script method](https://www.domoticz.com/wiki/Evohome#Scripting_for_RFG100).

## Todo:
- [x] homebridge [plugin 2.0](https://github.com/nfarina/homebridge/pull/497) support
- [x] MQTT-based realtime updates
- [x] Hue/RGB
- [x] Blinds
- [x] m3 (gas usage)
- [x] Motion sensors
- [x] Smoke Detectors
- [x] Brightness/Dimming
- [x] kWh (electricity usage)
- [x] General % usage
- [x] Humidity
- [x] Pressure
- [x] YouLess Meter
- [x] Open/Closed contact sensors
- [ ] ...more sensors (ongoing)!

## Installation
```
sudo npm install -g homebridge-edomoticz
```

## Update
```
sudo npm update -g homebridge-edomoticz
```

## Configuration

~/.homebridge/config.json example:
```
{
    "bridge": {
        "name": "Homebridge",
        "username": "CC:21:3E:E4:DE:33",
        "port": 51826,
        "pin": "031-45-154"
    },
    "description": "Configuration file for (e)xtended Domoticz platform.",
    "platforms": [
        {
            "platform": "eDomoticz",
            "name": "eDomoticz",
            "server": "127.0.0.1",
            "port": "8080",
            "ssl": 0,
            "roomid": 0,
            "mqtt": 1,
            "excludedDevices": []
        }
    ],
    "accessories": []
}
```

By default, the plugin will grab hardware information regarding MQTT from Domoticz if `mqtt` is 1 or true in the configuration file.
Advanced users can override their MQTT configuration as follows:

```
"mqtt": {
  "host": "alternate.mqtt.com",
  "port": 1234,
  "topic": "domoticz/out",
  "username": "username",
  "password": "password"
}
```

Values can be omitted from this dictionary, and the values that need overriding can be kept, e.g.

```
"mqtt": {
    "port": 1234
}
```

to only override the port value.

To prevent certain Domoticz devices from showing up in HomeBridge it is possible to exclude them by setting the "excludedDevices" parameter.
Provide an array of Domoticz Device ID's, which can be found in the Domoticz dashboard on the "Setup > Devices" page and look for the "ID" column (not the "idx" column).

```
"excludedDevices": ["0000001","0000002"]
```

## Tips

### Authentication
If Domoticz is set up to use basic or form login authentication, set "server":"user:pass@ip" within config.json. The plugin will internally extract the username and password, base64 encode it and send it as a http authorization header whenever it talks to your Domoticz server.

### SSL
Set "ssl":1 in config.json to turn on SSL (ie: server connects with https:// rather than http://). You will need to specify your SSL port - usually "port":"443" by default.

### Issues pairing to Homebridge when you have a lot of Domoticz sensors...
If you have more than 100 devices in Domoticz, you need to limit the number of devices exposed to HomeKit (HomeKit only supports 100 Accessories on a single bridge - whilst we could combine multiple sensors into a single homekit accessory within the plugin, the possible combinations out there are endless, so we won't).

Therefore, to reduce the number of devices exposed from Domoticz, create a roomplan within Domoticz via Setup > More Options > Plans > roomplan. Add only the devices you wish to be exposed to HomeKit to this new roomplan within Domoticz, and then get it's roomidx number. Set "roomid" in your config.json file to this room number.

### Is my <<some accessory>> supported??
See [Domoticz API Reference](https://www.domoticz.com/wiki/Domoticz_API/JSON_URL's#Retrieve_status_of_specific_device) - query your device as per the instructions there, and if your device’s SwitchTypeVal isn't in the 'Supports:' list or Type/SubType aren’t in the ’Provides:' list above then it'll just appear as an On/Off switch. [Open a new issue](https://github.com/PatchworkBoy/homebridge-eDomoticz/issues/new) including the output from the json api and I’ll get look into supporting that particular device more fully!

### What does the Override slider represent on the EvoHome Thermostat?
Override-Until time in minutes from the current time. Allows setting an override-until time upto 8 hours in the future. Setting this slider to 0 will set the heating mode to Auto. Setting it to 481 will set the override as a PermanentOverride.

### Logging
Complies with Homebridge's native logging & debugging methodology - see https://github.com/nfarina/homebridge/wiki/Basic-Trouble-Shooting
