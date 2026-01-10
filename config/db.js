const mysql = require('mysql2');

// GUNAKAN .promise() agar bisa menggunakan await di server.js
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'Coldplayers06',
    database: 'resep_db',
    port:3308,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
}).promise(); 

module.exports = pool;