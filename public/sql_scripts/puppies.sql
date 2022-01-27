DROP TABLE IF EXISTS puppies;
CREATE TABLE puppies(name VARCHAR(100), id INT, up INT, PRIMARY KEY(id));
INSERT INTO puppies(name, id, up) VALUES ('zola', 1, 0);
INSERT INTO puppies(name, id, up) VALUES ('wisty', 2, 0);
INSERT INTO puppies(name, id, up) VALUES ('denali', 3, 0);