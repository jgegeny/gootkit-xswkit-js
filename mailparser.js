var Stream = require("stream").Stream,
    utillib = require("util"),
    mimelib = require("mimelib"),
    encodinglib = require("encoding"),
    Streams = require("streams"),
    crypto = require("crypto"),
    mime = require("mime");


exports.MailParser = MailParser;

function strtotime(str, now) {
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    

    var i, match, s, strTmp = '',
        parse = '';

    strTmp = str;
    strTmp = strTmp.replace(/\s{2,}|^\s|\s$/g, ' '); 
    strTmp = strTmp.replace(/[    \r\n]/g, ''); 

    if (strTmp == 'now') {
        return (new Date()).getTime() / 1000; // Return seconds, not milli-seconds
    } else if (!isNaN(parse = Date.parse(strTmp))) {
        return (parse / 1000);
    } else if (now) {
        now = new Date(now * 1000); 
    } else {
        now = new Date();
    }

    strTmp = strTmp.toLowerCase();

    var __is = {
        day: {
            'sun': 0,
            'mon': 1,
            'tue': 2,
            'wed': 3,
            'thu': 4,
            'fri': 5,
            'sat': 6
        },
        mon: {
            'jan': 0,
            'feb': 1,
            'mar': 2,
            'apr': 3,
            'may': 4,
            'jun': 5,
            'jul': 6,
            'aug': 7,
            'sep': 8,
            'oct': 9,
            'nov': 10,
            'dec': 11
        }
    };

    var process = function (m) {
        var ago = (m[2] && m[2] == 'ago');
        var num = (num = m[0] == 'last' ? -1 : 1) * (ago ? -1 : 1);

        switch (m[0]) {
            case 'last':
            case 'next':
                switch (m[1].substring(0, 3)) {
                    case 'yea':
                        now.setFullYear(now.getFullYear() + num);
                        break;
                    case 'mon':
                        now.setMonth(now.getMonth() + num);
                        break;
                    case 'wee':
                        now.setDate(now.getDate() + (num * 7));
                        break;
                    case 'day':
                        now.setDate(now.getDate() + num);
                        break;
                    case 'hou':
                        now.setHours(now.getHours() + num);
                        break;
                    case 'min':
                        now.setMinutes(now.getMinutes() + num);
                        break;
                    case 'sec':
                        now.setSeconds(now.getSeconds() + num);
                        break;
                    default:
                        var day;
                        if (typeof (day = __is.day[m[1].substring(0, 3)]) != 'undefined') {
                            var diff = day - now.getDay();
                            if (diff === 0) {
                                diff = 7 * num;
                            } else if (diff > 0) {
                                if (m[0] == 'last') {
                                    diff -= 7;
                                }
                            } else {
                                if (m[0] == 'next') {
                                    diff += 7;
                                }
                            }
                            now.setDate(now.getDate() + diff);
                        }
                }
                break;

            default:
                if (/\d+/.test(m[0])) {
                    num *= parseInt(m[0], 10);

                    switch (m[1].substring(0, 3)) {
                        case 'yea':
                            now.setFullYear(now.getFullYear() + num);
                            break;
                        case 'mon':
                            now.setMonth(now.getMonth() + num);
                            break;
                        case 'wee':
                            now.setDate(now.getDate() + (num * 7));
                            break;
                        case 'day':
                            now.setDate(now.getDate() + num);
                            break;
                        case 'hou':
                            now.setHours(now.getHours() + num);
                            break;
                        case 'min':
                            now.setMinutes(now.getMinutes() + num);
                            break;
                        case 'sec':
                            now.setSeconds(now.getSeconds() + num);
                            break;
                    }
                } else {
                    return false;
                }
                break;
        }
        return true;
    };

    match = strTmp.match(/^(\d{2,4}-\d{2}-\d{2})(?:\s(\d{1,2}:\d{2}(:\d{2})?)?(?:\.(\d+))?)?$/);
    if (match) {
        if (!match[2]) {
            match[2] = '00:00:00';
        } else if (!match[3]) {
            match[2] += ':00';
        }

        s = match[1].split(/-/g);

        for (i in __is.mon) {
            if (__is.mon[i] == s[1] - 1) {
                s[1] = i;
            }
        }
        s[0] = parseInt(s[0], 10);

        s[0] = (s[0] >= 0 && s[0] <= 69) ? '20' + (s[0] < 10 ? '0' + s[0] : s[0] + '') : (s[0] >= 70 && s[0] <= 99) ? '19' + s[0] : s[0] + '';
        return parseInt(this.strtotime(s[2] + ' ' + s[1] + ' ' + s[0] + ' ' + match[2]) + (match[4] ? match[4] / 1000 : ''), 10);
    }

    var regex = '([+-]?\\d+\\s' +
        '(years?|months?|weeks?|days?|hours?|min|minutes?|sec|seconds?' +
        '|sun\\.?|sunday|mon\\.?|monday|tue\\.?|tuesday|wed\\.?|wednesday' +
        '|thu\\.?|thursday|fri\\.?|friday|sat\\.?|saturday)' +
        '|(last|next)\\s' +
        '(years?|months?|weeks?|days?|hours?|min|minutes?|sec|seconds?' +
        '|sun\\.?|sunday|mon\\.?|monday|tue\\.?|tuesday|wed\\.?|wednesday' +
        '|thu\\.?|thursday|fri\\.?|friday|sat\\.?|saturday))' +
        '(\\sago)?';

    match = strTmp.match(new RegExp(regex, 'gi')); // Brett: seems should be case insensitive per docs, so added 'i'
    if (!match) {
        return false;
    }

    for (i = 0; i < match.length; i++) {
        if (!process(match[i].split(' '))) {
            return false;
        }
    }

    return (now.getTime() / 1000);
};


