# ATELIER VERT

Local MVP website for ATELIER VERT / האטלייה הירוק, built from `PRD_ATELIER_VERT_website_v1.1.md`.

## Run

```bash
npm install
npm run serve
```

Site: `http://127.0.0.1:5173/`

Admin: `http://127.0.0.1:5173/admin/`

Local fallback admin token: `dev-admin-token`. Set `ATELIER_ADMIN_TOKEN` and `ATELIER_EDITOR_TOKEN` before any real deployment.

## Checks

```bash
npm run check
```

The check rebuilds the site and verifies bilingual routes, RTL/LTR direction, SEO basics, package prices, FAQ coverage, form fields, analytics event hooks, backend lead API, protected upload/admin routes, and assets.

## Server Features

- `POST /api/leads`: multipart lead submission with server-side validation.
- Photo validation: JPG/PNG/HEIC/HEIF, up to 5 files, 8 MB per file.
- Lead storage: `data/leads.jsonl` plus per-lead JSON.
- Protected uploaded files: `data/uploads/<lead-id>/`, accessible through admin token route.
- `GET /api/admin/leads.csv?token=...`: CSV export.
- `GET/POST /api/admin/content?token=...`: file-based CMS overrides saved to `data/cms-overrides.json` and rebuilt into `dist`.
- `ATELIER_LEAD_WEBHOOK_URL`: optional owner notification webhook.

## Production Inputs Still Required

- Real WhatsApp/phone/social links.
- At least two approved real demo cases with real photos and alt text.
- Legal-reviewed privacy, accessibility, terms/cookies/consent copy for Israel.
- GA4/GTM IDs, consent setup, Search Console and Bing verification.
- Final CRM/storage decision if replacing local JSON/files with HubSpot, Airtable, S3, or another provider.
