DROP TABLE IF EXISTS houses;
CREATE TABLE houses (h_id INT, name VARCHAR(100), points INT, PRIMARY KEY(h_id));
INSERT INTO houses (h_id, name, points) 
    VALUES 
    (1, 'Harry Potter', 0),
    (2, 'Hunger Games', 0),
    (3, 'Marvel Universe', 0),
    (4, 'Star Wars', 0);

DROP TABLE IF EXISTS characters;
CREATE TABLE characters (c_id INT, name VARCHAR(100), points INT, PRIMARY KEY(c_id));
INSERT INTO characters (c_id, name, points) 
    VALUES 
    (1001, 'Hermione Granger', 0),
    (1002, 'Draco Malfoy', 0),
    (1003, 'Katniss Everdeen', 0),
    (1004, 'Peeta Mellark', 0),
    (1005, 'Iron Man', 0),
    (1006, 'Captain America', 0),
    (1007, 'Luke Skywalker', 0),
    (1008, 'Darth Vader', 0);

DROP TABLE IF EXISTS map;
CREATE TABLE map (house INT, person INT);
INSERT INTO map (house, person) 
    VALUES 
    (1, 1001),
    (1, 1002),
    (2, 1003),
    (2, 1004),
    (3, 1005),
    (3, 1006),
    (4, 1007),
    (4, 1008);
    
DROP TABLE IF EXISTS history;
CREATE TABLE history (time VARCHAR(256), user_id VARCHAR(256), points INT, c_name VARCHAR(256), house VARCHAR(256));