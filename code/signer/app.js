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



const AUTH_METHOD = 'mac';
const SECRET_KEY_PATH = __dirname + '/sk/';
const PUBLIC_KEY_PATH = __dirname + '/pk/public_key_signee';

var PUBLIC_KEY_SIGNEE = '';
var SECRET_KEY_SIGNER = '';

switch (AUTH_METHOD) {
    case 'mac':
        SECRET_KEY_SIGNER = fs.readFileSync(SECRET_KEY_PATH + 'auth_key');
        break;
    case 'sign':
    default:
        PUBLIC_KEY_SIGNEE = fs.readFileSync(PUBLIC_KEY_PATH, 'ascii');
        SECRET_KEY_SIGNER = fs.readFileSync(SECRET_KEY_PATH + 'secret_key_signer', 'ascii');
        break;
}

const SIGNING_KEY = generateKeyPair().secretKey

/*
    handle requests
*/
app.get('/', function(req, res,next) {
    res.sendFile(__dirname + '/index.html');
});

app.post('/', function(req, res) {
    // content of the qr-code read by the webcam
    var incoming_request = '';

    incoming_request = JSON.parse(req.body.qrcode);

    var data = incoming_request.data;
    var auth = incoming_request.auth;

    // check if the data is correct, i.e. not altered and coming from the signee
    if (!verifyAuth(data, auth, AUTH_METHOD)) {
        res.json({error: "There has been an error! The authentication token could not be verified"});
        return;
    }

    const NUM_OF_PARALLEL_REQ = 4;
    var respond_data = {};
    var msgs = {};

    var validity = getValidityRange();

    for (var i = 0; i < NUM_OF_PARALLEL_REQ; i++) {
        var assertion = {};

        assertion['data'] = data['data'+i];
        assertion['valid_from'] = validity.from;
        assertion['valid_until'] = validity.until;

        // sign the incoming request
        var signature = signRequest(assertion);

        msgs['msg'+i]['assertion'] = assertion;
        msgs['msg'+i]['signature'] = signature;
    }

    respond_data['msgs'] = msgs;
    respond_data['auth'] = generateAuthToken(msgs, AUTH_METHOD);

    // send back response to the ajax success function which will then generate the qr code.
    res.json(respond_data);
});

server.listen(3000);



/*
    Sign the request and return the signature
*/
function signRequest(data) {
    console.time('signing_time');
    var signature = curve.sign.detached(json2buf(data, encoding='ascii'), SIGNING_KEY);
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
            hmac = crypto.createHmac('sha256', SECRET_KEY_SIGNER);
            hmac.update(msg);
            return auth_token == hmac.digest('hex');
        case 'sign':
        default:
            return curve.sign.detached.verify(str2buf(msg, encoding='ascii'), str2buf(auth_token, encoding='hex'), str2buf(PUBLIC_KEY_SIGNEE, encoding='hex'));
    }
}


/*
    generate the authentication token
*/
function generateAuthToken(msg, method) {
    switch (method) {
        case 'mac':
            hmac = crypto.createHmac('sha256', SECRET_KEY_SIGNER);
            hmac.update(JSON.stringify(msg));
            return hmac.digest('hex');
        case 'sign':
        default:
            var signature = curve.sign.detached(json2buf(msg, encoding='ascii'), str2buf(SECRET_KEY_SIGNER, encoding='hex'));
            signature = Buffer.from(signature).toString('hex');
            return signature
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
function buf2str(buffer, encoding) {
    return Buffer.from(buffer).toString(encoding);
}

function str2buf(str, encoding) {
    return new Uint8Array(Buffer.from(str, encoding));
}

function json2buf(json, encoding) {
    return str2buf(JSON.stringify(json), encoding);
}
