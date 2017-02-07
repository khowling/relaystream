
// Use the websocket-relay to serve a raw MPEG-TS over WebSockets. You can use
// ffmpeg to feed the relay. ffmpeg -> websocket-relay -> browser
// Example:
// node websocket-relay yoursecret 8081 8082
// ffmpeg -i <some input> -f mpegts http://localhost:8081/yoursecret

const fs = require('fs'),
	http = require('http'),
	WebSocket = require('ws'),
	serveStatic = require('serve-static'),
	serve = serveStatic('public', {'index': ['viewstream.html']}),
	RECORD_STREAM = false,
	STREAM_SECRET = "bob"

// HTTP Server to accept incomming MPEG-TS Stream from ffmpeg
var httpServer = http.createServer( (request, response) => {
	console.log (`request (static) : ${request.url}`)
	serve(request, response, () => {
		console.log (`request (incoming) : ${request && request.url}`)
		if (request) {
			var params = request.url.substr(1).split('/');

			if (params[0] !== STREAM_SECRET) {
				response.writeHead(404) ;
				response.end();
			} else {

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
			}
		}
	})
	
}).listen(process.env.PORT || 5000);


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

