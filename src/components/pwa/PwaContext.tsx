"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface PwaContextType {
  isInstallable: boolean;
  isStandalone: boolean;
  isIos: boolean;
  isSafari: boolean;
  showIosBanner: boolean;
  installApp: () => Promise<void>;
  dismissIosBanner: () => void;
}

const PwaContext = createContext<PwaContextType>({
  isInstallable: false,
  isStandalone: false,
  isIos: false,
  isSafari: false,
  showIosBanner: false,
  installApp: async () => {},
  dismissIosBanner: () => {},
});

const IOS_DISMISSED_KEY = "somra_pwa_ios_dismissed_v1";

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isSafari, setIsSafari] = useState(false);
  const [showIosBanner, setShowIosBanner] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Detect Standalone Display Mode (Already running as installed PWA)
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
        document.referrer.includes("android-app://");
      setIsStandalone(Boolean(isStandaloneMode));
      return isStandaloneMode;
    };

    const standalone = checkStandalone();

    // 2. Register Stage 1 Service Worker (Zero-caching, pass-through)
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((reg) => {
          // Check for service worker updates whenever user focuses the app window
          reg.update().catch(() => {});
        })
        .catch((err) => {
          console.debug("PWA service worker registration note:", err);
        });
    }

    // 3. Android / Chromium BeforeInstallPrompt Event Listener
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent browser's default prompt to control the timing
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);
      setIsInstallable(true);
    };

    // 4. App Installed Listener (Hide install buttons immediately)
    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsInstallable(false);
      setIsStandalone(true);
      setShowIosBanner(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    // 5. iOS Safari Detection
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isAppleIos =
      /iphone|ipad|ipod/.test(userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isAppleSafari =
      isAppleIos &&
      /safari/.test(userAgent) &&
      !/crios|fxios|opios|mercury/.test(userAgent);

    setIsIos(isAppleIos);
    setIsSafari(isAppleSafari);

    // Only suggest iOS Add to Home Screen if:
    // - On iOS Safari
    // - NOT running in standalone mode
    // - User hasn't previously dismissed the prompt
    if (isAppleIos && isAppleSafari && !standalone) {
      const isDismissed = localStorage.getItem(IOS_DISMISSED_KEY);
      if (!isDismissed) {
        // Small delay so it doesn't collide with page rendering
        const timer = setTimeout(() => {
          setShowIosBanner(true);
        }, 1500);
        return () => clearTimeout(timer);
      }
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  // Trigger Native Android/Chrome Install Prompt
  const installApp = useCallback(async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setIsInstallable(false);
        setDeferredPrompt(null);
      }
    } catch (err) {
      console.error("Installation prompt failed:", err);
    }
  }, [deferredPrompt]);

  // Dismiss iOS Safari Instruction Banner
  const dismissIosBanner = useCallback(() => {
    setShowIosBanner(false);
    try {
      localStorage.setItem(IOS_DISMISSED_KEY, "1");
    } catch {
      // Storage access disabled or private mode
    }
  }, []);

  return (
    <PwaContext.Provider
      value={{
        isInstallable,
        isStandalone,
        isIos,
        isSafari,
        showIosBanner,
        installApp,
        dismissIosBanner,
      }}
    >
      {children}
    </PwaContext.Provider>
  );
}

export function usePwa() {
  return useContext(PwaContext);
}
