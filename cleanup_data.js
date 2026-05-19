const { initializeApp } = require('./node_modules/firebase/app');
const { getDatabase, ref, get, remove, set } = require('./node_modules/firebase/database');
const sqlite3 = require('./backend/node_modules/sqlite3').verbose();
const path = require('path');

const firebaseConfig = {
    apiKey: "AIzaSyDhFtqvaTMgYH9vyAHFclDUXiOxkl-2GqM",
    authDomain: "silat-b3100.firebaseapp.com",
    databaseURL: "https://silat-b3100-default-rtdb.firebaseio.com/",
    projectId: "silat-b3100",
    storageBucket: "silat-b3100.firebasestorage.app",
    messagingSenderId: "471266034969",
    appId: "1:471266034969:web:467de19582cf2fd3da3188"
};

const app = initializeApp(firebaseConfig);
const rtdb = getDatabase(app);

const todayStart = 1778691600000; // 14/05/2026 00:00:00 UTC+7
const galihIds = ['026AB155', '23B29603'];

async function cleanupFirebase() {
    console.log("--- CLEANING FIREBASE ---");
    try {
        const usersSnap = await get(ref(rtdb, 'users'));
        const users = usersSnap.val() || {};
        const activeUserIds = Object.keys(users);

        const nodes = ['test_history', 'attempts'];
        
        for (const node of nodes) {
            console.log(`Checking node: ${node}`);
            const nodeSnap = await get(ref(rtdb, node));
            const data = nodeSnap.val() || {};
            
            for (const id in data) {
                const isGalih = galihIds.includes(id);
                const isOrphan = !activeUserIds.includes(id);

                if (isGalih || isOrphan) {
                    console.log(`Processing ID: ${id} (${isGalih ? 'Galih' : 'Orphan'})`);
                    const sessions = data[id];
                    
                    for (const sessionKey in sessions) {
                        let sessionTs = 0;
                        if (sessionKey.startsWith('session_')) {
                            sessionTs = parseInt(sessionKey.replace('session_', ''));
                        } else if (sessions[sessionKey].timestamp) {
                            sessionTs = sessions[sessionKey].timestamp;
                        }

                        // Jika timestamp di bawah hari ini, hapus
                        if (sessionTs < todayStart) {
                            console.log(`  Deleting old session: ${sessionKey} (TS: ${sessionTs})`);
                            await remove(ref(rtdb, `${node}/${id}/${sessionKey}`));
                        } else {
                            console.log(`  KEEPING today's session: ${sessionKey} (TS: ${sessionTs})`);
                        }
                    }
                }
            }
        }
        console.log("Firebase cleanup done.");
    } catch (err) {
        console.error("Firebase Error:", err);
    }
}

function cleanupSQLite() {
    console.log("\n--- CLEANING SQLITE ---");
    const dbPath = path.resolve(__dirname, 'backend', 'silat_monitor.db');
    const db = new sqlite3.Database(dbPath);

    db.serialize(() => {
        // Hapus atlet yang tidak ada di list user baru (yang TEST- ID nya tidak valid lagi)
        // Dan hapus attempts lama
        
        // Cari ID atlet yang namanya Fani/Ferdi yang lama
        db.run("DELETE FROM attempts WHERE timestamp < datetime(1778691600/1000, 'unixepoch')", (err) => {
            if (err) console.error("Error deleting old attempts:", err);
            else console.log("Deleted old attempts in SQLite.");
        });

        // Hapus atlet yang RFID nya diawali TEST- (Data simulasi lama)
        db.run("DELETE FROM athletes WHERE rfid_tag LIKE 'TEST-%'", (err) => {
            if (err) console.error("Error deleting old athletes:", err);
            else console.log("Deleted old athletes (TEST-) in SQLite.");
        });
    });

    db.close();
}

async function main() {
    await cleanupFirebase();
    cleanupSQLite();
    console.log("\n✅ ALL CLEANUP TASKS COMPLETED.");
    process.exit();
}

main();
