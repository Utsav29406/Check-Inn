/**
 * Runs in <head>: keeps the browser's install prompt if it comes before the page's scripts load (Chrome can offer it
 * early), for lib/install to pick up.
 */
export const earlyInstallScript = `addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__checkinnInstall=e})`;
