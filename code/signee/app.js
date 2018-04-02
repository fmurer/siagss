var express = require('express');
var bodyParser = require('body-parser');
var logger = require('morgan');
var curve = require('tweetnacl');
var crypto = require('crypto');
var fs = require('fs');
var scheduler = require('node-schedule');
var { exec } = require('child_process');
var ArgumentParser = require('argparse').ArgumentParser;

var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);

app.use(express.static(__dirname + '/node_modules'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(logger('dev'));


var parser = new ArgumentParser({
    version: 'Signee: 1.0.0',
    addHelp: true,
    description: 'Signee'
});

parser.addArgument(
    [ '-n', '--num-requests' ],
    {
        help: 'The number of requests handled at once'
    }
);

parser.addArgument(
    [ '-p', '--port' ],
    {
        help: 'Port number on which the server listens'
    }
);

var args = parser.parseArgs();


var NUM_REQUESTS = 2;
if (args.num_requests) {
    NUM_REQUESTS = args.num_requests;
}
var PORT = 3000;
if (args.port) {
    PORT = args.port;
}

const SHARED_KEY_PATH = __dirname + '/sk/';
const PUBLIC_KEYPATH = __dirname + '/pk/';

var SHARED_KEY = fs.readFileSync(SHARED_KEY_PATH + 'auth_key');
var PUBLIC_KEY = Buffer.from(fs.readFileSync(PUBLIC_KEYPATH + 'signer.pub')).toString();
PUBLIC_KEY = str2buf(PUBLIC_KEY, 'base64');

var hmac;
var dh;
var request_queue = [];
var request_number = 0;


/*
    Socket IO stuff
*/
const callbacks = new Map();

io.on('connection', function(client) {
    client.setMaxListeners(0);

    // as soon browser is on, ask for key schedule
    getNewKeySchedule(true);

    client.on('answer', (data) => {

        if (data.error) {
            // Verification failed on Signer side
            var ids = data.ids;
            var num_ids = Object.keys(ids).length;

            for (var i = 0; i < num_ids; i++) {
                const cb = callbacks.get(ids[i]);
                if (cb) {
                    error = {}
                    error['error'] = data.error;
                    cb(error);
                    callbacks.delete(ids[i]);
                }
            }
        } else {
            
            // filter requests from log verification and key replication
            if (data.latest_epoch || data.encrypted_key) { return; }

            // Verification successful on Signer side
            if (!verifyAuth(JSON.stringify(data.data), data.auth)) {
                // Local Verification failed -> requeue the requests
                console.log("[!!!] ERROR: Verification failed!");
                var data = data.data;
                var num_entries = Object.keys(data).length;

                for (var i = 0; i < num_entries; i++) {
                    const cb = callbacks.get(data[i].id);
                    if (cb) {
                        error = {}
                        error['error'] = "Verification failed!";
                        cb(error);
                        callbacks.delete(data[i].id);
                    }
                }

            } else {
                // Local Verification successful
                var data = data.data;
                var num_entries = Object.keys(data).length;

                for (var i = 0; i < num_entries; i++) {
                    const cb = callbacks.get(data[i].id);
                    if (cb) {
                        cb(data[i]);
                        callbacks.delete(data[i].id);
                    }    
                }
            }
        }
        

        // start handling the new request (if there is one)
        //const new_request = request_queue.shift();
        new_requests = [];
        for (var i = 0; i < NUM_REQUESTS; i++) {
            r = request_queue.shift();
            if (r) {
                new_requests.push(r);
            }
        }

        if (new_requests.length >= 1) {
            requestHandler(new_requests);
        } else {
            io.sockets.emit('clear_screen', null);
            request_number = 0;
        }
    });

    client.on('pair', (data) => {
        pairSystemsGenKey(data);
    });

    client.on('key_schedule', (data) => {
        ack = {};
        ack['ack'] = "I have received the key schedule";
        ack['auth'] = generateAuthToken(ack['ack']);
        io.sockets.emit('ack', ack);

        parseKeySchedule(data);


        // start handling the new request (if there is one)
        const new_request = request_queue.shift();
        if (new_request) {
            requestHandler(new_request);
        } else {
            io.sockets.emit('clear_screen', null);
            request_number = 0;
        }
    });
});


/*
    handle requests
*/
app.get('/', function(req, res, next) {
    res.sendFile(__dirname + '/index.html');
});

app.post('/', function(request, response) {

    if (request.body.data == 'pairing') {
        pairSystemsSetup();
        response.end();
        return;
    }

    // generate request id
    var hash = crypto.createHash('sha256');
    var data = request.body;
    
    hash.update(JSON.stringify(data));
    data['id'] = hash.digest('base64');

    callbacks.set(data.id, (data) => {
        returnResponse(data, request, response);
    });

    if (request_number == 0) {
        data = [data];
        requestHandler(data);
        request_number = 1;
    } else {
        request_queue.push(data);
    }

});

server.setTimeout(0);
server.listen(PORT);


/*
    This function handles the requests from the request_queue. 
    * data:     the data containing an ID and the data that needs to be signed by the signer.

    the function comptes the authentication token based on the data and then sends a notification to the browser
    in order to generate the corresponding QR-code
*/
function requestHandler(data) {

    var data_to_send = {};
    requests = {};

    for (var i = 0; i < data.length; i++) {
        requests[i] = data[i];
    }
    data_to_send['data'] = requests;

    console.time('auth_token_generation_time');
    data_to_send['auth'] = generateAuthToken(JSON.stringify(requests));
    console.timeEnd('auth_token_generation_time');


    // notify the browser which then sets the qr-code
    io.sockets.emit('update_img', data_to_send);
}


/*
    This function is called when the we receive a response with the 'answer' flag from the signer
    * data:     the data from the signer scanned from the browser
    * req:      the original request object
    * res:      the original response object in order to know where we need to send the answer back

    The function first checks if it has received an error which would mean that the signer could not
    verify the data received. If there is no error, we check if the signature is actually from the signer.
    If either of them does not hold, we resend the original request to the signer.
    Otherwise, we strip of the id and send the assertion and the signature back to the issuer.
*/
function returnResponse(data, req, res) {

    var error = data.error;

    if (error) {
        console.log("[!!!] ERROR: Signer received a message with wrong authentication token.");
        console.log("[!!!] --> resend request");
        resendRequest(req, res, data);
        return;
    }

    if (!verifySignature(data.assertion, data.signature)) {
        console.log("[!!!] ERROR: Signature is not from Signer!");
        console.log("[!!!] --> resend request");
        resendRequest(req, res, data);
        return
    }

    // strip the id
    var answer = {};
    answer['assertion'] = data.assertion;
    answer['signature'] = data.signature;

    // send back actual response
    res.json(answer);
}

/*
    This function resends the request to the signer and is called in the response handler
    * data:     the data from the signer scanned from the browser
    * req:      the original request object
    * res:      the original response object in order to know where we need to send the answer back
*/
function resendRequest(req, res, data) {
    // generate request id
    var hash = crypto.createHash('sha256');
    var data_orig = req.body;
    hash.update(JSON.stringify(data_orig));
    data_orig['id'] = hash.digest('base64');

    // reissue the request on authentication failure
    callbacks.set(data_orig.id, (data) => {
        returnResponse(data, req, res);
    });
    // prioritize the request and push it to the front of the request_queue
    request_queue.unshift(data_orig)
}

/*
    This function is the beginning of the pairing, i.e., establishing a new shared key for authentication.
    It creates a new Diffie-Hellmann half key using the ECDH algorighm and notifies the browser to generate the
    corresponding QR-code.
*/
function pairSystemsSetup() {

    console.log("PAIRING");

    // prepare for DH
    // use ECDH because it is much faster than normal DH from crypto library
    dh = crypto.createECDH('secp521r1');
    var signee_key = dh.generateKeys('hex', 'compressed');

    var dh_exchange = {};
    dh_exchange['signee_key'] = signee_key;

    if (SHARED_KEY != "") {
        dh_exchange['auth'] = generateAuthToken(signee_key);
    }

    io.sockets.emit('update_img', dh_exchange);

}

/*
    This funciton is the second part of the pairing mechanism and is called when the signee receives the
    Diffie-Hellmann half key from the signer. Together with his own half key he can compute the new shared key and store it
    in a file 'auth_key'
    * data:     data from the signer containing its Diffie-Hellman half key
*/
function pairSystemsGenKey(data) {

    if (data.auth) {
        if(!verifyAuth(data.signer_key, data.auth)) {
            console.log("[!!!] ERROR: Pairing failed due to incorrect authentication!");
            console.log("[!!!] --> Keep old shared key");
            return;
        }
    }
    var shared_key = dh.computeSecret(data.signer_key, 'hex', 'hex');

    SHARED_KEY = shared_key;
    console.log(SHARED_KEY);
    fs.writeFileSync(SHARED_KEY_PATH + 'auth_key', SHARED_KEY);
}

/*
    This function parses the received key schedule. It stores all the public keys in it and also sets new
    scheduled jobs in order to fetch the new keys later on.
    * data:     the new key schedule
*/
function parseKeySchedule(data) {

    schedule = data;

    if (schedule.pub_key) {
        PUBLIC_KEY = str2buf(schedule.pub_key, 'base64');
        fs.writeFileSync(PUBLIC_KEYPATH + 'signer.pub', schedule.pub_key);
    }

    if (!verifySignature(schedule.keys, schedule.signature)) {
        console.log("[!!!] ERROR: Verification of key schedule failed!");
        return;
    }

    console.log("[***] Received new Key Schedule");

    keys = schedule.keys;

    fs.writeFileSync(PUBLIC_KEYPATH + 'pk_schedule', "");

    for (var key in keys) {
        if (keys.hasOwnProperty(key)) {
            line = keys[key].valid_from + "," + keys[key].valid_to + "," + keys[key].public_key + "\n";
            fs.appendFileSync(PUBLIC_KEYPATH + 'pk_schedule', line);

            // set schedule entry when to get the next key
            var new_job = scheduler.scheduleJob(keys[key].valid_from, () => {
                getNextPubKey();
            });
        }
    }

    // add schedule entry for getting the new key schedule
    var last_key = Object.keys(keys)[Object.keys(keys).length - 1];
    var end_date = (new Date(last_key.valid_to)).getTime() - 30000;
    var new_job = scheduler.scheduleJob(end_date, () => {
        getNewKeySchedule();
    });
}

/*
    This function is called when the Signee needs a new key schedule from the Signer.
    It generates a new request and sends it to the browser
    * initial:  The initial flag is used to indicate the very first request, notifying the Signer
                to also send his current public key
*/
function getNewKeySchedule(initial=false) {
    data = {};
    data['new_schedule'] = "Give me a new key schedule";

    // prioritize the request and push it to the front of the request_queue
    if (initial) {
        data['initial'] = 'true';
        io.sockets.emit('update_img', data);
    } else {
        request_queue.unshift(data);
    }
}

/*
    This function is called by the scheduled Jobs. It fetches the next public key from the key file
*/
function getNextPubKey() {
    schedule = Buffer.from(fs.readFileSync(PUBLIC_KEYPATH + 'pk_schedule')).toString();
    
    if (schedule != "") {
        schedule = schedule.split('\n');
        new_line = schedule[0].split(',');

        from = new Date(new_line[0]);
        to = new Date(new_line[1]);

        next_key = new_line[2];

        // delete current key from key schedule
        exec("sed -i '/" + next_key.split('\/').join('\\\/') + "/d' " + PUBLIC_KEYPATH + 'pk_schedule', (err, stdout, stderr) => {
            if (err) {
                console.log(stderr);
            }
        })

        // and move it to the file storing the current public key of the signer
        fs.writeFileSync(PUBLIC_KEYPATH + 'signer.pub', next_key);
        PUBLIC_KEY = str2buf(next_key, 'base64');

        console.log("[***] NEW PUBLIC KEY: ", Buffer.from(PUBLIC_KEY).toString('base64'));
    } else {
        console.log("[***] No keys in the key schedule. Keep old PUBLIC KEY!");
    }
    
}

/*
    This function checks if todays date is within the desired range
    * from:     Start date
    * to:       End date
*/
function isValid(from, to) {
    var today = Date();

    return (today >= from && today < to);
}

/*
    This funciton generates an authentication token by computing a HMAC of the message
    * msg:     Message which we want to send.
*/
function generateAuthToken(msg) {
    hmac = crypto.createHmac('sha256', SHARED_KEY);
    hmac.update(msg);
    return hmac.digest('base64');
}

/*
    This function verifies the authentication token of the signee
    * msg:        message that is autheticated
    * auth_token: hmac of the message

    The function returns true if the authentication was successful otherwise false
*/
function verifyAuth(msg, auth_token) {
    hmac = crypto.createHmac('sha256', SHARED_KEY);
    hmac.update(msg);
    return auth_token == hmac.digest('base64');
}

/*
    This function verifies the signature of the response. If the verification is successful, it returns true otherwise false.
*/
function verifySignature(msg, signature) {
    return curve.sign.detached.verify(json2buf(msg, 'ascii'), str2buf(signature, 'base64'), PUBLIC_KEY);
}

/*
    Helper functions in order to convert between String and Uint8Array
*/
function buf2str(buffer, encoding) {
    return Buffer.from(buffer).toString(encoding);
}

function str2buf(str, encoding) {
    return new Uint8Array(Buffer.from(str, encoding));
}

function json2buf(json, encoding) {
    return str2buf(JSON.stringify(json), encoding);
}
