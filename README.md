# Hole

Static browser game where pointer or touch movement controls a black hole. Eat falling discs, grow score, and keep best score locally.

## Structure

- `public/index.html` - app markup and deploy entry point
- `public/global.css` - global styling
- `src/app.ts` - typed browser-only game source
- `public/app.js` - compiled browser game logic
- `public/_redirects` - static host SPA fallback
- `public/_headers` - basic static security headers

## Run locally

Install dependencies, compile TypeScript, then serve the `public` folder with any static file server:

```sh
npm install
npm run build
python3 -m http.server 4173 --directory public
```

Then open `http://localhost:4173`.
