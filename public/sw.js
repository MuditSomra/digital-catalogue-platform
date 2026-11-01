// Somra PWA Service Worker (Stage 1: Installability & Safe Deployment Updates)
// -----------------------------------------------------------------------------
// Strict Zero-Caching Policy:
// - All network requests pass directly to the network without CacheStorage interception.
// - Ensures newly deployed Vercel versions are instantly delivered on reload without stale bundles.
// - Complies strictly with Stage 1 restrictions: NO caching of product prices, inventory, admin pages, or credentials.

self.addEventListener("install", (event) => {
  // Activate immediately without waiting for existing instances to close
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Claim control of all active clients immediately
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Pass-through fetch handler satisfying PWA installability requirements
  // Direct network requests only - zero caching of dynamic business data
  event.respondWith(fetch(event.request));
});
