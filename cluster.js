




















var EventEmitter = require('events').EventEmitter;
var assert = require('assert');
var dgram = require('dgram');
var fork = require('child_process').fork;
var net = require('net');
var util = require('util');
var SCHED_NONE = 1;
var SCHED_RR = 2;

var cluster = new EventEmitter;
module.exports = cluster;
cluster.Worker = Worker;
cluster.isWorker = ('NODE_UNIQUE_ID' in process.env);
cluster.isMaster = (cluster.isWorker === false);


function Worker(options) {
  if (!(this instanceof Worker))
    return new Worker(options);

  EventEmitter.call(this);

  if (!util.isObject(options))
    options = {};

  this.suicide = undefined;
  this.state = options.state || 'none';
  this.id = options.id | 0;

  if (options.process) {
    this.process = options.process;
    this.process.on('error', this.emit.bind(this, 'error'));
    this.process.on('message', this.emit.bind(this, 'message'));
  }
}
util.inherits(Worker, EventEmitter);

Worker.prototype.kill = function() {
  this.destroy.apply(this, arguments);
};

Worker.prototype.send = function() {
  this.process.send.apply(this.process, arguments);
};

Worker.prototype.isDead = function isDead() {
  return this.process.exitCode != null || this.process.signalCode != null;
};

Worker.prototype.isConnected = function isConnected() {
  return this.process.connected;
};



function SharedHandle(key, address, port, addressType, backlog, fd) {
  this.key = key;
  this.workers = [];
  this.handle = null;
  this.errno = 0;

  
  var rval;
  if (addressType === 'udp4' || addressType === 'udp6')
    rval = dgram._createSocketHandle(address, port, addressType, fd);
  else
    rval = net._createServerHandle(address, port, addressType, fd);

  if (util.isNumber(rval))
    this.errno = rval;
  else
    this.handle = rval;
}

SharedHandle.prototype.add = function(worker, send) {
  assert(this.workers.indexOf(worker) === -1);
  this.workers.push(worker);
  send(this.errno, null, this.handle);
};

SharedHandle.prototype.remove = function(worker) {
  var index = this.workers.indexOf(worker);
  assert(index !== -1);
  this.workers.splice(index, 1);
  if (this.workers.length !== 0) return false;
  this.handle.close();
  this.handle = null;
  return true;
};




function RoundRobinHandle(key, address, port, addressType, backlog, fd) {
  this.key = key;
  this.all = {};
  this.free = [];
  this.handles = [];
  this.handle = null;
  this.server = net.createServer(assert.fail);

  if (fd >= 0)
    this.server.listen({ fd: fd });
  else if (port >= 0)
    this.server.listen(port, address);
  else
    this.server.listen(address);  

  var self = this;
  this.server.once('listening', function() {
    self.handle = self.server._handle;
    self.handle.onconnection = self.distribute.bind(self);
    self.server._handle = null;
    self.server = null;
  });
}

RoundRobinHandle.prototype.add = function(worker, send) {
  assert(worker.id in this.all === false);
  this.all[worker.id] = worker;

  var self = this;
  function done() {
    if (self.handle.getsockname) {
      var out = {};
      var err = self.handle.getsockname(out);
      
      send(null, { sockname: out }, null);
    }
    else {
      send(null, null, null);  
    }
    self.handoff(worker);  
  }

  if (util.isNull(this.server)) return done();
  
  this.server.once('listening', done);
  this.server.once('error', function(err) {
    
    
    
    var errno = process.binding('uv')['UV_' + err.errno];
    send(errno, null);
  });
};

RoundRobinHandle.prototype.remove = function(worker) {
  if (worker.id in this.all === false) return false;
  delete this.all[worker.id];
  var index = this.free.indexOf(worker);
  if (index !== -1) this.free.splice(index, 1);
  if (Object.getOwnPropertyNames(this.all).length !== 0) return false;
  for (var handle; handle = this.handles.shift(); handle.close());
  this.handle.close();
  this.handle = null;
  return true;
};

