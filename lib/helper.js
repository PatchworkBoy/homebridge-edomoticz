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