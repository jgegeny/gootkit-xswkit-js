
var ScriptsEncryptionKey = [
	0x6a, 0x7c, 0xc0, 0xea, 0x4c, 0xc9, 0xa3, 0x37, 0xa9, 0x78, 0x55, 0x37, 0x16, 0x57, 0xc1, 0x15,
	0xbf, 0x2a, 0x69, 0xe9, 0x8b, 0x5d, 0xe1, 0xcb, 0x42, 0xeb, 0xee, 0xa9, 0xb2, 0x33, 0x07, 0xa2,
	0xe7, 0x09, 0x3d, 0x78, 0x52, 0xd1, 0xa8, 0x3f, 0x42, 0x85, 0xed, 0x43, 0xaa, 0xbc, 0x56, 0x7b,
	0xb9, 0x79, 0x0f, 0xe8, 0x7e, 0x9c, 0x2a, 0x5b, 0x07, 0xea, 0xb3, 0xa8, 0x43, 0xb6, 0x9a, 0x24,
	0xd0, 0x5e, 0x26, 0xcd, 0xd7, 0xa7, 0x83, 0x66, 0x03, 0x06, 0xad, 0xc4, 0xd6, 0x2f, 0x81, 0xee,
	0x1e, 0x17, 0x73, 0x85, 0xe5, 0xfb, 0x90, 0xba, 0x71, 0x6f, 0xc7, 0xdd, 0x83, 0xd4, 0xd9, 0x42,
	0x22, 0x92, 0xce, 0x50, 0x6e, 0x24, 0xc4, 0x92, 0xb8, 0x2d, 0x62, 0xec, 0xa8, 0x47, 0xfd, 0xb5,
	0x7c, 0x8b, 0x27, 0x4a, 0x63, 0x12, 0xb9, 0x80, 0x00, 0xf8, 0xac, 0xb6, 0x61, 0xea, 0x0c, 0xa9,
	0x58, 0x53, 0x04, 0x12, 0x47, 0xe6, 0xf3, 0xa4, 0xf3, 0x34, 0x49, 0xa3, 0xe0, 0x9e, 0x36, 0x0d,
	0xc9, 0xa0, 0x1f, 0x0f, 0xfe, 0x0a, 0x54, 0x79, 0xf8, 0x29, 0xa3, 0xe8, 0x98, 0xbf, 0x43, 0x7e,
	0x80, 0x00, 0xd6, 0x6e, 0x81, 0xe0, 0x2d, 0x9f, 0x5b, 0x65, 0x07, 0x24, 0xe2, 0xcd, 0x8e, 0x8c,
	0xc5, 0xed, 0x71, 0xac, 0xbf, 0xd6, 0x6a, 0x95, 0x11, 0x06, 0x66, 0x74, 0x03, 0xc0, 0xaf, 0x7e,
	0x39, 0x4a, 0x8f, 0xb8, 0xdd, 0x0a, 0x88, 0xc9, 0x9a, 0xb2, 0x46, 0x71, 0xd1, 0xbf, 0x7d, 0x7e,
	0x38, 0xd6, 0xe3, 0x94, 0x84, 0xbd, 0x30, 0x7c, 0x37, 0x81, 0x8d, 0xef, 0xdf, 0x75, 0x35, 0xe4,
	0x56, 0x78, 0x02, 0x37, 0x9a, 0x25, 0x45, 0xe4, 0x7c, 0x8c, 0x28, 0x4b, 0x81, 0xc1, 0x2d, 0x80,
	0x26, 0xb2, 0xd2, 0x70, 0xb4, 0x25, 0x5e, 0xe4, 0xde, 0x93, 0x89, 0x52, 0xa1, 0x43, 0xf7, 0xb1
];



