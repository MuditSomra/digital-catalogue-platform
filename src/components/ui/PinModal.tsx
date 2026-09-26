"use client";

import React, { useState, useEffect, useRef } from "react";
import { Lock, AlertCircle, X, CheckCircle2, Shield, RefreshCw } from "lucide-react";

interface PinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title?: string;
  description?: string;
  action?: string;
}

export function PinModal({
  isOpen,
  onClose,
  onSuccess,
  title = "Owner PIN Required",
  description = "Enter your 4-digit owner PIN to authorize this action.",
  action = "generic",
}: PinModalProps) {
  const [pin, setPin] = useState<string[]>(["", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [remainingMinutes, setRemainingMinutes] = useState<number | null>(null);

  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  // Focus first input when modal opens
  useEffect(() => {
    if (isOpen) {
      setPin(["", "", "", ""]);
      setError(null);
      checkPinStatus();
      setTimeout(() => {
        inputRefs[0].current?.focus();
      }, 100);
    }
  }, [isOpen]);

  async function checkPinStatus() {
    try {
      const res = await fetch("/api/admin/pin/status");
      const json = await res.json();
      if (json.success) {
        if (!json.data.isConfigured) {
          setError("Owner PIN is not yet configured. Please set up a PIN in Admin Settings.");
        }
        if (json.data.isLocked) {
          setIsLocked(true);
          setRemainingMinutes(json.data.remainingMinutes || 15);
          setError(`PIN verification is locked for ${json.data.remainingMinutes || 15} more minute(s).`);
        } else {
          setIsLocked(false);
        }
      }
    } catch {
      // Ignore network errors on status check
    }
  }

  const handleDigitChange = (index: number, value: string) => {
    // Only accept single digit numbers
    const cleanValue = value.replace(/\D/g, "");
    if (!cleanValue && value !== "") return;

    const char = cleanValue.slice(-1);
    const newPin = [...pin];
    newPin[index] = char;
    setPin(newPin);
    setError(null);

    // Auto-advance to next input
    if (char && index < 3) {
      inputRefs[index + 1].current?.focus();
    }

    // If 4 digits entered, automatically submit
    if (char && index === 3) {
      const fullPin = [...newPin.slice(0, 3), char].join("");
      if (fullPin.length === 4) {
        submitPin(fullPin);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !pin[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
    if (pasted.length === 4) {
      const digits = pasted.split("");
      setPin(digits);
      inputRefs[3].current?.focus();
      submitPin(pasted);
    }
  };

  const submitPin = async (fullPin: string) => {
    if (fullPin.length !== 4) {
      setError("Please enter all 4 digits.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/admin/pin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: fullPin, action }),
      });

      const json = await res.json();

      if (json.success && json.data?.authorized) {
        onSuccess();
        onClose();
      } else {
        setError(json.error?.message || "Incorrect PIN. Please try again.");
        setPin(["", "", "", ""]);
        inputRefs[0].current?.focus();
      }
    } catch (err: unknown) {
      setError("Failed to verify PIN. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden p-6 space-y-5 animate-in zoom-in-95 duration-150 text-slate-900">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold tracking-tight text-slate-900">{title}</h3>
              <p className="text-xs text-slate-500 mt-0.5">{description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <span className="leading-relaxed font-medium">{error}</span>
          </div>
        )}

        {/* 4-Digit Inputs */}
        <div className="space-y-4">
          <div className="flex justify-center items-center gap-3">
            {pin.map((digit, index) => (
              <input
                key={index}
                ref={inputRefs[index]}
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                value={digit}
                disabled={loading || isLocked}
                onChange={(e) => handleDigitChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={index === 0 ? handlePaste : undefined}
                className={`w-12 h-14 text-center text-xl font-bold rounded-xl border bg-white focus:outline-none transition ${
                  digit
                    ? "border-blue-600 ring-2 ring-blue-100 text-slate-900"
                    : "border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 text-slate-900"
                } ${isLocked ? "bg-slate-100 cursor-not-allowed opacity-60" : ""}`}
              />
            ))}
          </div>

          <div className="text-center text-[11px] text-slate-400">
            {isLocked
              ? `Locked out due to repeated failed attempts (${remainingMinutes}m remaining)`
              : "Enter your 4-digit security code"}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => submitPin(pin.join(""))}
            disabled={loading || isLocked || pin.join("").length !== 4}
            className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white transition shadow-xs flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Verifying...</span>
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5" />
                <span>Authorize</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
