import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings as SettingsIcon, ShieldCheck, KeyRound, AlertCircle, Users, UserPlus, Trash2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const Settings = () => {
    const { user } = useAuth();
    const [passwords, setPasswords] = useState({
        oldPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    
    const [newAdmin, setNewAdmin] = useState({ username: '', password: '' });
    const [adminUsers, setAdminUsers] = useState([]);
    const [status, setStatus] = useState({ type: '', message: '' });
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        fetchAdminUsers();
    }, []);

    const fetchAdminUsers = async () => {
        try {
            const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
            const response = await fetch(`${API_URL}/api/admin/users`);
            const data = await response.json();
            setAdminUsers(data);
        } catch (error) {
            console.error('Gagal mengambil daftar admin');
        }
    };

    const handleUpdatePassword = async (e) => {
        e.preventDefault();
        if (passwords.newPassword !== passwords.confirmPassword) {
            setStatus({ type: 'error', message: 'Konfirmasi password tidak cocok' });
            return;
        }

        setIsLoading(true);
        setStatus({ type: '', message: '' });

        try {
            const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
            const response = await fetch(`${API_URL}/api/admin/update-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: user?.username,
                    oldPassword: passwords.oldPassword,
                    newPassword: passwords.newPassword
                })
            });

            const data = await response.json();
            if (data.success) {
                setStatus({ type: 'success', message: 'Password berhasil diperbarui!' });
                setPasswords({ oldPassword: '', newPassword: '', confirmPassword: '' });
            } else {
                setStatus({ type: 'error', message: data.message || 'Gagal memperbarui password' });
            }
        } catch (error) {
            setStatus({ type: 'error', message: 'Koneksi ke server gagal' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddAdmin = async (e) => {
        e.preventDefault();
        try {
            const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
            const response = await fetch(`${API_URL}/api/admin/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newAdmin)
            });
            const data = await response.json();
            if (data.success) {
                setNewAdmin({ username: '', password: '' });
                fetchAdminUsers();
            }
        } catch (error) {
            console.error('Gagal menambah admin');
        }
    };

    const handleDeleteAdmin = async (id) => {
        if (adminUsers.length <= 1) return alert('Minimal harus ada 1 admin!');
        if (!confirm('Hapus admin ini?')) return;
        
        try {
            const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
            await fetch(`${API_URL}/api/admin/users/${id}`, { method: 'DELETE' });
            fetchAdminUsers();
        } catch (error) {
            console.error('Gagal menghapus admin');
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-20">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                    <SettingsIcon className="text-primary w-8 h-8" />
                    Pengaturan Sistem
                </h1>
                <p className="text-slate-500">Kelola keamanan dan pengguna admin aplikasi Impact Monitor.</p>
            </div>

            <div className="grid gap-8 md:grid-cols-2">
                {/* Bagian Ganti Password */}
                <Card className="border-black/5 shadow-xl shadow-slate-200/50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <KeyRound className="w-5 h-5 text-primary" />
                            Ganti Password Saya
                        </CardTitle>
                        <CardDescription>Login sebagai: <span className="font-bold text-slate-900">{user?.username}</span></CardDescription>
                    </CardHeader>
                    <form onSubmit={handleUpdatePassword}>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="oldPassword">Password Lama</Label>
                                <Input 
                                    id="oldPassword" 
                                    type="password" 
                                    value={passwords.oldPassword}
                                    onChange={(e) => setPasswords({...passwords, oldPassword: e.target.value})}
                                    required 
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="newPassword">Password Baru</Label>
                                <Input 
                                    id="newPassword" 
                                    type="password" 
                                    value={passwords.newPassword}
                                    onChange={(e) => setPasswords({...passwords, newPassword: e.target.value})}
                                    required 
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword">Konfirmasi Password</Label>
                                <Input 
                                    id="confirmPassword" 
                                    type="password" 
                                    value={passwords.confirmPassword}
                                    onChange={(e) => setPasswords({...passwords, confirmPassword: e.target.value})}
                                    required 
                                />
                            </div>

                            {status.message && (
                                <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
                                    status.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
                                }`}>
                                    {status.type === 'error' && <AlertCircle size={16} />}
                                    {status.message}
                                </div>
                            )}
                        </CardContent>
                        <CardFooter>
                            <Button type="submit" className="w-full" disabled={isLoading}>
                                {isLoading ? 'Menyimpan...' : 'Perbarui Password'}
                            </Button>
                        </CardFooter>
                    </form>
                </Card>

                {/* Manajemen User Admin */}
                <div className="space-y-8">
                    <Card className="border-black/5 shadow-xl shadow-slate-200/50">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Users className="w-5 h-5 text-primary" />
                                Daftar Admin
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {adminUsers.map(admin => (
                                    <div key={admin.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                                                {admin.username.charAt(0).toUpperCase()}
                                            </div>
                                            <span className="font-medium text-slate-700">{admin.username}</span>
                                        </div>
                                        {admin.username !== user?.username && (
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                onClick={() => handleDeleteAdmin(admin.id)}
                                                className="text-slate-400 hover:text-red-500 rounded-lg"
                                            >
                                                <Trash2 size={16} />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-black/5 shadow-xl shadow-slate-200/50">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <UserPlus className="w-5 h-5 text-primary" />
                                Tambah Admin Baru
                            </CardTitle>
                        </CardHeader>
                        <form onSubmit={handleAddAdmin}>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Username Admin Baru</Label>
                                    <Input 
                                        value={newAdmin.username} 
                                        onChange={(e) => setNewAdmin({...newAdmin, username: e.target.value})}
                                        placeholder="Ketik username baru..."
                                        required 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Password</Label>
                                    <Input 
                                        type="password"
                                        value={newAdmin.password} 
                                        onChange={(e) => setNewAdmin({...newAdmin, password: e.target.value})}
                                        required 
                                    />
                                </div>
                            </CardContent>
                            <CardFooter>
                                <Button type="submit" variant="secondary" className="w-full">Tambah Admin</Button>
                            </CardFooter>
                        </form>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default Settings;

