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
