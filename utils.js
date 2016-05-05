var net = require('net');

var MersenneTwister = function (seed) {
    if (seed == undefined) {
        seed = new Date().getTime();
    }
    
    this.N = 624;
    this.M = 397;
    this.MATRIX_A = 0x9908b0df;   
    this.UPPER_MASK = 0x80000000; 
    this.LOWER_MASK = 0x7fffffff; 

    this.mt = new Array(this.N); 
    this.mti = this.N + 1; 

    this.init_genrand(seed);
}


MersenneTwister.prototype.init_genrand = function (s) {
    this.mt[0] = s >>> 0;
    for (this.mti = 1; this.mti < this.N; this.mti++) {
        var s = this.mt[this.mti - 1] ^ (this.mt[this.mti - 1] >>> 30);
        this.mt[this.mti] = (((((s & 0xffff0000) >>> 16) * 1812433253) << 16) + (s & 0x0000ffff) * 1812433253)
       + this.mti;
        this.mt[this.mti] >>>= 0;
    }
}

MersenneTwister.prototype.init_by_array = function (init_key, key_length) {
    var i, j, k;
    this.init_genrand(19650218);
    i = 1; j = 0;
    k = (this.N > key_length ? this.N : key_length);
    for (; k; k--) {
        var s = this.mt[i - 1] ^ (this.mt[i - 1] >>> 30)
        this.mt[i] = (this.mt[i] ^ (((((s & 0xffff0000) >>> 16) * 1664525) << 16) + ((s & 0x0000ffff) * 1664525)))
          + init_key[j] + j; 
        this.mt[i] >>>= 0; 
        i++; j++;
        if (i >= this.N) { this.mt[0] = this.mt[this.N - 1]; i = 1; }
        if (j >= key_length) j = 0;
    }
    for (k = this.N - 1; k; k--) {
        var s = this.mt[i - 1] ^ (this.mt[i - 1] >>> 30);
        this.mt[i] = (this.mt[i] ^ (((((s & 0xffff0000) >>> 16) * 1566083941) << 16) + (s & 0x0000ffff) * 1566083941))
          - i; 
        this.mt[i] >>>= 0; 
        i++;
        if (i >= this.N) { this.mt[0] = this.mt[this.N - 1]; i = 1; }
    }

    this.mt[0] = 0x80000000; 
}


MersenneTwister.prototype.genrand_int32 = function () {
    var y;
    var mag01 = new Array(0x0, this.MATRIX_A);
    

    if (this.mti >= this.N) { 
        var kk;

        if (this.mti == this.N + 1)   
            this.init_genrand(5489); 

        for (kk = 0; kk < this.N - this.M; kk++) {
            y = (this.mt[kk] & this.UPPER_MASK) | (this.mt[kk + 1] & this.LOWER_MASK);
            this.mt[kk] = this.mt[kk + this.M] ^ (y >>> 1) ^ mag01[y & 0x1];
        }
        for (; kk < this.N - 1; kk++) {
            y = (this.mt[kk] & this.UPPER_MASK) | (this.mt[kk + 1] & this.LOWER_MASK);
            this.mt[kk] = this.mt[kk + (this.M - this.N)] ^ (y >>> 1) ^ mag01[y & 0x1];
        }
        y = (this.mt[this.N - 1] & this.UPPER_MASK) | (this.mt[0] & this.LOWER_MASK);
        this.mt[this.N - 1] = this.mt[this.M - 1] ^ (y >>> 1) ^ mag01[y & 0x1];

        this.mti = 0;
    }

    y = this.mt[this.mti++];

    
    y ^= (y >>> 11);
    y ^= (y << 7) & 0x9d2c5680;
    y ^= (y << 15) & 0xefc60000;
    y ^= (y >>> 18);

    return y >>> 0;
}


MersenneTwister.prototype.genrand_int31 = function () {
    return (this.genrand_int32() >>> 1);
}


MersenneTwister.prototype.genrand_real1 = function () {
    return this.genrand_int32() * (1.0 / 4294967295.0);
    /* divided by 2^32-1 */
}

/* generates a random number on [0,1)-real-interval */
MersenneTwister.prototype.random = function () {
    return this.genrand_int32() * (1.0 / 4294967296.0);
    
}


MersenneTwister.prototype.genrand_real3 = function () {
    return (this.genrand_int32() + 0.5) * (1.0 / 4294967296.0);
    /* divided by 2^32 */
}

/* generates a random number on [0,1) with 53-bit resolution*/
MersenneTwister.prototype.genrand_res53 = function () {
    var a = this.genrand_int32() >>> 5, b = this.genrand_int32() >>> 6;
    return (a * 67108864.0 + b) * (1.0 / 9007199254740992.0);
}



function normalize(str) {
    str = str.toString();

    if (str.length == 1)
        return "0" + str;
    else
        return str;
}

function getDateString(date) {
    return normalize(date.getDate()) + "." +
            normalize(1 + parseInt(date.getMonth())) + "." +
                date.getFullYear();
}

function getTimeString(date) {
    return normalize(date.getHours()) + ":" +
            normalize(date.getMinutes()) + ":" +
                normalize(date.getSeconds());
}

function dateToHumanTime(td) {
    try {
        var td = new Date(td);
        return getDateString(td) + ' ' + getTimeString(td);
    } catch (e) {
        return 'Invalid Date';
    }
}

function getCurrentTimstamp() {
    return Math.round(+new Date() / 1000);
}

var exports = {
    getCurrentTimstamp: getCurrentTimstamp,
    getCurrentDateString : function(){
        return dateToHumanTime(new Date())
    },
    getCurrentDateFilenameString: function () {
        return dateToHumanTime(new Date()).replace(/\.|:|\s+/g, '_');
    },
    dateToHumanTime: dateToHumanTime,
    getTimeString: getTimeString,
    getDateString : getDateString,
    MersenneTwister: MersenneTwister,
    extend: function extend(dest, source) {
        for (var prop in source) {
            dest[prop] = source[prop];
        }
    }
};



exports.basePort = 10000;
exports.nextPort = function (port) {
    return port + 1;
};

exports.getPort = function (options, callback) {
    if (!callback) {
        callback = options;
        options = {};
    }

    options.port = options.port || exports.basePort;
    options.host = options.host || null;
    options.server = options.server || net.createServer(function () {
        //
        // Create an empty listener for the port testing server.
        //
    });

    function onListen() {
        exports.basePort = options.port + 1;
        options.server.removeListener('error', onError);
        options.server.close();
        callback(null, options.port)
    }

    function onError(err) {
        options.server.removeListener('listening', onListen);

        if (err.code !== 'EADDRINUSE' && err.code !== 'EACCES') {
            return callback(err);
        }

        exports.getPort({
            port: exports.nextPort(options.port),
            host: options.host,
            server: options.server
        }, callback);
    }

    options.server.once('error', onError);
    options.server.once('listening', onListen);
    options.server.listen(options.port, options.host);
};

module.exports = exports;