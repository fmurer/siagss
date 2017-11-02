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


const AUTH_METHOD = 'sign';
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

app.post('/', function(req, res) {
    // get the data received from the network
    var network_data = req.body.data;

    var auth = generateAuthToken(network_data, AUTH_METHOD);

    var data_to_send = {};
    try {
        data_to_send['data'] = JSON.parse(network_data);
    } catch (e) {
        data_to_send['data'] = network_data;
    }
    data_to_send['auth'] = auth;

    // notify the browser which then sets the qr-code
    io.sockets.emit('update_img', JSON.stringify(data_to_send));

    var last_id = (last=Object.keys(connected_users))[last.length-1];
    var client = connected_users[last_id];

    // handle the answer once a new qr-code has been scanned.
    client.on('answer', function(data) {

        data = JSON.parse(data);

        var err = data.error;
        var msg = data.msg;
        var mac = data.auth;

        if (err) {
            res.end(data);
            return;
        }

        // check if the data is correct, i.e. not altered and coming from the signer
        if (!verifyAuth(JSON.stringify(msg), mac, AUTH_METHOD)) {
            res.end({error: "There has been an error! The authentication token could not be verified"});
            return;
        }

        res.end(JSON.stringify(msg));
    });

});

server.listen(3000);

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
            return curve.sign.detached.verify(str2buf(msg), str2buf(auth_token), str2buf(PUBLIC_KEY_SIGNER));

    }
}


/*
    generate the authentication token
*/
function generateAuthToken(msg, method) {
    switch (method) {
        case 'mac':
            hmac = crypto.createHmac('sha256', SHARED_KEY);
            hmac.update(msg);
            return hmac.digest('hex');
        case 'sign':
        default:
            var signature = curve.sign.detached(str2buf(msg), str2buf(SECRET_KEY_SIGNEE));
            signature = Buffer.from(signature).toString('hex');
            return signature
    }
}

/*
    Helper functions in order to convert between String and Uint8Array
*/
function buf2str(buffer, encoding='ascii') {
    return Buffer.from(buffer).toString(encoding);
}

function str2buf(str, encoding='hex') {
    return new Uint8Array(Buffer.from(str, encoding));
}
