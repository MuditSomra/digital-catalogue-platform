"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastContext";
import {
  ShieldCheck,
  KeyRound,
  Lock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sliders,
  Store,
  Laptop,
  Smartphone,
  LogOut,
  Trash2,
  Globe,
  Clock,
  Key,
  ShieldAlert,
  UserCheck,
} from "lucide-react";

interface ActiveSessionItem {
  id: string;
  deviceLabel: string;
  isCurrent: boolean;
  isTrustedDevice: boolean;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
  deviceName?: string;
}

export default function AdminSettingsPage() {
  const router = useRouter();
  const { success, error, info } = useToast();

  const [activeTab, setActiveTab] = useState<"sessions" | "password" | "pin">("sessions");

  // ==========================================
  // 1. Session Management State
  // ==========================================
  const [currentSession, setCurrentSession] = useState<ActiveSessionItem | null>(null);
  const [otherSessions, setOtherSessions] = useState<ActiveSessionItem[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingOthers, setRevokingOthers] = useState(false);

  // ==========================================
  // 2. Password Change State
  // ==========================================
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [revokeOthersOnPasswordChange, setRevokeOthersOnPasswordChange] = useState(true);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // ==========================================
  // 3. PIN Management State
  // ==========================================
  const [isPinConfigured, setIsPinConfigured] = useState<boolean | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [remainingMinutes, setRemainingMinutes] = useState<number | null>(null);
  const [loadingPinStatus, setLoadingPinStatus] = useState(true);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinSubmitting, setPinSubmitting] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [isResetMode, setIsResetMode] = useState(false);
  const [resetNewPin, setResetNewPin] = useState("");
  const [resetConfirmPin, setResetConfirmPin] = useState("");

  // ==========================================
  // Loaders
  // ==========================================
  const loadSessions = async () => {
    try {
      setLoadingSessions(true);
      const res = await fetch("/api/admin/sessions");
      const json = await res.json();
      if (json.success) {
        setCurrentSession(json.data.currentSession);
        setOtherSessions(json.data.otherSessions || []);
      }
    } catch (err) {
      console.error("Failed to load active sessions:", err);
    } finally {
      setLoadingSessions(false);
    }
  };

  const loadPinStatus = async () => {
    try {
      setLoadingPinStatus(true);
      const res = await fetch("/api/admin/pin/status");
      const json = await res.json();
      if (json.success) {
        setIsPinConfigured(json.data.isConfigured);
        setIsLocked(json.data.isLocked);
        setRemainingMinutes(json.data.remainingMinutes || null);
      }
    } catch (err) {
      console.error("Failed to load PIN status:", err);
    } finally {
      setLoadingPinStatus(false);
    }
  };

  useEffect(() => {
    loadSessions();
    loadPinStatus();
  }, []);

  // ==========================================
  // Session Actions
  // ==========================================
  const handleRevokeSession = async (id: string) => {
    try {
      setRevokingId(id);
      const res = await fetch(`/api/admin/sessions/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        success("Session Revoked", json.data.message);
        if (json.data.isCurrentSession) {
          router.push("/login");
        } else {
          await loadSessions();
        }
      } else {
        error("Revocation Failed", json.error?.message || "Could not revoke session.");
      }
    } catch {
      error("Error", "Network error while revoking session.");
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeOtherSessions = async () => {
    try {
      setRevokingOthers(true);
      const res = await fetch("/api/admin/sessions/revoke-others", { method: "POST" });
      const json = await res.json();
      if (json.success) {
        success("Sessions Cleared", json.data.message);
        await loadSessions();
      } else {
        error("Error", json.error?.message || "Failed to revoke other sessions.");
      }
    } catch {
      error("Error", "Network error while revoking other sessions.");
    } finally {
      setRevokingOthers(false);
    }
  };

  const handleLogoutCurrentDevice = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch {
      router.push("/login");
    }
  };

  // ==========================================
  // Password Change Handler
  // ==========================================
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirm password do not match.");
      return;
    }

    try {
      setPasswordSubmitting(true);
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          revokeOtherSessions: revokeOthersOnPasswordChange,
        }),
      });

      const json = await res.json();
      if (json.success) {
        success("Password Updated", json.data.message);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        await loadSessions();
      } else {
        setPasswordError(json.error?.message || "Failed to update password.");
      }
    } catch {
      setPasswordError("Network error while updating password.");
    } finally {
      setPasswordSubmitting(false);
    }
  };

  // ==========================================
  // PIN Handlers
  // ==========================================
  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);

    if (!/^\d{4}$/.test(newPin)) {
      setPinError("New PIN must be exactly 4 numeric digits.");
      return;
    }

    if (newPin !== confirmPin) {
      setPinError("New PIN and Confirm PIN do not match.");
      return;
    }

    if (isPinConfigured && !/^\d{4}$/.test(currentPin)) {
      setPinError("Please enter your current 4-digit PIN.");
      return;
    }

    try {
      setPinSubmitting(true);
      const res = await fetch("/api/admin/pin/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newPin,
          currentPin: isPinConfigured ? currentPin : undefined,
        }),
      });

      const json = await res.json();
      if (json.success) {
        success("PIN Saved", json.data.message);
        setCurrentPin("");
        setNewPin("");
        setConfirmPin("");
        await loadPinStatus();
      } else {
        setPinError(json.error?.message || "Failed to update PIN.");
      }
    } catch {
      setPinError("A network error occurred. Please try again.");
    } finally {
      setPinSubmitting(false);
    }
  };

  const handleResetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);

    if (!/^\d{4}$/.test(resetNewPin)) {
      setPinError("New PIN must be exactly 4 numeric digits.");
      return;
    }

    if (resetNewPin !== resetConfirmPin) {
      setPinError("New PIN and Confirm PIN do not match.");
      return;
    }

    try {
      setPinSubmitting(true);
      const res = await fetch("/api/admin/pin/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPin: resetNewPin }),
      });

      const json = await res.json();
      if (json.success) {
        success("PIN Reset", json.data.message);
        setResetNewPin("");
        setResetConfirmPin("");
        setIsResetMode(false);
        await loadPinStatus();
      } else {
        setPinError(json.error?.message || "Failed to reset PIN.");
      }
    } catch {
      setPinError("Failed to reset PIN. Please try again.");
    } finally {
      setPinSubmitting(false);
    }
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return "Unknown";
    const d = new Date(isoString);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Page Header */}
      <div className="space-y-1 border-b border-border pb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20 mb-2">
          <Sliders className="w-3.5 h-3.5" />
          <span>System Administration & Security</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          Store & Security Settings
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-2xl">
          Manage active sessions, trusted shop devices, owner credentials, and quick action PINs.
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-border gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("sessions")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition cursor-pointer ${
            activeTab === "sessions"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Laptop className="w-4 h-4" />
          <span>Active Sessions & Devices</span>
          {otherSessions.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-primary/10 text-primary font-bold">
              {otherSessions.length + 1}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("password")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition cursor-pointer ${
            activeTab === "password"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Key className="w-4 h-4" />
          <span>Owner Password</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("pin")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition cursor-pointer ${
            activeTab === "pin"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <KeyRound className="w-4 h-4" />
          <span>4-Digit Quick PIN</span>
        </button>
      </div>

      {/* ========================================== */}
      {/* TAB 1: SESSIONS & DEVICES                 */}
      {/* ========================================== */}
      {activeTab === "sessions" && (
        <div className="space-y-6">
          {/* Current Session Card */}
          <div className="bg-card border border-border rounded-2xl p-6 sm:p-7 space-y-5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/80 pb-4">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 shrink-0">
                  <Laptop className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm sm:text-base font-bold text-foreground">
                      Current Device
                    </h2>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-600 border border-emerald-500/20">
                      This Device
                    </span>
                    {currentSession?.isTrustedDevice && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/15 text-blue-600 border border-blue-500/20">
                        Main Shop Device (90 Days)
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {currentSession?.deviceLabel || "Showroom Device"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={loadSessions}
                  className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted border border-border transition cursor-pointer"
                  title="Refresh sessions list"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingSessions ? "animate-spin" : ""}`} />
                </button>

                <button
                  type="button"
                  onClick={handleLogoutCurrentDevice}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/15 text-rose-600 border border-rose-500/20 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Log Out This Device</span>
                </button>
              </div>
            </div>

            {loadingSessions ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                Loading session information...
              </div>
            ) : currentSession ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div className="p-3.5 rounded-xl bg-muted/40 border border-border space-y-1">
                  <div className="text-muted-foreground font-medium flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                    <span>Session Type</span>
                  </div>
                  <div className="font-bold text-foreground">
                    {currentSession.isTrustedDevice ? "Trusted Main Device" : "Standard Device"}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {currentSession.isTrustedDevice
                      ? "90-day max lifetime, 30-day inactivity"
                      : "8-hour automatic expiration"}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-muted/40 border border-border space-y-1">
                  <div className="text-muted-foreground font-medium flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-primary" />
                    <span>Last Active</span>
                  </div>
                  <div className="font-bold text-foreground">
                    {formatDate(currentSession.lastActiveAt)}
                  </div>
                  <div className="text-[10px] text-emerald-600">Active right now</div>
                </div>

                <div className="p-3.5 rounded-xl bg-muted/40 border border-border space-y-1">
                  <div className="text-muted-foreground font-medium flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-primary" />
                    <span>Expires At</span>
                  </div>
                  <div className="font-bold text-foreground">
                    {formatDate(currentSession.expiresAt)}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Server-enforced cutoff</div>
                </div>

                <div className="p-3.5 rounded-xl bg-muted/40 border border-border space-y-1">
                  <div className="text-muted-foreground font-medium flex items-center gap-1">
                    <Globe className="w-3.5 h-3.5 text-primary" />
                    <span>IP / Client</span>
                  </div>
                  <div className="font-bold text-foreground truncate" title={currentSession.ipAddress || "Localhost"}>
                    {currentSession.ipAddress || "127.0.0.1 (Local)"}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate" title={currentSession.userAgent || ""}>
                    {currentSession.userAgent ? currentSession.userAgent.slice(0, 30) + "..." : "Browser"}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* Other Active Devices Card */}
          <div className="bg-card border border-border rounded-2xl p-6 sm:p-7 space-y-5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/80 pb-4">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
                  <span>Other Active Devices</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                    {otherSessions.length} active
                  </span>
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Other browsers or devices currently holding an active session.
                </p>
              </div>

              {otherSessions.length > 0 && (
                <button
                  type="button"
                  onClick={handleRevokeOtherSessions}
                  disabled={revokingOthers}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition shadow-xs flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{revokingOthers ? "Logging out..." : "Log Out All Other Devices"}</span>
                </button>
              )}
            </div>

            {loadingSessions ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                Checking other sessions...
              </div>
            ) : otherSessions.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <div className="text-xs font-semibold text-foreground">
                  No other active device sessions
                </div>
                <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                  Your account is only logged in on this current device.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {otherSessions.map((session) => (
                  <div
                    key={session.id}
                    className="py-3.5 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                        {session.userAgent?.toLowerCase().includes("mobile") ||
                        session.userAgent?.toLowerCase().includes("android") ||
                        session.userAgent?.toLowerCase().includes("iphone") ? (
                          <Smartphone className="w-4 h-4" />
                        ) : (
                          <Laptop className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <div className="text-xs font-bold text-foreground flex items-center gap-2">
                          <span className="truncate">{session.deviceLabel}</span>
                          {session.isTrustedDevice && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-500/15 text-blue-600">
                              Main Device
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                          <span>Last active: {formatDate(session.lastActiveAt)}</span>
                          <span>&bull;</span>
                          <span>Expires: {formatDate(session.expiresAt)}</span>
                          <span>&bull;</span>
                          <span>IP: {session.ipAddress || "Local"}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRevokeSession(session.id)}
                      disabled={revokingId === session.id}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border hover:border-rose-500/30 hover:bg-rose-500/10 text-muted-foreground hover:text-rose-600 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>{revokingId === session.id ? "Revoking..." : "Revoke Access"}</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* TAB 2: OWNER PASSWORD                     */}
      {/* ========================================== */}
      {activeTab === "password" && (
        <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 space-y-6 shadow-xs max-w-2xl">
          <div className="border-b border-border/80 pb-4 space-y-1">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Key className="w-5 h-5 text-primary" />
              <span>Change Master Admin Password</span>
            </h2>
            <p className="text-xs text-muted-foreground">
              Update your master password used for primary shop login and administrative access.
            </p>
          </div>

          {passwordError && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span className="font-medium">{passwordError}</span>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-foreground">
                Current Password <span className="text-rose-500">*</span>
              </label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter existing password"
                className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-xs sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-foreground">
                  New Password <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-xs sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-foreground">
                  Confirm New Password <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-xs sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                />
              </div>
            </div>

            <label className="flex items-center gap-2.5 pt-1 cursor-pointer select-none text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={revokeOthersOnPasswordChange}
                onChange={(e) => setRevokeOthersOnPasswordChange(e.target.checked)}
                className="w-4 h-4 rounded text-primary bg-background border-border"
              />
              <span>Automatically log out of all other active devices on password update</span>
            </label>

            <div className="pt-2">
              <button
                type="submit"
                disabled={passwordSubmitting || !currentPassword || newPassword.length < 8}
                className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition shadow-xs flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {passwordSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Updating Password...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    <span>Update Master Password</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================== */}
      {/* TAB 3: 4-DIGIT OWNER QUICK PIN            */}
      {/* ========================================== */}
      {activeTab === "pin" && (
        <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 space-y-6 shadow-xs max-w-2xl">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/80 pb-5">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                <KeyRound className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <span>Owner Security PIN</span>
                  {loadingPinStatus ? (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground animate-pulse">
                      Checking...
                    </span>
                  ) : isPinConfigured ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                      <CheckCircle2 className="w-3 h-3" />
                      Configured & Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">
                      <AlertCircle className="w-3 h-3" />
                      Not Configured
                    </span>
                  )}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  4-digit code used for high-security actions such as Mark as Sold and Full-Screen Presentation Exit.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={loadPinStatus}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted border border-border transition cursor-pointer"
              title="Refresh status"
            >
              <RefreshCw className={`w-4 h-4 ${loadingPinStatus ? "animate-spin" : ""}`} />
            </button>
          </div>

          {/* Lockout Warning */}
          {isLocked && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 text-xs flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-bold">Security Lockout Active:</span> Too many incorrect PIN attempts were detected. Verification is temporarily locked for approximately <strong>{remainingMinutes} more minute(s)</strong>.
              </div>
            </div>
          )}

          {/* Error Alert */}
          {pinError && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span className="leading-relaxed font-medium">{pinError}</span>
            </div>
          )}

          {/* PIN Management Form */}
          {!isResetMode ? (
            <form onSubmit={handleSavePin} className="space-y-5">
              {isPinConfigured && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-foreground">
                    Current 4-Digit PIN <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    value={currentPin}
                    onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="Enter current 4-digit PIN"
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm tracking-widest text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                    required
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-foreground">
                    {isPinConfigured ? "New 4-Digit PIN" : "Create 4-Digit PIN"}{" "}
                    <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="e.g. 1234"
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm tracking-widest text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-foreground">
                    Confirm 4-Digit PIN <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="Re-enter 4-digit PIN"
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm tracking-widest text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="submit"
                  disabled={pinSubmitting || newPin.length !== 4 || confirmPin.length !== 4}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition shadow-xs flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {pinSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving PIN...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5" />
                      <span>{isPinConfigured ? "Update Owner PIN" : "Save & Activate Owner PIN"}</span>
                    </>
                  )}
                </button>

                {isPinConfigured && (
                  <button
                    type="button"
                    onClick={() => setIsResetMode(true)}
                    className="text-xs text-muted-foreground hover:text-foreground underline transition cursor-pointer"
                  >
                    Forgot Current PIN?
                  </button>
                )}
              </div>
            </form>
          ) : (
            /* Reset PIN Form */
            <form onSubmit={handleResetPin} className="space-y-5 bg-muted/40 p-5 rounded-2xl border border-border">
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  <span>Reset Owner PIN</span>
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Set a replacement 4-digit PIN directly from your authenticated master session.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-foreground">
                    New 4-Digit PIN <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    value={resetNewPin}
                    onChange={(e) => setResetNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="e.g. 5678"
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm tracking-widest text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-foreground">
                    Confirm New PIN <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    value={resetConfirmPin}
                    onChange={(e) => setResetConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="Re-enter PIN"
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm tracking-widest text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={pinSubmitting || resetNewPin.length !== 4 || resetConfirmPin.length !== 4}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition shadow-xs flex items-center gap-2 cursor-pointer"
                >
                  {pinSubmitting ? "Resetting PIN..." : "Confirm PIN Reset"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsResetMode(false);
                    setPinError(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-border text-muted-foreground hover:text-foreground transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
