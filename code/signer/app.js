var express = require('express');
var bodyParser = require('body-parser');
var logger = require('morgan');
var curve = require('tweetnacl');
var crypto = require('crypto');
var fs = require('fs');
var scheduler = require('node-schedule');
var { exec, execSync } = require('child_process');
var ArgumentParser = require('argparse').ArgumentParser;
var constant = require('./constants.js');

var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);

app.use(express.static(__dirname + '/node_modules'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(logger('dev'));

var parser = new ArgumentParser({
    version: 'Signer: 1.0.0',
    addHelp: true,
    description: 'Signer'
});

parser.addArgument(
    [ '-p', '--port' ],
    {
        help: 'Port number on which the server listens. DEFAULT: 3000.'
    }
);

parser.addArgument(
    [ '-t', '--timespan' ],
    {
        help: 'Time (in ms) within all the administrators need to scan their verifier at initialisation. DEFAULT 1min.'
    }
);

var args = parser.parseArgs();

// Variables
var last_end_date;
var log_counter = 0;
var PORT = 3000;
if (args.port) {
    PORT = args.port;
}

SHARED_KEY = "";

// Variables used for initialisation
var initialised = false;
var init_stage = 1;
var N = 1;      // Number of participating administrators in initialisation
var t;      // quorum threshold
const TPM_KEY_PAIR = generateKeyPair();
const ENC_KEY_PAIR = curve.box.keyPair();
var first_init_msg = true;
var verifier_keys = {};
var timespan = 60000;
if (args.timespan) {
    timespan = args.timespan;
}
var answer_counter = 0;

// Variables used for key replication
var participating_ids = [];
var REPLICATION_KEY = '';
var first_rep_msg = true;
var sign_key_enc = '';

// Display TPM Public Key in order for everyone to scan it.
io.on('connection', (client) => {
    io.sockets.emit('show_tpm', Buffer.from(TPM_KEY_PAIR.publicKey).toString('base64'));    
});

/*
    handle requests
*/
app.get('/', function(req, res, next) {
    res.sendFile(__dirname + '/index.html');
});

app.post('/', function(req, res) {

    incoming_request = JSON.parse(req.body.qrcode);


    if (!initialised) {
        /*
         * SIGNER INITIALISATION
         *
         */

        if (!incoming_request.config && !incoming_request.nonce) {
            io.sockets.emit('clear_screen', null);
            io.sockets.emit('error', 'Please initialise the system first');
            return;
        }


        if (incoming_request.config && init_stage == 1) {
            var config = incoming_request.config;
            var pub_key = incoming_request.pub_key;

            if (first_init_msg) {
                N = config.N;
                t = config.t;
                first_init_msg = false;
                timeout = setTimeout(() => {
                    io.sockets.emit('clear_screen', null);
                    io.sockets.emit('warning', "There was a timeout. Please start over!");
                    first_init_msg = true;
                    verifier_keys = {};
                    crypt_log(constant.INIT, constant.TIME_EXCEEDED, 'pub:' + pub_key);
                }, timespan);
                io.sockets.emit('clear_screen', null);
            } else {
                if (config.N != N || config.t != t) {
                    res.end();
                    io.sockets.emit('clear_screen', null);
                    io.sockets.emit('error', "The configuration information is not consistent!");
                    crypt_log(constant.INIT, constant.CONSISTENCY_FAIL, 'pub:' + pub_key);
                    return;
                }
            }
            
            var length = Object.keys(verifier_keys).length;
            if (length < N) {
                if (!verifier_keys.hasOwnProperty(pub_key)) {
                    verifier_keys[pub_key] = length+1;
                } else {
                    res.end();
                    io.sockets.emit('clear_screen', null);
                    io.sockets.emit('error', 'You have already registered!');
                    crypt_log(constant.INIT, constant.DOUBLE_REG, 'pub:' + pub_key);
                    return;
                }
            } 

            // we have received init from every administrator and all have been consistent
            if (Object.keys(verifier_keys).length == N) {
                clearTimeout(timeout);
                keypair = generateKeyPair();

                crypt_log(constant.NEW_KEY_PAIR, constant.SUCCESS, 'pub:' + Buffer.from(keypair.publicKey).toString('base64'));

                SIGNING_KEY = keypair.secretKey;
                PUBLIC_KEY = keypair.publicKey;

                fs.writeFileSync(constant.SECRET_KEYPATH + 'sign_key', buf2str(SIGNING_KEY, 'base64'));
                fs.writeFileSync(constant.PUBLIC_KEYPATH + 'signer.pub', buf2str(PUBLIC_KEY, 'base64'));
                res.end();
                io.sockets.emit('clear_screen', null);
                io.sockets.emit('success', 'Please send now your nonces!');

                console.log(verifier_keys);
                init_stage = 2;
            }
        }

        if (init_stage == 2) {
            if (incoming_request.nonce) {
                io.sockets.emit('clear_screen', null);
                nonce = incoming_request.nonce;
                sig = incoming_request.signature;

                verified = false;
                correct_key = "";
                for(var key in verifier_keys) {

                    if (verifySignature(str2buf(nonce, 'base64'), sig, str2buf(key, 'base64'))) {
                        verified = true;
                        correct_key = key;
                        break;
                    }
                }

                if (verified) {
                    response = {};

                    response['id'] = verifier_keys[correct_key];
                    response['admin_keys'] = verifier_keys;
                    response['pub_key'] = buf2str(PUBLIC_KEY, 'base64');
                    response['enc_key'] = buf2str(ENC_KEY_PAIR.publicKey, 'base64');
                    response['nonce'] = nonce;

                    to_hash = {};
                    to_hash['pub_key'] = response['pub_key'];
                    to_hash['N'] = N;
                    to_hash['t'] = t;
                    to_hash['admin_keys'] = response['admin_keys'];
                    hash = crypto.createHash('sha256')
                    hash.update(JSON.stringify(to_hash));

                    response['hash'] = hash.digest().toString('base64'); // todo

                    to_sign = {};
                    to_sign['nonce'] = response['nonce'];
                    to_sign['hash'] = response['hash'];

                    response['signature'] = signRequest(to_sign, TPM_KEY_PAIR.secretKey);

                    answer_counter++;
                    res.json(response);
                }  else {
                    res.end();
                    io.sockets.emit('error', 'Your nonce could not be authenticated.');

                    crypt_log(constant.INIT, constant.SIG_VERIF_FAIL, 'sig:' + sig);
                    return;
                }

                if (answer_counter == N) {
                    initialised = true;

                    // write public keys to file
                    fs.writeFileSync(constant.VERIFIER_PUB_KEY_FILE, "");
                    for (var key in verifier_keys) {
                        fs.appendFileSync(constant.VERIFIER_PUB_KEY_FILE, key);
                    }

                    crypt_log(constant.INIT, constant.SUCCESS);
                }
            }
        }
    } else {

        if (incoming_request.replication_key) {
            /*
             * SIGNER REPLICATION
             *
             */
            rep_key = incoming_request.replication_key;
            id = incoming_request.id;
            sig = incoming_request.signature;

            var included = false;
            var verified = false;
            for (var key in verifier_keys) {
                if (verifier_keys[key] == id) {
                    included = true;

                    to_verify = {
                        'replication_key': rep_key,
                        'id': id
                    };

                    if (verifySignature(json2buf(to_verify, 'ascii'), sig, str2buf(key, 'base64'))) {    
                        verified = true;
                    }
                    break;
                }
            }
            if (!included) {
                res.end();
                io.sockets.emit('error', 'You are not a registerd administrator!');
                crypt_log(constant.KEY_REP, constant.WRONG_ID, 'id:' + id);
                return;
            }
            if (!verified) {
                res.end();
                io.sockets.emit('error', 'Your signature could not be verified!');
                crypt_log(constant.KEY_REP, constant.SIG_VERIF_FAIL, 'id:' + id + " sig:" + sig);
                return;
            }

            if (first_rep_msg) {
                REPLICATION_KEY = rep_key;
                first_rep_msg = false;
                timeout = setTimeout(() => {
                    io.sockets.emit('warning', "There was a timeout. Please start over!");
                    first_rep_msg = true;
                    participating_ids = [];
                    crypt_log(constant.KEY_REP, constant.TIME_EXCEEDED);
                }, timespan);
            }

            if (rep_key != REPLICATION_KEY) {
                res.end();
                io.sockets.emit('error', 'Messages are not consistent!');
                crypt_log(constant.KEY_REP, constant.CONSISTENCY_FAIL, 'id:' + id);
                return;
            } else {
                if (!participating_ids.includes(id)) {
                    participating_ids.push(id);
                } else {
                    res.end();
                    io.sockets.emit('error', 'You already have submitted your message');
                    crypt_log(constant.KEY_REP, constant.DOUBLE_SUBMIT, 'id:' + id);
                    return;
                }
            }

            if (participating_ids.length >= t) {
                nonce = crypto.randomBytes(24).toString('base64');

                to_send = {
                    'nonce': nonce,
                    'encrypted_key': Buffer.from(encryptData(SIGNING_KEY, str2buf(nonce, 'base64'), str2buf(REPLICATION_KEY, 'base64'), ENC_KEY_PAIR.secretKey)).toString('base64')
                }
                signature = signRequest(to_send, SIGNING_KEY);

                to_send['signature'] = signature;

                res.json(to_send);
                clearTimeout(timeout);
                participating_ids = [];
                first_rep_msg = true;
                crypt_log(constant.KEY_REP, constant.SUCCESS);
            }

            return;
        }

        if (incoming_request.encrypted_key) {
            /*
             * SIGNER REPLICATION OPPOSED PART
             *
             */
            enc = incoming_request.encrypted_key;
            nonce = incoming_request.nonce;
            pub_key = incoming_request.pub_key;
            sig = incoming_request.signature;

            to_check = {
                'pub_key': pub_key,
                'nonce': nonce,
                'encrypted_key': enc
            };

            verified = false;
            correct_key = "";
            for(var key in verifier_keys) {
                if (verifySignature(json2buf(to_check, 'ascii'), sig, str2buf(key, 'base64'))) {
                    verified = true;
                    correct_key = key;
                    break;
                }
            }

            if (!verified) {
                res.end();
                io.sockets.emit('error', 'Could not verify the message. Seems you are not registered!');
                return;
            }

            if (first_rep_msg) {
                sign_key_enc = enc;
                first_rep_msg = false;
                timeout = setTimeout(() => {
                    io.sockets.emit('warning', "There was a timeout. Please start over!");
                    first_rep_msg = true;
                    participating_ids = [];
                }, timespan);
            }

            if (enc != sign_key_enc) {
                res.end();
                io.sockets.emit('error', 'The messages have not been consistent!');
                return;
            } else {
                id = verifier_keys[correct_key];
                if (!participating_ids.includes(id)) {
                    participating_ids.push(id);
                } else {
                    res.end();
                    io.sockets.emit('error', 'You already have submitted your message');
                    return;
                }
            }

            if (participating_ids.length >= t) {
                
                tmp_key = decryptData(str2buf(enc, 'base64'), str2buf(nonce, 'base64'), str2buf(pub_key, 'base64'), ENC_KEY_PAIR.secretKey);

                if (tmp_key) {
                    SIGNING_KEY = tmp_key;
                    fs.writeFileSync(constant.SECRET_KEYPATH + 'sign_key', buf2str(SIGNING_KEY, 'base64'));
                    res.end();
                    io.sockets.emit('success', 'Key Replication Done!');
                } else {
                    res.end();
                    io.sockets.emit('error', 'Could not decrypt the key');
                    return;
                }

                clearTimeout(timeout);
                participating_ids = [];
                first_rep_msg = true;
            }

            return;
        }   
             
        if (incoming_request.epoch) {
            // log verification
            verifyLog(incoming_request, res);
            return;
        }

        if (incoming_request.signee_key) {
            pairSystems(req, res);
            return;
        }

        if (incoming_request.new_schedule) {
            if (incoming_request.initial) {
                generateNewKeySchedule(3);
                sendCurrentKeySchedule(true);
            } else {
                sendCurrentKeySchedule();
            }
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

        var num_entries = Object.keys(data).length;

        // check if the data is correct, i.e. not altered and coming from the signee
        if (!verifyAuth(JSON.stringify(data), auth)) {

            crypt_log("Sign a Request", 'request verification failed', '');

            var error = {};
            var ids = {};
            
            for (var i = 0; i < num_entries; i++) {
                ids[i] = data[i]['id'];
            }

            error['error'] = 'There has been an error! The authentication token could not be verified';
            error['ids'] = ids;
            res.json(error);
            return;
        }

        var responses = {};

        for (var i = 0; i < num_entries; i++) {
            var assertion = {};
            var cur_data = data[i];

            from = toDate(cur_data['from']);
            to = toDate(cur_data['to']);
            var validity = getValidityRange(from, to);

            assertion['data'] = cur_data['data'];
            assertion['valid_from'] = validity.from;
            assertion['valid_until'] = validity.until;

            var signature = signRequest(assertion, SIGNING_KEY);  

            responses[i] = {};
            responses[i]['id'] = cur_data['id'];
            responses[i]['assertion'] = assertion;
            responses[i]['signature'] = signature;  
        }

        var response = {};
        response['data'] = responses;
        response['auth'] = generateAuthToken(JSON.stringify(responses));
        

        // send back response to the ajax success function which will then generate the qr code.
        res.json(response);
    }
});

server.listen(PORT);

crypt_log(constant.STARTUP, constant.SUCCESS);

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

            crypt_log("Pairing", 'authentication failed', '');
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

    SHARED_KEY = shared_key;
    console.log(SHARED_KEY);

    fs.writeFileSync(constant.SECRET_KEYPATH + 'auth_key', SHARED_KEY);

    res.json(dh_exchange);

}

function verifyLog(data, res) {
    epoch = data.epoch;
    nonce = data.nonce;
    sig = data.signature;

    to_verify = {
        'epoch': epoch,
        'nonce': nonce
    };


    verified = false;
    correct_key = "";
    for(var key in verifier_keys) {
        if (verifySignature(json2buf(to_verify, 'ascii'), sig, str2buf(key, 'base64'))) {
            verified = true;
            correct_key = key;
            break;
        }
    }

    if (!verified) {
        res.end();
        io.sockets.emit('error', 'Verification failed');
        return;
    }

    latest_epoch = Buffer.from(fs.readFileSync(constant.LOG_HASH)).toString();

    logs = getLogs(epoch);

    response = {
        'latest_epoch': latest_epoch,
        'nonce': nonce,
        'logs': logs
    }

    signature = signRequest(response, SIGNING_KEY);

    response['signature'] = signature;

    res.json(response);
    return;
}


function getLogs(epoch) {
    var line = '';

    if (epoch != "-1") {
        line = Buffer.from(execSync("grep -i '" + epoch + "' " + constant.LOG_COUNTER_FILE)).toString();
	line = line.split(',')[0] + 1;
    } else {
        line = 1;
    }
    

    var logs = execSync("awk 'NR>=" + line + "' " + constant.LOG_FILE);
    logs = new Buffer(logs).toString('base64');
    
    return logs;
}

/*
    This function signs the reqeust using the SIGNING_KEY
    * data:     The data that needs to be signed

    The function returns the signature of the message
*/
function signRequest(data, sign_key) {
    console.time('signing_time');
    var signature = curve.sign.detached(json2buf(data, encoding='ascii'), sign_key);
    signature = Buffer.from(signature).toString('base64');
    console.timeEnd('signing_time');

    return signature;
}

function signRequestBox(data, sign_key) {
    return Buffer.from(curve.sign(data, sign_key)).toString('base64');
}

function encryptData(data, nonce, theirPubKey, mySecretKey) {
    curve.box.publicKeyLength = 32;
    curve.box.secretKeyLength = 64;
    var enc = curve.box(data, nonce, theirPubKey, mySecretKey);
    return enc;
}

function decryptData(data, nonce, theirPubKey, mySecretKey) {
    curve.box.publicKeyLength = 32;
    curve.box.secretKeyLength = 64;
    var dec = curve.box.open(data, nonce, theirPubKey, mySecretKey);
    return dec;
}

/*
    This funciton generates an authentication token by computing a HMAC of the message
    * msg:     Message which we want to send.
*/
function generateAuthToken(msg) {
    hmac = crypto.createHmac('sha256', SHARED_KEY);
    hmac.update(msg);
    var token = hmac.digest('base64');

    return token;
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
    return auth_token == hmac.digest('base64');
}

/*
    This function verifies the signature of the response. If the verification is successful, it returns true otherwise false.
*/
function verifySignature(msg, signature, pub_key) {
    //return curve.sign.detached.verify(str2buf(msg, 'ascii'), str2buf(signature, 'base64'), pub_key);
    return curve.sign.detached.verify(msg, str2buf(signature, 'base64'), pub_key);
}

function verifySignatureBox(signature, pub_key) {
    return curve.sign.open(str2buf(signature, 'base64'), pub_key);
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

    if (last_end_date) {
        start_date = last_end_date;
    } else {
        start_date = new Date();
        start_date = new Date(start_date.setTime(start_date.getTime() + 2 * 60000));    
    }
    
    fs.writeFileSync(constant.SECRET_KEYPATH + 'sk_schedule', "");
    fs.writeFileSync(constant.PUBLIC_KEYPATH + 'pk_schedule', "");

    for (var i = 0; i < number_of_keys; i++) {
        keypair = generateKeyPair();
        secret_key = keypair.secretKey;
        public_key = keypair.publicKey;


        /*
        start_date = new Date(start_date.setDate(start_date.getDate() + 1));
        validity = getValidityRange(start_date, start_date, 'day', 1);
        */
        //start_date = new Date(start_date.setTime(start_date.getTime() + 2 * 60000));
        validity = getValidityRange(start_date, start_date, 'minute', 2);

        fs.appendFileSync(constant.SECRET_KEYPATH + 'sk_schedule', new Date(validity.from) + "," + new Date(validity.until) + "," + buf2str(secret_key, 'base64') + '\n');
        fs.appendFileSync(constant.PUBLIC_KEYPATH + 'pk_schedule', new Date(validity.from) + "," + new Date(validity.until) + "," + buf2str(public_key, 'base64') + '\n');

        // add job to scheduler
        var new_job = scheduler.scheduleJob(new Date(validity.from), () => {
            getNextSignKey();
        });

        start_date = new Date(start_date.setTime(start_date.getTime() + 2 * 60000));
    }

    last_end_date = new Date(validity.until);

    // schedule job for creating next key schedule
    var new_job = scheduler.scheduleJob((new Date(validity.until)).getTime() - 40000, () => {
        generateNewKeySchedule(3);
    });

}

function sendCurrentKeySchedule(initial) {
    schedule = Buffer.from(fs.readFileSync(constant.PUBLIC_KEYPATH + 'pk_schedule')).toString();
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
    if (initial) {
        key_schedule['pub_key'] = buf2str(PUBLIC_KEY, 'base64');
    }
    key_schedule['keys'] = keys;
    key_schedule['signature'] = signRequest(keys, SIGNING_KEY);

    io.sockets.emit('update_img', key_schedule);    

}

function getNextSignKey() {
    schedule = Buffer.from(fs.readFileSync(constant.SECRET_KEYPATH + 'sk_schedule')).toString();

    // if there are keys left in the keyschedule
    if (schedule != "") {
        schedule = schedule.split('\n');
        new_line = schedule[0].split(',');

        from = new Date(new_line[0]);
        to = new Date(new_line[1]);

        next_key = new_line[2];

        // delete current key from key schedule
        exec("sed -i '/" + next_key.split('\/').join('\\\/') + "/d' " + constant.SECRET_KEYPATH + 'sk_schedule', (err, stdout, stderr) => {
            if (err) {
                console.log(stderr);
            }
        })

        fs.writeFileSync(constant.SECRET_KEYPATH + 'sign_key', next_key);
        SIGNING_KEY = str2buf(next_key, 'base64');

        console.log("[***] NEW SIGNING KEY: ", Buffer.from(SIGNING_KEY).toString('base64'));

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

function crypt_log(operation, success, information='') {
    var date = new Date();
    var datetime = date.getDate() + "/"
                + (date.getMonth()+1)  + "/" 
                + date.getFullYear() + " @ "  
                + ((date.getHours() < 10) ? "0" + date.getHours() : date.getHours()) + ":"  
                + ((date.getMinutes() < 10) ? "0" + date.getMinutes() : date.getMinutes()) + ":" 
                + ((date.getSeconds() < 10) ? "0" + date.getSeconds() : date.getSeconds());

    var new_log_entry = datetime + '||' + operation + "||" + success + ((information != '') ? '||' + information : '');
    fs.appendFileSync(constant.LOG_FILE, new_log_entry + "\n");

    try{
        var old_hash = Buffer.from(fs.readFileSync(constant.LOG_HASH)).toString();    
    } catch (e) {
        var old_hash = "";
    }
    
    var agr_hash = crypto.createHash('sha256');
    agr_hash.update(old_hash + new_log_entry);
    var new_hash = agr_hash.digest('hex');

    fs.writeFileSync(constant.LOG_HASH, new_hash);

    fs.appendFileSync(constant.LOG_COUNTER_FILE, ++log_counter + "," + new_hash + "\n");
}
