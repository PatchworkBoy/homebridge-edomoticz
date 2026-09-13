var Constants = require('./constants.js');

var eDomoticzServices = {};

module.exports = {
    eDomoticzServices: eDomoticzServices,
    initServices: initServices
};

/*
 * initServices is called from index.js once homebridge has provided its HAP
 * references. It populates the (already exported) eDomoticzServices object
 * with ES6 class definitions. The exported object reference does not change,
 * so consumers that captured it via `require('./services.js').eDomoticzServices`
 * (e.g. lib/domoticz_accessory.js) keep working transparently.
 *
 * Order matters per the migration plan: define the 20 custom Characteristics
 * first, then the 14 custom Services that compose them.
 */
function initServices(Service, Characteristic, UUID, hap) {

    // HAP-NodeJS v1 exposed Formats / Perms / Units as static enums on the
    // Characteristic class. HAP-NodeJS v2 moved them to the module root (and
    // Characteristic.Formats / .Perms / .Units became undefined). Resolve
    // them via fallback so this plugin works on both Homebridge 1.x and 2.x.
    var Formats = (Characteristic && Characteristic.Formats) || (hap && hap.Formats);
    var Perms   = (Characteristic && Characteristic.Perms)   || (hap && hap.Perms);
    var Units   = (Characteristic && Characteristic.Units)   || (hap && hap.Units);

    if (!Formats || !Perms || !Units) {
        throw new Error(
            'homebridge-edomoticz: cannot resolve HAP Formats/Perms/Units. ' +
            'Neither Characteristic.* (HAP v1) nor hap.* (HAP v2) provided ' +
            'them. This indicates an unsupported HAP-NodeJS version.'
        );
    }

    /* ===== Custom Characteristics (20) ===== */

    // PowerMeter Characteristics
    eDomoticzServices.TotalConsumption = class extends Characteristic {
        constructor() {
            var charUUID = 'E863F10C-079E-48FF-8F27-9C2605A29F52'; //UUID.generate('eDomoticz:customchar:TotalConsumption');
            super('Total Consumption', charUUID);
            this.setProps({
                format: Formats.FLOAT,
                perms: [Perms.PAIRED_READ, Perms.NOTIFY],
                unit: 'kWh'
            });
            this.value = this.getDefaultValue();
            this.UUID = charUUID;
        }
    };

    eDomoticzServices.TodayConsumption = class extends Characteristic {
        constructor() {
            var charUUID = UUID.generate('eDomoticz:customchar:TodayConsumption');
            super('Today', charUUID);
            this.setProps({
                format: Formats.FLOAT,
                perms: [Perms.PAIRED_READ, Perms.NOTIFY],
                unit: 'kWh'
            });
            this.value = this.getDefaultValue();
            this.UUID = charUUID;
        }
    };

    eDomoticzServices.CurrentConsumption = class extends Characteristic {
        constructor() {
            var charUUID = 'E863F10D-079E-48FF-8F27-9C2605A29F52'; //UUID.generate('eDomoticz:customchar:CurrentConsumption');
            super('Consumption', charUUID);
            this.setProps({
                format: Formats.FLOAT,
                perms: [Perms.PAIRED_READ, Perms.NOTIFY],
                unit: 'W'
            });
            this.value = this.getDefaultValue();
            this.UUID = charUUID;
        }
    };

    eDomoticzServices.Ampere = class extends Characteristic {
        constructor() {
            var charUUID = 'E863F126-079E-48FF-8F27-9C2605A29F52'; //AMPERE
            super('Amps', charUUID);
            this.setProps({
                format: Formats.FLOAT,
                perms: [Perms.PAIRED_READ, Perms.NOTIFY],
                unit: 'A'
            });
            this.value = this.getDefaultValue();
            this.UUID = charUUID;
        }
    };

    eDomoticzServices.Volt = class extends Characteristic {
        constructor() {
            var charUUID = 'E863F10A-079E-48FF-8F27-9C2605A29F52'; //VOLT
            super('Volts', charUUID);
            this.setProps({
                format: Formats.FLOAT,
                perms: [Perms.PAIRED_READ, Perms.NOTIFY],
                unit: 'V'
            });
            this.value = this.getDefaultValue();
            this.UUID = charUUID;
        }
    };

    // NOTE: UUID key intentionally reuses 'CurrentConsumption' string — preserved
    // verbatim from upstream (historical collision, do not "fix").
    eDomoticzServices.GasConsumption = class extends Characteristic {
        constructor() {
            var charUUID = UUID.generate('eDomoticz:customchar:CurrentConsumption');
            super('Meter Total', charUUID);
            this.setProps({
                format: Formats.FLOAT,
                perms: [Perms.PAIRED_READ, Perms.NOTIFY]
            });
            this.value = this.getDefaultValue();
            this.UUID = charUUID;
        }
    };

    eDomoticzServices.WaterFlow = class extends Characteristic {
        constructor() {
            var charUUID = UUID.generate('eDomoticz:customchar:WaterFlow');
            super('Flow Rate', charUUID);
            this.setProps({
                format: Formats.FLOAT,
                perms: [Perms.PAIRED_READ, Perms.NOTIFY],
                unit: 'm3'
            });
            this.value = this.getDefaultValue();
            this.UUID = charUUID;
        }
    };

    eDomoticzServices.TotalWaterFlow = class extends Characteristic {
        constructor() {
            var charUUID = UUID.generate('eDomoticz:customchar:TotalWaterFlow');
            super('Flow Total', charUUID);
            this.setProps({
                format: Formats.FLOAT,
                perms: [Perms.PAIRED_READ, Perms.NOTIFY],
                unit: 'l'
            });
            this.value = this.getDefaultValue();
            this.UUID = charUUID;
        }
    };

    // Custom SetPoint Minutes characteristic for TempOverride modes
    eDomoticzServices.TempOverride = class extends Characteristic {
        constructor() {
            var charUUID = UUID.generate('eDomoticz:customchar:OverrideTime');
            super('Override (Mins, 0 = Auto, 481 = Permanent)', charUUID);
            this.setProps({
                format: Formats.FLOAT,
                maxValue: 481,
                minValue: 0,
                minStep: 1,
                unit: 'mins',
                perms: [Perms.PAIRED_READ, Perms.PAIRED_WRITE, Perms.NOTIFY]
            });
            this.value = this.getDefaultValue();
            this.UUID = charUUID;
        }
    };

    // Usage Meter Characteristics
    eDomoticzServices.CurrentUsage = class extends Characteristic {
        constructor() {
            var charUUID = UUID.generate('eDomoticz:customchar:CurrentUsage');
            super('Current Usage', charUUID);
            this.setProps({
                format: Formats.FLOAT,
                unit: Units.PERCENTAGE,
                perms: [Perms.PAIRED_READ, Perms.NOTIFY],
                minValue: 0,
                maxValue: 100,
                minStep: 0.1
            });
            this.value = this.getDefaultValue();
            this.UUID = charUUID;
        }
    };

    // Location Characteristic (sensor should have 'Location' in title)
    eDomoticzServices.Location = class extends Characteristic {
        constructor() {
            var charUUID = UUID.generate('eDomoticz:customchar:Location');
            super('Location', charUUID);
            this.setProps({
                format: Formats.STRING,
                perms: [Perms.PAIRED_READ, Perms.NOTIFY]
            });
            this.value = this.getDefaultValue();
            this.UUID = charUUID;
        }
    };

    // DarkSkies WindSpeed Characteristic
    eDomoticzServices.WindSpeed = class extends Characteristic {
        constructor() {
            var charUUID = '49C8AE5A-A3A5-41AB-BF1F-12D5654F9F41';//'9331096F-E49E-4D98-B57B-57803498FA36'; //UUID.generate('eDomoticz:customchar:WindSpeed');
            super('Wind Speed', charUUID);
            this.setProps({
                format: Formats.FLOAT,
                perms: [Perms.PAIRED_READ, Perms.NOTIFY],
                unit: 'm/s',
                minValue: 0,
                maxValue: 360,
                minStep: 0.1
            });
            this.value = this.getDefaultValue();
            this.UUID = charUUID;
        }
    };

    // DarkSkies WindChill Characteristic
    eDomoticzServices.WindChill = class extends Characteristic {
        constructor() {
            var charUUID = UUID.generate('eDomoticz:customchar:WindChill');
            super('Wind Chill', charUUID);
            this.setProps({
                format: Formats.FLOAT,
                perms: [Perms.PAIRED_READ, Perms.NOTIFY],
                unit: Units.CELSIUS,
                minValue: -50,
                maxValue: 100,
                minStep: 0.1
            });
            this.value = this.getDefaultValue();
            this.UUID = charUUID;
        }
    };

    // DarkSkies WindDirection Characteristic
    eDomoticzServices.WindDirection = class extends Characteristic {
        constructor() {
            var charUUID = '46f1284c-1912-421b-82f5-eb75008b167e';//'6C3F6DFA-7340-4ED4-AFFD-0E0310ECCD9E'; //UUID.generate('eDomoticz:customchar:WindDirection');
            super('Wind Direction', charUUID);
            this.setProps({
                format: Formats.INT,
                perms: [Perms.PAIRED_READ, Perms.NOTIFY],
                unit: Units.ARC_DEGREE,
                minValue: 0,
                maxValue: 360,
                minStep: 1
            });
            this.value = this.getDefaultValue();
            this.UUID = charUUID;
        }
    };

    // DarkSkies Rain Characteristic
    eDomoticzServices.Rainfall = class extends Characteristic {
        constructor() {
            var charUUID = 'ccc04890-565b-4376-b39a-3113341d9e0f';//'C53F35CE-C615-4AA4-9112-EBF679C5EB14'; //UUID.generate('eDomoticz:customchar:Rainfall');
            super('Amount today', charUUID);
            this.setProps({
                format: Formats.FLOAT,
                perms: [Perms.PAIRED_READ, Perms.NOTIFY],
                unit: 'mm',
                minValue: 0,
                maxValue: 360,
                minStep: 0.1
            });
            this.value = this.getDefaultValue();
            this.UUID = charUUID;
        }
    };

    // DarkSkies Visibility Characteristic
    eDomoticzServices.Visibility = class extends Characteristic {
        constructor() {
            var charUUID = 'd24ecc1e-6fad-4fb5-8137-5af88bd5e857';//UUID.generate('eDomoticz:customchar:Visibility');
            super('Distance', charUUID);
            this.setProps({
                format: Formats.FLOAT,
                perms: [Perms.PAIRED_READ, Perms.NOTIFY],
                unit: 'miles',
                minValue: 0,
                maxValue: 20,
                minStep: 0.1
            });
            this.value = this.getDefaultValue();
            this.UUID = charUUID;
        }
    };

    // DarkSkies UVIndex Characteristic
    eDomoticzServices.UVIndex = class extends Characteristic {
        constructor() {
            var charUUID = '05ba0fe0-b848-4226-906d-5b64272e05ce';//UUID.generate('eDomoticz:customchar:Visibility');
            super('UVIndex', charUUID);
            this.setProps({
                format: Formats.FLOAT,
                perms: [Perms.PAIRED_READ, Perms.NOTIFY],
                unit: 'UVI',
                minValue: 0,
                maxValue: 20,
                minStep: 0.1
            });
            this.value = this.getDefaultValue();
            this.UUID = charUUID;
        }
    };

    // DarkSkies Solar Radiation Characteristic
    eDomoticzServices.SolRad = class extends Characteristic {
        constructor() {
            var charUUID = UUID.generate('eDomoticz:customchar:SolRad');
            super('Radiation', charUUID);
            this.setProps({
                format: Formats.FLOAT,
                unit: 'W/m2',
                perms: [Perms.PAIRED_READ, Perms.NOTIFY],
                minValue: 0,
                maxValue: 10000,
                minStep: 0.1
            });
            this.value = this.getDefaultValue();
            this.UUID = charUUID;
        }
    };

    // Barometer Characteristic
    eDomoticzServices.Barometer = class extends Characteristic {
        constructor() {
            var charUUID = 'E863F10F-079E-48FF-8F27-9C2605A29F52';
            super('Pressure', charUUID);
            this.setProps({
                format: Formats.FLOAT,
                perms: [Perms.PAIRED_READ, Perms.NOTIFY],
                unit: 'hPA',
                minValue: 500,
                maxValue: 2000,
                minStep: 0.1
            });
            this.value = this.getDefaultValue();
            this.UUID = charUUID;
        }
    };

    // Infotext Characteristic (free-form string)
    eDomoticzServices.Infotext = class extends Characteristic {
        constructor() {
            var charUUID = UUID.generate('eDomoticz:customchar:Infotext');
            super('Infotext', charUUID);
            this.setProps({
                format: 'string',
                perms: [Perms.PAIRED_READ, Perms.NOTIFY]
            });
            this.value = this.getDefaultValue();
            this.UUID = charUUID;
        }
    };

    /* ===== Custom Services (14) ===== */

    // Ampere Meter
    // NOTE: serviceUUID key intentionally shared with VOLT and Meter device
    // services (historical upstream behaviour, differentiated by subtype).
    eDomoticzServices.AMPDeviceService = class extends Service {
        constructor(displayName, subtype) {
            var serviceUUID = UUID.generate('eDomoticz:powermeter:customservice');
            super(displayName, serviceUUID, subtype);
            this.addCharacteristic(new eDomoticzServices.Ampere());
        }
    };

    // Voltage Meter
    eDomoticzServices.VOLTDeviceService = class extends Service {
        constructor(displayName, subtype) {
            var serviceUUID = UUID.generate('eDomoticz:powermeter:customservice');
            super(displayName, serviceUUID, subtype);
            this.addCharacteristic(new eDomoticzServices.Volt());
        }
    };

    // The PowerMeter itself
    eDomoticzServices.MeterDeviceService = class extends Service {
        constructor(displayName, subtype) {
            var serviceUUID = UUID.generate('eDomoticz:powermeter:customservice');
            super(displayName, serviceUUID, subtype);
            this.addCharacteristic(new eDomoticzServices.CurrentConsumption());
            this.addOptionalCharacteristic(new eDomoticzServices.TotalConsumption());
            this.addOptionalCharacteristic(new eDomoticzServices.TodayConsumption());
        }
    };

    // Waterflow Meter
    eDomoticzServices.WaterDeviceService = class extends Service {
        constructor(displayName, subtype) {
            var serviceUUID = UUID.generate('eDomoticz:watermeter:customservice');
            super(displayName, serviceUUID, subtype);
            this.addCharacteristic(new eDomoticzServices.WaterFlow());
            this.addOptionalCharacteristic(new eDomoticzServices.TotalWaterFlow());
        }
    };

    // P1 Smart Meter -> Gas
    eDomoticzServices.GasDeviceService = class extends Service {
        constructor(displayName, subtype) {
            var serviceUUID = UUID.generate('eDomoticz:gasmeter:customservice');
            super(displayName, serviceUUID, subtype);
            this.addCharacteristic(new eDomoticzServices.GasConsumption());
        }
    };

    // The Usage Meter itself
    eDomoticzServices.UsageDeviceService = class extends Service {
        constructor(displayName, subtype) {
            var serviceUUID = UUID.generate('eDomoticz:usagedevice:customservice');
            super(displayName, serviceUUID, subtype);
            this.addCharacteristic(new eDomoticzServices.CurrentUsage());
        }
    };

    eDomoticzServices.LocationService = class extends Service {
        constructor(displayName, subtype) {
            var serviceUUID = UUID.generate('eDomoticz:location:customservice');
            super(displayName, serviceUUID, subtype);
            this.addCharacteristic(new eDomoticzServices.Location());
        }
    };

    // DarkSkies Virtual Wind Sensor
    eDomoticzServices.WindDeviceService = class extends Service {
        constructor(displayName, subtype) {
            var serviceUUID = '2AFB775E-79E5-4399-B3CD-398474CAE86C'; //UUID.generate('eDomoticz:winddevice:customservice');
            super(displayName, serviceUUID, subtype);
            this.addCharacteristic(new eDomoticzServices.WindSpeed());
            this.addOptionalCharacteristic(new eDomoticzServices.WindChill());
            this.addOptionalCharacteristic(new eDomoticzServices.WindDirection());
            this.addOptionalCharacteristic(new Characteristic.CurrentTemperature());
        }
    };

    // DarkSkies Rain Meter itself
    eDomoticzServices.RainDeviceService = class extends Service {
        constructor(displayName, subtype) {
            var serviceUUID = 'D92D5391-92AF-4824-AF4A-356F25F25EA1'; //UUID.generate('eDomoticz:raindevice:customservice');
            super(displayName, serviceUUID, subtype);
            this.addCharacteristic(new eDomoticzServices.Rainfall());
        }
    };

    // DarkSkies Visibility Meter itself
    eDomoticzServices.VisibilityDeviceService = class extends Service {
        constructor(displayName, subtype) {
            var serviceUUID = UUID.generate('eDomoticz:visibilitydevice:customservice');
            super(displayName, serviceUUID, subtype);
            this.addCharacteristic(new eDomoticzServices.Visibility());
        }
    };

    // DarkSkies UV Index Meter itself
    eDomoticzServices.UVDeviceService = class extends Service {
        constructor(displayName, subtype) {
            var serviceUUID = UUID.generate('eDomoticz:uvdevice:customservice');
            super(displayName, serviceUUID, subtype);
            this.addCharacteristic(new eDomoticzServices.UVIndex());
        }
    };

    // DarkSkies Solar Radiation Meter itself
    eDomoticzServices.SolRadDeviceService = class extends Service {
        constructor(displayName, subtype) {
            var serviceUUID = UUID.generate('eDomoticz:solraddevice:customservice');
            super(displayName, serviceUUID, subtype);
            this.addCharacteristic(new eDomoticzServices.SolRad());
        }
    };

    // Weather Service (Temp + Humidity + Baro composite, surfaced as Eve Weather)
    eDomoticzServices.WeatherService = class extends Service {
        constructor(displayName, subtype) {
            var serviceUUID = 'debf1b79-312e-47f7-bf82-993d9950f3a2';//'E863F001-079E-48FF-8F27-9C2605A29F52';
            super(displayName, serviceUUID, subtype);
            this.addCharacteristic(new Characteristic.CurrentTemperature());
            this.addOptionalCharacteristic(new Characteristic.CurrentRelativeHumidity());
            this.addOptionalCharacteristic(new eDomoticzServices.Barometer());
        }
    };

    // Infotext Device Service
    eDomoticzServices.InfotextDeviceService = class extends Service {
        constructor(displayName, subtype) {
            var serviceUUID = UUID.generate('eDomoticz:infotextdevice:customservice');
            super(displayName, serviceUUID, subtype);
            this.addCharacteristic(new eDomoticzServices.Infotext());
        }
    };
}
