var fs = require('fs');
var path = require('path');

var hasOwn = Object.prototype.hasOwnProperty;
var toStr = Object.prototype.toString;

var isArray = function isArray(arr) {
   if (typeof Array.isArray === 'function') {
      return Array.isArray(arr);
   }

   return toStr.call(arr) === '[object Array]';
};

var isPlainObject = function isPlainObject(obj) {
   if (!obj || toStr.call(obj) !== '[object Object]') {
      return false;
   }

   var hasOwnConstructor = hasOwn.call(obj, 'constructor');
   var hasIsPrototypeOf = obj.constructor && obj.constructor.prototype && hasOwn.call(obj.constructor.prototype, 'isPrototypeOf');
   
   if (obj.constructor && !hasOwnConstructor && !hasIsPrototypeOf) {
      return false;
   }

   
   
   var key;
   for (key in obj) {}

   return typeof key === 'undefined' || hasOwn.call(obj, key);
};

function extend() {
   var options, name, src, copy, copyIsArray, clone,
      target = arguments[0],
      i = 1,
      length = arguments.length,
      deep = false;

   
   if (typeof target === 'boolean') {
      deep = target;
      target = arguments[1] || {};
      
      i = 2;
   } else if ((typeof target !== 'object' && typeof target !== 'function') || target == null) {
      target = {};
   }

   for (; i < length; ++i) {
      options = arguments[i];
      
      if (options != null) {
         
         for (name in options) {
            src = target[name];
            copy = options[name];

            
            if (target !== copy) {
               
               if (deep && copy && (isPlainObject(copy) || (copyIsArray = isArray(copy)))) {
                  if (copyIsArray) {
                     copyIsArray = false;
                     clone = src && isArray(src) ? src : [];
                  } else {
                     clone = src && isPlainObject(src) ? src : {};
                  }

                  
                  target[name] = extend(deep, clone, copy);

               
               } else if (typeof copy !== 'undefined') {
                  target[name] = copy;
               }
            }
         }
      }
   }

   
   return target;
};
 

var UUE = function(){
   if (!(this instanceof UUE)) return new UUE();
};

UUE.prototype.encode = function(encodeSource, encodeOptions){
   
   var options = extend(
      {},
      { mode: null, filename: null, eol: null },
      encodeOptions
   );

   if( typeof encodeSource === 'string' ){ 
      
      if( options.mode === null ){
         options.mode = (
            fs.statSync(encodeSource).mode & parseInt('777', 8)
         ).toString(8);
      } else if( typeof options.mode !== 'string' ){
         options.mode = options.mode.toString(8);
      }

      
      if( options.filename === null ){
         options.filename = path.basename(encodeSource);
      }

      
      encodeSource = fs.readFileSync(encodeSource);
   } else if( Buffer.isBuffer(encodeSource) ){ 
      
      if( options.mode === null ){
         options.mode = '644';
      } else if( typeof options.mode !== 'string' ){
         options.mode = options.mode.toString(8);
      }

      
      if( options.filename === null ) options.filename = 'buffer.bin';
   } else throw new Error(this.errors.UNKNOWN_SOURCE_TYPE);

   if( options.eol === null ) options.eol = '\n';

   
   var output = [];
   output.push('begin ');
   output.push(options.mode);
   output.push(' ');
   output.push(options.filename);
   output.push(options.eol);

   var offset = 0;
   while( offset < encodeSource.length ){
      var triplet, total, charCode;
      if( encodeSource.length - offset >= 45 ){ 
         output.push(String.fromCharCode(45 + 32));
         for( triplet = 0; triplet < 15; triplet++ ){
            total = 0;

            total += encodeSource.readUInt8(offset) << 16;
            offset++;
            total += encodeSource.readUInt8(offset) << 8;
            offset++;
            total += encodeSource.readUInt8(offset);
            offset++;

            charCode = total >>> 18;
            if( charCode === 0 ) charCode = 64;
            output.push(String.fromCharCode(charCode + 32));

            charCode = (total >>> 12) & 0x3F;
            if( charCode === 0 ) charCode = 64;
            output.push(String.fromCharCode(charCode + 32));

            charCode = (total >>> 6) & 0x3F;
            if( charCode === 0 ) charCode = 64;
            output.push(String.fromCharCode(charCode + 32));

            charCode = total & 0x3F;
            if( charCode === 0 ) charCode = 64;
            output.push(String.fromCharCode(charCode + 32));
         }
      } else { 
         output.push(String.fromCharCode(encodeSource.length - offset + 32));
         var tripletNum = ( (encodeSource.length - offset) /3 ) |0;
         for( triplet = 0; triplet < tripletNum; triplet++ ){
            total = 0;

            total += encodeSource.readUInt8(offset) << 16;
            offset++;
            total += encodeSource.readUInt8(offset) << 8;
            offset++;
            total += encodeSource.readUInt8(offset);
            offset++;

            charCode = total >>> 18;
            if( charCode === 0 ) charCode = 64;
            output.push(String.fromCharCode(charCode + 32));

            charCode = (total >>> 12) & 0x3F;
            if( charCode === 0 ) charCode = 64;
            output.push(String.fromCharCode(charCode + 32));

            charCode = (total >>> 6) & 0x3F;
            if( charCode === 0 ) charCode = 64;
            output.push(String.fromCharCode(charCode + 32));

            charCode = total & 0x3F;
            if( charCode === 0 ) charCode = 64;
            output.push(String.fromCharCode(charCode + 32));
         }
         if( offset < encodeSource.length ){ // some bytes remain
            total = 0;

            total += encodeSource.readUInt8(offset) << 16;
            offset++;
            if( offset < encodeSource.length ){
               total += encodeSource.readUInt8(offset) << 8;
               offset++;
            }
            if( offset < encodeSource.length ){
               total += encodeSource.readUInt8(offset);
               offset++;
            }

            charCode = total >>> 18;
            if( charCode === 0 ) charCode = 64;
            output.push(String.fromCharCode(charCode + 32));

            charCode = (total >>> 12) & 0x3F;
            if( charCode === 0 ) charCode = 64;
            output.push(String.fromCharCode(charCode + 32));

            charCode = (total >>> 6) & 0x3F;
            if( charCode === 0 ) charCode = 64;
            output.push(String.fromCharCode(charCode + 32));

            charCode = total & 0x3F;
            if( charCode === 0 ) charCode = 64;
            output.push(String.fromCharCode(charCode + 32));
         }
      }
      output.push(options.eol);
   }

   output.push('`');
   output.push(options.eol);
   output.push('end');
   return output.join('');
};

