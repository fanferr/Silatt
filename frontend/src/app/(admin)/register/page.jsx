"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { rtdb } from '@/firebase';
import { ref, onValue, set, get } from 'firebase/database';
import { Radio, Scan, Save, User as UserIcon, Calendar, Ruler, Weight, Tag, Activity } from 'lucide-react';
import { Card, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

const CATEGORIES = ["Usia dini A", "Usia dini B", "Pra remaja", "Remaja", "Dewasa"];

const Register = () => {
    const router = useRouter();

    const [formData, setFormData] = useState({
        name: '',
        age: '',
        height: '',
        weight: '',
        category: 'Usia dini A',
        rfid_tag: ''
    });

    const [scanning, setScanning] = useState(true);
    const [loading, setLoading] = useState(false);
    const [rfidError, setRfidError] = useState('');

    // ================= RFID LISTENER =================
    useEffect(() => {
        const scannedRef = ref(rtdb, 'system/last_scanned');

        const unsubscribe = onValue(scannedRef, async (snapshot) => {
            const val = snapshot.val();
            if (val && typeof val === 'string') {
                try {
                    const userRef = ref(rtdb, `users/${val}`);
                    const userSnap = await get(userRef);
                    
                    if (userSnap.exists()) {
                        setRfidError("UID sudah terdaftar!");
                        setFormData(prev => ({ ...prev, rfid_tag: '' }));
                        setScanning(true);
                        
                        await set(scannedRef, ""); // Reset system/last_scanned
                        
                        // Clear error message after 3 seconds
                        setTimeout(() => setRfidError(''), 3000);
                    } else {
                        setRfidError('');
                        setFormData(prev => ({ ...prev, rfid_tag: val }));
                        setScanning(false);
                    }
                } catch (error) {
                    console.error("Error checking UID:", error);
                }
            }
        });

        return () => unsubscribe();
    }, []);

    // ================= HANDLE INPUT =================
    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    // ================= SUBMIT =================
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.rfid_tag) {
            alert('Silakan scan kartu RFID terlebih dahulu.');
            return;
        }

        setLoading(true);

        try {
            const uid = formData.rfid_tag;

            const payload = {
                ...formData,
                id: uid,
                createdAt: new Date().toISOString()
            };

            const userRef = ref(rtdb, `users/${uid}`);

            await set(userRef, {
                profile: payload,
                total_tests: 0,
                best_power: 0
            });

            // 🔥 RESET RFID (PENTING)
            await set(ref(rtdb, "system/last_scanned"), "");

            alert('✅ Data berhasil disimpan');

            // reset form
            setFormData({
                name: '',
                age: '',
                height: '',
                weight: '',
                category: 'Usia dini A',
                rfid_tag: ''
            });

            setScanning(true);

            router.push('/');

        } catch (err) {
            alert('❌ Gagal: ' + err.message);
        }

        setLoading(false);
    };

    return (
        <div className="flex justify-center items-center py-10">
            <Card className="w-full max-w-3xl rounded-[3rem] shadow-2xl overflow-hidden">

                {/* HEADER */}
                <div className="bg-slate-900 text-white p-10">
                    <CardTitle className="text-3xl font-black flex items-center gap-3">
                        <Scan /> PENDAFTARAN ATLET
                    </CardTitle>
                    <CardDescription className="text-slate-400 mt-2">
                        Integrasi RFID & Sistem ImpactMonitor
                    </CardDescription>
                </div>

                <form onSubmit={handleSubmit} className="p-10 space-y-10">

                    {/* IDENTITAS */}
                    <div>
                        <Label>Nama</Label>
                        <Input name="name" value={formData.name} onChange={handleChange} required />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Umur</Label>
                            <Input type="number" min="1" name="age" value={formData.age} onChange={handleChange} required />
                        </div>
                        <div>
                            <Label>Kategori</Label>
                            <Select
                                value={formData.category}
                                onValueChange={(val) => setFormData(prev => ({ ...prev, category: val }))}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {CATEGORIES.map(cat => (
                                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <Separator />

                    {/* FISIK */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Tinggi</Label>
                            <Input type="number" min="1" name="height" value={formData.height} onChange={handleChange} required />
                        </div>
                        <div>
                            <Label>Berat</Label>
                            <Input type="number" min="1" name="weight" value={formData.weight} onChange={handleChange} required />
                        </div>
                    </div>

                    <Separator />

                    {/* RFID */}
                    <div className={`p-8 border-4 border-dashed text-center rounded-2xl transition-colors
                        ${rfidError ? 'border-red-500 bg-red-100 text-red-700' : 
                          (scanning ? 'border-blue-300 animate-pulse' : 'border-green-500 bg-green-100')}
                    `}>
                        <Radio className={`mx-auto mb-3 ${rfidError ? 'text-red-500' : ''}`} size={40} />
                        <p className={`font-bold text-lg ${rfidError ? 'text-red-700' : ''}`}>
                            {rfidError ? 'UID SUDAH TERDAFTAR' : (formData.rfid_tag || 'DEKATKAN KARTU')}
                        </p>
                        <p className={`text-sm ${rfidError ? 'text-red-600' : 'text-gray-500'}`}>
                            {rfidError ? 'Gunakan kartu lain' : (scanning ? 'Menunggu scan...' : 'RFID terdeteksi')}
                        </p>
                    </div>

                    {/* BUTTON */}
                    <Button
                        type="submit"
                        className="w-full"
                        disabled={loading || scanning || !formData.name || !formData.age || !formData.height || !formData.weight}
                    >
                        {loading ? 'Menyimpan...' : 'Simpan'}
                    </Button>

                </form>
            </Card>
        </div>
    );
};

export default Register;