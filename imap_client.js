var EventEmitter = require('events').EventEmitter,
    ReadableStream = require('stream').Readable,
    inherits = require('util').inherits,
    inspect = require('util').inspect,
    tls = require('tls'),
    Socket = require('net').Socket,
    EventEmitter = require('events').EventEmitter,
    inherits = require('util').inherits,
    inspect = require('util').inspect,
    isDate = require('util').isDate,
    utf7 = require('utf7').imap,
    jsencoding = require('encoding');



var CH_LF = 10,
    LITPLACEHOLDER = String.fromCharCode(0),
    EMPTY_READCB = function (n) { },
    RE_INTEGER = /^\d+$/,
    RE_PRECEDING = /^(?:(?:\*|A\d+) )|\+ ?/,
    RE_BODYLITERAL = /BODY\[(.*)\] \{(\d+)\}$/i,
    RE_BODYINLINEKEY = /^BODY\[(.*)\]$/i,
    RE_SEQNO = /^\* (\d+)/,
    RE_LISTCONTENT = /^\((.*)\)$/,
    RE_LITERAL = /\{(\d+)\}$/,
    RE_UNTAGGED = /^\* (?:(OK|NO|BAD|BYE|FLAGS|ID|LIST|LSUB|SEARCH|STATUS|CAPABILITY|NAMESPACE|PREAUTH|SORT|THREAD|ESEARCH|QUOTA|QUOTAROOT)|(\d+) (EXPUNGE|FETCH|RECENT|EXISTS))(?:(?: \[([^\]]+)\])?(?: (.+))?)?$/i,
    RE_TAGGED = /^A(\d+) (OK|NO|BAD) (?:\[([^\]]+)\] )?(.+)$/i,
    RE_CONTINUE = /^\+(?: (?:\[([^\]]+)\] )?(.+))?$/i,
    RE_CRLF = /\r\n/g,
    RE_HDR = /^([^:]+):[ \t]?(.+)?$/,
    RE_ENCWORD = /=\?([^?*]*?)(?:\*.*?)?\?([qb])\?(.*?)\?=/gi,
    RE_ENCWORD_END = /=\?([^?*]*?)(?:\*.*?)?\?([qb])\?(.*?)\?=$/i,
    RE_ENCWORD_BEGIN = /^[ \t]=\?([^?*]*?)(?:\*.*?)?\?([qb])\?(.*?)\?=/i,
    RE_QENC = /(?:=([a-fA-F0-9]{2}))|_/g,
    RE_SEARCH_MODSEQ = /^(.+) \(MODSEQ (.+?)\)$/i,
    RE_LWS_ONLY = /^[ \t]*$/;

function IMAPParser(stream, debug) {
    if (!(this instanceof IMAPParser))
        return new IMAPParser(stream, debug);

    EventEmitter.call(this);

    this._stream = undefined;
    this._body = undefined;
    this._literallen = 0;
    this._literals = [];
    this._buffer = '';
    this._ignoreReadable = false;
    this.debug = debug;

    var self = this;
    this._cbReadable = function () {
        if (self._ignoreReadable)
            return;
        if (self._literallen > 0 && !self._body)
            self._tryread(self._literallen);
        else
            self._tryread();
    };

    this.setStream(stream);

    process.nextTick(this._cbReadable);
}
inherits(IMAPParser, EventEmitter);

IMAPParser.prototype.setStream = function (stream) {
    if (this._stream)
        this._stream.removeListener('readable', this._cbReadable);

    if (/^v0\.8\./.test(process.version)) {
        this._stream = (new ReadableStream()).wrap(stream);

        
        
        
        stream._events.error.pop();
    } else
        this._stream = stream;

    this._stream.on('readable', this._cbReadable);
};

IMAPParser.prototype._tryread = function (n) {
    if (this._stream.readable) {
        var r = this._stream.read(n);
        r && this._parse(r);
    }
};

IMAPParser.prototype._parse = function (data) {
    var i = 0, datalen = data.length, idxlf;

    if (this._literallen > 0) {
        if (this._body) {
            var body = this._body;
            if (datalen >= this._literallen) {
                var litlen = this._literallen;
                i = litlen;
                this._literallen = 0;
                this._body = undefined;
                body._read = EMPTY_READCB;
                if (datalen > litlen)
                    body.push(data.slice(0, litlen));
                else
                    body.push(data);
                body.push(null);
            } else {
                this._literallen -= datalen;
                var r = body.push(data);
                if (!r) {
                    body._read = this._cbReadable;
                    return;
                }
                i = datalen;
            }
        } else {
            if (datalen > this._literallen)
                this._literals.push(data.slice(0, this._literallen));
            else
                this._literals.push(data);
            i = this._literallen;
            this._literallen = 0;
        }
    }

    while (i < datalen) {
        idxlf = indexOfCh(data, datalen, i, CH_LF);
        if (idxlf === -1) {
            this._buffer += data.toString('utf8', i);
            break;
        } else {
            this._buffer += data.toString('utf8', i, idxlf);
            this._buffer = this._buffer.trim();
            i = idxlf + 1;

            this.debug && this.debug('<= ' + inspect(this._buffer));

            if (RE_PRECEDING.test(this._buffer)) {
                var firstChar = this._buffer[0];
                if (firstChar === '*')
                    this._resUntagged();
                else if (firstChar === 'A')
                    this._resTagged();
                else if (firstChar === '+')
                    this._resContinue();

                if (this._literallen > 0 && i < datalen) {
                    this._ignoreReadable = true;
                    
                    this._stream.unshift(data.slice(i));
                    this._ignoreReadable = false;
                    i = datalen;
                    if (!this._body) {
                        
                        this._tryread(this._literallen);
                    }
                }
            } else {
                this.emit('other', this._buffer);
                this._buffer = '';
            }
        }
    }

    if (this._literallen === 0 || this._body)
        this._tryread();
};

IMAPParser.prototype._resTagged = function () {
    var m;
    if (m = RE_LITERAL.exec(this._buffer)) {
        
        this._buffer = this._buffer.replace(RE_LITERAL, LITPLACEHOLDER);
        this._literallen = parseInt(m[1], 10);
    } else if (m = RE_TAGGED.exec(this._buffer)) {
        this._buffer = '';
        this._literals = [];

        this.emit('tagged', {
            type: m[2].toLowerCase(),
            tagnum: parseInt(m[1], 10),
            textCode: (m[3] ? parseTextCode(m[3], this._literals) : m[3]),
            text: m[4]
        });
    } else
        this._buffer = '';
};

IMAPParser.prototype._resUntagged = function () {
    var m;
    if (m = RE_BODYLITERAL.exec(this._buffer)) {
        
        var which = m[1], size = parseInt(m[2], 10);
        this._literallen = size;
        this._body = new ReadableStream();
        this._body._readableState.sync = false;
        this._body._read = EMPTY_READCB;
        m = RE_SEQNO.exec(this._buffer);
        this._buffer = this._buffer.replace(RE_BODYLITERAL, '');
        this.emit('body', this._body, {
            seqno: parseInt(m[1], 10),
            which: which,
            size: size
        });
    } else if (m = RE_LITERAL.exec(this._buffer)) {
        
        this._buffer = this._buffer.replace(RE_LITERAL, LITPLACEHOLDER);
        this._literallen = parseInt(m[1], 10);
    } else if (m = RE_UNTAGGED.exec(this._buffer)) {
        this._buffer = '';
        

        
        
        
        

        var type, num, textCode, val;
        if (m[2] !== undefined)
            num = parseInt(m[2], 10);
        if (m[4] !== undefined)
            textCode = parseTextCode(m[4], this._literals);

        type = (m[1] || m[3]).toLowerCase();

        if (type === 'flags'
            || type === 'search'
            || type === 'capability'
            || type === 'sort') {
            if (m[5]) {
                if (type === 'search' && RE_SEARCH_MODSEQ.test(m[5])) {
                    
                    var p = RE_SEARCH_MODSEQ.exec(m[5]);
                    val = {
                        results: p[1].split(' '),
                        modseq: p[2]
                    };
                } else {
                    if (m[5][0] === '(')
                        val = RE_LISTCONTENT.exec(m[5])[1].split(' ');
                    else
                        val = m[5].split(' ');

                    if (type === 'search' || type === 'sort')
                        val = val.map(function (v) { return parseInt(v, 10); });
                }
            } else
                val = [];
        } else if (type === 'thread') {
            if (m[5])
                val = parseExpr(m[5], this._literals);
            else
                val = [];
        } else if (type === 'list' || type === 'lsub')
            val = parseBoxList(m[5], this._literals);
        else if (type === 'id')
            val = parseId(m[5], this._literals);
        else if (type === 'status')
            val = parseStatus(m[5], this._literals);
        else if (type === 'fetch')
            val = parseFetch.call(this, m[5], this._literals, num);
        else if (type === 'namespace')
            val = parseNamespaces(m[5], this._literals);
        else if (type === 'esearch')
            val = parseESearch(m[5], this._literals);
        else if (type === 'quota')
            val = parseQuota(m[5], this._literals);
        else if (type === 'quotaroot')
            val = parseQuotaRoot(m[5], this._literals);
        else
            val = m[5];

        this._literals = [];

        this.emit('untagged', {
            type: type,
            num: num,
            textCode: textCode,
            text: val
        });
    } else
        this._buffer = '';
};

IMAPParser.prototype._resContinue = function () {
    var m = RE_CONTINUE.exec(this._buffer),
        textCode,
        text;

    this._buffer = '';

    if (!m)
        return;

    text = m[2];

    if (m[1] !== undefined)
        textCode = parseTextCode(m[1], this._literals);

    this.emit('continue', {
        textCode: textCode,
        text: text
    });
};

function indexOfCh(buffer, len, i, ch) {
    var r = -1;
    for (; i < len; ++i) {
        if (buffer[i] === ch) {
            r = i;
            break;
        }
    }
    return r;
}

function parseTextCode(text, literals) {
    var r = parseExpr(text, literals);
    if (r.length === 1)
        return r[0];
    else
        return { key: r[0], val: r.length === 2 ? r[1] : r.slice(1) };
}

function parseESearch(text, literals) {
    var r = parseExpr(text.toUpperCase().replace('UID', ''), literals),
        attrs = {};

    
    
    

    for (var i = 1, len = r.length, key, val; i < len; i += 2) {
        key = r[i].toLowerCase();
        val = r[i + 1];
        if (key === 'all')
            val = val.toString().split(',');
        attrs[key] = val;
    }

    return attrs;
}

function parseId(text, literals) {
    var r = parseExpr(text, literals),
        id = {};
    if (r[0] === null)
        return null;
    for (var i = 0, len = r[0].length; i < len; i += 2)
        id[r[0][i].toLowerCase()] = r[0][i + 1];

    return id;
}

function parseQuota(text, literals) {
    var r = parseExpr(text, literals),
        resources = {};

    for (var i = 0, len = r[1].length; i < len; i += 3) {
        resources[r[1][i].toLowerCase()] = {
            usage: r[1][i + 1],
            limit: r[1][i + 2]
        };
    }

    return {
        root: r[0],
        resources: resources
    };
}

function parseQuotaRoot(text, literals) {
    var r = parseExpr(text, literals);

    return {
        roots: r.slice(1),
        mailbox: r[0]
    };
}

function parseBoxList(text, literals) {
    var r = parseExpr(text, literals);
    return {
        flags: r[0],
        delimiter: r[1],
        name: utf7.decode('' + r[2])
    };
}

