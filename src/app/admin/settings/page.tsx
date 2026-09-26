"use client";

import React, { useState, useEffect } from "react";
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
  HelpCircle,
} from "lucide-react";

export default function AdminSettingsPage() {
  const { success, error, info } = useToast();

  const [isPinConfigured, setIsPinConfigured] = useState<boolean | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [remainingMinutes, setRemainingMinutes] = useState<number | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  // Form State
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Reset Form State
  const [isResetMode, setIsResetMode] = useState(false);
  const [resetNewPin, setResetNewPin] = useState("");
  const [resetConfirmPin, setResetConfirmPin] = useState("");

  const loadStatus = async () => {
    try {
      setLoadingStatus(true);
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
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!/^\d{4}$/.test(newPin)) {
      setFormError("New PIN must be exactly 4 numeric digits.");
      return;
    }

    if (newPin !== confirmPin) {
      setFormError("New PIN and Confirm PIN do not match.");
      return;
    }

    if (isPinConfigured && !/^\d{4}$/.test(currentPin)) {
      setFormError("Please enter your current 4-digit PIN.");
      return;
    }

    try {
      setIsSubmitting(true);
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
        await loadStatus();
      } else {
        setFormError(json.error?.message || "Failed to update PIN.");
      }
    } catch (err: unknown) {
      setFormError("A network error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!/^\d{4}$/.test(resetNewPin)) {
      setFormError("New PIN must be exactly 4 numeric digits.");
      return;
    }

    if (resetNewPin !== resetConfirmPin) {
      setFormError("New PIN and Confirm PIN do not match.");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch("/api/admin/pin/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newPin: resetNewPin,
        }),
      });

      const json = await res.json();
      if (json.success) {
        success("PIN Reset", json.data.message);
        setResetNewPin("");
        setResetConfirmPin("");
        setIsResetMode(false);
        await loadStatus();
      } else {
        setFormError(json.error?.message || "Failed to reset PIN.");
      }
    } catch {
      setFormError("Failed to reset PIN. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
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
          Configure security credentials, owner authentication PIN, and showroom preferences.
        </p>
      </div>

      {/* Security Credentials Card: PIN Management */}
      <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 space-y-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/80 pb-5">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <span>Owner Security PIN</span>
                {loadingStatus ? (
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
                4-digit code used for switching into Admin Mode, exiting Showroom Presentation, and authorizing Mark as Sold actions.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadStatus}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted border border-border transition"
              title="Refresh status"
            >
              <RefreshCw className={`w-4 h-4 ${loadingStatus ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Lockout Warning */}
        {isLocked && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 text-xs flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-bold">Security Lockout Active:</span> Too many incorrect PIN attempts were detected. Verification is temporarily locked for approximately <strong>{remainingMinutes} more minute(s)</strong> to protect against brute-force attempts.
            </div>
          </div>
        )}

        {/* Error Alert */}
        {formError && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <span className="leading-relaxed font-medium">{formError}</span>
          </div>
        )}

        {/* PIN Management Form */}
        {!isResetMode ? (
          <form onSubmit={handleSavePin} className="space-y-5 max-w-lg">
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
                <p className="text-[11px] text-muted-foreground">
                  Verify current PIN to establish authorization.
                </p>
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
                disabled={isSubmitting || newPin.length !== 4 || confirmPin.length !== 4}
                className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition shadow-xs flex items-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
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
                  className="text-xs text-muted-foreground hover:text-foreground underline transition"
                >
                  Forgot Current PIN?
                </button>
              )}
            </div>
          </form>
        ) : (
          /* Reset PIN Form */
          <form onSubmit={handleResetPin} className="space-y-5 max-w-lg bg-muted/40 p-5 rounded-2xl border border-border">
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <span>Reset Owner PIN</span>
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Set a replacement 4-digit PIN directly from your authenticated admin session.
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
                disabled={isSubmitting || resetNewPin.length !== 4 || resetConfirmPin.length !== 4}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition shadow-xs flex items-center gap-2"
              >
                {isSubmitting ? "Resetting PIN..." : "Confirm PIN Reset"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsResetMode(false);
                  setFormError(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-border text-muted-foreground hover:text-foreground transition"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Security & Feature Use Notes */}
        <div className="pt-4 border-t border-border grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-muted-foreground">
          <div className="space-y-1">
            <div className="font-semibold text-foreground flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5 text-primary" />
              <span>Showroom Mode Switch</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              When customers browse the showroom, entering the PIN switches to the management dashboard instantly without needing the full admin password.
            </p>
          </div>

          <div className="space-y-1">
            <div className="font-semibold text-foreground flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-primary" />
              <span>Full-Screen Exit</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Prevents customers from exiting presentation mode on showroom displays without owner supervision.
            </p>
          </div>

          <div className="space-y-1">
            <div className="font-semibold text-foreground flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
              <span>Owner Quick Sale</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Authorizes "Mark as Sold" actions on product detail cards to deduct real-time stock and create audited movement records.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
