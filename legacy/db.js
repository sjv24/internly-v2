// This script connects to a MySQL database
const mysql = require('mysql');

const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "1234"
});

db.connect(function (err) {
    if (err) throw err;
    console.log("Connected to Interly database!");

    // Use the database
    db.query("USE INTERNLY", function (err, result) {
        if (err) throw err;
        console.log("Using database INTERNLY");
    });
});

module.exports = db;

