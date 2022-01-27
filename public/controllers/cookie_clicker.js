const express = require('express');
const router = express();

var cookieParser = require('cookie-parser');
router.use(cookieParser());

var cookieSession = require('cookie-session');
router.use(cookieSession({
  name: 'crumbl',
  keys: ['mysecret23946134']
}));

const {  AuthorizationCode } = require('simple-oauth2');
var https = require('https');

router.set('trust proxy', 1); // trust first proxy

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

var ion_client_id = 'oE1QUAFijMCjSKWi0bybT64Ut8dJe2g3ktNpOA3g';
var ion_client_secret = 'Z6BN6Vm5IJayILNFJNgm5mgBMKLimwwRPArqMiOOOfMSaGvAIjOSjbaWeTpERGxAPkFtkQwRkEH3hJdejWb44ekNxlV1tuo27I8JXrqmbzVj5O30KMqSCdzfRFedDTig';
var ion_redirect_uri = 'https://user.tjhsst.edu/2022mwu/login_cookie';    //    <<== you choose this one

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

// -------------- intermediary login_worker helper -------------- //
async function convertCodeToToken(req, res, next) {
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


router.get('/login_cookie', [convertCodeToToken], function(req, res) { 

    req.session.authenticated = true;
    req.session.token = res.locals.token;
    res.redirect('https://user.tjhsst.edu/2022mwu/cookie');
    
});

function checkAuthentication(req,res,next) {

    if ('authenticated' in req.session) {
        // the user has logged in
        next();
    }
    else {
        // the user has not logged in
        params = {'logged' : false,
                  'login_link' : authorizationUri
        };
        var cookie_key = 'clicks';
        if(cookie_key in req.cookies === false){
            res.cookie('clicks', 0);
        }
        if(!('visit_count' in req.session)){
            req.session.visit_count = 0;
        }
        else{
            req.session.visit_count++;
        }
        if(req.session.visit_count > 5){
            params.limit = true;
        }
        res.render('cookies', params);
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

router.get('/cookie', [checkAuthentication, possiblyRefreshToken, getUserName], function(req, res){
    user = res.locals.profile.first_name;
    id = res.locals.profile.id;
    
    logged = (user === undefined) ? false : true;
    params = {'logged' : logged,
              'user' : user,
              'limit' : false,
              'login_link' : authorizationUri
    };
    
    var cookie_key = 'clicks';
    if(cookie_key in req.cookies === false){
        res.cookie('clicks', 0);
    }
    var sql = 'SELECT nickname FROM names WHERE id=?';
    pool.query(sql, [id], function(error, results, fields){
        if (error) throw error;
        if(results[0] !== undefined){
            params.nickname = true;
            params.name = results[0].nickname;
        }
        else{
            params.nickname = false;
        }
        res.render('cookies', params);
    });
    
});

router.get('/cookie/logout', function(req, res){
    req.session.visit_count = 0;
    res.cookie('clicks', 0);
    delete req.session.authenticated;
    res.redirect('https://user.tjhsst.edu/2022mwu/cookie');
});

module.exports = router;