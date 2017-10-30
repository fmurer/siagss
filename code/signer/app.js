// app.js
var express = require('express');
var bodyParser = require('body-parser');
var logger = require('morgan');
var curve = require('tweetnacl');


var app = express();
var server = require('http').createServer(app);

app.use(express.static(__dirname + '/node_modules'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(logger('dev'));

var keyPair = generateKeyPair();

/*
    handle requests
*/
app.get('/', function(req, res,next) {
    res.sendFile(__dirname + '/index.html');
});

app.post('/', function(req, res) {
    // content of the qr-code read by the webcam
    var data = req.body.qrcode;

    var respond_data = {};
    var assertion = {};
    assertion['data'] = data;

    // TODO: set validity duration based on data
    var validity = getValidityRange();
    assertion['valid_from'] = validity.from;
    assertion['valid_until'] = validity.until;

    var to_sign = str2buf(JSON.stringify(assertion));

    // sign the incoming request
    console.time('signing_time');
    var signature = curve.sign.detached(to_sign, keyPair.secretKey);
    console.timeEnd('signing_time');
    // we need to convert it into a string in order to properly generate a QR-code out of it.
    var base64_signature = Buffer.from(signature).toString('base64');

    respond_data['assertion'] = assertion;
    respond_data['signature'] = base64_signature;

    console.log(respond_data);
    // send back response to the ajax success function which will then generate the qr code.
    res.json(respond_data);
});

server.listen(3000);



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

    console.log("from: " + valid_from);
    console.log("until: " + valid_until);

    validity['from'] = Date.parse(valid_from.toUTCString());
    validity['until'] = Date.parse(valid_until.toUTCString());

    return validity;
}

/*
    Generate Key Pair for signing
*/
function generateKeyPair() {
    return curve.sign.keyPair();
}

/*
    Helper functions in order to convert between String and Uint8Array
*/
function buf2str(buffer) {
    Buffer.from(buffer).toString('ascii');
}

function str2buf(str) {
    return new Uint8Array(Buffer.from(str));
}
