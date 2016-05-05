var http = require('http'),
    https = require('https'),
    tunnel = require('tunnel'),
    url = require('url');
    
var _cookie = {};
var _proxy;
var _timeout = 60000;

exports.request   = httpRequest;
exports.get       = httpGet;
exports.setProxy  = function(proxy){
    _proxy = proxy;
};
exports.setTimeout = function(timeout){
    _timeout = timeout;
};

function httpRequest(rawUrl, callback, data, headers){ 
    var options = genRequestOptions(rawUrl, function(err){
        err && callback && callback(err, null);
    }, data, headers);
    if (!options){
        return;
    }
    var req;
    if (options._protocol=="https" && !options.agent){
        req = https.request(options, function(res){
            handleResponese(res, callback, data, headers);
        });
    }else{
        req = http.request(options, function(res){
            handleResponese(res, callback, data, headers);
        });
    }
    req.on('socket', function(socket){
      socket.setTimeout(_timeout);
      socket.on('timeout', function(){
        req.abort();
      });
    });
    data && req.write(data);
    req.on("error", function(err){
        callback && callback(err, null);
    });
    req.end();
}

function httpGet(rawUrl, callback){
    httpRequest(rawUrl, callback);
}

function handleResponese(res, callback, data, headers) {
    res.setEncoding("utf8");
    setCookieByHttpRes(res);

    if (res.statusCode == 301 || res.statusCode == 302) {
        var nextTarget = res.headers.location;
        process.nextTick(function () { httpRequest(nextTarget, callback, data, headers); });
    } else {

        var buffer = "";
        res.on("data", function (chunk) {
            if (chunk && chunk.length > 0) {
                buffer += chunk;
            }
        });

        res.on("end", function () {
            if (res.statusCode == 200) {
                buffer && callback && callback(null, {
                    data: buffer,
                    cookies: _cookie,
                    headers: res.headers
                });
            } else {
                callback && callback("server return " + res.statusCode, {
                    data: null,
                    cookies: null,
                    headers: res.headers
                });
            }
        });
    }
}
function cookieToStr(cookie){
    if (cookie){
        var result = "";
        for (var key in cookie){
            result += key + (cookie[key] ? "=" + cookie[key] : "") + "; ";
        }
        return result;
    }
    return "";
}

function setCookieByHttpRes(res){
    var rawCookie = res.headers["set-cookie"];
    rawCookie && rawCookie.forEach(function(line){
        line && line.split(';').forEach(function(c){
            var parts = c.split('=');
            _cookie[parts[0].trim()] = (parts[1] || '').trim();
        });
    });
}

function genRequestOptions(rawUrl, errCallback, data, headers){
    var target;
    try{
        target = url.parse(rawUrl);
    }catch(err){
        errCallback("URL parse error, please input validate URL");
        return;
    }
    if (target && target.host){
        target.host = target.port ? 
            target.host.replace(":" + target.port, "") : target.host;
        var result = {
            path: rawUrl,
            method: data ? "POST" : "GET",
            host: target.hostname, 
            headers: {
                Host: target.host,
                "User-Agent": "Mozilla/5.0 (Windows NT 6.1; WOW64; rv:13.0) Gecko/20100101 Firefox/13.0",
                Connection: "keep-alive",
                Accept: "text/html, text/javascript, application/json, application/xhtml+xml, application/xml;q=0.9, */*;q=0.8",
                Cookie: cookieToStr(_cookie)
            }
        };
        
        if (data){
            result.headers["Content-Length"] = Buffer.byteLength(data);
        }
        
        if (headers){
            for (var key in headers){
                result.headers[key] = headers[key];
            }
        }
        var proxy = getProxy();
        if (target.protocol==="http:"){
            result.port = target.port ? target.port : 80;
            result._protocol = "http";
            if (proxy){
                result.host = proxy.host;
                result.port = proxy.port;
            }
        }else if (target.protocol==="https:"){
            result.port = target.port ? target.port : 443;
            result._protocol = "https";
            if (proxy){
                result.agent = tunnel.httpsOverHttp({
                    proxy:{
                        host: proxy.host,
                        port: proxy.port
                    }
                });
            }
        }else{
            errCallback("Not support URL scheme, only support http and https");
            return;
        }
        return result;
    }
}

function getProxy(){
    var proxy;
    if (_proxy){
        proxy = _proxy; 
    }else if (process.env.http_proxy){
        proxy = process.env.http_proxy;
    }
    proxy = proxy ? url.parse(proxy) : null;
    if (proxy && proxy.host){
        return {
            host: proxy.port ? proxy.host.replace(":"+proxy.port, "") : proxy.host,
            port: proxy.port ? proxy.port : "80"
        };
    }
    return;
}