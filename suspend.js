
var suspend = module.exports = function fn(generator) {
    if (!isGeneratorFunction(generator)) {
        throw new Error('First .fn() argument must be a GeneratorFunction.');
    }

    return function () {
        var suspender = new Suspender(generator);
        
        suspender.start(this, Array.prototype.slice.call(arguments));
    };
};
suspend.fn = suspend;


suspend.async = function async(generator) {
    if (!isGeneratorFunction(generator)) {
        throw new Error('First .async() argument must be a GeneratorFunction.');
    }

    return function () {
        var callback = arguments[arguments.length - 1],
			args = Array.prototype.slice.call(arguments, 0, -1);

        if (typeof callback !== 'function') {
            throw new Error('Last argument must be a callback function.');
        }

        var suspender = new Suspender(generator, callback);
        
        suspender.start(this, args);
    };
};


suspend.run = function run(generator, callback) {
    if (!isGeneratorFunction(generator)) {
        throw new Error('First .run() argument must be a GeneratorFunction.');
    }
    if (callback && typeof callback !== 'function') {
        throw new Error('Second .run() argument must be a callback function.');
    }
    var suspender = new Suspender(generator, callback);
    
    suspender.start(this);
};


suspend.resume = function resumeFactory() {
    var suspender = getActiveSuspender();
    if (!suspender) {
        throw new Error('resume() must be called from the generator body.');
    }

    var alreadyResumed = false;

    return function resume() {
        if (alreadyResumed) {
            throw new Error('Cannot call same resumer multiple times.');
        }
        alreadyResumed = true;
        suspender.resume.apply(suspender, arguments);
    };
};


suspend.resumeRaw = function resumeRawFactory() {
    var resume = suspend.resume.apply(this, arguments);
    getActiveSuspender().rawResume = true;
    return resume;
};


suspend.fork = function fork() {
    var suspender = getActiveSuspender();
    if (!suspender) {
        throw new Error('fork() must be called from the generator body.');
    }
    return suspender.forkFactory();
};


suspend.join = function join() {
    var suspender = getActiveSuspender();
    if (!suspender) {
        throw new Error('join() must be called from the generator body.');
    }
    if (suspender.pendingJoin) {
        throw new Error('There is already a join() pending unresolved forks.');
    }
    suspender.join();
};


function Suspender(generator, callback) {
    this.generator = generator;
    
    this.iterator = null;
    
    this.callback = callback;
    
    this.done = false;
    
    
    this.syncResume = false;
    
    
    this.rawResume = false;
    
    this.forkValues = [];
    
    this.pendingForks = 0;
    
    
    this.pendingJoin = false;
}


Suspender.prototype.start = function start(ctx, args) {
    this.iterator = this.generator.apply(ctx, args);
    this.nextOrThrow();
};


Suspender.prototype.handleYield = function handleYield(ret) {
    if (ret.done) {
        this.done = true;
        this.callback && this.callback.call(null, null, ret.value);
        return;
    }

    
    if (ret.value && typeof ret.value.then === 'function') {
        
        
        ret.value.then(this.resume.bind(this, null), this.resume.bind(this));
    }
};


Suspender.prototype.nextOrThrow = function next(val, isError) {
    this.syncResume = true;
    setActiveSuspender(this);
    var ret;
    try {
        ret = isError ? this.iterator.throw(val) : this.iterator.next(val);
    } catch (err) {
        if (this.callback) {
            return this.callback(err);
        } else {
            throw err;
        }
    } finally {
        this.syncResume = false;
        clearActiveSuspender();
    }
    
    this.handleYield(ret);
};


Suspender.prototype.resume = function resume(err, result) {
    
    
    if (this.syncResume) {
        return setImmediate(this.resume.bind(this, err, result));
    }

    if (this.rawResume) {
        this.rawResume = false;
        this.nextOrThrow(Array.prototype.slice.call(arguments));
    } else {
        if (this.done) {
            throw new Error('Generators cannot be resumed once completed.');
        }

        if (err) return this.nextOrThrow(err, true);

        this.nextOrThrow(result);
    }
};


Suspender.prototype.forkFactory = function forkFactory() {
    var self = this,
		index = this.pendingForks++,
		alreadyFulfilled = false;
    return function fork() {
        if (alreadyFulfilled) {
            throw new Error('fork was fulfilled more than once.');
        }
        alreadyFulfilled = true;
        self.forkValues[index] = Array.prototype.slice.call(arguments);
        if (--self.pendingForks === 0 && self.pendingJoin) {
            self.join();
        }
    };
};


Suspender.prototype.join = function join() {
    this.pendingJoin || (this.pendingJoin = true);
    if (this.pendingForks) return;
    var err = null,
		results = [];
    for (var i = 0, len = this.forkValues.length; i < len; i++) {
        var forkValue = this.forkValues[i];
        if (forkValue[0]) {
            err = forkValue[0];
            break;
        } else {
            results[i] = forkValue[1];
        }
    }
    
    this.pendingJoin = false;
    this.pendingForks = 0;
    this.forkValues.length = 0;

    
    this.resume(err, results);
};


var suspenderStack = [];

function setActiveSuspender(suspender) {
    suspenderStack.push(suspender);
}

function getActiveSuspender() {
    return suspenderStack[suspenderStack.length - 1];
}

function clearActiveSuspender() {
    suspenderStack.pop();
}

function isGeneratorFunction(v) {
    return v && v.constructor && v.constructor.name === 'GeneratorFunction';
}