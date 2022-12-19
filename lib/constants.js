global.Service;
global.Characteristic;
global.Categories;
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
    DeviceTypeMedia: 17,
    DeviceTypeSelector: 18,
    DeviceTypeDoorLock: 19,
    DeviceTypeDoorLockInverted: 20,
    DeviceTypeBlindsPlusStop: 21,

    /* Made up, internal types */
    DeviceTypeSecuritySystem: 254, // Has HardwareTypeVal 67 w/o any SwitchTypeVal

    /*
    DeviceTypeNotSupportedYet: 4, //x10siren
    DeviceTypeNotSupportedYet: 10, //pushoff
    DeviceTypeNotSupportedYet: 12, //dusk
    */
    DeviceTypeHoneywellHGI80: 39,
    HardwareTypeMQTT: 43,
}
