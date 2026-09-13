'use strict';
/*
 * test/load-plugin.js
 *
 * Smoke test for the Homebridge 2.x / HAP-NodeJS v2 compatibility migration.
 *
 * It does NOT load the full plugin (index.js) on purpose: index.js pulls
 * domoticz_accessory.js + request + mqtt etc., and we want a focused check
 * on the migration itself. Instead it replicates what index.js does on
 * startup -- read Service/Characteristic/uuid from HAP, call initServices --
 * and then instantiates a representative battery of subclasses.
 *
 * The original v2.1.50 plugin crashed under HAP-NodeJS v2 with:
 *     TypeError: Class constructor Service cannot be invoked without 'new'
 *         at new eDomoticzServices.MeterDeviceService (lib/services.js:133:13)
 * This test will catch any regression of that bug.
 *
 * Coverage:
 *   - Characteristic with fixed Eve UUID            -> CurrentConsumption
 *   - Characteristic with UUID.generate              -> TodayConsumption
 *   - Characteristic with historical UUID collision  -> GasConsumption
 *   - The 3 Services that share 'eDomoticz:powermeter:customservice'
 *     (differentiated only by subtype) -> AMP / VOLT / Meter
 *   - Service with fixed UUID                        -> WindDeviceService
 *   - Service that composes a HAP stock Characteristic
 *     (Characteristic.CurrentTemperature)            -> WeatherService
 *
 * Exit codes:
 *   0  -> all instantiations succeeded
 *   2  -> @homebridge/hap-nodejs not installed (run `npm install` first)
 *   3  -> initServices threw
 *   1  -> at least one instantiation threw
 */

let hap;
try {
    hap = require('@homebridge/hap-nodejs');
} catch (e) {
    console.error('FAIL: @homebridge/hap-nodejs is not installed. Run `npm install` first.');
    console.error(e && e.stack ? e.stack : e);
    process.exit(2);
}

// 1. Load the migrated services module
const Services = require('../lib/services.js');

// 2. Replicate what index.js does on startup: hand HAP refs to the factory.
//    The 4th argument (the hap module itself) lets initServices resolve the
//    Formats/Perms/Units enums under HAP v2, where they live on the module
//    root rather than on the Characteristic class.
try {
    Services.initServices(hap.Service, hap.Characteristic, hap.uuid, hap);
} catch (e) {
    console.error('FAIL: Services.initServices threw.');
    console.error(e && e.stack ? e.stack : e);
    process.exit(3);
}

const eDomoticzServices = Services.eDomoticzServices;

// 3. Instantiate representatives
const cases = [
    // --- Characteristics ---
    {
        label: 'Characteristic, fixed Eve UUID (CurrentConsumption)',
        run: function () { return new eDomoticzServices.CurrentConsumption(); },
    },
    {
        label: 'Characteristic, UUID.generate (TodayConsumption)',
        run: function () { return new eDomoticzServices.TodayConsumption(); },
    },
    {
        label: 'Characteristic, historical UUID collision (GasConsumption)',
        run: function () { return new eDomoticzServices.GasConsumption(); },
    },

    // --- The 3 Services sharing UUID 'eDomoticz:powermeter:customservice' ---
    {
        label: "Service, shared UUID key, subtype='sub-amp' (AMPDeviceService)",
        run: function () { return new eDomoticzServices.AMPDeviceService('AMP', 'sub-amp'); },
    },
    {
        label: "Service, shared UUID key, subtype='sub-volt' (VOLTDeviceService)",
        run: function () { return new eDomoticzServices.VOLTDeviceService('VOLT', 'sub-volt'); },
    },
    {
        label: "Service, shared UUID key, subtype='sub-meter' (MeterDeviceService) -- original crash site",
        run: function () { return new eDomoticzServices.MeterDeviceService('Meter', 'sub-meter'); },
    },

    // --- Other shapes ---
    {
        label: 'Service, fixed UUID (WindDeviceService)',
        run: function () { return new eDomoticzServices.WindDeviceService('Wind', 'sub-wind'); },
    },
    {
        label: 'Service composing HAP stock + custom Characteristic (WeatherService)',
        run: function () { return new eDomoticzServices.WeatherService('Weather', 'sub-weather'); },
    },
];

let ok = 0;
let failed = 0;
const collisionUUIDs = [];

for (const c of cases) {
    try {
        const inst = c.run();
        if (!inst) throw new Error('instance is falsy');
        ok++;
        // Capture the UUID of the three colliding services so we can assert
        // afterwards that they really do share the same UUID and differ only
        // in subtype (the historical upstream invariant).
        if (/AMPDeviceService|VOLTDeviceService|MeterDeviceService/.test(c.label)) {
            collisionUUIDs.push({ label: c.label.split(' (')[1].replace(')', ''), uuid: inst.UUID, subtype: inst.subtype });
        }
        console.log('  OK   ' + c.label + '  ->  UUID=' + inst.UUID + (inst.subtype ? ', subtype=' + inst.subtype : ''));
    } catch (e) {
        failed++;
        const stack = e && e.stack ? e.stack.split('\n').slice(0, 4).join('\n         ') : String(e);
        console.error('  FAIL ' + c.label);
        console.error('         ' + stack);
    }
}

