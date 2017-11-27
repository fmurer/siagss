var express = require('express');
var bodyParser = require('body-parser');
var logger = require('morgan');
var curve = require('tweetnacl');
var crypto = require('crypto');
var fs = require('fs');
var CronJob = require('cron').CronJob;
var { exec } = require('child_process');

var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);

app.use(express.static(__dirname + '/node_modules'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(logger('dev'));


io.on('connection', function(client) {
    // do nothing
});

// this needs to run every 10 days as we have a list of 10 precomputed keypairs
new CronJob('0 * * * * *', () => {
    console.log("Generate new Key Schedule");
    generateNewKeySchedule();
}, null, true);

// this needs to run every 24 hours as one key is valid for only that time
new CronJob('0 * * * * *', () => {
    setTimeout(() => {
        getNextSignKey();
    }, 30000);
}, null, true);

const SECRET_KEYPATH = __dirname + '/sk/';
const PUBLIC_KEYPATH = __dirname + '/pk/';

var SHARED_KEY = fs.readFileSync(SECRET_KEYPATH + 'auth_key');
var SIGNING_KEY = Buffer.from(fs.readFileSync(SECRET_KEYPATH + 'sign_key')).toString();
SIGNING_KEY = str2buf(SIGNING_KEY, 'hex');

// TODO: Signee needs to know this public key in order to authenticate the key schedule.
generateNewKeySchedule();


/*
    handle requests
*/
app.get('/', function(req, res, next) {
    res.sendFile(__dirname + '/index.html');
});

app.post('/', function(req, res) {

    if (req.body.qrcode == 'key_schedule') {
        sendCurrentKeySchedule(req, res);
        return;
    }

    incoming_request = JSON.parse(req.body.qrcode);

    if (incoming_request.signee_key) {
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

    var dh = crypto.createECDH('secp521r1');
    var signer_key = dh.generateKeys('hex', 'compressed');

    var shared_key = dh.computeSecret(data.signee_key, 'hex', 'hex');

    var dh_exchange = {};
    dh_exchange['signer_key'] = signer_key;

    SHARED_KEY = shared_key
    console.log(SHARED_KEY);
    fs.writeFileSync(SECRET_KEYPATH + 'auth_key', SHARED_KEY);
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

    var diff = timeDifference(startdate, enddate);

    if ( diff < MAX_DURATION && diff > 0 ) {
        valid_until = enddate;
    } else {
        valid_until = new Date(valid_until.setDate(valid_from.getDate() + MAX_DURATION));
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

function generateNewKeySchedule(number_of_keys=10) {

    var start_date = new Date();

    fs.writeFileSync(SECRET_KEYPATH + 'sk_schedule', "");
    fs.writeFileSync(PUBLIC_KEYPATH + 'pk_schedule', "");

    for (var i = 0; i < number_of_keys; i++) {
        keypair = generateKeyPair();
        secret_key = keypair.secretKey;
        public_key = keypair.publicKey;

        start_date = new Date(start_date.setDate(start_date.getDate() + 1));
        validity = getValidityRange(start_date, start_date, 1);

        fs.appendFileSync(SECRET_KEYPATH + 'sk_schedule', new Date(validity.from) + "," + new Date(validity.until) + "," + buf2str(secret_key, 'hex') + '\n');
        fs.appendFileSync(PUBLIC_KEYPATH + 'pk_schedule', new Date(validity.from) + "," + new Date(validity.until) + "," + buf2str(public_key, 'hex') + '\n');
    }

    sendCurrentKeySchedule(null, null, false);
}

function sendCurrentKeySchedule(req, res, is_request=true) {
    schedule = Buffer.from(fs.readFileSync(PUBLIC_KEYPATH + 'pk_schedule')).toString();
    schedule = schedule.split('\n');

    key_schedule = {}
    keys = {};
    for (var i = 0; i < schedule.length; i++) {
        line = schedule[i].split(',')

        if (line != "") {
            from = line[0];
            to = line[1];
            key = line[2];

            cur_key = {};
            cur_key['valid_from'] = from;
            cur_key['valid_to'] = to;
            cur_key['public_key'] = key;

            keys["key" + (i+1)] = cur_key;
        }
    }
    key_schedule['keys'] = keys;
    key_schedule['signature'] = signRequest(keys);
    if (is_request) {
        res.json(key_schedule);
    } else {
        io.sockets.emit('update_img', key_schedule);
    }

}

function getNextSignKey() {
    schedule = Buffer.from(fs.readFileSync(SECRET_KEYPATH + 'sk_schedule')).toString();
    schedule = schedule.split('\n');

    next_key = schedule[0].split(',')[2];

    // delete current key from key schedule
    exec("sed -i '/" + next_key + "/d' " + SECRET_KEYPATH + 'sk_schedule', (err, stdout, stderr) => {
        if (err) {
            console.log(stderr);
        }
    })

    fs.writeFileSync(SECRET_KEYPATH + 'sign_key', next_key);
    SIGNING_KEY = str2buf(next_key, 'hex');

    console.log("NEW KEY: ", Buffer.from(SIGNING_KEY).toString('hex'));
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
    if (str) {
        var parts = str.split(delim);
        return new Date(parts[2], parts[1] - 1, parts[0]);
    } else {
        return new Date();
    }
}

function timeDifference(date1, date2) {
    var timeDiff = Math.abs(date2.getTime() - date1.getTime());
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
}
