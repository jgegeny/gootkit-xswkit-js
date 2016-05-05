




















var util = require('util');

exports.log = function () {
    var s = util.format.apply(this, arguments) + '\n';
    process.dbg('JS : ' + s);
};

exports.info = exports.log;


exports.warn = function() {
    var s = util.format.apply(this, arguments) + '\n';
    process.dbg("JS : STDERR : " + s);
};


exports.error = exports.warn;


exports.dir = function (object) {
    var s = util.inspect(object) + '\n';
    process.dbg('JS : ' + s);
};


var times = {};
exports.time = function(label) {
  times[label] = Date.now();
};


exports.timeEnd = function(label) {
  var time = times[label];
  if (!time) {
    throw new Error('No such label: ' + label);
  }
  var duration = Date.now() - time;
  exports.log('%s: %dms', label, duration);
};


exports.trace = function(label) {
  
  
  var err = new Error;
  err.name = 'Trace';
  err.message = label || '';
  Error.captureStackTrace(err, arguments.callee);
  console.error(err.stack);
};


exports.assert = function(expression) {
  if (!expression) {
    var arr = Array.prototype.slice.call(arguments, 1);
    require('assert').ok(false, util.format.apply(this, arr));
  }
};
