# T0006 Resolution Plan – Feedback Form (Netlify)

Shared form: everyone who opens the site sees the latest entries. Data is stored in Netlify Blobs
(built into Netlify, free plan, no outside database).

## Files
- `public/index.html` – the whole form (single HTML file)
- `netlify/functions/api.mjs` + `netlify/lib/handler.mjs` – the small API that saves/loads entries
- `package.json`, `netlify.toml` – tell Netlify how to build

## Deploy (GitHub, about 5 minutes)
1. Create a free GitHub repository and upload everything in this folder (keep the folder structure).
2. In Netlify: Add new site > Import an existing project > pick the repository. Leave the build
   command empty. Publish directory: `public` (already set in netlify.toml). Deploy.
3. Optional: Site configuration > Environment variables > add `ADMIN_KEY` with a passcode you choose,
   then redeploy. An "Admin" button then appears on the page; entering the key lets you edit or delete any entry.
4. Open the site URL and send it to your team.

## Deploy (Netlify CLI alternative)
```
npm install
npm install -g netlify-cli
netlify login
netlify deploy --prod
```

## Notes
- Do not use plain drag-and-drop of `index.html`; it has no server, so entries would not be shared.
- Anyone with the link can add entries. The page is marked noindex, but the link itself is the only protection.
- People can edit or delete entries they created in their own browser. Clearing browser data loses that right
  (an admin can still manage the entry).
