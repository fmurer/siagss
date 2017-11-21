// app.js
var express = require('express');
var bodyParser = require('body-parser');
var logger = require('morgan');
var curve = require('tweetnacl');
var crypto = require('crypto');
var fs = require('fs');

var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);

app.use(express.static(__dirname + '/node_modules'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(logger('dev'));


const SHARED_KEY_PATH = __dirname + '/sk/';
var SHARED_KEY = fs.readFileSync(SHARED_KEY_PATH + 'auth_key');

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
});


/*
    handle requests
*/
app.get('/', function(req, res,next) {
    res.sendFile(__dirname + '/index.html');
});


var request_queue = [];
var request_number = 0;

app.post('/', function(request, response) {

    if (request.body.data == 'pairing') {
        pairSystemsSetup(request, response);
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
    handler that handles the requests
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

function returnResponse(data, req, res) {

    var error = data.error;

    if (error) {

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
        //request_queue.push(data_orig)
        request_queue.unshift(data_orig)

        return;
    }

    // send back actual response

    // strip the id
    var answer = {};
    answer['assertion'] = data.assertion;
    answer['signature'] = data.signature;


    res.json(answer);
}

var dh;

function pairSystemsSetup(req, res) {

    console.log("PAIRING");

    // prepare for DH
    // use ECDH because it is much faster than normal DH from crypto library
    dh = crypto.createECDH('secp521r1');
    var signee_key = dh.generateKeys('hex', 'compressed');

    var dh_exchange = {};
    dh_exchange['signee_key'] = signee_key;

    io.sockets.emit('update_img', JSON.stringify(dh_exchange));

}

function pairSystemsGenKey(data) {
    data = JSON.parse(data);

    var shared_key = dh.computeSecret(data.signer_key, 'hex', 'hex');

    SHARED_KEY = shared_key;
    console.log(SHARED_KEY);
    fs.writeFileSync(SHARED_KEY_PATH + 'auth_key', SHARED_KEY);
}

/*
    generate the authentication token
*/
function generateAuthToken(msg) {
    hmac = crypto.createHmac('sha256', SHARED_KEY);
    hmac.update(msg);
    return hmac.digest('hex');
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
