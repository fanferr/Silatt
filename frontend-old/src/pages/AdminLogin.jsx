import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Lock } from "lucide-react";

const AdminLogin = () => {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const { login, user } = useAuth();
    const navigate = useNavigate();

    // Jika sudah login, langsung lempar ke dashboard
    useEffect(() => {
        if (user) {
            navigate("/");
        }
    }, [user, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        const result = await login(username, password);
        setIsLoading(false);
        if (result.success) {
            navigate("/");
        } else {
            setError(result.message);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-slate-100">
            {/* Decorative background blobs */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-400/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />

            <div className="relative z-10 w-full max-w-md px-6">
                {/* Branding */}
                <div className="text-center mb-10">
                    <div className="flex items-center justify-center mb-6">
                        <img src="/logo.png" alt="IKSPI" className="h-32 w-auto object-contain drop-shadow-2xl" />
                    </div>
                    <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">
                        IMPACT<span className="text-primary">MONITOR</span>
                    </h1>
                    <p className="text-slate-500 text-base mt-2 font-medium">Sistem Monitoring Atlet Silat Pro Edition</p>
                </div>

                <Card className="border-black/5 shadow-2xl shadow-blue-100 bg-white/90 backdrop-blur-2xl py-2">
                    <CardHeader className="pb-6">
                        <CardTitle className="flex items-center gap-3 text-2xl font-bold">
                            <div className="p-2 bg-primary/10 rounded-lg">
                                <Lock className="w-6 h-6 text-primary" />
                            </div>
                            Login Admin
                        </CardTitle>
                        <CardDescription className="text-sm">Silakan masukkan kata sandi untuk mengelola data atlet.</CardDescription>
                    </CardHeader>
                    <form onSubmit={handleSubmit}>
                        <CardContent className="space-y-6">
                            <div className="grid w-full items-center gap-2.5">
                                <Label htmlFor="username">Username Admin</Label>
                                <Input
                                    id="username"
                                    type="text"
                                    placeholder="Masukkan username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="h-12 bg-white/50 border-slate-200 focus:ring-2 focus:ring-primary/20 transition-all text-lg"
                                />
                            </div>
                            <div className="grid w-full items-center gap-2.5">
                                <Label htmlFor="password text-slate-700">Kata Sandi Sistem</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="h-12 bg-white/50 border-slate-200 focus:ring-2 focus:ring-primary/20 transition-all text-lg"
                                />
                            </div>
                            {error && (
                                <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                                    {error}
                                </p>
                            )}
                        </CardContent>
                        <CardFooter className="pt-2 pb-8">
                            <Button
                                type="submit"
                                className="w-full h-12 text-base font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all active:scale-[0.98]"
                                disabled={isLoading}
                            >
                                {isLoading ? "Memverifikasi..." : "Masuk ke Dashboard"}
                            </Button>
                        </CardFooter>
                    </form>
                </Card>

                <p className="text-center text-sm text-slate-400 mt-10">
                    © {new Date().getFullYear()} ImpactMonitor Pro · Dirancang untuk IKSPI Kera Sakti
                </p>
            </div>
        </div>
    );
};

export default AdminLogin;
