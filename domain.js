




















var util = require('util');
var EventEmitter = require('events');
var inherits = util.inherits;




EventEmitter.usingDomains = true;



var _domain = [null];
Object.defineProperty(process, 'domain', {
  enumerable: true,
  get: function() {
    return _domain[0];
  },
  set: function(arg) {
    return _domain[0] = arg;
  }
});



var _domain_flag = {};


process._setupDomainUse(_domain, _domain_flag);

exports.Domain = Domain;

exports.create = exports.createDomain = function() {
  return new Domain();
};



var stack = [];
exports._stack = stack;

exports.active = null;


inherits(Domain, EventEmitter);

function Domain() {
  EventEmitter.call(this);

  this.members = [];
}

Domain.prototype.members = undefined;
Domain.prototype._disposed = undefined;



Domain.prototype._errorHandler = function errorHandler(er) {
  var caught = false;
  
  
  
  
  
  if (this._disposed)
    return true;

  if (!util.isPrimitive(er)) {
    er.domain = this;
    er.domainThrown = true;
  }
  
  try {
    
    
    
    
    
    
    
    
    caught = this.emit('error', er);

    
    
    
    stack.length = 0;
    exports.active = process.domain = null;
  } catch (er2) {
    
    
    
    
    if (this === exports.active) {
      stack.pop();
    }
    if (stack.length) {
      exports.active = process.domain = stack[stack.length - 1];
      caught = process._fatalException(er2);
    } else {
      caught = false;
    }
    return caught;
  }
  return caught;
};


Domain.prototype.enter = function() {
  if (this._disposed) return;

  
  
  exports.active = process.domain = this;
  stack.push(this);
  _domain_flag[0] = stack.length;
};


Domain.prototype.exit = function() {
  
  
  var index = stack.lastIndexOf(this);
  if (this._disposed || index === -1) return;

  
  stack.splice(index);
  _domain_flag[0] = stack.length;

  exports.active = stack[stack.length - 1];
  process.domain = exports.active;
};



Domain.prototype.add = function(ee) {
  
  if (this._disposed || ee.domain === this)
    return;

  
  if (ee.domain)
    ee.domain.remove(ee);

  
  
  
  
  
  
  
  
  
  if (this.domain && (ee instanceof Domain)) {
    for (var d = this.domain; d; d = d.domain) {
      if (ee === d) return;
    }
  }

  ee.domain = this;
  this.members.push(ee);
};


Domain.prototype.remove = function(ee) {
  ee.domain = null;
  var index = this.members.indexOf(ee);
  if (index !== -1)
    this.members.splice(index, 1);
};


Domain.prototype.run = function(fn) {
  if (this._disposed)
    return;
  this.enter();
  var ret = fn.call(this);
  this.exit();
  return ret;
};


function intercepted(_this, self, cb, fnargs) {
  if (self._disposed)
    return;

  if (fnargs[0] && fnargs[0] instanceof Error) {
    var er = fnargs[0];
    util._extend(er, {
      domainBound: cb,
      domainThrown: false,
      domain: self
    });
    self.emit('error', er);
    return;
  }

  var args = [];
  var i, ret;

  self.enter();
  if (fnargs.length > 1) {
    for (i = 1; i < fnargs.length; i++)
      args.push(fnargs[i]);
    ret = cb.apply(_this, args);
  } else {
    ret = cb.call(_this);
  }
  self.exit();

  return ret;
}


Domain.prototype.intercept = function(cb) {
  var self = this;

  function runIntercepted() {
    return intercepted(this, self, cb, arguments);
  }

  return runIntercepted;
};


function bound(_this, self, cb, fnargs) {
  if (self._disposed)
    return;

  var ret;

  self.enter();
  if (fnargs.length > 0)
    ret = cb.apply(_this, fnargs);
  else
    ret = cb.call(_this);
  self.exit();

  return ret;
}


Domain.prototype.bind = function(cb) {
  var self = this;

  function runBound() {
    return bound(this, self, cb, arguments);
  }

  runBound.domain = this;

  return runBound;
};


Domain.prototype.dispose = util.deprecate(function() {
  if (this._disposed) return;

  
  this.exit();

  
  if (this.domain) this.domain.remove(this);

  
  this.members.length = 0;

  
  
  this._disposed = true;
});
