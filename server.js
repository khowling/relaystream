const fs = require('fs'),
	http = require('http'),
	WebSocket = require('ws'),
	serveStatic = require('serve-static'),
	serve = serveStatic('public', {'index': ['index.html']}),
	genRelayTokens =  require('./lib/hybridconnect.js').genRelayTokens,
	{AzBlobWritable, createSASLocator} = require('./lib/AzBlobWritable.js'),
	saslocator  = createSASLocator (process.env.STORE_ACCOUNT, process.env.STORE_CONTAINER, 10000, process.env.STORE_KEY),
	RECORD_STREAM = false,
	STREAM_SECRET = process.env.SECRETURL

// HTTP Server to accept incomming MPEG-TS Stream from ffmpeg
var port = process.env.PORT || 5000,
	httpServer = http.createServer( (request, response) => {
	console.log (`request (static) : ${request.url}`)
	serve(request, response, () => {
		console.log (`request (incoming) : ${request && request.url}`)
		if (request) {
			var fullpath = request.url.substr(1),
			    toppath = fullpath.split('/')[0];

			if (toppath == "relayurls_"+STREAM_SECRET) {
				response.writeHead(200, {
					"Content-Type": "application/json", 
					"Access-Control-Allow-Origin": "*"});
				
				if (!(process.env.RELAY_NS && process.env.RELAY_ENTITY && process.env.RELAY_KEYNAME && process.env.RELAY_KEY)) {
					response.end(JSON.stringify({error: 'Required environment not set, need (RELAY_NS, RELAY_ENTITY, RELAY_KEYNAME, RELAY_KEY)'}))
				} else {
					response.end(JSON.stringify(genRelayTokens("connect", process.env.RELAY_NS, process.env.RELAY_ENTITY, process.env.RELAY_KEYNAME, process.env.RELAY_KEY)))
				}
			} else if (toppath == "wcam"  && request.method == "POST") {
				//The request object that's passed in to a handler implements the ReadableStream interface. 
				// This stream can be listened to or piped elsewhere just like any other stream. 
				// We can grab the data right out of the stream by listening to the stream's 'data' and 'end' events.
				
				//In paused mode, the stream.read() method must be called explicitly to read chunks of data from the stream.
				//All Readable streams begin in paused mode but can be switched to flowing mode in one of the following ways:
				// Adding a 'data' event handler., Calling the stream.resume() method. Calling the stream.pipe() method to send the data to a Writable.
				request.pipe(new AzBlobWritable (saslocator, fullpath)).on('finish',  () => { 
					response.end()
				});

			} else if (toppath == "video_"+STREAM_SECRET) {
				

				response.connection.setTimeout(0);
				console.log(
					'Stream Connected: ' + 
					request.socket.remoteAddress + ':' +
					request.socket.remotePort
				);
				request.on('data', function(data){
					wss.broadcast(data);
					if (request.socket.recording) {
						request.socket.recording.write(data);
					}
				});
				request.on('end',function(){
					console.log('close');
					if (request.socket.recording) {
						request.socket.recording.close();
					}
				});

				// Record the stream to a local file?
				if (RECORD_STREAM) {
					var path = 'recordings/' + Date.now() + '.ts';
					request.socket.recording = fs.createWriteStream(path);
				}
			} else {
				response.writeHead(404) ;
				response.end();
			} 
		}
	})
	
}).listen(port);
console.log (`listening to port ${port}`)


// Websocket Server
var wss = new WebSocket.Server({
	server : httpServer,
	perMessageDeflate: false
});

wss.connectionCount = 0;
wss.on('connection', function(socket) {
	wss.connectionCount++;
	console.log(
		'New WebSocket Connection: ', 
		socket.upgradeReq.socket.remoteAddress,
		socket.upgradeReq.headers['user-agent'],
		'('+wss.connectionCount+' total)'
	);
	socket.on('close', function(code, message){
		wss.connectionCount--;
		console.log(
			'Disconnected WebSocket ('+wss.connectionCount+' total)'
		);
	});
});
wss.broadcast = function(data) {
	wss.clients.forEach(function each(client) {
		if (client.readyState === WebSocket.OPEN) {
			client.send(data);
		}
	});
};

