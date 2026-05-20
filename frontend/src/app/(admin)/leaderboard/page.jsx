"use client";
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trophy, Medal, Download, Calendar, AlertCircle, Filter, FileText, Users } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn } from "@/lib/utils";
import { rtdb } from '@/firebase';
import { ref, onValue } from 'firebase/database';

const HARI_LIST = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
const BULAN_LIST = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const TANGGAL_LIST = Array.from({ length: 31 }, (_, i) => String(i + 1));
const CATEGORIES = ["Usia dini A", "Usia dini B", "Pra remaja", "Remaja", "Dewasa"];

const Leaderboard = () => {
    const [leaderboard, setLeaderboard] = useState([]);
    const [filteredLeaderboard, setFilteredLeaderboard] = useState([]);
    
    // New Date Range State
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [strikeTypeFilter, setStrikeTypeFilter] = useState('all');
    const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));

    const isExportReady = true;

    useEffect(() => {
        const usersRef = ref(rtdb, 'users');
        const historyRef = ref(rtdb, 'test_history');
        
        // Listen to both nodes to ensure real-time ranking update
        const unsubUsers = onValue(usersRef, (snapshot) => {
            const userData = snapshot.val() || {};
            
            onValue(historyRef, (historySnapshot) => {
                const historyData = historySnapshot.val() || {};
                
                const athletesArray = Object.keys(userData).map(key => {
                    const profile = userData[key].profile || {};
                    const athleteHistory = historyData[key] || {};
                    
                    let bestPunch = 0;
                    let bestKick = 0;

                    const processAttempt = (data, parentKey) => {
                        const peak = Number(data?.peak_newton || 0);
                        let ts = data?.timestamp || 0;
                        const type = (data?.type || 'pukulan').toLowerCase();

                        // Perbaikan: Ambil timestamp dari nama session jika TS hardware rusak
                        if (ts < 1000000000000 && parentKey && parentKey.startsWith('session_')) {
                            const parsedTs = parseInt(parentKey.replace('session_', ''));
                            if (!isNaN(parsedTs) && parsedTs > 1000000000000) {
                                ts = parsedTs;
                            }
                        }

                        if (ts < 1000000000000) {
                            ts = new Date('2026-04-21T12:00:00').getTime();
                        }

                        const testDate = new Date(ts);
                        let includeDate = true;
                        
                        if (startDate && endDate) {
                            const start = new Date(startDate);
                            start.setHours(0, 0, 0, 0);
                            const end = new Date(endDate);
                            end.setHours(23, 59, 59, 999);
                            includeDate = testDate >= start && testDate <= end;
                        }

                        if (includeDate) {
                            if (type === 'pukulan' && peak > bestPunch) bestPunch = peak;
                            if (type === 'tendangan' && peak > bestKick) bestKick = peak;
                        }
                    };

                    const traverse = (obj, parentKey = '') => {
                        if (!obj || typeof obj !== 'object') return;
                        Object.keys(obj).forEach(k => {
                            if (k.startsWith('attempt_')) {
                                processAttempt(obj[k], parentKey);
                            } else if (typeof obj[k] === 'object') {
                                traverse(obj[k], k);
                            }
                        });
                    };

                    traverse(athleteHistory);

                    // Logic for display score based on filter
                    let displayScore = 0;
                    if (strikeTypeFilter === 'pukulan') displayScore = bestPunch;
                    else if (strikeTypeFilter === 'tendangan') displayScore = bestKick;
                    else displayScore = Math.max(bestPunch, bestKick);

                    return {
                        id: key,
                        name: profile.name || 'Unknown',
                        category: profile.category || 'N/A',
                        best_punch: bestPunch,
                        best_kick: bestKick,
                        best_score: displayScore
                    };
                });

                setLeaderboard(athletesArray);
            }, { onlyOnce: false });
        });

        const timeInterval = setInterval(() => {
            setCurrentTime(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
        }, 30000);

        return () => {
            unsubUsers();
            clearInterval(timeInterval);
        };
    }, [startDate, endDate, strikeTypeFilter]); // Trigger re-fetching when dates or strike type change

    // Apply category filter and sorting
    useEffect(() => {
        let filtered = [...leaderboard];
        
        if (categoryFilter !== 'all') {
            filtered = filtered.filter(a => a.category === categoryFilter);
        }

        // Only show those with scores > 0
        filtered = filtered.filter(a => a.best_score > 0);
        
        // Sort descending
        filtered.sort((a, b) => b.best_score - a.best_score);
        
        setFilteredLeaderboard(filtered);
    }, [leaderboard, categoryFilter]);

    const getRankIcon = (index) => {
        if (index === 0) return <div className="w-12 h-12 rounded-2xl bg-yellow-400 flex items-center justify-center shadow-lg shadow-yellow-200 ring-4 ring-yellow-50"><Trophy className="text-white w-6 h-6" /></div>;
        if (index === 1) return <div className="w-10 h-10 rounded-xl bg-slate-300 flex items-center justify-center shadow-lg shadow-slate-200"><Medal className="text-white w-5 h-5" /></div>;
        if (index === 2) return <div className="w-10 h-10 rounded-xl bg-amber-600 flex items-center justify-center shadow-lg shadow-amber-200"><Medal className="text-white w-5 h-5" /></div>;
        return <div className="w-10 h-10 flex items-center justify-center font-black text-slate-300">#{index + 1}</div>;
    };

    const exportToPDF = () => {
        const generatePDF = (ikspiLogo) => {
            try {
                const doc = new jsPDF();
                const pageWidth = doc.internal.pageSize.width;
                
                // --- BACKGROUND PUTIH ---
                doc.setFillColor(255, 255, 255);
                doc.rect(0, 0, pageWidth, doc.internal.pageSize.height, 'F');
                
                // --- TOP KIRI: LOGO IKSPI + IMPACT ---
                let impactStartX = 14;

                // Tambahkan Logo IKSPI Paling Kiri (jika ada)
                if (ikspiLogo) {
                    doc.addImage(ikspiLogo, 'PNG', 14, 5, 14, 14);
                    impactStartX = 32; // Geser teks Impact ke kanan logo
                }

                // Simulasi Logo "i" warna biru
                doc.setTextColor(37, 99, 235); // blue-600
                doc.setFontSize(22);
                doc.setFont("helvetica", "bold");
                doc.text("i", impactStartX, 15);
                
                doc.setFontSize(9);
                doc.setTextColor(15, 23, 42); // slate-900
                doc.text("IMPACT", impactStartX + 6, 13);
                doc.setFontSize(6);
                doc.setTextColor(100, 116, 139);
                doc.text("MONITOR PRO", impactStartX + 6, 17);

                // --- TOP KANAN: INFO CETAK ---
                doc.setFontSize(8);
                doc.setTextColor(100, 116, 139);
                doc.setFont("helvetica", "normal");
                const realTimeJam = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                doc.text(`Dicetak pada: ${new Date().toLocaleDateString('id-ID')} ${realTimeJam}`, pageWidth - 14, 12, { align: "right" });
                doc.text(`Sistem: Impact Monitor Pro`, pageWidth - 14, 16, { align: "right" });

                // --- JUDUL UTAMA ---
                doc.setTextColor(15, 23, 42); // navy gelap
                doc.setFontSize(26);
                doc.setFont("helvetica", "bold");
                doc.text("HALL OF FAME", 14, 33);
                
                doc.setFontSize(10);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(100, 116, 139);
                doc.text("Laporan Perankingan Atlet Impact Monitor Pro", 14, 40);

                // --- PERIODE DATA ---
                const formattedRange = (startDate && endDate) ? `${startDate} s/d ${endDate}` : "Keseluruhan Waktu";
                doc.setFontSize(9);
                doc.setTextColor(71, 85, 105);
                doc.text(`Periode Data: ${formattedRange}`, 14, 48);

                // --- 📊 4 KOTAK SUMMARY ---
                const totalAtlet = filteredLeaderboard.length;
                let maxPower = 0;
                let sumPower = 0;
                const categoriesSet = new Set();

                filteredLeaderboard.forEach(a => {
                    const p = a.best_score || 0;
                    if (p > maxPower) maxPower = p;
                    sumPower += p;
                    if (a.category && a.category !== 'N/A') categoriesSet.add(a.category);
                });
                const avgPower = totalAtlet > 0 ? (sumPower / totalAtlet).toFixed(2) : 0;
                const totalCategories = categoriesSet.size;

                const cardWidth = (pageWidth - 28 - (3 * 4)) / 4; // 4 kotak dengan margin
                const summaryData = [
                    { title: "TOTAL ATLET", value: totalAtlet, sub: "Atlet" },
                    { title: "RATA-RATA POWER", value: avgPower, sub: "Newton (N)" },
                    { title: "POWER TERTINGGI", value: maxPower > 0 ? maxPower.toFixed(2) : 0, sub: "Newton (N)" },
                    { title: "KATEGORI", value: totalCategories, sub: "Kategori" }
                ];

                for (let i = 0; i < 4; i++) {
                    const x = 14 + (i * (cardWidth + 4));
                    const y = 55;
                    doc.setDrawColor(226, 232, 240); // slate-200 border
                    doc.setFillColor(255, 255, 255); // putih
                    doc.roundedRect(x, y, cardWidth, 22, 2, 2, 'FD');

                    doc.setFontSize(6);
                    doc.setTextColor(148, 163, 184); // slate-400
                    doc.text(summaryData[i].title, x + cardWidth/2, y + 7, { align: "center" });

                    doc.setFontSize(14);
                    doc.setTextColor(15, 23, 42); // slate-900
                    doc.setFont("helvetica", "bold");
                    doc.text(`${summaryData[i].value}`, x + cardWidth/2, y + 14, { align: "center" });

                    doc.setFontSize(6);
                    doc.setTextColor(148, 163, 184); 
                    doc.setFont("helvetica", "normal");
                    doc.text(summaryData[i].sub, x + cardWidth/2, y + 19, { align: "center" });
                }

                // --- 🏆 TOP 3 JUDUL ---
                doc.setTextColor(250, 204, 21); // kuning emas
                
                // Menggambar 3 titik/lingkaran emas sebagai pengganti bintang yang error
                doc.setFillColor(250, 204, 21);
                doc.circle(pageWidth/2 - 6, 86, 0.8, 'F');
                doc.circle(pageWidth/2, 86, 1.2, 'F');
                doc.circle(pageWidth/2 + 6, 86, 0.8, 'F');
                
                doc.setTextColor(15, 23, 42);
                doc.setFontSize(11);
                doc.text("TOP 3 ATLET", pageWidth/2, 93, { align: "center" });
                
                doc.setDrawColor(250, 204, 21);
                doc.line(pageWidth/2 - 25, 91, pageWidth/2 - 15, 91);
                doc.line(pageWidth/2 + 15, 91, pageWidth/2 + 25, 91);

                // --- 🏆 TOP 3 PODIUM CARDS ---
                const top3Width = 50;
                const rank1X = (pageWidth / 2) - (top3Width / 2);
                const rank2X = rank1X - top3Width - 8;
                const rank3X = rank1X + top3Width + 8;

                const drawTopCard = (x, y, width, height, rank, athlete, colorHex) => {
                    if (!athlete) return;
                    
                    // Hex to RGB untuk drawColor
                    const r = parseInt(colorHex.substring(1,3), 16);
                    const g = parseInt(colorHex.substring(3,5), 16);
                    const b = parseInt(colorHex.substring(5,7), 16);

                    // Background Kartu
                    doc.setFillColor(255, 255, 255);
                    doc.setDrawColor(r, g, b); // Border sesuai medali
                    doc.roundedRect(x, y, width, height, 3, 3, 'FD');

                    // Lingkaran Medali
                    doc.setFillColor(r, g, b);
                    doc.circle(x + width/2, y + 12, 6, 'F');
                    doc.setTextColor(255, 255, 255);
                    doc.setFontSize(10);
                    doc.setFont("helvetica", "bold");
                    doc.text(`${rank}`, x + width/2, y + 15.5, { align: "center" });

                    // Nama Atlet
                    doc.setTextColor(15, 23, 42);
                    doc.setFontSize(10);
                    const name = athlete.name.length > 12 ? athlete.name.substring(0, 10) + '...' : athlete.name;
                    doc.text(name.toUpperCase(), x + width/2, y + 26, { align: "center" });

                    // Kategori
                    doc.setTextColor(100, 116, 139);
                    doc.setFontSize(7);
                    doc.setFont("helvetica", "normal");
                    doc.text(athlete.category, x + width/2, y + 31, { align: "center" });

                    // Power Score
                    doc.setTextColor(37, 99, 235); // Biru
                    doc.setFontSize(12);
                    doc.setFont("helvetica", "bold");
                    doc.text(`${athlete.best_score ? athlete.best_score.toFixed(2) : 0} N`, x + width/2, y + 37, { align: "center" });
                };

                // Rank 2 (Kiri)
                drawTopCard(rank2X, 103, top3Width, 42, 2, filteredLeaderboard[1], "#94A3B8"); // Silver
                // Rank 1 (Tengah - Lebih Tinggi & Lebar)
                drawTopCard(rank1X, 98, top3Width + 4, 47, 1, filteredLeaderboard[0], "#FBBF24"); // Emas
                // Rank 3 (Kanan)
                drawTopCard(rank3X, 103, top3Width, 42, 3, filteredLeaderboard[2], "#D97706"); // Perunggu

                // --- 📋 TABEL PERINGKAT LENGKAP ---
                doc.setFontSize(12);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(15, 23, 42);
                doc.text("PERINGKAT LENGKAP", 14, 158);

                // Dinamis Kolom berdasarkan Filter
                let tableColumn = ["RANK", "NAMA ATLET", "KATEGORI"];
                if (strikeTypeFilter === 'all') {
                    tableColumn.push("PUKULAN (N)", "TENDANGAN (N)", "BEST SCORE (N)");
                } else if (strikeTypeFilter === 'pukulan') {
                    tableColumn.push("PUKULAN (N)");
                } else {
                    tableColumn.push("TENDANGAN (N)");
                }

                const tableRows = filteredLeaderboard.map((athlete, index) => {
                    const row = [
                        `#${index + 1}`,
                        athlete.name.toUpperCase(),
                        athlete.category
                    ];

                    if (strikeTypeFilter === 'all') {
                        row.push(
                            athlete.best_punch ? athlete.best_punch.toFixed(1) : '-',
                            athlete.best_kick ? athlete.best_kick.toFixed(1) : '-',
                            athlete.best_score ? athlete.best_score.toFixed(2) : '0.00'
                        );
                    } else if (strikeTypeFilter === 'pukulan') {
                        row.push(athlete.best_punch ? athlete.best_punch.toFixed(2) : '0.00');
                    } else {
                        row.push(athlete.best_kick ? athlete.best_kick.toFixed(2) : '0.00');
                    }
                    return row;
                });

                // Style Kolom Dinamis
                const colStyles = {
                    0: { halign: 'center', fontStyle: 'bold', textColor: [37, 99, 235] },
                    1: { halign: 'left', fontStyle: 'bold', textColor: [15, 23, 42] },
                    2: { halign: 'center', textColor: [100, 116, 139] }
                };

                if (strikeTypeFilter === 'all') {
                    colStyles[3] = { halign: 'center', textColor: [15, 23, 42] };
                    colStyles[4] = { halign: 'center', textColor: [15, 23, 42] };
                    colStyles[5] = { halign: 'center', fontStyle: 'bold', textColor: [37, 99, 235] };
                } else {
                    colStyles[3] = { halign: 'center', fontStyle: 'bold', textColor: [15, 23, 42] };
                }

                autoTable(doc, {
                    head: [tableColumn],
                    body: tableRows,
                    startY: 163,
                    theme: 'grid',
                    headStyles: { 
                        fillColor: [15, 23, 42], 
                        textColor: [255, 255, 255], 
                        fontStyle: 'bold',
                        halign: 'center',
                        fontSize: 8,
                        cellPadding: 4
                    },
                    columnStyles: colStyles,
                    alternateRowStyles: { fillColor: [248, 250, 252] },
                    styles: { fontSize: 7, cellPadding: 4, lineColor: [226, 232, 240], lineWidth: 0.1 },
                    
                    // --- FOOTER BAWAH ---
                    didDrawPage: function (data) {
                        let pageCount = doc.internal.getNumberOfPages();
                        doc.setFontSize(7);
                        doc.setTextColor(148, 163, 184); // slate-400
                        doc.text("Laporan ini digenerate secara otomatis oleh Impact Monitor Pro", 14, doc.internal.pageSize.height - 12);
                        doc.text("Sistem pemantauan dan analisis performa atlet berbasis teknologi.", 14, doc.internal.pageSize.height - 8);
                        
                        doc.text(`Halaman ${pageCount} dari {total_pages}`, doc.internal.pageSize.width - 14, doc.internal.pageSize.height - 10, { align: 'right' });
                    }
                });

                // Kalkulasi Total Halaman untuk Footer
                if (typeof doc.putTotalPages === 'function') {
                    doc.putTotalPages("{total_pages}");
                }

                doc.save(`Leaderboard_Silat_${startDate || 'All'}_to_${endDate || 'Time'}.pdf`);
            } catch (error) {
                console.error("Error PDF Generate:", error);
            }
        };

        // --- PROSES MUAT LOGO ---
        // Jika ada logo.png di dalam folder public, akan otomatis masuk ke pojok atas
        const img = new Image();
        img.src = '/logo.png';
        img.onload = () => generatePDF(img);
        img.onerror = () => generatePDF(null); // Terus lanjut tanpa logo jika gagal dimuat
    };

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-1000">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                     <div className="flex items-center gap-3 mb-3">
                         <div className="p-2 bg-yellow-100 rounded-xl">
                            <Trophy className="text-yellow-600 w-6 h-6" />
                         </div>
                         <h2 className="text-sm font-black uppercase tracking-[0.3em] text-slate-400 leading-none">Hall of Fame</h2>
                     </div>
                    <h1 className="text-5xl font-black tracking-tighter text-slate-900">
                        Top <span className="text-primary italic">Performers</span>
                    </h1>
                </div>
                
                {/* Horizontal Filter Bar */}
                <div className="flex flex-wrap items-center gap-4 p-6 bg-white/50 backdrop-blur-md rounded-[2rem] border border-white/20 shadow-xl">
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Kategori</label>
                        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                            <SelectTrigger className="w-[180px] h-11 rounded-xl bg-white border-none shadow-sm font-bold">
                                <SelectValue placeholder="Semua Kategori" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-none shadow-2xl">
                                <SelectItem value="all">Semua Kategori</SelectItem>
                                {CATEGORIES.map(cat => (
                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Jenis Serangan</label>
                        <Select value={strikeTypeFilter} onValueChange={setStrikeTypeFilter}>
                            <SelectTrigger className="w-[150px] h-11 rounded-xl bg-white border-none shadow-sm font-bold">
                                <SelectValue placeholder="Semua Serangan" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-none shadow-2xl">
                                <SelectItem value="all">Semua Serangan</SelectItem>
                                <SelectItem value="pukulan">Pukulan Saja</SelectItem>
                                <SelectItem value="tendangan">Tendangan Saja</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Dari</label>
                        <input 
                            type="date" 
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="h-11 px-4 rounded-xl bg-white border-none shadow-sm font-bold text-sm outline-none focus:ring-2 focus:ring-primary/20"
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Sampai</label>
                        <input 
                            type="date" 
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="h-11 px-4 rounded-xl bg-white border-none shadow-sm font-bold text-sm outline-none focus:ring-2 focus:ring-primary/20"
                        />
                    </div>

                    <div className="flex items-end gap-2 mt-auto pb-0.5">
                        <Button 
                            variant="outline"
                            className="h-11 px-6 rounded-xl border-blue-200 text-blue-600 hover:bg-blue-50 font-bold"
                            onClick={() => {
                                setStartDate('');
                                setEndDate('');
                                setCategoryFilter('all');
                                setStrikeTypeFilter('all');
                            }}
                        >
                            Reset
                        </Button>

                        <Button 
                            variant="secondary"
                            className="h-11 px-6 rounded-xl bg-slate-200 text-slate-700 hover:bg-slate-300 font-bold ml-4"
                            onClick={exportToPDF}
                        >
                            <Download size={18} className="mr-2" /> Export PDF
                        </Button>
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-8">
                {/* Leaderboard Table */}
                <Card className="glass-card border-none rounded-[3.5rem] shadow-2xl overflow-hidden p-0">
                    <div className="p-10 border-b border-black/5 bg-slate-900 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center">
                                <Filter size={24} className="text-primary" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black italic tracking-tight">Katalog Peringkat</h3>
                                <p className="text-xs font-black uppercase tracking-widest text-slate-500">{filteredLeaderboard.length} Rekod Atlet</p>
                            </div>
                        </div>
                        <div className="flex flex-col items-end">
                            <div className="flex items-center gap-2 mb-1">
                                <Badge variant="secondary" className="bg-primary/10 text-primary text-[9px] font-black uppercase px-2 py-0.5 rounded-md">
                                    {(startDate && endDate) ? `${startDate} — ${endDate}` : "Semua Waktu"}
                                </Badge>
                                <p className="text-[10px] font-black uppercase text-slate-500">Update Terakhir</p>
                            </div>
                            <p className="text-sm font-bold">{currentTime} WIB</p>
                        </div>
                    </div>
                    
                    <div className="h-[700px] overflow-auto custom-scrollbar">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-none bg-slate-50 hover:bg-slate-50">
                                    <TableHead className="w-[120px] h-16 px-10 text-[10px] font-black uppercase tracking-widest text-slate-400">Peringkat</TableHead>
                                    <TableHead className="h-16 text-[10px] font-black uppercase tracking-widest text-slate-400">Data Atlet</TableHead>
                                    <TableHead className="h-16 text-[10px] font-black uppercase tracking-widest text-slate-400">Kategori</TableHead>
                                    
                                    {(strikeTypeFilter === 'all' || strikeTypeFilter === 'pukulan') && (
                                        <TableHead className="h-16 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Pukulan (N)</TableHead>
                                    )}
                                    
                                    {(strikeTypeFilter === 'all' || strikeTypeFilter === 'tendangan') && (
                                        <TableHead className="h-16 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Tendangan (N)</TableHead>
                                    )}

                                    <TableHead className="h-16 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right pr-10">Power Score</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredLeaderboard.map((athlete, index) => (
                                    <TableRow key={`${athlete.id}-${index}`} className="border-b border-black/5 hover:bg-blue-50/30 transition-colors group">
                                        <TableCell className="px-10 py-6">{getRankIcon(index)}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="text-lg font-black tracking-tight text-slate-900 group-hover:text-primary transition-colors">{athlete.name}</span>
                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Athlete ID: {athlete.id || 'N/A'}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                             <Badge variant="outline" className="rounded-lg bg-slate-100/50 border-black/5 font-bold px-3 py-1">
                                                {athlete.category}
                                             </Badge>
                                        </TableCell>

                                        {(strikeTypeFilter === 'all' || strikeTypeFilter === 'pukulan') && (
                                            <TableCell className="text-center">
                                                <span className={cn(
                                                    "text-lg font-bold tracking-tighter",
                                                    (strikeTypeFilter === 'pukulan' || (athlete.best_punch >= athlete.best_kick && athlete.best_punch > 0)) ? "text-primary" : "text-slate-400"
                                                )}>
                                                    {athlete.best_punch ? athlete.best_punch.toFixed(1) : '-'}
                                                </span>
                                            </TableCell>
                                        )}

                                        {(strikeTypeFilter === 'all' || strikeTypeFilter === 'tendangan') && (
                                            <TableCell className="text-center">
                                                <span className={cn(
                                                    "text-lg font-bold tracking-tighter",
                                                    (strikeTypeFilter === 'tendangan' || (athlete.best_kick > athlete.best_punch)) ? "text-primary" : "text-slate-400"
                                                )}>
                                                    {athlete.best_kick ? athlete.best_kick.toFixed(1) : '-'}
                                                </span>
                                            </TableCell>
                                        )}

                                        <TableCell className="text-right pr-10">
                                            <div className="flex flex-col items-end">
                                                <span className="text-2xl font-black italic tracking-tighter text-slate-950">
                                                    {athlete.best_score ? athlete.best_score.toFixed(2) : '0.00'}
                                                </span>
                                                <Badge variant="secondary" className="bg-slate-100 text-[8px] font-black uppercase px-2 py-0.5 rounded-md border-none">
                                                    {strikeTypeFilter === 'pukulan' ? 'Pukulan' : (strikeTypeFilter === 'tendangan' ? 'Tendangan' : (athlete.best_punch >= athlete.best_kick ? 'Pukulan' : 'Tendangan'))}
                                                </Badge>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {filteredLeaderboard.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={strikeTypeFilter === 'all' ? 6 : 5} className="text-center py-40">
                                            <div className="flex flex-col items-center">
                                                <Users size={64} className="text-slate-100 mb-4" />
                                                <span className="font-bold text-slate-300">Belum Ada Data Tersedia untuk filter ini</span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </Card>
            </div>
        </div>
    );
};


export default Leaderboard;
