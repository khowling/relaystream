const fs = require('fs'),
	http = require('http'),
	WebSocket = require('ws'),
	serveStatic = require('serve-static'),
	serve = serveStatic('public', {'index': ['index.html']}),
	genRelayTokens =  require('./lib/hybridconnect.js').genRelayTokens,
	RECORD_STREAM = false,
	STREAM_SECRET = process.env.SECRETURL

// HTTP Server to accept incomming MPEG-TS Stream from ffmpeg
var port = process.env.PORT || 5000,
	httpServer = http.createServer( (request, response) => {
	console.log (`request (static) : ${request.url}`)
	serve(request, response, () => {
		console.log (`request (incoming) : ${request && request.url}`)
		if (request) {
			var params = request.url.substr(1).split('/');

			if (params[0] == "relayurls_"+STREAM_SECRET) {
				response.writeHead(200, {
					"Content-Type": "application/json", 
					"Access-Control-Allow-Origin": "*"});
				
				if (!(process.env.RELAY_NS && process.env.RELAY_ENTITY && process.env.RELAY_KEYNAME && process.env.RELAY_KEY)) {
					response.end(JSON.stringify({error: 'Required environment not set, need (RELAY_NS, RELAY_ENTITY, RELAY_KEYNAME, RELAY_KEY)'}))
				} else {
					response.end(JSON.stringify(genRelayTokens("connect", process.env.RELAY_NS, process.env.RELAY_ENTITY, process.env.RELAY_KEYNAME, process.env.RELAY_KEY)))
				}
			} else if (params[0] == "video_"+STREAM_SECRET) {
				

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

