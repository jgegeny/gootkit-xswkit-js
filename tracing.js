




















var EventEmitter = require('events');
var v8binding, process;




exports._nodeInitialization = function nodeInitialization(pobj) {
  process = pobj;
  v8binding = process.binding('v8');

  
  v8.getHeapStatistics = v8binding.getHeapStatistics;

  
  
  process._setupAsyncListener(asyncFlags,
                              runAsyncQueue,
                              loadAsyncQueue,
                              unloadAsyncQueue);

  
  delete exports._nodeInitialization;
};




var v8 = exports.v8 = new EventEmitter();


function emitGC(before, after) {
  v8.emit('gc', before, after);
}


v8.on('newListener', function(name) {
  if (name === 'gc' && EventEmitter.listenerCount(this, name) === 0) {
    v8binding.startGarbageCollectionTracking(emitGC);
  }
});


v8.on('removeListener', function(name) {
  if (name === 'gc' && EventEmitter.listenerCount(this, name) === 0) {
    v8binding.stopGarbageCollectionTracking();
  }
});








var asyncQueue = new Array();



var contextStack = new Array();
var currentContext = undefined;


var alUid = 0;



var asyncFlags = {};


var inAsyncTick = false;



var inErrorTick = false;


var kHasListener = 0;


var HAS_CREATE_AL = 1 << 0;
var HAS_BEFORE_AL = 1 << 1;
var HAS_AFTER_AL = 1 << 2;
var HAS_ERROR_AL = 1 << 3;


exports._errorHandler = errorHandler;




exports._asyncFlags = asyncFlags;
exports._runAsyncQueue = runAsyncQueue;
exports._loadAsyncQueue = loadAsyncQueue;
exports._unloadAsyncQueue = unloadAsyncQueue;


exports.createAsyncListener = createAsyncListener;
exports.addAsyncListener = addAsyncListener;
exports.removeAsyncListener = removeAsyncListener;




function loadContext(ctx) {
  contextStack.push(currentContext);
  currentContext = ctx;

  asyncFlags[kHasListener] = 1;
}

function unloadContext() {
  currentContext = contextStack.pop();

  if (currentContext === undefined && asyncQueue.length === 0)
    asyncFlags[kHasListener] = 0;
}



function runAsyncQueue(context) {
  var queue = new Array();
  var data = new Array();
  var ccQueue, i, queueItem, value;

  context._asyncQueue = queue;
  context._asyncData = data;
  context._asyncFlags = 0;

  inAsyncTick = true;

  
  
  
  if (currentContext) {
    ccQueue = currentContext._asyncQueue;
    context._asyncFlags |= currentContext._asyncFlags;
    for (i = 0; i < ccQueue.length; i++) {
      queueItem = ccQueue[i];
      queue[queue.length] = queueItem;
      if ((queueItem.callback_flags & HAS_CREATE_AL) === 0) {
        data[queueItem.uid] = queueItem.data;
        continue;
      }
      value = queueItem.create(queueItem.data);
      data[queueItem.uid] = (value === undefined) ? queueItem.data : value;
    }
  }

  
  if (asyncQueue) {
    for (i = 0; i < asyncQueue.length; i++) {
      queueItem = asyncQueue[i];
      
      
      if (data[queueItem.uid] !== undefined)
        continue;
      queue[queue.length] = queueItem;
      context._asyncFlags |= queueItem.callback_flags;
      if ((queueItem.callback_flags & HAS_CREATE_AL) === 0) {
        data[queueItem.uid] = queueItem.data;
        continue;
      }
      value = queueItem.create(queueItem.data);
      data[queueItem.uid] = (value === undefined) ? queueItem.data : value;
    }
  }

  inAsyncTick = false;
}



function loadAsyncQueue(context) {
  loadContext(context);

  if ((context._asyncFlags & HAS_BEFORE_AL) === 0)
    return;

  var queue = context._asyncQueue;
  var data = context._asyncData;
  var i, queueItem;

  inAsyncTick = true;
  for (i = 0; i < queue.length; i++) {
    queueItem = queue[i];
    if ((queueItem.callback_flags & HAS_BEFORE_AL) > 0)
      queueItem.before(context, data[queueItem.uid]);
  }
  inAsyncTick = false;
}



