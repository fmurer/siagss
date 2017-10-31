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

/*
const SHARED_KEY_PATH = __dirname + '/sk/shared_key';
const SHARED_KEY = fs.readFileSync(SHARED_KEY_PATH, 'ascii');
*/

var keyPair = generateKeyPair();

/*
    handle requests
*/
app.get('/', function(req, res,next) {
    res.sendFile(__dirname + '/index.html');
});

app.post('/', function(req, res) {
    // content of the qr-code read by the webcam
    var incoming_request = req.body.qrcode;
    var data = incoming_request.data;
    var mac = incoming_request.mac;

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
    // we need to convert it into a string in order to properly generate a QR-code out of it.
    var base64_signature = Buffer.from(signature).toString('base64');

    msg['assertion'] = assertion;
    msg['signature'] = base64_signature;

    respond_data['msg'] = msg;
    respond_data['mac'] = '';

    console.log(respond_data);
    // send back response to the ajax success function which will then generate the qr code.
    res.json(respond_data);
});

server.listen(3000);




/*
    This is for testing purposes only. Can later be used for the verifier.
*/
function verify(message, publicKey) {
    data = str2buf(JSON.stringify(message.assertion));
    var signature = new Uint8Array(Buffer.from(message.signature, 'base64'));

    if (curve.sign.detached.verify(data, signature, publicKey)) {
        console.log("Verification SUCCESS");
    } else {
        console.log("Verification FAILED");
    }
}

/*
    Sign the request and return the signature
*/
function signRequest(data) {
    console.time('signing_time');
    var signature = curve.sign.detached(data, keyPair.secretKey);
    console.timeEnd('signing_time');
    return signature;
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
