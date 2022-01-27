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

var ion_client_id = 'WGuzcYSDjjCDG1bSrBhMT7sIbsnsE7n3fENdpCzb';
var ion_client_secret = 'eMV8ENAD7oe6TLBO125aUZFiSuj2O75qYQFQX4eCoIYIJT8FoX2rVbO38fuZJ6RSjk2XDn4Qp1rcjIZ7bcvzryZ3mhU9j2uq4EN0khp6Tfg0aFNNa5IGOEXmIQLQ2F5O';
var ion_redirect_uri = 'https://user.tjhsst.edu/2022mwu/house_worker';    //    <<== you choose this one

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


router.get('/house_worker', [convertCodeToToken], function(req, res) { 

    req.session.authenticated = true;
    req.session.token = res.locals.token;
    res.redirect('https://user.tjhsst.edu/2022mwu/house_points');
    
});

// -------------- endpoints -------------- //

router.get('/house_points', [checkAuthentication, possiblyRefreshToken, getUserName], function(req, res, next){
    var sql = 'CALL house_proc()';
    pool.query(sql, function(error, results, fields){
        params = {'hp' : results[0][0].points,
                  'hg' : results[0][1].points,
                  'mu' : results[0][2].points,
                  'sw' : results[0][3].points};
        params.names = [];
        for(let i = 0; i < results[1].length; i++){
            params.names.push({'c_id' : results[1][i].c_id, 
                               'name' : results[1][i].name
            });
        }
        res.render('house_points.hbs', params);
    });
});

router.get('/house_points_worker', function(req, res){
    var house_chx;
    if ('house' in req.query === false) {
        return res.send('missing house by that name');
    } else {
        house_chx = req.query.house;
    }
    var sql = 'SELECT name, points FROM characters WHERE c_id IN (SELECT person FROM map WHERE house=?);';
    pool.query(sql,[house_chx],function(error, results, fields){
        r = [];
        for(let i = 0; i < results.length; i++){
            r.push(results[i]);
        }
        res.render('./jquery/house_list',{'results':r});
    
    });
});

router.get('/house_add_points', [getUserName], function(req, res, next){
    res.locals.char_id = req.query.chars;
    res.locals.points = req.query.points;
    var sql = 'UPDATE houses SET points=points+? WHERE h_id=(SELECT house FROM map WHERE person=?);';
    pool.query(sql, [res.locals.points, res.locals.char_id], function(error, results, fields){
        next();
    });
},
function(req, res, next){
    var sql = 'UPDATE characters SET points=points+? WHERE c_id=?';
    pool.query(sql, [res.locals.points, res.locals.char_id], function(error, results, fields){
        //res.redirect('https://user.tjhsst.edu/2022mwu/house_points');
        next();
    })
},
function(req, res, next){
    var today = new Date();
    var date = today.getFullYear()+'-'+(today.getMonth()+1)+'-'+today.getDate();
    var time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
    var dateTime = date+' '+time;
    params = [dateTime, res.locals.profile.ion_username, res.locals.points]
    var sql = 'SELECT name FROM characters WHERE c_id=?;';
    pool.query(sql, [res.locals.char_id], function(error, results, fields){
        params.push(results[0].name);
        var q = 'SELECT name FROM houses WHERE h_id=(SELECT house FROM map WHERE person=?);';
        pool.query(q, [res.locals.char_id], function(error, results, fields){
            params.push(results[0].name);
            var q2 = 'INSERT INTO history(time, user_id, points, c_name, house) VALUES (?, ?, ?, ?, ?);'
            pool.query(q2, params, function(error, results, fields){
                res.redirect('https://user.tjhsst.edu/2022mwu/house_points');
            })
        })
    })
}
);

router.get('/house_add_char', function(req, res, next){
    res.locals.char_name = req.query.name;
    res.locals.house_id = parseInt(req.query.house);
    var sql = 'SELECT * FROM characters';
    pool.query(sql, function(error, results, fields){
        res.locals.new_id = results.length + 1001;
        next();
})},
function(req, res, next){
    var q = 'INSERT INTO characters(c_id, name, points) VALUES(?, ?, 0);';
    params = [res.locals.new_id, res.locals.char_name];
    pool.query(q, params, function(error, results, fields){
        next();
    });
},
function(req, res, next){
    var q = 'INSERT INTO map(house, person) VALUES(?, ?);';
    params = [res.locals.house_id, res.locals.new_id];
    pool.query(q, params, function(error, results, fields){
        res.redirect('https://user.tjhsst.edu/2022mwu/house_points');
    });
});

// router.get('/house_points_log', function(req, res, next){
//     var sql = 'SELECT * FROM history;';
//     pool.query(sql, function(error, results, fields){
//         params = []
//         for(let i = 0; i < results.length; i++){
//             params.push({'time': [results[i].time],
//                          'user': [results[i].user_id],
//                          'points': [results[i].points],
//                          'character': [results[i].c_name],
//                          'house': [results[i].house]
//             })
//         }
//         var q = 'SELECT DISTINCT user_id FROM history;';
//         pool.query(q, function(error, results, fields){
//             users = []
//             for(let i = 0; i < results.length; i++){
//                 users.push(results[i].user_id)
//             }
//             res.render('history.hbs', {'results': params,
//                                       'users' : users
//             })
//         })
//     })
// })

router.get('/house_points_log', function(req, res, next){
    var u_id = req.query.user;
    if(u_id){
        var sql = 'SELECT * FROM history WHERE user_id=?;';
        pool.query(sql, [u_id], function(error, results, fields){
            params = []
            for(let i = 0; i < results.length; i++){
                params.push({'time': [results[i].time],
                             'user': [results[i].user_id],
                             'points': [results[i].points],
                             'character': [results[i].c_name],
                             'house': [results[i].house]
                })
            }
            res.locals.params = params;
            next();
        })
    }
    else{
        var sql = 'SELECT * FROM history';
        pool.query(sql, function(error, results, fields){
            params = []
            for(let i = 0; i < results.length; i++){
                params.push({'time': [results[i].time],
                             'user': [results[i].user_id],
                             'points': [results[i].points],
                             'character': [results[i].c_name],
                             'house': [results[i].house]
                })
            }
            res.locals.params = params;
            next();
        })
    }
},
function(req, res, next){
    var q = 'SELECT DISTINCT user_id FROM history;';
    pool.query(q, function(error, results, fields){
        users = []
        for(let i = 0; i < results.length; i++){
            users.push(results[i].user_id)
        }
        res.render('history.hbs', {'results': res.locals.params,
                                   'users' : users
        })
    })
})


module.exports = router;