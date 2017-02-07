
const ws = module.exports = require('ws');
const crypto = require('crypto');
const spawn = require('child_process').spawn;

if ( process.argv.length < 6) {
    console.log(`${process.argv[1]} [listen|connect] [namespace] [entity] [key-rule] [key]`);
    process.exit();
}

var action = process.argv[2];
var namespace = process.argv[3];
var path = process.argv[4];
var keyrule = process.argv[5];
var key = process.argv[6];

let ff = null;
const runCmd = (client, cmd) => {
    if (!ff) {
        
       try {

            console.log (cmd)
            console.log(`starting "${cmd.split(' ')[0]} ${JSON.stringify([...cmd.split(' ').slice(1)])}"`);
            
            ff = spawn(cmd.split(' ')[0], [...cmd.split(' ').slice(1)], {shell : true});

            ff.stdout.on('data', (data) => {
                client.send(data.toString(), (err) => { if (err) console.log (`send err: ${err}`) })
                console.log(`stdout: ${data}`);
            });

            ff.stderr.on('data', (data) => {
                client.send(data.toString(), (err) => { if (err) console.log (`send err: ${err}`) })
                console.log(`stderr: ${data}`);
            });

            ff.on('close', (code) => {
                client.send(`child process exited with code ${code}`, (err) => { if (err) console.log (`send err: ${err}`) })
                console.log(`child process exited with code ${code}`);
                ff = null;
            });

            ff.on('error',  (err) => {
                console.log('spawn error:', err);
                client.send('spawn error:' + err)
            })

            
        } catch (e) {
            ff = null
            client.send(`Catch Error: ${JSON.stringify(e)}`)
        }
    } else {
        console.log(`stopping....`);
        ff.kill('SIGHUP');
    }
}

// address, protocols, options
let servicebus_namespace = `${namespace}.servicebus.windows.net`,
    entity_path = path,
    sb_resource_uri = encodeURIComponent(`http://${servicebus_namespace}/`),
    expiry = Math.floor((new Date).getTime()/1000) + (60*60), // + 1hour
    policy_name = keyrule
    policy_key_secret = key

// HMAC-SHA256 hash
const hmac = crypto.createHmac('sha256', policy_key_secret); 
hmac.update(`${sb_resource_uri}\n${expiry}`)
var signature = encodeURIComponent(hmac.digest('base64'));

// https://docs.microsoft.com/en-us/azure/service-bus-messaging/service-bus-shared-access-signature-authentication
let sb_hc_token = `SharedAccessSignature sr=${sb_resource_uri}&sig=${signature}&se=${expiry}&skn=${policy_name}`,
    connect_url = `wss://${servicebus_namespace}/$hc/${entity_path}?sb-hc-action=${action}`
// https://docs.microsoft.com/en-us/azure/service-bus-relay/relay-hybrid-connections-protocol

try {
    console.log (`Connecting client to ${namespace}....`)
    // all parties are 'clients', as they initiate the connection to the Relay
    var client = new ws(connect_url, { headers : { 'ServiceBusAuthorization' : sb_hc_token}});
    client.on('error', (e) => {
        console.log(`Error rying to "${action}" to relay: ${e}`)
    })
    client.on('open', () => {
        console.log ('connected to relay endpoint...')

        // The "Listener" Role - waits for and accepts connections
        // The listener can: "Listen" - to indicate readiness, "Accept" - open a new websocket to accept messages, 
        // remote server on-premises, connected to relay endpoint, listening for new connections
        if (action === "listen") {
            client.on('message',  (data, flags) => {
                let data_obj = JSON.parse(data)
                if (data_obj.accept) {
                    let clientId = data_obj.accept.id
                    console.log(`New Connection request received  : ${data}`)
                    // To accept, the listener establishes a web socket connection to the provided address
                    let new_client = new ws(data_obj.accept.address, {perMessageDeflate: false} );
                    
                    new_client.on('open', () => {
                        new_client.send(`ready for command`, (err) => { if (err) console.log (`send err: ${err}`) })
                        new_client.on('message',  (data, flags) => {
                            console.log(`Got message from client ${clientId} : ${data}`)
                            runCmd(new_client, data)
                        })
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
        }

        // The "Sender" Role - client that initiates a new connection towards a listener 
        // cloud server, establishing connection to on-premises listener
        if (action === "connect") {

            client.on('close',  () => {
                console.log('stopping client interval');
                process.exit();
            });

            client.on('message', (data, flags) => {
                console.log(data);
            });

            //process.stdin.setRawMode(true);
            //process.stdin.resume();
            process.stdin.on('data', function (d) {
                console.log (`got ${d}`)
                if (d == "k") {
                    client.close()
                } else  {
                    client.send(d.toString().replace(/(\n|\r)+$/, ''))
                }
            });
        }

        client.on('error', (err) => {
            console.log(`Error: ${JSON.stringify(err)}`)
        })
    })
} catch (e) {
    console.log(`Error: ${JSON.stringify(e)}`)
}
