// app.js
var express = require('express');
var bodyParser = require('body-parser');
var logger = require('morgan');
var curve = require('tweetnacl');
var crypto = require('crypto');
var fs = require('fs');

var app = express();
var server = require('http').createServer(app);

app.use(express.static(__dirname + '/node_modules'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(logger('dev'));


const SHARED_KEY_PATH = __dirname + '/sk/auth_key';
const SHARED_KEY = fs.readFileSync(SHARED_KEY_PATH, 'ascii');
const hmac = crypto.createHmac('sha256', SHARED_KEY);


var keyPair = generateKeyPair();

/*
    handle requests
*/
app.get('/', function(req, res,next) {
    res.sendFile(__dirname + '/index.html');
});

app.post('/', function(req, res) {
    // content of the qr-code read by the webcam
    var incoming_request = '';

    // for testin purposes. In normal environment, should come as JSON parsable string.
    try {
        incoming_request = JSON.parse(req.body.qrcode);
    } catch (e) {
        incoming_request = { data: req.body.qrcode, auth: ''};
    }

    var data = incoming_request.data;
    var auth = incoming_request.auth;


    // check if the data is correct, i.e. not altered and coming from the signee
    if (!verifyAuth(data, auth, 'sign')) {
        res.json({error: "There has been an error! The authentication token could not be verified"});
        return;
    }


    var respond_data = {};
    var msg = {};
    var assertion = {};

    assertion['data'] = data;
    var validity = getValidityRange();
    assertion['valid_from'] = validity.from;
    assertion['valid_until'] = validity.until;

    var to_sign = str2buf(JSON.stringify(assertion));

    // sign the incoming request
    var signature = signRequest(to_sign);

    msg['assertion'] = assertion;
    msg['signature'] = signature;

    respond_data['msg'] = msg;
    respond_data['auth'] = generateAuthToken(JSON.stringify(msg), 'mac');

    console.log(respond_data);
    // send back response to the ajax success function which will then generate the qr code.
    res.json(respond_data);
});

server.listen(3000);



/*
    Sign the request and return the signature
*/
function signRequest(data) {
    console.time('signing_time');
    var signature = curve.sign.detached(data, keyPair.secretKey);
    signature = Buffer.from(signature).toString('hex');
    console.timeEnd('signing_time');
    return signature;
}


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


/*
    compute a validity range of length 'duration'.
    Default is 10 days from today.
    ATTENTION: when changing 'duration', then also set the 'startdate'
*/
function getValidityRange(startdate=0, duration=10) {
    validity = {};

    var valid_from = new Date();
    valid_from.setDate(valid_from.getDate() + startdate);
    var valid_until = new Date();
    valid_until.setDate(valid_from.getDate() + duration);

    validity['from'] = Date.parse(valid_from.toUTCString());
    validity['until'] = Date.parse(valid_until.toUTCString());

    return validity;
}

/*
    Generate Key Pair for signing
*/
function generateKeyPair() {
    curve.sign.publicKeyLength = 32;
    curve.sign.secretKeyLength = 64;
    curve.sign.seedLength = 32;
    curve.sign.signatureLength = 64;

    return curve.sign.keyPair();
}

/*
    Helper functions in order to convert between String and Uint8Array
*/
function buf2str(buffer, encoding='ascii') {
    return Buffer.from(buffer).toString(encoding);
}

function str2buf(str) {
    return new Uint8Array(Buffer.from(str));
}
