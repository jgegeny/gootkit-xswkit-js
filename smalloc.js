




















var smalloc = process.binding('smalloc');
var kMaxLength = smalloc.kMaxLength;
var util = require('util');

exports.alloc = alloc;
exports.copyOnto = smalloc.copyOnto;
exports.dispose = dispose;
exports.hasExternalData = smalloc.hasExternalData;



Object.defineProperty(exports, 'kMaxLength', {
  enumerable: true, value: kMaxLength, writable: false
});


var Types = {};

Object.defineProperties(Types, {
  'Int8': { enumerable: true, value: 1, writable: false },
  'Uint8': { enumerable: true, value: 2, writable: false },
  'Int16': { enumerable: true, value: 3, writable: false },
  'Uint16': { enumerable: true, value: 4, writable: false },
  'Int32': { enumerable: true, value: 5, writable: false },
  'Uint32': { enumerable: true, value: 6, writable: false },
  'Float': { enumerable: true, value: 7, writable: false },
  'Double': { enumerable: true, value: 8, writable: false },
  'Uint8Clamped': { enumerable: true, value: 9, writable: false }
});

Object.defineProperty(exports, 'Types', {
  enumerable: true, value: Types, writable: false
});



function alloc(n, obj, type) {
  n = n >>> 0;

  if (util.isUndefined(obj))
    obj = {};

  if (util.isNumber(obj)) {
    type = obj >>> 0;
    obj = {};
  } else if (util.isPrimitive(obj)) {
    throw new TypeError('obj must be an Object');
  }

  
  if (type < 1 || type > 9)
    throw new TypeError('unknown external array type: ' + type);
  if (util.isArray(obj))
    throw new TypeError('Arrays are not supported');
  if (n > kMaxLength)
    throw new RangeError('n > kMaxLength');

  return smalloc.alloc(obj, n, type);
}


function dispose(obj) {
  if (util.isPrimitive(obj))
    throw new TypeError('obj must be an Object');
  if (util.isBuffer(obj))
    throw new TypeError('obj cannot be a Buffer');

  smalloc.dispose(obj);
}
