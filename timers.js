




















var Timer = process.binding('timer_wrap').Timer;
var L = require('_linklist');
var assert = require('assert').ok;

var kOnTimeout = Timer.kOnTimeout | 0;


var TIMEOUT_MAX = 2147483647; 



var tracing = require('tracing');
var asyncFlags = tracing._asyncFlags;
var runAsyncQueue = tracing._runAsyncQueue;
var loadAsyncQueue = tracing._loadAsyncQueue;
var unloadAsyncQueue = tracing._unloadAsyncQueue;


var kHasListener = 0;


delete tracing._asyncFlags;
delete tracing._runAsyncQueue;
delete tracing._loadAsyncQueue;
delete tracing._unloadAsyncQueue;













var lists = {};


Timer.prototype._asyncQueue = undefined;
Timer.prototype._asyncData = undefined;
Timer.prototype._asyncFlags = 0;



function insert(item, msecs) {
  item._idleStart = Timer.now();
  item._idleTimeout = msecs;

  if (msecs < 0) return;

  var list;

  if (lists[msecs]) {
    list = lists[msecs];
  } else {
    list = new Timer();
    list.start(msecs, 0);

    L.init(list);

    lists[msecs] = list;
    list.msecs = msecs;
    list[kOnTimeout] = listOnTimeout;
  }

  L.append(list, item);
  assert(!L.isEmpty(list)); 
}

function listOnTimeout() {
  var msecs = this.msecs;
  var list = this;

  

  var now = Timer.now();
  

  var diff, first, hasQueue, threw;
  while (first = L.peek(list)) {
    diff = now - first._idleStart;
    if (diff < msecs) {
      list.start(msecs - diff, 0);
      
      return;
    } else {
      L.remove(first);
      assert(first !== L.peek(list));

      if (!first._onTimeout) continue;

      
      
      
      
      
      var domain = first.domain;
      if (domain && domain._disposed)
        continue;

      hasQueue = !!first._asyncQueue;

      try {
        if (hasQueue)
          loadAsyncQueue(first);
        if (domain)
          domain.enter();
        threw = true;
        first._onTimeout();
        if (domain)
          domain.exit();
        if (hasQueue)
          unloadAsyncQueue(first);
        threw = false;
      } finally {
        if (threw) {
          
          
          
          var oldDomain = process.domain;
          process.domain = null;
          process.nextTick(function() {
            list[kOnTimeout]();
          });
          process.domain = oldDomain;
        }
      }
    }
  }

  
  assert(L.isEmpty(list));
  list.close();
  delete lists[msecs];
}


var unenroll = exports.unenroll = function(item) {
  L.remove(item);

  var list = lists[item._idleTimeout];
  
  
  if (list && L.isEmpty(list)) {
    
    list.close();
    delete lists[item._idleTimeout];
  }
  
  item._idleTimeout = -1;
};



exports.enroll = function(item, msecs) {
  
  
  if (item._idleNext) unenroll(item);

  
  if (msecs > 0x7fffffff) {
    msecs = 0x7fffffff;
  }

  item._idleTimeout = msecs;
  L.init(item);
};




exports.active = function(item) {
  var msecs = item._idleTimeout;
  if (msecs >= 0) {
    var list = lists[msecs];
    if (!list || L.isEmpty(list)) {
      insert(item, msecs);
    } else {
      item._idleStart = Timer.now();
      L.append(list, item);
    }
  }
  
  
  
  if (asyncFlags[kHasListener] > 0)
    runAsyncQueue(item);
};





exports.setTimeout = function(callback, after) {
  var timer;

  after *= 1; 

  if (!(after >= 1 && after <= TIMEOUT_MAX)) {
    after = 1; 
  }

  timer = new Timeout(after);

  if (arguments.length <= 2) {
    timer._onTimeout = callback;
  } else {
    
    var args = Array.prototype.slice.call(arguments, 2);
    timer._onTimeout = function() {
      callback.apply(timer, args);
    }
  }

  if (process.domain) timer.domain = process.domain;

  exports.active(timer);

  return timer;
};


exports.clearTimeout = function(timer) {
  if (timer && (timer[kOnTimeout] || timer._onTimeout)) {
    timer[kOnTimeout] = timer._onTimeout = null;
    if (timer instanceof Timeout) {
      timer.close(); 
    } else {
      exports.unenroll(timer);
    }
  }
};


exports.setInterval = function(callback, repeat) {
  repeat *= 1; 

  if (!(repeat >= 1 && repeat <= TIMEOUT_MAX)) {
    repeat = 1; 
  }

  var timer = new Timeout(repeat);
  var args = Array.prototype.slice.call(arguments, 2);
  timer._onTimeout = wrapper;
  timer._repeat = true;

  if (process.domain) timer.domain = process.domain;
  exports.active(timer);

  return timer;

  function wrapper() {
    callback.apply(this, args);
    
    if (timer._repeat === false) return;
    
    if (this._handle) {
      this._handle.start(repeat, 0);
    } else {
      timer._idleTimeout = repeat;
      exports.active(timer);
    }
  }
};


exports.clearInterval = function(timer) {
  if (timer && timer._repeat) {
    timer._repeat = false;
    clearTimeout(timer);
  }
};


var Timeout = function(after) {
  this._idleTimeout = after;
  this._idlePrev = this;
  this._idleNext = this;
  this._idleStart = null;
  this._onTimeout = null;
  this._repeat = false;
};

