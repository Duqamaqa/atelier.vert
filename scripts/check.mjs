import fs from "node:fs";
import path from "node:path";
import { faqItems, packages, pageSlugs, projects } from "../src/content.mjs";

const root = process.cwd();
const dist = path.join(root, "dist");
const failures = [];

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function exists(file) {
  return fs.existsSync(path.join(root, file));
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function assertIncludes(file, needle, message) {
  const haystack = read(file);
  assert(haystack.includes(needle), `${message}: ${file}`);
}

function checkRoutes() {
  assert(exists("dist/index.html"), "Root redirect is missing");
  for (const lang of ["he", "ru"]) {
    assert(exists(`dist/${lang}/index.html`), `${lang} home page is missing`);
    for (const slug of pageSlugs) {
      assert(exists(`dist/${lang}/${slug}/index.html`), `${lang}/${slug} page is missing`);
    }
    for (const project of projects) {
      assert(exists(`dist/${lang}/projects/${project.slug}/index.html`), `${lang} project ${project.slug} page is missing`);
    }
  }
}

function checkLanguageDirection() {
  assertIncludes("dist/he/index.html", '<html lang="he" dir="rtl">', "Hebrew direction is not RTL");
  assertIncludes("dist/ru/index.html", '<html lang="ru" dir="ltr">', "Russian direction is not LTR");
}

function checkSeo() {
  for (const lang of ["he", "ru"]) {
    const home = read(`dist/${lang}/index.html`);
    assert(home.includes('<meta name="description"'), `${lang} home description missing`);
    assert(home.includes('rel="canonical"'), `${lang} home canonical missing`);
    assert(home.includes('hreflang="he-IL"'), `${lang} Hebrew hreflang missing`);
    assert(home.includes('hreflang="ru-IL"'), `${lang} Russian hreflang missing`);
    assert(home.includes("application/ld+json"), `${lang} JSON-LD missing`);
    const thanks = read(`dist/${lang}/thank-you/index.html`);
    assert(thanks.includes('content="noindex,follow"'), `${lang} thank-you must be noindex`);
  }
  const sitemap = read("dist/sitemap.xml");
  assert(!sitemap.includes("thank-you"), "Sitemap must not include thank-you");
  assertIncludes("dist/robots.txt", "Disallow: /he/thank-you/", "robots must disallow HE thank-you");
  assertIncludes("dist/robots.txt", "Disallow: /ru/thank-you/", "robots must disallow RU thank-you");
}

function checkAnalytics() {
  const measurementId = "G-303HM0FE6C";
  const htmlFiles = listFiles(dist).filter((file) => file.endsWith(".html"));
  for (const filePath of htmlFiles) {
    const html = fs.readFileSync(filePath, "utf8");
    const relative = path.relative(root, filePath);
    const tagMatches = html.match(new RegExp(`googletagmanager\\.com/gtag/js\\?id=${measurementId}`, "g")) || [];
    assert(tagMatches.length === 1, `Google tag must appear exactly once in ${relative}`);
    assert(html.includes(`gtag("config", "${measurementId}")`), `Google Analytics config missing in ${relative}`);
  }
  const app = read("dist/app.js");
  assert(app.includes('window.gtag("event", event, safe)'), "Custom events are not sent to gtag");
}

function listFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(filePath) : [filePath];
  });
}

function checkContent() {
  for (const lang of ["he", "ru"]) {
    const packagesHtml = read(`dist/${lang}/packages/index.html`);
    for (const pkg of packages) {
      assert(packagesHtml.includes(pkg.price), `${lang} package price missing for ${pkg.id}`);
      assert(packagesHtml.includes(pkg.name[lang]), `${lang} package name missing for ${pkg.id}`);
    }
    const faqHtml = read(`dist/${lang}/faq/index.html`);
    assert((faqHtml.match(/<details/g) || []).length >= 10, `${lang} FAQ needs at least 10 questions`);
    for (const faq of faqItems) {
      assert(faqHtml.includes(faq[lang][0]), `${lang} FAQ missing ${faq.id}`);
    }
  }
}

