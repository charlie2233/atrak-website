# AccessCourt inclusive sports technology website

This is a dependency-free website for Atrak's inclusive sports technology initiative and its working Visual Drill Coach MVP. Adaptive basketball is the community focus; relevant Atrak projects are connected through explicit `Live`, `Adapt next`, and `Research` labels.

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

The partnership form posts to the same `https://formspree.io/f/mvzqdnov` endpoint used by Atrak's public forms. Its subject and source fields identify AccessCourt inquiries. It is limited to adult partnership inquiries and warns users not to submit sensitive participant information.
The current form uses Formspree's default confirmation flow. `success.html` is included as an optional branded confirmation page, but it must not be described as the active redirect unless that redirect is configured and verified in the Formspree dashboard. Do not submit the form during automated or visual QA.

## Phone capability

The landing page and Visual Drill Coach are tested at 320, 360, 390, and 430 pixel portrait widths plus 667×375 and 844×390 landscape viewports. Mobile behavior includes safe-area support, 16px form fields to prevent iOS focus zoom, 44px touch targets, compact menus, a collapsible Coach settings panel, step controls in the initial viewport, responsive drill imagery, and automatic horizontal sequence tracking. The smoke suite mocks speech playback and never submits the partnership form.

## Reciprocal navigation and future domain

Atrak links to AccessCourt from its primary navigation, project card, and footer. Every AccessCourt page links back to `https://atrak.dev/` with an absolute URL so that the relationship remains visible after AccessCourt moves to a standalone domain.

GitHub Pages supports one custom domain per Pages site. When the final AccessCourt domain is chosen, deploy this folder from a dedicated Pages project, add that domain's `CNAME` there, update the canonical and social URLs, then point Atrak's AccessCourt links to the new domain. Keep `https://atrak.dev/accesscourt/` available until the standalone site and redirects have been verified.