function parseNamespaces(text, literals) {
    var r = parseExpr(text, literals), i, len, j, len2, ns, nsobj, namespaces, n;

    for (n = 0; n < 3; ++n) {
        if (r[n]) {
            namespaces = [];
            for (i = 0, len = r[n].length; i < len; ++i) {
                ns = r[n][i];
                nsobj = {
                    prefix: ns[0],
                    delimiter: ns[1],
                    extensions: undefined
                };
                if (ns.length > 2)
                    nsobj.extensions = {};
                for (j = 2, len2 = ns.length; j < len2; j += 2)
                    nsobj.extensions[ns[j]] = ns[j + 1];
                namespaces.push(nsobj);
            }
            r[n] = namespaces;
        }
    }

    return {
        personal: r[0],
        other: r[1],
        shared: r[2]
    };
}

function parseStatus(text, literals) {
    var r = parseExpr(text, literals), attrs = {};
    
    for (var i = 0, len = r[1].length; i < len; i += 2)
        attrs[r[1][i].toLowerCase()] = r[1][i + 1];
    return {
        name: utf7.decode('' + r[0]),
        attrs: attrs
    };
}

function parseFetch(text, literals, seqno) {
    var list = parseExpr(text, literals)[0], attrs = {}, m, body;
    
    for (var i = 0, len = list.length, key, val; i < len; i += 2) {
        key = list[i].toLowerCase();
        val = list[i + 1];
        if (key === 'envelope')
            val = parseFetchEnvelope(val);
        else if (key === 'internaldate')
            val = new Date(val);
        else if (key === 'modseq') 
            val = '' + val[0];
        else if (key === 'body' || key === 'bodystructure')
            val = parseBodyStructure(val);
        else if (m = RE_BODYINLINEKEY.exec(list[i])) {
            
            val = new Buffer('' + val);
            body = new ReadableStream();
            body._readableState.sync = false;
            body._read = EMPTY_READCB;
            this.emit('body', body, {
                seqno: seqno,
                which: m[1],
                size: val.length
            });
            body.push(val);
            body.push(null);
            continue;
        }
        attrs[key] = val;
    }
    return attrs;
}

function parseBodyStructure(cur, literals, prefix, partID) {
    var ret = [], i, len;
    if (prefix === undefined) {
        var result = (Array.isArray(cur) ? cur : parseExpr(cur, literals));
        if (result.length)
            ret = parseBodyStructure(result, literals, '', 1);
    } else {
        var part, partLen = cur.length, next;
        if (Array.isArray(cur[0])) { 
            next = -1;
            while (Array.isArray(cur[++next])) {
                ret.push(parseBodyStructure(cur[next],
                                            literals,
                                            prefix + (prefix !== '' ? '.' : '')
                                                   + (partID++).toString(), 1));
            }
            part = { type: cur[next++].toLowerCase() };
            if (partLen > next) {
                if (Array.isArray(cur[next])) {
                    part.params = {};
                    for (i = 0, len = cur[next].length; i < len; i += 2)
                        part.params[cur[next][i].toLowerCase()] = cur[next][i + 1];
                } else
                    part.params = cur[next];
                ++next;
            }
        } else { 
            next = 7;
            if (typeof cur[1] === 'string') {
                part = {
                    
                    
                    partID: (prefix !== '' ? prefix : '1'),

                    
                    type: cur[0].toLowerCase(), subtype: cur[1].toLowerCase(),
                    params: null, id: cur[3], description: cur[4], encoding: cur[5],
                    size: cur[6]
                };
            } else {
                
                part = { type: cur[0] ? cur[0].toLowerCase() : null, params: null };
                cur.splice(1, 0, null);
                ++partLen;
                next = 2;
            }
            if (Array.isArray(cur[2])) {
                part.params = {};
                for (i = 0, len = cur[2].length; i < len; i += 2)
                    part.params[cur[2][i].toLowerCase()] = cur[2][i + 1];
                if (cur[1] === null)
                    ++next;
            }
            if (part.type === 'message' && part.subtype === 'rfc822') {
                
                if (partLen > next && Array.isArray(cur[next]))
                    part.envelope = parseFetchEnvelope(cur[next]);
                else
                    part.envelope = null;
                ++next;

                
                if (partLen > next && Array.isArray(cur[next]))
                    part.body = parseBodyStructure(cur[next], literals, prefix, 1);
                else
                    part.body = null;
                ++next;
            }
            if ((part.type === 'text'
                 || (part.type === 'message' && part.subtype === 'rfc822'))
                && partLen > next)
                part.lines = cur[next++];
            if (typeof cur[1] === 'string' && partLen > next)
                part.md5 = cur[next++];
        }
        
        parseStructExtra(part, partLen, cur, next);
        ret.unshift(part);
    }
    return ret;
}

function parseStructExtra(part, partLen, cur, next) {
    if (partLen > next) {
        
        
        
        
        
        var disposition = { type: null, params: null };
        if (Array.isArray(cur[next])) {
            disposition.type = cur[next][0];
            if (Array.isArray(cur[next][1])) {
                disposition.params = {};
                for (var i = 0, len = cur[next][1].length, key; i < len; i += 2) {
                    key = cur[next][1][i].toLowerCase();
                    disposition.params[key] = cur[next][1][i + 1];
                }
            }
        } else if (cur[next] !== null)
            disposition.type = cur[next];

        if (disposition.type === null)
            part.disposition = null;
        else
            part.disposition = disposition;

        ++next;
    }
    if (partLen > next) {
        
        
        if (cur[next] !== null)
            part.language = (Array.isArray(cur[next]) ? cur[next] : [cur[next]]);
        else
            part.language = null;
        ++next;
    }
    if (partLen > next)
        part.location = cur[next++];
    if (partLen > next) {
        
        
        
        part.extensions = cur[next];
    }
}

function parseFetchEnvelope(list) {
    return {
        date: new Date(list[0]),
        subject: decodeWords(list[1]),
        from: parseEnvelopeAddresses(list[2]),
        sender: parseEnvelopeAddresses(list[3]),
        replyTo: parseEnvelopeAddresses(list[4]),
        to: parseEnvelopeAddresses(list[5]),
        cc: parseEnvelopeAddresses(list[6]),
        bcc: parseEnvelopeAddresses(list[7]),
        inReplyTo: list[8],
        messageId: list[9]
    };
}

function parseEnvelopeAddresses(list) {
    var addresses = null;
    if (Array.isArray(list)) {
        addresses = [];
        var inGroup = false, curGroup;
        for (var i = 0, len = list.length, addr; i < len; ++i) {
            addr = list[i];
            if (addr[2] === null) { 
                inGroup = false;
                if (curGroup) {
                    addresses.push(curGroup);
                    curGroup = undefined;
                }
            } else if (addr[3] === null) { 
                inGroup = true;
                curGroup = {
                    group: addr[2],
                    addresses: []
                };
            } else { 
                var info = {
                    name: decodeWords(addr[0]),
                    mailbox: addr[2],
                    host: addr[3]
                };
                if (inGroup)
                    curGroup.addresses.push(info);
                else if (!inGroup)
                    addresses.push(info);
            }
            list[i] = addr;
        }
        if (inGroup) {
            
            addresses.push(curGroup);
        }
    }
    return addresses;
}

function parseExpr(o, literals, result, start, useBrackets) {
    start = start || 0;
    var inQuote = false,
        lastPos = start - 1,
        isTop = false,
        isBody = false,
        escaping = false,
        val;

    if (useBrackets === undefined)
        useBrackets = true;
    if (!result)
        result = [];
    if (typeof o === 'string') {
        o = { str: o };
        isTop = true;
    }
    for (var i = start, len = o.str.length; i < len; ++i) {
        if (!inQuote) {
            if (isBody) {
                if (o.str[i] === ']') {
                    val = convStr(o.str.substring(lastPos + 1, i + 1), literals);
                    result.push(val);
                    lastPos = i;
                    isBody = false;
                }
            } else if (o.str[i] === '"')
                inQuote = true;
            else if (o.str[i] === ' '
                     || o.str[i] === ')'
                     || (useBrackets && o.str[i] === ']')) {
                if (i - (lastPos + 1) > 0) {
                    val = convStr(o.str.substring(lastPos + 1, i), literals);
                    result.push(val);
                }
                if ((o.str[i] === ')' || (useBrackets && o.str[i] === ']')) && !isTop)
                    return i;
                lastPos = i;
            } else if ((o.str[i] === '(' || (useBrackets && o.str[i] === '['))) {
                if (o.str[i] === '['
                    && i - 4 >= start
                    && o.str.substring(i - 4, i).toUpperCase() === 'BODY') {
                    isBody = true;
                    lastPos = i - 5;
                } else {
                    var innerResult = [];
                    i = parseExpr(o, literals, innerResult, i + 1, useBrackets);
                    lastPos = i;
                    result.push(innerResult);
                }
            }
        } else if (o.str[i] === '\\')
            escaping = !escaping;
        else if (o.str[i] === '"') {
            if (!escaping)
                inQuote = false;
            escaping = false;
        }
        if (i + 1 === len && len - (lastPos + 1) > 0)
            result.push(convStr(o.str.substring(lastPos + 1), literals));
    }
    return (isTop ? result : start);
}

function convStr(str, literals) {
    if (str[0] === '"') {
        str = str.substring(1, str.length - 1);
        var newstr = '', isEscaping = false, p = 0;
        for (var i = 0, len = str.length; i < len; ++i) {
            if (str[i] === '\\') {
                if (!isEscaping)
                    isEscaping = true;
                else {
                    isEscaping = false;
                    newstr += str.substring(p, i - 1);
                    p = i;
                }
            } else if (str[i] === '"') {
                if (isEscaping) {
                    isEscaping = false;
                    newstr += str.substring(p, i - 1);
                    p = i;
                }
            }
        }
        if (p === 0)
            return str;
        else {
            newstr += str.substring(p);
            return newstr;
        }
    } else if (str === 'NIL')
        return null;
    else if (RE_INTEGER.test(str)) {
        
        
        var val = parseInt(str, 10);
        return (val.toString() === str ? val : str);
    } else if (literals && literals.length && str === LITPLACEHOLDER) {
        var l = literals.shift();
        if (Buffer.isBuffer(l))
            l = l.toString('utf8');
        return l;
    }

    return str;
}

function repeat(chr, len) {
    var s = '';
    for (var i = 0; i < len; ++i)
        s += chr;
    return s;
}

