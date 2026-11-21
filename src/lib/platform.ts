/**
 * Runs in <head>, before the page paints: marks <html data-os="ios"> on iPhones and iPads and
 * <html data-os="android"> on Android, so phones get the matching design (the ios: and android: variants in globals.css).
 * Anything else (desktop, other phones) gets no mark and keeps the standard design.
 */
export const platformScript = `(function(){var u=navigator.userAgent,d=document.documentElement;if(/iPhone|iPad|iPod/.test(u)||(/Macintosh/.test(u)&&navigator.maxTouchPoints>1))d.dataset.os="ios";else if(/Android/.test(u))d.dataset.os="android"})()`;
