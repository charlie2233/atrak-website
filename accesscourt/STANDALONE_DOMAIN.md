# AccessCourt standalone-domain handoff

Status: waiting for the owner to confirm and register the exact domain.

## Recommended target

`accesscourt.org` is the preferred public name. On July 15, 2026 PT, the Public Interest Registry RDAP endpoint returned `404 Object not found`, which is a strong current signal that no registration object exists. It is not a reservation or checkout guarantee:

- https://rdap.publicinterestregistry.org/rdap/domain/accesscourt.org

Backups, in order: `accesscourtlabs.org`, `getaccesscourt.org`, and `accesscourt.us`. `accesscourt.com` is already registered.

## Deployment architecture

Use a dedicated AccessCourt repository or hosting project whose published root is the current `accesscourt/` folder. Keep Atrak and AccessCourt as separate deployments:

- `https://atrak.dev/` — Atrak technology team and project portfolio.
- `https://accesscourt.org/` — AccessCourt canonical public site.
- `https://atrak.dev/accesscourt/` — temporary bridge/fallback until the standalone deployment and redirects are proven.

AccessCourt already uses relative internal links and assets. Its links back to Atrak are absolute, so they will continue working after migration.

## Activation checklist

1. Confirm spelling, registration price, renewal price, WHOIS/privacy terms, and trademark clearance.
2. Register the domain in the owner's registrar account. Do not share registrar passwords, payment details, or authorization codes in source control or chat.
3. Create a dedicated Pages repository or hosting project and publish the contents of `accesscourt/` at its root.
4. Verify the domain in the GitHub account before changing DNS to reduce takeover risk.
5. Configure the custom domain in that repository's Pages settings, then configure the registrar's apex and `www` DNS records using GitHub's current instructions.
6. Enable HTTPS and verify both apex and `www` behavior.
7. Update every AccessCourt canonical, Open Graph, Twitter image URL, sitemap entry, and any form return URL to the standalone domain.
8. Change every Atrak AccessCourt link from `/accesscourt/` to `https://accesscourt.org/`.
9. Test desktop/mobile navigation, Visual Drill Coach, privacy links, form receipt, HTTPS, and redirects.
10. Only after production verification, redirect the old Atrak AccessCourt paths to the equivalent standalone URLs.

Official GitHub guidance:

- https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site
- https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/verifying-your-custom-domain-for-github-pages

GitHub Pages permits one custom domain per Pages site. A separate deployment avoids replacing Atrak's existing `atrak.dev` domain and prevents duplicate canonical content.