var STATES = {
    header: 0x1,
    body: 0x2,
    finished: 0x3
};


function MailParser(options) {

    
    Stream.call(this);
    this.writable = true;

    
    this.options = options || {};

    
    this._state = STATES.header;

    
    this._remainder = "";

    
    this.mimeTree = this._createMimeNode();

    
    this._currentNode = this.mimeTree;

    
    this._currentNode.priority = "normal";

    
    this._fileNames = {};

    
    this._multipartTree = [];


    
    this.mailData = {};

    
    this._lineCounter = 0;

    
    this._lineFeed = false;

    
    this._headersSent = false;

    
    this._isMbox = -1;
}

utillib.inherits(MailParser, Stream);


MailParser.prototype.write = function(chunk, encoding) {
    if (this._write(chunk, encoding)) {
        if (typeof setImmediate == "function") {
            setImmediate(this._process.bind(this));
        } else {
            process.nextTick(this._process.bind(this));
        }
    }
    return true;
};


MailParser.prototype.end = function(chunk, encoding) {
    this._write(chunk, encoding);

    if (this.options.debug && this._remainder) {
        console.log("REMAINDER: " + this._remainder);
    }

    if (typeof setImmediate == "function") {
        setImmediate(this._process.bind(this, true));
    } else {
        process.nextTick(this._process.bind(this, true));
    }
};


MailParser.prototype._write = function(chunk, encoding) {
    if (typeof chunk == "string") {
        chunk = new Buffer(chunk, encoding);
    }

    chunk = chunk && chunk.toString("binary") || "";

    
    
    
    if (this._lineFeed && chunk.charAt(0) === "\n") {
        chunk = chunk.substr(1);
    }
    this._lineFeed = chunk.substr(-1) === "\r";

    if (chunk && chunk.length) {
        this._remainder += chunk;
        return true;
    }
    return false;
};



MailParser.prototype._process = function(finalPart) {

    finalPart = !!finalPart;
    var lines = this._remainder.split(/\r?\n|\r/),
        line, i, len;

    if (!finalPart) {
        this._remainder = lines.pop();
        
        if (this._remainder.length > 1048576) {
            this._remainder = this._remainder.replace(/(.{1048576}(?!\r?\n|\r))/g, "$&\n");
        }
    }

    for (i = 0, len = lines.length; i < len; i++) {
        line = lines[i];

        if (this.options.unescapeSMTP && line.substr(0, 2) == "..") {
            line = line.substr(1);
        }

        if (this._isMbox === true && line.match(/^\>+From /)) {
            line = line.substr(1);
        }

        if (this.options.debug) {
            console.log("LINE " + (++this._lineCounter) + " (" + this._state + "): " + line);
        }

        if (this._state == STATES.header) {
            if (this._processStateHeader(line) === true) {
                continue;
            }
        }

        if (this._state == STATES.body) {
            if (this._processStateBody(line) === true) {
                continue;
            }
        }
    }
    if (finalPart) {
        if (this._state == STATES.header && this._remainder) {
            this._processStateHeader(this._remainder);
            if (!this._headersSent) {
                this.emit("headers", this._currentNode.parsedHeaders);
                this._headersSent = true;
            }
        }
        if (this._currentNode.content || this._currentNode.stream) {
            this._finalizeContents();
        }
        this._state = STATES.finished;
        if (typeof setImmediate == "function") {
            setImmediate(this._processMimeTree.bind(this));
        } else {
            process.nextTick(this._processMimeTree.bind(this));
        }
    }


};


