var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var index = require('./routes/index_network');

var app_network = express();

// view engine setup
app_network.set('views', path.join(__dirname, 'views'));
app_network.set('view engine', 'ejs');

// uncomment after placing your favicon in /public
//app_network.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app_network.use(logger('dev'));
app_network.use(bodyParser.json());
app_network.use(bodyParser.urlencoded({ extended: false }));
app_network.use(cookieParser());
app_network.use(express.static(path.join(__dirname, 'public')));

app_network.use('/', index);

// catch 404 and forward to error handler
app_network.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app_network.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app_network;