function unloadAsyncQueue(context) {
  if ((context._asyncFlags & HAS_AFTER_AL) === 0) {
    unloadContext();
    return;
  }

  var queue = context._asyncQueue;
  var data = context._asyncData;
  var i, queueItem;

  inAsyncTick = true;
  for (i = 0; i < queue.length; i++) {
    queueItem = queue[i];
    if ((queueItem.callback_flags & HAS_AFTER_AL) > 0)
      queueItem.after(context, data[queueItem.uid]);
  }
  inAsyncTick = false;

  unloadContext();
}





function errorHandler(er) {
  if (inErrorTick)
    return false;

  var handled = false;
  var i, queueItem, threw;

  inErrorTick = true;

  
  if (currentContext && (currentContext._asyncFlags & HAS_ERROR_AL) > 0) {
    var queue = currentContext._asyncQueue;
    var data = currentContext._asyncData;
    for (i = 0; i < queue.length; i++) {
      queueItem = queue[i];
      if ((queueItem.callback_flags & HAS_ERROR_AL) === 0)
        continue;
      try {
        threw = true;
        
        
        
        handled = queueItem.error(data[queueItem.uid], er) || handled;
        threw = false;
      } finally {
        
        
        if (threw) {
          process._exiting = true;
          process.emit('exit', 1);
        }
      }
    }
  }

  
  if (asyncQueue) {
    for (i = 0; i < asyncQueue.length; i++) {
      queueItem = asyncQueue[i];
      if ((queueItem.callback_flags & HAS_ERROR_AL) === 0 ||
          (data && data[queueItem.uid] !== undefined))
        continue;
      try {
        threw = true;
        handled = queueItem.error(queueItem.data, er) || handled;
        threw = false;
      } finally {
        
        
        if (threw) {
          process._exiting = true;
          process.emit('exit', 1);
        }
      }
    }
  }

  inErrorTick = false;

  unloadContext();

  
  

  return handled && !inAsyncTick;
}


function AsyncListenerInst(callbacks, data) {
  if (typeof callbacks.create === 'function') {
    this.create = callbacks.create;
    this.callback_flags |= HAS_CREATE_AL;
  }
  if (typeof callbacks.before === 'function') {
    this.before = callbacks.before;
    this.callback_flags |= HAS_BEFORE_AL;
  }
  if (typeof callbacks.after === 'function') {
    this.after = callbacks.after;
    this.callback_flags |= HAS_AFTER_AL;
  }
  if (typeof callbacks.error === 'function') {
    this.error = callbacks.error;
    this.callback_flags |= HAS_ERROR_AL;
  }

  this.uid = ++alUid;
  this.data = data === undefined ? null : data;
}
AsyncListenerInst.prototype.create = undefined;
AsyncListenerInst.prototype.before = undefined;
AsyncListenerInst.prototype.after = undefined;
AsyncListenerInst.prototype.error = undefined;
AsyncListenerInst.prototype.data = undefined;
AsyncListenerInst.prototype.uid = 0;
AsyncListenerInst.prototype.callback_flags = 0;





function createAsyncListener(callbacks, data) {
  if (typeof callbacks !== 'object' || callbacks == null)
    throw new TypeError('callbacks argument must be an object');

  if (callbacks instanceof AsyncListenerInst)
    return callbacks;
  else
    return new AsyncListenerInst(callbacks, data);
}


function addAsyncListener(callbacks, data) {
  
  if (!(callbacks instanceof AsyncListenerInst)) {
    callbacks = createAsyncListener(callbacks, data);
    asyncQueue.push(callbacks);
    asyncFlags[kHasListener] = 1;
    return callbacks;
  }

  var inQueue = false;
  
  for (var i = 0; i < asyncQueue.length; i++) {
    if (callbacks === asyncQueue[i]) {
      inQueue = true;
      break;
    }
  }

  
  if (!inQueue) {
    asyncQueue.push(callbacks);
    asyncFlags[kHasListener] = 1;
  }

  return callbacks;
}




function removeAsyncListener(obj) {
  for (var i = 0; i < asyncQueue.length; i++) {
    if (obj === asyncQueue[i]) {
      asyncQueue.splice(i, 1);
      break;
    }
  }

  if (asyncQueue.length > 0 || currentContext !== undefined)
    asyncFlags[kHasListener] = 1;
  else
    asyncFlags[kHasListener] = 0;
}
