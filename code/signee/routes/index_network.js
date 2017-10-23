var express = require('express');
var router = express.Router();
var request = require('request');

/* GET home page. */
router.get('/', function(req, res, next) {
  //res.render('index', { title: 'Network Index' });
});

/* Handle the POST request from the frontend when successfully read a QR-Code */
router.post('/', function (req, res) {

    // content of the qr-code read by the webcam
    var received_data = req.body.data;
    console.log("Received Data on localhost:4000\t" + received_data);

    // TODO: Do some stuff with the data

    var post_data = {
     "data": received_data
    };

   var options = {
     url: 'http://localhost:3000',
     method: 'POST',
     headers: {
       'Content-Type': 'application/json'
     },
     json: post_data
   };

   var end_data = '';

   request(options, function(err, response, body) {

       if (response && (response.statusCode === 200 || response.statusCode === 201)) {
           console.log(body);
       }
       res.end(body);
    });
});

module.exports = router;
