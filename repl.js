






















var util = require('util');
var inherits = require('util').inherits;
var Stream = require('stream');
var vm = require('vm');
var path = require('path');
var fs = require('fs');
var rl = require('readline');
var Console = require('console').Console;
var domain = require('domain');





function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}



module.filename = path.resolve('repl');


module.paths = require('module')._nodeModulePaths(module.filename);



exports.writer = util.inspect;

exports._builtinLibs = ['assert', 'buffer', 'child_process', 'cluster',
  'crypto', 'dgram', 'dns', 'domain', 'events', 'fs', 'http', 'https', 'net',
  'os', 'path', 'punycode', 'querystring', 'readline', 'stream',
  'string_decoder', 'tls', 'tty', 'url', 'util', 'vm', 'zlib', 'smalloc',
  'tracing'];


function REPLServer(prompt, stream, eval_, useGlobal, ignoreUndefined) {
  if (!(this instanceof REPLServer)) {
    return new REPLServer(prompt, stream, eval_, useGlobal, ignoreUndefined);
  }

  var options, input, output, dom;
  if (util.isObject(prompt)) {
    
    options = prompt;
    stream = options.stream || options.socket;
    input = options.input;
    output = options.output;
    eval_ = options.eval;
    useGlobal = options.useGlobal;
    ignoreUndefined = options.ignoreUndefined;
    prompt = options.prompt;
    dom = options.domain;
  } else if (!util.isString(prompt)) {
    throw new Error('An options Object, or a prompt String are required');
  } else {
    options = {};
  }

  var self = this;

  self._domain = dom || domain.create();

  self.useGlobal = !!useGlobal;
  self.ignoreUndefined = !!ignoreUndefined;

  
  self.rli = this;

  eval_ = eval_ || defaultEval;

  function defaultEval(code, context, file, cb) {
    var err, result;
    
    try {
      var script = vm.createScript(code, {
        filename: file,
        displayErrors: false
      });
    } catch (e) {
      
      if (isRecoverableError(e))
        err = new Recoverable(e);
      else
        err = e;
    }

    if (!err) {
      try {
        if (self.useGlobal) {
          result = script.runInThisContext({ displayErrors: false });
        } else {
          result = script.runInContext(context, { displayErrors: false });
        }
      } catch (e) {
        err = e;
        if (err && process.domain) {
          
          process.domain.emit('error', err);
          process.domain.exit();
          return;
        }
      }
    }

    cb(err, result);
  }

  self.eval = self._domain.bind(eval_);

  self._domain.on('error', function(e) {
    
    self.outputStream.write((e.stack || e) + '\n');
    self.bufferedCommand = '';
    self.lines.level = [];
    self.displayPrompt();
  });

  if (!input && !output) {
    
    if (!stream) {
      
      stream = process;
    }
    if (stream.stdin && stream.stdout) {
      
      input = stream.stdin;
      output = stream.stdout;
    } else {
      
      input = stream;
      output = stream;
    }
  }

  self.inputStream = input;
  self.outputStream = output;

  self.resetContext();
  self.bufferedCommand = '';
  self.lines.level = [];

  function complete(text, callback) {
    self.complete(text, callback);
  }

  rl.Interface.apply(this, [
    self.inputStream,
    self.outputStream,
    complete,
    options.terminal
  ]);

  self.setPrompt(!util.isUndefined(prompt) ? prompt : '> ');

  this.commands = {};
  defineDefaultCommands(this);

  
  self.writer = options.writer || exports.writer;

  if (util.isUndefined(options.useColors)) {
    options.useColors = self.terminal;
  }
  self.useColors = !!options.useColors;

  if (self.useColors && self.writer === util.inspect) {
    
    self.writer = function(obj, showHidden, depth) {
      return util.inspect(obj, showHidden, depth, true);
    };
  }

  self.setPrompt(self._prompt);

  self.on('close', function() {
    self.emit('exit');
  });

  var sawSIGINT = false;
  self.on('SIGINT', function() {
    var empty = self.line.length === 0;
    self.clearLine();

    if (!(self.bufferedCommand && self.bufferedCommand.length > 0) && empty) {
      if (sawSIGINT) {
        self.close();
        sawSIGINT = false;
        return;
      }
      self.output.write('(^C again to quit)\n');
      sawSIGINT = true;
    } else {
      sawSIGINT = false;
    }

    self.bufferedCommand = '';
    self.lines.level = [];
    self.displayPrompt();
  });

  self.on('line', function(cmd) {
    
    sawSIGINT = false;
    var skipCatchall = false;
    cmd = trimWhitespace(cmd);

    
    
    if (cmd && cmd.charAt(0) === '.' && isNaN(parseFloat(cmd))) {
      var matches = cmd.match(/^\.([^\s]+)\s*(.*)$/);
      var keyword = matches && matches[1];
      var rest = matches && matches[2];
      if (self.parseREPLKeyword(keyword, rest) === true) {
        return;
      } else {
        self.outputStream.write('Invalid REPL keyword\n');
        skipCatchall = true;
      }
    }

    if (!skipCatchall) {
      var evalCmd = self.bufferedCommand + cmd;
      if (/^\s*\{/.test(evalCmd) && /\}\s*$/.test(evalCmd)) {
        
        
        
        
        evalCmd = '(' + evalCmd + ')\n';
      } else {
        
        
        
        evalCmd = evalCmd + '\n';
      }

      
      self.eval(evalCmd, self.context, 'repl', finish);
    } else {
      finish(null);
    }

    function finish(e, ret) {
      
      self.memory(cmd);

      if (e && !self.bufferedCommand && cmd.trim().match(/^npm /)) {
        self.outputStream.write('npm should be run outside of the ' +
                                'node repl, in your normal shell.\n' +
                                '(Press Control-D to exit.)\n');
        self.bufferedCommand = '';
        self.displayPrompt();
        return;
      }

      
      if (e) {
        if (e instanceof Recoverable) {
          
          
          
          
          self.bufferedCommand += cmd + '\n';
          self.displayPrompt();
          return;
        } else {
          self._domain.emit('error', e);
        }
      }

      
      self.bufferedCommand = '';

      
      if (!e && (!self.ignoreUndefined || !util.isUndefined(ret))) {
        self.context._ = ret;
        self.outputStream.write(self.writer(ret) + '\n');
      }

      
      self.displayPrompt();
    };
  });

  self.on('SIGCONT', function() {
    self.displayPrompt(true);
  });

  self.displayPrompt();
}
inherits(REPLServer, rl.Interface);
exports.REPLServer = REPLServer;




