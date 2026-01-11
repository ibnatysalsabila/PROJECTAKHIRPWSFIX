const express = require('express');
const path = require('path');
const bcrypt = require('bcrypt');
const cors = require('cors');
const crypto = require('crypto');
const db = require('./config/db');

const app = express();
const port = 3000;

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

(async () => {
    try {
        await db.execute(`ALTER TABLE users ADD COLUMN status VARCHAR(20) DEFAULT 'ACTIVE'`);
        console.log('✅ Column status berhasil ditambahkan');
    } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
            console.log('✅ Column status sudah ada');
        } else {
            console.error('⚠️ Error:', err.message);
        }
    }
})();

// AUTHENTICATION
app.post('/api/register', async (req, res) => {
    try {
        const { name, password, role } = req.body;
        const hashed = await bcrypt.hash(password, 10);
        await db.execute('INSERT INTO users (name, password, role) VALUES (?, ?, ?)', [name, hashed, role || 'user']);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, message: "Username sudah digunakan!" }); }
});

app.post('/api/login', async (req, res) => {
    const { name, password } = req.body;
    console.log(`\n[LOGIN REQUEST] Username: "${name}" | Password: "${password}"`);
    
    try {
        console.log(`[LOGIN] Checking tabel users...`);
        let [rows] = await db.execute('SELECT * FROM users WHERE name = ?', [name]);
        let user = rows.length > 0 ? rows[0] : null;
        let userType = 'user';

        if (user) {
            console.log(`[LOGIN] ✅ User ditemukan di tabel users:`, user);
        } else {
            console.log(`[LOGIN] User tidak ditemukan di tabel users, checking tabel admins...`);
            [rows] = await db.execute('SELECT id, username, password FROM admins WHERE username = ?', [name]);
            console.log(`[LOGIN] Query admins result:`, rows);
            
            if (rows.length > 0) {
                user = rows[0];
                userType = 'admin';
                console.log(`[LOGIN] ✅ Admin ditemukan:`, user);
            } else {
                console.log(`[LOGIN] ❌ Admin tidak ditemukan. Mencoba list semua admin:`);
                [rows] = await db.execute('SELECT id, username FROM admins');
                console.log(`[LOGIN] Semua admin:`, rows);
            }
        }

        if (!user) {
            console.log(`[LOGIN] ❌ User/Admin tidak ditemukan`);
            return res.status(401).json({ success: false, message: "Login Gagal!" });
        }

        const storedPassword = user.password;
        console.log(`[LOGIN] Stored password dari DB: "${storedPassword}"`);
        console.log(`[LOGIN] Input password: "${password}"`);
        
        let passwordMatch = (password === storedPassword);
        console.log(`[LOGIN] Plain text comparison: ${passwordMatch}`);
        
        if (!passwordMatch) {
            try {
                passwordMatch = await bcrypt.compare(password, storedPassword);
                console.log(`[LOGIN] bcrypt.compare result: ${passwordMatch}`);
            } catch (err) {
                console.log(`[LOGIN] bcrypt.compare error (expected untuk plain text):`, err.message);
            }
        }

        if (passwordMatch) {
            console.log(`[LOGIN] ✅ Password BENAR! Role: ${userType}`);
            res.json({ 
                success: true, 
                userId: user.id, 
                name: user.username || user.name, 
                role: userType
            });
        } else { 
            console.log(`[LOGIN] ❌ Password SALAH!`);
            res.status(401).json({ success: false, message: "Login Gagal!" }); 
        }
    } catch (err) { 
        console.error(`[LOGIN] ERROR:`, err);
        res.status(500).json({ success: false, message: "Database error: " + err.message }); 
    }
});