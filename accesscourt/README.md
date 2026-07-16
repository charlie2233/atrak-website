# AccessCourt pilot website

This is a dependency-free static website and Visual Drill Coach MVP.

Public route after review and deployment: `https://atrak.dev/accesscourt/`.

## Run locally

From this folder:

```bash
python3 -m http.server 4173
```

Then open `http://127.0.0.1:4173/`.

## Important status language

The site intentionally states that AccessCourt is in pilot development, is not yet an independent 501(c)(3), is not soliciting donations, and does not claim contributions are tax-deductible. Do not remove that language until formal approvals support a change.

## Form

The partnership form posts to the owner-provided Formspree endpoint. It is limited to adult partnership inquiries and warns users not to submit sensitive participant information.
The current form uses Formspree's default confirmation flow. `success.html` is included as an optional branded confirmation page, but it must not be described as the active redirect unless that redirect is configured and verified in the Formspree dashboard. Do not submit the form during automated or visual QA.

## Reciprocal navigation and future domain

Atrak links to AccessCourt from its primary navigation, project card, and footer. Every AccessCourt page links back to `https://atrak.dev/` with an absolute URL so that the relationship remains visible after AccessCourt moves to a standalone domain.

GitHub Pages supports one custom domain per Pages site. When the final AccessCourt domain is chosen, deploy this folder from a dedicated Pages project, add that domain's `CNAME` there, update the canonical and social URLs, then point Atrak's AccessCourt links to the new domain. Keep `https://atrak.dev/accesscourt/` available until the standalone site and redirects have been verified.
