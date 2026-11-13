/* The Rubin tab's chart and map colours, on the page column's dark brown. Here rather
   than in the stylesheet so tests/contrast can hold them to the rules, and in a file of
   their own rather than with the games' palettes in logic.js, so the tab does not load
   the games' code for eight colours: every mark and
   text colour clears 4.5:1 in the worst case under both colour-blindness simulations,
   and the three series colours are pairwise distinguishable. They also pass the dataviz
   skill's validator on CVD separation (12.3), the normal-vision floor (18.2) and chroma,
   all pairs; its lightness band is deliberately exceeded, because that band assumes a
   near-black surface and anything inside it falls below 4.5:1 on this brown. See
   NOTES.md. */
export const RUBIN_COLORS = {
    surface: '#3b3026',
    space: '#17120e', // the map's centre: a warm near-black fading to the page at its edges (owner, 2026-10-05)
    text: '#e3e7af',
    muted: '#b8bc93',
    grid: '#51553a',
    evidence: '#58bdf2', // the evidence reading, and objects that pass on it
    grundy: '#f2995a', // Grundy's reading
    watch: '#dde36f', // objects worth watching
};
