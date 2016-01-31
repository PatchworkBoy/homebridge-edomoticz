# homebridge-eDomoticz
A fully-fledged up-to-date Homebridge-Plugin 
for [Homebridge](https://github.com/nfarina/homebridge) v0.2.1x

Supports:
- Switches (Light / Socket On & Off & status)
- Temperature Sensors (Current Temperature, deg C)
- Power Meters (General, kWh - Current Consumption, Total Consumption)
- General Usage Sensors (eg: CPU%, Mem%, HDD% from Motherboard Sensors Hardware Device)

Todo:
- [x] Respect Room setting if defined in config.json
- [x] kWh (electricity usage)
- [x] General % usage
- [ ] Brightness
- [ ] Hue
- [ ] m3 (gas usage)

## Supports

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
