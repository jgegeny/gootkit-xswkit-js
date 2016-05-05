var Buffer = require('buffer').Buffer;
var utf7 = {};
function encode(str) {
    var b = new Buffer(str.length * 2, 'ascii');
    for (var i = 0, bi = 0; i < str.length; i++) {
        
        
        
        var c = str.charCodeAt(i);
        
        b[bi++] = c >> 8;
        
        b[bi++] = c & 0xFF;
    }
    
    return b.toString('base64').replace(/=+$/, '');
}

function decode(str) {
    var b = new Buffer(str, 'base64');
    var r = [];
    for (var i = 0; i < b.length;) {
        
        r.push(String.fromCharCode(b[i++] << 8 | b[i++]));
    }
    return r.join('');
}


function escape(chars) {
    return chars.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}


var setD = "A-Za-z0-9" + escape("'(),-./:?");
var setO = escape("!\"#$%&*;<=>@[]^_'{|}");
var setW = escape(" \r\n\t");


var regexes = {};
var regexAll = new RegExp("[^" + setW + setD + setO + "]+", 'g');

exports.imap = {};


exports.encode = function (str, mask) {
    
    if (!mask) {
        mask = '';
    }
    if (!regexes[mask]) {
        regexes[mask] = new RegExp("[^" + setD + escape(mask) + "]+", 'g');
    }

    
    return str.replace(regexes[mask], function (chunk) {
        
        return '+' + (chunk === '+' ? '' : encode(chunk)) + '-';
    });
};


exports.encodeAll = function (str) {
    
    return str.replace(regexAll, function (chunk) {
        
        return '+' + (chunk === '+' ? '' : encode(chunk)) + '-';
    });
};


exports.imap.encode = function (str) {
    
    
    return str.replace(/&/g, '&-').replace(/[^\x20-\x7e]+/g, function (chunk) {
        
        chunk = (chunk === '&' ? '' : encode(chunk)).replace(/\//g, ',');
        return '&' + chunk + '-';
    });
};


exports.decode = function (str) {
    return str.replace(/\+([A-Za-z0-9\/]*)-?/gi, function (_, chunk) {
        
        if (chunk === '') return '+';
        return decode(chunk);
    });
};


exports.imap.decode = function (str) {
    return str.replace(/&([^-]*)-/g, function (_, chunk) {
        
        if (chunk === '') return '&';
        return decode(chunk.replace(/,/g, '/'));
    });
};