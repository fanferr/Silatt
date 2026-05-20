"use client";
import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { rtdb } from '@/firebase';
import { ref, onValue, get, set, off, remove } from 'firebase/database';
import { Play, Square, Activity, Target, Zap, Waves, ChevronUp, RotateCcw } from 'lucide-react';
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

const GRAPH_BARS = 150;

const LiveTest = () => {
    const { id } = useParams();
    const [athlete, setAthlete] = useState(null);
    const [currentForce, setCurrentForce] = useState(0);
    const [sessionPeak, setSessionPeak] = useState(0);
    const [attempts, setAttempts] = useState([]);
    const [isTesting, setIsTesting] = useState(false);
    const [bestScore, setBestScore] = useState(0);
    const [forceHistory, setForceHistory] = useState(Array(GRAPH_BARS).fill({ value: 0 }).map((_, i) => ({ time: i, value: 0 })));
    const [strikeType, setStrikeType] = useState('pukulan');

    // 1. Fetch Athlete Details
    useEffect(() => {
        const fetchAthlete = async () => {
            try {
                const athleteRef = ref(rtdb, `users/${id}`);
                const snapshot = await get(athleteRef);
                if (snapshot.exists()) {
                    const data = snapshot.val();
                    setAthlete(data.profile ? { ...data.profile, id } : { id, ...data });
                }
            } catch (err) {
                console.error("Error fetching athlete:", err);
            }
        };
        fetchAthlete();
    }, [id]);

    // 2. Listen to Live Data and History
    useEffect(() => {
        if (!id) return;

        const statusRef = ref(rtdb, 'system/test_status');
        const liveRef = ref(rtdb, 'realtime/current_force');
        const historyRef = ref(rtdb, `test_history/${id}`);

        onValue(statusRef, (snapshot) => {
            const status = snapshot.val();
            const testing = status === 'measuring';
            setIsTesting(testing);
            if (testing) {
                setSessionPeak(0);
                setCurrentForce(0);
            }
        });

        onValue(liveRef, (snapshot) => {
            const force = Number(snapshot.val() || 0);
            setCurrentForce(force);
            if (force > sessionPeak) {
                setSessionPeak(force);
            }
            // Rolling graph history (Muncul dari kanan ke kiri - sinkron dengan Monitor)
            setForceHistory(prev => {
                const newData = { time: 0, value: force };
                // Masukkan data baru di awal [newData], buang yang terakhir di belakang
                const updated = [newData, ...prev.slice(0, -1)];
                // Maintain indices for re-rendering
                return updated.map((d, idx) => ({ ...d, time: idx }));
            });
        });

        onValue(historyRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const attemptArray = [];
                let max = 0;
                Object.keys(data).forEach(key => {
                    if (key.startsWith('attempt_')) {
                        const score = data[key].peak_newton || 0;
                        attemptArray.push({
                            attemptNumber: key.split('_')[1],
                            force: score
                        });
                        if (score > max) max = score;
                    }
                });
                setAttempts(attemptArray.sort((a, b) => a.attemptNumber - b.attemptNumber));
                setBestScore(max);
            }
        });

        return () => {
            off(statusRef);
            off(liveRef);
            off(historyRef);
        };
    }, [id, sessionPeak]);

    const handleStart = async () => {
        if (!id) return;
        try {
            const nextAttempt = attempts.length + 1;
            // Format command: ID|Attempt|StrikeType
            await set(ref(rtdb, 'test_command'), `${id}|${nextAttempt}|${strikeType}`);
        } catch (err) {
            console.error("Failed to start test:", err);
        }
    };

    const resetAttempts = async () => {
        if (!id || isTesting) return;
        try {
            await remove(ref(rtdb, `test_history/${id}`));
            setAttempts([]);
            setBestScore(0);
        } catch (err) {
            console.error("Failed to reset attempts:", err);
        }
    };

    const handleStop = async () => {
        try {
            await set(ref(rtdb, 'system/test_status'), 'idle');
            await set(ref(rtdb, 'test_command'), '');
        } catch (err) {
            console.error("Failed to stop test:", err);
        }
    };

    if (!athlete) return <div className="text-center p-20 text-slate-400 font-bold italic">Memuat Data Atlet...</div>;

    const forcePercentage = Math.min(100, (currentForce / 1000) * 100);
    const peakPercentage = Math.min(100, (sessionPeak / 1000) * 100);

    // Font size based on digit count (Sinkron dengan Monitor)
    const gaugeFontSize = currentForce >= 10000
        ? 'text-[5rem] md:text-[7rem]'
        : currentForce >= 1000
        ? 'text-[7rem] md:text-[10rem]'
        : currentForce >= 100
        ? 'text-[9rem] md:text-[13rem]'
        : 'text-[11rem] md:text-[16rem]';

    return (
        <div className="space-y-6 max-w-7xl mx-auto p-4 animate-in fade-in duration-700">
            {/* Header Section */}
            <header className="flex flex-col lg:row justify-between items-center bg-slate-900 text-white p-8 rounded-[3rem] shadow-2xl gap-8 border border-white/5 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:rotate-12 transition-transform duration-1000">
                    <Zap className="w-40 h-40" />
                </div>
                
                <div className="flex items-center gap-8 relative z-10 w-full lg:w-auto">
                    <div className="relative">
                        <div className="w-24 h-24 rounded-3xl bg-primary flex items-center justify-center border-4 border-white/10 shadow-inner group-hover:scale-110 transition-transform">
                            <span className="text-4xl font-black italic">{athlete.name?.charAt(0)}</span>
                        </div>
                        {isTesting && (
                            <div className="absolute -top-2 -right-2 bg-red-500 w-6 h-6 rounded-full animate-ping" />
                        )}
                    </div>
                    <div>
                        <h1 className="text-5xl font-black tracking-tighter italic uppercase leading-none mb-2">{athlete.name}</h1>
                        <div className="flex gap-4">
                            <span className="bg-white/10 px-3 py-1 rounded-full text-[10px] font-black tracking-[0.2em] uppercase">{athlete.category || 'Atlete'}</span>
                            <span className="bg-white/10 px-3 py-1 rounded-full text-[10px] font-black tracking-[0.2em] uppercase">{athlete.weight || '-'} KG</span>
                        </div>
                    </div>
                </div>

                <div className="flex gap-6 w-full lg:w-auto">
                    <div className="bg-white/5 p-6 rounded-[2rem] border border-white/10 flex-1 lg:min-w-[200px] text-center">
                        <span className="block text-slate-500 text-[10px] uppercase font-black tracking-widest mb-1">Impact Tertinggi</span>
                        <span className="text-5xl font-black text-primary italic tracking-tighter">
                            {bestScore.toFixed(0)} <span className="text-sm">N</span>
                        </span>
                    </div>
                    <div className="bg-white/5 p-6 rounded-[2rem] border border-white/10 flex-1 lg:min-w-[200px] text-center">
                        <span className="block text-slate-500 text-[10px] uppercase font-black tracking-widest mb-1">Status Sistem</span>
                        <span className={cn(
                            "text-xl font-black italic uppercase tracking-widest",
                            isTesting ? "text-red-500" : "text-emerald-500"
                        )}>
                            {isTesting ? "MEASURING" : "READY"}
                        </span>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Main Gauge Display */}
                <div className="lg:col-span-3 space-y-8">
                    <div className="bg-white rounded-[4rem] shadow-2xl p-12 border border-black/5 flex flex-col md:flex-row gap-12 min-h-[650px] relative overflow-hidden">
                        
                        {/* Background Deco */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[20rem] font-black text-black/[0.02] select-none italic tracking-tighter">
                            FORCE
                        </div>

                        {/* Power Meter Vertical */}
                        <div className="relative w-full md:w-40 h-[450px] md:h-full bg-slate-100 rounded-[3rem] p-4 flex flex-col-reverse group">
                            {/* Scale Indicators */}
                            <div className="absolute -left-10 h-[80%] my-auto inset-y-0 flex flex-col justify-between text-[10px] font-black text-slate-400">
                                <span>1000</span>
                                <span>750</span>
                                <span>500</span>
                                <span>250</span>
                                <span>0</span>
                            </div>

                            {/* The Main Power Bar */}
                            <div 
                                className={cn(
                                    "w-full rounded-[2.5rem] transition-all duration-300 ease-out shadow-2xl relative",
                                    currentForce > 800 ? "bg-gradient-to-t from-orange-500 to-red-600" :
                                    currentForce > 400 ? "bg-gradient-to-t from-emerald-400 to-yellow-500" :
                                    "bg-gradient-to-t from-blue-500 to-emerald-400"
                                )}
                                style={{ height: `${forcePercentage}%` }}
                            >
                                {/* Impact Glow */}
                                <div className="absolute top-0 left-0 w-full h-full bg-white opacity-20 blur-xl animate-pulse" />
                            </div>

                            {/* Ghost Peak Marker */}
                            <div 
                                className="absolute left-1/2 -translate-x-1/2 w-[calc(100%+16px)] h-1 bg-slate-400 shadow-lg z-10 transition-all duration-700"
                                style={{ bottom: `calc(${peakPercentage}% + 16px)` }}
                            >
                                <div className="absolute right-0 -top-6 text-[10px] font-black bg-slate-400 text-white px-2 py-1 rounded-md">
                                    PEAK: {sessionPeak.toFixed(0)}N
                                </div>
                            </div>
                        </div>

                        {/* Textual Feedback */}
                        <div className="flex-1 flex flex-col justify-between py-4 relative z-10">
                            <div>
                                <div className="flex items-center gap-3 mb-6">
                                     <Waves className="text-primary w-6 h-6 animate-pulse" />
                                     <h3 className="text-xl font-black tracking-tight uppercase">Live Impact Monitoring</h3>
                                </div>
                                <p className="text-slate-400 font-medium max-w-sm mb-8 uppercase text-xs tracking-widest leading-relaxed">
                                    Sensor mendeteksi osilasi gaya pada 100Hz. Pukul target untuk melihat lonjakan energi real-time.
                                </p>

                                <div className="space-y-6">
                                    {/* Strike Type Toggle */}
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Jenis Serangan</label>
                                        <div className="flex p-1.5 bg-slate-100 rounded-3xl gap-2 w-full max-w-xs">
                                            <button
                                                onClick={() => setStrikeType('pukulan')}
                                                disabled={isTesting}
                                                className={cn(
                                                    "flex-1 h-12 rounded-2xl font-black text-[10px] transition-all uppercase tracking-widest",
                                                    strikeType === 'pukulan' 
                                                        ? "bg-white text-primary shadow-lg" 
                                                        : "text-slate-400 hover:bg-white/50"
                                                )}
                                            >
                                                Pukulan
                                            </button>
                                            <button
                                                onClick={() => setStrikeType('tendangan')}
                                                disabled={isTesting}
                                                className={cn(
                                                    "flex-1 h-12 rounded-2xl font-black text-[10px] transition-all uppercase tracking-widest",
                                                    strikeType === 'tendangan' 
                                                        ? "bg-white text-primary shadow-lg" 
                                                        : "text-slate-400 hover:bg-white/50"
                                                )}
                                            >
                                                Tendangan
                                            </button>
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 p-6 rounded-[2.5rem] border border-black/5 flex flex-col items-center justify-center min-h-[300px]">
                                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1 block">Live Pressure</span>
                                        <div className={cn(
                                            "font-black italic tracking-tighter text-slate-900 leading-none transition-all duration-75",
                                            gaugeFontSize
                                        )}>
                                            {currentForce.toFixed(0)}
                                        </div>
                                        <span className="text-2xl font-black text-primary italic tracking-tighter mt-2 uppercase">Newton</span>
                                    </div>
                                    
                                    {sessionPeak > 0 && (
                                        <div className="bg-primary/5 p-6 rounded-[2.5rem] border border-primary/10 animate-in zoom-in-95">
                                            <span className="text-[10px] font-black uppercase text-primary tracking-widest mb-1 block">Puncak Sesi Ini</span>
                                            <div className="text-4xl font-black italic tracking-tighter text-primary">
                                                {sessionPeak.toFixed(0)} <span className="text-lg uppercase">Newton</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mt-12">
                                <button
                                    onClick={handleStart}
                                    disabled={isTesting}
                                    className={cn(
                                        "h-24 rounded-[2.5rem] text-xl font-black italic tracking-tighter flex items-center justify-center gap-4 transition-all overflow-hidden relative",
                                        isTesting 
                                            ? "bg-slate-100 text-slate-400 cursor-not-allowed" 
                                            : "bg-primary text-white hover:bg-primary/90 hover:scale-[1.02] shadow-2xl shadow-primary/30"
                                    )}
                                >
                                    <Play fill="currentColor" size={28} /> MULAI SESI
                                </button>
                                <button
                                    onClick={handleStop}
                                    disabled={!isTesting}
                                    className={cn(
                                        "h-24 rounded-[2.5rem] text-xl font-black italic tracking-tighter flex items-center justify-center gap-4 transition-all border-4",
                                        !isTesting 
                                            ? "bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed" 
                                            : "bg-white border-slate-900 text-slate-900 hover:bg-slate-50 shadow-xl"
                                    )}
                                >
                                    <Square fill="currentColor" size={28} /> HENTIKAN
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Real-time Oscilloscope Waveform */}
                    <div className="bg-slate-50 p-10 rounded-[3.5rem] border border-black/5 mt-8">
                         <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 text-primary rounded-lg">
                                    <Activity size={20} />
                                </div>
                                <h3 className="text-xl font-black italic uppercase tracking-tighter">Force Waveform</h3>
                            </div>
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-[0.3em]">Live Trace (5.0s)</span>
                        </div>
                        
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={forceHistory} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorForceLive" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.03)" />
                                    <XAxis hide dataKey="time" />
                                    <YAxis 
                                        hide 
                                        domain={[0, (dataMax) => Math.max(dataMax, 1000)]} 
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="value"
                                        stroke="#3b82f6"
                                        strokeWidth={4}
                                        fillOpacity={1}
                                        fill="url(#colorForceLive)"
                                        isAnimationActive={false}
                                    />
                                    {sessionPeak > 0 && (
                                        <ReferenceLine y={sessionPeak} stroke="#ef4444" strokeDasharray="5 5" label={{ position: 'right', value: `Peak`, fill: '#ef4444', fontSize: 10, fontWeight: 'bold' }} />
                                    )}
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Sidebar Stats */}
                <div className="space-y-8">
                     {/* History List */}
                    <div className="bg-slate-900 text-white p-10 rounded-[4rem] shadow-2xl min-h-[400px]">
                        <div className="flex items-center justify-between mb-10">
                            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Log Hasil</h3>
                            <div className="flex gap-2">
                                {attempts.length > 0 && !isTesting && (
                                    <button 
                                        onClick={resetAttempts}
                                        className="p-2 bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-500 rounded-lg transition-all"
                                        title="Reset Riwayat"
                                    >
                                        <RotateCcw size={16} />
                                    </button>
                                )}
                                <Activity className="text-primary w-5 h-5" />
                            </div>
                        </div>

                        <div className="space-y-4">
                            {attempts.length === 0 ? (
                                <div className="text-slate-600 italic text-center py-20 bg-white/5 rounded-[3rem] border-2 border-dashed border-white/5">
                                    <p className="text-[10px] font-black uppercase tracking-widest">Kosong</p>
                                </div>
                            ) : (
                                attempts.map((attempt, idx) => (
                                    <div key={idx} className="bg-white/5 group border border-white/5 flex justify-between items-center p-6 rounded-[2rem] transition-all hover:bg-white/10 hover:translate-x-2">
                                        <div>
                                            <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Lari #{attempt.attemptNumber}</span>
                                            <div className="text-2xl font-black italic tracking-tighter text-white">
                                                {attempt.force} <span className="text-[10px] uppercase text-primary">N</span>
                                            </div>
                                        </div>
                                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <ChevronUp className="text-primary w-6 h-6" />
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="bg-primary text-white p-10 rounded-[3.5rem] shadow-2xl shadow-primary/30 text-center relative overflow-hidden group">
                        <div className="relative z-10">
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Skor Legenda</span>
                            <div className="text-6xl font-black italic tracking-tighter mt-1">1000<span className="text-xl ml-1">N</span></div>
                        </div>
                        <Target className="absolute -left-4 -bottom-4 w-32 h-32 text-white/10 rotate-12 group-hover:rotate-0 transition-transform duration-1000" />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LiveTest;
