import { inherits } from 'node:util';

class Helper {
  // Intentionally empty: used as a namespace for static methods in this project.
}

// Keep the old polyfill behavior (it won't run on modern Node,
// but leaving it doesn't harm and preserves intent).
if (!Date.prototype.toISOString) {
  (function () {
    function pad(number) {
      if (number < 10) {
        return `0${number}`;
      }
      return number;
    }

    Date.prototype.toISOString = function () {
      return (
        this.getUTCFullYear() +
        '-' +
        pad(this.getUTCMonth() + 1) +
        '-' +
        pad(this.getUTCDate()) +
        'T' +
        pad(this.getUTCHours()) +
        ':' +
        pad(this.getUTCMinutes()) +
        ':' +
        pad(this.getUTCSeconds()) +
        '.' +
        (this.getUTCMilliseconds() / 1000).toFixed(3).slice(2, 5) +
        'Z'
      );
    };
  })();
}

Date.prototype.addMinutes = function (h) {
  this.setTime(this.getTime() + h * 60 * 1000);
  return this;
};

Helper.sortByKey = function (array, key) {
  return array.sort(function (a, b) {
    const x = a[key];
    const y = b[key];
    return x < y ? -1 : x > y ? 1 : 0;
  });
};

Helper.oneDP = function (value) {
  const converted = value ? Math.round(value * 10) / 10 : 0;
  const fixed = converted.toFixed(1);
  return Number.parseFloat(fixed);
};

Helper.cleanFloat = function (value) {
  let stringval = value ? value.toString() : '';
  stringval = stringval.replace(/[^0-9\.-]+/g, '');
  return Number.parseFloat(stringval);
};

Helper.fixInheritance = function (subclass, superclass) {
  const proto = subclass.prototype;
  inherits(subclass, superclass);
  subclass.prototype.parent = superclass.prototype;

  for (const mn in proto) {
    subclass.prototype[mn] = proto[mn];
  }
};

Helper.HSVtoRGB = function (hsb) {
  const br = Math.round((hsb[2] / 100) * 254);
  let rgb = null;

  if (hsb[1] == 0) {
    rgb = [br, br, br];
  } else {
    const hue = hsb[0] % 360;
    const f = hue % 60;

    const p = Math.round(((hsb[2] * (100 - hsb[1])) / 10000) * 254);
    const q = Math.round(((hsb[2] * (6000 - hsb[1] * f)) / 600000) * 254);
    const t = Math.round(((hsb[2] * (6000 - hsb[1] * (60 - f))) / 600000) * 254);

    switch (Math.floor(hue / 60)) {
      case 0:
        rgb = [br, t, p];
        break;
      case 1:
        rgb = [q, br, p];
        break;
      case 2:
        rgb = [p, br, t];
        break;
      case 3:
        rgb = [p, q, br];
        break;
      case 4:
        rgb = [t, p, br];
        break;
      case 5:
        rgb = [br, p, q];
        break;
      default:
        rgb = null;
        break;
    }
  }

  if (rgb) {
    let hex = '';
    for (let i = 0; i < 3; i++) {
      const bit = (rgb[i] - 0).toString(16);
      hex += bit.length === 1 ? `0${bit}` : bit;
    }
    return hex;
  }

  return 'FFFFFF';
};

Helper.Base64 = {
  _keyStr: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=',
  encode: function (e) {
    let t = '';
    let n, r, i, s, o, u, a;
    let f = 0;

    e = Helper.Base64._utf8_encode(e);

    while (f < e.length) {
      n = e.charCodeAt(f++);
      r = e.charCodeAt(f++);
      i = e.charCodeAt(f++);

      s = n >> 2;
      o = ((n & 3) << 4) | (r >> 4);
      u = ((r & 15) << 2) | (i >> 6);
      a = i & 63;

      if (Number.isNaN(r)) {
        u = a = 64;
      } else if (Number.isNaN(i)) {
        a = 64;
      }

      t =
        t +
        this._keyStr.charAt(s) +
        this._keyStr.charAt(o) +
        this._keyStr.charAt(u) +
        this._keyStr.charAt(a);
    }

    return t;
  },

  _utf8_encode: function (e) {
    e = e.replace(/\r\n/g, '\n');
    let t = '';

    for (let n = 0; n < e.length; n++) {
      const r = e.charCodeAt(n);

      if (r < 128) {
        t += String.fromCharCode(r);
      } else if (r > 127 && r < 2048) {
        t += String.fromCharCode((r >> 6) | 192);
        t += String.fromCharCode((r & 63) | 128);
      } else {
        t += String.fromCharCode((r >> 12) | 224);
        t += String.fromCharCode(((r >> 6) & 63) | 128);
        t += String.fromCharCode((r & 63) | 128);
      }
    }

    return t;
  }
};

Helper.LogConnectionError = function (platform, response, err) {
  let errorMessage = 'There was a problem connecting to Domoticz.';

  if (response && response.statusCode) {
    errorMessage += ` (HTTP Status code ${response.statusCode})\n\n${response.body}`;
  }
  if (err) {
    errorMessage += `\n- ${err}`;
  }

  platform.forceLog(errorMessage);
};

export { Helper };
export default Helper;
