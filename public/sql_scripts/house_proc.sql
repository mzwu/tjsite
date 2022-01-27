-- # drop existing house_proc
DROP PROCEDURE IF EXISTS house_proc; 
 
-- # change delimiter to $$ --> i.e. the statement terminator is changed to $$
DELIMITER $$ 
 
-- # name the procedure; this one will have no arguments
CREATE PROCEDURE house_proc() 
BEGIN

SELECT * FROM houses;
SELECT * FROM characters;

-- # statement (therefore, procedure) is over
END$$ 

-- # change the delimiter back to normal
DELIMITER ; 