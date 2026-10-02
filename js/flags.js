/* Everything the Rubin digest can say about an object beyond pass or fail. Each flag is
 * a question worth a second look, never a verdict, and none of them changes whether an
 * object passes. Defined once, with the label and explanation the digest and the tab
 * show, so a new flag cannot arrive without its words (tests/equilibrium checks that
 * every flag raised is defined here).
 *
 * Brightness flags come from js/brightness.js, orbit flags from js/orbit.js. An object
 * flagged largeIfDark and for its orbit is the one most worth watching: an out-of-place
 * body would likely show itself in both. See NOTES.md.
 */
export const FLAGS = {
    disputed: {
        kind: 'brightness',
        label: 'Disputed',
        means: 'Passes on the evidence reading, but would fail if mid-sized TNOs never compacted, as Grundy et al. (2019) argue.',
    },
    largeIfDark: {
        kind: 'brightness',
        label: 'Large if dark',
        means: 'Fails as a typical object of its brightness, but would pass if it were as dark as the darkest TNOs measured. Only a thermal measurement, an occultation or a moon could settle its size.',
    },
    extremeOrbit: {
        kind: 'orbit',
        label: 'Extreme orbit',
        means: 'Semi-major axis over 150 AU with perihelion beyond 30 AU: an extreme TNO, the population whose clustered orbits prompted the Planet Nine hypothesis.',
    },
    detached: {
        kind: 'orbit',
        label: 'Detached',
        means: 'Perihelion beyond 50 AU, out of Neptune\'s reach: something other than Neptune put it there.',
    },
    highlyInclined: {
        kind: 'orbit',
        label: 'Highly inclined',
        means: 'Orbit tilted more than 40 degrees to the plane of the planets.',
    },
    retrograde: {
        kind: 'orbit',
        label: 'Retrograde',
        means: 'Goes round the Sun the opposite way to the planets.',
    },
    unbound: {
        kind: 'orbit',
        label: 'Unbound',
        means: 'On an open (hyperbolic) path: passing through, not orbiting - fresh from the Oort cloud, or from another star.',
    },
};
