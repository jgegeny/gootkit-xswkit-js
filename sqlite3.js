var path = require('path');
var sqlite3 = module.exports = exports = process.binding('sqlite3');
var EventEmitter = require('events').EventEmitter;
var util = require('util');



function extendTrace(object, property, pos) {
    var old = object[property];
    object[property] = function() {
        var error = new Error();
        var name = object.constructor.name + '#' + property + '(' + 
            Array.prototype.slice.call(arguments).map(function(el) {
                return util.inspect(el, false, 0);
            }).join(', ') + ')';

        if (typeof pos === 'undefined') pos = -1;
        if (pos < 0) pos += arguments.length;
        var cb = arguments[pos];
        if (typeof arguments[pos] === 'function') {
            arguments[pos] = function replacement() {
                try {
                    return cb.apply(this, arguments);
                } catch (err) {
                    if (err && err.stack && !err.__augmented) {
                        err.stack = filter(err).join('\n');
                        err.stack += '\n--> in ' + name;
                        err.stack += '\n' + filter(error).slice(1).join('\n');
                        err.__augmented = true;
                    }
                    throw err;
                }
            };
        }
        return old.apply(this, arguments);
    };
}

function filter(error) {
    return error.stack.split('\n').filter(function(line) {
        return line.indexOf(__filename) < 0;
    });
}


function normalizeMethod (fn) {
    return function (sql) {
        var errBack;
        var args = Array.prototype.slice.call(arguments, 1);
        if (typeof args[args.length - 1] === 'function') {
            var callback = args[args.length - 1];
            errBack = function(err) {
                if (err) {
                    callback(err);
                }
            };
        }
        var statement = new Statement(this, sql, errBack);
        return fn.call(this, statement, args);
    }
}

function inherits(target, source) {
  for (var k in source.prototype)
    target.prototype[k] = source.prototype[k];
}

sqlite3.cached = {
    Database: function(file, a, b) {
        if (file === '' || file === ':memory:') {
            
            return new Database(file, a, b);
        }

        file = path.resolve(file);

        if (!sqlite3.cached.objects[file]) {
            var db =sqlite3.cached.objects[file] = new Database(file, a, b);
        }
        else {
            
            var db = sqlite3.cached.objects[file];
            var callback = (typeof a === 'number') ? b : a;
            if (typeof callback === 'function') {
                function cb() { callback.call(db, null); }
                if (db.open) process.nextTick(cb);
                else db.once('open', cb);
            }
        }

        return db;
    },
    objects: {}
};


var Database = sqlite3.Database;
var Statement = sqlite3.Statement;

inherits(Database, EventEmitter);
inherits(Statement, EventEmitter);


Database.prototype.prepare = normalizeMethod(function(statement, params) {
    return params.length
        ? statement.bind.apply(statement, params)
        : statement;
});


Database.prototype.run = normalizeMethod(function(statement, params) {
    statement.run.apply(statement, params).finalize();
    return this;
});


Database.prototype.get = normalizeMethod(function(statement, params) {
    statement.get.apply(statement, params).finalize();
    return this;
});


Database.prototype.all = normalizeMethod(function(statement, params) {
    statement.all.apply(statement, params).finalize();
    return this;
});


Database.prototype.each = normalizeMethod(function(statement, params) {
    statement.each.apply(statement, params).finalize();
    return this;
});

Database.prototype.map = normalizeMethod(function(statement, params) {
    statement.map.apply(statement, params).finalize();
    return this;
});

Statement.prototype.map = function() {
    var params = Array.prototype.slice.call(arguments);
    var callback = params.pop();
    params.push(function(err, rows) {
        if (err) return callback(err);
        var result = {};
        if (rows.length) {
            var keys = Object.keys(rows[0]), key = keys[0];
            if (keys.length > 2) {
                
                for (var i = 0; i < rows.length; i++) {
                    result[rows[i][key]] = rows[i];
                }
            } else {
                var value = keys[1];
                
                for (var i = 0; i < rows.length; i++) {
                    result[rows[i][key]] = rows[i][value];
                }
            }
        }
        callback(err, result);
    });
    return this.all.apply(this, params);
};

var isVerbose = false;

var supportedEvents = [ 'trace', 'profile', 'insert', 'update', 'delete' ];

Database.prototype.addListener = Database.prototype.on = function(type) {
    var val = EventEmitter.prototype.addListener.apply(this, arguments);
    if (supportedEvents.indexOf(type) >= 0) {
        this.configure(type, true);
    }
    return val;
};

Database.prototype.removeListener = function(type) {
    var val = EventEmitter.prototype.removeListener.apply(this, arguments);
    if (supportedEvents.indexOf(type) >= 0 && !this._events[type]) {
        this.configure(type, false);
    }
    return val;
};

Database.prototype.removeAllListeners = function(type) {
    var val = EventEmitter.prototype.removeAllListeners.apply(this, arguments);
    if (supportedEvents.indexOf(type) >= 0) {
        this.configure(type, false);
    }
    return val;
};


sqlite3.verbose = function() {
    if (!isVerbose) {
        [
            'prepare',
            'get',
            'run',
            'all',
            'each',
            'map',
            'close',
            'exec'
        ].forEach(function (name) {
            extendTrace(Database.prototype, name);
        });
        [
            'bind',
            'get',
            'run',
            'all',
            'each',
            'map',
            'reset',
            'finalize',
        ].forEach(function (name) {
            extendTrace(Statement.prototype, name);
        });
        isVerbose = true;
    }
    return this;
};
