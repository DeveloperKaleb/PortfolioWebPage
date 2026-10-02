/* Whether Rubin is observing, and when the Rubin tab will next change.
 *
 * Two sources, the project owner's choice:
 *   - detected: Fink's nightly alert counts. Rubin observes at every phase of the Moon,
 *     so several nights in a row with no alerts mean it is off the sky - maintenance or
 *     a long spell of bad weather; the counts cannot say which, or when it will end.
 *   - announced: maintenance.json in the rubin-data repo, edited by hand from Rubin's
 *     announcements (www.rubin.community, "Early Operations Update" and "Summit technical
 *     progress" posts). Gives the reason and, when known, the end.
 *
 * And the tab's own schedule: the collector runs every Monday at 06:00 UTC, and pulls
 * new Rubin data from Fink once a month - but only once Rubin has sent alerts since the
 * last pull, so nothing is fetched while Rubin is off-sky.
 *
 * Pure: dates in, dates and words out. No DOM, no network.
 */

/* Nights without an alert before Rubin counts as off-sky. Weather alone often closes a
   night or two; four in a row is rarer. */
export const OFF_SKY_NIGHTS = 4;

/* The collector's weekly run: Monday, 06:00 UTC (its GitHub Actions cron). */
export const RUN_WEEKDAY = 1;
export const RUN_HOUR_UTC = 6;

const DAY = 86400000;
const isoDay = (date) => date.toISOString().slice(0, 10);
const dayStart = (iso) => new Date(`${iso}T00:00:00Z`);

/* Fink's statistics rows ({ 'f:night': 'YYYYMMDD', 'f:alerts': '123' }) as sorted
   { night: 'YYYY-MM-DD', alerts } with only nights that had alerts. */
export function parseNightlyAlerts(rows) {
    return rows
        .map((row) => ({ night: String(row['f:night']), alerts: Number(row['f:alerts']) }))
        .filter((row) => /^\d{8}$/.test(row.night) && row.alerts > 0)
        .map((row) => ({ night: `${row.night.slice(0, 4)}-${row.night.slice(4, 6)}-${row.night.slice(6)}`, alerts: row.alerts }))
        .sort((a, b) => a.night.localeCompare(b.night));
}

export const lastAlertNight = (nights) => (nights.length ? nights.at(-1).night : null);

/* A night is named by the date it began (Fink's convention), so a night's alerts are
   all in by the next morning. Nights without alerts since then, counted to today. */
export function nightsWithout(lastNight, today) {
    if (!lastNight) return null;
    return Math.max(0, Math.round((dayStart(isoDay(today)) - dayStart(lastNight)) / DAY) - 1);
}

/* The announced window in force on a date, or the next one to come. Windows are
   { start, end (optional), reason, link }. */
export function announcedWindow(windows = [], today) {
    const day = isoDay(today);
    const active = windows.find((w) => w.start <= day && (!w.end || day <= w.end));
    if (active) return { ...active, active: true };
    const upcoming = windows.filter((w) => w.start > day).sort((a, b) => a.start.localeCompare(b.start))[0];
    return upcoming ? { ...upcoming, active: false } : null;
}

/* Whether Rubin is observing, from both sources. */
export function observingStatus({ lastNight, today, windows = [] }) {
    const quiet = nightsWithout(lastNight, today);
    const window = announcedWindow(windows, today);
    const offSky = Boolean(window?.active) || (quiet !== null && quiet >= OFF_SKY_NIGHTS);
    return { offSky, lastNight, nightsWithout: quiet, window };
}

/* The next weekly run at or after a moment. */
export function nextRun(after) {
    const at = new Date(Date.UTC(after.getUTCFullYear(), after.getUTCMonth(), after.getUTCDate(), RUN_HOUR_UTC));
    while (at.getUTCDay() !== RUN_WEEKDAY || at <= after) at.setUTCDate(at.getUTCDate() + 1);
    return at;
}

/* Whether this run should pull from Fink: once a month, and only if Rubin has sent
   alerts since the last pull. An unknown alert history (statistics unavailable) does
   not block the pull. */
export function shouldPullFink({ month, finkFetchedMonth, lastPullNight, lastNight }) {
    if (finkFetchedMonth === month) return { pull: false, reason: 'already pulled this month' };
    if (lastPullNight && lastNight && lastNight <= lastPullNight) return { pull: false, reason: 'no new Rubin alerts since the last pull' };
    return { pull: true, reason: null };
}

/* When the tab next changes. The page refreshes every weekly run. New Rubin data comes
   with the first run that is in a month not yet pulled and after Rubin has sent new
   alerts: so while Rubin is off-sky, the first run after it returns (a date only when an
   end has been announced). */
export function nextUpdates({ now, status, finkFetchedMonth }) {
    const refresh = nextRun(now);
    let data = null;
    if (!status.offSky) {
        data = refresh;
        while (data.toISOString().slice(0, 7) === finkFetchedMonth) data = nextRun(new Date(data.getTime() + DAY));
    } else if (status.window?.active && status.window.end) {
        /* The first run after the last night of maintenance, once that night's alerts
           could exist - and in a month not yet pulled. */
        data = nextRun(new Date(dayStart(status.window.end).getTime() + 1.5 * DAY));
        while (data.toISOString().slice(0, 7) === finkFetchedMonth) data = nextRun(new Date(data.getTime() + DAY));
    }
    return { refresh, data, waitingForRubin: status.offSky && !data };
}

/* ---- In words, for the tab ------------------------------------------------------------ */

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const dateWords = (iso) => {
    const [y, m, d] = iso.split('-').map(Number);
    return `${d} ${MONTHS[m - 1]} ${y}`;
};
export const runWords = (date) => `${date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })}, 06:00 UTC`;

/* The notice: whether Rubin is observing, and why if it was announced. Null when Rubin
   is observing and nothing is announced. */
export function statusText(status) {
    const lines = [];
    const w = status.window;
    if (w?.active) {
        lines.push(`Rubin is in ${w.reason ? w.reason.toLowerCase() : 'planned maintenance'} from ${dateWords(w.start)}${w.end ? ` until ${dateWords(w.end)}` : ', with no return date announced yet'}.`);
    } else if (w) {
        lines.push(`Planned maintenance is announced from ${dateWords(w.start)}${w.end ? ` to ${dateWords(w.end)}` : ''}.`);
    }
    if (status.nightsWithout !== null && status.nightsWithout >= OFF_SKY_NIGHTS) {
        lines.push(`Rubin has sent no alerts since the night of ${dateWords(status.lastNight)} (${status.nightsWithout} nights) - off the sky for maintenance or weather.`);
    }
    return lines.length ? lines : null;
}

export function updateText({ refresh, data, waitingForRubin }) {
    const lines = [`This page next refreshes ${runWords(refresh)}.`];
    if (data) lines.push(`New Rubin data next arrives ${runWords(data)}.`);
    else if (waitingForRubin) lines.push('New Rubin data arrives with the first weekly update after Rubin returns to the sky.');
    return lines;
}

/* The last night a pull could have covered, from when it was made: every night before
   the pull's date was already in Fink. Fills in the last pull for data collected before
   the collector recorded it, so a month with nothing new still waits rather than pulling
   with "history unknown". (Not the latest stored detection: none of our objects need
   have been seen on Rubin's last night.) */
export function pullNightFrom(fetchedIso) {
    if (!fetchedIso) return null;
    return new Date(dayStart(fetchedIso.slice(0, 10)).getTime() - DAY).toISOString().slice(0, 10);
}
