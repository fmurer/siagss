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
    var data = str2buf(req.body.qrcode);

    // sign the incoming request
    var response = curve.sign(data, keyPair.secretKey);

    // we need to convert it into a string in order to properly generate a QR-code out of it.
    response = buf2str(response);

    // send back response to the ajax success function which will then generate the qr code.
    res.json(response);
});

server.listen(3000);


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
    return String.fromCharCode.apply(null, new Uint8Array(buffer));
}

function str2buf(str) {
    var buffer = new ArrayBuffer(str.length*2); // 2 bytes for each char
    var uint8array = new Uint8Array(buffer);
    var strLen=str.length;

    for (var i=0; i < strLen; i++) {
        uint8array[i] = str.charCodeAt(i);
    }
    return uint8array;
}
