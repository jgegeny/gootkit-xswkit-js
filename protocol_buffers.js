var schema = require('protobuf_schema')
var compile = require('protobuf_compile')


module.exports = function(proto, opts) {
  if (!opts) opts = {}
  if (!proto) throw new Error('Pass in a .proto string or a protobuf-schema parsed object')

  var sch = (typeof proto === 'object' && !Buffer.isBuffer(proto)) ? proto : schema.parse(proto)

  
  var Messages = function() {
    var self = this

    compile(sch, opts.encodings || {}).forEach(function(m) {
      self[m.name] = m.values || m
    })
  }

  Messages.prototype.toString = function() {
    return schema.stringify(sch)
  }

  Messages.prototype.toJSON = function() {
    return sch
  }

  return new Messages()
}