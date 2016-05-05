




















var net = require('net');
var url = require('url');
var util = require('util');





exports.CLIENT_RENEG_LIMIT = 3;
exports.CLIENT_RENEG_WINDOW = 600;

exports.SLAB_BUFFER_SIZE = 10 * 1024 * 1024;

exports.DEFAULT_CIPHERS =
    
    'ECDHE-RSA-AES128-SHA256:DHE-RSA-AES128-SHA256:AES128-GCM-SHA256:' +
    
    'RC4:HIGH:!MD5:!aNULL';

exports.DEFAULT_ECDH_CURVE = 'prime256v1';

exports.getCiphers = function() {
  var names = process.binding('crypto').getSSLCiphers();
  
  var ctx = {};
  names.forEach(function(name) {
    if (/^[0-9A-Z\-]+$/.test(name)) name = name.toLowerCase();
    ctx[name] = true;
  });
  return Object.getOwnPropertyNames(ctx).sort();
};



exports.convertNPNProtocols = function convertNPNProtocols(NPNProtocols, out) {
  
  if (util.isArray(NPNProtocols)) {
    var buff = new Buffer(NPNProtocols.reduce(function(p, c) {
      return p + 1 + Buffer.byteLength(c);
    }, 0));

    NPNProtocols.reduce(function(offset, c) {
      var clen = Buffer.byteLength(c);
      buff[offset] = clen;
      buff.write(c, offset + 1);

      return offset + 1 + clen;
    }, 0);

    NPNProtocols = buff;
  }

  
  if (util.isBuffer(NPNProtocols)) {
    out.NPNProtocols = NPNProtocols;
  }
};

exports.checkServerIdentity = function checkServerIdentity(host, cert) {
  
  function regexpify(host, wildcards) {
    
    if (!/\.$/.test(host)) host += '.';

    
    
    
    
    
    
    
    
    
    
    if (!wildcards && /\*/.test(host) || /[\.\*].*\*/.test(host) ||
        /\*/.test(host) && !/\*.*\..+\..+/.test(host)) {
      return /$./;
    }

    
    
    
    var re = host.replace(
        /\*([a-z0-9\\-_\.])|[\.,\-\\\^\$+?*\[\]\(\):!\|{}]/g,
        function(all, sub) {
          if (sub) return '[a-z0-9\\-_]*' + (sub === '-' ? '\\-' : sub);
          return '\\' + all;
        });

    return new RegExp('^' + re + '$', 'i');
  }

  var dnsNames = [],
      uriNames = [],
      ips = [],
      matchCN = true,
      valid = false,
      reason = 'Unknown reason';

  
  
  
  
  
  if (cert.subjectaltname) {
    cert.subjectaltname.split(/, /g).forEach(function(altname) {
      var option = altname.match(/^(DNS|IP Address|URI):(.*)$/);
      if (!option)
        return;
      if (option[1] === 'DNS') {
        dnsNames.push(option[2]);
      } else if (option[1] === 'IP Address') {
        ips.push(option[2]);
      } else if (option[1] === 'URI') {
        var uri = url.parse(option[2]);
        if (uri) uriNames.push(uri.hostname);
      }
    });
  }

  
  
  if (net.isIP(host)) {
    valid = ips.some(function(ip) {
      return ip === host;
    });
    if (!valid) {
      reason = util.format('IP: %s is not in the cert\'s list: %s',
                           host,
                           ips.join(', '));
    }
  } else {
    
    if (!/\.$/.test(host)) host += '.';

    
    
    dnsNames = dnsNames.map(function(name) {
      return regexpify(name, true);
    });

    
    uriNames = uriNames.map(function(name) {
      return regexpify(name, false);
    });

    dnsNames = dnsNames.concat(uriNames);

    if (dnsNames.length > 0) matchCN = false;

    
    
    
    
    
    
    
    
    if (matchCN) {
      var commonNames = cert.subject.CN;
      if (util.isArray(commonNames)) {
        for (var i = 0, k = commonNames.length; i < k; ++i) {
          dnsNames.push(regexpify(commonNames[i], true));
        }
      } else {
        dnsNames.push(regexpify(commonNames, true));
      }
    }

    valid = dnsNames.some(function(re) {
      return re.test(host);
    });

    if (!valid) {
      if (cert.subjectaltname) {
        reason = util.format('Host: %s is not in the cert\'s altnames: %s',
                             host,
                             cert.subjectaltname);
      } else {
        reason = util.format('Host: %s is not cert\'s CN: %s',
                             host,
                             cert.subject.CN);
      }
    }
  }

  if (!valid) {
    var err = new Error(
        util.format('Hostname/IP doesn\'t match certificate\'s altnames: %j',
                    reason));
    err.reason = reason;
    err.host = host;
    err.cert = cert;
    return err;
  }
};



exports.parseCertString = function parseCertString(s) {
  var out = {};
  var parts = s.split('\n');
  for (var i = 0, len = parts.length; i < len; i++) {
    var sepIndex = parts[i].indexOf('=');
    if (sepIndex > 0) {
      var key = parts[i].slice(0, sepIndex);
      var value = parts[i].slice(sepIndex + 1);
      if (key in out) {
        if (!util.isArray(out[key])) {
          out[key] = [out[key]];
        }
        out[key].push(value);
      } else {
        out[key] = value;
      }
    }
  }
  return out;
};


exports.createSecureContext = require('_tls_common').createSecureContext;
exports.SecureContext = require('_tls_common').SecureContext;
exports.TLSSocket = require('_tls_wrap').TLSSocket;
exports.Server = require('_tls_wrap').Server;
exports.createServer = require('_tls_wrap').createServer;
exports.connect = require('_tls_wrap').connect;


exports.__defineGetter__('createSecurePair', util.deprecate(function() {
  return require('_tls_legacy').createSecurePair;
}, 'createSecurePair() is deprecated, use TLSSocket instead'));
