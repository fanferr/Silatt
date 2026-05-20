"use client";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';

import { User, Activity, Trash2, UserPlus, Users, Zap, TrendingUp, Info, History } from 'lucide-react';
import HistoryModal from '@/components/HistoryModal';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { rtdb } from "@/firebase";
import { ref, onValue, remove } from "firebase/database";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogClose,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CATEGORIES = ["Usia dini A", "Usia dini B", "Pra remaja", "Remaja", "Dewasa"];

const StatCard = ({ title, value, icon: Icon, color }) => (
    <Card className="glass-card overflow-hidden transition-all hover:scale-[1.02] shadow-xl border-none">
        <CardContent className="p-6">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
                    <h3 className="text-3xl font-black mt-1 italic tracking-tighter">{value}</h3>
                </div>
                <div className={cn("p-4 rounded-[1.25rem]", color)}>
                    <Icon size={24} />
                </div>
            </div>
        </CardContent>
    </Card>
);

const Dashboard = () => {
    const [athletes, setAthletes] = useState([]);
    const [sensorStatus, setSensorStatus] = useState('Memeriksa...');
    const [sensorColor, setSensorColor] = useState('text-slate-400 bg-slate-50');
    
    const [selectedAthlete, setSelectedAthlete] = useState(null);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [categoryFilter, setCategoryFilter] = useState('all');




    // Cek status sensor IoT dari Firebase RTDB (timestamp heartbeat)
    // Firmware menulis Unix timestamp ke /system/last_seen setiap 8 detik
    // Dashboard cek apakah timestamp sudah >15 detik → Offline
    useEffect(() => {
        const lastSeenRef = ref(rtdb, '/system/last_seen');
        let lastSeenValue = 0;
        let checkInterval = null;

        const unsubscribe = onValue(lastSeenRef, (snapshot) => {
            const ts = snapshot.val();
            if (ts && ts > 0) {
                lastSeenValue = ts; // Unix timestamp dari firmware
            }
        });

        // Cek staleness setiap 5 detik
        checkInterval = setInterval(() => {
            if (lastSeenValue === 0) {
                setSensorStatus('Tidak Terdeteksi');
                setSensorColor('text-slate-400 bg-slate-50');
                return;
            }
            const nowSec = Math.floor(Date.now() / 1000);
            const ageSeconds = nowSec - lastSeenValue;

            if (ageSeconds <= 15) {
                // Heartbeat masih segar → Online
                setSensorStatus('Online');
                setSensorColor('text-emerald-600 bg-emerald-50');
            } else {
                // Heartbeat sudah lama → alat mati/putus
                setSensorStatus('Offline');
                setSensorColor('text-red-500 bg-red-50');
            }
        }, 5000);

        return () => {
            unsubscribe();
            clearInterval(checkInterval);
        };
    }, []);





    useEffect(() => {
        const usersRef = ref(rtdb, 'users');
        const unsubscribe = onValue(usersRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const athletesArray = Object.keys(data).map(key => {
                    const u = data[key] || {};
                    const p = u.profile || {};
                    return {
                        id: String(key),
                        name: String(p.name || u.name || 'Unknown'),
                        category: String(p.category || u.category || 'N/A'),
                        rfid_tag: String(p.rfid_tag || u.rfid_tag || key),
                        age: Number(p.age || u.age || 0),
                        height: Number(p.height || u.height || 0),
                        weight: Number(p.weight || u.weight || 0)
                    };
                });
                setAthletes(athletesArray);
            } else {
                setAthletes([]);
            }
        });

        return () => unsubscribe();
    }, []);

    const deleteAthlete = async (id) => {
        if (!id) return;
        try {
            // 1. Hapus dari Firebase (Data Profil)
            await remove(ref(rtdb, `users/${id}`));
            
            // 2. Hapus dari Firebase (Data Riwayat) - Sangat Penting!
            // Kita hapus di kedua path yang mungkin digunakan
            await remove(ref(rtdb, `test_history/${id}`));
            await remove(ref(rtdb, `attempts/${id}`));
            
            console.log(`Athlete ${id} and all associated data deleted successfully.`);
        } catch (err) {
            console.error("Failed to delete athlete and data", err);
        }
    };

    const getCategoryStyles = (category) => {
        const cat = String(category || '').toLowerCase();
        if (cat.includes('dini')) return "bg-blue-100 text-blue-700 border-blue-200";
        if (cat.includes('remaja')) return "bg-emerald-100 text-emerald-700 border-emerald-200";
        if (cat.includes('dewasa')) return "bg-purple-100 text-purple-700 border-purple-200";
        return "bg-slate-100 text-slate-700";
    };

    const avgAge = athletes.length > 0 ? (athletes.reduce((acc, a) => acc + (Number(a.age) || 0), 0) / athletes.length).toFixed(1) : "0";

    return (
        <div className="space-y-10 animate-in fade-in duration-700">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black tracking-tighter text-slate-900 md:text-6xl italic uppercase">
                        Dashboard <span className="text-primary">PRO</span>
                    </h1>
                    <p className="text-slate-500 mt-2 text-lg max-w-2xl font-bold uppercase tracking-widest text-[10px]">
                        Monitoring Impact & Manajemen Atlet Real-time
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-4">
                    <Link href="/register">
                        <Button size="lg" className="rounded-[1.5rem] px-8 h-16 text-base font-black shadow-2xl shadow-primary/30 transition-all hover:scale-105 active:scale-95 italic">
                            <UserPlus className="mr-2 h-6 w-6" /> DAFTARKAN ATLET
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <StatCard title="Total Atlet" value={athletes.length} icon={Users} color="text-blue-600 bg-blue-50" />
                <StatCard title="Rata-rata Umur" value={`${avgAge} th`} icon={TrendingUp} color="text-emerald-600 bg-emerald-50" />
                <StatCard title="Sensor IoT" value={sensorStatus} icon={Zap} color={sensorColor} />
            </div>

            <Separator className="opacity-50" />

            {/* Athlete List Section */}
            <div className="space-y-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <h2 className="text-3xl font-black italic uppercase tracking-tighter">Katalog Atlet</h2>
                        <Badge variant="secondary" className="bg-slate-900 text-white rounded-lg px-3 py-1 text-xs">
                            {athletes.length} REKOD
                        </Badge>
                    </div>

                    <div className="flex items-center gap-3">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Filter:</span>
                        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                            <SelectTrigger className="w-[180px] h-11 rounded-xl bg-white border-black/5 shadow-sm font-bold text-xs uppercase tracking-wider">
                                <SelectValue placeholder="Pilih Kategori" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-none shadow-2xl">
                                <SelectItem value="all" className="text-xs font-bold uppercase">Semua Kategori</SelectItem>
                                {CATEGORIES.map(cat => (
                                    <SelectItem key={cat} value={cat} className="text-xs font-bold uppercase">{cat}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 pb-20">
                    {athletes
                        .filter(a => categoryFilter === 'all' || a.category === categoryFilter)
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((athlete) => (
                        <Card key={athlete.id} className="group glass-card border-none hover:ring-4 hover:ring-primary/10 transition-all duration-700 overflow-hidden shadow-2xl rounded-[3rem]">
                            <CardHeader className="p-0">
                                <div className="h-28 bg-slate-100 relative overflow-hidden">
                                     <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
                                     <div className="absolute -bottom-6 left-8 p-1.5 bg-white rounded-[1.5rem] shadow-2xl">
                                        <div className="w-20 h-20 rounded-[1.2rem] bg-slate-950 flex items-center justify-center text-white text-3xl font-black italic">
                                            {String(athlete.name || "?").charAt(0).toUpperCase()}
                                        </div>
                                    </div>
                                    <div className="absolute top-6 right-8">
                                        <Badge variant="outline" className="border-black/5 bg-white/50 backdrop-blur-md font-black text-[9px] tracking-[0.2em] px-3 py-1.5 uppercase rounded-full">
                                            ID: {String(athlete.id || "N/A").slice(-6)}
                                        </Badge>
                                    </div>
                                </div>
                                <div className="pt-12 px-10 pb-4">
                                    <CardTitle className="text-3xl font-black tracking-tighter italic uppercase group-hover:text-primary transition-colors leading-none">
                                        {athlete.name}
                                    </CardTitle>
                                    <div className={cn("inline-block mt-3 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border", getCategoryStyles(athlete.category))}>
                                        {athlete.category}
                                    </div>
                                </div>
                            </CardHeader>

                            <CardContent className="px-10 pb-10">
                                <div className="grid grid-cols-3 gap-6 py-6 border-y border-black/5 mb-8">
                                    <div className="text-center">
                                        <p className="text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest">Umur</p>
                                        <p className="text-lg font-black italic">{athlete.age} <span className="text-[10px] opacity-40">TH</span></p>
                                    </div>
                                    <div className="text-center border-x border-black/5">
                                        <p className="text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest">Tinggi</p>
                                        <p className="text-lg font-black italic">{athlete.height} <span className="text-[10px] opacity-40">CM</span></p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest">Berat</p>
                                        <p className="text-lg font-black italic">{athlete.weight} <span className="text-[10px] opacity-40">KG</span></p>
                                    </div>
                                </div>

                                <div className="flex gap-4">
                                    <Link href={`/live-test/${athlete.id}`} className="flex-1">
                                        <Button className="w-full rounded-2xl font-black uppercase text-xs tracking-widest h-14 shadow-xl shadow-primary/20 bg-primary hover:bg-primary/90 hover:scale-[1.03] transition-transform italic">
                                            <Activity className="w-4 h-4 mr-2" /> Live Test
                                        </Button>
                                    </Link>
                                    <Button 
                                        variant="outline" 
                                        onClick={() => { setSelectedAthlete(athlete); setIsHistoryOpen(true); }}
                                        className="h-14 w-14 rounded-2xl border-black/5 hover:border-primary/20 hover:text-primary transition-all"
                                        title="Lihat Riwayat"
                                    >
                                        <TrendingUp size={20} />
                                    </Button>
                                    <Dialog>
                                        <DialogTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-14 w-14 rounded-2xl text-slate-300 hover:text-red-500 hover:bg-red-50 hover:border-red-100 border border-black/5 transition-all">
                                                <Trash2 size={20} />
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="rounded-[3rem] border-none shadow-[0_50px_100px_rgba(0,0,0,0.3)] p-10 max-w-md">
                                            <DialogHeader className="pt-4">
                                                <div className="w-20 h-20 bg-red-100 text-red-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
                                                    <Info size={40} />
                                                </div>
                                                <DialogTitle className="text-3xl font-black text-center italic tracking-tighter uppercase">Hapus Atlet</DialogTitle>
                                                <DialogDescription className="text-center text-slate-500 font-bold mt-2">
                                                    Anda akan menghapus data <span className="text-slate-900">{athlete.name}</span> secara permanen. Tindakan ini tidak dapat dibatalkan.
                                                </DialogDescription>
                                            </DialogHeader>
                                            <DialogFooter className="sm:justify-center gap-4 pt-10">
                                                <DialogClose asChild>
                                                    <Button variant="ghost" className="rounded-2xl px-8 h-14 font-black uppercase text-xs tracking-widest">BATAL</Button>
                                                </DialogClose>
                                                <DialogClose asChild>
                                                    <Button onClick={() => deleteAthlete(athlete.id)} variant="destructive" className="rounded-2xl px-10 h-14 font-black uppercase text-xs tracking-widest shadow-2xl shadow-red-200 italic">
                                                        HAPUS DATA
                                                    </Button>
                                                </DialogClose>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>
                                </div>
                            </CardContent>
                        </Card>
                    ))}

                    {athletes.length === 0 && (
                        <div className="col-span-full py-40 flex flex-col items-center justify-center glass-card border-none rounded-[4rem] text-center">
                            <div className="w-32 h-32 bg-slate-50 rounded-[3rem] flex items-center justify-center mb-10 shadow-inner">
                                <UserPlus size={60} className="text-slate-200" />
                            </div>
                            <h3 className="text-4xl font-black tracking-tighter uppercase italic mb-2">Basis Data Kosong</h3>
                            <p className="text-slate-400 max-w-sm font-bold uppercase tracking-widest text-[10px] mb-12">
                                Daftarkan atlet pertama Anda untuk mulai memantau performa.
                            </p>
                            <Link href="/register">
                                <Button size="lg" className="rounded-[2rem] px-12 h-20 text-lg font-black shadow-2xl shadow-primary/30 rotate-[-2deg] hover:rotate-0 transition-transform italic">
                                    <UserPlus className="mr-3 h-8 w-8" /> DAFTAR SEKARANG
                                </Button>
                            </Link>
                        </div>
                    )}
                </div>
            </div>

            <HistoryModal 
                athlete={selectedAthlete} 
                isOpen={isHistoryOpen} 
                onClose={() => setIsHistoryOpen(false)} 
            />
        </div>
    );
};

export default Dashboard;
