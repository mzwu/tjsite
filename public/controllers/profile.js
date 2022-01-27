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

var ion_client_id = 'd1ziQrVrmuNkGyhCGEDj7wo7URvtyxAAyfdNk0WY';
var ion_client_secret = 'AiuRNe28PRYm1xEScQhaE6DAj4J6xIqkJt1DP9lZegj33ribpcOmwa2zncBQ8YsJ46ec0f8tmnQFpedWVwEaOiMCXOzwFZtN9neVTLEbVx5uJ67suDX6WePp9Jx8967n';
var ion_redirect_uri = 'https://user.tjhsst.edu/2022mwu/login_worker';    //    <<== you choose this one

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
    console.log(profile_url)
    
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


router.get('/profile', [checkAuthentication, possiblyRefreshToken, getUserName], function (req, res) {
        var profile = res.locals.profile;
        var data = {
            'user': profile.full_name,
            'year': profile.graduation_year,
            'pic': profile.picture,
            'name': false,
            'nickname': '',
            'set': false,
            'id' : profile.id
        };
        req.session.ion_id = data.id;
        if(req.query.q === 'update'){
            data.set = true;
        }
        var q = 'SELECT nickname FROM names WHERE id=?';
        pool.query(q, [data.id], function(error, results, fields){
            if (error) throw error;
            if(results[0] === undefined){
                data.nickname = '';
            }
            else{
                data.nickname = results[0].nickname;
            }
            if(data.nickname !== ''){
                data.name = true;
            }
            res.render('verified', data);
        });
});

router.get('/setnickname', function(req, res, next){
    var sql = 'SELECT nickname FROM names WHERE id=?';
    pool.query(sql, [req.session.ion_id], function(error, results, fields){
        if (error) throw error;
        if(results[0] !== undefined){
            res.locals.id_exists = true;
        }
        else{
            res.locals.id_exists = false;
        }
        res.locals.nickname = req.query.name;
        next();
    });
},
function(req, res, next){
    var nickname = res.locals.nickname;
    var ion_id = req.session.ion_id;
    var sql = 'INSERT INTO names(nickname, id) VALUES (?, ?)';
    if(res.locals.id_exists){
        sql = 'UPDATE names SET nickname=? WHERE id=?';
    }
    pool.query(sql, [nickname, ion_id], function(error, results, fields){
        if (error) throw error;
        res.redirect('https://user.tjhsst.edu/2022mwu/profile');
    });
});


router.get('/logout', function (req, res) {
    
    delete req.session.authenticated;
    res.redirect('https://user.tjhsst.edu/2022mwu/profile');

});


// -------------- intermediary login_worker helper -------------- //
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


router.get('/login_worker', [convertCodeToToken], function(req, res) { 

    req.session.authenticated = true;
    req.session.token = res.locals.token;
    res.redirect('https://user.tjhsst.edu/2022mwu/profile');
    
});

module.exports = router;