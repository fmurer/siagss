// app.js
var express = require('express');
var bodyParser = require('body-parser');
var logger = require('morgan');
var curve = require('tweetnacl');
var crypto = require('crypto');
var fs = require('fs');
const { exec } = require('child_process');
var asyn = require('async');

var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);

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

app.post('/', function(request, response) {

    if (request.body.data == 'pairing') {
        pairSystems(request, response);
        return;
    }

    requests.push({req: request, res: response});

    console.log("number of requests: " + requests.length);

});

server.listen(3000);


const NUM_REQUESTS_TOGETHER = 1;

/*
    handler that handles the requests
*/
asyn.forever(
    function requestHandler(next) {

        if (requests.length >= NUM_REQUESTS_TOGETHER) {


            var req_res = [];
            var data = {};


            for (var i = 0; i < NUM_REQUESTS_TOGETHER; i++) {
                req_res[i] = requests.shift();

                // get the data received from the network
                var network_data = req_res[i].req.body.data;
                var network_from = req_res[i].req.body.from;
                var network_to = req_res[i].req.body.to;

                var req_data = {};
                req_data['data'] = network_data;
                req_data['from'] = network_from;
                req_data['to'] = network_to;

                data['data' + i] = req_data;
            }

            var data_to_send = {};
            data_to_send['data'] = data;
            data_to_send['auth'] = generateAuthToken(JSON.stringify(data), AUTH_METHOD);;

            //console.log(data_to_send);

            // notify the browser which then sets the qr-code
            io.sockets.emit('update_img', JSON.stringify(data_to_send));

            var last_id = (last = Object.keys(connected_users))[last.length - 1];
            var client = connected_users[last_id];

            // handle the answer once a new qr-code has been scanned.
            client.on('answer', function(data) {

                data = JSON.parse(data);

                var error = data.error;
                var msgs = data.msgs;

                if (error) {
                    console.log("I WAS HERE");
                    for (var i = 0; i < NUM_REQUESTS_TOGETHER; i++) {
                        error = {};
                        error['error'] = 'There has been an error! The authentication token could not be verified!'
                        req_res[i].res.json(error);
                        break;
                    }
                    return;
                }

                // send back actual response
                for (var i = 0; i < NUM_REQUESTS_TOGETHER; i++) {
                    try {
                        req_res[i].res.json(msgs['msg' + i]);
                    } catch (e) {
                        // TODO: see why there are so many requests
                    }
                    break;
                }

                next();
            });
        } else {
            next();
        }
    },
    function finished(err) {
        if (err) {
            console.log(err);
        }
    }
);

function pairSystems(req, res) {

    console.log("PAIRING");

    var hash = crypto.createHash('sha256');

    var coeff = 1000*5; // 5000ms -> 5s
    var date = new Date();
    var cur_time = new Date(Math.ceil((date.getTime()) / coeff) * coeff);
    var day = cur_time.getDate();
    var hour = cur_time.getHours();
    var min = cur_time.getMinutes();
    var sec = cur_time.getSeconds();

    hash.update(day.toString() + ":" + hour.toString() + ":" + min.toString() + ":" + sec.toString());

    var shared_key = curve.sign.keyPair.fromSeed(str2buf(hash.digest('hex'), 'hex')).secretKey;
    shared_key = Buffer.from(shared_key).toString('hex');

    SECRET_KEY_SIGNEE = shared_key;
    res.end();
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
