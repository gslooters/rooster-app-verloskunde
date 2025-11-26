// DRAAD61D: Nieuw cachebuster bestand als Railway trigger
// Zet een global window property met huidige tijd en random waarde

declare global {
  interface Window {
    __DRAAD61D_CACHEBUST?: number
    __DRAAD61D_TRIGGER?: number
  }
}

export function triggerCacheBust61D(): void {
  if (typeof window !== 'undefined') {
    // unieque timestamp om cache en railway te busten
    window.__DRAAD61D_CACHEBUST = Date.now();
    window.__DRAAD61D_TRIGGER = Math.floor(Math.random() * 1000000);
  }
}

// Direct uitvoeren bij import
triggerCacheBust61D();
