# QA Report

Date: 2026-07-24

## Automated Checks

`npm run check` passes.

Coverage:
- HE/RU generated pages and project detail routes.
- Hebrew `dir="rtl"` and Russian `dir="ltr"`.
- Canonical, hreflang, sitemap, robots, thank-you noindex.
- Package price ranges and disclaimers.
- FAQ count and required questions.
- Estimate form field coverage.
- Analytics event hook coverage, including `project_view`.
- Local MVP server API, protected uploads, admin CSV export, webhook hook, and CMS override file.

## Browser Smoke Tests

Checked with Playwright:
- `/he/estimate/` at 360px: `scrollWidth` equals viewport width; no RTL overflow.
- Closed mobile nav: `inert=true`, `visibility=hidden`, nav links have `tabindex="-1"`.
- Required district/area selects default to empty values and block step progression.
- `netanya-other` requires `district_other` with localized inline error.
- Invalid phone `1` is blocked with localized inline error.
- `/he/projects/?size=8-15&utm_source=ad` language switch preserves query params.
- `?package=signature` is preserved after draft restore.
- Server-backed lead submission writes `data/leads.jsonl`, notification JSONL, and CSV export.
- UTM from original landing page is preserved into the lead.

## Agent Audits

Two agents audited the implementation:
- PRD coverage audit: confirmed broad route/content coverage and identified production dependencies.
- RTL/mobile/form audit: found overflow, hidden-nav focus, default selects, attribution, arrow direction, and semantics issues; these were fixed locally.

## Remaining PRD Dependencies

These cannot be honestly completed without owner-provided production inputs:
- Real phone and WhatsApp number.
- Real client/demo case photos and publication permission.
- Final legal copy for Israel.
- Actual GA4/GTM/Search Console/Bing configuration.
- Final CRM and protected cloud storage credentials if local MVP storage is not the deployment target.
