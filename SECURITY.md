# Security policy

## Reporting a vulnerability

**Please don't report security issues in public issues.**

Use GitHub's private vulnerability reporting: go to the [Security tab](https://github.com/pokaleo/Pharoam/security) and choose **Report a vulnerability**. We'll acknowledge the report as soon as we can and keep you updated on the fix.

## Scope

Pharoam is pre-release; there is no supported version yet. Reports about the design are welcome too. The security model is in [docs/design/security.md](docs/design/security.md).

Particularly relevant:
- anything that could send profile data to a server, or store it there;
- leaks of API keys or OAuth tokens;
- unsafe rendering of Markdown (XSS) or remote content;
- prompt injection that bypasses user approval or steers a diagnostic's marking;
- relay weaknesses (SSRF, missing pairing, logging of request bodies).
