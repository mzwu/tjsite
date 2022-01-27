const express = require('express');
const router = express();

// -------------- load packages -------------- //
var cookieSession = require('cookie-session');
const {  AuthorizationCode } = require('simple-oauth2');
var https = require('https');

router.set('trust proxy', 1); // trust first proxy

// -------------- express initialization -------------- //

router.use(cookieSession({
  name: 'crumbl',
  keys: ['mysecret23946134']
}));

// initialize mysql
var mysql = require('mysql');

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

// -------------- variable initialization -------------- //

// These are parameters provided by the authenticating server when
// we register our OAUTH client.
// -- The client ID is going to be public
// -- The client secret is super top secret. Don't make this visible
// -- The redirect uri should be some intermediary 'get' request that 
//     you write in whichyou assign the token to the session.

//  YOU GET THESE PARAMETERS BY REGISTERING AN APP HERE: https://ion.tjhsst.edu/oauth/applications/    

var ion_client_id = 'i2BXbThvCDG4tAvcvDLTKFREWmBjrbvmRXxJEZQZ';
var ion_client_secret = 'UjtUTthnohOg1ThFkVMBAr3pYmcxSI60xGrdObByUXd5lgiNHdFsnPrleL0VGeABDhw67COHOHL2rB7jHutIm56W4SuDrubWTYOnVMSgCRrBfRHQWLQuovzTWVqCw0QL';
var ion_redirect_uri = 'https://user.tjhsst.edu/2022mwu/states_worker';    //    <<== you choose this one

// Here we create an oauth2 variable that we will use to manage out OAUTH operations

var client = new AuthorizationCode({
  client: {
    id: ion_client_id,
    secret: ion_client_secret,
  },
  auth: {
    tokenHost: 'https://ion.tjhsst.edu/oauth/',
    authorizePath: 'https://ion.tjhsst.edu/oauth/authorize',
    tokenPath: 'https://ion.tjhsst.edu/oauth/token/'
  }
});

// This is the link that will be used later on for logging in. This URL takes
// you to the ION server and asks if you are willing to give read permission to ION.

var authorizationUri = client.authorizeURL({
    scope: "read",
    redirect_uri: ion_redirect_uri
});

// -------------- express 'get' handlers -------------- //

function checkAuthentication(req,res,next) {

    if ('authenticated' in req.session) {
        // the user has logged in
        next();
    }
    else {
        // the user has not logged in
        res.render('unverified', {'login_link' : authorizationUri});
    }
}

async function possiblyRefreshToken(req,res,next) {

    var accessToken = client.createToken(req.session.token); //recreate a token (class) instance
    if (accessToken.expired()) {
        try {
            const refreshParams = {
                'scope' : 'read',
            };
    
            req.session.token = await accessToken.refresh(refreshParams);
        } catch (error) {
            console.log('Error refreshing access token: ', error.message);
            return;
        }
    }
    next();
}

function getUserName(req,res,next) {
    var access_token = req.session.token.access_token;
    var profile_url = 'https://ion.tjhsst.edu/api/profile?format=json&access_token='+access_token;
    
    https.get(profile_url, function(response) {
    
      var rawData = '';
      response.on('data', function(chunk) {
          rawData += chunk;
      });
    
      response.on('end', function() {
        res.locals.profile = JSON.parse(rawData);
        next(); 
      });
    
    }).on('error', function(err) {
        next(err);
    });

}

// -------------- intermediary house_worker helper -------------- //
async function convertCodeToToken(req, res, next){
    var theCode = req.query.code;

    var options = {
        'code': theCode,
        'redirect_uri': ion_redirect_uri,
        'scope': 'read'
     };
    
    // needed to be in try/catch
    try {
        var accessToken = await client.getToken(options);      // await serializes asyncronous fcn call
        res.locals.token = accessToken.token;
        next();
    } 
    catch (error) {
        console.log('Access Token Error', error.message);
         res.send(502); // error creating token
    }
}


router.get('/states_worker', [convertCodeToToken], function(req, res) { 

    req.session.authenticated = true;
    req.session.token = res.locals.token;
    res.redirect('https://user.tjhsst.edu/2022mwu/states_game');
    
});

router.get('/states_game', [checkAuthentication, possiblyRefreshToken, getUserName], function(req, res){
    res.render('states');
});

router.get('/leaderboard_worker', [getUserName], function(req, res){
    var id = res.locals.profile.ion_username;
    var s_time = req.query.string;
    var n_time = req.query.num;
    sql = "SELECT * FROM leaderboard WHERE user_id=?";
    pool.query(sql, [id], function(error, results, fields){
        if(results[0] == null){
            q = "INSERT INTO leaderboard (user_id, s_time, n_time) VALUES (?, ?, ?)";
            pool.query(q, [id, s_time, n_time], function(error, results, fields){
                res.redirect('https://user.tjhsst.edu/2022mwu/states_results');
            });
        }
        else{
            query = "SELECT n_time FROM leaderboard WHERE user_id=?";
            pool.query(query, [id], function(error, results, fields){
                if(n_time > parseInt(results[0].n_time)){
                    res.redirect('https://user.tjhsst.edu/2022mwu/states_results');
                }
                else{
                    q = "UPDATE leaderboard SET s_time=?, n_time=? WHERE user_id=?";
                    pool.query(q, [s_time, n_time, id], function(error, results, fields){
                        res.redirect('https://user.tjhsst.edu/2022mwu/states_results');
                    });
                }
            })
        }
    });
});

router.get('/states_results', [getUserName], function(req, res){
    sql = "SELECT * FROM leaderboard ORDER BY n_time;";
    pool.query(sql, function(error, results, fields){
        params = [];
        for(let i = 0; i < results.length; i++){
            params.push({'rank': i+1,
                         'user': [results[i].user_id],
                         'time': [results[i].s_time]
            });
        }
        console.log(params);
        res.render('states_results', {"results": params});
    });
});

module.exports = router;