# Optional completion catalog check

The downloader may receive a **fresh local copy** of the canonical `classics_catalog.json` using `--completion-catalog`.

Canonical Drive file ID used by the larger workflow:

`1Bal3bdZMCtXJma6q6Z--zNFvJPC2oeV-`

This standalone package is intentionally **read only** with respect to that catalog. It can validate and check it, but it does not upload, append or replace the Drive file.

For one-off local testing without a catalog, pass `--allow-without-completion-catalog`.
