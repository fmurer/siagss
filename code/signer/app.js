var express = require('express');
var bodyParser = require('body-parser');
var logger = require('morgan');
var curve = require('tweetnacl');
var crypto = require('crypto');
var fs = require('fs');
var scheduler = require('node-schedule');
var { exec } = require('child_process');

var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);

app.use(express.static(__dirname + '/node_modules'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(logger('dev'));


var scheduled_events = [];
var request_queue = [];
var seconds = [];

/*
    Handling Schedule
*/
for (var i =  0; i<60; i++) {
    seconds[i] = i;
}
num_per_sec = 8;
scheduler.scheduleJob({second: seconds}, () => {
    launchRequest();
    
    step = 1000/num_per_sec;

    for (var i = 0; i < num_per_sec; i++) {
        time = step + i*step;
        setTimeout(() => {
            launchRequest();
        }, time);
    }

});


// create new key schedule every 6 minutes. This hardly depends on how long a key is valid
// currently this is every 3*validity
/*
var new_key_schedule_rule = new scheduler.RecurrenceRule();
new_key_schedule_rule.minute = [0, 6, 12, 18, 24, 36, 42, 48, 54];

scheduler.scheduleJob(new_key_schedule_rule, () => {
    console.log("[***] Generate new Key Schedule");
    generateNewKeySchedule(3);
});
*/

const SECRET_KEYPATH = __dirname + '/sk/';
const PUBLIC_KEYPATH = __dirname + '/pk/';

var SHARED_KEY = fs.readFileSync(SECRET_KEYPATH + 'auth_key');
var SIGNING_KEY = Buffer.from(fs.readFileSync(SECRET_KEYPATH + 'sign_key')).toString();
SIGNING_KEY = str2buf(SIGNING_KEY, 'hex');

// Signee needs to know this public key in order to authenticate the key schedule.
generateNewKeySchedule(3);


/*
    handle requests
*/
app.get('/', function(req, res, next) {
    res.sendFile(__dirname + '/index.html');
});

app.post('/', function(req, res) {
    incoming_request = JSON.parse(req.body.qrcode);

    if (incoming_request.signee_key) {
        pairSystems(req, res);
        return;
    }

    if (incoming_request.new_schedule) {

        request = {};
        request['data'] = incoming_request;
        request['res'] = res;
        //sendCurrentKeySchedule();
        request_queue.unshift(request);
        return;
    }

    request = {};
    request['data'] = incoming_request;
    request['response'] = res;

    request_queue.push(request);
});

server.listen(3000);


function launchRequest() {
    var new_request = request_queue.shift();
    if (new_request) {
        requestHandler(new_request.data, new_request.response);
    }
}

function requestHandler(incoming_request, res) {
    
    if (incoming_request.new_schedule) {
        sendCurrentKeySchedule(res);
        return;
    }

    if (incoming_request.ack) {
        if (verifyAuth(JSON.stringify(incoming_request.ack)), incoming_request.auth) {
            res.end('acknowledged');
            return;
        } else {
            res.end();
            return;
        }
    }

    var data = incoming_request.data;
    var auth = incoming_request.auth;

    // check if the data is correct, i.e. not altered and coming from the signee
    if (!verifyAuth(JSON.stringify(data), auth)) {
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
}

/*
    This function handles the pairing of the two systems, i.e., establishing a new shared secret for authentication
    * req:      original request
    * res:      original response (where to send the answer back)

    This function is called when we receive the Diffie-Hellman half key of the signee. Then we also compute our own
    half key and send it to the singee. With the two half keys we compute the new shared key and write it to the file 'auth_key'
*/
function pairSystems(req, res) {

    console.log("PAIRING");

    var data = JSON.parse(req.body.qrcode);

    if (data.auth) {
        if (!verifyAuth(data.signee_key, data.auth)) {
            console.log("[!!!] ERROR: Pairing failed due to incorrect authentication!");
            console.log("[!!!] --> Keep old shared key");
            return;
        }
    }

    var dh = crypto.createECDH('secp521r1');
    var signer_key = dh.generateKeys('hex', 'compressed');

    var shared_key = dh.computeSecret(data.signee_key, 'hex', 'hex');

    var dh_exchange = {};
    dh_exchange['signer_key'] = signer_key;

    if (SHARED_KEY != "") {
        dh_exchange['auth'] = generateAuthToken(signer_key);
    }

    SHARED_KEY = shared_key
    console.log(SHARED_KEY);
    fs.writeFileSync(SECRET_KEYPATH + 'auth_key', SHARED_KEY);
    
    //res.json(dh_exchange);
    response = {};
    response['data'] = dh_exchange;
    respnose['response'] = res;

    request_queue.unshift(response);
}

/*
    This function signs the reqeust using the SIGNING_KEY
    * data:     The data that needs to be signed

    The function returns the signature of the message
*/
function signRequest(data) {
    console.time('signing_time');
    var signature = curve.sign.detached(json2buf(data, encoding='ascii'), SIGNING_KEY);
    signature = Buffer.from(signature).toString('hex');
    console.timeEnd('signing_time');
    return signature;
}

/*
    This funciton generates an authentication token by computing a HMAC of the message
    * msg:     Message which we want to send.
*/
function generateAuthToken(msg) {
    hmac = crypto.createHmac('sha256', SHARED_KEY);
    hmac.update(msg);
    return hmac.digest('hex');
}

/*
    This function verifies the authentication token of the signee
    * msg:        message that is autheticated
    * auth_token: hmac of the message

    The function returns true if the authentication was successful otherwise false
*/
function verifyAuth(msg, auth_token) {
    hmac = crypto.createHmac('sha256', SHARED_KEY);
    hmac.update(msg);
    return auth_token == hmac.digest('hex');
}

/*
    This funciton computes a validity range of a signature
    * startdate:    the start date provided by the request
    * enddate:      the end date provided by the reqeust
    * max_duration: How long can a signature be valid at max in days? Default 20 days.
*/
function getValidityRange(startdate, enddate, type, max_duration=20) {
    validity = {};
    var today = new Date();

    // no start date in the past
    if (startdate < today) {
        startdate = today;
    }

    var valid_from = startdate;
    var valid_until = new Date();

    var diff = timeDifference(startdate, enddate, type);

    if ( diff < max_duration && diff > 0 ) {
        valid_until = enddate;
    } else {
        switch (type) {
            case 'minute':
                valid_until = new Date(valid_until.setTime(valid_from.getTime() + (max_duration * 60000))); 
                break;
            case 'hour':
                valid_until = new Date(valid_until.setTime(valid_from.getTime() + (max_duration * 60000 * 60))); 
                break;   
            default:
                valid_until = new Date(valid_until.setDate(valid_from.getDate() + max_duration));
                break;
        }
    }

    validity['from'] = Date.parse(valid_from.toUTCString());
    validity['until'] = Date.parse(valid_until.toUTCString());

    return validity;
}

/*
    This function generates a new key pair
*/
function generateKeyPair() {
    
    curve.sign.publicKeyLength = 32;
    curve.sign.secretKeyLength = 64;
    curve.sign.seedLength = 32;
    curve.sign.signatureLength = 64;
    
    return curve.sign.keyPair();
}

function generateNewKeySchedule(number_of_keys=10) {

    scheduled_events = [];
    var start_date = new Date();

    fs.writeFileSync(SECRET_KEYPATH + 'sk_schedule', "");
    fs.writeFileSync(PUBLIC_KEYPATH + 'pk_schedule', "");

    for (var i = 0; i < number_of_keys; i++) {
        keypair = generateKeyPair();
        secret_key = keypair.secretKey;
        public_key = keypair.publicKey;

        /*
        start_date = new Date(start_date.setDate(start_date.getDate() + 1));
        validity = getValidityRange(start_date, start_date, 'day', 1);
        */
        start_date = new Date(start_date.setTime(start_date.getTime() + 2 * 60000));
        validity = getValidityRange(start_date, start_date, 'minute', 2);

        fs.appendFileSync(SECRET_KEYPATH + 'sk_schedule', new Date(validity.from) + "," + new Date(validity.until) + "," + buf2str(secret_key, 'hex') + '\n');
        fs.appendFileSync(PUBLIC_KEYPATH + 'pk_schedule', new Date(validity.from) + "," + new Date(validity.until) + "," + buf2str(public_key, 'hex') + '\n');

        // add job to scheduler
        var new_job = scheduler.scheduleJob(new Date(validity.from), () => {
            getNextSignKey();
            scheduled_events.shift();
        });
        scheduled_events.push(new_job);
    }

    // schedule job for creating next key schedule
    var new_job = scheduler.scheduleJob((new Date(validity.until)).getTime() - 65000, () => {
        generateNewKeySchedule(3);
    });
    scheduled_events.push(new_job);
}

function sendCurrentKeySchedule(res) {
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

    //io.sockets.emit('update_img', key_schedule);    
    res.json(key_schedule);
}

function getNextSignKey() {
    schedule = Buffer.from(fs.readFileSync(SECRET_KEYPATH + 'sk_schedule')).toString();

    // if there are keys left in the keyschedule
    if (schedule != "") {
        schedule = schedule.split('\n');
        new_line = schedule[0].split(',');

        from = new Date(new_line[0]);
        to = new Date(new_line[1]);

        next_key = new_line[2];

        // delete current key from key schedule
        exec("sed -i '/" + next_key + "/d' " + SECRET_KEYPATH + 'sk_schedule', (err, stdout, stderr) => {
            if (err) {
                console.log(stderr);
            }
        })

        fs.writeFileSync(SECRET_KEYPATH + 'sign_key', next_key);
        SIGNING_KEY = str2buf(next_key, 'hex');

        console.log("[***] NEW SIGNING KEY: ", Buffer.from(SIGNING_KEY).toString('hex'));
    } else {
        console.log("[***] No keys in the key schedule. Keep old PUBLIC KEY!");
    }
    
}

function isValid(from, to) {
    var today = Date();

    return (today >= from && today < to);
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

function timeDifference(date1, date2, type) {
    var timeDiff = Math.abs(date2.getTime() - date1.getTime());
    switch (type) {
        case 'minute':
            return Math.ceil(timeDiff / (1000 * 60));
        case 'hour':
            return Math.ceil(timeDiff / (1000 * 60 * 60));
        default:
            return Math.ceil(timeDiff / (1000 * 3600 * 24));
    }
}
