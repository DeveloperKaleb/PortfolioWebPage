// Local preview server. Run it with `npm run dev`.
//
// Why this exists at all: the site is deployed to GitHub Pages under the
// /PortfolioWebPage/ subpath, and entertainment.html plus scripts/nav.js hard-code
// that prefix into their <link>/<script> tags (see the "Path conventions" section
// of CLAUDE.md). So the site only works when it's served from that exact path -
// opening index.html off the filesystem, or serving the folder at the root of a
// static server, leaves the nav bar and stylesheet 404ing.
//
// Rather than making the folder name on disk match the URL (a symlink or a
// junction), this server just maps the URL prefix onto the repo root: a request
// for /PortfolioWebPage/style.css is served from ./style.css. Nothing is copied,
// nothing is linked, and there's nothing to clean up afterwards.

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BASE_PATH = '/PortfolioWebPage'; // must match `basePath` in scripts/nav.js

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : null;
};
const PORT = Number(flag('port') || process.env.PORT || 8123);
const OPEN = args.includes('--open');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
};

const send = (res, status, body, type = 'text/plain; charset=utf-8') => {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
};

const server = http.createServer((req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
  } catch {
    return send(res, 400, '400 Bad Request');
  }

  // Bare / is a convenience redirect - the real site never lives there.
  if (urlPath === '/' || urlPath === BASE_PATH) {
    res.writeHead(302, { Location: `${BASE_PATH}/` });
    return res.end();
  }

  if (!urlPath.startsWith(`${BASE_PATH}/`)) {
    return send(
      res,
      404,
      `404 Not Found: ${urlPath}\n\n` +
        `This server only serves the site under ${BASE_PATH}/, matching the\n` +
        `GitHub Pages layout the site's absolute paths assume.\n` +
        `Try http://localhost:${PORT}${BASE_PATH}/`
    );
  }

  let rel = urlPath.slice(BASE_PATH.length);
  if (rel.endsWith('/')) rel += 'index.html';

  // Resolve first, then confirm the result is still inside ROOT, so encoded or
  // nested ../ segments can't escape the repo.
  const file = path.resolve(ROOT, `.${rel}`);
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) {
    return send(res, 403, '403 Forbidden');
  }

  fs.readFile(file, (err, buf) => {
    if (err) {
      const why = err.code === 'EISDIR' ? ' (directory - try a trailing slash)' : '';
      console.log(`  404 ${urlPath}${why}`);
      return send(res, 404, `404 Not Found: ${urlPath}${why}`);
    }
    console.log(`  200 ${urlPath}`);
    // no-store matters here: this repo cache-busts by hand (see NOTES.md), and a
    // cached preview would quietly hide the change you're trying to look at.
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(buf);
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `\nPort ${PORT} is already in use - an older preview server is probably still running.\n` +
        `Either stop it, or pick another port:  npm run dev -- --port 8124\n`
    );
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, () => {
  const home = `http://localhost:${PORT}${BASE_PATH}/`;
  console.log(`\n  Serving ${ROOT}`);
  console.log(`\n  Home          ${home}`);
  console.log(`  Entertainment ${home}entertainment/entertainment.html`);
  console.log(`\n  Files are served straight from the working tree, uncommitted changes`);
  console.log(`  included, with caching disabled - just refresh after an edit.`);
  console.log(`\n  Ctrl+C to stop.\n`);

  if (OPEN) {
    const cmd =
      process.platform === 'win32' ? 'start ""' : process.platform === 'darwin' ? 'open' : 'xdg-open';
    require('child_process').exec(`${cmd} "${home}"`, (err) => {
      if (err) console.log(`  (couldn't open a browser automatically - open ${home} yourself)`);
    });
  }
});