function decodeBytes(buf, encoding, offset, mlen, pendoffset, state, nextBuf) {
    if (jsencoding.encodingExists(encoding)) {
        if (state.buffer !== undefined) {
            if (state.encoding === encoding && state.consecutive) {
                
                
                var newbuf = new Buffer(state.buffer.length + buf.length);
                state.buffer.copy(newbuf, 0);
                buf.copy(newbuf, state.buffer.length);
                buf = newbuf;
            } else {
                
                
                
                
                
                state.buffer = state.encoding = undefined;
                state.curReplace = undefined;
            }
        }
        var ret, isPartial = false;
        if (state.remainder !== undefined) {
            
            ret = state.remainder;
            state.remainder = undefined;
        } else {
            try {
                ret = jsencoding.TextDecoder(encoding).decode(buf);
            } catch (e) {
                if (e.message.indexOf('Seeking') === 0)
                    isPartial = true;
            }
        }
        if (!isPartial && nextBuf) {
            
            
            
            var lookahead, lookaheadBuf = new Buffer(buf.length + nextBuf.length);
            buf.copy(lookaheadBuf);
            nextBuf.copy(lookaheadBuf, buf.length);
            try {
                lookahead = jsencoding.TextDecoder(encoding).decode(lookaheadBuf);
            } catch (e) {
                
            }
            if (lookahead !== undefined) {
                if (lookahead.indexOf(ret) === 0) {
                    
                    state.remainder = lookahead.substring(ret.length);
                } else {
                    isPartial = true;
                    ret = undefined;
                }
            }
        }
        if (ret !== undefined) {
            if (state.curReplace) {
                
                
                
                state.replaces.push({
                    fromOffset: state.curReplace[0].fromOffset,
                    toOffset: offset + mlen,
                    val: ret
                });
                state.replaces.splice(state.replaces.indexOf(state.curReplace), 1);
                state.curReplace = undefined;
            } else {
                
                
                state.replaces.push({
                    
                    fromOffset: state.consecutive ? pendoffset : offset,
                    toOffset: offset + mlen,
                    val: ret
                });
            }
            state.buffer = state.encoding = undefined;
            return;
        } else if (isPartial) {
            
            
            
            
            
            state.encoding = encoding;
            state.buffer = buf;
            if (!state.curReplace)
                state.replaces.push(state.curReplace = []);
            state.curReplace.push({
                fromOffset: offset,
                toOffset: offset + mlen,
                
                
                val: repeat('\uFFFD', buf.length)
            });
            return;
        }
    }
    
    
    state.replaces.push({
        fromOffset: offset,
        toOffset: offset + mlen,
        val: buf.toString('binary')
    });
}

function qEncReplacer(match, byte) {
    if (match === '_')
        return ' ';
    else
        return String.fromCharCode(parseInt(byte, 16));
}
function decodeWords(str, state) {
    var pendoffset = -1;

    if (!state) {
        state = {
            buffer: undefined,
            encoding: undefined,
            consecutive: false,
            replaces: undefined,
            curReplace: undefined,
            remainder: undefined
        };
    }

    state.replaces = [];

    var bytes, m, next, i, j, leni, lenj, seq, replaces = [], lastReplace = {};

    
    while (m = RE_ENCWORD.exec(str)) {
        seq = {
            consecutive: (pendoffset > -1
                          ? RE_LWS_ONLY.test(str.substring(pendoffset, m.index))
                          : false),
            charset: m[1].toLowerCase(),
            encoding: m[2].toLowerCase(),
            chunk: m[3],
            index: m.index,
            length: m[0].length,
            pendoffset: pendoffset,
            buf: undefined
        };
        lastReplace = replaces.length && replaces[replaces.length - 1];
        if (seq.consecutive
            && seq.charset === lastReplace.charset
            && seq.encoding === lastReplace.encoding
            && seq.encoding === 'q') {
            lastReplace.length += seq.length + seq.index - pendoffset;
            lastReplace.chunk += seq.chunk;
        } else {
            replaces.push(seq);
            lastReplace = seq;
        }
        pendoffset = m.index + m[0].length;
    }

    
    for (i = 0, leni = replaces.length; i < leni; ++i) {
        m = replaces[i];
        state.consecutive = m.consecutive;
        if (m.encoding === 'q') {
            
            bytes = new Buffer(m.chunk.replace(RE_QENC, qEncReplacer), 'binary');
            next = undefined;
        } else {
            
            bytes = m.buf || new Buffer(m.chunk, 'base64');
            next = replaces[i + 1];
            if (next && next.consecutive && next.encoding === m.encoding
              && next.charset === m.charset) {
                
                
                next.buf = new Buffer(next.chunk, 'base64');
            }
        }
        decodeBytes(bytes, m.charset, m.index, m.length, m.pendoffset, state,
          next && next.buf);
    }

    
    for (i = state.replaces.length - 1; i >= 0; --i) {
        seq = state.replaces[i];
        if (Array.isArray(seq)) {
            for (j = 0, lenj = seq.length; j < lenj; ++j) {
                str = str.substring(0, seq[j].fromOffset)
                      + seq[j].val
                      + str.substring(seq[j].toOffset);
            }
        } else {
            str = str.substring(0, seq.fromOffset)
                  + seq.val
                  + str.substring(seq.toOffset);
        }
    }

    return str;
}

function parseHeader(str, noDecode) {
    var lines = str.split(RE_CRLF),
        len = lines.length,
        header = {},
        state = {
            buffer: undefined,
            encoding: undefined,
            consecutive: false,
            replaces: undefined,
            curReplace: undefined,
            remainder: undefined
        },
        m, h, i, val;

    for (i = 0; i < len; ++i) {
        if (lines[i].length === 0)
            break; 
        if (lines[i][0] === '\t' || lines[i][0] === ' ') {
            if (!Array.isArray(header[h]))
                continue; 
            
            val = lines[i];
            if (!noDecode) {
                if (RE_ENCWORD_END.test(lines[i - 1])
                    && RE_ENCWORD_BEGIN.test(val)) {
                    
                    
                    val = val.substring(1);
                }
            }
            header[h][header[h].length - 1] += val;
        } else {
            m = RE_HDR.exec(lines[i]);
            if (m) {
                h = m[1].toLowerCase().trim();
                if (m[2]) {
                    if (header[h] === undefined)
                        header[h] = [m[2]];
                    else
                        header[h].push(m[2]);
                } else
                    header[h] = [''];
            } else
                break;
        }
    }
    if (!noDecode) {
        var hvs;
        for (h in header) {
            hvs = header[h];
            for (i = 0, len = header[h].length; i < len; ++i)
                hvs[i] = decodeWords(hvs[i], state);
        }
    }

    return header;
}


var Parser = IMAPParser;

