Strato deploy checklist

1) Build static HTML (partials → inlined, CSS bundled)
- Prereq: Node.js 18+
- Run: `npm run build` (or `node scripts/build.mjs`)
- Output: `dist/` with `index.html`, bundled `css/styles.css`, icons, images, `.htaccess`, and `contact.php`.

2) Upload to Strato web root
- Upload the contents of `dist/` to your Strato web space (typically `/` or `/htdocs`).
- Keep `.htaccess` in place to enable caching, compression, and security headers.

3) Configure `contact.php`
- Edit `contact.php` and set:
  - `$TO_EMAIL` to a mailbox on your domain (e.g. `info@your-domain.tld`).
  - `$FROM_EMAIL` to an address on your domain (e.g. `webform@your-domain.tld`).
- In Strato panel, ensure PHP is enabled for the domain/subdomain and that mail() is permitted.

4) Paths and subfolders
- The build rewrites root-absolute favicon/manifest links to relative paths so hosting in a subfolder works.
- Navigation links like `/about` are still absolute; either create those pages (about/index.html, etc.) or change links to your actual URLs.

5) External services
- Google Fonts: allowed by CSP in `.htaccess`. Already using `display=swap`.
- Google Maps iframe: allowed by CSP via `frame-src` for google.com.
- If you add more CDNs, update the CSP in `.htaccess` accordingly.

6) Caching strategy
- HTML: ~10 minutes
- CSS/JS: 7 days
- Images/Icons: 30 days
- If you adopt hashed filenames later, you can safely raise CSS/JS to 1 year with `immutable`.

7) Troubleshooting
- 500 error after upload: temporarily disable custom CSP in `.htaccess` by commenting the `Content-Security-Policy` line to confirm.
- PHP mail not arriving: use a domain mailbox in `$FROM_EMAIL`, check spam folder, and Strato mail logs.
- Styles not updating: your browser may cache CSS; hard refresh or clear cache. Consider cache-busting by updating file names if needed.

