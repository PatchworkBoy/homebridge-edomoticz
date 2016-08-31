global.Service;
global.Characteristic;
global.Types;
global.UUID;

module.exports = {
    DeviceTypeSwitch: 0,
    DeviceTypeContact: 2,
    DeviceTypeBlinds: 3,
    DeviceTypeSmoke: 5,
    DeviceTypeBlindsInverted: 6,
    DeviceTypeDimmer: 7,
    DeviceTypeMotion: 8,
    DeviceTypePushOn: 9,
    DeviceTypeDoorLock: 11,
    DeviceTypeBlindsPercentage: 13,
    DeviceTypeBlindsPercentageInverted: 16,
    DeviceTypeMedia: 17 //media - only supported as on/off switch at the moment.

    /*
    DeviceTypeNotSupportedYet: 1, //doorbell
    DeviceTypeNotSupportedYet: 4, //x10siren
    DeviceTypeNotSupportedYet: 9, //pushon
    DeviceTypeNotSupportedYet: 10, //pushoff
    DeviceTypeNotSupportedYet: 11, //doorlock
    DeviceTypeNotSupportedYet: 12, //dusk
    DeviceTypeNotSupportedYet: 14, //venetianus
    DeviceTypeNotSupportedYet: 15, //venetianeu
    */
}
