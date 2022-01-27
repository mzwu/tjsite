#!/usr/bin/nodejs

// initialize express and app class object
var express = require('express');
const { AuthorizationCode } = require('simple-oauth2');
var app = express();

// initialize handlebars templating engine
var hbs = require('hbs');
app.set('view engine', 'hbs');

var https = require('https');
app.set('trust proxy', 1); // trust first proxy

// initialize mysql
var mysql = require('mysql');

var cookieParser = require('cookie-parser');
app.use(cookieParser());

// initialize the built-in library 'path'
var path = require('path');
console.log(__dirname);
app.use(express.static(path.join(__dirname, 'static')));

// -------------- mysql initialization -------------- //
// USE PARAMETERS FROM DIRECTOR DOCS!!!
var sql_params = {
  connectionLimit : 10,
  user            : process.env.DIRECTOR_DATABASE_USERNAME,
  password        : process.env.DIRECTOR_DATABASE_PASSWORD,
  host            : process.env.DIRECTOR_DATABASE_HOST,
  port            : process.env.DIRECTOR_DATABASE_PORT,
  database        : process.env.DIRECTOR_DATABASE_NAME
};

var pool  = mysql.createPool(sql_params);

app.get('/', function(req, res){
    res.render('home');
});

app.get('/labs', function(req, res){
    res.render('labs');
});

app.get('/form', function(req, res){
    res.render('form');
});

app.get('/madlib', function(req, res){
    const {f_name, f_age, f_cont, f_food, f_subj, f_animal} = req.query;
    var params = {
        'name' : f_name,
        'age' : f_age,
        'cont' : f_cont,
        'food' : f_food,
        'subj' : f_subj,
        'animal' : f_animal
    };
    res.render('madlib', params);
});

const house = require('./controllers/house_points.js');
app.use(house);

const profile = require('./controllers/profile.js');
app.use(profile);

const cookie_clicker = require('./controllers/cookie_clicker.js');
app.use(cookie_clicker);

const weather = require('./controllers/weather.js');
app.use(weather);

const voting = require('./controllers/voting.js');
app.use(voting);

const map = require('./controllers/map.js');
app.use(map);

const numbers = require('./controllers/numbers.js');
app.use(numbers);

// listener - keeps node 'alive.'
var listener = app.listen(process.env.PORT || 8080, process.env.HOST || "0.0.0.0", function() {
    console.log("Express server started");
});