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

// API KEY MANAGEMENT
app.post('/api/keys/generate', async (req, res) => {
    const { user_id } = req.body;
    const newKey = 'sk-food-' + crypto.randomBytes(16).toString('hex');
    await db.execute('INSERT INTO apikeys (user_id, key_value) VALUES (?, ?)', [user_id, newKey]);
    res.json({ success: true, key: newKey });
});

app.get('/api/keys/:user_id', async (req, res) => {
    const [rows] = await db.execute('SELECT * FROM apikeys WHERE user_id = ? ORDER BY created_at DESC', [req.params.user_id]);
    res.json(rows);
});

// ADMIN - GET ALL USERS WITH LATEST API KEY
app.get('/api/admin/users', async (req, res) => {
    try {
        const [users] = await db.execute('SELECT id, name, status FROM users WHERE role = "user"');
        
        // Ambil latest API key untuk setiap user
        const usersWithKeys = await Promise.all(users.map(async (user) => {
            const [keys] = await db.execute('SELECT key_value FROM apikeys WHERE user_id = ? ORDER BY created_at DESC LIMIT 1', [user.id]);
            return {
                id: user.id,
                name: user.name,
                status: user.status || 'ACTIVE',
                latest_key: keys.length > 0 ? keys[0].key_value : null
            };
        }));
        
        res.json(usersWithKeys);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ADMIN - UPDATE USER STATUS
app.put('/api/admin/users/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        await db.execute('UPDATE users SET status = ? WHERE id = ?', [status, req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// ROUTING
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login-form.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'public', 'register.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
app.get('/docs', (req, res) => res.sendFile(path.join(__dirname, 'public', 'docs.html')));

// PRODUCT/FOOD API ROUTING dengan API Key validation
const productController = require('./controllers/productController');

// GET Foods dengan API Key validation
app.get('/api/foods', async (req, res) => {
    const { key } = req.query;
    
    if (!key) {
        return res.status(401).json({ error: "API Key diperlukan" });
    }
    
    try {
        // Validasi API Key
        const [validKey] = await db.execute('SELECT user_id FROM apikeys WHERE key_value = ? AND status = "ACTIVE"', [key]);
        
        if (validKey.length === 0) {
            return res.status(403).json({ error: "API Key tidak valid atau tidak aktif" });
        }
        
        // API Key valid, return semua foods
        const [foods] = await db.execute('SELECT * FROM foods');
        res.json(foods);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

