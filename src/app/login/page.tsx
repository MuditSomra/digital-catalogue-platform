"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Store,
  Lock,
  Mail,
  ShieldCheck,
  Eye,
  EyeOff,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Laptop,
  Smartphone,
  Info,
} from "lucide-react";

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const returnUrl = searchParams.get("returnUrl") || "/admin";
  const errorParam = searchParams.get("error");

  const [email, setEmail] = useState("admin@kitchenshowroom.local");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [trustThisDevice, setTrustThisDevice] = useState(true);
  const [deviceName, setDeviceName] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (errorParam) {
      if (errorParam === "session_expired" || errorParam === "session_revoked") {
        setErrorMessage("Your previous session has expired or was revoked. Please log in again.");
      } else if (errorParam === "inactivity_timeout") {
        setErrorMessage("Your session expired due to 30 days of inactivity. Please log in again.");
      } else if (errorParam === "unauthorized") {
        setErrorMessage("Authentication required to access shop resources.");
      }
    }
  }, [errorParam]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !password.trim()) {
      setErrorMessage("Please enter both email and password.");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          trustThisDevice,
          deviceName: deviceName.trim() || undefined,
        }),
      });

      const json = await res.json();

      if (json.success) {
        // Successful login -> Redirect to requested page or default /admin
        const destination = returnUrl && returnUrl.startsWith("/") ? returnUrl : "/admin";
        router.push(destination);
        router.refresh();
      } else {
        setErrorMessage(json.error?.message || "Invalid login credentials. Please try again.");
      }
    } catch {
      setErrorMessage("Network error occurred during login. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 relative overflow-hidden py-12">
      {/* Background Decorative Lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-indigo-600/10 rounded-full blur-2xl pointer-events-none" />

      {/* Main Login Card */}
      <div className="w-full max-w-md bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 relative z-10">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 mb-1 shadow-inner">
            <Store className="w-7 h-7" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            Kitchen Appliance Showroom
          </h1>
          <p className="text-xs text-slate-400 font-medium">
            Owner Authentication & Shop Management
          </p>
        </div>

        {/* Security Badge */}
        <div className="flex items-center justify-center gap-2 py-1.5 px-3 bg-blue-950/40 border border-blue-800/40 rounded-full text-[11px] font-medium text-blue-300">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span>Encrypted Session Management & Access Control</span>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed font-medium">{errorMessage}</div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300">
              Account Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@kitchenshowroom.local"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950/70 border border-slate-700/80 rounded-xl text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition"
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-300">
                Password
              </label>
              <span className="text-[10px] text-slate-500 font-mono">
                Default: Admin@Showroom2026!
              </span>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full pl-10 pr-10 py-2.5 bg-slate-950/70 border border-slate-700/80 rounded-xl text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Trusted Device Toggle & Configuration */}
          <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={trustThisDevice}
                onChange={(e) => setTrustThisDevice(e.target.checked)}
                className="w-4 h-4 rounded mt-0.5 text-blue-600 bg-slate-900 border-slate-700 focus:ring-blue-500"
              />
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Laptop className="w-3.5 h-3.5 text-blue-400" />
                  <span>Trust this device as Main Shop Device</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {trustThisDevice
                    ? "Keeps you logged in for 90 days (with 30-day inactivity timeout), across browser and computer restarts."
                    : "Standard temporary session (automatically logs out after 8 hours)."}
                </p>
              </div>
            </label>

            {trustThisDevice && (
              <div className="pt-2 border-t border-slate-800/80">
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Device Label (Optional)
                </label>
                <input
                  type="text"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  placeholder="e.g. Main Showroom Counter PC"
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs sm:text-sm tracking-wide transition shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Authenticating...</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>Log In & Enter Showroom</span>
              </>
            )}
          </button>
        </form>

        {/* Footer Info */}
        <div className="pt-2 text-center text-[11px] text-slate-500 space-y-1">
          <p>Single authenticated session unlocks Showroom Catalogue & Admin Management.</p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-xs">
          Loading Shop Login...
        </div>
      }
    >
      <LoginFormContent />
    </Suspense>
  );
}
