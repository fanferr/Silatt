
import { initializeApp } from "firebase/app";
import { getDatabase, ref, get, child } from "firebase/database";

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
const db = getDatabase(app);

async function checkData() {
    try {
        const snapshot = await get(child(ref(db), 'test_history'));
        if (snapshot.exists()) {
            console.log("Test History Sample:");
            const data = snapshot.val();
            const firstUser = Object.keys(data)[0];
            const firstAttempt = Object.keys(data[firstUser])[0];
            console.log(JSON.stringify(data[firstUser][firstAttempt], null, 2));
        } else {
            console.log("No test history found.");
        }

        const userSnapshot = await get(child(ref(db), 'users'));
        if (userSnapshot.exists()) {
            console.log("\nCategories found:");
            const users = userSnapshot.val();
            const categories = new Set();
            Object.values(users).forEach(u => {
                if (u.profile && u.profile.category) categories.add(u.profile.category);
            });
            console.log(Array.from(categories));
        }
    } catch (error) {
        console.error(error);
    }
    process.exit();
}

checkData();
