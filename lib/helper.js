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
   stringval = stringval.replace(/[^0-9\.]+/g,'')
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
