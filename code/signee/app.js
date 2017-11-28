var express = require('express');
var bodyParser = require('body-parser');
var logger = require('morgan');
var curve = require('tweetnacl');
var crypto = require('crypto');
var fs = require('fs');
var CronJob = require('cron').CronJob;
var { exec } = require('child_process');

var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);

app.use(express.static(__dirname + '/node_modules'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(logger('dev'));

// this needs to run every 24 hours as one key is valid for only that time
new CronJob('* * * * *', () => {
    setTimeout(() => {
        getNextPubKey();
    }, 30000);
}, null, true);

const SHARED_KEY_PATH = __dirname + '/sk/';
const PUBLIC_KEYPATH = __dirname + '/pk/';

var SHARED_KEY = fs.readFileSync(SHARED_KEY_PATH + 'auth_key');
var PUBLIC_KEY = Buffer.from(fs.readFileSync(PUBLIC_KEYPATH + 'signer.pub')).toString();
PUBLIC_KEY = str2buf(PUBLIC_KEY, 'hex');

var hmac;

/*
    Socket IO stuff
*/

const callbacks = new Map();

io.on('connection', function(client) {
    client.setMaxListeners(0);

    client.on('answer', (data) => {
        data = JSON.parse(data);

        const cb = callbacks.get(data.id);
        if (!cb) {
            return;
        }
        cb(data);
        callbacks.delete(data.id);

        // start handling the new request (if there is one)
        const new_request = request_queue.shift();
        if (new_request) {
            requestHandler(new_request);
        } else {
            request_number = 0;
        }
    });

    client.on('pair', (data) => {
        pairSystemsGenKey(data);
    });

    client.on('key_schedule', (data) => {
        parseKeySchedule(data);
    });
});


/*
    handle requests
*/
app.get('/', function(req, res, next) {
    res.sendFile(__dirname + '/index.html');
});


var request_queue = [];
var request_number = 0;

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
    data['id'] = hash.digest('hex');

    callbacks.set(data.id, (data) => {
        returnResponse(data, request, response);
    });

    if (request_number == 0) {
        requestHandler(data);
        request_number = 1;
    } else {
        request_queue.push(data);
    }

});

server.listen(3000);


/*
    This function handles the requests from the request_queue. 
    * data:     the data containing an ID and the data that needs to be signed by the signer.

    the function comptes the authentication token based on the data and then sends a notification to the browser
    in order to generate the corresponding QR-code
*/
function requestHandler(data) {

    var data_to_send = {};
    data_to_send['data'] = data;
    console.time('auth_token_generation_time');
    data_to_send['auth'] = generateAuthToken(JSON.stringify(data));;
    console.timeEnd('auth_token_generation_time');

    // notify the browser which then sets the qr-code
    io.sockets.emit('update_img', JSON.stringify(data_to_send));
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
        console.log("[!!!]    ERROR: Signer received a message with wrong authentication token.");
        console.log("[!!!]    --> resend request");
        resendRequest(req, res, data);
        return;
    }

    if (!verifySignature(data.assertion, data.signature)) {
        console.log("[!!!]    ERROR: Signature is not from Signer!");
        console.log("[!!!]    --> resend request");
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
    data_orig['id'] = hash.digest('hex');

    // reissue the request on authentication failure
    callbacks.set(data_orig.id, (data) => {
        returnResponse(data, req, res);
    });
    // prioritize the request and push it to the front of the request_queue
    request_queue.unshift(data_orig)
}

var dh;

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

    io.sockets.emit('update_img', JSON.stringify(dh_exchange));

}

/*
    This funciton is the second part of the pairing mechanism and is called when the signee receives the
    Diffie-Hellmann half key from the signer. Together with his own half key he can compute the new shared key and store it
    in a file 'auth_key'
    * data:     data from the signer containing its Diffie-Hellman half key
*/
function pairSystemsGenKey(data) {
    data = JSON.parse(data);

    var shared_key = dh.computeSecret(data.signer_key, 'hex', 'hex');

    SHARED_KEY = shared_key;
    console.log(SHARED_KEY);
    fs.writeFileSync(SHARED_KEY_PATH + 'auth_key', SHARED_KEY);
}


function parseKeySchedule(data) {

    schedule = JSON.parse(data);

    if (!verifySignature(schedule.keys, schedule.signature)) {
        console.log("[!!!]    ERROR: Verification of key schedule failed!");
        return;
    }

    keys = schedule.keys;

    fs.writeFileSync(PUBLIC_KEYPATH + 'pk_schedule', "");

    for (var key in keys) {
        if (keys.hasOwnProperty(key)) {
            line = keys[key].valid_from + "," + keys[key].valid_to + "," + keys[key].public_key + "\n";
            fs.appendFileSync(PUBLIC_KEYPATH + 'pk_schedule', line);
        }
    }
}

function getNextPubKey() {
    schedule = Buffer.from(fs.readFileSync(PUBLIC_KEYPATH + 'pk_schedule')).toString();
    
    if (schedule != "") {
        schedule = schedule.split('\n');

        next_key = schedule[0].split(',')[2];

        // delete current key from key schedule
        exec("sed -i '/" + next_key + "/d' " + PUBLIC_KEYPATH + 'pk_schedule', (err, stdout, stderr) => {
            if (err) {
                console.log(stderr);
            }
        })

        // and move it to the file storing the current public key of the signer
        fs.writeFileSync(PUBLIC_KEYPATH + 'signer.pub', next_key);
        PUBLIC_KEY = str2buf(next_key, 'hex');

        console.log("NEW PUBLIC KEY: ", Buffer.from(PUBLIC_KEY).toString('hex'));
    }
    
}

/*
    This funciton generates an authentication token by computing a HMAC of the message
    * msg:     Message which we want to send.
*/
function generateAuthToken(msg) {
    hmac = crypto.createHmac('sha256', SHARED_KEY);
    hmac.update(msg);
    return hmac.digest('hex');
}

/*
    This function verifies the signature of the response. If the verification is successful, it returns true otherwise false.
*/
function verifySignature(msg, signature) {
    return curve.sign.detached.verify(json2buf(msg, 'ascii'), str2buf(signature, 'hex'), PUBLIC_KEY);
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
