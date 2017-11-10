// app.js
var express = require('express');
var bodyParser = require('body-parser');
var logger = require('morgan');
var curve = require('tweetnacl');
var crypto = require('crypto');
var fs = require('fs');

var events = require('events');
var Mutex = require('./mutex');
var mutex = new Mutex();

var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var eventEmitter = new events.EventEmitter();

app.use(express.static(__dirname + '/node_modules'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(logger('dev'));


const AUTH_METHOD = 'mac';
const SECRET_KEY_PATH = __dirname + '/sk/';
const PUBLIC_KEY_PATH = __dirname + '/pk/public_key_signer';

var PUBLIC_KEY_SIGNER = '';
var SECRET_KEY_SIGNEE = '';

switch (AUTH_METHOD) {
    case 'mac':
        SECRET_KEY_SIGNEE = fs.readFileSync(SECRET_KEY_PATH + 'auth_key');
        break;
    case 'sign':
    default:
        PUBLIC_KEY_SIGNER = fs.readFileSync(PUBLIC_KEY_PATH, 'ascii');
        SECRET_KEY_SIGNEE = fs.readFileSync(SECRET_KEY_PATH + 'secret_key_signee', 'ascii');
        break;
}

var hmac;

/*
    Socket IO stuff
*/

var connected_users;

io.on('connection', function(client) {
    client.setMaxListeners(0);
    connected_users = {};
    var clientID = client.conn.id;
    connected_users[clientID] = client;
});


/*
    handle requests
*/
app.get('/', function(req, res,next) {
    res.sendFile(__dirname + '/index.html');
});


var requests = [];

app.post('/', function(req, res) {
    // get the data received from the network
    var network_data = req.body.data;

    /*
        testing with queue
    */
    requests.push({req: req, res: res});

    console.log("number of requests: " + requests.length);

    if ((requests.length >= NUM_OF_PARALLEL_REQ )) {
        eventEmitter.emit('handle_requests');
    }

});

server.listen(3000);

const NUM_OF_PARALLEL_REQ = 4;

eventEmitter.on('handle_requests', function() {
    mutex.synchronize(requestHandler);
});

/*
    handler that handles the requests
*/
function requestHandler() {

    return new Promise((resolve, reject) => {
        var req_res = {};
        var data = {};


        for (var i = 0; i < NUM_OF_PARALLEL_REQ; i++) {
            req_res[i] = requests.shift();
            data['data' + i] = req_res[i].req.body.data;
        }

        var data_to_send = {};
        data_to_send['data'] = data;
        data_to_send['auth'] = generateAuthToken(JSON.stringify(data), AUTH_METHOD);

        io.sockets.emit('update_img', JSON.stringify(data_to_send));

        var last_id = (last=Object.keys(connected_users))[last.length-1];
        var client = connected_users[last_id];

        // handle the answer once a new qr-code has been scanned.
        client.on('answer', function(data) {

            data = JSON.parse(data);

            var error = data.error;
            var msgs = data.msgs;
            var mac = data.auth;

            if (error) {
                for (var i = 0; i < NUM_OF_PARALLEL_REQ; i++) {
                    req_res[i].res.end(error);
                }
                return;
            }

            // check if the data is correct, i.e. not altered and coming from the signer
            if (!verifyAuth(JSON.stringify(msgs), mac, AUTH_METHOD)) {
                console.log("HELLO IM HERE");
                for (var i = 0; i < NUM_OF_PARALLEL_REQ; i++) {
                    error = {};
                    error['error'] = 'There has been an error! The authentication token could not be verified!';
                    req_res[i].res.end(JSON.stringify(error));
                }
                return;
            }

            msgs = JSON.parse(msgs);

            // send back actual response
            for (var i = 0; i < NUM_OF_PARALLEL_REQ; i++) {
                req_res[i].res.json(msgs['msg' + i]);
            }
        });
    });
}


/*
    verify authentication
*/
function verifyAuth(msg, auth_token, method) {
    switch (method) {
        case 'mac':
            hmac = crypto.createHmac('sha256', SECRET_KEY_SIGNEE);
            hmac.update(msg);
            return auth_token == hmac.digest('hex');
        default:
        case 'sign':
            return curve.sign.detached.verify(str2buf(msg, 'ascii'), str2buf(auth_token, 'hex'), str2buf(PUBLIC_KEY_SIGNER, 'hex'));

    }
}


/*
    generate the authentication token
*/
function generateAuthToken(msg, method) {
    switch (method) {
        case 'mac':
            hmac = crypto.createHmac('sha256', SECRET_KEY_SIGNEE);
            hmac.update(msg);
            return hmac.digest('hex');
        case 'sign':
        default:
            var signature = curve.sign.detached(str2buf(msg, 'ascii'), str2buf(SECRET_KEY_SIGNEE, 'hex'));
            signature = Buffer.from(signature).toString('hex');
            return signature
    }
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