function CryptDecrypt(inp, inplen, key, keylen) {

    if (!key) key = ScriptsEncryptionKey;
    if (!keylen) keylen = ScriptsEncryptionKey.length;

    var Sbox = new Buffer(257);
    var Sbox2 = new Buffer(257);
    var temp = 0, k = 0;

    var i = 0, j = 0, t = 0, x = 0;

    for (var i = 0; i < 257; i++) {
        Sbox[i] = 0;
        Sbox2[i] = 0;
    }

    for (i = 0; i < 256; i++)
        Sbox[i] = i;

    if (keylen) {
        for (i = 0; i < 256 ; i++) {
            if (j == keylen)
                j = 0;
            Sbox2[i] = key[j++];
        }
    }

    j = 0;
    for (i = 0; i < 256; i++) {
        j = (j + Number(Sbox[i]) + Number(Sbox2[i])) % 256;
        temp = Sbox[i];
        Sbox[i] = Sbox[j];
        Sbox[j] = temp;
    }

    i = j = 0;
    for (x = 0; x < inplen; x++) {
        i = (i + 1) % 256;
        j = (j + Number(Sbox[i])) % 256;
        temp = Sbox[i];
        Sbox[i] = Sbox[j];
        Sbox[j] = temp;
        t = (Number(Sbox[i]) + Number(Sbox[j])) % 256;
        k = Sbox[t];
        inp[x] = (inp[x] ^ k);
    }

    return;
}

