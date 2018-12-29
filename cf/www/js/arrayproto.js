//defined some methods for old browsers.
if (!Array.prototype.find) {
    Object.defineProperty(Array.prototype, 'find', {
        value: function (predicate) {
            if (this == null) {
                throw new TypeError('"this" is null or not defined');
            }
            var o = Object(this);
            var len = o.length >>> 0;
            if (typeof predicate !== 'function') {
                throw new TypeError('predicate must be a function');
            }
            var thisArg = arguments[1];
            var k = 0;
            while (k < len) {
                var kValue = o[k];
                if (predicate.call(thisArg, kValue, k, o)) {
                    return kValue;
                }
                k++;
            }
            return undefined;
        }
    });
}

if (!Array.prototype.findIndex) {
    Object.defineProperty(Array.prototype, 'findIndex', {
        value: function (predicate) {
            if (this == null) {
                throw new TypeError('"this" is null or not defined');
            }

            var o = Object(this);

            var len = o.length >>> 0;

            if (typeof predicate !== 'function') {
                throw new TypeError('predicate must be a function');
            }

            var thisArg = arguments[1];

            var k = 0;

            while (k < len) {
                var kValue = o[k];
                if (predicate.call(thisArg, kValue, k, o)) {
                    return k;
                }
                k++;
            }
            return -1;
        }
    });
}

if (!Array.prototype.reduce) {
    Object.defineProperty(Array.prototype, 'reduce', {
        value: function (callback /*, initialValue*/) {
            if (this === null) {
                throw new TypeError('Array.prototype.reduce ' +
                  'called on null or undefined');
            }
            if (typeof callback !== 'function') {
                throw new TypeError(callback +
                  ' is not a function');
            }

            var o = Object(this);

            var len = o.length >>> 0;

            var k = 0;
            var value;

            if (arguments.length >= 2) {
                value = arguments[1];
            } else {
                while (k < len && !(k in o)) {
                    k++;
                }

                if (k >= len) {
                    throw new TypeError('Reduce of empty array ' +
                      'with no initial value');
                }
                value = o[k++];
            }

            while (k < len) {
                if (k in o) {
                    value = callback(value, o[k], k, o);
                }

                k++;
            }
            return value;
        }
    });
}


if (!Array.prototype.indexOf) {
    Array.prototype.indexOf = function (vMember, nStartFrom) {
        if (this == null) {
            throw new TypeError("Array.prototype.indexOf() - can't convert `" + this + "` to object");
        }
        var
          nIdx = isFinite(nStartFrom) ? Math.floor(nStartFrom) : 0,
          oThis = this instanceof Object ? this : new Object(this),
          nLen = isFinite(oThis.length) ? Math.floor(oThis.length) : 0;
        if (nIdx >= nLen) {
            return -1;
        }
        if (nIdx < 0) {
            nIdx = Math.max(nLen + nIdx, 0);
        }
        if (vMember === undefined) {
            do {
                if (nIdx in oThis && oThis[nIdx] === undefined) {
                    return nIdx;
                }
            } while (++nIdx < nLen);
        } else {
            do {
                if (oThis[nIdx] === vMember) {
                    return nIdx;
                }
            } while (++nIdx < nLen);
        }
        return -1;
    };
}

if (typeof Object.assign != 'function') {
    Object.assign = function (target, varArgs) {
        'use strict';
        if (target == null) {
            throw new TypeError('Cannot convert undefined or null to object');
        }

        var to = Object(target);

        for (var index = 1; index < arguments.length; index++) {
            var nextSource = arguments[index];

            if (nextSource != null) { 
                for (var nextKey in nextSource) {
                    if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
                        to[nextKey] = nextSource[nextKey];
                    }
                }
            }
        }
        return to;
    };
}

Number.isInteger = Number.isInteger || function (value) {
    return typeof value === "number" &&
      isFinite(value) &&
      Math.floor(value) === value;
};

Number.isNaN = Number.isNaN || function (value) {
    return typeof value === "number" && isNaN(value);
}


//Config variable
var SUNOCONFIG = {
    MODE: 'Production', //Dev - Beta - Production.
    DEBUG: true //Enable console.log.
}

SUNOCONFIG.LOG = function () {
    if (SUNOCONFIG.DEBUG) {
        console.log.apply(null, arguments);
    }
}