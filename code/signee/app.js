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

app.post('/', function(req, res) {
    // get the data received from the network
    var network_data = req.body.data;
    var network_from = req.body.from;
    var network_to = req.body.to;

    var data = {};
    data['data'] = network_data;
    data['from'] = network_from;
    data['to'] = network_to;

    console.log(data);

    var auth = generateAuthToken(JSON.stringify(data), AUTH_METHOD);

    var data_to_send = {};
    data_to_send['data'] = data;
    data_to_send['auth'] = auth;

    console.log(data_to_send);
    
    // notify the browser which then sets the qr-code
    io.sockets.emit('update_img', JSON.stringify(data_to_send));

    var last_id = (last=Object.keys(connected_users))[last.length-1];
    var client = connected_users[last_id];

    // handle the answer once a new qr-code has been scanned.
    client.on('answer', function(data) {
        res.end(data);
    });

});

server.listen(3000);



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