var MAX_INT = 9007199254740992,
    KEEPALIVE_INTERVAL = 10000,
    MAX_IDLE_WAIT = 300000, 
    MONTHS = ['Jan', 'Feb', 'Mar',
              'Apr', 'May', 'Jun',
              'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'],
    FETCH_ATTR_MAP = {
        'RFC822.SIZE': 'size',
        'BODY': 'struct',
        'BODYSTRUCTURE': 'struct',
        'ENVELOPE': 'envelope',
        'INTERNALDATE': 'date'
    },
    SPECIAL_USE_ATTRIBUTES = [
      '\\All',
      '\\Archive',
      '\\Drafts',
      '\\Flagged',
      '\\Important',
      '\\Junk',
      '\\Sent',
      '\\Trash'
    ],
    CRLF = '\r\n',
    RE_CMD = /^([^ ]+)(?: |$)/,
    RE_UIDCMD_HASRESULTS = /^UID (?:FETCH|SEARCH|SORT)/,
    RE_IDLENOOPRES = /^(IDLE|NOOP) /,
    RE_OPENBOX = /^EXAMINE|SELECT$/,
    RE_BODYPART = /^BODY\[/,
    RE_INVALID_KW_CHARS = /[\(\)\{\\\"\]\%\*\x00-\x20\x7F]/,
    RE_NUM_RANGE = /^(?:[\d]+|\*):(?:[\d]+|\*)$/,
    RE_BACKSLASH = /\\/g,
    RE_DBLQUOTE = /"/g,
    RE_ESCAPE = /\\\\/g,
    RE_INTEGER = /^\d+$/;

function Connection(config) {
    if (!(this instanceof Connection))
        return new Connection(config);

    EventEmitter.call(this);

    config || (config = {});

    this._config = {
        socket: config.socket,
        socketTimeout: config.socketTimeout || 0,
        host: config.host || 'localhost',
        port: config.port || 143,
        tls: config.tls,
        tlsOptions: config.tlsOptions,
        autotls: config.autotls,
        user: config.user,
        password: config.password,
        xoauth: config.xoauth,
        xoauth2: config.xoauth2,
        connTimeout: config.connTimeout || 10000,
        authTimeout: config.authTimeout || 5000,
        keepalive: (config.keepalive === undefined || config.keepalive === null
                    ? true
                    : config.keepalive)
    };

    this._sock = config.socket || undefined;
    this._tagcount = 0;
    this._tmrConn = undefined;
    this._tmrKeepalive = undefined;
    this._tmrAuth = undefined;
    this._queue = [];
    this._box = undefined;
    this._idle = { started: undefined, enabled: false };
    this._parser = undefined;
    this._curReq = undefined;
    this.delimiter = undefined;
    this.namespaces = undefined;
    this.state = 'disconnected';
    this.debug = config.debug;
}
inherits(Connection, EventEmitter);

Connection.prototype.connect = function () {
    var config = this._config,
        self = this,
        socket,
        parser,
        tlsOptions;

    socket = config.socket || new Socket();
    socket.setKeepAlive(true);
    this._sock = undefined;
    this._tagcount = 0;
    this._tmrConn = undefined;
    this._tmrKeepalive = undefined;
    this._tmrAuth = undefined;
    this._queue = [];
    this._box = undefined;
    this._idle = { started: undefined, enabled: false };
    this._parser = undefined;
    this._curReq = undefined;
    this.delimiter = undefined;
    this.namespaces = undefined;
    this.state = 'disconnected';

    if (config.tls) {
        tlsOptions = {};
        tlsOptions.host = config.host;
        
        for (var k in config.tlsOptions)
            tlsOptions[k] = config.tlsOptions[k];
        tlsOptions.socket = socket;
    }

    if (config.tls)
        this._sock = tls.connect(tlsOptions, onconnect);
    else {
        socket.once('connect', onconnect);
        this._sock = socket;
    }

    function onconnect() {
        clearTimeout(self._tmrConn);
        self.state = 'connected';
        self.debug && self.debug('[connection] Connected to host');
        self._tmrAuth = setTimeout(function () {
            var err = new Error('Timed out while authenticating with server');
            err.source = 'timeout-auth';
            self.emit('error', err);
            socket.destroy();
        }, config.authTimeout);
    }

    this._onError = function (err) {
        clearTimeout(self._tmrConn);
        clearTimeout(self._tmrAuth);
        self.debug && self.debug('[connection] Error: ' + err);
        err.source = 'socket';
        self.emit('error', err);
    };
    this._sock.on('error', this._onError);

    this._onSocketTimeout = function () {
        clearTimeout(self._tmrConn);
        clearTimeout(self._tmrAuth);
        clearTimeout(self._tmrKeepalive);
        self.state = 'disconnected';
        self.debug && self.debug('[connection] Socket timeout');

        var err = new Error('Socket timed out while talking to server');
        err.source = 'socket-timeout';
        self.emit('error', err);
        socket.destroy();
    };
    this._sock.on('timeout', this._onSocketTimeout);
    socket.setTimeout(config.socketTimeout);

    socket.once('close', function (had_err) {
        clearTimeout(self._tmrConn);
        clearTimeout(self._tmrAuth);
        clearTimeout(self._tmrKeepalive);
        self.state = 'disconnected';
        self.debug && self.debug('[connection] Closed');
        self.emit('close', had_err);
    });

    socket.once('end', function () {
        clearTimeout(self._tmrConn);
        clearTimeout(self._tmrAuth);
        clearTimeout(self._tmrKeepalive);
        self.state = 'disconnected';
        self.debug && self.debug('[connection] Ended');
        self.emit('end');
    });

    this._parser = parser = new Parser(this._sock, this.debug);

    parser.on('untagged', function (info) {
        self._resUntagged(info);
    });
    parser.on('tagged', function (info) {
        self._resTagged(info);
    });
    parser.on('body', function (stream, info) {
        var msg = self._curReq.fetchCache[info.seqno], toget;

        if (msg === undefined) {
            msg = self._curReq.fetchCache[info.seqno] = {
                msgEmitter: new EventEmitter(),
                toget: self._curReq.fetching.slice(0),
                attrs: {},
                ended: false
            };

            self._curReq.bodyEmitter.emit('message', msg.msgEmitter, info.seqno);
        }

        toget = msg.toget;

        
        
        
        
        var thisbody = parseExpr(info.which);
        for (var i = 0, len = toget.length; i < len; ++i) {
            if (_deepEqual(thisbody, toget[i])) {
                toget.splice(i, 1);
                msg.msgEmitter.emit('body', stream, info);
                return;
            }
        }
        stream.resume(); 
    });
    parser.on('continue', function (info) {
        var type = self._curReq.type;
        if (type === 'IDLE') {
            if (self._queue.length
                && self._idle.started === 0
                && self._curReq
                && self._curReq.type === 'IDLE'
                && self._sock
                && self._sock.writable
                && !self._idle.enabled) {
                self.debug && self.debug('=> DONE');
                self._sock.write('DONE' + CRLF);
                return;
            }
            
            self._idle.started = Date.now();
        } else if (/^AUTHENTICATE XOAUTH/.test(self._curReq.fullcmd)) {
            self._curReq.oauthError = new Buffer(info.text, 'base64').toString('utf8');
            self.debug && self.debug('=> ' + inspect(CRLF));
            self._sock.write(CRLF);
        } else if (type === 'APPEND') {
            self._sockWriteAppendData(self._curReq.appendData);
        } else if (self._curReq.lines && self._curReq.lines.length) {
            var line = self._curReq.lines.shift() + '\r\n';
            self.debug && self.debug('=> ' + inspect(line));
            self._sock.write(line, 'binary');
        }
    });
    parser.on('other', function (line) {
        var m;
        if (m = RE_IDLENOOPRES.exec(line)) {
            
            self._idle.enabled = false;
            self._idle.started = undefined;
            clearTimeout(self._tmrKeepalive);

            self._curReq = undefined;

            if (self._queue.length === 0
                && self._config.keepalive
                && self.state === 'authenticated'
                && !self._idle.enabled) {
                self._idle.enabled = true;
                if (m[1] === 'NOOP')
                    self._doKeepaliveTimer();
                else
                    self._doKeepaliveTimer(true);
            }

            self._processQueue();
        }
    });

    this._tmrConn = setTimeout(function () {
        var err = new Error('Timed out while connecting to server');
        err.source = 'timeout';
        self.emit('error', err);
        socket.destroy();
    }, config.connTimeout);

    socket.connect(config.port, config.host);
};

Connection.prototype.serverSupports = function (cap) {
    return (this._caps && this._caps.indexOf(cap) > -1);
};

Connection.prototype.destroy = function () {
    this._queue = [];
    this._curReq = undefined;
    this._sock && this._sock.end();
};

Connection.prototype.end = function () {
    var self = this;
    this._enqueue('LOGOUT', function () {
        self._queue = [];
        self._curReq = undefined;
        self._sock.end();
    });
};

Connection.prototype.append = function (data, options, cb) {
    var literal = this.serverSupports('LITERAL+');
    if (typeof options === 'function') {
        cb = options;
        options = undefined;
    }
    options = options || {};
    if (!options.mailbox) {
        if (!this._box)
            throw new Error('No mailbox specified or currently selected');
        else
            options.mailbox = this._box.name;
    }
    var cmd = 'APPEND "' + escape(utf7.encode('' + options.mailbox)) + '"';
    if (options.flags) {
        if (!Array.isArray(options.flags))
            options.flags = [options.flags];
        if (options.flags.length > 0) {
            for (var i = 0, len = options.flags.length; i < len; ++i) {
                if (options.flags[i][0] !== '$' && options.flags[i][0] !== '\\')
                    options.flags[i] = '\\' + options.flags[i];
            }
            cmd += ' (' + options.flags.join(' ') + ')';
        }
    }
    if (options.date) {
        if (!isDate(options.date))
            throw new Error('`date` is not a Date object');
        cmd += ' "';
        cmd += options.date.getDate();
        cmd += '-';
        cmd += MONTHS[options.date.getMonth()];
        cmd += '-';
        cmd += options.date.getFullYear();
        cmd += ' ';
        cmd += ('0' + options.date.getHours()).slice(-2);
        cmd += ':';
        cmd += ('0' + options.date.getMinutes()).slice(-2);
        cmd += ':';
        cmd += ('0' + options.date.getSeconds()).slice(-2);
        cmd += ((options.date.getTimezoneOffset() > 0) ? ' -' : ' +');
        cmd += ('0' + (-options.date.getTimezoneOffset() / 60)).slice(-2);
        cmd += ('0' + (-options.date.getTimezoneOffset() % 60)).slice(-2);
        cmd += '"';
    }
    cmd += ' {';
    cmd += (Buffer.isBuffer(data) ? data.length : Buffer.byteLength(data));
    cmd += (literal ? '+' : '') + '}';

    this._enqueue(cmd, cb);

    if (literal)
        this._queue[this._queue.length - 1].literalAppendData = data;
    else
        this._queue[this._queue.length - 1].appendData = data;
};

Connection.prototype.getBoxes = function (namespace, cb) {
    if (typeof namespace === 'function') {
        cb = namespace;
        namespace = '';
    }

    namespace = escape(utf7.encode('' + namespace));

    this._enqueue('LIST "' + namespace + '" "*"', cb);
};

Connection.prototype.id = function (identification, cb) {
    if (!this.serverSupports('ID'))
        throw new Error('Server does not support ID');
    var cmd = 'ID';
    if ((identification === null) || (Object.keys(identification).length === 0))
        cmd += ' NIL';
    else {
        if (Object.keys(identification).length > 30)
            throw new Error('Max allowed number of keys is 30');
        var kv = [];
        for (var k in identification) {
            if (Buffer.byteLength(k) > 30)
                throw new Error('Max allowed key length is 30');
            if (Buffer.byteLength(identification[k]) > 1024)
                throw new Error('Max allowed value length is 1024');
            kv.push('"' + escape(k) + '"');
            kv.push('"' + escape(identification[k]) + '"');
        }
        cmd += ' (' + kv.join(' ') + ')';
    }
    this._enqueue(cmd, cb);
};

Connection.prototype.openBox = function (name, encoded, readOnly, cb) {
    if (this.state !== 'authenticated')
        throw new Error('Not authenticated');

    if (typeof readOnly === 'function') {
        cb = readOnly;
        readOnly = false;
    }

    var encname = name;

    if (!encoded) {
        name = '' + name;
        encname = escape(utf7.encode(name));
    }

    var cmd = 'SELECT',
        self = this;

    cmd += ' "' + encname + '"';

    if (this.serverSupports('CONDSTORE'))
        cmd += ' (CONDSTORE)';

    this._enqueue(cmd, function (err) {
        if (err) {
            self._box = undefined;
            cb(err);
        } else {
            self._box.name = name;
            cb(err, self._box);
        }
    });
};

Connection.prototype.closeBox = function (shouldExpunge, cb) {
    if (this._box === undefined)
        throw new Error('No mailbox is currently selected');

    var self = this;

    if (typeof shouldExpunge === 'function') {
        cb = shouldExpunge;
        shouldExpunge = true;
    }

    if (shouldExpunge) {
        this._enqueue('CLOSE', function (err) {
            if (!err)
                self._box = undefined;

            cb(err);
        });
    } else {
        if (this.serverSupports('UNSELECT')) {
            // use UNSELECT if available, as it claims to be "cleaner" than the
            // alternative "hack"
            this._enqueue('UNSELECT', function (err) {
                if (!err)
                    self._box = undefined;

                cb(err);
            });
        } else {
            // "HACK": close the box without expunging by attempting to SELECT a
            // non-existent mailbox
            var badbox = 'NODEJSIMAPCLOSINGBOX' + Date.now();
            this._enqueue('SELECT "' + badbox + '"', function (err) {
                self._box = undefined;
                cb();
            });
        }
    }
};

Connection.prototype.addBox = function (name, cb) {
    this._enqueue('CREATE "' + escape(utf7.encode('' + name)) + '"', cb);
};

Connection.prototype.delBox = function (name, cb) {
    this._enqueue('DELETE "' + escape(utf7.encode('' + name)) + '"', cb);
};

Connection.prototype.renameBox = function (oldname, newname, cb) {
    var encoldname = escape(utf7.encode('' + oldname)),
        encnewname = escape(utf7.encode('' + newname)),
        self = this;

    this._enqueue('RENAME "' + encoldname + '" "' + encnewname + '"',
      function (err) {
          if (err)
              return cb(err);

          if (self._box
              && self._box.name === oldname
              && oldname.toUpperCase() !== 'INBOX') {
              self._box.name = newname;
              cb(err, self._box);
          } else
              cb();
      }
    );
};

Connection.prototype.subscribeBox = function (name, cb) {
    this._enqueue('SUBSCRIBE "' + escape(utf7.encode('' + name)) + '"', cb);
};

Connection.prototype.unsubscribeBox = function (name, cb) {
    this._enqueue('UNSUBSCRIBE "' + escape(utf7.encode('' + name)) + '"', cb);
};

Connection.prototype.getSubscribedBoxes = function (namespace, cb) {
    if (typeof namespace === 'function') {
        cb = namespace;
        namespace = '';
    }

    namespace = escape(utf7.encode('' + namespace));

    this._enqueue('LSUB "' + namespace + '" "*"', cb);
};

Connection.prototype.status = function (boxName, cb) {
    if (this._box && this._box.name === boxName)
        throw new Error('Cannot call status on currently selected mailbox');

    boxName = escape(utf7.encode('' + boxName));

    var info = ['MESSAGES', 'RECENT', 'UNSEEN', 'UIDVALIDITY', 'UIDNEXT'];

    if (this.serverSupports('CONDSTORE'))
        info.push('HIGHESTMODSEQ');

    info = info.join(' ');

    this._enqueue('STATUS "' + boxName + '" (' + info + ')', cb);
};

Connection.prototype.expunge = function (uids, cb) {
    if (typeof uids === 'function') {
        cb = uids;
        uids = undefined;
    }

    if (uids !== undefined) {
        if (!Array.isArray(uids))
            uids = [uids];
        validateUIDList(uids);

        if (uids.length === 0)
            return cb(new Error('Empty uid list'))

        uids = uids.join(',');

        if (!this.serverSupports('UIDPLUS'))
            return cb(new Error('Server does not support this feature (UIDPLUS)'));

        this._enqueue('UID EXPUNGE ' + uids, cb);
    } else
        this._enqueue('EXPUNGE', cb);
};

Connection.prototype.search = function (criteria, cb) {
    this._search('UID ', criteria, cb);
};

Connection.prototype._search = function (which, criteria, cb) {
    if (this._box === undefined)
        throw new Error('No mailbox is currently selected');
    else if (!Array.isArray(criteria))
        throw new Error('Expected array for search criteria');

    var cmd = which + 'SEARCH',
        info = { hasUTF8: false /*output*/ },
        query = buildSearchQuery(criteria, this._caps, info),
        lines;
    if (info.hasUTF8) {
        cmd += ' CHARSET UTF-8';
        lines = query.split(CRLF);
        query = lines.shift();
    }
    cmd += query;
    this._enqueue(cmd, cb);
    if (info.hasUTF8) {
        var req = this._queue[this._queue.length - 1];
        req.lines = lines;
    }
};

Connection.prototype.addFlags = function (uids, flags, cb) {
    this._store('UID ', uids, { mode: '+', flags: flags }, cb);
};

Connection.prototype.delFlags = function (uids, flags, cb) {
    this._store('UID ', uids, { mode: '-', flags: flags }, cb);
};

Connection.prototype.setFlags = function (uids, flags, cb) {
    this._store('UID ', uids, { mode: '', flags: flags }, cb);
};

Connection.prototype.addKeywords = function (uids, keywords, cb) {
    this._store('UID ', uids, { mode: '+', keywords: keywords }, cb);
};

Connection.prototype.delKeywords = function (uids, keywords, cb) {
    this._store('UID ', uids, { mode: '-', keywords: keywords }, cb);
};

Connection.prototype.setKeywords = function (uids, keywords, cb) {
    this._store('UID ', uids, { mode: '', keywords: keywords }, cb);
};

Connection.prototype._store = function (which, uids, cfg, cb) {
    var mode = cfg.mode,
        isFlags = (cfg.flags !== undefined),
        items = (isFlags ? cfg.flags : cfg.keywords);
    if (this._box === undefined)
        throw new Error('No mailbox is currently selected');
    else if (uids === undefined)
        throw new Error('No messages specified');

    if (!Array.isArray(uids))
        uids = [uids];
    validateUIDList(uids);

    if (uids.length === 0) {
        throw new Error('Empty '
                        + (which === '' ? 'sequence number' : 'uid')
                        + 'list');
    }

    if ((!Array.isArray(items) && typeof items !== 'string')
        || (Array.isArray(items) && items.length === 0))
        throw new Error((isFlags ? 'Flags' : 'Keywords')
                        + ' argument must be a string or a non-empty Array');
    if (!Array.isArray(items))
        items = [items];
    for (var i = 0, len = items.length; i < len; ++i) {
        if (isFlags) {
            if (items[i][0] !== '\\')
                items[i] = '\\' + items[i];
        } else {
            // keyword contains any char except control characters (%x00-1F and %x7F)
            // and: '(', ')', '{', ' ', '%', '*', '\', '"', ']'
            if (RE_INVALID_KW_CHARS.test(items[i])) {
                throw new Error('The keyword "' + items[i]
                                + '" contains invalid characters');
            }
        }
    }

    items = items.join(' ');
    uids = uids.join(',');

    var modifiers = '';
    if (cfg.modseq !== undefined && !this._box.nomodseq)
        modifiers += 'UNCHANGEDSINCE ' + cfg.modseq + ' ';

    this._enqueue(which + 'STORE ' + uids + ' '
                  + modifiers
                  + mode + 'FLAGS.SILENT (' + items + ')', cb);
};

Connection.prototype.copy = function (uids, boxTo, cb) {
    this._copy('UID ', uids, boxTo, cb);
};

Connection.prototype._copy = function (which, uids, boxTo, cb) {
    if (this._box === undefined)
        throw new Error('No mailbox is currently selected');

    if (!Array.isArray(uids))
        uids = [uids];
    validateUIDList(uids);

    if (uids.length === 0) {
        throw new Error('Empty '
                        + (which === '' ? 'sequence number' : 'uid')
                        + 'list');
    }

    boxTo = escape(utf7.encode('' + boxTo));

    this._enqueue(which + 'COPY ' + uids.join(',') + ' "' + boxTo + '"', cb);
};

Connection.prototype.move = function (uids, boxTo, cb) {
    this._move('UID ', uids, boxTo, cb);
};

Connection.prototype._move = function (which, uids, boxTo, cb) {
    if (this._box === undefined)
        throw new Error('No mailbox is currently selected');

    if (this.serverSupports('MOVE')) {
        if (!Array.isArray(uids))
            uids = [uids];
        validateUIDList(uids);

        if (uids.length === 0) {
            throw new Error('Empty '
                            + (which === '' ? 'sequence number' : 'uid')
                            + 'list');
        }

        uids = uids.join(',');
        boxTo = escape(utf7.encode('' + boxTo));

        this._enqueue(which + 'MOVE ' + uids + ' "' + boxTo + '"', cb);
    } else if (this._box.permFlags.indexOf('\\Deleted') === -1
               && this._box.flags.indexOf('\\Deleted') === -1) {
        throw new Error('Cannot move message: '
                        + 'server does not allow deletion of messages');
    } else {
        var deletedUIDs, task = 0, self = this;
        this._copy(which, uids, boxTo, function ccb(err, info) {
            if (err)
                return cb(err, info);

            if (task === 0 && which && self.serverSupports('UIDPLUS')) {
                // UIDPLUS gives us a 'UID EXPUNGE n' command to expunge a subset of
                // messages with the \Deleted flag set. This allows us to skip some
                // actions.
                task = 2;
            }
            // Make sure we don't expunge any messages marked as Deleted except the
            // one we are moving
            if (task === 0) {
                self.search(['DELETED'], function (e, result) {
                    ++task;
                    deletedUIDs = result;
                    ccb(e, info);
                });
            } else if (task === 1) {
                if (deletedUIDs.length) {
                    self.delFlags(deletedUIDs, '\\Deleted', function (e) {
                        ++task;
                        ccb(e, info);
                    });
                } else {
                    ++task;
                    ccb(err, info);
                }
            } else if (task === 2) {
                var cbMarkDel = function (e) {
                    ++task;
                    ccb(e, info);
                };
                if (which)
                    self.addFlags(uids, '\\Deleted', cbMarkDel);
                else
                    self.seq.addFlags(uids, '\\Deleted', cbMarkDel);
            } else if (task === 3) {
                if (which && self.serverSupports('UIDPLUS')) {
                    self.expunge(uids, function (e) {
                        cb(e, info);
                    });
                } else {
                    self.expunge(function (e) {
                        ++task;
                        ccb(e, info);
                    });
                }
            } else if (task === 4) {
                if (deletedUIDs.length) {
                    self.addFlags(deletedUIDs, '\\Deleted', function (e) {
                        cb(e, info);
                    });
                } else
                    cb(err, info);
            }
        });
    }
};

Connection.prototype.fetch = function (uids, options) {
    return this._fetch('UID ', uids, options);
};

Connection.prototype._fetch = function (which, uids, options) {
    if (uids === undefined
        || uids === null
        || (Array.isArray(uids) && uids.length === 0))
        throw new Error('Nothing to fetch');

    if (!Array.isArray(uids))
        uids = [uids];
    validateUIDList(uids);

    if (uids.length === 0) {
        throw new Error('Empty '
                        + (which === '' ? 'sequence number' : 'uid')
                        + 'list');
    }

    uids = uids.join(',');

    var cmd = which + 'FETCH ' + uids + ' (',
        fetching = [],
        i, len, key;

    if (this.serverSupports('X-GM-EXT-1')) {
        fetching.push('X-GM-THRID');
        fetching.push('X-GM-MSGID');
        fetching.push('X-GM-LABELS');
    }
    if (this.serverSupports('CONDSTORE') && !this._box.nomodseq)
        fetching.push('MODSEQ');

    fetching.push('UID');
    fetching.push('FLAGS');
    fetching.push('INTERNALDATE');

    var modifiers;

    if (options) {
        modifiers = options.modifiers;
        if (options.envelope)
            fetching.push('ENVELOPE');
        if (options.struct)
            fetching.push('BODYSTRUCTURE');
        if (options.size)
            fetching.push('RFC822.SIZE');
        cmd += fetching.join(' ');
        if (options.bodies !== undefined) {
            var bodies = options.bodies,
                prefix = (options.markSeen ? '' : '.PEEK');
            if (!Array.isArray(bodies))
                bodies = [bodies];
            for (i = 0, len = bodies.length; i < len; ++i) {
                fetching.push(parseExpr('' + bodies[i]));
                cmd += ' BODY' + prefix + '[' + bodies[i] + ']';
            }
        }
    } else
        cmd += fetching.join(' ');

    cmd += ')';

    var modkeys = (typeof modifiers === 'object' ? Object.keys(modifiers) : []),
        modstr = ' (';
    for (i = 0, len = modkeys.length, key; i < len; ++i) {
        key = modkeys[i].toUpperCase();
        if (key === 'CHANGEDSINCE' && this.serverSupports('CONDSTORE')
            && !this._box.nomodseq)
            modstr += key + ' ' + modifiers[modkeys[i]] + ' ';
    }
    if (modstr.length > 2) {
        cmd += modstr.substring(0, modstr.length - 1);
        cmd += ')';
    }

    this._enqueue(cmd);
    var req = this._queue[this._queue.length - 1];
    req.fetchCache = {};
    req.fetching = fetching;
    return (req.bodyEmitter = new EventEmitter());
};

// Extension methods ===========================================================
Connection.prototype.setLabels = function (uids, labels, cb) {
    this._storeLabels('UID ', uids, labels, '', cb);
};

Connection.prototype.addLabels = function (uids, labels, cb) {
    this._storeLabels('UID ', uids, labels, '+', cb);
};

Connection.prototype.delLabels = function (uids, labels, cb) {
    this._storeLabels('UID ', uids, labels, '-', cb);
};

Connection.prototype._storeLabels = function (which, uids, labels, mode, cb) {
    if (!this.serverSupports('X-GM-EXT-1'))
        throw new Error('Server must support X-GM-EXT-1 capability');
    else if (this._box === undefined)
        throw new Error('No mailbox is currently selected');
    else if (uids === undefined)
        throw new Error('No messages specified');

    if (!Array.isArray(uids))
        uids = [uids];
    validateUIDList(uids);

    if (uids.length === 0) {
        throw new Error('Empty '
                        + (which === '' ? 'sequence number' : 'uid')
                        + 'list');
    }

    if ((!Array.isArray(labels) && typeof labels !== 'string')
        || (Array.isArray(labels) && labels.length === 0))
        throw new Error('labels argument must be a string or a non-empty Array');

    if (!Array.isArray(labels))
        labels = [labels];
    labels = labels.map(function (v) {
        return '"' + escape(utf7.encode('' + v)) + '"';
    }).join(' ');

    uids = uids.join(',');

    this._enqueue(which + 'STORE ' + uids + ' ' + mode
                  + 'X-GM-LABELS.SILENT (' + labels + ')', cb);
};

Connection.prototype.sort = function (sorts, criteria, cb) {
    this._sort('UID ', sorts, criteria, cb);
};

Connection.prototype._sort = function (which, sorts, criteria, cb) {
    if (this._box === undefined)
        throw new Error('No mailbox is currently selected');
    else if (!Array.isArray(sorts) || !sorts.length)
        throw new Error('Expected array with at least one sort criteria');
    else if (!Array.isArray(criteria))
        throw new Error('Expected array for search criteria');
    else if (!this.serverSupports('SORT'))
        throw new Error('Sort is not supported on the server');

    sorts = sorts.map(function (c) {
        if (typeof c !== 'string')
            throw new Error('Unexpected sort criteria data type. '
                            + 'Expected string. Got: ' + typeof criteria);

        var modifier = '';
        if (c[0] === '-') {
            modifier = 'REVERSE ';
            c = c.substring(1);
        }
        switch (c.toUpperCase()) {
            case 'ARRIVAL':
            case 'CC':
            case 'DATE':
            case 'FROM':
            case 'SIZE':
            case 'SUBJECT':
            case 'TO':
                break;
            default:
                throw new Error('Unexpected sort criteria: ' + c);
        }

        return modifier + c;
    });

    sorts = sorts.join(' ');

    var info = { hasUTF8: false /*output*/ },
        query = buildSearchQuery(criteria, this._caps, info),
        charset = 'US-ASCII',
        lines;
    if (info.hasUTF8) {
        charset = 'UTF-8';
        lines = query.split(CRLF);
        query = lines.shift();
    }

    this._enqueue(which + 'SORT (' + sorts + ') ' + charset + query, cb);
    if (info.hasUTF8) {
        var req = this._queue[this._queue.length - 1];
        req.lines = lines;
    }
};

Connection.prototype.esearch = function (criteria, options, cb) {
    this._esearch('UID ', criteria, options, cb);
};

Connection.prototype._esearch = function (which, criteria, options, cb) {
    if (this._box === undefined)
        throw new Error('No mailbox is currently selected');
    else if (!Array.isArray(criteria))
        throw new Error('Expected array for search options');

    var info = { hasUTF8: false /*output*/ },
        query = buildSearchQuery(criteria, this._caps, info),
        charset = '',
        lines;
    if (info.hasUTF8) {
        charset = ' CHARSET UTF-8';
        lines = query.split(CRLF);
        query = lines.shift();
    }

    if (typeof options === 'function') {
        cb = options;
        options = '';
    } else if (!options)
        options = '';

    if (Array.isArray(options))
        options = options.join(' ');

    this._enqueue(which + 'SEARCH RETURN (' + options + ')' + charset + query, cb);
    if (info.hasUTF8) {
        var req = this._queue[this._queue.length - 1];
        req.lines = lines;
    }
};

Connection.prototype.setQuota = function (quotaRoot, limits, cb) {
    if (typeof limits === 'function') {
        cb = limits;
        limits = {};
    }

    var triplets = '';
    for (var l in limits) {
        if (triplets)
            triplets += ' ';
        triplets += l + ' ' + limits[l];
    }

    quotaRoot = escape(utf7.encode('' + quotaRoot));

    this._enqueue('SETQUOTA "' + quotaRoot + '" (' + triplets + ')',
      function (err, quotalist) {
          if (err)
              return cb(err);

          cb(err, quotalist ? quotalist[0] : limits);
      }
    );
};

Connection.prototype.getQuota = function (quotaRoot, cb) {
    quotaRoot = escape(utf7.encode('' + quotaRoot));

    this._enqueue('GETQUOTA "' + quotaRoot + '"', function (err, quotalist) {
        if (err)
            return cb(err);

        cb(err, quotalist[0]);
    });
};

Connection.prototype.getQuotaRoot = function (boxName, cb) {
    boxName = escape(utf7.encode('' + boxName));

    this._enqueue('GETQUOTAROOT "' + boxName + '"', function (err, quotalist) {
        if (err)
            return cb(err);

        var quotas = {};
        if (quotalist) {
            for (var i = 0, len = quotalist.length; i < len; ++i)
                quotas[quotalist[i].root] = quotalist[i].resources;
        }

        cb(err, quotas);
    });
};

Connection.prototype.thread = function (algorithm, criteria, cb) {
    this._thread('UID ', algorithm, criteria, cb);
};

Connection.prototype._thread = function (which, algorithm, criteria, cb) {
    algorithm = algorithm.toUpperCase();

    if (!this.serverSupports('THREAD=' + algorithm))
        throw new Error('Server does not support that threading algorithm');

    var info = { hasUTF8: false /*output*/ },
        query = buildSearchQuery(criteria, this._caps, info),
        charset = 'US-ASCII',
        lines;
    if (info.hasUTF8) {
        charset = 'UTF-8';
        lines = query.split(CRLF);
        query = lines.shift();
    }

    this._enqueue(which + 'THREAD ' + algorithm + ' ' + charset + query, cb);
    if (info.hasUTF8) {
        var req = this._queue[this._queue.length - 1];
        req.lines = lines;
    }
};

Connection.prototype.addFlagsSince = function (uids, flags, modseq, cb) {
    this._store('UID ',
                uids,
                { mode: '+', flags: flags, modseq: modseq },
                cb);
};

Connection.prototype.delFlagsSince = function (uids, flags, modseq, cb) {
    this._store('UID ',
                uids,
                { mode: '-', flags: flags, modseq: modseq },
                cb);
};

Connection.prototype.setFlagsSince = function (uids, flags, modseq, cb) {
    this._store('UID ',
                uids,
                { mode: '', flags: flags, modseq: modseq },
                cb);
};

Connection.prototype.addKeywordsSince = function (uids, keywords, modseq, cb) {
    this._store('UID ',
                uids,
                { mode: '+', keywords: keywords, modseq: modseq },
                cb);
};

Connection.prototype.delKeywordsSince = function (uids, keywords, modseq, cb) {
    this._store('UID ',
                uids,
                { mode: '-', keywords: keywords, modseq: modseq },
                cb);
};

Connection.prototype.setKeywordsSince = function (uids, keywords, modseq, cb) {
    this._store('UID ',
                uids,
                { mode: '', keywords: keywords, modseq: modseq },
                cb);
};
// END Extension methods =======================================================

// Namespace for seqno-based commands
Connection.prototype.__defineGetter__('seq', function () {
    var self = this;
    return {
        delKeywords: function (seqnos, keywords, cb) {
            self._store('', seqnos, { mode: '-', keywords: keywords }, cb);
        },
        addKeywords: function (seqnos, keywords, cb) {
            self._store('', seqnos, { mode: '+', keywords: keywords }, cb);
        },
        setKeywords: function (seqnos, keywords, cb) {
            self._store('', seqnos, { mode: '', keywords: keywords }, cb);
        },

        delFlags: function (seqnos, flags, cb) {
            self._store('', seqnos, { mode: '-', flags: flags }, cb);
        },
        addFlags: function (seqnos, flags, cb) {
            self._store('', seqnos, { mode: '+', flags: flags }, cb);
        },
        setFlags: function (seqnos, flags, cb) {
            self._store('', seqnos, { mode: '', flags: flags }, cb);
        },

        move: function (seqnos, boxTo, cb) {
            self._move('', seqnos, boxTo, cb);
        },
        copy: function (seqnos, boxTo, cb) {
            self._copy('', seqnos, boxTo, cb);
        },
        fetch: function (seqnos, options) {
            return self._fetch('', seqnos, options);
        },
        search: function (options, cb) {
            self._search('', options, cb);
        },

        // Extensions ==============================================================
        delLabels: function (seqnos, labels, cb) {
            self._storeLabels('', seqnos, labels, '-', cb);
        },
        addLabels: function (seqnos, labels, cb) {
            self._storeLabels('', seqnos, labels, '+', cb);
        },
        setLabels: function (seqnos, labels, cb) {
            self._storeLabels('', seqnos, labels, '', cb);
        },

        esearch: function (criteria, options, cb) {
            self._esearch('', criteria, options, cb);
        },

        sort: function (sorts, options, cb) {
            self._sort('', sorts, options, cb);
        },
        thread: function (algorithm, criteria, cb) {
            self._thread('', algorithm, criteria, cb);
        },

        delKeywordsSince: function (seqnos, keywords, modseq, cb) {
            self._store('',
                        seqnos,
                        { mode: '-', keywords: keywords, modseq: modseq },
                        cb);
        },
        addKeywordsSince: function (seqnos, keywords, modseq, cb) {
            self._store('',
                        seqnos,
                        { mode: '+', keywords: keywords, modseq: modseq },
                        cb);
        },
        setKeywordsSince: function (seqnos, keywords, modseq, cb) {
            self._store('',
                        seqnos,
                        { mode: '', keywords: keywords, modseq: modseq },
                        cb);
        },

        delFlagsSince: function (seqnos, flags, modseq, cb) {
            self._store('',
                        seqnos,
                        { mode: '-', flags: flags, modseq: modseq },
                        cb);
        },
        addFlagsSince: function (seqnos, flags, modseq, cb) {
            self._store('',
                        seqnos,
                        { mode: '+', flags: flags, modseq: modseq },
                        cb);
        },
        setFlagsSince: function (seqnos, flags, modseq, cb) {
            self._store('',
                        seqnos,
                        { mode: '', flags: flags, modseq: modseq },
                        cb);
        }
    };
});

Connection.prototype._resUntagged = function (info) {
    var type = info.type, i, len, box, attrs, key;

    if (type === 'bye')
        this._sock.end();
    else if (type === 'namespace')
        this.namespaces = info.text;
    else if (type === 'id')
        this._curReq.cbargs.push(info.text);
    else if (type === 'capability')
        this._caps = info.text.map(function (v) { return v.toUpperCase(); });
    else if (type === 'preauth')
        this.state = 'authenticated';
    else if (type === 'sort' || type === 'thread' || type === 'esearch')
        this._curReq.cbargs.push(info.text);
    else if (type === 'search') {
        if (info.text.results !== undefined) {
            // CONDSTORE-modified search results
            this._curReq.cbargs.push(info.text.results);
            this._curReq.cbargs.push(info.text.modseq);
        } else
            this._curReq.cbargs.push(info.text);
    } else if (type === 'quota') {
        var cbargs = this._curReq.cbargs;
        if (!cbargs.length)
            cbargs.push([]);
        cbargs[0].push(info.text);
    } else if (type === 'recent') {
        if (!this._box && RE_OPENBOX.test(this._curReq.type))
            this._createCurrentBox();
        if (this._box)
            this._box.messages.new = info.num;
    } else if (type === 'flags') {
        if (!this._box && RE_OPENBOX.test(this._curReq.type))
            this._createCurrentBox();
        if (this._box)
            this._box.flags = info.text;
    } else if (type === 'bad' || type === 'no') {
        if (this.state === 'connected' && !this._curReq) {
            clearTimeout(this._tmrConn);
            clearTimeout(this._tmrAuth);
            var err = new Error('Received negative welcome: ' + info.text);
            err.source = 'protocol';
            this.emit('error', err);
            this._sock.end();
        }
    } else if (type === 'exists') {
        if (!this._box && RE_OPENBOX.test(this._curReq.type))
            this._createCurrentBox();
        if (this._box) {
            var prev = this._box.messages.total,
                now = info.num;
            this._box.messages.total = now;
            if (now > prev && this.state === 'authenticated') {
                this._box.messages.new = now - prev;
                this.emit('mail', this._box.messages.new);
            }
        }
    } else if (type === 'expunge') {
        if (this._box) {
            if (this._box.messages.total > 0)
                --this._box.messages.total;
            this.emit('expunge', info.num);
        }
    } else if (type === 'ok') {
        if (this.state === 'connected' && !this._curReq)
            this._login();
        else if (typeof info.textCode === 'string'
                 && info.textCode.toUpperCase() === 'ALERT')
            this.emit('alert', info.text);
        else if (this._curReq
                 && info.textCode
                 && (RE_OPENBOX.test(this._curReq.type))) {
            // we're opening a mailbox

            if (!this._box)
                this._createCurrentBox();

            if (info.textCode.key)
                key = info.textCode.key.toUpperCase();
            else
                key = info.textCode;

            if (key === 'UIDVALIDITY')
                this._box.uidvalidity = info.textCode.val;
            else if (key === 'UIDNEXT')
                this._box.uidnext = info.textCode.val;
            else if (key === 'HIGHESTMODSEQ')
                this._box.highestmodseq = '' + info.textCode.val;
            else if (key === 'PERMANENTFLAGS') {
                var idx, permFlags, keywords;
                this._box.permFlags = permFlags = info.textCode.val;
                if ((idx = this._box.permFlags.indexOf('\\*')) > -1) {
                    this._box.newKeywords = true;
                    permFlags.splice(idx, 1);
                }
                this._box.keywords = keywords = permFlags.filter(function (f) {
                    return (f[0] !== '\\');
                });
                for (i = 0, len = keywords.length; i < len; ++i)
                    permFlags.splice(permFlags.indexOf(keywords[i]), 1);
            } else if (key === 'UIDNOTSTICKY')
                this._box.persistentUIDs = false;
            else if (key === 'NOMODSEQ')
                this._box.nomodseq = true;
        } else if (typeof info.textCode === 'string'
                   && info.textCode.toUpperCase() === 'UIDVALIDITY')
            this.emit('uidvalidity', info.text);
    } else if (type === 'list' || type === 'lsub') {
        if (this.delimiter === undefined)
            this.delimiter = info.text.delimiter;
        else {
            if (this._curReq.cbargs.length === 0)
                this._curReq.cbargs.push({});

            box = {
                attribs: info.text.flags,
                delimiter: info.text.delimiter,
                children: null,
                parent: null
            };

            for (i = 0, len = SPECIAL_USE_ATTRIBUTES.length; i < len; ++i)
                if (box.attribs.indexOf(SPECIAL_USE_ATTRIBUTES[i]) > -1)
                    box.special_use_attrib = SPECIAL_USE_ATTRIBUTES[i];

            var name = info.text.name,
                curChildren = this._curReq.cbargs[0];

            if (box.delimiter) {
                var path = name.split(box.delimiter),
                    parent = null;
                name = path.pop();
                for (i = 0, len = path.length; i < len; ++i) {
                    if (!curChildren[path[i]])
                        curChildren[path[i]] = {};
                    if (!curChildren[path[i]].children)
                        curChildren[path[i]].children = {};
                    parent = curChildren[path[i]];
                    curChildren = curChildren[path[i]].children;
                }
                box.parent = parent;
            }
            if (curChildren[name])
                box.children = curChildren[name].children;
            curChildren[name] = box;
        }
    } else if (type === 'status') {
        box = {
            name: info.text.name,
            uidnext: 0,
            uidvalidity: 0,
            messages: {
                total: 0,
                new: 0,
                unseen: 0
            }
        };
        attrs = info.text.attrs;

        if (attrs) {
            if (attrs.recent !== undefined)
                box.messages.new = attrs.recent;
            if (attrs.unseen !== undefined)
                box.messages.unseen = attrs.unseen;
            if (attrs.messages !== undefined)
                box.messages.total = attrs.messages;
            if (attrs.uidnext !== undefined)
                box.uidnext = attrs.uidnext;
            if (attrs.uidvalidity !== undefined)
                box.uidvalidity = attrs.uidvalidity;
            if (attrs.highestmodseq !== undefined) // CONDSTORE
                box.highestmodseq = '' + attrs.highestmodseq;
        }
        this._curReq.cbargs.push(box);
    } else if (type === 'fetch') {
        if (/^(?:UID )?FETCH/.test(this._curReq.fullcmd)) {
            // FETCH response sent as result of FETCH request
            var msg = this._curReq.fetchCache[info.num],
                keys = Object.keys(info.text),
                keyslen = keys.length,
                toget, msgEmitter, j;

            if (msg === undefined) {
                // simple case -- no bodies were streamed
                toget = this._curReq.fetching.slice(0);
                if (toget.length === 0)
                    return;

                msgEmitter = new EventEmitter();
                attrs = {};

                this._curReq.bodyEmitter.emit('message', msgEmitter, info.num);
            } else {
                toget = msg.toget;
                msgEmitter = msg.msgEmitter;
                attrs = msg.attrs;
            }

            i = toget.length;
            if (i === 0) {
                if (msg && !msg.ended) {
                    msg.ended = true;
                    process.nextTick(function () {
                        msgEmitter.emit('end');
                    });
                }
                return;
            }

            if (keyslen > 0) {
                while (--i >= 0) {
                    j = keyslen;
                    while (--j >= 0) {
                        if (keys[j].toUpperCase() === toget[i]) {
                            if (!RE_BODYPART.test(toget[i])) {
                                if (toget[i] === 'X-GM-LABELS') {
                                    var labels = info.text[keys[j]];
                                    for (var k = 0, lenk = labels.length; k < lenk; ++k)
                                        labels[k] = ('' + labels[k]).replace(RE_ESCAPE, '\\');
                                }
                                key = FETCH_ATTR_MAP[toget[i]];
                                if (!key)
                                    key = toget[i].toLowerCase();
                                attrs[key] = info.text[keys[j]];
                            }
                            toget.splice(i, 1);
                            break;
                        }
                    }
                }
            }

            if (toget.length === 0) {
                if (msg)
                    msg.ended = true;
                process.nextTick(function () {
                    msgEmitter.emit('attributes', attrs);
                    msgEmitter.emit('end');
                });
            } else if (msg === undefined) {
                this._curReq.fetchCache[info.num] = {
                    msgEmitter: msgEmitter,
                    toget: toget,
                    attrs: attrs,
                    ended: false
                };
            }
        } else {
            // FETCH response sent as result of STORE request or sent unilaterally,
            // treat them as the same for now for simplicity
            this.emit('update', info.num, info.text);
        }
    }
};

Connection.prototype._resTagged = function (info) {
    var req = this._curReq, err;

    this._curReq = undefined;

    if (info.type === 'no' || info.type === 'bad') {
        var errtext;
        if (info.text)
            errtext = info.text;
        else
            errtext = req.oauthError;
        err = new Error(errtext);
        err.type = info.type;
        err.textCode = info.textCode;
        err.source = 'protocol';
    } else if (this._box) {
        if (req.type === 'EXAMINE' || req.type === 'SELECT') {
            this._box.readOnly = (typeof info.textCode === 'string'
                                  && info.textCode.toUpperCase() === 'READ-ONLY');
        }

        // According to RFC 3501, UID commands do not give errors for
        // non-existant user-supplied UIDs, so give the callback empty results
        // if we unexpectedly received no untagged responses.
        if (RE_UIDCMD_HASRESULTS.test(req.fullcmd) && req.cbargs.length === 0)
            req.cbargs.push([]);
    }

    if (req.bodyEmitter) {
        var bodyEmitter = req.bodyEmitter;
        if (err)
            bodyEmitter.emit('error', err);
        process.nextTick(function () {
            bodyEmitter.emit('end');
        });
    } else {
        req.cbargs.unshift(err);
        if (info.textCode && info.textCode.key) {
            var key = info.textCode.key.toUpperCase();
            if (key === 'APPENDUID') // [uidvalidity, newUID]
                req.cbargs.push(info.textCode.val[1]);
            else if (key === 'COPYUID') // [uidvalidity, sourceUIDs, destUIDs]
                req.cbargs.push(info.textCode.val[2]);
        }
        req.cb && req.cb.apply(this, req.cbargs);
    }

    if (this._queue.length === 0
        && this._config.keepalive
        && this.state === 'authenticated'
        && !this._idle.enabled) {
        this._idle.enabled = true;
        this._doKeepaliveTimer(true);
    }

    this._processQueue();
};

Connection.prototype._createCurrentBox = function () {
    this._box = {
        name: '',
        flags: [],
        readOnly: false,
        uidvalidity: 0,
        uidnext: 0,
        permFlags: [],
        keywords: [],
        newKeywords: false,
        persistentUIDs: true,
        nomodseq: false,
        messages: {
            total: 0,
            new: 0
        }
    };
};

Connection.prototype._doKeepaliveTimer = function (immediate) {
    var self = this,
        interval = this._config.keepalive.interval || KEEPALIVE_INTERVAL,
        idleWait = this._config.keepalive.idleInterval || MAX_IDLE_WAIT,
        forceNoop = this._config.keepalive.forceNoop || false,
        timerfn = function () {
            if (self._idle.enabled) {
                // unlike NOOP, IDLE is only a valid command after authenticating
                if (!self.serverSupports('IDLE')
                    || self.state !== 'authenticated'
                    || forceNoop)
                    self._enqueue('NOOP', true);
                else {
                    if (self._idle.started === undefined) {
                        self._idle.started = 0;
                        self._enqueue('IDLE', true);
                    } else if (self._idle.started > 0) {
                        var timeDiff = Date.now() - self._idle.started;
                        if (timeDiff >= idleWait) {
                            self._idle.enabled = false;
                            self.debug && self.debug('=> DONE');
                            self._sock.write('DONE' + CRLF);
                            return;
                        }
                    }
                    self._tmrKeepalive = setTimeout(timerfn, interval);
                }
            }
        };

    if (immediate)
        timerfn();
    else
        this._tmrKeepalive = setTimeout(timerfn, interval);
};

Connection.prototype._login = function () {
    var self = this, checkedNS = false;

    var reentry = function (err) {
        clearTimeout(self._tmrAuth);
        if (err) {
            self.emit('error', err);
            return self._sock.end();
        }

        // 2. Get the list of available namespaces (RFC2342)
        if (!checkedNS && self.serverSupports('NAMESPACE')) {
            checkedNS = true;
            return self._enqueue('NAMESPACE', reentry);
        }

        // 3. Get the top-level mailbox hierarchy delimiter used by the server
        self._enqueue('LIST "" ""', function () {
            self.state = 'authenticated';
            self.emit('ready');
        });
    };

    // 1. Get the supported capabilities
    self._enqueue('CAPABILITY', function () {
        // No need to attempt the login sequence if we're on a PREAUTH connection.
        if (self.state === 'connected') {
            var err,
                checkCaps = function (error) {
                    if (error) {
                        error.source = 'authentication';
                        return reentry(error);
                    }

                    if (self._caps === undefined) {
                        // Fetch server capabilities if they were not automatically
                        // provided after authentication
                        return self._enqueue('CAPABILITY', reentry);
                    } else
                        reentry();
                };

            if (self.serverSupports('STARTTLS')
                && (self._config.autotls === 'always'
                    || (self._config.autotls === 'required'
                        && self.serverSupports('LOGINDISABLED')))) {
                self._starttls();
                return;
            }

            if (self.serverSupports('LOGINDISABLED')) {
                err = new Error('Logging in is disabled on this server');
                err.source = 'authentication';
                return reentry(err);
            }

            var cmd;
            if (self.serverSupports('AUTH=XOAUTH') && self._config.xoauth) {
                self._caps = undefined;
                cmd = 'AUTHENTICATE XOAUTH';
                // are there any servers that support XOAUTH/XOAUTH2 and not SASL-IR?
                
                cmd += ' ' + escape(self._config.xoauth);
                self._enqueue(cmd, checkCaps);
            } else if (self.serverSupports('AUTH=XOAUTH2') && self._config.xoauth2) {
                self._caps = undefined;
                cmd = 'AUTHENTICATE XOAUTH2';
                
                cmd += ' ' + escape(self._config.xoauth2);
                self._enqueue(cmd, checkCaps);
            } else if (self._config.user && self._config.password) {
                self._caps = undefined;
                self._enqueue('LOGIN "' + escape(self._config.user) + '" "'
                              + escape(self._config.password) + '"', checkCaps);
            } else {
                err = new Error('No supported authentication method(s) available. '
                                + 'Unable to login.');
                err.source = 'authentication';
                return reentry(err);
            }
        } else
            reentry();
    });
};

Connection.prototype._starttls = function () {
    var self = this;
    this._enqueue('STARTTLS', function (err) {
        if (err) {
            self.emit('error', err);
            return self._sock.end();
        }

        self._caps = undefined;
        self._sock.removeAllListeners('error');

        var tlsOptions = {};

        tlsOptions.host = this._config.host;
        
        for (var k in this._config.tlsOptions)
            tlsOptions[k] = this._config.tlsOptions[k];
        tlsOptions.socket = self._sock;

        self._sock = tls.connect(tlsOptions, function () {
            self._login();
        });

        self._sock.on('error', self._onError);
        self._sock.on('timeout', this._onSocketTimeout);
        self._sock.setTimeout(config.socketTimeout);

        self._parser.setStream(self._sock);
    });
};

Connection.prototype._processQueue = function () {
    if (this._curReq || !this._queue.length || !this._sock || !this._sock.writable)
        return;

    this._curReq = this._queue.shift();

    if (this._tagcount === MAX_INT)
        this._tagcount = 0;

    var prefix;

    if (this._curReq.type === 'IDLE' || this._curReq.type === 'NOOP')
        prefix = this._curReq.type;
    else
        prefix = 'A' + (this._tagcount++);

    var out = prefix + ' ' + this._curReq.fullcmd;
    this.debug && this.debug('=> ' + inspect(out));
    this._sock.write(out + CRLF, 'utf8');

    if (this._curReq.literalAppendData) {
        
        this._sockWriteAppendData(this._curReq.literalAppendData);
    }
};

Connection.prototype._sockWriteAppendData = function (appendData) {
    var val = appendData;
    if (Buffer.isBuffer(appendData))
        val = val.toString('utf8');

    this.debug && this.debug('=> ' + inspect(val));
    this._sock.write(val);
    this._sock.write(CRLF);
};

Connection.prototype._enqueue = function (fullcmd, promote, cb) {
    if (typeof promote === 'function') {
        cb = promote;
        promote = false;
    }

    var info = {
        type: fullcmd.match(RE_CMD)[1],
        fullcmd: fullcmd,
        cb: cb,
        cbargs: []
    },
        self = this;

    if (promote)
        this._queue.unshift(info);
    else
        this._queue.push(info);

    if (!this._curReq
        && this.state !== 'disconnected'
        && this.state !== 'upgrading') {
        
        
        process.nextTick(function () { self._processQueue(); });
    } else if (this._curReq
               && this._curReq.type === 'IDLE'
               && this._sock
               && this._sock.writable
               && this._idle.enabled) {
        this._idle.enabled = false;
        clearTimeout(this._tmrKeepalive);
        if (this._idle.started > 0) {
            
            this.debug && this.debug('=> DONE');
            this._sock.write('DONE' + CRLF);
        }
    }
};

Connection.parseHeader = parseHeader; 

module.exports = Connection;



function escape(str) {
    return str.replace(RE_BACKSLASH, '\\\\').replace(RE_DBLQUOTE, '\\"');
}

function validateUIDList(uids, noThrow) {
    for (var i = 0, len = uids.length, intval; i < len; ++i) {
        if (typeof uids[i] === 'string') {
            if (uids[i] === '*' || uids[i] === '*:*') {
                if (len > 1)
                    uids = ['*'];
                break;
            } else if (RE_NUM_RANGE.test(uids[i]))
                continue;
        }
        intval = parseInt('' + uids[i], 10);
        if (isNaN(intval)) {
            var err = new Error('UID/seqno must be an integer, "*", or a range: '
                                + uids[i]);
            if (noThrow)
                return err;
            else
                throw err;
        } else if (typeof uids[i] !== 'number')
            uids[i] = intval;
    }
}

function hasNonASCII(str) {
    for (var i = 0, len = str.length; i < len; ++i) {
        if (str.charCodeAt(i) > 0x7F)
            return true;
    }
    return false;
}

function buildString(str) {
    if (typeof str !== 'string')
        str = '' + str;

    if (hasNonASCII(str)) {
        var buf = new Buffer(str, 'utf8');
        return '{' + buf.length + '}\r\n' + buf.toString('binary');
    } else
        return '"' + escape(str) + '"';
}

function buildSearchQuery(options, extensions, info, isOrChild) {
    var searchargs = '', err, val;
    for (var i = 0, len = options.length; i < len; ++i) {
        var criteria = (isOrChild ? options : options[i]),
            args = null,
            modifier = (isOrChild ? '' : ' ');
        if (typeof criteria === 'string')
            criteria = criteria.toUpperCase();
        else if (Array.isArray(criteria)) {
            if (criteria.length > 1)
                args = criteria.slice(1);
            if (criteria.length > 0)
                criteria = criteria[0].toUpperCase();
        } else
            throw new Error('Unexpected search option data type. '
                            + 'Expected string or array. Got: ' + typeof criteria);
        if (criteria === 'OR') {
            if (args.length !== 2)
                throw new Error('OR must have exactly two arguments');
            if (isOrChild)
                searchargs += 'OR (';
            else
                searchargs += ' OR (';
            searchargs += buildSearchQuery(args[0], extensions, info, true);
            searchargs += ') (';
            searchargs += buildSearchQuery(args[1], extensions, info, true);
            searchargs += ')';
        } else {
            if (criteria[0] === '!') {
                modifier += 'NOT ';
                criteria = criteria.substr(1);
            }
            switch (criteria) {
                
                case 'ALL':
                case 'ANSWERED':
                case 'DELETED':
                case 'DRAFT':
                case 'FLAGGED':
                case 'NEW':
                case 'SEEN':
                case 'RECENT':
                case 'OLD':
                case 'UNANSWERED':
                case 'UNDELETED':
                case 'UNDRAFT':
                case 'UNFLAGGED':
                case 'UNSEEN':
                    searchargs += modifier + criteria;
                    break;
                case 'BCC':
                case 'BODY':
                case 'CC':
                case 'FROM':
                case 'SUBJECT':
                case 'TEXT':
                case 'TO':
                    if (!args || args.length !== 1)
                        throw new Error('Incorrect number of arguments for search option: '
                                        + criteria);
                    val = buildString(args[0]);
                    if (info && val[0] === '{')
                        info.hasUTF8 = true;
                    searchargs += modifier + criteria + ' ' + val;
                    break;
                case 'BEFORE':
                case 'ON':
                case 'SENTBEFORE':
                case 'SENTON':
                case 'SENTSINCE':
                case 'SINCE':
                    if (!args || args.length !== 1)
                        throw new Error('Incorrect number of arguments for search option: '
                                        + criteria);
                    else if (!(args[0] instanceof Date)) {
                        if ((args[0] = new Date(args[0])).toString() === 'Invalid Date')
                            throw new Error('Search option argument must be a Date object'
                                            + ' or a parseable date string');
                    }
                    searchargs += modifier + criteria + ' ' + args[0].getDate() + '-'
                                  + MONTHS[args[0].getMonth()] + '-'
                                  + args[0].getFullYear();
                    break;
                case 'KEYWORD':
                case 'UNKEYWORD':
                    if (!args || args.length !== 1)
                        throw new Error('Incorrect number of arguments for search option: '
                                        + criteria);
                    searchargs += modifier + criteria + ' ' + args[0];
                    break;
                case 'LARGER':
                case 'SMALLER':
                    if (!args || args.length !== 1)
                        throw new Error('Incorrect number of arguments for search option: '
                                        + criteria);
                    var num = parseInt(args[0], 10);
                    if (isNaN(num))
                        throw new Error('Search option argument must be a number');
                    searchargs += modifier + criteria + ' ' + args[0];
                    break;
                case 'HEADER':
                    if (!args || args.length !== 2)
                        throw new Error('Incorrect number of arguments for search option: '
                                        + criteria);
                    val = buildString(args[1]);
                    if (info && val[0] === '{')
                        info.hasUTF8 = true;
                    searchargs += modifier + criteria + ' "' + escape('' + args[0])
                               + '" ' + val;
                    break;
                case 'UID':
                    if (!args)
                        throw new Error('Incorrect number of arguments for search option: '
                                        + criteria);
                    validateUIDList(args);
                    if (args.length === 0)
                        throw new Error('Empty uid list');
                    searchargs += modifier + criteria + ' ' + args.join(',');
                    break;
                    
                case 'X-GM-MSGID': 
                case 'X-GM-THRID': 
                    if (extensions.indexOf('X-GM-EXT-1') === -1)
                        throw new Error('IMAP extension not available for: ' + criteria);
                    if (!args || args.length !== 1)
                        throw new Error('Incorrect number of arguments for search option: '
                                        + criteria);
                    else {
                        val = '' + args[0];
                        if (!(RE_INTEGER.test(args[0])))
                            throw new Error('Invalid value');
                    }
                    searchargs += modifier + criteria + ' ' + val;
                    break;
                case 'X-GM-RAW': 
                    if (extensions.indexOf('X-GM-EXT-1') === -1)
                        throw new Error('IMAP extension not available for: ' + criteria);
                    if (!args || args.length !== 1)
                        throw new Error('Incorrect number of arguments for search option: '
                                        + criteria);
                    val = buildString(args[0]);
                    if (info && val[0] === '{')
                        info.hasUTF8 = true;
                    searchargs += modifier + criteria + ' ' + val;
                    break;
                case 'X-GM-LABELS': 
                    if (extensions.indexOf('X-GM-EXT-1') === -1)
                        throw new Error('IMAP extension not available for: ' + criteria);
                    if (!args || args.length !== 1)
                        throw new Error('Incorrect number of arguments for search option: '
                                        + criteria);
                    searchargs += modifier + criteria + ' ' + args[0];
                    break;
                case 'MODSEQ':
                    if (extensions.indexOf('CONDSTORE') === -1)
                        throw new Error('IMAP extension not available for: ' + criteria);
                    if (!args || args.length !== 1)
                        throw new Error('Incorrect number of arguments for search option: '
                                        + criteria);
                    searchargs += modifier + criteria + ' ' + args[0];
                    break;
                default:
                    
                    
                    var seqnos = (args ? [criteria].concat(args) : [criteria]);
                    if (!validateUIDList(seqnos, true)) {
                        if (seqnos.length === 0)
                            throw new Error('Empty sequence number list');
                        searchargs += modifier + seqnos.join(',');
                    } else
                        throw new Error('Unexpected search option: ' + criteria);
            }
        }
        if (isOrChild)
            break;
    }
    return searchargs;
}


var pSlice = Array.prototype.slice;
function _deepEqual(actual, expected) {
    
    if (actual === expected) {
        return true;

    } else if (Buffer.isBuffer(actual) && Buffer.isBuffer(expected)) {
        if (actual.length !== expected.length) return false;

        for (var i = 0; i < actual.length; i++) {
            if (actual[i] !== expected[i]) return false;
        }

        return true;

        
        
    } else if (actual instanceof Date && expected instanceof Date) {
        return actual.getTime() === expected.getTime();

        
        
        
    } else if (actual instanceof RegExp && expected instanceof RegExp) {
        return actual.source === expected.source &&
               actual.global === expected.global &&
               actual.multiline === expected.multiline &&
               actual.lastIndex === expected.lastIndex &&
               actual.ignoreCase === expected.ignoreCase;

        
        
    } else if (typeof actual !== 'object' && typeof expected !== 'object') {
        return actual == expected;

        
        
        
        
        
        
    } else {
        return objEquiv(actual, expected);
    }
}
function isUndefinedOrNull(value) {
    return value === null || value === undefined;
}
function isArguments(object) {
    return Object.prototype.toString.call(object) === '[object Arguments]';
}
function objEquiv(a, b) {
    var ka, kb, key, i;
    if (isUndefinedOrNull(a) || isUndefinedOrNull(b))
        return false;
    
    if (a.prototype !== b.prototype) return false;
    
    
    if (isArguments(a)) {
        if (!isArguments(b)) {
            return false;
        }
        a = pSlice.call(a);
        b = pSlice.call(b);
        return _deepEqual(a, b);
    }
    try {
        ka = Object.keys(a);
        kb = Object.keys(b);
    } catch (e) {
        return false;
    }
    
    
    if (ka.length !== kb.length)
        return false;
    
    ka.sort();
    kb.sort();
    
    for (i = ka.length - 1; i >= 0; i--) {
        if (ka[i] != kb[i])
            return false;
    }
    
    
    for (i = ka.length - 1; i >= 0; i--) {
        key = ka[i];
        if (!_deepEqual(a[key], b[key])) return false;
    }
    return true;
}