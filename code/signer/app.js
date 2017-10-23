// app.js
var express = require('express');
var bodyParser = require('body-parser');
var qr_generator = require('qrcode-generator');
var logger = require('morgan');


var app = express();
var server = require('http').createServer(app);

app.use(express.static(__dirname + '/node_modules'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(logger('dev'));

/*
    handle requests
*/
app.get('/', function(req, res,next) {
    res.sendFile(__dirname + '/index.html');
});

app.post('/', function(req, res) {
    // content of the qr-code read by the webcam
    var data = req.body.qrcode;

    // TODO: Do some stuff with the data

    var response = data + "1";

    // generate the QR-Code
    //var qr = qr_generator(0, 'L');
    //qr.addData(response);
    //qr.make();

    // send back the new generated QR-Code
    //res.json(qr.createImgTag(cellSize=8));

    // use the jquery qrcode and let the browser do the generation -> much faster
    res.json(response);
});

server.listen(3000);
