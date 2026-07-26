# Deployment

## Production

The canonical production URL is <https://spliittrr.web.app/>.

`.github/workflows/deploy.yml` is the only production release pipeline:

- Pull requests to `main` run the TypeScript test and production build.
- Pushes to `main` run the same checks, upload the exact tested `dist`
  artifact, and deploy that artifact to the Firebase Hosting live channel.
- Manual production releases use the same workflow through
  `workflow_dispatch`.

The deploy job requires the repository secret
`FIREBASE_SERVICE_ACCOUNT_SPLIITTRR`. It must contain the JSON credential for
a dedicated Firebase Hosting deploy service account. Never commit this value
or place it in a Vite environment variable.

## Retiring GitHub Pages

GitHub Pages cannot be disabled while it is still expected to serve a
redirect. Automatic application deployment to Pages has been removed.

Run the `Retire GitHub Pages PWA` workflow once after this change reaches
`main`. It deploys only `github-pages-retirement/`, which:

1. replaces the Service Worker at the existing
   `/mickey-bill-splitter/sw.js` scope;
2. deletes only Bill Splitter's legacy and Workbox precache caches;
3. unregisters the retired Service Worker without touching local storage;
4. redirects users and deep links to the Firebase production URL.

Keep the retirement page deployed while old GitHub Pages users are still
expected. Disabling Pages later also removes the redirect.

The Gemini API key exposed by the former GitHub Pages build must be revoked
separately. Removing a GitHub secret or replacing the deployed files cannot
invalidate copies already present in browser caches or external archives.