// Assert every custom Characteristic is readable on the wire.
// HAP-NodeJS v2 removed the deprecated Perms.READ / Perms.WRITE aliases
// (only PAIRED_READ / PAIRED_WRITE remain), so a stale alias silently
// resolves to undefined and the characteristic is published with
// perms [null, "ev"]. iOS rejects the whole bridge at pairing with
// "Accessory out of compliance" (upstream PR #297 report), and HAP-NodeJS
// itself answers reads with WRITE_ONLY_CHARACTERISTIC. Regression guard.
{
    const hapPerms = hap.Perms || (hap.Characteristic && hap.Characteristic.Perms);
    const PR = hapPerms.PAIRED_READ;
    let checked = 0;
    let bad = [];
    for (const name of Object.keys(eDomoticzServices)) {
        const Ctor = eDomoticzServices[name];
        if (typeof Ctor !== 'function' || !(Ctor.prototype instanceof hap.Characteristic)) continue;
        const inst = new Ctor();
        checked++;
        const perms = (inst.props && inst.props.perms) || [];
        if (perms.some(function (x) { return x == null; }) || perms.indexOf(PR) === -1) {
            bad.push(name + ' perms=' + JSON.stringify(perms));
        }
    }
    if (bad.length) {
        failed++;
        console.error('  FAIL perms invariant: ' + bad.length + ' custom Characteristic(s) not readable / have null perms:');
        bad.forEach(function (b) { console.error('         ' + b); });
    } else {
        console.log('  OK   perms invariant: ' + checked + ' custom Characteristics all carry PAIRED_READ and no null perms');
    }
}

// Assert cached characteristics with poisoned perms get healed on restore.
// Simulates what Homebridge hands to configureAccessory: a PlatformAccessory
// whose services were deserialized from cachedAccessories, where custom
// characteristics are generic hap.Characteristic instances carrying the
// persisted props. A cache written by 3.0.0-3.0.2 under HAP v2 has
// perms [null, "ev"]; Helper.healCustomCharacteristicPerms must fix exactly
// those and leave healthy ones (and non-perms props) alone.
{
    const Helper = require('../lib/helper.js').Helper;
    const hapPerms = hap.Perms || (hap.Characteristic && hap.Characteristic.Perms);
    const PR = hapPerms.PAIRED_READ;
    const good = new eDomoticzServices.Barometer();
    const poisoned = hap.Characteristic.deserialize({
        displayName: good.displayName,
        UUID: good.UUID,
        props: { format: good.props.format, unit: good.props.unit, perms: [null, 'ev'] },
        value: 1013,
    });
    const healthy = hap.Characteristic.deserialize({
        displayName: 'Consumption',
        UUID: new eDomoticzServices.CurrentConsumption().UUID,
        props: { format: 'float', unit: 'W', perms: [PR, 'ev'] },
        value: 12,
    });
    const svc = new hap.Service('Cached Weather', new eDomoticzServices.WeatherService('x').UUID, 'sub');
    svc.addCharacteristic(poisoned);
    svc.addCharacteristic(healthy);
    const fakePlatformAccessory = { services: [svc] };

    const healed = Helper.healCustomCharacteristicPerms(fakePlatformAccessory, eDomoticzServices, hap.Characteristic, PR);
    const after = poisoned.props.perms;
    const problems = [];
    if (healed !== 1) problems.push('expected exactly 1 healed characteristic, got ' + healed);
    if (after.indexOf(PR) === -1 || after.some(function (x) { return x == null; })) problems.push('poisoned perms not repaired: ' + JSON.stringify(after));
    if (poisoned.props.unit !== good.props.unit) problems.push('unit was altered: ' + poisoned.props.unit);
    if (JSON.stringify(healthy.props.perms) !== JSON.stringify([PR, 'ev'])) problems.push('healthy perms were altered: ' + JSON.stringify(healthy.props.perms));
    const second = Helper.healCustomCharacteristicPerms(fakePlatformAccessory, eDomoticzServices, hap.Characteristic, PR);
    if (second !== 0) problems.push('heal is not idempotent, second pass healed ' + second);
    if (problems.length) {
        failed++;
        console.error('  FAIL cache heal:');
        problems.forEach(function (m) { console.error('         ' + m); });
    } else {
        console.log('  OK   cache heal: poisoned [null,"ev"] -> ' + JSON.stringify(after) + ', healthy untouched, idempotent');
    }
}

// Assert the historical collision is preserved: same UUID across the 3
// services, distinct subtypes.
if (failed === 0 && collisionUUIDs.length === 3) {
    const uniqueUUIDs = new Set(collisionUUIDs.map(function (x) { return x.uuid; }));
    const uniqueSubtypes = new Set(collisionUUIDs.map(function (x) { return x.subtype; }));
    if (uniqueUUIDs.size !== 1) {
        failed++;
        console.error('  FAIL collision invariant: the 3 powermeter services should share one UUID, got ' + uniqueUUIDs.size + ' distinct UUIDs.');
    } else if (uniqueSubtypes.size !== 3) {
        failed++;
        console.error('  FAIL collision invariant: subtypes should be distinct, got ' + uniqueSubtypes.size + '.');
    } else {
        console.log('  OK   collision invariant: 3 services share UUID ' + Array.from(uniqueUUIDs)[0] + ' with 3 distinct subtypes');
    }
}

if (failed) {
    console.error('\n' + failed + ' check(s) failed.');
    process.exit(1);
}

console.log('\nOK: ' + ok + ' instanciaciones completadas');
console.log('Carga + instanciacion OK');
process.exit(0);
