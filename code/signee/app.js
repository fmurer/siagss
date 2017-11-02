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



const SHARED_KEY_PATH = __dirname + '/sk/auth_key';
const SHARED_KEY = fs.readFileSync(SHARED_KEY_PATH, 'ascii');
const hmac = crypto.createHmac('sha256', SHARED_KEY);



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

    var auth = generateAuthToken(network_data, 'sign');

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

        var err = data.error;
        var msg = data.msg;
        var mac = data.auth;

        if (err) {
            res.end(data);
            return;
        }

        // check if the data is correct, i.e. not altered and coming from the signer
        if (!verifyAuth(JSON.stringify(msg), mac, 'sign')) {
            res.end({error: "There has been an error! The authentication token could not be verified"});
            return;
        }

        res.end(msg);
    });

});

server.listen(3000);

/*
    verify authentication
*/
function verifyAuth(msg, auth_token, method) {
    switch (method) {
        case 'mac':
            hmac.update(msg);
            return auth_token == hmac.digest('hex');
        case 'sign':
            // TODO: use the right public key of the signee
            return curve.sign.detached.verify(str2buf(msg), str2buf(auth_token), keyPair.publicKey);
        default:
            return verifyAuth(msg, auth_token, 'sign');
    }
}


/*
    generate the authentication token
*/
function generateAuthToken(msg, method) {
    switch (method) {
        case 'mac':
            hmac.update(msg);
            return hmac.digest('hex');
        case 'sign':
            // TODO: use another key for authentication
            var signature = curve.sign.detached(msg, keyPair.secretKey);
            signature = Buffer.from(signature).toString('hex');
            return signature
        default:
            return generateAuthToken(msg, 'sign');
    }
}
