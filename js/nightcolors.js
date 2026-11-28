/* The sky-photo page's night mode colours (rubin/night.js; owner, 2026-11-24): dim red on
 * black, nothing white or blue. Here so tests/contrast can hold them to the rules like the
 * site's other palettes: every read colour clears 4.5:1 in the worst case under both
 * colour-blindness simulations. Pure red (#ff0000) does not (4.18 for protanopes, who
 * see long-wavelength red as darker); this slightly orange red clears 5.24.
 *
 * The camera's view and the photo keep their own colours (owner, 2026-11-27: they were
 * shown in grey multiplied by pure red, and the owner did not like the picture red at all);
 * only the page around them is red. */
export const NIGHT_COLORS = {
    background: '#000000',
    text: '#ff4a2a', // all text, links, edges of controls
    control: '#200604', // the face of a button; text on it is `text`
    shutter: '#ff4a2a', // the Shoot button's face, its label black (`background`)
};