exports.start = function(prompt, source, eval_, useGlobal, ignoreUndefined) {
  var repl = new REPLServer(prompt, source, eval_, useGlobal, ignoreUndefined);
  if (!exports.repl) exports.repl = repl;
  return repl;
};

REPLServer.prototype.createContext = function() {
  var context;
  if (this.useGlobal) {
    context = global;
  } else {
    context = vm.createContext();
    for (var i in global) context[i] = global[i];
    context.console = new Console(this.outputStream);
    context.global = context;
    context.global.global = context;
  }

  context.module = module;
  context.require = require;

  this.lines = [];
  this.lines.level = [];

  
  
  exports._builtinLibs.forEach(function(name) {
    Object.defineProperty(context, name, {
      get: function() {
        var lib = require(name);
        context._ = context[name] = lib;
        return lib;
      },
      
      set: function(val) {
        delete context[name];
        context[name] = val;
      },
      configurable: true
    });
  });

  return context;
};

REPLServer.prototype.resetContext = function() {
  this.context = this.createContext();

  
  this.emit('reset', this.context);
};

REPLServer.prototype.displayPrompt = function(preserveCursor) {
  var prompt = this._initialPrompt;
  if (this.bufferedCommand.length) {
    prompt = '...';
    var levelInd = new Array(this.lines.level.length).join('..');
    prompt += levelInd + ' ';
  }

  
  REPLServer.super_.prototype.setPrompt.call(this, prompt);
  this.prompt(preserveCursor);
};


REPLServer.prototype.setPrompt = function setPrompt(prompt) {
  this._initialPrompt = prompt;
  REPLServer.super_.prototype.setPrompt.call(this, prompt);
};



function ArrayStream() {
  Stream.call(this);

  this.run = function(data) {
    var self = this;
    data.forEach(function(line) {
      self.emit('data', line + '\n');
    });
  }
}
util.inherits(ArrayStream, Stream);
ArrayStream.prototype.readable = true;
ArrayStream.prototype.writable = true;
ArrayStream.prototype.resume = function() {};
ArrayStream.prototype.write = function() {};