UUE.prototype.decodeFile = function(text, filename){
   var matches = [];
   var potentialUUE = RegExp(
      [
         '^begin [0-7]{3} ' + filename + '\n',
         '(',
         '(?:[\x20-\x60]+\n)*', // allow garbage after significant characters
         ')',
         '(?:`| )\n',
         'end$'
      ].join(''),
      'gm'
   );

   var continueSearch = true;
   do {
      var nextMatch = potentialUUE.exec(text);
      if( nextMatch === null ){
         continueSearch = false;
      } else {
         matches.push(nextMatch);
      }
   } while( continueSearch );

   if( matches.length === 0 ) return null;

   var fileFound = null;
   matches.forEach(function(nextMatch){
      if( fileFound !== null ) return;

      if( nextMatch[1].length < 1 ){
         fileFound = new Buffer(0);
         return;
      }

      var decodingError = false;
      var decoded = nextMatch[1].split('\n');
      decoded.pop(); // cut last \n (it is not a separator)
      decoded = decoded.map(function(lineUUE){
         /* jshint bitwise:false */
         if( decodingError ) return null;

         var byteLength = (lineUUE.charCodeAt(0) - 32) % 64;
         if( byteLength === 0 ) return new Buffer(0);

         var charLength = ( (byteLength / 3) |0 ) * 4;
         if( byteLength % 3 !== 0 ) charLength += 4;
         if( 1 + charLength > lineUUE.length ){
            decodingError = true;
            return null;
         }
         var targetBuffer = new Buffer(byteLength);

         var step, total;
         var stringOffset = 1;
         var bufferOffset = 0;
         for( step = 0; step < ( (charLength / 4) |0 ); step++ ){
            total = 0;

            total += ((lineUUE.charCodeAt(stringOffset) - 32) % 64) << 18;
            stringOffset++;
            total += ((lineUUE.charCodeAt(stringOffset) - 32) % 64) << 12;
            stringOffset++;
            total += ((lineUUE.charCodeAt(stringOffset) - 32) % 64) << 6;
            stringOffset++;
            total +=  (lineUUE.charCodeAt(stringOffset) - 32) % 64;
            stringOffset++;

            // noAssert === true:
            // silently apply &0xFF mask, silently drop after byteLength
            targetBuffer.writeUInt8( total >>> 16, bufferOffset, true );
            bufferOffset++;
            targetBuffer.writeUInt8( total >>> 8, bufferOffset, true );
            bufferOffset++;
            targetBuffer.writeUInt8( total, bufferOffset, true );
            bufferOffset++;
         }
         return targetBuffer;
      });
      if( decodingError ) return;

      // now `decoded` is a valid array containing buffers,
      // because `null` could appear only in `decodingError` state
      fileFound = Buffer.concat(decoded);
   });

   return fileFound;
};

