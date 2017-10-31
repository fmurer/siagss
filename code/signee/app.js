// app.js
var express = require('express');
var bodyParser = require('body-parser');
var logger = require('morgan');
var crypto = require('crypto');
var fs = require('fs');

var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);

app.use(express.static(__dirname + '/node_modules'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(logger('dev'));


/*
    Socket IO stuff
*/

var connected_users;

io.on('connection', function(client) {
    connected_users = {};
    var clientID = client.conn.id;
    connected_users[clientID] = client;
});


/*
    handle requests
*/
app.get('/', function(req, res,next) {
    res.sendFile(__dirname + '/index.html');
});

app.post('/', function(req, res) {
    // get the data received from the network
    var network_data = req.body.data;

    var data_to_send = {};
    data_to_send['data'] = network_data;
    // TODO: compute HMAC of network_data
    data_to_send['mac'] = '';

    // notify the browser which then sets the qr-code
    io.sockets.emit('update_img', JSON.stringify(data_to_send));

    var last_id = (last=Object.keys(connected_users))[last.length-1];
    var client = connected_users[last_id];

    // handle the answer once a new qr-code has been scanned.
    client.on('answer', function(data) {
        // TODO: handle response, i.e. check HMAC_OF_MSG
        res.end(data);
    });

});

server.listen(3000);
