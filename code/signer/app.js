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

    incoming_request = JSON.parse(req.body.qrcode);

    var data = incoming_request.data;
    var auth = incoming_request.auth;

    // check if the data is correct, i.e. not altered and coming from the signee
    if (!verifyAuth(JSON.stringify(data), auth, AUTH_METHOD)) {
        var error = {};
        error['error'] = 'There has been an error! The authentication token could not be verified';
        res.json(error);
        return;
    }

    var respond_data = {};
    var assertion = {};

    assertion['data'] = data.data;

    from = toDate(data.from);
    to = toDate(data.to);
    var validity = getValidityRange(from, to);


    assertion['valid_from'] = validity.from;
    assertion['valid_until'] = validity.until;

    // sign the incoming request
    var signature = signRequest(assertion);

    respond_data['assertion'] = assertion;
    respond_data['signature'] = signature;

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


function getValidityRange(startdate, enddate, MAX_DURATION=20) {
    validity = {};
    var today = new Date();

    // no start date in the past
    if (startdate < today) {
        startdate = today;
    }

    var valid_from = startdate;
    var valid_until = new Date();

    if (timeDifference(startdate, enddate) < MAX_DURATION) {
        valid_until = enddate;
    } else {
        valid_until.setDate(valid_from.getDate() + MAX_DURATION);
    }

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
    SOME HELPER FUNCTIONS
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

function toDate(str, delim='/') {
    var parts = str.split(delim);
    return new Date(parts[2], parts[1] - 1, parts[0]);
}

function timeDifference(date1, date2) {
    var timeDiff = Math.abs(date2.getTime() - date1.getTime());
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
}
