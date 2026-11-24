/* The sky-photo page's night mode colours (rubin/night.js; owner, 2026-11-24): dim red on
 * black, nothing white or blue. Here so tests/contrast can hold them to the rules like the
 * site's other palettes: every read colour clears 4.5:1 in the worst case under both
 * colour-blindness simulations. Pure red (#ff0000) does not (4.18 for protanopes, who
 * see long-wavelength red as darker); this slightly orange red clears 5.24.
 *
 * The camera's view and the photo are shown in grey and multiplied by pure red (`tint`;
 * style.css, html.night .skyphoto-view), so nothing on them lights green or blue either:
 * a colour filter left the bright parts orange and yellow. Star names drawn on the photo
 * turn red with it. `tint` is never text. */
export const NIGHT_COLORS = {
    background: '#000000',
    text: '#ff4a2a', // all text, links, edges of controls
    control: '#200604', // the face of a button; text on it is `text`
    shutter: '#ff4a2a', // the Shoot button's face, its label black (`background`)
    tint: '#ff0000', // multiplied over the camera's view and the photo, shown in grey: only red is lit
};
