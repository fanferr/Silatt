const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const db = require('./database');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

let currentTestSession = {
    athleteId: null,
    attempts: []
};

// Helper for Promisified DB queries
const dbAll = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

const dbGet = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

const dbRun = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve({ id: this.lastID, changes: this.changes });
        });
    });
};


// API Routes
app.get('/api/athletes', async (req, res) => {
    try {
        const athletes = await dbAll('SELECT * FROM athletes ORDER BY id DESC');
        res.json(athletes);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/athletes/:id', async (req, res) => {
    try {
        const athlete = await dbGet('SELECT * FROM athletes WHERE id = ?', [req.params.id]);
        if (athlete) res.json(athlete);
        else res.status(404).json({ error: 'Athlete not found' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/athletes', async (req, res) => {
    const { name, age, height, weight, category, rfid_tag } = req.body;
    try {
        const result = await dbRun(
            'INSERT INTO athletes (name, age, height, weight, category, rfid_tag) VALUES (?, ?, ?, ?, ?, ?)',
            [name, age, height, weight, category, rfid_tag]
        );
        res.json({ id: result.id, success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/athletes/:id', async (req, res) => {
    try {
        await dbRun('DELETE FROM attempts WHERE athlete_id = ?', [req.params.id]);
        await dbRun('DELETE FROM athletes WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/leaderboard', async (req, res) => {
    try {
        const query = `
            SELECT a.name, a.category, MAX(at.force) as best_score
            FROM athletes a
            JOIN attempts at ON a.id = at.athlete_id
            GROUP BY a.id, a.name, a.category
            ORDER BY best_score DESC
        `;
        const leaderboard = await dbAll(query);
        res.json(leaderboard);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/attempts/:athleteId', async (req, res) => {
    try {
        const attempts = await dbAll(
            'SELECT * FROM attempts WHERE athlete_id = ? ORDER BY timestamp ASC',
            [req.params.athleteId]
        );
        res.json(attempts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get History for Chart (Option 3)
app.get('/api/history/:athleteId', async (req, res) => {
    try {
        const history = await dbAll(`
            SELECT 
                strftime('%Y-%m-%d %H:%M', timestamp) as date,
                force
            FROM attempts 
            WHERE athlete_id = ? 
            ORDER BY timestamp ASC
        `, [req.params.athleteId]);
        res.json(history);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Start/Stop Test Session logic
app.post('/api/start-test', (req, res) => {
    const { athleteId } = req.body;
    // Reset session for this athlete
    currentTestSession = { athleteId: parseInt(athleteId), attempts: [] };
    io.emit('session_started', { athleteId: currentTestSession.athleteId });
    console.log(`Session started for athlete ${athleteId}`);
    res.json({ success: true });
});

app.post('/api/stop-test', (req, res) => {
    currentTestSession = { athleteId: null, attempts: [] };
    io.emit('session_ended');
    console.log(`Session ended`);
    res.json({ success: true });
});

app.post('/api/admin/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const admin = await dbGet('SELECT * FROM admins WHERE username = ?', [username]);
        if (admin && password === admin.password) {
            res.json({ success: true, token: 'mock-admin-token', username: admin.username });
        } else {
            res.status(401).json({ success: false, message: 'Username atau Password salah' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Admin Management APIs
app.get('/api/admin/users', async (req, res) => {
    try {
        const admins = await dbAll('SELECT id, username FROM admins');
        res.json(admins);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/users', async (req, res) => {
    const { username, password } = req.body;
    try {
        await dbRun('INSERT INTO admins (username, password) VALUES (?, ?)', [username, password]);
        res.json({ success: true, message: 'Admin baru ditambahkan' });
    } catch (err) {
        res.status(500).json({ error: 'Username sudah digunakan atau gagal simpan' });
    }
});

app.delete('/api/admin/users/:id', async (req, res) => {
    try {
        await dbRun('DELETE FROM admins WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/update-password', async (req, res) => {
    const { username, oldPassword, newPassword } = req.body;
    try {
        const admin = await dbGet('SELECT * FROM admins WHERE username = ?', [username]);
        if (!admin || oldPassword !== admin.password) {
            return res.status(400).json({ success: false, message: 'Password lama salah' });
        }
        await dbRun('UPDATE admins SET password = ? WHERE username = ?', [newPassword, username]);
        res.json({ success: true, message: 'Password berhasil diubah' });
    } catch (err) {
        res.status(500).json({ error: 'Gagal mengubah password' });
    }
});

// Socket.io
io.on('connection', (socket) => {
    console.log('Client connected', socket.id);

    // Received from RFID reader (simulation)
    socket.on('rfid_scan', (tagId) => {
        console.log('RFID Scanned:', tagId);
        io.emit('rfid_scanned', tagId);
    });

    // Received from Impact Sensor (simulation)
    // Stream for graph visualization
    socket.on('sensor_stream', (value) => {
        io.emit('sensor_live_data', value);
    });

    // Impact detected (Peak value or significant hit)
    socket.on('impact_detected', async (forceValue) => {
        console.log('Impact detected:', forceValue);

        if (currentTestSession.athleteId) {
            const athleteId = currentTestSession.athleteId;

            // Save to DB
            try {
                await dbRun('INSERT INTO attempts (athlete_id, force) VALUES (?, ?)', [athleteId, forceValue]);

                currentTestSession.attempts.push(forceValue);
                const attemptCount = currentTestSession.attempts.length;

                io.emit('new_attempt_result', {
                    force: forceValue,
                    attemptNumber: attemptCount,
                    athleteId
                });

                if (attemptCount >= 3) {
                    io.emit('test_milestone_reached', { athleteId, count: 3 });
                }
            } catch (err) {
                console.error("Error saving attempt:", err);
            }
        }
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
