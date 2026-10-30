# DISC D Kurd

Work on `main`. Commit as you go and push to `origin/main`. Do not open pull requests for this repo.

Local preview: `npm run serve` (or `node scripts/serve.mjs [port]`) serves the repo on `127.0.0.1:8765` with `Cache-Control: no-store`. The open tab reloads itself.

Deploy: a push to `main` builds `ghcr.io/m-esm/handpan:main-<run>-<sha7>` and Flux image automation rolls it to `https://handpan.moshes.io` within about ten minutes. Nothing to run by hand. The manifests are in `m-esm/cluster-moshes-lab` `apps/alamut`; do not add copies of them here. Details in the README's Deployment section.
