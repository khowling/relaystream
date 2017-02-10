
const ws = module.exports = require('ws'),
    spawn = require('child_process').spawn,
    os = require('os'),
    hybridconnect = require ('./lib/hybridconnect.js').open


if ( process.argv.length < 5) {
    console.log(`${process.argv[1]} [namespace] [entity] [key-rule] [key]`);
    process.exit();
}

var namespace = process.argv[2];
var path = process.argv[3];
var keyrule = process.argv[4];
var key = process.argv[5];

let ff = null;

const connectStdinout = (client) => {
    if (ff) {
        ff.stdout.on('data', (data) => {
            client.send(data.toString(), (err) => { if (err) console.log (`send err: ${err}`) })
            console.log(`stdout: ${data}`);
        });

        ff.stderr.on('data', (data) => {
            client.send(data.toString(), (err) => { if (err) console.log (`send err: ${err}`) })
            console.log(`stderr: ${data}`);
        });

        ff.on('close', (code) => {
            if (code != 0) {
                client.send(`child process exited with code ${code}`, (err) => { if (err) console.log (`send err: ${err}`) })
            }
            ff = null;
        });

        ff.on('error',  (err) => {
            console.log('spawn error:', err);
            client.send('spawn error:' + err)
        })
    }
}
const runCmd = (client, cmd) => {
    if (!ff) {
        
       try {
            let cmd0 = cmd.split(' ')[0]
            if (cmd0 != "stop" && cmd0 != "avconv" && cmd0 != "ffmpeg" && cmd0 != "ls" && cmd0 != "dir") {
                client.send("command not supported", (err) => { if (err) console.log (`send err: ${err}`) })
            } else if (cmd0 == "stop") {
                if (ff) {
                    ff.kill('SIGHUP');
                } else {
                    client.send("nothing running", (err) => { if (err) console.log (`send err: ${err}`) })
                }
            } else {
                console.log(`starting "${cmd.split(' ')[0]} ${JSON.stringify([...cmd.split(' ').slice(1)])}"`);
                
                ff = spawn(cmd.split(' ')[0], [...cmd.split(' ').slice(1)], {shell : true});
                connectStdinout (client)
            }
            
        } catch (e) {
            ff = null
            client.send(`Catch Error: ${JSON.stringify(e)}`)
        }
    } else {
        console.log(`stopping....`);
        ff.kill('SIGHUP');
    }
}

hybridconnect("listen", namespace, path, keyrule, key).then((client) => {

// The "Listener" Role - waits for and accepts connections
// The listener can: "Listen" - to indicate readiness, "Accept" - open a new websocket to accept messages, 
// remote server on-premises, connected to relay endpoint, listening for new connections
 
    client.on('message',  (data, flags) => {
        let data_obj = JSON.parse(data)
        if (data_obj.accept) {
            let clientId = data_obj.accept.id
            console.log(`New Connection request received  : ${data}`)
            // To accept, the listener establishes a web socket connection to the provided address
            let new_client = new ws(data_obj.accept.address, {perMessageDeflate: false} );
            
            new_client.on('open', () => {
                new_client.send(`${os.hostname()} - ${os.platform()}`, (err) => { if (err) console.log (`send err: ${err}`) })
                new_client.on('message',  (data, flags) => {
                    console.log(`Got message from client ${clientId} : ${data}`)
                    runCmd(new_client, data)
                })
                connectStdinout (new_client)
            })
            new_client.on('error', (e) => {
                console.log(`Error, client ${clientId} : ${e}`)
            })
            new_client.on('close', function () {
                console.log(`Connection closed client: ${clientId}`)
            }) 

        } else {
            console.log(`Received unknown message: ${data}`)
        }
    })

    client.on('close', function () {
        console.log('Connection closed')
    }) 
}, (err) => {
    console.log(`1Error: ${JSON.stringify(err)}`)
})