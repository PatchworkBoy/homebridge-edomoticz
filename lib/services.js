global.Service;
global.Characteristic;
global.types;
global.uuid;
global.hapLegacyTypes;

module.exports = {
    eDomoticzServices: eDomoticzServices
}


function eDomoticzServices() {

}

/* Define Custom Services & Characteristics */
// PowerMeter Characteristics
eDomoticzServices.TotalConsumption = function() {
    var charUUID = 'E863F10C-079E-48FF-8F27-9C2605A29F52'; //uuid.generate('eDomoticz:customchar:TotalConsumption');
    Characteristic.call(this, 'Total Consumption', charUUID);
    this.setProps({
        format: 'string',
        perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
};
eDomoticzServices.TodayConsumption = function() {
    var charUUID = uuid.generate('eDomoticz:customchar:TodayConsumption');
    Characteristic.call(this, 'Today', charUUID);
    this.setProps({
        format: 'string',
        perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
};
eDomoticzServices.CurrentConsumption = function() {
    var charUUID = 'E863F10D-079E-48FF-8F27-9C2605A29F52'; //uuid.generate('eDomoticz:customchar:CurrentConsumption');
    Characteristic.call(this, 'Consumption', charUUID);
    this.setProps({
        format: 'string',
        perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
};
eDomoticzServices.GasConsumption = function() {
    var charUUID = uuid.generate('eDomoticz:customchar:CurrentConsumption');
    Characteristic.call(this, 'Meter Total', charUUID);
    this.setProps({
        format: 'string',
        perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
};
// Custom SetPoint Minutes characteristic for TempOverride modes
eDomoticzServices.TempOverride = function() {
    var charUUID = uuid.generate('eDomoticz:customchar:OverrideTime');
    Characteristic.call(this, 'Override (Mins, 0 = Auto, 481 = Permanent)', charUUID);
    this.setProps({
        format: 'float',
        maxValue: 481,
        minValue: 0,
        minStep: 1,
        perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
};
// The PowerMeter itself
eDomoticzServices.MeterDeviceService = function(displayName, subtype) {
    var serviceUUID = uuid.generate('eDomoticz:powermeter:customservice');
    Service.call(this, displayName, serviceUUID, subtype);
    this.addCharacteristic(new eDomoticzServices.CurrentConsumption());
    this.addOptionalCharacteristic(new eDomoticzServices.TotalConsumption());
    this.addOptionalCharacteristic(new eDomoticzServices.TodayConsumption());
};
// P1 Smart Meter -> Gas
eDomoticzServices.GasDeviceService = function(displayName, subtype) {
    var serviceUUID = uuid.generate('eDomoticz:gasmeter:customservice');
    Service.call(this, displayName, serviceUUID, subtype);
    this.addCharacteristic(new eDomoticzServices.GasConsumption());
};
// Usage Meter Characteristics
eDomoticzServices.CurrentUsage = function() {
    var charUUID = uuid.generate('eDomoticz:customchar:CurrentUsage');
    Characteristic.call(this, 'Current Usage', charUUID);
    this.setProps({
        format: 'string',
        perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
};
// The Usage Meter itself
eDomoticzServices.UsageDeviceService = function(displayName, subtype) {
    var serviceUUID = uuid.generate('eDomoticz:usagedevice:customservice');
    Service.call(this, displayName, serviceUUID, subtype);
    this.addCharacteristic(new eDomoticzServices.CurrentUsage());
};
// Location Meter (sensor should have 'Location' in title)
eDomoticzServices.LocationService = function(displayName, subtype) {
    var serviceUUID = uuid.generate('eDomoticz:location:customservice');
    Service.call(this, displayName, serviceUUID, subtype);
    this.addCharacteristic(new Characteristic.Version());
};
// DarkSkies WindSpeed Characteristic
eDomoticzServices.WindSpeed = function() {
    var charUUID = uuid.generate('eDomoticz:customchar:WindSpeed');
    Characteristic.call(this, 'Wind Speed', charUUID);
    this.setProps({
        format: 'string',
        perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
};
// DarkSkies WindChill Characteristic
eDomoticzServices.WindChill = function() {
    var charUUID = uuid.generate('eDomoticz:customchar:WindChill');
    Characteristic.call(this, 'Wind Chill', charUUID);
    this.setProps({
        format: 'string',
        perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
};
// DarkSkies WindDirection Characteristic
eDomoticzServices.WindDirection = function() {
    var charUUID = uuid.generate('eDomoticz:customchar:WindDirection');
    Characteristic.call(this, 'Wind Direction', charUUID);
    this.setProps({
        format: 'string',
        perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
};
// DarkSkies Virtual Wind Sensor
eDomoticzServices.WindDeviceService = function(displayName, subtype) {
    var serviceUUID = uuid.generate('eDomoticz:winddevice:customservice');
    Service.call(this, displayName, serviceUUID, subtype);
    this.addCharacteristic(new eDomoticzServices.WindSpeed());
    this.addOptionalCharacteristic(new eDomoticzServices.WindChill());
    this.addOptionalCharacteristic(new eDomoticzServices.WindDirection());
    this.addOptionalCharacteristic(new Characteristic.CurrentTemperature());
};
// DarkSkies Rain Characteristics
eDomoticzServices.Rainfall = function() {
    var charUUID = uuid.generate('eDomoticz:customchar:Rainfall');
    Characteristic.call(this, 'Amount today', charUUID);
    this.setProps({
        format: 'string',
        perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
};
// DarkSkies Rain Meter itself
eDomoticzServices.RainDeviceService = function(displayName, subtype) {
    var serviceUUID = uuid.generate('eDomoticz:raindevice:customservice');
    Service.call(this, displayName, serviceUUID, subtype);
    this.addCharacteristic(new eDomoticzServices.Rainfall());
};
// DarkSkies Visibility Characteristics
eDomoticzServices.Visibility = function() {
    var charUUID = uuid.generate('eDomoticz:customchar:Visibility');
    Characteristic.call(this, 'Distance', charUUID);
    this.setProps({
        format: 'string',
        perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
};
// DarkSkies Visibility Meter itself
eDomoticzServices.VisibilityDeviceService = function(displayName, subtype) {
    var serviceUUID = uuid.generate('eDomoticz:visibilitydevice:customservice');
    Service.call(this, displayName, serviceUUID, subtype);
    this.addCharacteristic(new eDomoticzServices.Visibility());
};
// DarkSkies Solar Radiation Characteristics
eDomoticzServices.SolRad = function() {
    var charUUID = uuid.generate('eDomoticz:customchar:SolRad');
    Characteristic.call(this, 'Radiation', charUUID);
    this.setProps({
        format: 'string',
        perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
};
// DarkSkies Solar Radiation Meter itself
eDomoticzServices.SolRadDeviceService = function(displayName, subtype) {
    var serviceUUID = uuid.generate('eDomoticz:solraddevice:customservice');
    Service.call(this, displayName, serviceUUID, subtype);
    this.addCharacteristic(new eDomoticzServices.SolRad());
};
// Barometer Characteristic
eDomoticzServices.Barometer = function() {
    var charUUID = uuid.generate('eDomoticz:customchar:CurrentPressure');
    Characteristic.call(this, 'Pressure', charUUID);
    this.setProps({
        format: 'string',
        perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
};
/* End of Custom Services & Characteristics */
