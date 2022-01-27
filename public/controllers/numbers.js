const express = require('express');
const router = express.Router({ strict: true});

router.get('/numbers', function(req, res){
    res.render('numbers_form.hbs');
});

router.get('/num', function(req, res){
    const {f_val, f_facts} = req.query;
    res.redirect('https://user.tjhsst.edu/2022mwu/' + f_val + '?num_facts=' + f_facts);
});

router.get('/:somepage', function(req, res){
    var facts = {
        1 : ['1 = 1', '1 + 1 = 2', '1 * 1 = 1', '1 is odd', '1 is neither prime nor composite'],
        2 : ['2 = 2', '2 + 2 = 4', '2 * 2 = 2', '2 is even', '2 is a prime number'],
        3 : ['3 = 3', '3 + 3 = 6', '3 * 3 = 9', '3 is odd', '3 is a prime number'],
        4 : ['4 = 4', '4 + 4 = 8', '4 * 4 = 16', '4 is even', '4 is a composite number'],
        5 : ['5 = 5', '5 + 5 = 10', '5 * 5 = 25', '5 is odd', '5 is a prime number']
    };
    var val = parseInt(req.params.somepage);
    if(isNaN(req.params.somepage) || val < 1 || val > 5){
        throw 'enter a value between 1 and 5';
    }
    var num = 1;
    if('num_facts' in req.query){
        num = parseInt(req.query.num_facts);
    }
    if(req.query.num_facts && (isNaN(req.query.num_facts)) || Number.isNaN(num) || num < 1 || num > 5){
        throw 'enter a number of facts between 1 and 5';
    }
    var params = {
        'value' : val,
        'facts' : facts[val].slice(0, num)
    };
    if(req.query.format && req.query.format != 'json'){
        throw 'invalid format';
    }
    if(req.query.format == 'json'){
        return res.json(params);
    }
    res.render('content', params);
});

module.exports = router;