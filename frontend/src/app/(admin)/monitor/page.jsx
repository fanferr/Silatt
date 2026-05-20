"use client";
import React, { useState, useEffect, useRef } from 'react';
import { rtdb } from '@/firebase';
import { ref, onValue, set, off } from 'firebase/database';
import { Badge } from "@/components/ui/badge";
import { 
    Activity, 
    Play, 
    Square, 
    Target, 
    Waves, 
    Zap, 
    MessageSquare,
    TrendingUp,
    RotateCcw
} from "lucide-react";
import { cn } from "@/lib/utils";
import { 
    AreaChart, 
    Area, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    ResponsiveContainer,
    ReferenceLine
} from 'recharts';

const GRAPH_BARS = 50; // Jarak diperlebar (dari sebelumnya 150 titik menjadi 50 titik)

const Monitor = () => {
    const [athletes, setAthletes] = useState([]);
    const [selectedAthlete, setSelectedAthlete] = useState('');
    const [isTesting, setIsTesting] = useState(false);
    const [livePeak, setLivePeak] = useState(0);
    const [liveForce, setLiveForce] = useState(0);
    const [attempts, setAttempts] = useState([]);
    const [forceHistory, setForceHistory] = useState(Array(GRAPH_BARS).fill({ value: 0 }).map((_, i) => ({ time: i, value: 0 })));
    const [currentAttemptIndex, setCurrentAttemptIndex] = useState(0);
    const [animatedValue, setAnimatedValue] = useState(0);
    const [currentSessionId, setCurrentSessionId] = useState(null);
    const [strikeType, setStrikeType] = useState('pukulan');

    // Track live peak locally for immediate responsiveness
    const localPeakRef = useRef(0);
    const isTestingRef = useRef(false); // Ref untuk sinkronisasi dengan listener Firebase

    // 1. Fetch Athletes
    useEffect(() => {
        const r = ref(rtdb, 'users');
        const unsub = onValue(r, (snap) => {
            const data = snap.val();
            if (data) {
                const arr = Object.keys(data).map(key => ({
                    id: String(key),
                    name: String(data[key]?.profile?.name || data[key]?.name || 'Unknown'),
                }));
                setAthletes(arr);
            }
        });
        return () => off(r, 'value', unsub);
    }, []);

    // 2. Load History (Current Session)
    useEffect(() => {
        // Reset seketika saat atlet berubah agar tidak ada sisa data atlet sebelumnya
        setLiveForce(0);
        setLivePeak(0);
        setAnimatedValue(0);
        setForceHistory(Array(GRAPH_BARS).fill({ value: 0 }).map((_, i) => ({ time: i, value: 0 })));

        if (!selectedAthlete) { 
            setAttempts([]); 
            setCurrentSessionId(null);
            return; 
        }

        const r = ref(rtdb, `test_history/${selectedAthlete}`);
        const unsub = onValue(r, (snap) => {
            const data = snap.val();
            if (data && typeof data === 'object') {
                // Find all sessions or legacy attempts
                const sessionKeys = Object.keys(data).filter(k => k.startsWith('session_')).sort().reverse();
                
                // If there are sessions, use the latest one by default (unless we just started a new one)
                // If no sessions but there are legacy attempt_ keys, treat them as a "Legacy" session
                let targetSessionData = null;
                let activeSessionId = currentSessionId;

                if (!activeSessionId) {
                    if (sessionKeys.length > 0) {
                        activeSessionId = sessionKeys[0];
                    } else if (Object.keys(data).some(k => k.startsWith('attempt_'))) {
                        activeSessionId = 'legacy';
                    }
                }

                if (activeSessionId === 'legacy') {
                    targetSessionData = data;
                } else if (activeSessionId) {
                    targetSessionData = data[activeSessionId];
                }

                setCurrentSessionId(activeSessionId);

                if (targetSessionData) {
                    const arr = [];
                    Object.keys(targetSessionData).forEach(k => {
                        if (k.startsWith('attempt_')) {
                            const attemptNum = parseInt(k.replace('attempt_', ''));
                            arr.push({
                                number: attemptNum,
                                peak: Number(targetSessionData[k]?.peak_newton || 0)
                            });
                        }
                    });
                    arr.sort((a, b) => a.number - b.number);
                    setAttempts(arr);
                } else {
                    setAttempts([]);
                }
            } else {
                setAttempts([]);
                setCurrentSessionId(null);
            }
        });
        return () => off(r, 'value', unsub);
    }, [selectedAthlete, currentSessionId]);

    // 3. Real-time Listeners
    useEffect(() => {
        const sRef = ref(rtdb, 'system/test_status');
        const lRef = ref(rtdb, 'realtime/current_force');
        const pRef = ref(rtdb, 'realtime/peak_force');

        const unsubS = onValue(sRef, (s) => {
            const status = s.val();
            const testing = status === 'measuring' || status === 'waiting';
            setIsTesting(testing);
            isTestingRef.current = testing; // Update ref juga
            if (!testing) {
                // Test selesai, reset local peak
                localPeakRef.current = 0;
            }
        });

        const unsubL = onValue(lRef, (s) => {
            const val = Number(s.val() || 0);
            setLiveForce(val);
            // Update local peak tracking
            if (val > localPeakRef.current) {
                localPeakRef.current = val;
            }
            // Rolling graph history (Muncul dari kiri ke kanan)
            setForceHistory(prev => {
                const newData = { time: 0, value: val };
                // Masukkan data baru di awal [newData], buang yang terakhir di belakang
                const updated = [newData, ...prev.slice(0, -1)];
                // Maintain indices for re-rendering
                return updated.map((d, idx) => ({ ...d, time: idx }));
            });
        });

        const unsubP = onValue(pRef, (s) => setLivePeak(Number(s.val() || 0)));

        return () => {
            off(sRef, 'value', unsubS);
            off(lRef, 'value', unsubL);
            off(pRef, 'value', unsubP);
        };
    }, []);

    // 4. Count-up Animation Logic
    useEffect(() => {
        if (!isTesting) {
            // Jangan reset ke 0 agar angka tetap stay di layar setelah selesai
            return;
        }

        let animationFrame;
        const animate = () => {
            setAnimatedValue(prev => {
                if (prev < livePeak) {
                    // Cepat bertambah jika selisih besar, melambat jika dekat
                    const diff = livePeak - prev;
                    const step = Math.max(1, Math.ceil(diff / 5)); // "urut" atau sequential cepat
                    return Math.min(livePeak, prev + step);
                }
                return prev;
            });
            animationFrame = requestAnimationFrame(animate);
        };

        animationFrame = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationFrame);
    }, [livePeak, isTesting]);

    const startTest = async () => {
        if (!selectedAthlete) return;
        
        // Cek apakah sesi saat ini sudah penuh (3 percobaan selesai)
        const isSessionFull = attempts.length >= 3 && attempts.every(a => a.peak > 0);
        let sessionId = currentSessionId;

        // Mulai sesi baru jika sesi lama penuh atau belum ada sesi/Legacy
        if (!sessionId || isSessionFull || sessionId === 'legacy') {
            sessionId = `session_${new Date().getTime()}`;
            setCurrentSessionId(sessionId);
            setAttempts([]); // Reset UI lokal seketika
        }

        // Temukan slot pertama (1, 2, atau 3) yang masih kosong di sesi ini
        const firstEmptySlot = [1, 2, 3].find(num => {
            const found = attempts.find(a => a.number === num);
            return !found || found.peak <= 0;
        }) || 1; 
        
        const nextId = firstEmptySlot;
        setCurrentAttemptIndex(nextId - 1); 
        
        console.log(`Starting test for ${selectedAthlete} in session ${sessionId} slot ${nextId}`);
        
        // Reset semua nilai sebelum sesi baru
        localPeakRef.current = 0;
        await set(ref(rtdb, 'realtime/current_force'), 0);
        await set(ref(rtdb, 'realtime/peak_force'), 0);
        setLivePeak(0);
        setLiveForce(0);
        setAnimatedValue(0);
        setForceHistory(Array(GRAPH_BARS).fill({ value: 0 }).map((_, i) => ({ time: i, value: 0 })));
        
        // Trik: UID diisi path 'athleteId/sessionId' agar firmware menyimpan ke folder tersebut
        await set(ref(rtdb, 'test_command'), `${selectedAthlete}/${sessionId}|${nextId}|${strikeType}`);
    };

    const stopTest = async () => {
        await set(ref(rtdb, 'system/test_status'), 'idle');
        await set(ref(rtdb, 'test_command'), '');
    };

    const resetAttempts = async () => {
        if (!selectedAthlete || isTesting) return;
        
        if (currentSessionId && currentSessionId !== 'legacy') {
            // Hanya hapus sesi yang aktif saat ini, jangan hapus seluruh riwayat atlet
            await set(ref(rtdb, `test_history/${selectedAthlete}/${currentSessionId}`), null);
        } else {
            await set(ref(rtdb, `test_history/${selectedAthlete}`), null);
        }
        
        setAttempts([]);
    };

    const currentAthlete = athletes.find(a => a.id === selectedAthlete);

    // Display values
    // PERBAIKAN: Jika atlet belum dipilih, paksa angka ke 0. Jika sudah, gunakan logika persistence.
    const latestAttemptPeak = attempts.length > 0 ? attempts[attempts.length - 1].peak : 0;
    
    const displayForce = !selectedAthlete ? 0 : (isTesting ? animatedValue : (liveForce > 0 ? liveForce : latestAttemptPeak));
    const displayPeak  = !selectedAthlete ? 0 : (isTesting ? livePeak  : (livePeak > 0 ? livePeak : latestAttemptPeak));

    // Dynamic scale for graph
    const maxGraph = Math.max(...forceHistory.map(d => d.value), 100);

    // Font size based on digit count
    const gaugeFontSize = displayForce >= 10000
        ? 'text-[7rem]'
        : displayForce >= 1000
        ? 'text-[10rem]'
        : displayForce >= 100
        ? 'text-[13rem]'
        : 'text-[16rem]';

    return (
        <div className="flex flex-col xl:flex-row gap-8 animate-in fade-in duration-500">

            {/* ─── Sidebar Kiri: SESI LATIHAN ────────────────────────── */}
            <div className="w-full xl:w-96 space-y-6">
                <div className="glass-card rounded-[3rem] overflow-hidden border-none shadow-2xl relative">
                    <div className="h-2 w-full bg-slate-900 absolute top-0 left-0" />
                    <div className="p-8 pt-10">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center text-primary shadow-lg">
                                <Activity size={24} />
                            </div>
                            <div>
                                <h2 className="text-xl font-black italic uppercase tracking-tighter">Sesi Latihan</h2>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Konfigurasi audit performa</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {/* Pilih Atlet */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Pilih Subjek</label>
                                <select
                                    value={selectedAthlete}
                                    onChange={(e) => setSelectedAthlete(e.target.value)}
                                    disabled={isTesting}
                                    className="w-full h-14 bg-slate-50 border border-black/5 rounded-2xl px-4 font-bold text-slate-900 outline-none focus:border-primary transition-all appearance-none cursor-pointer"
                                    style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'currentColor\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\' /%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1rem' }}
                                >
                                    <option value="">Pilih Atlet dari Daftar</option>
                                    {athletes.map(a => (
                                        <option key={a.id} value={a.id}>{a.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Pilih Jenis Serangan */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Jenis Serangan</label>
                                <div className="flex p-1 bg-slate-100 rounded-2xl gap-1">
                                    <button
                                        onClick={() => setStrikeType('pukulan')}
                                        disabled={isTesting}
                                        className={cn(
                                            "flex-1 h-12 rounded-xl font-bold text-xs transition-all uppercase tracking-widest",
                                            strikeType === 'pukulan' 
                                                ? "bg-white text-primary shadow-sm" 
                                                : "text-slate-400 hover:bg-white/50"
                                        )}
                                    >
                                        Pukulan
                                    </button>
                                    <button
                                        onClick={() => setStrikeType('tendangan')}
                                        disabled={isTesting}
                                        className={cn(
                                            "flex-1 h-12 rounded-xl font-bold text-xs transition-all uppercase tracking-widest",
                                            strikeType === 'tendangan' 
                                                ? "bg-white text-primary shadow-sm" 
                                                : "text-slate-400 hover:bg-white/50"
                                        )}
                                    >
                                        Tendangan
                                    </button>
                                </div>
                            </div>

                            {/* Tombol Mulai / Hentikan */}
                            {!isTesting ? (
                                <button
                                    onClick={startTest}
                                    disabled={!selectedAthlete}
                                    className="w-full h-20 bg-primary text-white rounded-[1.8rem] font-black text-lg italic shadow-2xl shadow-primary/30 active:scale-95 transition-all disabled:opacity-30 flex items-center justify-center gap-3"
                                >
                                    <Play fill="currentColor" size={20} /> MULAI SESI
                                </button>
                            ) : (
                                <button
                                    onClick={stopTest}
                                    className="w-full h-20 bg-red-500 text-white rounded-[1.8rem] font-black text-lg italic shadow-2xl shadow-red-500/30 animate-pulse active:scale-95 transition-all flex items-center justify-center gap-3"
                                >
                                    <Square fill="currentColor" size={20} /> HENTIKAN
                                </button>
                            )}

                            {/* Logging Percobaan */}
                            <div className="pt-8 space-y-4">
                                <div className="flex items-center justify-between">
                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Logging Percobaan</p>
                                    {attempts.length > 0 && !isTesting && (
                                        <button
                                            onClick={resetAttempts}
                                            className="flex items-center gap-1 text-[9px] font-black uppercase text-red-400 hover:text-red-600 tracking-widest transition-colors"
                                            title="Reset semua percobaan"
                                        >
                                            <RotateCcw size={10} /> Reset
                                        </button>
                                    )}
                                </div>
                                {[0, 1, 2].map(i => {
                                    const isActive = isTesting && currentAttemptIndex === i;
                                    const attemptData = attempts[i];
                                    const hasData = attemptData !== undefined;
                                    
                                    // Nilai yang ditampilkan:
                                    // - Jika sedang aktif (testing): tampilkan animatedValue (count-up)
                                    // - Jika sudah selesai: tampilkan peak dari history
                                    // - Jika belum: tampilkan 0
                                    const displayVal = isActive 
                                        ? animatedValue 
                                        : (hasData ? attemptData.peak : 0);

                                    return (
                                        <div key={i} className={cn(
                                            "h-20 rounded-[1.8rem] flex items-center justify-between px-6 border border-black/5 bg-slate-50 transition-all",
                                            isActive && "bg-white shadow-xl ring-2 ring-primary/20 scale-[1.02]"
                                        )}>
                                            <div className="flex items-center gap-4">
                                                <div className={cn("w-10 h-10 rounded-full flex items-center justify-center font-black text-[10px]", isActive ? "bg-primary text-white" : "bg-white text-slate-300 shadow-inner")}>
                                                    {i + 1}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest leading-none mb-1">Attempt {i + 1}</span>
                                                    <span className={cn("text-[10px] font-black uppercase italic", isActive ? "text-primary" : "text-slate-300")}>
                                                        {isActive ? "Recording..." : (hasData ? "Finished" : "Ready")}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className={cn(
                                                "text-2xl font-black italic transition-all",
                                                isActive ? "text-primary animate-pulse" : (hasData ? "text-slate-900" : "text-slate-200")
                                            )}>
                                                {displayVal > 0 ? Number(displayVal).toFixed(0) : "0"} <span className="text-[10px]">N</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── Main: Center + Right ──────────────────────────────── */}
            <div className="flex-1 space-y-8">
                <div className="flex flex-col lg:flex-row gap-8">

                    {/* CENTER GAUGE */}
                    <div className="flex-1 glass-card rounded-[4rem] p-12 shadow-2xl flex flex-col items-center justify-center text-center relative overflow-hidden min-h-[500px] border-none">
                        {/* Decorative circles */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] h-[450px] rounded-full border-[1.5px] border-black/[0.03] flex items-center justify-center pointer-events-none">
                            <div className="w-[300px] h-[300px] rounded-full border border-primary/5" />
                        </div>
                        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-40 h-[1.5px] bg-slate-100" />

                        <Badge className="mb-6 px-6 py-2 rounded-full font-black text-[9px] tracking-[0.3em] uppercase bg-primary/5 text-primary border-primary/10">
                            {isTesting ? "Sensor Active Tracking" : "Sensor Standby Mode"}
                        </Badge>

                        <h2 className="text-slate-400 text-[11px] font-black uppercase tracking-[0.4em] mb-2">Gaya Saat Ini</h2>

                        {/* ANGKA NEWTON */}
                        <div className="flex flex-col items-center justify-center gap-0 relative z-10">
                            <span className={cn(
                                "font-black leading-none italic select-none tracking-tighter",
                                "transition-colors duration-75",
                                displayForce > 0 ? "text-slate-700" : "text-slate-100",
                                gaugeFontSize
                            )}>
                                {displayForce.toFixed(0)}
                            </span>
                            <span className="text-5xl font-black text-primary italic tracking-tighter -mt-8">NEWTON</span>
                        </div>

                        {/* Badge Peak */}
                        <div className={cn(
                            "mt-5 flex items-center gap-2 px-5 py-2 rounded-full transition-all duration-300",
                            isTesting ? "bg-emerald-50 opacity-100" : "opacity-0 pointer-events-none"
                        )}>
                            <TrendingUp size={13} className="text-emerald-500" />
                            <span className="text-[11px] font-black uppercase text-emerald-600 tracking-widest">
                                Peak: {displayPeak.toFixed(0)} N
                            </span>
                        </div>

                        <div className="flex items-center justify-center gap-12 mt-8 w-full max-w-sm">
                            <div className="flex items-center gap-2 text-[10px] font-black uppercase text-emerald-500 tracking-widest">
                                <Target size={14} /> Target: {strikeType === 'pukulan' ? '>150N' : '>250N'}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] font-black uppercase text-primary tracking-widest border-l border-slate-100 pl-12">
                                <Waves size={14} /> Athlete: {currentAthlete?.name || "Pilih Atlet"}
                            </div>
                        </div>
                    </div>

                    {/* RIGHT ANALYSIS CARD */}
                    <div className="w-full lg:w-[400px] space-y-6">
                        <div className="glass-card rounded-[3.5rem] p-8 border-none shadow-2xl h-full">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center shadow-inner">
                                    <Zap size={22} />
                                </div>
                                <h3 className="text-xs font-black uppercase tracking-widest italic">Analisis Dampak</h3>
                            </div>

                            <div className="space-y-8 mt-10">
                                {/* Progress bar - max dinamis sesuai jenis serangan */}
                                {(() => {
                                    const maxN = strikeType === 'pukulan' ? 150 : 300;
                                    const pct = Math.min(100, (displayPeak / maxN) * 100);
                                    return (
                                    <div>
                                        <div className="flex justify-between items-end mb-2">
                                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Efisiensi Serangan</span>
                                            <span className="text-lg font-black italic text-emerald-500">
                                                {pct.toFixed(1)}%
                                            </span>
                                        </div>
                                        <div className="w-full h-2 bg-slate-50 rounded-full p-[2px] shadow-inner overflow-hidden">
                                            <div
                                                className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                        <div className="flex justify-between mt-2 text-[9px] font-black uppercase text-slate-300 tracking-widest">
                                            <span>0 N</span>
                                            <span>{maxN} N</span>
                                        </div>
                                    </div>
                                    );
                                })()}

                                <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:rotate-12 transition-transform">
                                        <MessageSquare size={100} />
                                    </div>
                                    <span className="text-[9px] font-black uppercase text-primary tracking-widest border-b border-primary/20 pb-2 mb-4 block">
                                        Saran Pelatih &mdash; {strikeType === 'pukulan' ? '🥊 Pukulan' : '🦵 Tendangan'}
                                    </span>
                                    <p className="text-sm font-bold italic leading-relaxed text-slate-300">
                                        {strikeType === 'pukulan'
                                            ? displayPeak >= 130
                                                ? '"Pukulan sangat kuat! Pertahankan posisi siku dan rotasi bahu untuk konsistensi."'
                                                : displayPeak >= 80
                                                ? '"Pukulan cukup baik. Tingkatkan dorongan dari bahu dan kunci pergelangan tangan saat impact."'
                                                : displayPeak > 0
                                                ? '"Perkuat koordinasi lengan dan bahu. Fokus pada kecepatan ekstensi siku saat memukul."'
                                                : '"Pilih atlet dan mulai sesi untuk melihat analisis pukulan."'
                                            : displayPeak >= 250
                                                ? '"Tendangan sangat powerful! Pertahankan keseimbangan dan pivot kaki tumpu untuk akurasi."'
                                                : displayPeak >= 150
                                                ? '"Tendangan cukup baik. Tingkatkan rotasi pinggul dan snap pergelangan kaki saat impact."'
                                                : displayPeak > 0
                                                ? '"Fokus pada kecepatan putaran pinggang dan angkat lutut lebih tinggi untuk menambah gaya ledak."'
                                                : '"Pilih atlet dan mulai sesi untuk melihat analisis tendangan."'
                                        }
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* BOTTOM — Live Force Stream Graph */}
                <div className="glass-card rounded-[3.5rem] p-10 border-none shadow-2xl min-h-[300px] relative overflow-hidden">
                    <div className="flex items-center justify-between mb-8 relative z-10">
                        <div>
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-red-50 text-red-500 rounded-lg">
                                    <Waves size={20} />
                                </div>
                                <h3 className="text-2xl font-black italic uppercase tracking-tighter">Live Force Stream</h3>
                            </div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Osiloskop gaya real-time dari sensor.</p>
                        </div>
                        <div className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-500 rounded-full">
                            <div className={cn("w-2 h-2 rounded-full bg-red-500", isTesting && "animate-pulse")} />
                            <span className="text-[10px] font-black uppercase tracking-widest">
                                {isTesting ? "Live" : "Idle"}
                            </span>
                        </div>
                    </div>

                    {/* Real-time Oscilloscope Waveform */}
                    <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={forceHistory} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorForce" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.03)" />
                                <XAxis hide dataKey="time" />
                                <YAxis 
                                    hide 
                                    domain={[0, maxGraph]} 
                                />
                                <Area
                                    type="monotone"
                                    dataKey="value"
                                    stroke="#3b82f6"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorForce)"
                                    isAnimationActive={false}
                                />
                                {isTesting && (
                                    <ReferenceLine y={livePeak} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'right', value: `Peak: ${livePeak}N`, fill: '#ef4444', fontSize: 10, fontWeight: 'bold' }} />
                                )}
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="flex justify-between mt-6 text-[9px] font-black uppercase text-slate-300 tracking-widest px-2">
                        <span>Timeline (5s)</span>
                        <span>{(maxGraph / 2).toFixed(0)} N</span>
                        <span>Max Scale: {maxGraph.toFixed(0)} N</span>
                    </div>

                    <div className="absolute bottom-0 left-0 w-full h-[1.5px] bg-slate-100" />
                </div>
            </div>
        </div>
    );
};

export default Monitor;
