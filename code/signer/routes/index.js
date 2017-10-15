var express = require('express');
var qr_generator = require('qrcode-generator');
var router = express.Router();


/* GET home page. */
router.get('/', function(req, res, next) {
    res.render('index', { title: 'Signing System'});
});

/* Handle the POST request from the frontend when successfully read a QR-Code */
router.post('/', function (req, res) {

    // content of the qr-code read by the webcam
    var data = req.body.qrcode;

    // TODO: Do some stuff with the data

    var response = "I really hope this workedI really hope this workedI really hope this workedI really hope this workedI really hope this workedI really hope this workedI really hope this workedI really hope this workedI really hope this workedI really hope this workedI really hope this workedI really hope this workedI really hope this workedI really hope this workedI really hope this workedI really hope this workedI really hope this workedI really hope this workedI really hope this workedI really hope this workedI really hope this workedI really hope this workedI really hope this workedI really hope this workedI really hope this worked";

    // generate the QR-Code
    var qr = qr_generator(0, 'L');
    qr.addData(response);
    qr.make();

    // send back the new generated QR-Code
    res.json(qr.createImgTag(cellSize=8));

});


module.exports = router;
