const express = require('express');
const router = express.Router({ strict: true});

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

router.get('/voting_form', function(req, res){
    console.log('form');
    res.render('voting_form');
});

router.get('/voting_update', function(req, res){
    console.log('update');
    var name = req.query.name;
    console.log(name);
    if(name){
        var sql = 'UPDATE puppies SET up=up+1 WHERE name=?';
        pool.query(sql, [name], function(error, results, fields){
            if (error) throw error;
            res.redirect('https://user.tjhsst.edu/2022mwu/voting_results');
        });
    }
});

router.get('/voting_results', function(req, res){
    var q = 'SELECT * FROM puppies';
    pool.query(q, function(error, results, fields){
        if (error) throw error;
        var data = {'zola': results[0].up,
                    'wisty': results[1].up,
                    'denali': results[2].up
        };
        console.log(data);
        res.render('voting_results', data);
    });
});

module.exports = router;