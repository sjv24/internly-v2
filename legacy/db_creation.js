// db_creation.js — Run once to create database and tables

const mysql = require('mysql');

const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "1234"
});

db.connect(function (err) {
    if (err) throw err;
    console.log("Connected!");

    const sql_database = "CREATE DATABASE IF NOT EXISTS INTERNLY";
    db.query(sql_database, function (err) {
        if (err) throw err;
        console.log("INTERNLY Database created or already exists");

        db.query("USE INTERNLY", function (err) {
            if (err) throw err;
            console.log("Using database INTERNLY");

            const tables = [
                // STUDENTS table
                `CREATE TABLE IF NOT EXISTS STUDENTS (
                    s_id INT PRIMARY KEY AUTO_INCREMENT,
                    s_name VARCHAR(100) NOT NULL,
                    s_email VARCHAR(255) NOT NULL UNIQUE,
                    s_password VARCHAR(255) NOT NULL,
                    s_birthdate DATE,
                    s_uni VARCHAR(255),
                    s_joining_date DATE,
                    s_gender CHAR(1),
                    s_year_of_study INT,
                    s_website VARCHAR(700)
                )`,

                // COMPANIES table
                `CREATE TABLE IF NOT EXISTS COMPANIES (
                    c_id INT PRIMARY KEY AUTO_INCREMENT,
                    c_name VARCHAR(100) NOT NULL,
                    c_contact_name VARCHAR(100),
                    c_email VARCHAR(255) NOT NULL UNIQUE,
                    c_password VARCHAR(255) NOT NULL,
                    c_location VARCHAR(255),
                    c_industry VARCHAR(100)
                )`,

                // INTERNSHIPS table
                `CREATE TABLE IF NOT EXISTS INTERNSHIPS (
                    i_id INT PRIMARY KEY AUTO_INCREMENT,
                    i_title VARCHAR(100) NOT NULL,
                    i_description TEXT,
                    i_location VARCHAR(100),
                    i_type ENUM('On-site', 'Remote', 'Hybrid') DEFAULT 'On-site',
                    i_duration VARCHAR(50),
                    i_start_date DATE,
                    i_application_deadline DATE,
                    i_stipend VARCHAR(50),
                    i_skills VARCHAR(255),
                    i_openings INT DEFAULT 1,
                    c_id INT,
                    c_name VARCHAR(100),
                    FOREIGN KEY (c_id) REFERENCES COMPANIES(c_id) ON DELETE CASCADE
                )`,

                // APPLICATIONS table
                `CREATE TABLE IF NOT EXISTS APPLICATIONS (
                    app_id INT PRIMARY KEY AUTO_INCREMENT,
                    s_id INT,
                    i_id INT,
                    app_date DATE,
                    status VARCHAR(50) DEFAULT 'Pending',
                    FOREIGN KEY (s_id) REFERENCES STUDENTS(s_id) ON DELETE CASCADE,
                    FOREIGN KEY (i_id) REFERENCES INTERNSHIPS(i_id) ON DELETE CASCADE
                )`
            ];

            tables.forEach((sql, index) => {
                db.query(sql, function (err) {
                    if (err) throw err;
                    console.log(`Table ${index + 1} created or already exists.`);
                });
            });
        });
    });
});

module.exports = db;
