var inherits = require('util').inherits;

module.exports = {
    Helper: Helper
}

function Helper() {

}

if (!Date.prototype.toISOString) {
  (function() {

    function pad(number) {
      if (number < 10) {
        return '0' + number;
      }
      return number;
    }

    Date.prototype.toISOString = function() {
      return this.getUTCFullYear() +
        '-' + pad(this.getUTCMonth() + 1) +
        '-' + pad(this.getUTCDate()) +
        'T' + pad(this.getUTCHours()) +
        ':' + pad(this.getUTCMinutes()) +
        ':' + pad(this.getUTCSeconds()) +
        '.' + (this.getUTCMilliseconds() / 1000).toFixed(3).slice(2, 5) +
        'Z';
    };

  }());
}

Date.prototype.addMinutes = function(h) {
  this.setTime(this.getTime() + (h*60*1000));
  return this;
};

Helper.sortByKey = function(array, key) {
    return array.sort(function(a, b) {
        var x = a[key];
        var y = b[key];
        return ((x < y) ? -1 : ((x > y) ? 1 : 0));
    });
};

Helper.oneDP = function(value) {
   var converted = value ? Math.round(value*10)/10 : 0;
   var fixed = converted.toFixed(1);
   return parseFloat(fixed);
};

Helper.cleanFloat = function(value) {
   var stringval = value ? value.toString() : "";
   stringval = stringval.replace(/[^0-9\.-]+/g,'')
   return parseFloat(stringval);
};

Helper.fixInheritance = function(subclass, superclass) {
    var proto = subclass.prototype;
    inherits(subclass, superclass);
    subclass.prototype.parent = superclass.prototype;
    for (var mn in proto) {
        subclass.prototype[mn] = proto[mn];
    }
};

Helper.HSVtoRGB = function(hsb) {
  var br = Math.round(hsb[2] / 100 * 254);
  var rgb = false;
  if (hsb[1] == 0){
    rgb = [br, br, br];
  } else {
    var hue = hsb[0] % 360;
    var f = hue % 60;
    var p = Math.round((hsb[2] * (100 - hsb[1])) / 10000 * 254);
    var q = Math.round((hsb[2] * (6000 - hsb[1] * f)) / 600000 * 254);
    var t = Math.round((hsb[2] * (6000 - hsb[1] * (60 - f))) / 600000 * 254);
    switch (Math.floor(hue / 60)){
      case 0: rgb = [br, t, p]; break;
      case 1: rgb = [q, br, p]; break;
      case 2: rgb = [p, br, t]; break;
      case 3: rgb = [p, q, br]; break;
      case 4: rgb = [t, p, br]; break;
      case 5: rgb = [br, p, q]; break;
    }
  }
  
  if (rgb)
  {
    var hex = "";
    for (var i = 0; i < 3; i++){
      var bit = (rgb[i] - 0).toString(16);
      hex += (bit.length == 1) ? '0' + bit : bit;
    }
    return hex;
  }

  return "FFFFFF";
};

Helper.Base64 = {
  _keyStr: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",
  encode: function(e) {
    var t = "";
    var n, r, i, s, o, u, a;
    var f = 0;
    e = Base64._utf8_encode(e);
    while (f < e.length) {
      n = e.charCodeAt(f++);
      r = e.charCodeAt(f++);
      i = e.charCodeAt(f++);
      s = n >> 2;
      o = (n & 3) << 4 | r >> 4;
      u = (r & 15) << 2 | i >> 6;
      a = i & 63;
      if (isNaN(r)) {
        u = a = 64;
      } else if (isNaN(i)) {
        a = 64;
      }
      t = t + this._keyStr.charAt(s) + this._keyStr.charAt(o) + this._keyStr.charAt(u) + this._keyStr.charAt(a);
    }
    return t;
  },
  _utf8_encode: function(e) {
    e = e.replace(/\r\n/g, "\n");
    var t = "";
    for (var n = 0; n < e.length; n++) {
      var r = e.charCodeAt(n);
      if (r < 128) {
        t += String.fromCharCode(r);
      } else if (r > 127 && r < 2048) {
        t += String.fromCharCode(r >> 6 | 192);
        t += String.fromCharCode(r & 63 | 128);
      } else {
        t += String.fromCharCode(r >> 12 | 224);
        t += String.fromCharCode(r >> 6 & 63 | 128);
        t += String.fromCharCode(r & 63 | 128);
      }
    }
    return t;
  }
};

Helper.LogConnectionError = function(platform, response, err)
{
  var errorMessage = "There was a problem connecting to Domoticz.";

  if (response && response.statusCode) {
    errorMessage += " (HTTP Status code " + response.statusCode + ")\n\n" + response.body;
  }
  
  if (err) {
    errorMessage += "\n- " + err;
  }

  platform.forceLog(errorMessage);
}