RoundRobinHandle.prototype.distribute = function(err, handle) {
  this.handles.push(handle);
  var worker = this.free.shift();
  if (worker) this.handoff(worker);
};

RoundRobinHandle.prototype.handoff = function(worker) {
  if (worker.id in this.all === false) {
    return;  
  }
  var handle = this.handles.shift();
  if (util.isUndefined(handle)) {
    this.free.push(worker);  
    return;
  }
  var message = { act: 'newconn', key: this.key };
  var self = this;
  sendHelper(worker.process, message, handle, function(reply) {
    if (reply.accepted)
      handle.close();
    else
      self.distribute(0, handle);  
    self.handoff(worker);
  });
};


if (cluster.isMaster)
  masterInit();
else
  workerInit();

function masterInit() {
  cluster.workers = {};

  var intercom = new EventEmitter;
  cluster.settings = {};

  
  var schedulingPolicy = {
    'none': SCHED_NONE,
    'rr': SCHED_RR
  }[process.env.NODE_CLUSTER_SCHED_POLICY];

  if (util.isUndefined(schedulingPolicy)) {
    
    
    schedulingPolicy = (process.platform === 'win32') ? SCHED_NONE : SCHED_RR;
  }

  cluster.schedulingPolicy = schedulingPolicy;
  cluster.SCHED_NONE = SCHED_NONE;  
  cluster.SCHED_RR = SCHED_RR;      

  
  
  
  var handles = {};

  var initialized = false;
  cluster.setupMaster = function(options) {
    var settings = {
      args: process.argv.slice(2),
      exec: process.argv[1],
      execArgv: process.execArgv,
      silent: false
    };
    settings = util._extend(settings, cluster.settings);
    settings = util._extend(settings, options || {});
    
    
    
    
    if (settings.execArgv.some(function(s) { return /^--prof/.test(s); }) &&
        !settings.execArgv.some(function(s) { return /^--logfile=/.test(s); }))
    {
      settings.execArgv = settings.execArgv.concat(['--logfile=v8-%p.log']);
    }
    cluster.settings = settings;
    if (initialized === true)
      return process.nextTick(function() {
        cluster.emit('setup', settings);
      });
    initialized = true;
    schedulingPolicy = cluster.schedulingPolicy;  
    assert(schedulingPolicy === SCHED_NONE || schedulingPolicy === SCHED_RR,
           'Bad cluster.schedulingPolicy: ' + schedulingPolicy);

    process.on('internalMessage', function(message) {
      if (message.cmd !== 'NODE_DEBUG_ENABLED') return;
      var key;
      for (key in cluster.workers)
        process._debugProcess(cluster.workers[key].process.pid);
    });

    process.nextTick(function() {
      cluster.emit('setup', settings);
    });
  };

  function createWorkerProcess(id, env) {
    var workerEnv = util._extend({}, process.env);
    var execArgv = cluster.settings.execArgv.slice();
    var debugPort = process.debugPort + id;
    var hasDebugArg = false;

    workerEnv = util._extend(workerEnv, env);
    workerEnv.NODE_UNIQUE_ID = '' + id;

    for (var i = 0; i < execArgv.length; i++) {
      var match = execArgv[i].match(/^(--debug|--debug-brk)(=\d+)?$/);

      if (match) {
        execArgv[i] = match[1] + '=' + debugPort;
        hasDebugArg = true;
      }
    }

    if (!hasDebugArg)
      execArgv = ['--debug-port=' + debugPort].concat(execArgv);

    return fork(cluster.settings.exec, cluster.settings.args, {
      env: workerEnv,
      silent: cluster.settings.silent,
      execArgv: execArgv,
      gid: cluster.settings.gid,
      uid: cluster.settings.uid
    });
  }

  var ids = 0;

  cluster.fork = function(env) {
    cluster.setupMaster();
    var id = ++ids;
    var workerProcess = createWorkerProcess(id, env);
    var worker = new Worker({
      id: id,
      process: workerProcess
    });

    function removeWorker(worker) {
      assert(worker);

      delete cluster.workers[worker.id];

      if (Object.keys(cluster.workers).length === 0) {
        assert(Object.keys(handles).length === 0, 'Resource leak detected.');
        intercom.emit('disconnect');
      }
    }

    function removeHandlesForWorker(worker) {
      assert(worker);

      for (var key in handles) {
        var handle = handles[key];
        if (handle.remove(worker)) delete handles[key];
      }
    }

    worker.process.once('exit', function(exitCode, signalCode) {
      
      if (!worker.isConnected()) removeWorker(worker);

      worker.suicide = !!worker.suicide;
      worker.state = 'dead';
      worker.emit('exit', exitCode, signalCode);
      cluster.emit('exit', worker, exitCode, signalCode);
    });

    worker.process.once('disconnect', function() {
      
      removeHandlesForWorker(worker);

      
      if (worker.isDead()) removeWorker(worker);

      worker.suicide = !!worker.suicide;
      worker.state = 'disconnected';
      worker.emit('disconnect');
      cluster.emit('disconnect', worker);
    });

    worker.process.on('internalMessage', internal(worker, onmessage));
    process.nextTick(function() {
      cluster.emit('fork', worker);
    });
    cluster.workers[worker.id] = worker;
    return worker;
  };

  cluster.disconnect = function(cb) {
    var workers = Object.keys(cluster.workers);
    if (workers.length === 0) {
      process.nextTick(intercom.emit.bind(intercom, 'disconnect'));
    } else {
      for (var key in workers) {
        key = workers[key];
        cluster.workers[key].disconnect();
      }
    }
    if (cb) intercom.once('disconnect', cb);
  };

  Worker.prototype.disconnect = function() {
    this.suicide = true;
    send(this, { act: 'disconnect' });
  };

  Worker.prototype.destroy = function(signo) {
    signo = signo || 'SIGTERM';
    var proc = this.process;
    if (this.isConnected()) {
      this.once('disconnect', proc.kill.bind(proc, signo));
      this.disconnect();
      return;
    }
    proc.kill(signo);
  };

  function onmessage(message, handle) {
    var worker = this;
    if (message.act === 'online')
      online(worker);
    else if (message.act === 'queryServer')
      queryServer(worker, message);
    else if (message.act === 'listening')
      listening(worker, message);
    else if (message.act === 'suicide')
      worker.suicide = true;
    else if (message.act === 'close')
      close(worker, message);
  }

  function online(worker) {
    worker.state = 'online';
    worker.emit('online');
    cluster.emit('online', worker);
  }

  function queryServer(worker, message) {
    var args = [message.address,
                message.port,
                message.addressType,
                message.fd];
    var key = args.join(':');
    var handle = handles[key];
    if (util.isUndefined(handle)) {
      var constructor = RoundRobinHandle;
      
      
      
      if (schedulingPolicy !== SCHED_RR ||
          message.addressType === 'udp4' ||
          message.addressType === 'udp6') {
        constructor = SharedHandle;
      }
      handles[key] = handle = new constructor(key,
                                              message.address,
                                              message.port,
                                              message.addressType,
                                              message.backlog,
                                              message.fd);
    }
    if (!handle.data) handle.data = message.data;

    
    handle.add(worker, function(errno, reply, handle) {
      reply = util._extend({
        errno: errno,
        key: key,
        ack: message.seq,
        data: handles[key].data
      }, reply);
      if (errno) delete handles[key];  
      send(worker, reply, handle);
    });
  }

  function listening(worker, message) {
    var info = {
      addressType: message.addressType,
      address: message.address,
      port: message.port,
      fd: message.fd
    };
    worker.state = 'listening';
    worker.emit('listening', info);
    cluster.emit('listening', worker, info);
  }

  
  function close(worker, message) {
    var key = message.key;
    var handle = handles[key];
    if (handle.remove(worker)) delete handles[key];
  }

  function send(worker, message, handle, cb) {
    sendHelper(worker.process, message, handle, cb);
  }
}