UUE.prototype.decodeAllFiles = function(text){
   var allFiles = [];
   var matches = [];
   var potentialUUE = RegExp(
      [ // detail-capturing version of the RegExp from `.split`
         '^begin [0-7]{3} (\\S+?)\n',
         '(',
         '(?:[\x20-\x60]+\n)*', // allow garbage after significant characters
         ')',
         '(?:`| )\n',
         'end$'
      ].join(''),
      'gm'
   );

   var continueSearch = true;
   do {
      var nextMatch = potentialUUE.exec(text);
      if( nextMatch === null ){
         continueSearch = false;
      } else {
         matches.push(nextMatch);
      }
   } while( continueSearch );

   if( matches.length === 0 ) return [];

   matches.forEach(function(nextMatch){
      var nextFilename = nextMatch[1];
      var idxFilename = allFiles.findIndex(function(nextFile){
         return nextFile.name === nextFilename;
      });
      if( idxFilename > -1 ) return; // already found, skip it

      if( nextMatch[2].length < 1 ){
         allFiles.push({
            name: nextFilename,
            data: new Buffer(0)
         });
         return;
      }

      var decodingError = false;
      var decoded = nextMatch[2].split('\n');
      decoded.pop(); // cut last \n (it is not a separator)
      decoded = decoded.map(function(lineUUE){
         /* jshint bitwise:false */
         if( decodingError ) return null;

         var byteLength = (lineUUE.charCodeAt(0) - 32) % 64;
         if( byteLength === 0 ) return new Buffer(0);

         var charLength = ( (byteLength / 3) |0 ) * 4;
         if( byteLength % 3 !== 0 ) charLength += 4;
         if( 1 + charLength > lineUUE.length ){
            decodingError = true;
            return null;
         }
         var targetBuffer = new Buffer(byteLength);

         var step, total;
         var stringOffset = 1;
         var bufferOffset = 0;
         for( step = 0; step < ( (charLength / 4) |0 ); step++ ){
            total = 0;

            total += ((lineUUE.charCodeAt(stringOffset) - 32) % 64) << 18;
            stringOffset++;
            total += ((lineUUE.charCodeAt(stringOffset) - 32) % 64) << 12;
            stringOffset++;
            total += ((lineUUE.charCodeAt(stringOffset) - 32) % 64) << 6;
            stringOffset++;
            total +=  (lineUUE.charCodeAt(stringOffset) - 32) % 64;
            stringOffset++;

            // noAssert === true:
            // silently apply &0xFF mask, silently drop after byteLength
            targetBuffer.writeUInt8( total >>> 16, bufferOffset, true );
            bufferOffset++;
            targetBuffer.writeUInt8( total >>> 8, bufferOffset, true );
            bufferOffset++;
            targetBuffer.writeUInt8( total, bufferOffset, true );
            bufferOffset++;
         }
         return targetBuffer;
      });
      if( decodingError ) return;

      // now `decoded` is a valid array containing buffers,
      // because `null` could appear only in `decodingError` state
      allFiles.push({
         name: nextFilename,
         data: Buffer.concat(decoded)
      });
   });

   return allFiles;
};

UUE.prototype.split = function(text){
   var processUUE = this;
   var potentialUUE = RegExp(
      [ // entirely-capturing version of the RegExp from `.decodeAllFiles`
         '(',
         '^begin [0-7]{3} \\S+?\n',
         '(?:[\x20-\x60]+\n)*', // allow garbage after significant characters
         '(?:`| )\n',
         'end$',
         ')'
      ].join(''),
      'gm'
   );
   return text.split(potentialUUE).map(function(fragment, idx, arr){
      /* jshint indent: false */
      if( idx % 2 === 0 ){ // simple string fragment's index: 0, 2, 4...
         return fragment;
      } else { // regex-captured fragment's index: 1, 3, 5...
         var decodedFiles = processUUE.decodeAllFiles(fragment);
         switch( decodedFiles.length ){
            case 0:
               // incorrect UUE, append to the previous (always text) fragment
               arr[idx-1] += fragment;
               return null;
            //break;
            case 1:
               // correct UUE
               decodedFiles[0].source = fragment;
               decodedFiles[0].type = 'UUE';
               return decodedFiles[0];
            //break;
            default: throw new Error(
               processUUE.errors.UNEXPECTED_NUMBER_OF_FILES
            );
         }
      }
   }).filter(function(nextElement){
      if( nextElement === '' ) return false;
      if( nextElement === null ) return false;

      return true;
   }).reduce(function(builtArray, nextFragment){
      if( typeof nextFragment !== 'string' ){
         builtArray.push(nextFragment);
      } else { // typeof nextFragment === 'string'
         if(
            builtArray.length > 0 &&
            typeof builtArray[builtArray.length - 1] === 'string'
         ){ // the array's last element is also a string; appending:
            builtArray[builtArray.length - 1] += nextFragment;
         } else {
            builtArray.push(nextFragment);
         }
      }
      return builtArray;
   }, []);
};

UUE.prototype.errors = {
   UNKNOWN_SOURCE_TYPE: "The source's type is unknown!",
   UNEXPECTED_NUMBER_OF_FILES: "Unexpected number of files in a fragment!"
};

module.exports = new UUE();
