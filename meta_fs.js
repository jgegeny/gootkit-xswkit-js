var Fs = require('fs')
var Path = require('path')


function mkdir_p(path, perm, callback) {
  path = Path.resolve(process.cwd(), path)
  Fs.mkdir(path, perm, function(err) {
    if (!err) { callback() ; return }
    if (err.code === 'ENOENT') {
      mkdir_p(Path.dirname(path), perm, function(err) {
        if (err) {
          callback(err)
        } else {
          mkdir_p(path, perm, callback)
        }
      })
    } else if (err.code === 'EEXIST') {
      Fs.stat(path, function(sterr, stat) {
        if (sterr || !stat.isDirectory()) {
          callback(sterr)
        } else if (stat.mode != perm) {
          Fs.chmod(path, perm, callback)
        } else {
          callback()
        }
      })
    } else {
      callback(err)
    }
  })
}



function match_stub_fn(path, stat, depth, cb) { cb() }

function find(path, options, callback) {

  
  options = options || {}
  var match_fn = options.match_fn || match_stub_fn
  var dir_fn = options.dir_fn || match_stub_fn
  var serial = !!options.serial

  
  var normalize = Path.normalize
  var join = Path.join
  var stat = options.follow ? Fs.stat : Fs.lstat
  var readdir = Fs.readdir

  
  var base = Path.resolve(process.cwd(), path)

  
  var inos = {}

  
  function walk(path, depth, cb) {
    
    stat(path, function (err, st) {
      
      if (err) { cb(err) ; return }
      
      
      if (options.follow) {
        
        var inode = st.ino
        if (inos[inode]) { cb() ; return }
        
        inos[inode] = true
      }
      
      match_fn.call(options, path, st, depth, function (err) {
        
        if (err && err !== true) { cb(err) ; return }
        
        if (!st.isDirectory()) { cb() ; return }
        
        readdir(path, function (err, files) {
          if (err) { cb(err) ; return }
          
          
          var len = files.length
          
          
          
          
          var collected = serial ? 0 : 1
          function collect() {
            if (collected >= len) {
              
              dir_fn.call(options, path, st, depth, cb)
            
            } else if (serial) {
              walk(join(path, files[collected]), depth + 1, collect)
            }
            collected++
          }
          
          
          if (len === 0 || serial) {
            collect()
          
          } else {
            for (var i = 0; i < len; i++) {
              walk(join(path, files[i]), depth + 1, collect)
            }
          }
        })
      })
    })
  }

  
  walk(base, 0, callback)

}


function remove(path, callback) {

  
  var unlink = Fs.unlink
  var rmdir = Fs.rmdir

  path = Path.resolve(process.cwd(), path)
  find(path, {
    
    match_fn: function(path, stat, depth, cb) {
      if (!stat.isDirectory()) {
        unlink(path, cb)
      } else {
        cb()
      }
    },
    dir_fn: function (path, stat, depth, cb) {
      rmdir(path, cb)
    },
  }, function (err) {
    if (err && (err.code === 'ENOENT' || err.code === 'ENOTDIR')) { err = null }
    callback(err)
  })

}


function copy(src, dst, callback) {

  
  var join = Path.join
  var dirname = Path.dirname
  var basename = Path.basename
  var read = Fs.readFile
  var write = Fs.writeFile
  var readlink = Fs.readlink
  var symlink = Fs.symlink
  var chmod = Fs.chmod
  var chown = Fs.chown

  
  var src_orig = Path.normalize(src)
  src = Path.resolve(process.cwd(), src)
  dst = Path.resolve(process.cwd(), dst)

  
  
  if (src_orig == '.') {
    skip += '/'
  }
  
  var skip_len = src.length + 1

  
  find(src, {
    
    match_fn: function (path, stat, depth, cb) {
      
      var new_path = join(dst, path.substring(skip_len))
      
      
      
      
      
      function set_perms(err) {
        if (err) { cb(err) ; return }
        chmod(new_path, stat.mode, function (err) {
          if (err) { cb(err) ; return }
          chown(new_path, stat.uid, stat.gid, function (err) {
            
            
            cb()
          })
        })
      }
      
      
      if (stat.isDirectory()) {
        mkdir_p(new_path, stat.mode, set_perms)
      
      } else if (stat.isFile()) {
        
        read(path, function (err, data) {
          write(new_path, data, set_perms)
        })
      
      } else if (stat.isSymbolicLink()) {
        readlink(path, function (err, realpath) {
          if (err) { cb(err) ; return }
          symlink(realpath, new_path, set_perms)
        })
      
      
      
      } else {
        cb({path: path, code: 'ENOTSUPP'})
      }
    },
  }, callback)

}


function link(target, path, callback) {
  path = Path.resolve(process.cwd(), path)
  mkdir_p(Path.dirname(path), '0755', function (err) {
    if (err) { callback(err) ; return }
    Fs.symlink(target, path, callback)
  })
}


Fs.mkdir_p = mkdir_p
Fs.find = find
Fs.remove = remove
Fs.copy = copy
Fs.link = link

module.exports = Fs