function checkGlobalWhatsAppCta() {
  const labels = {
    he: "שלחו לנו תמונה של המרפסת ב-WhatsApp וקבלו ייעוץ ראשוני",
    ru: "Отправьте фото вашего балкона в WhatsApp и получите первичную консультацию"
  };
  for (const lang of ["he", "ru"]) {
    const publicPages = [`dist/${lang}/index.html`, ...pageSlugs.map((slug) => `dist/${lang}/${slug}/index.html`)];
    for (const project of projects) publicPages.push(`dist/${lang}/projects/${project.slug}/index.html`);
    for (const file of publicPages) {
      const html = read(file);
      assert(html.includes('data-page="global-whatsapp-cta"'), `Global WhatsApp CTA missing: ${file}`);
      assert(html.includes(labels[lang]), `Global WhatsApp CTA label missing: ${file}`);
      assert(html.includes("+972 50 000 0000"), `Phone number missing beside global WhatsApp CTA: ${file}`);
    }
  }
}

function checkFormAndEvents() {
  const estimate = read("dist/ru/estimate/index.html");
  [
    "communication_language",
    "name",
    "phone",
    "district",
    "area",
    "floor",
    "sun",
    "goals",
    "budget",
    "package",
    "photos",
    "comment",
    "consent"
  ].forEach((name) => assert(estimate.includes(`name="${name}"`), `Estimate form missing ${name}`));
  assert(estimate.includes("data-estimate-message-preview"), "Estimate form WhatsApp message preview missing");
  assert(estimate.includes("Открыть WhatsApp с сообщением"), "Estimate form WhatsApp final button missing");
  const app = read("dist/app.js");
  [
    "view_package",
    "package_select",
    "estimate_start",
    "estimate_step",
    "photo_upload_success",
    "photo_upload_error",
    "form_submit",
    "form_error",
    "estimate_whatsapp_open",
    "whatsapp_click",
    "phone_click",
    "project_view",
    "before_after_interaction",
    "faq_open",
    "language_switch"
  ].forEach((event) => assert(app.includes(event), `Analytics event ${event} missing`));
  assert(app.includes("buildEstimateWhatsAppMessage"), "Estimate WhatsApp message builder missing");
  assert(app.includes("photosSelected"), "Estimate WhatsApp photo handoff text missing");
  assert(app.includes("8 * 1024 * 1024"), "Photo size limit check missing");
  assert(app.includes("image/heic"), "HEIC support check missing");
  assert(app.includes("atelier_estimate_draft"), "Draft persistence missing");
  assert(app.includes("delete safe.phone"), "Analytics PII stripping missing");
}

function checkServerAndAdmin() {
  assert(exists("scripts/server.mjs"), "Local MVP server missing");
  const server = read("scripts/server.mjs");
  [
    "/api/leads",
    "multipart/form-data",
    "leads.jsonl",
    "uploads",
    "/api/admin/leads.csv",
    "/api/admin/uploads/",
    "ATELIER_LEAD_WEBHOOK_URL",
    "ATELIER_ADMIN_TOKEN",
    "ATELIER_EDITOR_TOKEN",
    "cms-overrides.json"
  ].forEach((needle) => assert(server.includes(needle), `Server feature missing ${needle}`));
  assert(exists("dist/admin/index.html"), "Admin CMS page missing from dist");
  const admin = read("dist/admin/index.html");
  assert(admin.includes("Content CMS"), "Admin content editor missing");
  assert(admin.includes("Download leads CSV"), "Admin CSV export missing");
}

function checkAssets() {
  [
    "dist/assets/logo.svg",
    "dist/assets/photos/hero-before.jpg",
    "dist/assets/photos/hero-after-same-balcony.png",
    "dist/assets/photos/project-agamin-before.jpg",
    "dist/assets/photos/project-agamin-after-same-balcony.png"
  ].forEach((file) => assert(exists(file), `Asset missing: ${file}`));
}

checkRoutes();
checkLanguageDirection();
checkSeo();
checkAnalytics();
checkContent();
checkGlobalWhatsAppCta();
checkFormAndEvents();
checkServerAndAdmin();
checkAssets();

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed:`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("All atelier vert checks passed.");
