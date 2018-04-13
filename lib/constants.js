global.Service;
global.Characteristic;
global.Types;
global.UUID;

module.exports = {
    DeviceTypeSwitch: 0,
    DeviceTypeDoorbell: 1,
    DeviceTypeContact: 2,
    DeviceTypeBlinds: 3,
    DeviceTypeSmoke: 5,
    DeviceTypeBlindsInverted: 6,
    DeviceTypeDimmer: 7,
    DeviceTypeMotion: 8,
    DeviceTypePushOn: 9,
    DeviceTypeDoorContact: 11,
    DeviceTypeBlindsPercentage: 13,
    DeviceTypeBlindsVenetianUS: 14,
    DeviceTypeBlindsVenetianEU: 15,
    DeviceTypeBlindsPercentageInverted: 16,
    DeviceTypeMedia: 17, // Only supported as on/off switch at the moment.
    DeviceTypeSelector: 18,
    DeviceTypeDoorLock: 19,
    DeviceTypeDoorLockInverted: 20,

    /* Made up, interal types */
    DeviceTypeSecuritySystem: 254, // Has HardwareTypeVal 67 w/o any SwitchTypeVal

    /*
    DeviceTypeNotSupportedYet: 4, //x10siren
    DeviceTypeNotSupportedYet: 9, //pushon
    DeviceTypeNotSupportedYet: 10, //pushoff
    DeviceTypeNotSupportedYet: 12, //dusk
    DeviceTypeNotSupportedYet: 14, //venetianus
    DeviceTypeNotSupportedYet: 15, //venetianeu
    */
    DeviceTypeHoneywellHGI80: 39,
    HardwareTypeMQTT: 43,
}
