# ADR-0009: Encrypted local cache and offline support

- **Status:** Accepted
- **Date:** 2026-10-24
- **Covers:** AD9, AD20, [Security](../design/security.md) §8

## Context
Reading through connectors every time is slow (for example Notion's rate limit), and minimal mode must work offline. The user's storage must stay the master copy, and data on the device must be protected.

## Decision
- A **local cache** in IndexedDB via **Dexie.js**. It is never the master copy, can always be rebuilt from storage, and can be cleared by the user.
- The app shell and default content are cached so **minimal mode opens offline**. Offline changes to remote storage are queued.
- **Always-on encryption** (AES-GCM) using a non-extractable browser key. Because the key is stored in the same browser profile, this only hides the cache from casual inspection and partial copies.
- **Optional App lock:** the key is derived from a passkey (WebAuthn PRF), with a passphrase fallback and auto-lock. The key is never stored, so this is the layer that protects copied files.
- **Neither layer stops code running in Pharoam's page** (XSS, compromised dependencies, injecting extensions): such code can use the key through WebCrypto. That threat is met by prevention ([Security](../design/security.md) §1, §2, §4).

## Alternatives rejected
- **No cache:** too slow, and no offline use.
- **No encryption:** cheap protection, limited as it is, would be left unused.

## Consequences
The cache must be kept consistent with storage (ADR-0010). Passkey support must be confirmed, and so must how Chromium writes a stored non-extractable key to disk (spike S3). Documentation and the interface must not describe always-on encryption as protecting against XSS or a copied browser profile.
