/** sessionStorage key: the opening animation has played in this tab. */
const PLAYED = "checkinn_opening";

/**
 * Runs in <head>, before anything paints: marks <html> with data-opening="on" if the opening animation should play
 * (first page of a visit, not the admin panel, motion allowed), otherwise "off". The installed app skips it: the
 * phone already shows its own launch screen (the app icon), and one opening screen is enough. The CSS uses it to start the page dark
 * under the animation, and to hide the animation entirely on repeat visits.
 */
export const openingScript = `(function(){var d=document.documentElement;if(location.pathname.indexOf("/admin")===0||matchMedia("(display-mode: standalone)").matches||navigator.standalone===true){d.dataset.opening="off";return}try{if(sessionStorage.getItem("${PLAYED}")||matchMedia("(prefers-reduced-motion: reduce)").matches){d.dataset.opening="off"}else{sessionStorage.setItem("${PLAYED}","1");d.dataset.opening="on"}}catch(e){d.dataset.opening="off"}})()`;