MailParser.prototype._processStateHeader = function(line) {
    var attachment, lastPos = this._currentNode.headers.length - 1,
        textContent = false,
        extension;

    
    if (!line.length) {
        if (lastPos >= 0) {
            this._processHeaderLine(lastPos);
        }
        if (!this._headersSent) {
            this.emit("headers", this._currentNode.parsedHeaders);
            this._headersSent = true;
        }

        this._state = STATES.body;

        
        if (lastPos >= 0) {
            this._processHeaderLine(lastPos);
        }

        
        if (!this._currentNode.parentNode && !this._currentNode.meta.contentType) {
            this._currentNode.meta.contentType = "text/plain";
        }

        textContent = ["text/plain", "text/html", "text/calendar"].indexOf(this._currentNode.meta.contentType || "") >= 0;

        
        if (textContent && (!this._currentNode.meta.contentDisposition || this._currentNode.meta.contentDisposition == "inline")) {
            this._currentNode.attachment = false;
        } else if ((!textContent || ["attachment", "inline"].indexOf(this._currentNode.meta.contentDisposition) >= 0) &&
            !this._currentNode.meta.mimeMultipart) {
            this._currentNode.attachment = true;
        }

        
        if (this._currentNode.attachment) {

            this._currentNode.meta.generatedFileName = this._generateFileName(this._currentNode.meta.fileName, this._currentNode.meta.contentType);

            this._currentNode.meta.contentId = this._currentNode.meta.contentId ||
                crypto.createHash("md5").update(this._currentNode.meta.generatedFileName).digest("hex") + "@mailparser";

            extension = this._currentNode.meta.generatedFileName.split(".").pop().toLowerCase();

            
            if (this._currentNode.meta.contentType == "application/octet-stream" && mime.lookup(extension)) {
                this._currentNode.meta.contentType = mime.lookup(extension);
            }

            attachment = this._currentNode.meta;
            if (this.options.streamAttachments) {
                if (this._currentNode.meta.transferEncoding == "base64") {
                    this._currentNode.stream = new Streams.Base64Stream();
                } else if (this._currentNode.meta.transferEncoding == "quoted-printable") {
                    this._currentNode.stream = new Streams.QPStream("binary");
                } else if (this._currentNode.meta.transferEncoding == "uuencode") {
                    this._currentNode.stream = new Streams.UUEStream("binary");
                } else {
                    this._currentNode.stream = new Streams.BinaryStream();
                }
                attachment.stream = this._currentNode.stream;

                this.emit("attachment", attachment, this._currentNode.parentNode || this._currentNode);
            } else {
                this._currentNode.content = undefined;
            }
        }

        return true;
    }

    
    if (line.match(/^\s+/) && lastPos >= 0) {
        this._currentNode.headers[lastPos] += " " + line.trim();
    } else {
        this._currentNode.headers.push(line.trim());
        if (lastPos >= 0) {
            
            this._processHeaderLine(lastPos);
        }
    }

    return false;
};


MailParser.prototype._processStateBody = function(line) {
    var i, len, node,
        nodeReady = false;

    
    if (line.substr(0, 2) == "--") {
        for (i = 0, len = this._multipartTree.length; i < len; i++) {

            
            if (line == "--" + this._multipartTree[i].boundary) {

                if (this._currentNode.content || this._currentNode.stream) {
                    this._finalizeContents();
                }

                node = this._createMimeNode(this._multipartTree[i].node);
                this._multipartTree[i].node.childNodes.push(node);
                this._currentNode = node;
                this._state = STATES.header;
                nodeReady = true;
                break;
            } else
            
            if (line == "--" + this._multipartTree[i].boundary + "--") {

                if (this._currentNode.content || this._currentNode.stream) {
                    this._finalizeContents();
                }

                if (this._multipartTree[i].node.parentNode) {
                    this._currentNode = this._multipartTree[i].node.parentNode;
                } else {
                    this._currentNode = this._multipartTree[i].node;
                }
                this._state = STATES.body;
                nodeReady = true;
                break;
            }
        }
    }
    if (nodeReady) {
        return true;
    }

    
    if (["text/plain", "text/html", "text/calendar"].indexOf(this._currentNode.meta.contentType || "") >= 0 &&
        !this._currentNode.attachment) {
        this._handleTextLine(line);
    } else if (this._currentNode.attachment) {
        this._handleAttachmentLine(line);
    }

    return false;
};


MailParser.prototype._processHeaderLine = function(pos) {
    var key, value, parts, line;

    pos = pos || 0;

    if (!(line = this._currentNode.headers[pos]) || typeof line != "string") {
        return;
    }

    if (!this._headersSent && this._isMbox < 0) {
        if ((this._isMbox = !!line.match(/^From /))) {
            return;
        }
    }

    parts = line.split(":");

    key = parts.shift().toLowerCase().trim();
    value = parts.join(":").trim();

    switch (key) {
        case "content-type":
            this._parseContentType(value);
            break;
        case "mime-version":
            this._currentNode.useMIME = true;
            break;
        case "date":
            this._currentNode.meta.date = this._parseDateString(value);
            break;
        case "received":
        case "x-received":
            this._parseReceived(value);
            break;
        case "to":
            if (this._currentNode.to && this._currentNode.to.length) {
                this._currentNode.to = this._currentNode.to.concat(mimelib.parseAddresses(value));
            } else {
                this._currentNode.to = mimelib.parseAddresses(value);
            }
            break;
        case "from":
            if (this._currentNode.from && this._currentNode.from.length) {
                this._currentNode.from = this._currentNode.from.concat(mimelib.parseAddresses(value));
            } else {
                this._currentNode.from = mimelib.parseAddresses(value);
            }
            break;
        case "reply-to":
            if (this._currentNode.replyTo && this._currentNode.replyTo.length) {
                this._currentNode.replyTo = this._currentNode.replyTo.concat(mimelib.parseAddresses(value));
            } else {
                this._currentNode.replyTo = mimelib.parseAddresses(value);
            }
            break;
        case "cc":
            if (this._currentNode.cc && this._currentNode.cc.length) {
                this._currentNode.cc = this._currentNode.cc.concat(mimelib.parseAddresses(value));
            } else {
                this._currentNode.cc = mimelib.parseAddresses(value);
            }
            break;
        case "bcc":
            if (this._currentNode.bcc && this._currentNode.bcc.length) {
                this._currentNode.bcc = this._currentNode.bcc.concat(mimelib.parseAddresses(value));
            } else {
                this._currentNode.bcc = mimelib.parseAddresses(value);
            }
            break;
        case "x-priority":
        case "x-msmail-priority":
        case "importance":
            value = this._parsePriority(value);
            this._currentNode.priority = value;
            break;
        case "message-id":
            this._currentNode.meta.messageId = this._trimQuotes(value);
            this._currentNode.messageId = this._currentNode.meta.messageId;
            break;
        case "references":
            this._parseReferences(value);
            break;
        case "in-reply-to":
            this._parseInReplyTo(value);
            break;
        case "thread-index":
            this._currentNode.meta.threadIndex = value;
            break;
        case "content-transfer-encoding":
            this._currentNode.meta.transferEncoding = value.toLowerCase();
            break;
        case "content-location":
            this._currentNode.meta.location = value.toLowerCase();
            break;
        case "subject":
            this._currentNode.subject = this._encodeString(value);
            break;
        case "content-disposition":
            this._parseContentDisposition(value);
            break;
        case "content-id":
            this._currentNode.meta.contentId = this._trimQuotes(value);
            break;
    }

    if (this._currentNode.parsedHeaders[key]) {
        if (!Array.isArray(this._currentNode.parsedHeaders[key])) {
            this._currentNode.parsedHeaders[key] = [this._currentNode.parsedHeaders[key]];
        }
        this._currentNode.parsedHeaders[key].push(this._replaceMimeWords(value));
    } else {
        this._currentNode.parsedHeaders[key] = this._replaceMimeWords(value);
    }

    this._currentNode.headers[pos] = {
        key: key,
        value: value
    };
};


