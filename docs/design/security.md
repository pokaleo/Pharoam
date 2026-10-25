# Security model

| | |
|---|---|
| **Version** | 0.1 (in discussion) |
| **Source** | [Architecture](../ARCHITECTURE.md) · [Interfaces](interfaces.md) · [Data model](data-model.md) |

## 1. Threat model

| What we protect | Who or what threatens it |
|---|---|
| Profile data | Malicious web pages and scripts (XSS) · malicious content packs · compromised dependencies · a careless or malicious operator · someone else using the device |
| API keys and OAuth tokens | XSS · malicious browser extensions · other sites calling a localhost relay |
| **Trust in judgements** | **Prompt injection**: text in evidence, pasted CVs, fetched pages or assessment answers that tries to steer the AI |
| The relay | Abuse from the internet; being tricked into fetching internal network addresses (SSRF) |

The user's profile files are readable by design (data model §0). Their protection at rest is the job of the storage the user chooses (disk encryption, Notion's security, and so on).

**Two kinds of attacker need different defences:**
- **Code running in Pharoam's page** (XSS, a compromised dependency, an extension that injects scripts into the page) can do anything the app can. That includes asking WebCrypto to decrypt the cache and reading remembered keys and tokens. **Encryption is no defence against it.** The defences are prevention: safe rendering (§2), a strict content security policy and Trusted Types (§4), and minimal dependencies (§7).
- **Someone with a copy of the device's files** (a backup, a copied browser profile, malware that grabs raw files) can't run code in the page. Encryption helps here only when the key isn't in the same copy (§8).

## 2. Safe rendering
- Markdown from the user's files, AI output and content packs is rendered with **raw HTML disabled and the output sanitised**: no scripts, no embedded frames, safe link handling.
- **Remote images are blocked by default** (they can reveal the user's IP address when displayed). The user can allow them per record.

## 3. Prompt injection
- All content (evidence, pasted text, fetched pages, answers) goes to the model as **clearly marked data**, kept separate from the instructions.
- The output must match the task's schema, which limits what injected text can achieve.
- **The AI can't act on its own.** No AI step writes anything without the user's approval, and no AI step browses or calls tools freely.
- Judging uses the item's **rubric**. Answers that look like they're trying to manipulate the judgement are flagged in the explanation.
- Fetched web content is labelled **untrusted** in the transparency view.

## 4. Secrets and browser hardening
- **API keys:** session-only by default; "remember on this device" is opt-in (AD11).
- **OAuth tokens** (for example Notion): stored like keys, with the **narrowest permissions** each service allows. The relay never stores them.
- **Strict content security policy:** scripts only from the app itself; network calls only to the configured providers and relay; **no third-party scripts, ever**; LangSmith blocked (AD11a).
- **Trusted Types** (`require-trusted-types-for 'script'`, supported in every Chromium browser v0.1 targets): the browser refuses strings written into places that would run them as HTML or script, unless they come from the sanitiser.

## 5. Content pack trust
- **Packs are data only, never code.** They are validated against the schemas and rendered through the sanitiser.
- Packs from a URL need the user's explicit confirmation (interfaces §6).
- **Signed packs** from known publishers come later. Unsigned packs keep the confirmation warning.

## 6. Relay hardening
- `/fetch` refuses private and internal addresses, re-checking after every redirect and DNS lookup. It has size and time limits and accepts only HTML and text.
- Rate limits and request size limits on every endpoint.
- **Request bodies are never logged.**
- Strict rules on which sites may call it; localhost pairing (interfaces §7); standard security headers.

## 7. Supply chain and disclosure
- A committed lockfile; **minimal dependencies**; automated dependency updates (Renovate or Dependabot).
- A vulnerability scan in CI; GitHub Actions pinned to exact versions; secret scanning on the repo.
- `SECURITY.md` explains how to report vulnerabilities privately.

## 8. Data on the device

**Layer 1: always on, no friction**
- The local cache and any remembered keys or tokens are **encrypted** (AES-GCM via WebCrypto).
- The encryption key is created as **non-extractable**: no script can read its raw bytes. But any script running in Pharoam's page can still **use** it to decrypt, so it is **not a defence against XSS or malicious extensions** (§1).
- The key itself is kept in the browser's storage (IndexedDB). Chromium is expected to write its raw bytes to disk in the same browser profile as the encrypted data, so a full copy of the profile, or a backup of it, would hold both. Spike S3 confirms this.
- **Protects against:** casual inspection of the storage files, partial copies that leave out the key, and tools that scan files for plain-text secrets.
- **Does not protect against:** a full copy of the browser profile, code running in the page, or someone using the already-open browser. It is a cheap extra layer, not protection at rest.

**Layer 2: optional App lock**
- The app locks and needs a **passkey** (Touch ID, Windows Hello, a security key) to unlock. The encryption key is derived from the passkey (WebAuthn PRF) and **never stored**, so **without the passkey the cache can't be decrypted at all**, even from a full copy of the device's files.
- A **passphrase** is the fallback where passkeys aren't supported. Its key is derived from the passphrase and also never stored.
- **Auto-lock** after an inactivity period set by the user.
- **Protects against** someone else using the device or browser, and against copied files.
- **Does not protect against** code running in the page while the app is unlocked: the key is then in memory, usable by any script in the page. Auto-lock shortens that window.

**Always:** a "Clear local data" button, a shared-device warning, and session-only keys by default.

**Limits:**
- No layer protects data from code running in Pharoam's page while the app is unlocked. Preventing such code (§1) is the only defence.
- Profile files in the user's chosen storage stay readable by design (data model §0); protecting them is the job of that storage.
- Passkey-derived keys depend on browser support, which spike S3 confirms.
