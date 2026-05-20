import { NextResponse } from 'next/server';
import { rtdb } from '@/firebase';
import { ref, remove } from 'firebase/database';

export async function DELETE(request, { params }) {
    try {
        const { id } = params;
        if (!id || id === 'default') {
            return NextResponse.json({ error: 'Cannot delete this admin' }, { status: 400 });
        }

        const adminRef = ref(rtdb, `admins/${id}`);
        await remove(adminRef);

        return NextResponse.json({ success: true, message: 'Admin deleted' });
    } catch (error) {
        console.error("DELETE Admin Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
