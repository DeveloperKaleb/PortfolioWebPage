# rubin-data

The long-term record behind the Rubin tab of
[developerkaleb.github.io/PortfolioWebPage](https://developerkaleb.github.io/PortfolioWebPage/):
outer Solar System objects large enough to have at least an 80% chance of having been
shaped by their own gravity, assessed from public Rubin Observatory data.

Everything here is written by a scheduled GitHub Action (`.github/workflows/collect.yml`)
running the collector in the site repo (`tools/rubin-collect.mjs`). Nothing is edited by
hand.

## Where the data comes from

- **[JPL Small-Body Database](https://ssd.jpl.nasa.gov/)**: the list of trans-Neptunian
  objects and their orbits.
- **[Fink](https://fink-broker.org/)**, a Rubin alert broker: Rubin's detections of those
  objects, from which their brightness is measured. Rubin's alerts are world-public.

Requests are deliberately few and gentle: one at a time, seconds apart, a hard budget
per run, backing off when asked, and identified with a contact address. A quiet week is
one request to JPL; Fink is asked once a month.

## Layout

| Path | What |
|---|---|
| `state.json` | Last counts and fetch dates |
| `inputs/YYYY-MM/tnos.json` | JPL orbits and catalogue H for every TNO that month |
| `inputs/YYYY-MM/detections.json` | The Fink detections used that month |
| `digest/YYYY-MM.json` | That month's results: passes, near misses, flags |
| `digest/latest.json` | The newest digest, which the site reads |
| `changes/YYYY-MM.json` | What changed since the month before |

Inputs are kept every month so any future filter can be re-run against the whole
history. Each digest records the site commit, cutoffs and thresholds that produced it.
JSON files put one object per line, so the history diffs cleanly.

## Reading a digest entry

- `chance`: the chance the object was shaped by its own gravity (evidence reading);
  `passes` when at least 0.8.
- `chanceGrundy`: the same if mid-sized TNOs never compacted (Grundy et al. 2019).
- `chanceIfDark`: the same if it were as dark as the darkest TNOs measured.
- `flags`: `disputed`, `largeIfDark`, and orbit flags (`extremeOrbit`, `detached`,
  `highlyInclined`, `retrograde`, `unbound`). `watch` marks a failing object that is both
  large-if-dark and on an unusual orbit.
- `hSource`: whether H came from Rubin's own detections or the catalogue.

Data: JPL/NASA and the Rubin Observatory via the Fink broker; TNO albedos from Johnston's
compilation (NASA PDS, doi:10.26033/y5sn-4t02).

## Maintenance windows (`maintenance.json`, edited by hand)

The only file here edited by hand. When Rubin announces downtime (its forum,
www.rubin.community: "Early Operations Update" and "Summit technical progress" posts),
add a window. The page says why Rubin is off-sky and, when an end is given, when new
Rubin data will next arrive:

```json
{
  "windows": [
    { "start": "2026-07-15", "reason": "Storm recovery and planned maintenance",
      "link": "https://www.rubin.community/t/summit-technical-progress-week-ending-2026-09-25/12773" }
  ]
}
```

`start` and `end` are dates (`YYYY-MM-DD`); leave `end` out until one is announced. Without
this file the page still notices a pause on its own, from Rubin's nightly alert counts (no
alerts for 4 nights or more), but cannot say why or for how long.
