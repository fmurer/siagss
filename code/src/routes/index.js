var express = require('express');
var router = express.Router();


/* GET home page. */
router.get('/', function(req, res, next) {
    qrcode = '';

    if (req.query.qrcode) {
        qrcode = decodeURIComponent(req.query.qrcode);
    }

    res.render('index', { title: 'Express', qrcode: qrcode.toString() });
    //console.log('QR-Code: ' + qrcode);
    //console.log(req.query);
});


router.post('/', function (req, res) {
    console.log(req.body.qrcode);
    var qrcode = req.body.qrcode;

    res.json('YEEEEEEES');

});


module.exports = router;