function workerInit() {
  var handles = {};

  
  cluster._setupWorker = function() {
    var worker = new Worker({
      id: +process.env.NODE_UNIQUE_ID | 0,
      process: process,
      state: 'online'
    });
    cluster.worker = worker;
    process.once('disconnect', function() {
      if (!worker.suicide) {
        
        
        process.exit(0);
      }
    });
    process.on('internalMessage', internal(worker, onmessage));
    send({ act: 'online' });
    function onmessage(message, handle) {
      if (message.act === 'newconn')
        onconnection(message, handle);
      else if (message.act === 'disconnect')
        worker.disconnect();
    }
  };

  
  cluster._getServer = function(obj, address, port, addressType, fd, cb) {
    var message = {
      addressType: addressType,
      address: address,
      port: port,
      act: 'queryServer',
      fd: fd,
      data: null
    };
    
    if (obj._getServerData) message.data = obj._getServerData();
    send(message, function(reply, handle) {
      if (obj._setServerData) obj._setServerData(reply.data);

      if (handle)
        shared(reply, handle, cb);  
      else
        rr(reply, cb);              
    });
    obj.once('listening', function() {
      cluster.worker.state = 'listening';
      var address = obj.address();
      message.act = 'listening';
      message.port = address && address.port || port;
      send(message);
    });
  };

  
  function shared(message, handle, cb) {
    var key = message.key;
    
    
    var close = handle.close;
    handle.close = function() {
      delete handles[key];
      return close.apply(this, arguments);
    };
    assert(util.isUndefined(handles[key]));
    handles[key] = handle;
    cb(message.errno, handle);
  }

  
  function rr(message, cb) {
    if (message.errno)
      return cb(message.errno, null);

    var key = message.key;
    function listen(backlog) {
      
      
      
      return 0;
    }

    function close() {
      
      
      
      
      
      if (util.isUndefined(key)) return;
      send({ act: 'close', key: key });
      delete handles[key];
      key = undefined;
    }

    function getsockname(out) {
      if (key) util._extend(out, message.sockname);
      return 0;
    }

    
    
    
    var handle = {
      close: close,
      listen: listen
    };
    if (message.sockname) {
      handle.getsockname = getsockname;  
    }
    assert(util.isUndefined(handles[key]));
    handles[key] = handle;
    cb(0, handle);
  }

  
  function onconnection(message, handle) {
    var key = message.key;
    var server = handles[key];
    var accepted = !util.isUndefined(server);
    send({ ack: message.seq, accepted: accepted });
    if (accepted) server.onconnection(0, handle);
  }

  Worker.prototype.disconnect = function() {
    this.suicide = true;
    for (var key in handles) {
      var handle = handles[key];
      delete handles[key];
      handle.close();
    }
    process.disconnect();
  };

  Worker.prototype.destroy = function() {
    this.suicide = true;
    if (!this.isConnected()) process.exit(0);
    var exit = process.exit.bind(null, 0);
    send({ act: 'suicide' }, exit);
    process.once('disconnect', exit);
    process.disconnect();
  };

  function send(message, cb) {
    sendHelper(process, message, null, cb);
  }
}


var seq = 0;
var callbacks = {};
function sendHelper(proc, message, handle, cb) {
  
  message = util._extend({ cmd: 'NODE_CLUSTER' }, message);
  if (cb) callbacks[seq] = cb;
  message.seq = seq;
  seq += 1;
  proc.send(message, handle);
}




function internal(worker, cb) {
  return function(message, handle) {
    'use strict';

    if (message.cmd !== 'NODE_CLUSTER') return;
    var fn = cb;
    if (!util.isUndefined(message.ack)) {
      fn = callbacks[message.ack];
      delete callbacks[message.ack];
    }
    fn.apply(worker, arguments);
  };
}
