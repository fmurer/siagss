var express = require('express');
var router = express.Router();
var request = require('request');
var qr_generator = require('qrcode-generator');
var socketApi = require('../socketApi');

/* GET home page. */
router.get('/:net_data?', function(req, res, next) {
    var data = req.query.net_data;

    if (data) {
        res.render('index', { title: 'Normal Index', img_src: data.toString() });
    } else {
        res.render('index', { title: 'Normal Index', img_src: '' });
    }
});


router.post('/qr/', function(req, res) {
    var qrcode = req.body.qrcode;
});

/* Handle the POST request from the frontend when successfully read a QR-Code */
router.post('/', function (req, res) {

    var net_data = req.body.data;

    qr = qr_generator(0, 'L');
    qr.addData(net_data);
    qr.make();
    img_tag = qr.createImgTag(cellSize=8);

    socketApi.sendNotification(img_tag);
    /*
    var post_data = {
        'data': img_tag,
    };

    var options = {
        url: 'http://localhost:3000/qr/',
        method: 'POST',
        headers: {
        'Content-Type': 'application/json'
        },
        json: post_data

    };

   request(options, function(err, response, body) {
       // ignore response
    });
    */
});

module.exports = router;
