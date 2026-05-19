import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

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

export { rtdb };