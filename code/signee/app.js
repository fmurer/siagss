// app.js
var express = require('express');
var bodyParser = require('body-parser');
var qr_generator = require('qrcode-generator');
var logger = require('morgan');


/*
    SERVER 1, responsible to interact with the browser
*/
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);

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
    var qr_code = req.body.qrcode;

    console.log(qr_code);
});


/*
    Socket IO stuff
*/

var connected_users;

io.on('connection', function(client) {
    connected_users = {};
    var clientID = client.conn.id;
    connected_users[clientID] = client;
});

server.listen(3000);


/*
    SERVER 2, responsible to communicate with the network
*/
var app_network = express();
var server_network = require('http').createServer(app_network);

app_network.use(express.static(__dirname + '/node_modules'));
app_network.use(bodyParser.json());
app_network.use(bodyParser.urlencoded({ extended: false }));


app_network.post('/', function(req, res) {

    // get the data received from the network
    var network_data = req.body.data;

    // generate the qr-code
    console.time('signee_generate_time');
    var qr = qr_generator(0, 'L');
    qr.addData(network_data);
    qr.make();

    var img_tag = qr.createImgTag(cellSize=12);
    console.timeEnd('signee_generate_time');
    
    // notify the browser which then sets the qr-code
    io.sockets.emit('update_img', img_tag);

    var last_id = (last=Object.keys(connected_users))[last.length-1];
    var client = connected_users[last_id];

    // handle the answer once a new qr-code has been scanned.
    client.on('answer', function(data) {
        res.end(data);
    });

});

server_network.listen(3001);
