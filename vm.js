




















var binding = process.binding('contextify');
var Script = binding.ContextifyScript;
var util = require('util');











Script.prototype.runInNewContext = function(sandbox, options) {
  var context = exports.createContext(sandbox);
  return this.runInContext(context, options);
};

exports.Script = Script;

exports.createScript = function(code, options) {
  return new Script(code, options);
};

exports.createContext = function(sandbox) {
  if (util.isUndefined(sandbox)) {
    sandbox = {};
  } else if (binding.isContext(sandbox)) {
    return sandbox;
  }

  binding.makeContext(sandbox);
  return sandbox;
};

exports.runInDebugContext = function(code) {
  return binding.runInDebugContext(code);
};

exports.runInContext = function(code, contextifiedSandbox, options) {
  var script = new Script(code, options);
  return script.runInContext(contextifiedSandbox, options);
};

exports.runInNewContext = function(code, sandbox, options) {
  var script = new Script(code, options);
  return script.runInNewContext(sandbox, options);
};

exports.runInThisContext = function(code, options) {
  var script = new Script(code, options);
  return script.runInThisContext(options);
};

exports.isContext = binding.isContext;
