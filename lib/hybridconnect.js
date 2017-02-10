
const ws  = require('ws'),
    crypto = require('crypto');

// https://docs.microsoft.com/en-us/azure/service-bus-messaging/service-bus-shared-access-signature-authentication
exports.genRelayTokens = genRelayTokens =  (action, namespace, entity_path, policy_name, policy_key_secret) => {

    let servicebus_namespace = `${namespace}.servicebus.windows.net`,
        sb_resource_uri = encodeURIComponent(`http://${servicebus_namespace}/`),
        expiry = Math.floor((new Date).getTime()/1000) + (60*60) // + 1hour

    // HMAC-SHA256 hash
    const hmac = crypto.createHmac('sha256', policy_key_secret); 
    hmac.update(`${sb_resource_uri}\n${expiry}`)

    var signature = encodeURIComponent(hmac.digest('base64'));
    
    let sb_hc_token = `SharedAccessSignature sr=${sb_resource_uri}&sig=${signature}&se=${expiry}&skn=${policy_name}`,
        connect_url = `wss://${servicebus_namespace}/$hc/${entity_path}?sb-hc-action=${action}`

    return { connect_url, sb_hc_token}
}

// https://docs.microsoft.com/en-us/azure/service-bus-relay/relay-hybrid-connections-protocol
exports.openWithUrls = openWithUrls = (action, { connect_url, sb_hc_token}) => {
    return new Promise( (resolve, reject) => {
        try {
            // all parties are 'clients', as they initiate the connection to the Relay
            var client = new ws(connect_url, { headers : { 'ServiceBusAuthorization' : sb_hc_token}});
            client.on('error', (e) => {
                console.log(`Error  "${action}" to relay: ${e}`)
                return reject(`Error  "${action}" to relay: ${e}`);
            })
            client.on('open', () => {
                console.log ('Connected to relay endpoint...')
                return resolve(client);
            })
        } catch (e) {
            console.log(`Error: ${JSON.stringify(e)}`)
            return reject(`Error "${action}" to relay: ${e}`);
        }
    })
}

exports.open = (action, namespace, entity_path, policy_name, policy_key_secret) => {
    console.log (`Connecting client....`)
    return openWithUrls (action, genRelayTokens (action, namespace, entity_path, policy_name, policy_key_secret))

}
