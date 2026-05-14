import { Agent } from 'undici';
import { Helper } from './helper.js';

let baseHeaders = {};
let dispatcher = undefined;

/**
 * Build a response-like object that Helper.LogConnectionError understands
 * (it expects { statusCode, body } like the old request module provided). [5](https://raw.githubusercontent.com/ressof/homebridge-edomoticz/refs/heads/master/lib/domoticz.js)
 */
function toLegacyResponse(statusCode, body) {
  return { statusCode, body };
}

async function fetchJson(url, { method = 'GET' } = {}) {
  const controller = new AbortController();
  // Basic safety timeout (15s). Adjust if your Domoticz is slow.
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url, {
      method,
      headers: baseHeaders,
      dispatcher,
      signal: controller.signal,
    });

    const text = await res.text();

    // Domoticz should return JSON. If not, keep text for diagnostics.
    let json;
    try {
      json = text ? JSON.parse(text) : undefined;
    } catch {
      json = undefined;
    }

    return { ok: res.ok, status: res.status, text, json };
  } finally {
    clearTimeout(timeout);
  }
}

class Domoticz {
  /**
   * Keep same signature as old code:
   * initialize(useSSL, requestHeaders)
   */
  static initialize(useSSL, requestHeaders = {}) {
    baseHeaders = requestHeaders ?? {};

    // Preserve old behavior: when SSL is used, ignore invalid certs
    // (request used agentOptions.rejectUnauthorized=false). [5](https://raw.githubusercontent.com/ressof/homebridge-edomoticz/refs/heads/master/lib/domoticz.js)
    dispatcher = useSSL
      ? new Agent({ connect: { rejectUnauthorized: false } })
      : undefined;
  }

  static settings(accessory, completion, error) {
    if (!accessory?.platform?.apiBaseURL) return;

    const url = `${accessory.platform.apiBaseURL}type=command&param=getsettings`;

    fetchJson(url, { method: 'GET' })
      .then(({ ok, status, json, text }) => {
        if (ok && json !== undefined) {
          if (completion) completion(json);
          return;
        }

        Helper.LogConnectionError(
          accessory.platform,
          toLegacyResponse(status, text),
          null
        );

        if (error) error(toLegacyResponse(status, text), null);
      })
      .catch((err) => {
        Helper.LogConnectionError(accessory.platform, null, err);
        if (error) error(null, err);
      });
  }

  static devices(baseURL, roomID, completion, error) {
    if (!baseURL) return;

    let url = `${baseURL}type=command&param=getdevices&used=true&order=Name`;
    if (roomID) url += `&plan=${roomID}`;

    fetchJson(url, { method: 'GET' })
      .then(({ ok, status, json, text }) => {
        if (ok) {
          const devices = [];
          const result = json?.result;

          if (!result) {
            if (completion) completion(devices);
            return;
          }

          const sArray = Helper.sortByKey(result, 'Name');
          sArray.forEach((s) => devices.push(s));

          if (completion) completion(devices);
          return;
        }

        if (error) error(toLegacyResponse(status, text), null);
      })
      .catch((err) => {
        if (error) error(null, err);
      });
  }

  static hardware(baseURL, completion, error) {
    if (!baseURL) return;

    const url = `${baseURL}type=command&param=gethardware`;

    fetchJson(url, { method: 'GET' })
      .then(({ ok, status, json, text }) => {
        if (ok && json?.result !== undefined) {
          const hardware = [];
          const sArray = Helper.sortByKey(json.result, 'Name');
          sArray.forEach((s) => hardware.push(s));

          if (completion) completion(hardware);
          return;
        }

        if (error) error(toLegacyResponse(status, text), null);
      })
      .catch((err) => {
        if (error) error(null, err);
      });
  }

  static deviceStatus(accessory, completion, error) {
    if (!accessory?.platform?.apiBaseURL) return;

    const url = `${accessory.platform.apiBaseURL}type=command&param=getdevices&rid=${accessory.idx}`;

    fetchJson(url, { method: 'GET' })
      .then(({ ok, status, json, text }) => {
        if (ok && json !== undefined) {
          if (!json.result) {
            accessory.platform.forceLog(
              `Could not fetch data for ${accessory.name}. (Device might have been removed?)`
            );

            if (error) error(toLegacyResponse(status, text), null);

            // Device probably removed -> trigger sync
            if (accessory?.platform?.synchronizeAccessories) {
              accessory.platform.synchronizeAccessories();
            }
            return;
          }

          accessory.platform.log(`Data received for ${accessory.name}.`);
          if (completion) completion(json);
          return;
        }

        Helper.LogConnectionError(
          accessory.platform,
          toLegacyResponse(status, text),
          null
        );
        if (error) error(toLegacyResponse(status, text), null);
      })
      .catch((err) => {
        Helper.LogConnectionError(accessory.platform, null, err);
        if (error) error(null, err);
      });
  }

  static updateDeviceStatus(accessory, command, parameters = {}, completion) {
    // MQTT fast-path remains as before
    if (accessory?.platform?.mqtt && Domoticz.isMQTTSupportedCommand(command, parameters)) {
      const message = { command, idx: parseInt(accessory.idx, 10), ...parameters };
      accessory.platform.mqtt.send(message);

      if (completion) completion(true);
      return;
    }

    let url =
      `${accessory.platform.apiBaseURL}type=command&param=${encodeURI(command)}&idx=${accessory.idx}`;

    for (const key in parameters) {
      url += `&${encodeURI(key)}=${encodeURI(parameters[key])}`;
    }

    Domoticz.updateWithURL(accessory, url, completion);
  }

  static updateWithURL(accessory, url, completion) {
    if (!url || !accessory?.platform) return;

    // Old code used PUT via request; keep PUT for compatibility. [5](https://raw.githubusercontent.com/ressof/homebridge-edomoticz/refs/heads/master/lib/domoticz.js)
    fetchJson(url, { method: 'PUT' })
      .then(({ ok, status, text }) => {
        if (ok) {
          accessory.platform.log(`${accessory.name} sent command successfully.`);
        } else {
          Helper.LogConnectionError(accessory.platform, toLegacyResponse(status, text), null);
        }

        if (completion) completion(ok);
      })
      .catch((err) => {
        Helper.LogConnectionError(accessory.platform, null, err);
        if (completion) completion(false);
      });
  }

  static isMQTTSupportedCommand(command /*, parameters */) {
    // preserve existing behavior
    return !(
      command === 'setcolbrightnessvalue' ||
      command === 'setkelvinlevel' ||
      command === 'kodimediacommand'
    );
  }
}

export { Domoticz };
export default Domoticz;