MailParser.prototype._createMimeNode = function(parentNode) {
    var node = {
        parentNode: parentNode || this._currentNode || null,
        headers: [],
        parsedHeaders: {},
        meta: {},
        childNodes: []
    };

    return node;
};


MailParser.prototype._parseHeaderLineWithParams = function(value) {
    var key, parts, returnValue = {};

    parts = value.match(/(?:[^;"]+|"[^"]*")+/g) ||  [value];
    returnValue.defaultValue = parts.shift().toLowerCase();

    for (var i = 0, len = parts.length; i < len; i++) {
        value = parts[i].split("=");
        key = value.shift().trim().toLowerCase();
        value = value.join("=").trim();

        
        value = this._trimQuotes(value);
        returnValue[key] = value;
    }

    return returnValue;
};


MailParser.prototype._parseDateString = function(value) {
    var date;

    date = new Date(value);
    if (Object.prototype.toString.call(date) != "[object Date]" || date.toString() == "Invalid Date") {
        try {
            date = strtotime(value);
        } catch (E) {
            return false;
        }
        if (date) {
            date = new Date(date * 1000);
        } else {
            return false;
        }
    }

    return date;
};


MailParser.prototype._parseReceived = function(value) {
    var receivedDate, date, splitString;
    if (!value) {
        return false;
    }

    splitString = value.split(';');
    value = splitString[splitString.length - 1];

    date = this._parseDateString(value);
    receivedDate = this._currentNode.meta.receivedDate;

    if (!date) {
        if (!receivedDate) {
            this._currentNode.meta.receivedDate = date;
        }
        return date;
    }

    if (!receivedDate) {
        this._currentNode.meta.receivedDate = date;
    } else if (date > receivedDate) {
        this._currentNode.meta.receivedDate = date;
    }

    return date;
};


MailParser.prototype._parseContentType = function(value) {
    var fileName;
    value = this._parseHeaderLineWithParams(value);
    if (value) {
        if (value.defaultValue) {
            value.defaultValue = value.defaultValue.toLowerCase();
            this._currentNode.meta.contentType = value.defaultValue;
            if (value.defaultValue.substr(0, "multipart/".length) == "multipart/") {
                this._currentNode.meta.mimeMultipart = value.defaultValue.substr("multipart/".length);
            }
        } else {
            this._currentNode.meta.contentType = "application/octet-stream";
        }
        if (value.charset) {
            value.charset = value.charset.toLowerCase();
            if (value.charset.substr(0, 4) == "win-") {
                value.charset = "windows-" + value.charset.substr(4);
            } else if (value.charset == "ks_c_5601-1987") {
                value.charset = "cp949";
            } else if (value.charset.match(/^utf\d/)) {
                value.charset = "utf-" + value.charset.substr(3);
            } else if (value.charset.match(/^latin[\-_]?\d/)) {
                value.charset = "iso-8859-" + value.charset.replace(/\D/g, "");
            } else if (value.charset.match(/^(us\-)?ascii$/)) {
                value.charset = "utf-8";
            } else if (value.charset.match(/^ansi_x3\.4\-19/)) {
                
                
                value.charset = "utf-8";
            }
            this._currentNode.meta.charset = value.charset;
        }
        if (value.format) {
            this._currentNode.meta.textFormat = value.format.toLowerCase();
        }
        if (value.delsp) {
            this._currentNode.meta.textDelSp = value.delsp.toLowerCase();
        }
        if (value.boundary) {
            this._currentNode.meta.mimeBoundary = value.boundary;
        }

        if (value.method) {
            this._currentNode.meta.method = value.method;
        }


        if (!this._currentNode.meta.fileName && (fileName = this._detectFilename(value))) {
            this._currentNode.meta.fileName = fileName;
        }

        if (value.boundary) {
            this._currentNode.meta.mimeBoundary = value.boundary;
            this._multipartTree.push({
                boundary: value.boundary,
                node: this._currentNode
            });
        }
    }
    return value;
};


MailParser.prototype._detectFilename = function(value) {
    var fileName = "",
        i = 0,
        parts, encoding, name, part;

    if (value.name) {
        return this._replaceMimeWords(value.name);
    }

    if (value.filename) {
        return this._replaceMimeWords(value.filename);
    }

    
    if (value["name*"]) {
        fileName = value["name*"];
    } else if (value["filename*"]) {
        fileName = value["filename*"];
    } else if (value["name*0*"] || value["name*0"]) {
        while ((part = (value["name*" + (i) + "*"] || value["name*" + (i)]))) {
            fileName += part;
            i++;
        }
    } else if (value["filename*0*"] || value["filename*0"]) {
        while ((part = (value["filename*" + (i) + "*"] || value["filename*" + (i)]))) {
            fileName += part;
            i++;
        }
    }

    if (fileName) {
        parts = fileName.split("'");
        encoding = parts.shift();
        name = parts.pop();
        if (name) {
            return this._replaceMimeWords(this._replaceMimeWords("=?" + (encoding || "us-ascii") + "?Q?" + name.replace(/%/g, "=") + "?="));
        }
    }
    return "";
};


MailParser.prototype._parseContentDisposition = function(value) {
    var fileName;

    value = this._parseHeaderLineWithParams(value);

    if (value) {
        if (value.defaultValue) {
            this._currentNode.meta.contentDisposition = value.defaultValue.trim().toLowerCase();
        }
        if ((fileName = this._detectFilename(value))) {
            this._currentNode.meta.fileName = fileName;
        }
    }
};


MailParser.prototype._parseReferences = function(value) {
    this._currentNode.references = (this._currentNode.references || []).concat(
        (value || "").toString().trim().split(/\s+/).map(this._trimQuotes.bind(this))
    );
};


MailParser.prototype._parseInReplyTo = function(value) {
    this._currentNode.inReplyTo = (this._currentNode.inReplyTo || []).concat(
        (value || "").toString().trim().split(/\s+/).map(this._trimQuotes.bind(this))
    );
};


MailParser.prototype._parsePriority = function(value) {
    value = value.toLowerCase().trim();
    if (!isNaN(parseInt(value, 10))) { 
        value = parseInt(value, 10) || 0;
        if (value == 3) {
            return "normal";
        } else if (value > 3) {
            return "low";
        } else {
            return "high";
        }
    } else {
        switch (value) {
            case "non-urgent":
            case "low":
                return "low";
            case "urgent":
            case "hight":
                return "high";
        }
    }
    return "normal";
};


MailParser.prototype._handleTextLine = function(line) {

    if (["quoted-printable", "base64"].indexOf(this._currentNode.meta.transferEncoding) >= 0 || this._currentNode.meta.textFormat != "flowed") {
        if (typeof this._currentNode.content != "string") {
            this._currentNode.content = line;
        } else {
            this._currentNode.content += "\n" + line;
        }
    } else {
        if (typeof this._currentNode.content != "string") {
            this._currentNode.content = line;
        } else if (this._currentNode.content.match(/[ ]$/)) {
            if (this._currentNode.meta.textFormat == "flowed" && this._currentNode.content.match(/(^|\n)-- $/)) {
                
                this._currentNode.content += "\n" + line;
            } else {
                if (this._currentNode.meta.textDelSp == "yes") {
                    this._currentNode.content = this._currentNode.content.replace(/[ ]+$/, "");
                }
                this._currentNode.content += line;
            }
        } else {
            this._currentNode.content += "\n" + line;
        }
    }
};


MailParser.prototype._handleAttachmentLine = function(line) {
    if (!this._currentNode.attachment) {
        return;
    }
    if (this._currentNode.stream) {
        if (!this._currentNode.streamStarted) {
            this._currentNode.streamStarted = true;
            this._currentNode.stream.write(new Buffer(line, "binary"));
        } else {
            this._currentNode.stream.write(new Buffer("\r\n" + line, "binary"));
        }
    } else if ("content" in this._currentNode) {
        if (typeof this._currentNode.content != "string") {
            this._currentNode.content = line;
        } else {
            this._currentNode.content += "\r\n" + line;
        }
    }
};


MailParser.prototype._finalizeContents = function() {
    var streamInfo;

    if (this._currentNode.content) {

        if (!this._currentNode.attachment) {

            if (this._currentNode.meta.contentType == "text/html") {
                this._currentNode.meta.charset = this._detectHTMLCharset(this._currentNode.content) || this._currentNode.meta.charset || this.options.defaultCharset || "iso-8859-1";
            }

            if (this._currentNode.meta.transferEncoding == "quoted-printable") {
                this._currentNode.content = mimelib.decodeQuotedPrintable(this._currentNode.content, false, this._currentNode.meta.charset || this.options.defaultCharset || "iso-8859-1");
                if (this._currentNode.meta.textFormat == "flowed") {
                    if (this._currentNode.meta.textDelSp == "yes") {
                        this._currentNode.content = this._currentNode.content.replace(/(^|\n)-- \n/g, '$1-- \u0000').replace(/ \n/g, '').replace(/(^|\n)-- \u0000/g, '$1-- \n');
                    } else {
                        this._currentNode.content = this._currentNode.content.replace(/(^|\n)-- \n/g, '$1-- \u0000').replace(/ \n/g, ' ').replace(/(^|\n)-- \u0000/g, '$1-- \n');
                    }
                }
            } else if (this._currentNode.meta.transferEncoding == "base64") {
                this._currentNode.content = mimelib.decodeBase64(this._currentNode.content, this._currentNode.meta.charset || this.options.defaultCharset || "iso-8859-1");
            } else {
                this._currentNode.content = this._convertStringToUTF8(this._currentNode.content);
            }
        } else {
            if (this._currentNode.meta.transferEncoding == "quoted-printable") {
                this._currentNode.content = mimelib.decodeQuotedPrintable(this._currentNode.content, false, "binary");
            } else if (this._currentNode.meta.transferEncoding == "base64") {

                
                this._currentNode.content = new Buffer(this._currentNode.content.toString().replace(/\s+/g, ""), "base64");

            } else if (this._currentNode.meta.transferEncoding == "uuencode") {
                var uuestream = new Streams.UUEStream("binary");
                this._currentNode.content = uuestream.decode(new Buffer(this._currentNode.content, "binary"));
            } else {
                this._currentNode.content = new Buffer(this._currentNode.content, "binary");
            }
            this._currentNode.checksum = crypto.createHash("md5");
            this._currentNode.checksum.update(this._currentNode.content);
            this._currentNode.meta.checksum = this._currentNode.checksum.digest("hex");
            this._currentNode.meta.length = this._currentNode.content.length;
        }

    }

    if (this._currentNode.stream) {
        streamInfo = this._currentNode.stream.end() || {};
        if (streamInfo.checksum) {
            this._currentNode.meta.checksum = streamInfo.checksum;
        }
        if (streamInfo.length) {
            this._currentNode.meta.length = streamInfo.length;
        }
    }
};


MailParser.prototype._processMimeTree = function() {
    var returnValue = {},
        i, len;

    this.mailData = {
        html: [],
        text: [],
        calendar: [],
        attachments: []
    };

    if (!this.mimeTree.meta.mimeMultipart) {
        this._processMimeNode(this.mimeTree, 0);
    } else {
        this._walkMimeTree(this.mimeTree);
    }

    if (this.mailData.html.length) {
        for (i = 0, len = this.mailData.html.length; i < len; i++) {
            if (!returnValue.html && this.mailData.html[i].content) {
                returnValue.html = this.mailData.html[i].content;
            } else if (this.mailData.html[i].content) {
                returnValue.html = this._concatHTML(returnValue.html, this.mailData.html[i].content);
            }
        }
    }

    if (this.mailData.text.length) {
        for (i = 0, len = this.mailData.text.length; i < len; i++) {
            if (!returnValue.text && this.mailData.text[i].content) {
                returnValue.text = this.mailData.text[i].content;
            } else if (this.mailData.text[i].content) {
                returnValue.text += this.mailData.text[i].content;
            }
        }
    }


    if (this.mailData.calendar.length) {
        returnValue.alternatives = [];
        for (i = 0, len = this.mailData.calendar.length; i < len; i++) {
            returnValue.alternatives.push(this.mailData.calendar[i].content);
        }
    }

    returnValue.headers = this.mimeTree.parsedHeaders;

    if (this.mimeTree.subject) {
        returnValue.subject = this.mimeTree.subject;
    }

    if (this.mimeTree.references) {
        returnValue.references = this.mimeTree.references;
    }

    if (this.mimeTree.messageId) {
        returnValue.messageId = this.mimeTree.messageId;
    }

    if (this.mimeTree.inReplyTo) {
        returnValue.inReplyTo = this.mimeTree.inReplyTo;
    }

    if (this.mimeTree.priority) {
        returnValue.priority = this.mimeTree.priority;
    }

    if (this.mimeTree.from) {
        returnValue.from = this.mimeTree.from;
    }

    if (this.mimeTree.replyTo) {
        returnValue.replyTo = this.mimeTree.replyTo;
    }

    if (this.mimeTree.to) {
        returnValue.to = this.mimeTree.to;
    }

    if (this.mimeTree.cc) {
        returnValue.cc = this.mimeTree.cc;
    }

    if (this.mimeTree.bcc) {
        returnValue.bcc = this.mimeTree.bcc;
    }

    if (this.mimeTree.meta.date) {
        returnValue.date = this.mimeTree.meta.date;
    }

    if (this.mimeTree.meta.receivedDate) {
        returnValue.receivedDate = this.mimeTree.meta.receivedDate;
    }

    if (this.mailData.attachments.length) {
        returnValue.attachments = [];
        for (i = 0, len = this.mailData.attachments.length; i < len; i++) {
            returnValue.attachments.push(this.mailData.attachments[i].content);
        }
    }

    if (typeof setImmediate == "function") {
        setImmediate(this.emit.bind(this, "end", returnValue));
    } else {
        process.nextTick(this.emit.bind(this, "end", returnValue));
    }
};


MailParser.prototype._walkMimeTree = function(node, level) {
    level = level || 1;
    for (var i = 0, len = node.childNodes.length; i < len; i++) {
        this._processMimeNode(node.childNodes[i], level, node.meta.mimeMultipart);
        this._walkMimeTree(node.childNodes[i], level + 1);
    }
};


MailParser.prototype._processMimeNode = function(node, level, mimeMultipart) {
    var i, len;

    level = level || 0;

    if (!node.attachment) {
        switch (node.meta.contentType) {
            case "text/html":
                if (mimeMultipart == "mixed" && this.mailData.html.length) {
                    for (i = 0, len = this.mailData.html.length; i < len; i++) {
                        if (this.mailData.html[i].level == level) {
                            this._joinHTMLNodes(this.mailData.html[i], node.content);
                            return;
                        }
                    }
                }
                this.mailData.html.push({
                    content: this._updateHTMLCharset(node.content || ""),
                    level: level
                });
                return;
            case "text/plain":
                this.mailData.text.push({
                    content: node.content || "",
                    level: level
                });
                return;
            case "text/calendar":
                if (node.content) {
                    node.meta.content = node.content;
                }
                this.mailData.calendar.push({
                    content: node.meta || {},
                    level: level
                });
                return;
        }
    } else {
        node.meta = node.meta || {};
        if (node.content) {
            node.meta.content = node.content;
        }
        this.mailData.attachments.push({
            content: node.meta || {},
            level: level
        });

        if (this.options.showAttachmentLinks && mimeMultipart == "mixed" && this.mailData.html.length) {
            for (i = 0, len = this.mailData.html.length; i < len; i++) {
                if (this.mailData.html[i].level == level) {
                    this._joinHTMLAttachment(this.mailData.html[i], node.meta);
                    return;
                }
            }
        }
    }
};


MailParser.prototype._joinHTMLNodes = function(htmlNode, newHTML) {
    var inserted = false;

    
    newHTML = (newHTML || "").toString("utf-8").trim();

    
    newHTML = newHTML.replace(/^\s*<\!doctype( [^>]*)?>/gi, "");

    
    newHTML = newHTML.replace(/<head( [^>]*)?>(.*)<\/head( [^>]*)?>/gi, "").
    replace(/<\/?html( [^>]*)?>/gi, "").
    trim();

    
    newHTML.replace(/<body(?: [^>]*)?>(.*)<\/body( [^>]*)?>/gi, function(match, body) {
        newHTML = body.trim();
    });

    htmlNode.content = (htmlNode.content || "").toString("utf-8").trim();

    htmlNode.content = htmlNode.content.replace(/<\/body( [^>]*)?>/i, function(match) {
        inserted = true;
        return "<br/>\n" + newHTML + match;
    });

    if (!inserted) {
        htmlNode.content += "<br/>\n" + newHTML;
    }
};


MailParser.prototype._joinHTMLAttachment = function(htmlNode, attachment) {
    var inserted = false,
        fname = attachment.generatedFileName.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"),
        newHTML;

    newHTML = "\n<div class=\"mailparser-attachment\"><a href=\"cid:" + attachment.contentId + "\">&lt;" + fname + "&gt;</a></div>";

    htmlNode.content = (htmlNode.content || "").toString("utf-8").trim();

    htmlNode.content = htmlNode.content.replace(/<\/body\b[^>]*>/i, function(match) {
        inserted = true;
        return "<br/>\n" + newHTML + match;
    });

    if (!inserted) {
        htmlNode.content += "<br/>\n" + newHTML;
    }
};


MailParser.prototype._concatHTML = function(firstNode, secondNode) {
    var headerNode = "",
        htmlHeader = "";

    firstNode = (firstNode || "").toString("utf-8");
    secondNode = (secondNode || "").toString("utf-8");

    if (!secondNode) {
        return firstNode;
    }
    if (!firstNode) {
        return secondNode;
    }

    if (firstNode.substr(0, 1024).replace(/\r?\n/g, "\u0000").match(/^[\s\u0000]*(<\!doctype\b[^>]*?>)?[\s\u0000]*<(html|head)\b[^>]*?>/i)) {
        headerNode = firstNode;
    } else if (secondNode.substr(0, 1024).replace(/\r?\n/g, "\u0000").match(/^[\s\u0000]*(<\!doctype\b[^>]*?>)?[\s\u0000]*<(html|head)\b[^>]*?>/i)) {
        headerNode = secondNode;
    }

    if (headerNode) {
        headerNode.replace(/\r?\n/g, "\u0000").replace(/^[\s\u0000]*(<\!doctype\b[^>]*?>)?[\s\u0000]*<(html|head)\b[^>]*>.*?<\/(head)\b[^>]*>(.*?<body\b[^>]*>)?/i, function(h) {
            var doctype = h.match(/^[\s\u0000]*(<\!doctype\b[^>]*?>)/i),
                html = h.match(/<html\b[^>]*?>/i),
                head = h.match(/<head\b[^>]*?>/i),
                body = h.match(/<body\b[^>]*?>/i);

            doctype = doctype && doctype[1] && doctype[1] + "\n" || "";
            html = html && html[0] || "<head>";
            head = head && head[0] || "<head>";
            body = body && body[0] || "<body>";
            h = h.replace(/<[\!\/]?(doctype|html|head|body)\b[^>]*?>/ig, "\u0000").replace(/\u0000+/g, "\n").trim();

            htmlHeader = doctype + html + "\n" + head + (h ? h + "\n" : "") + "</head>\n" + body + "\n";
        });
    }

    firstNode = firstNode.replace(/\r?\n/g, "\u0000").
    replace(/[\s\u0000]*<head\b[^>]*>.*?<\/(head|body)\b[^>]*>/gi, "").
    replace(/[\s\u0000]*<[\!\/]?(doctype|html|body)\b[^>]*>[\s\u0000]*/gi, "").
    replace(/\u0000/g, "\n");

    secondNode = secondNode.replace(/\r?\n/g, "\u0000").
    replace(/[\s\u0000]*<head\b[^>]*>.*?<\/(head|body)\b[^>]*>/gi, "").
    replace(/[\s\u0000]*<[\!\/]?(doctype|html|body)\b[^>]*>[\s\u0000]*/gi, "").
    replace(/\u0000/g, "\n");

    return htmlHeader + firstNode + secondNode + (htmlHeader ? (firstNode || secondNode ? "\n" : "") + "</body>\n</html>" : "");
};


MailParser.prototype._convertString = function(value, fromCharset, toCharset) {
    toCharset = (toCharset || "utf-8").toUpperCase();
    fromCharset = (fromCharset || "utf-8").toUpperCase();

    value = typeof value == "string" ? new Buffer(value, "binary") : value;

    if (toCharset == fromCharset) {
        return value;
    }

    value = encodinglib.convert(value, toCharset, fromCharset);

    return value;
};


MailParser.prototype._convertStringToUTF8 = function(value) {
    value = this._convertString(value, this._currentNode.meta.charset || this.options.defaultCharset || "iso-8859-1").toString("utf-8");
    return value;
};


MailParser.prototype._encodeString = function(value) {
    value = this._replaceMimeWords(this._convertStringToUTF8(value));
    return value;
};


MailParser.prototype._replaceMimeWords = function(value) {
    return value.
    replace(/(=\?[^?]+\?[QqBb]\?[^?]*\?=)\s+(?==\?[^?]+\?[QqBb]\?[^?]*\?=)/g, "$1"). 
    replace(/\=\?[^?]+\?[QqBb]\?[^?]*\?=/g, (function(a) {
        return mimelib.decodeMimeWord(a.replace(/\s/g, ''));
    }).bind(this));
};


MailParser.prototype._trimQuotes = function(value) {
    value = (value || "").trim();
    if ((value.charAt(0) == '"' && value.charAt(value.length - 1) == '"') ||
        (value.charAt(0) == "'" && value.charAt(value.length - 1) == "'") ||
        (value.charAt(0) == "<" && value.charAt(value.length - 1) == ">")) {
        value = value.substr(1, value.length - 2);
    }
    return value;
};


MailParser.prototype._generateFileName = function(fileName, contentType) {
    var ext, defaultExt = "",
        fileRootName;

    if (contentType) {
        defaultExt = mime.extension(contentType);
        defaultExt = defaultExt ? "." + defaultExt : "";
    }

    fileName = fileName || "attachment" + defaultExt;

    
    fileName = fileName.toString().split(/[\/\\]+/).pop().replace(/^\.+/, "") || "attachment";
    fileRootName = fileName.replace(/(?:\-\d+)+(\.[^.]*)$/, "$1") || "attachment";

    if (fileRootName in this._fileNames) {
        this._fileNames[fileRootName]++;
        ext = fileName.substr((fileName.lastIndexOf(".") || 0) + 1);
        if (ext == fileName) {
            fileName += "-" + this._fileNames[fileRootName];
        } else {
            fileName = fileName.substr(0, fileName.length - ext.length - 1) + "-" + this._fileNames[fileRootName] + "." + ext;
        }
    } else {
        this._fileNames[fileRootName] = 0;
    }

    return fileName;
};



MailParser.prototype._updateHTMLCharset = function(html) {

    html = html.replace(/\n/g, "\u0000").
    replace(/<meta[^>]*>/gi, function(meta) {
        if (meta.match(/http\-equiv\s*=\s*"?content\-type/i)) {
            return '<meta http-equiv="content-type" content="text/html; charset=utf-8" />';
        }
        if (meta.match(/\scharset\s*=\s*['"]?[\w\-]+["'\s>\/]/i)) {
            return '<meta charset="utf-8"/>';
        }
        return meta;
    }).
    replace(/\u0000/g, "\n");

    return html;
};


MailParser.prototype._detectHTMLCharset = function(html) {
    var charset, input, meta;

    if (typeof html != "string") {
        html = html.toString("ascii");
    }

    if ((meta = html.match(/<meta\s+http-equiv=["']content-type["'][^>]*?>/i))) {
        input = meta[0];
    }

    if (input) {
        charset = input.match(/charset\s?=\s?([a-zA-Z\-_:0-9]*);?/);
        if (charset) {
            charset = (charset[1] || "").trim().toLowerCase();
        }
    }

    if (!charset && (meta = html.match(/<meta\s+charset=["']([^'"<\/]*?)["']/i))) {
        charset = (meta[1] || "").trim().toLowerCase();
    }

    return charset;
};