var requireRE = /\brequire\s*\(['"](([\w\.\/-]+\/)?([\w\.\/-]*))/;
var simpleExpressionRE =
    /(([a-zA-Z_$](?:\w|\$)*)\.)*([a-zA-Z_$](?:\w|\$)*)\.?$/;












REPLServer.prototype.complete = function(line, callback) {
  
  if (!util.isUndefined(this.bufferedCommand) && this.bufferedCommand.length) {
    
    var tmp = this.lines.slice();
    
    
    this.lines.level.forEach(function(kill) {
      if (kill.isFunction) {
        tmp[kill.line] = '';
      }
    });
    var flat = new ArrayStream();         
    var magic = new REPLServer('', flat); 
    magic.context = magic.createContext();
    flat.run(tmp);                        
    
    
    if (!magic.bufferedCommand) {
      return magic.complete(line, callback);
    }
  }

  var completions;

  
  var completionGroups = [];

  var completeOn, match, filter, i, group, c;

  
  var match = null;
  match = line.match(/^\s*(\.\w*)$/);
  if (match) {
    completionGroups.push(Object.keys(this.commands));
    completeOn = match[1];
    if (match[1].length > 1) {
      filter = match[1];
    }

    completionGroupsLoaded();
  } else if (match = line.match(requireRE)) {
    
    var exts = Object.keys(require.extensions);
    var indexRe = new RegExp('^index(' + exts.map(regexpEscape).join('|') +
                             ')$');

    completeOn = match[1];
    var subdir = match[2] || '';
    var filter = match[1];
    var dir, files, f, name, base, ext, abs, subfiles, s;
    group = [];
    var paths = module.paths.concat(require('module').globalPaths);
    for (i = 0; i < paths.length; i++) {
      dir = path.resolve(paths[i], subdir);
      try {
        files = fs.readdirSync(dir);
      } catch (e) {
        continue;
      }
      for (f = 0; f < files.length; f++) {
        name = files[f];
        ext = path.extname(name);
        base = name.slice(0, -ext.length);
        if (base.match(/-\d+\.\d+(\.\d+)?/) || name === '.npm') {
          
          continue;
        }
        if (exts.indexOf(ext) !== -1) {
          if (!subdir || base !== 'index') {
            group.push(subdir + base);
          }
        } else {
          abs = path.resolve(dir, name);
          try {
            if (fs.statSync(abs).isDirectory()) {
              group.push(subdir + name + '/');
              subfiles = fs.readdirSync(abs);
              for (s = 0; s < subfiles.length; s++) {
                if (indexRe.test(subfiles[s])) {
                  group.push(subdir + name);
                }
              }
            }
          } catch (e) {}
        }
      }
    }
    if (group.length) {
      completionGroups.push(group);
    }

    if (!subdir) {
      completionGroups.push(exports._builtinLibs);
    }

    completionGroupsLoaded();

  
  
  
  
  
  
  
  
  
  
  } else if (line.length === 0 || line[line.length - 1].match(/\w|\.|\$/)) {
    match = simpleExpressionRE.exec(line);
    if (line.length === 0 || match) {
      var expr;
      completeOn = (match ? match[0] : '');
      if (line.length === 0) {
        filter = '';
        expr = '';
      } else if (line[line.length - 1] === '.') {
        filter = '';
        expr = match[0].slice(0, match[0].length - 1);
      } else {
        var bits = match[0].split('.');
        filter = bits.pop();
        expr = bits.join('.');
      }

      
      var memberGroups = [];
      if (!expr) {
        
        
        if (this.useGlobal ||
            this.context.constructor &&
            this.context.constructor.name === 'Context') {
          var contextProto = this.context;
          while (contextProto = Object.getPrototypeOf(contextProto)) {
            completionGroups.push(Object.getOwnPropertyNames(contextProto));
          }
          completionGroups.push(Object.getOwnPropertyNames(this.context));
          addStandardGlobals(completionGroups, filter);
          completionGroupsLoaded();
        } else {
          this.eval('.scope', this.context, 'repl', function(err, globals) {
            if (err || !globals) {
              addStandardGlobals(completionGroups, filter);
            } else if (util.isArray(globals[0])) {
              
              globals.forEach(function(group) {
                completionGroups.push(group);
              });
            } else {
              completionGroups.push(globals);
              addStandardGlobals(completionGroups, filter);
            }
            completionGroupsLoaded();
          });
        }
      } else {
        this.eval(expr, this.context, 'repl', function(e, obj) {
          

          if (obj != null) {
            if (util.isObject(obj) || util.isFunction(obj)) {
              memberGroups.push(Object.getOwnPropertyNames(obj));
            }
            
            try {
              var sentinel = 5;
              var p;
              if (util.isObject(obj) || util.isFunction(obj)) {
                p = Object.getPrototypeOf(obj);
              } else {
                p = obj.constructor ? obj.constructor.prototype : null;
              }
              while (!util.isNull(p)) {
                memberGroups.push(Object.getOwnPropertyNames(p));
                p = Object.getPrototypeOf(p);
                
                sentinel--;
                if (sentinel <= 0) {
                  break;
                }
              }
            } catch (e) {
              
            }
          }

          if (memberGroups.length) {
            for (i = 0; i < memberGroups.length; i++) {
              completionGroups.push(memberGroups[i].map(function(member) {
                return expr + '.' + member;
              }));
            }
            if (filter) {
              filter = expr + '.' + filter;
            }
          }

          completionGroupsLoaded();
        });
      }
    } else {
      completionGroupsLoaded();
    }
  } else {
    completionGroupsLoaded();
  }

  
  
  function completionGroupsLoaded(err) {
    if (err) throw err;

    
    if (completionGroups.length && filter) {
      var newCompletionGroups = [];
      for (i = 0; i < completionGroups.length; i++) {
        group = completionGroups[i].filter(function(elem) {
          return elem.indexOf(filter) == 0;
        });
        if (group.length) {
          newCompletionGroups.push(group);
        }
      }
      completionGroups = newCompletionGroups;
    }

    if (completionGroups.length) {
      var uniq = {};  
      completions = [];
      
      
      
      for (i = completionGroups.length - 1; i >= 0; i--) {
        group = completionGroups[i];
        group.sort();
        for (var j = 0; j < group.length; j++) {
          c = group[j];
          if (!hasOwnProperty(uniq, c)) {
            completions.push(c);
            uniq[c] = true;
          }
        }
        completions.push(''); 
      }
      while (completions.length && completions[completions.length - 1] === '') {
        completions.pop();
      }
    }

    callback(null, [completions || [], completeOn]);
  }
};



REPLServer.prototype.parseREPLKeyword = function(keyword, rest) {
  var cmd = this.commands[keyword];
  if (cmd) {
    cmd.action.call(this, rest);
    return true;
  }
  return false;
};


REPLServer.prototype.defineCommand = function(keyword, cmd) {
  if (util.isFunction(cmd)) {
    cmd = {action: cmd};
  } else if (!util.isFunction(cmd.action)) {
    throw new Error('bad argument, action must be a function');
  }
  this.commands[keyword] = cmd;
};

REPLServer.prototype.memory = function memory(cmd) {
  var self = this;

  self.lines = self.lines || [];
  self.lines.level = self.lines.level || [];

  
  if (cmd) {
    
    self.lines.push(new Array(self.lines.level.length).join('  ') + cmd);
  } else {
    
    self.lines.push('');
  }

  
  
  
  if (cmd) {
    
    
    var dw = cmd.match(/{|\(/g);
    var up = cmd.match(/}|\)/g);
    up = up ? up.length : 0;
    dw = dw ? dw.length : 0;
    var depth = dw - up;

    if (depth) {
      (function workIt() {
        if (depth > 0) {
          
          
          
          
          
          
          
          self.lines.level.push({
            line: self.lines.length - 1,
            depth: depth,
            isFunction: /\s*function\s*/.test(cmd)
          });
        } else if (depth < 0) {
          
          var curr = self.lines.level.pop();
          if (curr) {
            var tmp = curr.depth + depth;
            if (tmp < 0) {
              
              depth += curr.depth;
              workIt();
            } else if (tmp > 0) {
              
              curr.depth += depth;
              self.lines.level.push(curr);
            }
          }
        }
      }());
    }

    
    
    
    
    
    
    
  } else {
    self.lines.level = [];
  }
};

function addStandardGlobals(completionGroups, filter) {
  
  
  completionGroups.push(['NaN', 'Infinity', 'undefined',
    'eval', 'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'decodeURI',
    'decodeURIComponent', 'encodeURI', 'encodeURIComponent',
    'Object', 'Function', 'Array', 'String', 'Boolean', 'Number',
    'Date', 'RegExp', 'Error', 'EvalError', 'RangeError',
    'ReferenceError', 'SyntaxError', 'TypeError', 'URIError',
    'Math', 'JSON']);
  
  
  if (filter) {
    completionGroups.push(['break', 'case', 'catch', 'const',
      'continue', 'debugger', 'default', 'delete', 'do', 'else',
      'export', 'false', 'finally', 'for', 'function', 'if',
      'import', 'in', 'instanceof', 'let', 'new', 'null', 'return',
      'switch', 'this', 'throw', 'true', 'try', 'typeof', 'undefined',
      'var', 'void', 'while', 'with', 'yield']);
  }
}

function defineDefaultCommands(repl) {
  
  repl.defineCommand('break', {
    help: 'Sometimes you get stuck, this gets you out',
    action: function() {
      this.bufferedCommand = '';
      this.displayPrompt();
    }
  });

  var clearMessage;
  if (repl.useGlobal) {
    clearMessage = 'Alias for .break';
  } else {
    clearMessage = 'Break, and also clear the local context';
  }
  repl.defineCommand('clear', {
    help: clearMessage,
    action: function() {
      this.bufferedCommand = '';
      if (!this.useGlobal) {
        this.outputStream.write('Clearing context...\n');
        this.resetContext();
      }
      this.displayPrompt();
    }
  });

  repl.defineCommand('exit', {
    help: 'Exit the repl',
    action: function() {
      this.close();
    }
  });

  repl.defineCommand('help', {
    help: 'Show repl options',
    action: function() {
      var self = this;
      Object.keys(this.commands).sort().forEach(function(name) {
        var cmd = self.commands[name];
        self.outputStream.write(name + '\t' + (cmd.help || '') + '\n');
      });
      this.displayPrompt();
    }
  });

  repl.defineCommand('save', {
    help: 'Save all evaluated commands in this REPL session to a file',
    action: function(file) {
      try {
        fs.writeFileSync(file, this.lines.join('\n') + '\n');
        this.outputStream.write('Session saved to:' + file + '\n');
      } catch (e) {
        this.outputStream.write('Failed to save:' + file + '\n');
      }
      this.displayPrompt();
    }
  });

  repl.defineCommand('load', {
    help: 'Load JS from a file into the REPL session',
    action: function(file) {
      try {
        var stats = fs.statSync(file);
        if (stats && stats.isFile()) {
          var self = this;
          var data = fs.readFileSync(file, 'utf8');
          var lines = data.split('\n');
          this.displayPrompt();
          lines.forEach(function(line) {
            if (line) {
              self.write(line + '\n');
            }
          });
        }
      } catch (e) {
        this.outputStream.write('Failed to load:' + file + '\n');
      }
      this.displayPrompt();
    }
  });
}


function trimWhitespace(cmd) {
  var trimmer = /^\s*(.+)\s*$/m,
      matches = trimmer.exec(cmd);

  if (matches && matches.length === 2) {
    return matches[1];
  }
  return '';
}


function regexpEscape(s) {
  return s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}



REPLServer.prototype.convertToContext = function(cmd) {
  var self = this, matches,
      scopeVar = /^\s*var\s*([_\w\$]+)(.*)$/m,
      scopeFunc = /^\s*function\s*([_\w\$]+)/;

  
  matches = scopeVar.exec(cmd);
  if (matches && matches.length === 3) {
    return 'self.context.' + matches[1] + matches[2];
  }

  
  matches = scopeFunc.exec(self.bufferedCommand);
  if (matches && matches.length === 2) {
    return matches[1] + ' = ' + self.bufferedCommand;
  }

  return cmd;
};




function isRecoverableError(e) {
  return e &&
      e.name === 'SyntaxError' &&
      /^(Unexpected end of input|Unexpected token :)/.test(e.message);
}

function Recoverable(err) {
  this.err = err;
}
inherits(Recoverable, SyntaxError);
