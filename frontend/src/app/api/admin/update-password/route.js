import { NextResponse } from 'next/server';
import { rtdb } from '@/firebase';
import { ref, get, update } from 'firebase/database';

export async function POST(request) {
    try {
        const body = await request.json();
        const { username, oldPassword, newPassword } = body;

        const adminsRef = ref(rtdb, 'admins');
        const snapshot = await get(adminsRef);
        
        if (snapshot.exists()) {
            const admins = snapshot.val();
            let targetAdminId = null;
            let isValid = false;

            for (const key in admins) {
                if (admins[key].username === username && admins[key].password === oldPassword) {
                    targetAdminId = key;
                    isValid = true;
                    break;
                }
            }

            if (isValid && targetAdminId) {
                const adminRef = ref(rtdb, `admins/${targetAdminId}`);
                await update(adminRef, { password: newPassword });
                return NextResponse.json({ success: true, message: 'Password berhasil diubah' });
            }
        }

        // Mock default admin check
        if (!snapshot.exists() && username === 'admin' && oldPassword === 'admin123') {
             return NextResponse.json({ success: false, message: 'Harap buat akun admin baru terlebih dahulu di menu Admin' }, { status: 400 });
        }

        return NextResponse.json({ success: false, message: 'Password lama salah atau user tidak ditemukan' }, { status: 400 });
    } catch (error) {
        console.error("Update Password Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
