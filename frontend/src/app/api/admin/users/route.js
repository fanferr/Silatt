import { NextResponse } from 'next/server';
import { rtdb } from '@/firebase';
import { ref, get, push, set } from 'firebase/database';

// GET all admins
export async function GET() {
    try {
        const adminsRef = ref(rtdb, 'admins');
        const snapshot = await get(adminsRef);
        
        let adminsArray = [];
        if (snapshot.exists()) {
            const data = snapshot.val();
            adminsArray = Object.keys(data).map(key => ({
                id: key,
                username: data[key].username
            }));
        } else {
            // Default admin if empty
            adminsArray = [{ id: 'default', username: 'admin' }];
        }

        return NextResponse.json(adminsArray);
    } catch (error) {
        console.error("GET Admins Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// POST new admin
export async function POST(request) {
    try {
        const body = await request.json();
        const { username, password } = body;

        const adminsRef = ref(rtdb, 'admins');
        const snapshot = await get(adminsRef);
        
        // Check if username exists
        if (snapshot.exists()) {
            const admins = snapshot.val();
            const exists = Object.values(admins).some(admin => admin.username === username);
            if (exists) {
                return NextResponse.json({ error: 'Username sudah digunakan' }, { status: 400 });
            }
        }

        const newAdminRef = push(adminsRef);
        await set(newAdminRef, {
            username,
            password
        });

        return NextResponse.json({ success: true, message: 'Admin baru ditambahkan', id: newAdminRef.key });
    } catch (error) {
        console.error("POST Admin Error:", error);
        return NextResponse.json({ error: 'Gagal menyimpan admin' }, { status: 500 });
    }
}