Timeout.prototype.unref = function() {
  if (!this._handle) {
    var now = Timer.now();
    if (!this._idleStart) this._idleStart = now;
    var delay = this._idleStart + this._idleTimeout - now;
    if (delay < 0) delay = 0;
    exports.unenroll(this);
    this._handle = new Timer();
    this._handle[kOnTimeout] = this._onTimeout;
    this._handle.start(delay, 0);
    this._handle.domain = this.domain;
    this._handle.unref();
  } else {
    this._handle.unref();
  }
};

Timeout.prototype.ref = function() {
  if (this._handle)
    this._handle.ref();
};

Timeout.prototype.close = function() {
  this._onTimeout = null;
  if (this._handle) {
    this._handle[kOnTimeout] = null;
    this._handle.close();
  } else {
    exports.unenroll(this);
  }
};


var immediateQueue = {};
L.init(immediateQueue);


function processImmediate() {
  var queue = immediateQueue;
  var domain, hasQueue, immediate;

  immediateQueue = {};
  L.init(immediateQueue);

  while (L.isEmpty(queue) === false) {
    immediate = L.shift(queue);
    hasQueue = !!immediate._asyncQueue;
    domain = immediate.domain;

    if (hasQueue)
      loadAsyncQueue(immediate);
    if (domain)
      domain.enter();

    var threw = true;
    try {
      immediate._onImmediate();
      threw = false;
    } finally {
      if (threw) {
        if (!L.isEmpty(queue)) {
          
          
          while (!L.isEmpty(immediateQueue)) {
            L.append(queue, L.shift(immediateQueue));
          }
          immediateQueue = queue;
          process.nextTick(processImmediate);
        }
      }
    }

    if (domain)
      domain.exit();
    if (hasQueue)
      unloadAsyncQueue(immediate);
  }

  
  
  
  if (L.isEmpty(immediateQueue)) {
    process._needImmediateCallback = false;
  }
}


function Immediate() { }

Immediate.prototype.domain = undefined;
Immediate.prototype._onImmediate = undefined;
Immediate.prototype._asyncQueue = undefined;
Immediate.prototype._asyncData = undefined;
Immediate.prototype._idleNext = undefined;
Immediate.prototype._idlePrev = undefined;
Immediate.prototype._asyncFlags = 0;


exports.setImmediate = function(callback) {
  var immediate = new Immediate();
  var args, index;

  L.init(immediate);

  immediate._onImmediate = callback;

  if (arguments.length > 1) {
    args = [];
    for (index = 1; index < arguments.length; index++)
      args.push(arguments[index]);

    immediate._onImmediate = function() {
      callback.apply(immediate, args);
    };
  }

  if (!process._needImmediateCallback) {
    process._needImmediateCallback = true;
    process._immediateCallback = processImmediate;
  }

  
  if (asyncFlags[kHasListener] > 0)
    runAsyncQueue(immediate);
  if (process.domain)
    immediate.domain = process.domain;

  L.append(immediateQueue, immediate);

  return immediate;
};


exports.clearImmediate = function(immediate) {
  if (!immediate) return;

  immediate._onImmediate = undefined;

  L.remove(immediate);

  if (L.isEmpty(immediateQueue)) {
    process._needImmediateCallback = false;
  }
};





var unrefList, unrefTimer;


function unrefTimeout() {
  var now = Timer.now();

  

  var diff, domain, first, hasQueue, threw;
  while (first = L.peek(unrefList)) {
    diff = now - first._idleStart;

    if (diff < first._idleTimeout) {
      diff = first._idleTimeout - diff;
      unrefTimer.start(diff, 0);
      unrefTimer.when = now + diff;
      
      return;
    }

    L.remove(first);

    domain = first.domain;

    if (!first._onTimeout) continue;
    if (domain && domain._disposed) continue;
    hasQueue = !!first._asyncQueue;

    try {
      if (hasQueue)
        loadAsyncQueue(first);
      if (domain) domain.enter();
      threw = true;
      
      first._onTimeout();
      threw = false;
      if (domain)
        domain.exit();
      if (hasQueue)
        unloadAsyncQueue(first);
    } finally {
      if (threw) process.nextTick(unrefTimeout);
    }
  }

  
  unrefTimer.when = -1;
}


exports._unrefActive = function(item) {
  var msecs = item._idleTimeout;
  if (!msecs || msecs < 0) return;
  assert(msecs >= 0);

  L.remove(item);

  if (!unrefList) {
    
    unrefList = {};
    L.init(unrefList);

    
    unrefTimer = new Timer();
    unrefTimer.unref();
    unrefTimer.when = -1;
    unrefTimer[kOnTimeout] = unrefTimeout;
  }

  var now = Timer.now();
  item._idleStart = now;

  if (L.isEmpty(unrefList)) {
    
    L.append(unrefList, item);

    unrefTimer.start(msecs, 0);
    unrefTimer.when = now + msecs;
    
    return;
  }

  var when = now + msecs;

  

  var cur, them;

  for (cur = unrefList._idlePrev; cur != unrefList; cur = cur._idlePrev) {
    them = cur._idleStart + cur._idleTimeout;

    if (when < them) {
      

      L.append(cur, item);

      if (unrefTimer.when > when) {
        
        unrefTimer.start(msecs, 0);
        unrefTimer.when = when;
      }

      return;
    }
  }

  
  L.append(unrefList, item);
};
