import Constants from './constants.js'; // kept for compatibility (may be used elsewhere later)

/**
 * Live binding: after initEDomoticzServices() runs, this object is populated
 * with Service/Characteristic classes.
 */
let eDomoticzServices = {};

/**
 * Initialize / (re)build custom services & characteristics using Homebridge HAP.
 * Call this once from index.js after you have access to homebridge.hap.
 *
 * Homebridge v2 moved enums off Characteristic.* to hap.* (Formats/Perms/Units).
 */
export function initEDomoticzServices(hap) {
  if (!hap) {
    throw new Error('initEDomoticzServices(hap) requires the Homebridge HAP object (homebridge.hap).');
  }

  const Service = hap.Service;
  const Characteristic = hap.Characteristic;
  const UUID = hap.uuid;

  // Homebridge v2 / HAP-NodeJS changes: use enums from hap instead of Characteristic.*
  const Formats = hap.Formats ?? Characteristic?.Formats;
  const Perms = hap.Perms ?? Characteristic?.Perms;
  const Units = hap.Units ?? Characteristic?.Units;

  // ---- Characteristics ----

  class TotalConsumption extends Characteristic {
    constructor() {
      const charUUID = 'E863F10C-079E-48FF-8F27-9C2605A29F52';
      super('Total Consumption', charUUID);
      this.setProps({ format: Formats.FLOAT, perms: [Perms.READ, Perms.NOTIFY], unit: 'kWh' });
      this.value = this.getDefaultValue();
      this.UUID = charUUID;
    }
  }

  class TodayConsumption extends Characteristic {
    constructor() {
      const charUUID = UUID.generate('eDomoticz:customchar:TodayConsumption');
      super('Today', charUUID);
      this.setProps({ format: Formats.FLOAT, perms: [Perms.READ, Perms.NOTIFY], unit: 'kWh' });
      this.value = this.getDefaultValue();
      this.UUID = charUUID;
    }
  }

  class CurrentConsumption extends Characteristic {
    constructor() {
      const charUUID = 'E863F10D-079E-48FF-8F27-9C2605A29F52';
      super('Consumption', charUUID);
      this.setProps({ format: Formats.FLOAT, perms: [Perms.READ, Perms.NOTIFY], unit: 'W' });
      this.value = this.getDefaultValue();
      this.UUID = charUUID;
    }
  }

  class Ampere extends Characteristic {
    constructor() {
      const charUUID = 'E863F126-079E-48FF-8F27-9C2605A29F52';
      super('Amps', charUUID);
      this.setProps({ format: Formats.FLOAT, perms: [Perms.READ, Perms.NOTIFY], unit: 'A' });
      this.value = this.getDefaultValue();
      this.UUID = charUUID;
    }
  }

  class Volt extends Characteristic {
    constructor() {
      const charUUID = 'E863F10A-079E-48FF-8F27-9C2605A29F52';
      super('Volts', charUUID);
      this.setProps({ format: Formats.FLOAT, perms: [Perms.READ, Perms.NOTIFY], unit: 'V' });
      this.value = this.getDefaultValue();
      this.UUID = charUUID;
    }
  }

  class GasConsumption extends Characteristic {
    constructor() {
      const charUUID = UUID.generate('eDomoticz:customchar:CurrentConsumption');
      super('Meter Total', charUUID);
      this.setProps({ format: Formats.FLOAT, perms: [Perms.READ, Perms.NOTIFY] });
      this.value = this.getDefaultValue();
      this.UUID = charUUID;
    }
  }

  class WaterFlow extends Characteristic {
    constructor() {
      const charUUID = UUID.generate('eDomoticz:customchar:WaterFlow');
      super('Flow Rate', charUUID);
      this.setProps({ format: Formats.FLOAT, perms: [Perms.READ, Perms.NOTIFY], unit: 'm3' });
      this.value = this.getDefaultValue();
      this.UUID = charUUID;
    }
  }

  class TotalWaterFlow extends Characteristic {
    constructor() {
      const charUUID = UUID.generate('eDomoticz:customchar:TotalWaterFlow');
      super('Flow Total', charUUID);
      this.setProps({ format: Formats.FLOAT, perms: [Perms.READ, Perms.NOTIFY], unit: 'l' });
      this.value = this.getDefaultValue();
      this.UUID = charUUID;
    }
  }

  class TempOverride extends Characteristic {
    constructor() {
      const charUUID = UUID.generate('eDomoticz:customchar:OverrideTime');
      super('Override (Mins, 0 = Auto, 481 = Permanent)', charUUID);
      this.setProps({
        format: Formats.FLOAT,
        maxValue: 481,
        minValue: 0,
        minStep: 1,
        unit: 'mins',
        perms: [Perms.READ, Perms.WRITE, Perms.NOTIFY],
      });
      this.value = this.getDefaultValue();
      this.UUID = charUUID;
    }
  }

  class CurrentUsage extends Characteristic {
    constructor() {
      const charUUID = UUID.generate('eDomoticz:customchar:CurrentUsage');
      super('Current Usage', charUUID);
      this.setProps({
        format: Formats.FLOAT,
        unit: Units?.PERCENTAGE ?? 'percentage',
        perms: [Perms.READ, Perms.NOTIFY],
        minValue: 0,
        maxValue: 100,
        minStep: 0.1,
      });
      this.value = this.getDefaultValue();
      this.UUID = charUUID;
    }
  }

  class Location extends Characteristic {
    constructor() {
      const charUUID = UUID.generate('eDomoticz:customchar:Location');
      super('Location', charUUID);
      this.setProps({ format: Formats.STRING, perms: [Perms.READ, Perms.NOTIFY] });
      this.value = this.getDefaultValue();
      this.UUID = charUUID;
    }
  }

  class WindSpeed extends Characteristic {
    constructor() {
      const charUUID = '49C8AE5A-A3A5-41AB-BF1F-12D5654F9F41';
      super('Wind Speed', charUUID);
      this.setProps({
        format: Formats.FLOAT,
        perms: [Perms.READ, Perms.NOTIFY],
        unit: 'm/s',
        minValue: 0,
        maxValue: 360,
        minStep: 0.1,
      });
      this.value = this.getDefaultValue();
      this.UUID = charUUID;
    }
  }

  class WindChill extends Characteristic {
    constructor() {
      const charUUID = UUID.generate('eDomoticz:customchar:WindChill');
      super('Wind Chill', charUUID);
      this.setProps({
        format: Formats.FLOAT,
        perms: [Perms.READ, Perms.NOTIFY],
        unit: Units?.CELSIUS ?? 'celsius',
        minValue: -50,
        maxValue: 100,
        minStep: 0.1,
      });
      this.value = this.getDefaultValue();
      this.UUID = charUUID;
    }
  }

  class WindDirection extends Characteristic {
    constructor() {
      const charUUID = '46f1284c-1912-421b-82f5-eb75008b167e';
      super('Wind Direction', charUUID);
      this.setProps({
        format: Formats.INT,
        perms: [Perms.READ, Perms.NOTIFY],
        unit: Units?.ARC_DEGREE ?? 'arcdegrees',
        minValue: 0,
        maxValue: 360,
        minStep: 1,
      });
      this.value = this.getDefaultValue();
      this.UUID = charUUID;
    }
  }

  class Rainfall extends Characteristic {
    constructor() {
      const charUUID = 'ccc04890-565b-4376-b39a-3113341d9e0f';
      super('Amount today', charUUID);
      this.setProps({
        format: Formats.FLOAT,
        perms: [Perms.READ, Perms.NOTIFY],
        unit: 'mm',
        minValue: 0,
        maxValue: 360,
        minStep: 0.1,
      });
      this.value = this.getDefaultValue();
      this.UUID = charUUID;
    }
  }

  class Visibility extends Characteristic {
    constructor() {
      const charUUID = 'd24ecc1e-6fad-4fb5-8137-5af88bd5e857';
      super('Distance', charUUID);
      this.setProps({
        format: Formats.FLOAT,
        perms: [Perms.READ, Perms.NOTIFY],
        unit: 'miles',
        minValue: 0,
        maxValue: 20,
        minStep: 0.1,
      });
      this.value = this.getDefaultValue();
      this.UUID = charUUID;
    }
  }

  class UVIndex extends Characteristic {
    constructor() {
      const charUUID = '05ba0fe0-b848-4226-906d-5b64272e05ce';
      super('UVIndex', charUUID);
      this.setProps({
        format: Formats.FLOAT,
        perms: [Perms.READ, Perms.NOTIFY],
        unit: 'UVI',
        minValue: 0,
        maxValue: 20,
        minStep: 0.1,
      });
      this.value = this.getDefaultValue();
      this.UUID = charUUID;
    }
  }

  class SolRad extends Characteristic {
    constructor() {
      const charUUID = UUID.generate('eDomoticz:customchar:SolRad');
      super('Radiation', charUUID);
      this.setProps({
        format: Formats.FLOAT,
        unit: 'W/m2',
        perms: [Perms.READ, Perms.NOTIFY],
        minValue: 0,
        maxValue: 10000,
        minStep: 0.1,
      });
      this.value = this.getDefaultValue();
      this.UUID = charUUID;
    }
  }

  class Barometer extends Characteristic {
    constructor() {
      const charUUID = 'E863F10F-079E-48FF-8F27-9C2605A29F52';
      super('Pressure', charUUID);
      this.setProps({
        format: Formats.FLOAT,
        perms: [Perms.READ, Perms.NOTIFY],
        unit: 'hPA',
        minValue: 500,
        maxValue: 2000,
        minStep: 0.1,
      });
      this.value = this.getDefaultValue();
      this.UUID = charUUID;
    }
  }

  class Infotext extends Characteristic {
    constructor() {
      const charUUID = UUID.generate('eDomoticz:customchar:Infotext');
      super('Infotext', charUUID);
      this.setProps({ format: Formats.STRING, perms: [Perms.READ, Perms.NOTIFY] });
      this.value = this.getDefaultValue();
      this.UUID = charUUID;
    }
  }

  // ---- Services ----

  class AMPDeviceService extends Service {
    constructor(displayName, subtype) {
      const serviceUUID = UUID.generate('eDomoticz:powermeter:customservice');
      super(displayName, serviceUUID, subtype);
      this.addCharacteristic(new Ampere());
    }
  }

  class VOLTDeviceService extends Service {
    constructor(displayName, subtype) {
      const serviceUUID = UUID.generate('eDomoticz:powermeter:customservice');
      super(displayName, serviceUUID, subtype);
      this.addCharacteristic(new Volt());
    }
  }

  class MeterDeviceService extends Service {
    constructor(displayName, subtype) {
      const serviceUUID = UUID.generate('eDomoticz:powermeter:customservice');
      super(displayName, serviceUUID, subtype);
      this.addCharacteristic(new CurrentConsumption());
      this.addOptionalCharacteristic(new TotalConsumption());
      this.addOptionalCharacteristic(new TodayConsumption());
    }
  }

  class WaterDeviceService extends Service {
    constructor(displayName, subtype) {
      const serviceUUID = UUID.generate('eDomoticz:watermeter:customservice');
      super(displayName, serviceUUID, subtype);
      this.addCharacteristic(new WaterFlow());
      this.addOptionalCharacteristic(new TotalWaterFlow());
    }
  }

  class GasDeviceService extends Service {
    constructor(displayName, subtype) {
      const serviceUUID = UUID.generate('eDomoticz:gasmeter:customservice');
      super(displayName, serviceUUID, subtype);
      this.addCharacteristic(new GasConsumption());
    }
  }

  class UsageDeviceService extends Service {
    constructor(displayName, subtype) {
      const serviceUUID = UUID.generate('eDomoticz:usagedevice:customservice');
      super(displayName, serviceUUID, subtype);
      this.addCharacteristic(new CurrentUsage());
    }
  }

  class LocationService extends Service {
    constructor(displayName, subtype) {
      const serviceUUID = UUID.generate('eDomoticz:location:customservice');
      super(displayName, serviceUUID, subtype);
      this.addCharacteristic(new Location());
    }
  }

  class WindDeviceService extends Service {
    constructor(displayName, subtype) {
      const serviceUUID = '2AFB775E-79E5-4399-B3CD-398474CAE86C';
      super(displayName, serviceUUID, subtype);
      this.addCharacteristic(new WindSpeed());
      this.addOptionalCharacteristic(new WindChill());
      this.addOptionalCharacteristic(new WindDirection());
      this.addOptionalCharacteristic(new Characteristic.CurrentTemperature());
    }
  }

  class RainDeviceService extends Service {
    constructor(displayName, subtype) {
      const serviceUUID = 'D92D5391-92AF-4824-AF4A-356F25F25EA1';
      super(displayName, serviceUUID, subtype);
      this.addCharacteristic(new Rainfall());
    }
  }

  class VisibilityDeviceService extends Service {
    constructor(displayName, subtype) {
      const serviceUUID = UUID.generate('eDomoticz:visibilitydevice:customservice');
      super(displayName, serviceUUID, subtype);
      this.addCharacteristic(new Visibility());
    }
  }

  class UVDeviceService extends Service {
    constructor(displayName, subtype) {
      const serviceUUID = UUID.generate('eDomoticz:uvdevice:customservice');
      super(displayName, serviceUUID, subtype);
      this.addCharacteristic(new UVIndex());
    }
  }

  class SolRadDeviceService extends Service {
    constructor(displayName, subtype) {
      const serviceUUID = UUID.generate('eDomoticz:solraddevice:customservice');
      super(displayName, serviceUUID, subtype);
      this.addCharacteristic(new SolRad());
    }
  }

  class WeatherService extends Service {
    constructor(displayName, subtype) {
      const serviceUUID = 'debf1b79-312e-47f7-bf82-993d9950f3a2';
      super(displayName, serviceUUID, subtype);
      this.addCharacteristic(new Characteristic.CurrentTemperature());
      this.addOptionalCharacteristic(new Characteristic.CurrentRelativeHumidity());
      this.addOptionalCharacteristic(new Barometer());
    }
  }

  class InfotextDeviceService extends Service {
    constructor(displayName, subtype) {
      const serviceUUID = UUID.generate('eDomoticz:infotextdevice:customservice');
      super(displayName, serviceUUID, subtype);
      this.addCharacteristic(new Infotext());
    }
  }

  // Populate the exported live-binding object (backward compatible import name)
  eDomoticzServices = {
    // characteristics
    TotalConsumption,
    TodayConsumption,
    CurrentConsumption,
    Ampere,
    Volt,
    GasConsumption,
    WaterFlow,
    TotalWaterFlow,
    TempOverride,
    CurrentUsage,
    Location,
    WindSpeed,
    WindChill,
    WindDirection,
    Rainfall,
    Visibility,
    UVIndex,
    SolRad,
    Barometer,
    Infotext,

    // services
    AMPDeviceService,
    VOLTDeviceService,
    MeterDeviceService,
    WaterDeviceService,
    GasDeviceService,
    UsageDeviceService,
    LocationService,
    WindDeviceService,
    RainDeviceService,
    VisibilityDeviceService,
    UVDeviceService,
    SolRadDeviceService,
    WeatherService,
    InfotextDeviceService,

    // keep Constants available if anything expects it from here
    Constants,
  };

  return eDomoticzServices;
}

export { eDomoticzServices };
export default eDomoticzServices;
