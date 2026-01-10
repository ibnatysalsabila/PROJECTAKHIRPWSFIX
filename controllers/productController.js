const db = require('../config/db');

exports.getAllProducts = async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM foods'); 
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getProductById = async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM foods WHERE id = ?', [req.params.id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: "Makanan tidak ditemukan" });
        }
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.createProduct = async (req, res) => {
    try {
        const { nama, asal, deskripsi, gambar_url } = req.body;
        
        console.log(`[FOOD CREATE] Received payload:`, req.body);
        
        if (!nama || !asal || !deskripsi || !gambar_url) {
            console.log(`[FOOD CREATE] ❌ Missing fields`);
            return res.status(400).json({ error: "Semua field (nama, asal, deskripsi, gambar_url) harus diisi" });
        }

        console.log(`[FOOD CREATE] Inserting: nama=${nama}, asal=${asal}, deskripsi=${deskripsi.substring(0,50)}..., gambar_url=${gambar_url}`);
        
        const [result] = await db.execute(
            'INSERT INTO foods (nama, asal, deskripsi, gambar_url) VALUES (?, ?, ?, ?)',
            [nama, asal, deskripsi, gambar_url]
        );
        
        console.log(`[FOOD CREATE] ✅ Success! Insert result:`, result);
        res.json({ success: true, message: "Makanan berhasil ditambahkan", id: result.insertId });
    } catch (err) {
        console.error(`[FOOD CREATE] ❌ Error:`, err);
        res.status(500).json({ error: err.message });
    }
};

exports.updateProduct = async (req, res) => {
    try {
        const { nama, asal, deskripsi, gambar_url } = req.body;
        const id = req.params.id;

        if (!nama || !asal || !deskripsi || !gambar_url) {
            return res.status(400).json({ error: "Semua field (nama, asal, deskripsi, gambar_url) harus diisi" });
        }

        const [result] = await db.execute(
            'UPDATE foods SET nama = ?, asal = ?, deskripsi = ?, gambar_url = ? WHERE id = ?',
            [nama, asal, deskripsi, gambar_url, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Makanan tidak ditemukan" });
        }

        res.json({ success: true, message: "Makanan berhasil diupdate" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.deleteProduct = async (req, res) => {
    try {
        const id = req.params.id;
        const [result] = await db.execute('DELETE FROM foods WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Makanan tidak ditemukan" });
        }

        res.json({ success: true, message: "Makanan berhasil dihapus" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};