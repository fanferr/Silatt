import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { rtdb } from '../firebase';
import { ref, get } from 'firebase/database';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TrendingUp, Calendar, Zap, Target } from 'lucide-react';

const HistoryModal = ({ athlete, isOpen, onClose }) => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [debugKeys, setDebugKeys] = useState([]);

    useEffect(() => {
        if (!isOpen || !athlete) return;

        setLoading(true);
        setDebugKeys(["Mencari..."]);
        
        const possibleIds = new Set([
            athlete.id,
            athlete.id?.toLowerCase(),
            athlete.id?.toUpperCase(),
            athlete.rfid_tag,
            athlete.rfid_tag?.toLowerCase(),
            athlete.rfid_tag?.toUpperCase()
        ].filter(Boolean));

        const paths = [];
        possibleIds.forEach(id => {
            paths.push(`test_history/${id}`);
            paths.push(`attempts/${id}`);
        });

        const checkPaths = async () => {
            let finalData = null;

            for (const path of paths) {
                try {
                    const historyRef = ref(rtdb, path);
                    const snapshot = await get(historyRef);
                    const data = snapshot.val();
                    if (data) {
                        finalData = data;
                        setDebugKeys(Object.keys(data));
                        break; // Berhenti jika sudah ketemu data yang valid
                    }
                } catch (err) {
                    setDebugKeys(["Error: " + err.message]);
                }
            }

            if (finalData) {
                const attemptArray = [];
                
                // Cek apakah data bersarang (Session -> Attempt) atau langsung Attempt
                Object.keys(finalData).forEach(sessionKey => {
                    const sessionData = finalData[sessionKey];
                    
                    if (sessionKey.startsWith('session_') && typeof sessionData === 'object') {
                        // Ambil timestamp dari nama folder session (format: session_177xxxxxxxxx)
                        const sessionTimestamp = parseInt(sessionKey.replace('session_', ''));
                        
                        // Cari nilai tertinggi dalam sesi ini (dari attempt_1, 2, 3)
                        let sessionMax = 0;
                        let sessionMaxType = '';

                        Object.keys(sessionData).forEach(attemptKey => {
                            if (attemptKey.startsWith('attempt_')) {
                                const item = sessionData[attemptKey];
                                const score = item.peak_newton || item.force || 0;
                                if (Number(score) > sessionMax) {
                                    sessionMax = Number(score);
                                    sessionMaxType = item.type || 'pukulan';
                                }
                            }
                        });

                        if (sessionMax > 0) {
                            const ts = (sessionTimestamp > 1000000) ? sessionTimestamp : Date.now();
                            const typeLabel = sessionMaxType.charAt(0).toUpperCase() + sessionMaxType.slice(1);
                            
                            attemptArray.push({
                                date: new Date(ts).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
                                force: Number(sessionMax.toFixed(1)),
                                timestamp: ts,
                                label: `${typeLabel} Peak - ${new Date(ts).toLocaleDateString('id-ID', { hour: '2-digit', minute: '2-digit' })}`
                            });
                        }
                    } else if (sessionKey.startsWith('attempt_')) {
                        // Jika struktur langsung (Legacy/Lama)
                        const item = sessionData;
                        const score = item.peak_newton || item.force || 0;
                        const ts = (item.timestamp > 1000000) ? item.timestamp : Date.now();
                        
                        attemptArray.push({
                            date: new Date(ts).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }),
                            force: Number(Number(score).toFixed(1)),
                            timestamp: ts,
                            label: `Legacy Test #${sessionKey.replace('attempt_', '')}`
                        });
                    }
                });

                if (attemptArray.length > 0) {
                    const sorted = attemptArray.sort((a, b) => a.timestamp - b.timestamp);
                    setHistory(sorted);
                } else {
                    setHistory([]);
                }
            } else {
                setHistory([]);
                setDebugKeys(["ID Tidak Ditemukan"]);
            }
            setLoading(false);
        };

        checkPaths();
    }, [isOpen, athlete]);

    const maxPower = history.length > 0 ? Math.max(...history.map(d => d.force)) : 0;
    const avgPower = history.length > 0 ? (history.reduce((acc, curr) => acc + curr.force, 0) / history.length).toFixed(1) : 0;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl bg-white/95 backdrop-blur-xl border-black/5">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-3 text-2xl font-bold">
                        <TrendingUp className="text-primary w-6 h-6" />
                        Riwayat Performa: {athlete?.name}
                    </DialogTitle>
                    <DialogDescription>
                        Grafik perkembangan kekuatan atlet berdasarkan data latihan yang tercatat.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                        <div className="flex items-center gap-2 text-blue-600 text-xs font-bold uppercase tracking-wider mb-1">
                            <Zap size={14} /> Max Power
                        </div>
                        <div className="text-2xl font-black text-slate-900">{maxPower} <span className="text-sm font-normal">N</span></div>
                    </div>
                    <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                        <div className="flex items-center gap-2 text-indigo-600 text-xs font-bold uppercase tracking-wider mb-1">
                            <Target size={14} /> Avg Power
                        </div>
                        <div className="text-2xl font-black text-slate-900">{avgPower} <span className="text-sm font-normal">N</span></div>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">
                            <Calendar size={14} /> Total Sesi
                        </div>
                        <div className="text-2xl font-black text-slate-900">{history.length} <span className="text-sm font-normal">Kali</span></div>
                    </div>
                </div>

                <div className="h-[300px] w-full mt-2">
                    {loading ? (
                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                            Memuat data grafik...
                        </div>
                    ) : history.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={history}>
                                <defs>
                                    <linearGradient id="colorForce" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis 
                                    dataKey="date" 
                                    fontSize={10} 
                                    tickLine={false} 
                                    axisLine={false}
                                    tickFormatter={(val) => val.split(' ')[0]} 
                                />
                                <YAxis 
                                    fontSize={10} 
                                    tickLine={false} 
                                    axisLine={false}
                                    tickFormatter={(val) => `${val}N`}
                                />
                                <Tooltip 
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            const data = payload[0].payload;
                                            return (
                                                <div className="bg-white p-4 rounded-2xl shadow-2xl border border-slate-50 flex flex-col gap-1">
                                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{data.label}</p>
                                                    <p className="text-xl font-black italic text-primary">{data.force} <span className="text-xs font-normal">Newton</span></p>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Area 
                                    type="monotone" 
                                    dataKey="force" 
                                    stroke="#2563eb" 
                                    strokeWidth={3}
                                    fillOpacity={1} 
                                    fill="url(#colorForce)" 
                                    animationDuration={1500}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-2 border-2 border-dashed border-slate-100 rounded-2xl">
                            <Zap size={32} className="text-slate-200" />
                            Belum ada data riwayat untuk atlet ini.
                            <div className="mt-4 p-4 bg-slate-900 rounded-xl text-[10px] font-mono text-emerald-400 border border-white/10 w-full max-w-md overflow-hidden text-left">
                                <div className="text-white font-bold mb-2 uppercase border-b border-white/10 pb-1">Debug Info:</div>
                                <div>• Target ID: <span className="text-white">{athlete?.id}</span></div>
                                <div>• Items Found: <span className="text-white">{history.length}</span></div>
                                <div>• Folder Keys: <span className="text-yellow-400">{debugKeys.join(', ')}</span></div>
                                <div>• DB URL: <span className="text-white">{rtdb.app.options.databaseURL}</span></div>
                                <div className="mt-2 text-slate-500 italic">
                                    Jika "Items Found" adalah 0 padahal di Firebase ada, kemungkinan struktur data di dalam folder ID tidak sesuai standar (attempt_N).
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default HistoryModal;
