# Form protection and Turnstile activation

## What is active

The site posts to Formspree over HTTPS. The existing `_gotcha` honeypot is
preserved for Formspree's server-side filtering. Browser validation, one request
at a time, bounded field lengths, a 20-second request timeout, and clear recovery
messages improve the normal submission path. These browser controls are bypassable
and are **not** a replacement for server-side spam protection or rate limiting.
The website does not add an automatic referrer URL or new required personal
information. The referral category is optional. Turnstile processes technical
request/browser information for abuse prevention, as disclosed in the privacy policy.

The frontend is configured with the owner-provided production public site key.
**Server-side Turnstile enforcement is pending private activation in Formspree.**
The widget alone is not endpoint protection. Authenticated inspection on October
10, 2026 confirmed Formshield enabled and CAPTCHA disabled for both public forms.
The owner must privately enter the matching secret in the Turnstile provider
settings after this frontend is live. Preserve the enabled Formshield filters.
No secret belongs in this repository. No provider setting was saved by this change.

## Coordinated activation

Both sites use static GitHub Pages hosting. Formspree now supports Cloudflare
Turnstile natively: Formspree verifies `cf-turnstile-response` with a private secret
before accepting the form. A Cloudflare Worker, DNS move, paid service, or custom
mail backend is not needed for this integration. Putting a widget on the page
without enabling verification in Formspree would not protect the endpoint.

The owner approved configuration and one marked test submission per site. The
existing Cloudflare and Formspree browser sessions are authenticated. The owner
creates credentials and enters and submits secrets privately; only public site
keys may be shared for the frontend. Preserve the enabled Formshield filters.
Use Managed mode, limited to the actual production hostname(s), and no production
test keys. No purchase, new account, persistent agent credential, or DNS change is
part of this plan. Stop if the account requires a plan change.

- Atrak: `mvzqdnov`, hostname `atrak.dev`. Add the public widget to **all five**
  form instances before enforcement: homepage suggestion and join, `join.html`,
  `security.html`, and `press-kit.html`. Do not change the separate automation
  notification endpoint `mbdzrwbo`.
- HoopClips: `xlgwzrdk`, hostname `hoopclips.com`, contact form in `index.html`.

Coordinate the client rollout and provider enforcement so legitimate submissions
are not stranded between them. Only the public site key belongs in HTML/config.
Keep the secret exclusively in Formspree settings; never in Git, browser code,
logs, screenshots, or chat. Preserve `_gotcha` and the existing consent wording.
Atrak anonymous forms must remain usable without name, email, or referral fields.

The implementation must handle blocked widget loading, expired challenges, and
provider rejection without clearing the message or claiming success. Tokens last
five minutes and are single-use: refresh expired tokens and reset after every
attempt, including failed requests. Keep status announcements accessible and a
usable way to recover. Do not silently fall back around CAPTCHA enforcement.
Update privacy notices before enabling the Cloudflare script.

Test widget behavior with official test keys and mocked submission responses in
local QA only. Actual positive and missing/invalid-token requests against Formspree
need **separate permission for live test submissions**. Verify provider rejection
before claiming server enforcement. A successful push or rendered widget is not
proof that the backend rejects bots.

## Offline regression checks

```sh
bash scripts/test-forms.sh
```

This installs pinned jsdom test tooling in ignored `scripts/.form-test-runner/`.
Tests execute the real form handlers and HTML with mocked `fetch`; they do not
load remote resources or send live forms. They cover validation, optional referral,
honeypots, duplicate requests, success, HTTP errors, timeout, and manual recovery,
plus each site's consent/privacy behavior. Tests also cover widget loading, expiry,
retry, fail-closed submission, token forwarding, and reset after each attempt.
Browser layout and backend enforcement must be checked separately.

## Primary references

- [Formspree Turnstile setup and server verification](https://help.formspree.io/articles/form-and-project-settings/protecting-your-forms-with-cloudflare-turnstile)
- [Cloudflare server-side validation and token limits](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
- [Formspree honeypot filtering](https://help.formspree.io/articles/building-your-form/honeypot-spam-filtering)