var Tea = new Function();
Tea.encrypt = function (plaintext, password) {
    if (plaintext.length == 0) return ('');  

    var v = Tea.strToLongs(Utf8.encode(plaintext));
    if (v.length <= 1) v[1] = 0;  
    var k = Tea.strToLongs(Utf8.encode(password).slice(0, 16));
    var n = v.length;
    var z = v[n - 1], y = v[0], delta = 0x9E3779B9;
    var mx, e, q = Math.floor(6 + 52 / n), sum = 0;

    while (q-- > 0) {  // 6 + 52/n operations gives between 6 & 32 mixes on each word
        sum += delta;
        e = sum >>> 2 & 3;
        for (var p = 0; p < n; p++) {
            y = v[(p + 1) % n];
            mx = (z >>> 5 ^ y << 2) + (y >>> 3 ^ z << 4) ^ (sum ^ y) + (k[p & 3 ^ e] ^ z);
            z = v[p] += mx;
        }
    }
    var ciphertext = Tea.longsToStr(v);
    return Base64.encode(ciphertext);
}
Tea.decrypt = function (ciphertext, password) {
    if (ciphertext.length == 0) return ('');
    var v = Tea.strToLongs(Base64.decode(ciphertext));
    var k = Tea.strToLongs(Utf8.encode(password).slice(0, 16));
    var n = v.length;

    

    var z = v[n - 1], y = v[0], delta = 0x9E3779B9;
    var mx, e, q = Math.floor(6 + 52 / n), sum = q * delta;

    while (sum != 0) {
        e = sum >>> 2 & 3;
        for (var p = n - 1; p >= 0; p--) {
            z = v[p > 0 ? p - 1 : n - 1];
            mx = (z >>> 5 ^ y << 2) + (y >>> 3 ^ z << 4) ^ (sum ^ y) + (k[p & 3 ^ e] ^ z);
            y = v[p] -= mx;
        }
        sum -= delta;
    }

    // ---- </TEA> ---- 

    var plaintext = Tea.longsToStr(v);

    
    plaintext = plaintext.replace(/\0+$/, '');

    return Utf8.decode(plaintext);
}
Tea.strToLongs = function (s) {
    var l = new Array(Math.ceil(s.length / 4));
    for (var i = 0; i < l.length; i++) {
        l[i] = s.charCodeAt(i * 4) + (s.charCodeAt(i * 4 + 1) << 8) +
			   (s.charCodeAt(i * 4 + 2) << 16) + (s.charCodeAt(i * 4 + 3) << 24);
    }
    return l;
}
Tea.longsToStr = function (l) {  // convert array of longs back to string
    var a = new Array(l.length);
    for (var i = 0; i < l.length; i++) {
        a[i] = String.fromCharCode(l[i] & 0xFF, l[i] >>> 8 & 0xFF,
								   l[i] >>> 16 & 0xFF, l[i] >>> 24 & 0xFF);
    }
    return a.join('');  // use Array.join() rather than repeated string appends for efficiency in IE
}
/**********************************************************************
*	prototypes B64
***********************************************************************/
var Base64 = new Function();
Base64.code = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
Base64.encode = function (str, utf8encode) {
    utf8encode = (typeof utf8encode == 'undefined') ? false : utf8encode;
    var o1, o2, o3, bits, h1, h2, h3, h4, e = [], pad = '', c, plain, coded;
    var b64 = Base64.code;

    plain = utf8encode ? Utf8.encode(str) : str;

    c = plain.length % 3;
    if (c > 0) { while (c++ < 3) { pad += '='; plain += '\0'; } }

    for (c = 0; c < plain.length; c += 3) {
        o1 = plain.charCodeAt(c);
        o2 = plain.charCodeAt(c + 1);
        o3 = plain.charCodeAt(c + 2);

        bits = o1 << 16 | o2 << 8 | o3;

        h1 = bits >> 18 & 0x3f;
        h2 = bits >> 12 & 0x3f;
        h3 = bits >> 6 & 0x3f;
        h4 = bits & 0x3f;

        e[c / 3] = b64.charAt(h1) + b64.charAt(h2) + b64.charAt(h3) + b64.charAt(h4);
    }
    coded = e.join('');
    coded = coded.slice(0, coded.length - pad.length) + pad;

    return coded;
}
Base64.decode = function (str, utf8decode) {
    utf8decode = (typeof utf8decode == 'undefined') ? false : utf8decode;
    var o1, o2, o3, h1, h2, h3, h4, bits, d = [], plain, coded;
    var b64 = Base64.code;

    coded = utf8decode ? Utf8.decode(str) : str;


    for (var c = 0; c < coded.length; c += 4) {
        h1 = b64.indexOf(coded.charAt(c));
        h2 = b64.indexOf(coded.charAt(c + 1));
        h3 = b64.indexOf(coded.charAt(c + 2));
        h4 = b64.indexOf(coded.charAt(c + 3));

        bits = h1 << 18 | h2 << 12 | h3 << 6 | h4;

        o1 = bits >>> 16 & 0xff;
        o2 = bits >>> 8 & 0xff;
        o3 = bits & 0xff;

        d[c / 4] = String.fromCharCode(o1, o2, o3);
        if (h4 == 0x40) d[c / 4] = String.fromCharCode(o1, o2);
        if (h3 == 0x40) d[c / 4] = String.fromCharCode(o1);
    }
    plain = d.join('');
    return utf8decode ? Utf8.decode(plain) : plain;
}
/**********************************************************************
*	prototypes UTF8
***********************************************************************/
var Utf8 = new Function();
Utf8.encode = function (strUni) {
    var strUtf = strUni.replace(
	  /[\u0080-\u07ff]/g,  // U+0080 - U+07FF => 2 bytes 110yyyyy, 10zzzzzz
	  function (c) {
	      var cc = c.charCodeAt(0);
	      return String.fromCharCode(0xc0 | cc >> 6, 0x80 | cc & 0x3f);
	  }
	);
    strUtf = strUtf.replace(
	  /[\u0800-\uffff]/g,  // U+0800 - U+FFFF => 3 bytes 1110xxxx, 10yyyyyy, 10zzzzzz
	  function (c) {
	      var cc = c.charCodeAt(0);
	      return String.fromCharCode(0xe0 | cc >> 12, 0x80 | cc >> 6 & 0x3F, 0x80 | cc & 0x3f);
	  }
	);
    return strUtf;
}
Utf8.decode = function (strUtf) {
    var strUni = strUtf.replace(
	  /[\u00c0-\u00df][\u0080-\u00bf]/g,                 // 2-byte chars
	  function (c) {  // (note parentheses for precence)
	      var cc = (c.charCodeAt(0) & 0x1f) << 6 | c.charCodeAt(1) & 0x3f;
	      return String.fromCharCode(cc);
	  }
	);
    strUni = strUni.replace(
	  /[\u00e0-\u00ef][\u0080-\u00bf][\u0080-\u00bf]/g,  // 3-byte chars
	  function (c) {  // (note parentheses for precence)
	      var cc = ((c.charCodeAt(0) & 0x0f) << 12) | ((c.charCodeAt(1) & 0x3f) << 6) | (c.charCodeAt(2) & 0x3f);
	      return String.fromCharCode(cc);
	  }
	);
    return strUni;
}

var TeaPassword = '6fm2MuSEij7HV2O5RX6IxDyBPGPccJu2';

exports.CryptDecrypt = CryptDecrypt;
exports.Tea = Tea;
exports.TeaPassword = TeaPassword;