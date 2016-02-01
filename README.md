# homebridge-eDomoticz
A fully-fledged up-to-date Homebridge-Plugin 
for use with [Homebridge](https://github.com/nfarina/homebridge) v0.2.1x 
and [Domoticz](https://github.com/domoticz/domoticz)

##Supports:
- Switches (Light / Socket On & Off, & reflected status)
- Temperature Sensors (Current Temperature, deg C)
- Power Meters (General, kWh - Current Consumption, Total Consumption)
- General Usage Sensors (eg: CPU%, Mem%, HDD% from Motherboard Sensors Hardware Device)

###Todo:
- [ ] homebridge plugin 2.0 support - https://github.com/nfarina/homebridge/pull/497
- [x] Respect Room setting if defined in config.json
- [x] kWh (electricity usage)
- [x] General % usage
- [ ] Improve kWh & General % usage code for correct val type (int) and unit rather than relying on string
- [ ] Brightness
- [ ] Hue
- [ ] m3 (gas usage)
- [ ] ...more sensors!

## Installation
```
sudo npm install -g patchworkboy/homebridge-eDomoticz
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
            "roomid": 0
        }
    ],
    "accessories": []
}
```
