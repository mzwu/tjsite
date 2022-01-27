const express = require('express');
const router = express.Router({ strict: true });

// import statement
var  https = require('https');

//var url = 'https://api.weather.gov/points/42.9356,-78.8692'
//var url = 'https://api.weather.gov/gridpoints/BUF/35,47/forecast/hourly'
var options =  { headers : {
		'User-Agent': 'request'
	}
};

router.get('/weather', function(req, res){
    res.render('weather_form');
});

router.get('/getweather', function(req, res, next){
    const {f_lat, f_long} = req.query;
    var lat = parseInt(f_lat).toString();
    var long = parseInt(f_long).toString();
    var params = {
        'lat' : lat,
        'long' : long
    };
    res.locals.params = params;
    if(isNaN(lat) || isNaN(long) || !lat || !long){
        throw 'invalid latitude and/or longitude';
    }

    var orig_url = 'https://api.weather.gov/points/' + lat + ',' + long;
    https.get(orig_url, options, function(response) {
        var rawData = '';
        response.on('data', function(chunk) {
            rawData += chunk;
        });

        response.on('end', function() {
            //console.log(rawData);  // THIS IS WHERE YOU HAVE ACCESS TO RAW DATA
            obj = JSON.parse(rawData);
            res.locals.err = obj.title;
            if(!res.locals.err){
                res.locals.url = obj.properties.forecastHourly;
                res.locals.city = obj.properties.relativeLocation.properties.city;
                res.locals.state = obj.properties.relativeLocation.properties.state;
            }
            next();
        });

      }).on('error', function(e) {
          console.error(e);
    });
},
function(req, res, next){

    if(res.locals.err){
        throw res.locals.err;
    }

    https.get(res.locals.url, options, function(response) {

      var rawData = '';
      obj = rawData;
      response.on('data', function(chunk) {
          rawData += chunk;
      });

      response.on('end', function() {
          obj = JSON.parse(rawData);
          res.locals.data = obj;
          next();
      });

    }).on('error', function(e) {
        console.error(e);
    });
},
function(req, res, next){
    var params = res.locals.params;
    var data = res.locals.data;
    var periods = data.properties.periods;
    var forecast = [];
    for(let i = 0; i < 24; i++){
        var hour = {};
        hour.date = periods[i]["startTime"].substring(0, 10);
        hour.start = periods[i]["startTime"].substring(11, 16);
        hour.temp = periods[i]["temperature"];
        hour.unit = periods[i]["temperatureUnit"];
        hour.windSpeed = periods[i]["windSpeed"];
        hour.windDir = periods[i]["windDirection"];
        hour.short = periods[i]["shortForecast"];
        hour.icon = periods[i]["icon"];
        forecast.push(hour);

//        forecast.push([periods[i]["startTime"].substring(0, 10), periods[i]["startTime"].substring(11, 16),
//        periods[i]["temperature"], periods[i]["temperatureUnit"], periods[i]["windSpeed"], periods[i]["windDirection"],
//        periods[i]["shortForecast"], periods[i]["icon"]])
    }
    params.forecast = forecast;
    params.city = res.locals.city;
    params.state = res.locals.state;
    res.render('weather', params);
});

module.exports = router;