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



const SHARED_KEY_PATH = __dirname + '/sk/';
var SHARED_KEY = fs.readFileSync(SHARED_KEY_PATH + 'auth_key');
const SIGNING_KEY = generateKeyPair().secretKey


/*
    handle requests
*/
app.get('/', function(req, res,next) {
    res.sendFile(__dirname + '/index.html');
});

app.post('/', function(req, res) {

    incoming_request = JSON.parse(req.body.qrcode);

    if (incoming_request.prime) {
        pairSystems(req, res);
        return;
    }

    var data = incoming_request.data;
    var auth = incoming_request.auth;

    // check if the data is correct, i.e. not altered and coming from the signee
    if (!verifyAuth(data, auth)) {
        var error = {};
        error['error'] = 'There has been an error! The authentication token could not be verified';
        res.json(error);
        return;
    }

    var respond_data = {};
    var assertion = {};

    from = toDate(data['from']);
    to = toDate(data['to']);
    var validity = getValidityRange(from, to);

    assertion['data'] = data['data'];
    assertion['valid_from'] = validity.from;
    assertion['valid_until'] = validity.until;

    var signature = signRequest(assertion);

    respond_data['id'] = data['id'];
    respond_data['assertion'] = assertion;
    respond_data['signature'] = signature;

    // send back response to the ajax success function which will then generate the qr code.
    res.json(respond_data);
});

server.listen(3000);



function pairSystems(req, res) {

    console.log("PAIRING");

    var data = JSON.parse(req.body.qrcode);

    var dh = crypto.createDiffieHellman(data.prime, data.generator);
    var signer_key = dh.generateKeys('hex');

    var shared_key = dh.computeSecret(data.signee_key);

    var dh_exchange = {};
    dh_exchange['signer_key'] = signer_key;

    /*
    var hash = crypto.createHash('sha256');

    var new_date = JSON.parse(req.body.qrcode).pair;

    var cur_time = new Date(new_date);

    var day = cur_time.getDate();
    var hour = cur_time.getHours();
    var min = cur_time.getMinutes();
    var sec = cur_time.getSeconds();

    hash.update(day.toString() + ":" + hour.toString() + ":" + min.toString() + ":" + sec.toString());

    var shared_key = curve.sign.keyPair.fromSeed(str2buf(hash.digest('hex'), 'hex')).secretKey;
    shared_key = Buffer.from(shared_key).toString('hex');
    */

    SHARED_KEY = shared_key
    //fs.writeFileSync(SHARED_KEY_PATH + 'auth_key', SHARED_KEY);
    //res.end()
    res.json(dh_exchange);
}


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
function verifyAuth(msg, auth_token) {
    hmac = crypto.createHmac('sha256', SHARED_KEY);
    hmac.update(JSON.stringify(msg));
    return auth_token == hmac.digest('hex');
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
