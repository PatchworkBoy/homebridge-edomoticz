# homebridge-eDomoticz
Domoticz Plugin (unofficial unstable beta), & currently broken.
Stick with [eDomoticz Legacy Shim](https://github.com/PatchworkBoy/eDomoticz) for now - sorry!!

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
    "accessories": [
    ]
}
```
