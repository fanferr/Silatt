import { NextResponse } from 'next/server';
import { rtdb } from '@/firebase';
import { ref, get } from 'firebase/database';

export async function POST(request) {
    try {
        const body = await request.json();
        const { username, password } = body;

        const adminsRef = ref(rtdb, 'admins');
        const snapshot = await get(adminsRef);
        
        if (snapshot.exists()) {
            const admins = snapshot.val();
            let isAuthenticated = false;
            let loggedInUser = null;

            for (const key in admins) {
                if (admins[key].username === username && admins[key].password === password) {
                    isAuthenticated = true;
                    loggedInUser = admins[key].username;
                    break;
                }
            }

            if (isAuthenticated) {
                return NextResponse.json({ success: true, token: 'mock-admin-token-firebase', username: loggedInUser });
            }
        }

        // Fallback default admin if no admins exist in Firebase yet
        if (!snapshot.exists() && username === 'admin' && password === 'admin123') {
            return NextResponse.json({ success: true, token: 'mock-admin-token-fallback', username: 'admin' });
        }

        return NextResponse.json({ success: false, message: 'Username atau Password salah' }, { status: 401 });
    } catch (error) {
        console.error("Login Error:", error);
        return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
}
