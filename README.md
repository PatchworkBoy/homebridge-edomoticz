# homebridge-eDomoticz
A fully-fledged up-to-date Homebridge-Plugin
for use with [Homebridge](https://github.com/nfarina/homebridge) v0.2.1+
and [Domoticz](https://github.com/domoticz/domoticz)

##Supports:
- Sockets (on/off) - Type: Switch, Lighting 1 & Lighting 2
- Lamps (on/off) - Type: Switch, Lighting 1 & Lighting 2, Light/Switch, with or without dimming
- General kWh power meters (e.g.: CC EnvIR via script, Current & Total Consumption) - Type: General, SubType: kWh
- YouLess Meter (Current, Total and Today Total Consumption) - Type: YouLess Meter, SubType: YouLess counter
- General Usage % meters (eg: Motherboard Sensors Hardware Device - CPU %, Mem %, HDD % etc) - Type: General, SubType: Percentage
- Temperature, Temp + Humidity, Temp + Humidity + Baro (Current Temperature, Current Humidity, Current Pressure in hPA) Type: Temp, Temp + Humidty, Temp + Humidity + Baro
- DarkSkies Virtual Weather Station (Wind, Solar Radiation, Rainfall, Visibility, Barometer) - Various types & subtypes[/list]

###Todo:
- [ ] homebridge [plugin 2.0](https://github.com/nfarina/homebridge/pull/497) support
- [ ] Improve val types with val type (int) and unit rather than relying on string
- [ ] Hue/RGB
- [ ] m3 (gas usage)
- [x] Brightness/Dimming
- [x] Respect Room setting if defined in config.json
- [x] kWh (electricity usage)
- [x] General % usage
- [x] Humidity
- [x] Pressure
- [x] YouLess Meter
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
            "roomid": 0
        }
    ],
    "accessories": []
}
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
See [Domoticz API Reference](https://www.domoticz.com/wiki/Domoticz_API/JSON_URL's#Retrieve_status_of_specific_device) - query your device as per the instructions there, and if your device’s Type/SubType aren’t in the ’Supports:' list above then it'll just appear as an On/Off switch. [Open a new issue](https://github.com/PatchworkBoy/homebridge-eDomoticz/issues/new) including the output from the json api and I’ll get look into supporting that particular device more fully!
