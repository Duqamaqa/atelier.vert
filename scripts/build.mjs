import fs from "node:fs";
import path from "node:path";
import {
  brand,
  faqItems,
  filterLabels,
  languages,
  packages,
  pageSlugs,
  processSteps,
  projects,
  serviceAreas,
  services,
  testimonialsPolicy
} from "../src/content.mjs";

const root = process.cwd();
const dist = path.join(root, "dist");
const basePath = normalizeBasePath(process.env.ATELIER_BASE_PATH || "");
const publicSiteUrl = normalizeSiteUrl(process.env.ATELIER_SITE_URL || brand.siteUrl);

applyCmsOverrides();

const routes = {
  home: "",
  services: "services",
  packages: "packages",
  projects: "projects",
  process: "process",
  maintenance: "maintenance",
  about: "about",
  faq: "faq",
  estimate: "estimate",
  contact: "contact",
  thankYou: "thank-you",
  privacy: "privacy",
  accessibility: "accessibility"
};

const noindex = new Set(["thankYou"]);

function esc(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function normalizeBasePath(value = "") {
  const trimmed = String(value).trim();
  if (!trimmed || trimmed === "/") return "";
  return `/${trimmed.replace(/^\/+|\/+$/g, "")}`;
}

function normalizeSiteUrl(value = "") {
  return String(value).trim().replace(/\/+$/g, "");
}

function copyDir(source, target) {
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const src = path.join(source, entry.name);
    const dest = path.join(target, entry.name);
    if (entry.isDirectory()) copyDir(src, dest);
    else fs.copyFileSync(src, dest);
  }
}

function deepMerge(base, override) {
  if (Array.isArray(base) || Array.isArray(override)) return override ?? base;
  if (!base || typeof base !== "object" || !override || typeof override !== "object") return override ?? base;
  const merged = { ...base };
  for (const [key, value] of Object.entries(override)) {
    merged[key] = deepMerge(base[key], value);
  }
  return merged;
}

function applyArrayOverride(target, override) {
  if (!Array.isArray(override)) return;
  target.splice(0, target.length, ...override);
}

function applyCmsOverrides() {
  const file = path.join(root, "data", "cms-overrides.json");
  if (!fs.existsSync(file)) return;
  const cms = JSON.parse(fs.readFileSync(file, "utf8"));
  if (cms.brand) Object.assign(brand, deepMerge(brand, cms.brand));
  applyArrayOverride(packages, cms.packages);
  applyArrayOverride(projects, cms.projects);
  applyArrayOverride(faqItems, cms.faqItems);
  applyArrayOverride(serviceAreas, cms.serviceAreas);
  if (cms.testimonialsPolicy) Object.assign(testimonialsPolicy, deepMerge(testimonialsPolicy, cms.testimonialsPolicy));
}

function routePath(lang, page = "home", slug = "") {
  if (page === "home") return `/${lang}/`;
  if (page === "project") return `/${lang}/projects/${slug}/`;
  return `/${lang}/${routes[page]}/`;
}

function pageHref(lang, page = "home", slug = "") {
  return `${basePath}${routePath(lang, page, slug)}`;
}

function canonical(lang, page, slug = "") {
  return `${publicSiteUrl}${routePath(lang, page, slug)}`;
}

function localizedPath(currentLang, page, slug = "") {
  const other = currentLang === "he" ? "ru" : "he";
  return pageHref(other, page, slug);
}

function publicPath(value) {
  if (!value) return "";
  if (/^(?:[a-z][a-z0-9+.-]*:|#)/i.test(value)) return value;
  return `${basePath}${value.startsWith("/") ? value : `/${value}`}`;
}

function whatsappHref(lang) {
  return `https://wa.me/${brand.whatsappNumber}?text=${encodeURIComponent(languages[lang].whatsappText)}`;
}

function metaTitle(lang, page, slug = "") {
  if (page === "project") {
    const project = projects.find((item) => item.slug === slug);
    return `${project.title[lang]} | ${brand.latin}`;
  }
  const key = page === "thankYou" ? "thankYou" : page;
  return `${languages[lang].titles[key]} | ${brand.latin}`;
}

function metaDescription(lang, page, slug = "") {
  if (page === "project") {
    const project = projects.find((item) => item.slug === slug);
    return project.subtitle[lang];
  }
  const key = page === "thankYou" ? "thankYou" : page;
  return languages[lang].descriptions[key];
}

function icon(name) {
  const stroke = "currentColor";
  const attrs = `viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"`;
  const paths = {
    layout: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 4v16M3 10h18"/>',
    leaf: '<path d="M5 19c10 0 14-7 14-14-7 0-14 4-14 14Z"/><path d="M5 19c3-4 6-7 11-10"/>',
    pot: '<path d="M6 9h12l-1.5 10h-9L6 9Z"/><path d="M8 9V6h8v3"/><path d="M9 6c0-2 2-3 3-3s3 1 3 3"/>',
    water: '<path d="M12 3s6 6.2 6 11a6 6 0 0 1-12 0c0-4.8 6-11 6-11Z"/><path d="M9 15c.5 1.6 1.6 2.4 3.2 2.4"/>',
    tool: '<path d="M14.7 6.3a4 4 0 0 0-5 5L4 17v3h3l5.7-5.7a4 4 0 0 0 5-5l-2.4 2.4-3-3 2.4-2.4Z"/>',
    care: '<path d="M12 21V9"/><path d="M7 12c-2.7 0-4-1.6-4-4 2.8 0 4.5 1.2 5.2 3.2"/><path d="M17 12c2.7 0 4-1.6 4-4-2.8 0-4.5 1.2-5.2 3.2"/><path d="M6 21h12"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.8a2 2 0 0 1-.4 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/>',
    message: '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3 1.6-4.6A8 8 0 1 1 21 15Z"/>'
  };
  return `<svg class="icon icon-${name}" ${attrs}>${paths[name] ?? paths.leaf}</svg>`;
}

function cta(lang, href, label, extra = "") {
  return `<a class="button ${extra}" href="${href}"><span>${esc(label)}</span>${icon("arrow")}</a>`;
}

function header(lang, page, slug = "") {
  const t = languages[lang];
  const navItems = [
    ["services", t.nav.services],
    ["projects", t.nav.projects],
    ["packages", t.nav.packages],
    ["process", t.nav.process],
    ["faq", t.nav.faq]
  ];
  return `
    <header class="site-header" data-header>
      <a class="brand-mark" href="${pageHref(lang)}" aria-label="${brand.latin}">
        <img src="${publicPath("/assets/logo.svg")}" alt="" width="42" height="42">
        <span><b>${brand.latin}</b><small>${lang === "he" ? brand.he : "האטלייה הירוק"}</small></span>
      </a>
      <button class="icon-button menu-toggle" type="button" data-menu-toggle aria-expanded="false" aria-controls="main-nav" title="Menu">${icon("menu")}</button>
      <nav class="main-nav" id="main-nav" data-nav>
        ${navItems.map(([key, label]) => `<a href="${pageHref(lang, key)}">${esc(label)}</a>`).join("")}
        <a class="language-switch" href="${localizedPath(lang, page, slug)}" data-localized-base="${localizedPath(lang, page, slug)}" data-track="language_switch" data-from="${lang}" data-to="${lang === "he" ? "ru" : "he"}">${t.switchLabel}</a>
        <a class="button button-small" href="${pageHref(lang, "estimate")}">${esc(t.nav.cta)}</a>
      </nav>
    </header>
  `;
}

function footer(lang) {
  const t = languages[lang];
  return `
    <footer class="site-footer">
      <div class="footer-grid">
        <div>
          <a class="brand-mark footer-brand" href="${pageHref(lang)}">
            <img src="${publicPath("/assets/logo.svg")}" alt="" width="42" height="42">
            <span><b>${brand.latin}</b><small>${lang === "he" ? brand.he : "Студия зелёных балконов"}</small></span>
          </a>
          <p>${lang === "he" ? "סטודיו מקומי לעיצוב והקמת מרפסות ירוקות בנתניה, עם פתרונות לשמש, רוח, השקיה ותחזוקה." : "Локальная студия дизайна и создания зелёных балконов в Нетании с решениями для солнца, ветра, полива и ухода."}</p>
        </div>
        <div>
          <h2>${lang === "he" ? "אזורי שירות" : "Районы"}</h2>
          <div class="chip-list">
            ${serviceAreas.map((area) => `<span class="chip">${esc(area[lang])} <small>${area.priority}</small></span>`).join("")}
          </div>
        </div>
        <div>
          <h2>${lang === "he" ? "קשר" : "Контакты"}</h2>
          <p><a href="${brand.phoneHref}" data-phone>${brand.phoneDisplay}</a><br><a href="mailto:${brand.email}">${brand.email}</a></p>
          <p>${esc(brand.responseWindow[lang])}</p>
        </div>
        <div>
          <h2>${lang === "he" ? "מסמכים" : "Документы"}</h2>
          <p><a href="${pageHref(lang, "privacy")}">${esc(t.titles.privacy)}</a><br><a href="${pageHref(lang, "accessibility")}">${esc(t.titles.accessibility)}</a><br><a href="${pageHref(lang, "contact")}">${esc(t.titles.contact)}</a></p>
        </div>
      </div>
    </footer>
    <div class="mobile-actions">
      <a href="${whatsappHref(lang)}" data-whatsapp data-page="mobile-bar" class="mobile-action">${icon("message")}<span>${t.common.whatsapp}</span></a>
      <a href="${pageHref(lang, "estimate")}" class="mobile-action primary">${icon("leaf")}<span>${t.nav.cta}</span></a>
    </div>
  `;
}

function layout(lang, page, body, slug = "") {
  const t = languages[lang];
  const title = metaTitle(lang, page, slug);
  const description = metaDescription(lang, page, slug);
  const robots = noindex.has(page) ? "noindex,follow" : "index,follow";
  const alternates = `
    <link rel="alternate" hreflang="he-IL" href="${canonical("he", page, slug)}">
    <link rel="alternate" hreflang="ru-IL" href="${canonical("ru", page, slug)}">
    <link rel="alternate" hreflang="x-default" href="${canonical("he", page, slug)}">
  `;
  return `<!doctype html>
<html lang="${lang}" dir="${t.dir}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <meta name="robots" content="${robots}">
  <link rel="canonical" href="${canonical(lang, page, slug)}">
  ${alternates}
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:type" content="website">
  <meta property="og:image" content="${publicSiteUrl}/assets/og-image.svg">
  <link rel="icon" href="${publicPath("/assets/favicon.svg")}" type="image/svg+xml">
  <link rel="stylesheet" href="${publicPath("/styles.css")}">
  <script>
    window.ATELIER = ${JSON.stringify({
      lang,
      dir: t.dir,
      whatsappNumber: brand.whatsappNumber,
      whatsappText: t.whatsappText,
      phoneHref: brand.phoneHref,
      basePath,
      estimatePath: pageHref(lang, "estimate"),
      thankYouPath: pageHref(lang, "thankYou"),
      labels: t.common
    })};
    window.dataLayer = window.dataLayer || [];
  </script>
  ${jsonLd(lang, page, slug)}
</head>
<body class="page-${page}">
  <a class="skip-link" href="#main">${lang === "he" ? "דלגו לתוכן" : "К содержанию"}</a>
  ${header(lang, page, slug)}
  <main id="main">${body}</main>
  ${footer(lang)}
  <script src="${publicPath("/app.js")}" defer></script>
</body>
</html>`;
}

function jsonLd(lang, page, slug = "") {
  const t = languages[lang];
  const base = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: `${brand.latin} / ${brand.he}`,
    description: languages[lang].descriptions.home,
    areaServed: "Netanya, Israel",
    telephone: brand.phoneDisplay,
    url: canonical(lang, "home"),
    availableLanguage: ["Hebrew", "Russian"],
    serviceType: lang === "he" ? "עיצוב והקמת מרפסות ירוקות" : "Озеленение балконов под ключ"
  };
  const crumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: t.titles.home, item: canonical(lang, "home") }
    ]
  };
  if (page !== "home") {
    crumbs.itemListElement.push({
      "@type": "ListItem",
      position: 2,
      name: page === "project" ? projects.find((p) => p.slug === slug).title[lang] : t.titles[page],
      item: canonical(lang, page, slug)
    });
  }
  const faq = page === "faq" ? {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item[lang][0],
      acceptedAnswer: { "@type": "Answer", text: item[lang][1] }
    }))
  } : null;
  return [base, crumbs, faq]
    .filter(Boolean)
    .map((data) => `<script type="application/ld+json">${JSON.stringify(data)}</script>`)
    .join("\n");
}

function hero(lang) {
  const t = languages[lang];
  return `
    <section class="hero section">
      <div class="hero-copy">
        <p class="eyebrow">${lang === "he" ? "נתניה · עיר ימים · אגמים · קו החוף" : "Нетания · Ир-Ямим · Агамим · побережье"}</p>
        <h1>${lang === "he" ? "מרפסת ירוקה מוכנה לשמש ולרוח של נתניה" : "Зелёный балкон под ключ для солнца и ветра Нетании"}</h1>
        <p class="lead">${lang === "he" ? "עיצוב, צמחים, כדים, השקיה אוטומטית, התקנה ותחזוקה במקום אחד. מתחילים מתמונות ומחזירים טווח ברור בלי להבטיח יותר ממה שאפשר לבדוק." : "Дизайн, растения, кашпо, автополив, монтаж и обслуживание в одном процессе. Начинаем с фотографий и даём понятный диапазон без обещаний, которые нельзя проверить."}</p>
        <div class="hero-actions">
          ${cta(lang, pageHref(lang, "estimate"), t.common.estimate, "button-primary")}
          <a class="button button-ghost" href="${whatsappHref(lang)}" data-whatsapp data-page="home-hero">${icon("message")}<span>${t.common.whatsapp}</span></a>
        </div>
        <p class="price-note">${lang === "he" ? "חבילת Start מ-6 900 ₪ · התקנה טיפוסית 1–3 ימים אחרי מוכנות חומרים" : "Start от 6 900 ₪ · типовой монтаж 1–3 дня после готовности материалов"}</p>
      </div>
      <div class="hero-media before-after" data-before-after>
        <img class="before-img" src="${publicPath("/assets/photos/hero-before.jpg")}" alt="${lang === "he" ? "מרפסת ריקה מול הים לפני תכנון ירוק" : "Пустой балкон с видом на море до зелёного проекта"}">
        <img class="after-img" src="${publicPath("/assets/photos/hero-after-same-balcony.png")}" alt="${lang === "he" ? "אותה מרפסת מול הים לאחר הוספת כדים וצמחייה" : "Тот же балкон с видом на море после добавления кашпо и растений"}">
        <input type="range" min="0" max="100" value="50" aria-label="${lang === "he" ? "השוואת לפני ואחרי" : "Сравнение до и после"}">
        <span class="media-badge before">${lang === "he" ? "לפני" : "до"}</span>
        <span class="media-badge after">${lang === "he" ? "אחרי" : "после"}</span>
      </div>
    </section>
  `;
}

function trustStrip(lang) {
  const facts = lang === "he"
    ? [["פתרון תחת קורת גג אחת", "עיצוב, צמחים, כדים, השקיה והתקנה"], ["מותאם לנתניה", "שמש, רוח ים, גובה וניקוז"], ["תקציב גלוי", "שלוש חבילות עם טווחי מחיר"], ["HE / RU", "שתי גרסאות מלאות של האתר"]]
    : [["Под ключ", "Дизайн, растения, кашпо, полив и монтаж"], ["Для Нетании", "Солнце, морской ветер, высота и дренаж"], ["Бюджет виден", "Три пакета с диапазонами цены"], ["HE / RU", "Две полноценные версии сайта"]];
  return `<section class="trust-strip" aria-label="${lang === "he" ? "עובדות אמון" : "Факты доверия"}">${facts.map(([a, b]) => `<div><strong>${esc(a)}</strong><span>${esc(b)}</span></div>`).join("")}</section>`;
}

function problemSolution(lang) {
  const items = lang === "he"
    ? [["מרפסת ריקה", "הופכת לאזור שאפשר להשתמש בו כל יום."], ["צמחים שנשרפים", "נבחרים לפי שמש, רוח ויכולת טיפול."], ["בלגן של עציצים", "מוחלף בתכנון שכבות, כדים ומעברים."], ["חשש מתחזוקה", "נענה בהשקיה, הדרכה ואפשרות שירות."]]
    : [["Пустой балкон", "Становится зоной, которой можно пользоваться каждый день."], ["Растения погибают", "Подбор идёт по солнцу, ветру и готовности ухаживать."], ["Случайные горшки", "Заменяются планом слоёв, кашпо и проходов."], ["Страх ухода", "Снимается поливом, инструкцией и сервисом."]];
  return `
    <section class="section split-section">
      <div>
        <p class="eyebrow">${lang === "he" ? "בעיה → פתרון" : "Проблема → решение"}</p>
        <h2>${lang === "he" ? "לא כל מרפסת צריכה אותו פתרון" : "Не каждому балкону подходит одно и то же решение"}</h2>
        <p>${lang === "he" ? "לפני בחירת צמחים בודקים שימוש, תנאים ותקציב. האתר מכוון לפנייה עם מספיק מידע כדי להכין את השלב הבא." : "Перед подбором растений проверяются сценарий использования, условия и бюджет. Сайт ведёт к заявке с достаточной информацией для следующего шага."}</p>
      </div>
      <div class="solution-grid">
        ${items.map(([title, text]) => `<article class="mini-card"><h3>${esc(title)}</h3><p>${esc(text)}</p></article>`).join("")}
      </div>
    </section>
  `;
}

function packageCards(lang, compact = false) {
  const t = languages[lang];
  return `
    <div class="package-grid ${compact ? "compact" : ""}">
      ${packages.map((pkg) => `
        <article class="package-card" data-package-card="${pkg.id}">
          <div class="package-head">
            <h3>${esc(pkg.name[lang])}</h3>
            <strong>${esc(pkg.price)}</strong>
          </div>
          <p class="muted">${esc(pkg.size[lang])}</p>
          <p>${esc(pkg.accent[lang])}</p>
          <ul>${pkg.includes[lang].map((item) => `<li>${esc(item)}</li>`).join("")}</ul>
          <p class="small-note">${esc(pkg.exclusions[lang])}</p>
          <a class="button button-full" data-package-select="${pkg.id}" href="${pageHref(lang, "estimate")}?package=${pkg.id}">${esc(pkg.cta[lang])}</a>
        </article>
      `).join("")}
    </div>
    <p class="disclaimer">${esc(t.common.noOffer)} ${lang === "he" ? "הסכום הסופי תלוי בשטח, גישה, כדים, גודל הצמחים, מערכת השקיה ואלמנטים נוספים. הצעת מחיר מדויקת לאחר תמונות ובירור." : "Итог зависит от площади, доступа, выбранных кашпо, размера растений, системы полива и дополнительных элементов. Точная смета после фотографий и уточнения задачи."}</p>
  `;
}

function featuredProjects(lang) {
  const t = languages[lang];
  return `
    <div class="project-grid">
      ${projects.filter((p) => p.featured).map((project) => projectCard(lang, project)).join("")}
    </div>
    <div class="section-action">${cta(lang, pageHref(lang, "projects"), t.common.projectsCta, "button-secondary")}</div>
  `;
}

function projectCard(lang, project) {
  const district = serviceAreas.find((area) => area.key === project.districtKey)?.[lang] ?? project.districtKey;
  return `
    <article class="project-card" data-project-card data-size="${project.size}" data-exposure="${project.exposure}" data-package="${project.packageId}" data-district="${project.districtKey}" data-goal="${project.goal}">
      <a class="project-image" href="${pageHref(lang, "project", project.slug)}" aria-label="${esc(project.title[lang])}">
        <img src="${publicPath(project.afterImage)}" alt="${esc(project.alt[lang])}">
      </a>
      <div class="project-card-body">
        <p class="eyebrow">${esc(district)} · ${esc(project.budget)}</p>
        <h3><a class="project-title-link" href="${pageHref(lang, "project", project.slug)}">${esc(project.title[lang])}</a></h3>
        <p>${esc(project.challenge[lang])}</p>
        <div class="chip-list">
          <span class="chip">${project.size === "8-15" ? (lang === "he" ? "8–15 מ\"ר" : "8–15 м²") : (lang === "he" ? "15–30 מ\"ר" : "15–30 м²")}</span>
          <span class="chip">${esc(packages.find((pkg) => pkg.id === project.packageId).name[lang])}</span>
        </div>
      </div>
    </article>
  `;
}

function processSection(lang) {
  return `
    <div class="process-steps">
      ${processSteps.map((step, index) => `<article class="step-card"><span>${index + 1}</span><h3>${esc(step[lang][0])}</h3><p>${esc(step[lang][1])}</p></article>`).join("")}
    </div>
  `;
}

function netanyaSection(lang) {
  const points = lang === "he"
    ? [["שמש", "בודקים שעות שמש וכיוון לפני בחירת צמחים."], ["רוח ים", "בקומות גבוהות נדרשות התאמות יציבות ומשקל."], ["ניקוז", "מים, מצע וניקוז נבדקים כדי למנוע בעיות במרפסת."], ["אורח חיים", "הפתרון מותאם למשפחה, אירוח, פרטיות או תחזוקה נמוכה."]]
    : [["Солнце", "Проверяем часы солнца и ориентацию перед подбором растений."], ["Морской ветер", "На высоких этажах нужны поправки по устойчивости и весу."], ["Дренаж", "Вода, субстрат и дренаж проверяются, чтобы не создавать проблем."], ["Образ жизни", "Решение подстраивается под семью, отдых, приватность или низкий уход."]];
  return `
    <section class="section textured">
      <div class="section-heading">
        <p class="eyebrow">${lang === "he" ? "נתניה" : "Нетания"}</p>
        <h2>${lang === "he" ? "המרפסת נבדקת לפי תנאים מקומיים" : "Балкон проверяется по местным условиям"}</h2>
      </div>
      <div class="feature-grid">${points.map(([title, text]) => `<article class="feature-card"><h3>${esc(title)}</h3><p>${esc(text)}</p></article>`).join("")}</div>
    </section>
  `;
}

function homePage(lang) {
  const t = languages[lang];
  return `
    ${hero(lang)}
    ${trustStrip(lang)}
    ${problemSolution(lang)}
    <section class="section">
      <div class="section-heading">
        <p class="eyebrow">${lang === "he" ? "חבילות" : "Пакеты"}</p>
        <h2>${lang === "he" ? "תקציב ברור לפני שמשאירים פרטים" : "Понятный бюджет до отправки контактов"}</h2>
        <p>${lang === "he" ? "שלוש רמות שירות, בלי חישוב אוטומטי שמתחזה להצעת מחיר." : "Три уровня услуги без автоматического расчёта, который выглядит как оферта."}</p>
      </div>
      ${packageCards(lang, true)}
    </section>
    <section class="section">
      <div class="section-heading">
        <p class="eyebrow">${lang === "he" ? "קייסים" : "Кейсы"}</p>
        <h2>${lang === "he" ? "דוגמאות ראשונות למבנה הקייסים" : "Первые примеры структуры кейсов"}</h2>
        <p>${esc(t.common.photoPolicy)}</p>
      </div>
      ${featuredProjects(lang)}
    </section>
    <section class="section">
      <div class="section-heading">
        <p class="eyebrow">${lang === "he" ? "תהליך" : "Процесс"}</p>
        <h2>${lang === "he" ? "5 שלבים מתמונה ועד טיפול" : "5 шагов от фото до обслуживания"}</h2>
      </div>
      ${processSection(lang)}
    </section>
    ${netanyaSection(lang)}
    <section class="section split-section">
      <div>
        <p class="eyebrow">${lang === "he" ? "תחזוקה" : "Обслуживание"}</p>
        <h2>${lang === "he" ? "אחרי ההתקנה לא נשארים לבד" : "После монтажа клиент не остаётся один"}</h2>
        <p>${lang === "he" ? "אפשר לתאם ביקורי שירות, התאמות השקיה ועדכונים עונתיים. זה שירות תמיכה, לא הבטחת הישרדות לכל צמח בכל תנאי." : "Можно согласовать сервисные визиты, настройку полива и сезонные обновления. Это поддержка, а не обещание выживания каждого растения при любых условиях."}</p>
        ${cta(lang, pageHref(lang, "maintenance"), lang === "he" ? "לבקש תחזוקה" : "Запросить обслуживание", "button-secondary")}
      </div>
      <article class="quote-card">
        <h3>${esc(testimonialsPolicy[lang].title)}</h3>
        <p>${esc(testimonialsPolicy[lang].text)}</p>
      </article>
    </section>
    <section class="section final-cta">
      <h2>${lang === "he" ? "מתחילים מתמונות, לא מניחושים" : "Начинаем с фотографий, а не с догадок"}</h2>
      <p>${lang === "he" ? "שלחו פרטים בסיסיים, ואם התמונות עדיין לא מוכנות אפשר לפתוח WhatsApp עם הודעה מוכנה." : "Отправьте базовые параметры, а если фото пока не готовы, можно открыть WhatsApp с готовым текстом."}</p>
      <div class="hero-actions">
        ${cta(lang, pageHref(lang, "estimate"), t.common.photoCta, "button-primary")}
        <a class="button button-ghost" href="${whatsappHref(lang)}" data-whatsapp data-page="home-final">${icon("message")}<span>${t.common.whatsapp}</span></a>
      </div>
    </section>
  `;
}

function servicesPage(lang) {
  return `
    ${pageIntro(lang, "services", lang === "he" ? "שירות תחת קורת גג אחת" : "Одна команда отвечает за весь балкон")}
    <section class="section">
      <div class="service-grid">${services.map((item) => `<article class="service-card">${icon(item.icon)}<h2>${esc(item[lang][0])}</h2><p>${esc(item[lang][1])}</p></article>`).join("")}</div>
    </section>
    <section class="section split-section">
      <div>
        <h2>${lang === "he" ? "מה נבדק לפני התחייבות" : "Что проверяется до обещаний"}</h2>
        <ul class="check-list">
          ${(lang === "he" ? ["שטח ותנועה במרפסת", "שמש, רוח וקומה", "גישה לנקודת מים וניקוז", "משקל כדים, מצע וצמחים", "רמת תחזוקה שהלקוח באמת רוצה"] : ["Площадь и проходы на балконе", "Солнце, ветер и этаж", "Доступ к воде и дренаж", "Вес кашпо, грунта и растений", "Реальный уровень ухода, который нужен клиенту"]).map((item) => `<li>${esc(item)}</li>`).join("")}
        </ul>
      </div>
      <div class="note-card">
        <h2>${lang === "he" ? "מה לא מוכרים באתר" : "Что сайт не продаёт"}</h2>
        <p>${lang === "he" ? "אין חנות צמחים, אין תשלום מלא אונליין, אין חישוב מדויק ללא מומחה ואין התחייבות שכל מרפסת מתאימה לפני בדיקה." : "Нет интернет-магазина растений, полной онлайн-оплаты, точного расчёта без специалиста и обещания, что любой балкон подходит без проверки."}</p>
      </div>
    </section>
  `;
}

function packagesPage(lang) {
  return `
    ${pageIntro(lang, "packages", lang === "he" ? "מחיר גלוי כטווח, לא הצעה סופית" : "Цена видна как диапазон, не как финальная смета")}
    <section class="section">${packageCards(lang)}</section>
    <section class="section">
      <div class="section-heading"><h2>${lang === "he" ? "למה מרפסת קטנה לא תמיד זולה" : "Почему маленький балкон не всегда дешёвый"}</h2></div>
      <div class="feature-grid">
        ${(lang === "he" ? [["הגעה והובלה", "גם פרויקט קטן דורש לוגיסטיקה, העלאה וסידור."], ["בקר והשקיה", "למערכת השקיה יש עלות בסיס גם למעט כדים."], ["כדים וצמחים", "בחירות עמידות ויציבות משפיעות יותר ממספר המטרים."], ["בדיקה ידנית", "גישה, רוח וניקוז יכולים לשנות את הפתרון."]] : [["Доставка и подъём", "Даже небольшой проект требует логистики, подъёма и расстановки."], ["Контроллер и полив", "У системы полива есть базовая стоимость даже для малого числа кашпо."], ["Кашпо и растения", "Устойчивые решения влияют на цену сильнее, чем метры."], ["Ручная проверка", "Доступ, ветер и дренаж могут менять решение."]]).map(([h, p]) => `<article class="feature-card"><h3>${esc(h)}</h3><p>${esc(p)}</p></article>`).join("")}
      </div>
    </section>
    <section class="section calculator-section">
      <div class="section-heading">
        <p class="eyebrow">${lang === "he" ? "מיני מחשבון" : "Мини-калькулятор"}</p>
        <h2>${lang === "he" ? "איזו חבילה כנראה מתאימה?" : "Какой пакет вероятнее подходит?"}</h2>
        <p>${lang === "he" ? "הכלי ממליץ על כיוון בלבד ולא מחשב הצעת מחיר." : "Инструмент рекомендует направление, но не считает финальную смету."}</p>
      </div>
      ${calculator(lang)}
    </section>
  `;
}

function calculator(lang) {
  return `
    <form class="calculator" data-calculator>
      <label>${lang === "he" ? "שטח" : "Площадь"}
        <select name="size">
          <option value="unknown">${lang === "he" ? "לא יודע/ת" : "Не знаю"}</option>
          <option value="8-15">8–15</option>
          <option value="15-30">15–30</option>
          <option value="30-plus">30+</option>
        </select>
      </label>
      <label>${lang === "he" ? "תקציב" : "Бюджет"}
        <select name="budget">
          <option value="unknown">${lang === "he" ? "לא יודע/ת" : "Не знаю"}</option>
          <option value="under-7">עד 7k</option>
          <option value="7-10">7–10k</option>
          <option value="10-20">10–20k</option>
          <option value="20-40">20–40k</option>
          <option value="40-plus">40k+</option>
        </select>
      </label>
      <label>${lang === "he" ? "מטרה מרכזית" : "Главная цель"}
        <select name="goal">
          <option value="green">${lang === "he" ? "ירוק מסודר" : "Аккуратная зелень"}</option>
          <option value="privacy">${lang === "he" ? "פרטיות ושכבות גובה" : "Приватность и высота"}</option>
          <option value="premium">${lang === "he" ? "פרויקט מיוחד / צמחים בוגרים" : "Особый проект / зрелые растения"}</option>
        </select>
      </label>
      <label class="check-row"><input type="checkbox" name="wind" value="yes"> <span>${lang === "he" ? "קומה גבוהה או רוח חזקה" : "Высокий этаж или сильный ветер"}</span></label>
      <div class="calculator-result" data-calculator-result aria-live="polite"></div>
    </form>
  `;
}

function projectsPage(lang) {
  const labels = filterLabels[lang];
  const filters = [
    ["size", [...new Set(projects.map((p) => p.size))]],
    ["exposure", [...new Set(projects.map((p) => p.exposure))]],
    ["package", [...new Set(projects.map((p) => p.packageId))]],
    ["district", [...new Set(projects.map((p) => p.districtKey))]],
    ["goal", [...new Set(projects.map((p) => p.goal))]]
  ];
  return `
    ${pageIntro(lang, "projects", lang === "he" ? "קייסים עם תנאים, מגבלות ותוצאה" : "Кейсы с условиями, ограничениями и результатом")}
    <section class="section">
      <form class="filter-bar" data-project-filters>
        ${filters.map(([key, values]) => `<label>${esc(labels[key])}<select name="${key}"><option value="">${esc(labels.all)}</option>${values.map((value) => `<option value="${value}">${esc(labels.values[value] ?? serviceAreas.find((area) => area.key === value)?.[lang] ?? value)}</option>`).join("")}</select></label>`).join("")}
      </form>
      <div class="project-grid" data-project-list>${projects.map((project) => projectCard(lang, project)).join("")}</div>
      <p class="empty-state" data-empty-state hidden>${lang === "he" ? "אין קייסים זמינים למסנן הזה." : "Нет кейсов для выбранного фильтра."}</p>
    </section>
  `;
}

function projectPage(lang, project) {
  const district = serviceAreas.find((area) => area.key === project.districtKey)?.[lang] ?? project.districtKey;
  return `
    <section class="section project-hero">
      <div>
        <p class="eyebrow">${esc(district)} · ${esc(packages.find((pkg) => pkg.id === project.packageId).name[lang])}</p>
        <h1>${esc(project.title[lang])}</h1>
        <p class="lead">${esc(project.subtitle[lang])}</p>
        <div class="project-meta">
          <span>${esc(project.duration[lang])}</span>
          <span>${esc(project.budget)}</span>
          <span>${project.size === "8-15" ? (lang === "he" ? "8–15 מ\"ר" : "8–15 м²") : (lang === "he" ? "15–30 מ\"ר" : "15–30 м²")}</span>
        </div>
      </div>
      <div class="before-after case-visual" data-before-after>
        <img class="before-img" src="${publicPath(project.beforeImage)}" alt="${esc(project.alt[lang])} - ${lang === "he" ? "לפני" : "до"}">
        <img class="after-img" src="${publicPath(project.afterImage)}" alt="${esc(project.alt[lang])} - ${lang === "he" ? "אחרי" : "после"}">
        <input type="range" min="0" max="100" value="52" aria-label="${lang === "he" ? "השוואת לפני ואחרי" : "Сравнение до и после"}">
        <span class="media-badge before">${lang === "he" ? "לפני" : "до"}</span>
        <span class="media-badge after">${lang === "he" ? "אחרי" : "после"}</span>
      </div>
    </section>
    <section class="section case-content">
      <article><h2>${lang === "he" ? "המצב לפני" : "Исходная ситуация"}</h2><p>${esc(project.challenge[lang])}</p></article>
      <article><h2>${lang === "he" ? "מגבלות" : "Ограничения"}</h2><ul>${project.constraints[lang].map((item) => `<li>${esc(item)}</li>`).join("")}</ul></article>
      <article><h2>${lang === "he" ? "הפתרון" : "Решение"}</h2><p>${esc(project.solution[lang])}</p></article>
      <article><h2>${lang === "he" ? "מה הותקן" : "Что установили"}</h2><ul>${project.scope[lang].map((item) => `<li>${esc(item)}</li>`).join("")}</ul></article>
      <article><h2>${lang === "he" ? "תחזוקה" : "Уход"}</h2><p>${esc(project.maintenance[lang])}</p></article>
      <article class="note-card"><h2>${lang === "he" ? "הערת פרסום" : "Примечание к публикации"}</h2><p>${lang === "he" ? "לפני השקה ציבורית יש להחליף המחשות בצילומי פרויקט אמיתיים ובאישור לקוח." : "Перед публичным запуском иллюстрации нужно заменить реальными фотографиями проекта и клиентским разрешением."}</p></article>
    </section>
    <section class="section final-cta">
      <h2>${lang === "he" ? "יש לכם מרפסת דומה?" : "У вас похожий балкон?"}</h2>
      <div class="hero-actions">
        ${cta(lang, pageHref(lang, "estimate"), languages[lang].common.photoCta, "button-primary")}
        <a class="button button-ghost" href="${whatsappHref(lang)}" data-whatsapp data-page="project" data-package="${project.packageId}">${icon("message")}<span>${languages[lang].common.whatsapp}</span></a>
      </div>
    </section>
  `;
}

function processPage(lang) {
  return `
    ${pageIntro(lang, "process", lang === "he" ? "ברור מה קורה אחרי שמשאירים פרטים" : "Понятно, что происходит после заявки")}
    <section class="section">${processSection(lang)}</section>
    <section class="section split-section">
      <div class="note-card"><h2>${lang === "he" ? "מה להכין לשיחה" : "Что подготовить к консультации"}</h2><ul>${(lang === "he" ? ["2–5 תמונות באור יום", "גודל משוער או מספר אריחים", "כיוון שמש ושעות שמש", "טווח תקציב נוח", "בעיות קיימות: ניקוז, רוח, גישה"] : ["2–5 фотографий при дневном свете", "Примерный размер или число плиток", "Ориентация и часы солнца", "Комфортный бюджет", "Проблемы: дренаж, ветер, доступ"]).map((item) => `<li>${esc(item)}</li>`).join("")}</ul></div>
      <div><h2>${lang === "he" ? "לא מאבדים מידע בדרך" : "Информация не теряется"}</h2><p>${lang === "he" ? "הטופס שומר טיוטה בדפדפן, מעביר חבילה נבחרת ומצרף UTM/עמוד נחיתה לליד." : "Форма сохраняет черновик в браузере, передаёт выбранный пакет и добавляет UTM/landing page к лиду."}</p></div>
    </section>
  `;
}

function maintenancePage(lang) {
  const rows = lang === "he"
    ? [["ביקור בדיקה", "כיוון השקיה, בדיקת קליטה, ניקוי קל והנחיות."], ["עדכון עונתי", "החלפת צמחים נקודתית, התאמה לחום או רוח."], ["תחזוקה שוטפת", "תיאום ביקורים לפי גודל המרפסת ורמת הטיפול הרצויה."]]
    : [["Проверочный визит", "Настройка полива, проверка адаптации, лёгкая уборка и инструкции."], ["Сезонное обновление", "Точечная замена растений, настройка под жару или ветер."], ["Регулярный уход", "Визиты по размеру балкона и желаемому уровню обслуживания."]];
  return `
    ${pageIntro(lang, "maintenance", lang === "he" ? "שירות אחרי התקנה בלי הבטחות לא אחראיות" : "Поддержка после монтажа без рискованных обещаний")}
    <section class="section feature-grid">${rows.map(([h, p]) => `<article class="feature-card"><h2>${esc(h)}</h2><p>${esc(p)}</p></article>`).join("")}</section>
    <section class="section note-card wide"><h2>${lang === "he" ? "אחריות וצמחים" : "Гарантия и растения"}</h2><p>${lang === "he" ? "אחריות על עבודות וצמחים תפורסם רק לאחר אישור מדיניות חוזית אמיתית. התחזוקה מוצגת כשירות שמקטין סיכון ומסביר טיפול, לא כ\"אפס טיפול\"." : "Гарантия на работы и растения публикуется только после утверждения реальной договорной политики. Обслуживание описывается как способ снизить риск и объяснить уход, а не как «нулевой уход»."}</p></section>
  `;
}

function aboutPage(lang) {
  return `
    ${pageIntro(lang, "about", lang === "he" ? "סטודיו למרפסות ירוקות, לא גנן כללי" : "Студия зелёных балконов, а не универсальный садовник")}
    <section class="section split-section">
      <div><h2>${lang === "he" ? "הגישה" : "Подход"}</h2><p>${lang === "he" ? "ATELIER VERT מתייחסת למרפסת כחלל מגורים קטן: נוף, שימוש יומיומי, בטיחות, השקיה ותחזוקה צריכים לעבוד יחד." : "ATELIER VERT относится к балкону как к небольшому жилому пространству: вид, ежедневное использование, безопасность, полив и уход должны работать вместе."}</p></div>
      <div class="metric-grid">
        <div><strong>≈7 600</strong><span>${lang === "he" ? "משפחות בשוק נגיש לפי מודל עסקי" : "семей в доступном рынке по бизнес-модели"}</span></div>
        <div><strong>4–6</strong><span>${lang === "he" ? "יעד פרויקטים לחודש" : "цель проектов в месяц"}</span></div>
        <div><strong>14 750 ₪</strong><span>${lang === "he" ? "צ'ק ממוצע עבודה עם מע\"מ" : "рабочий средний чек с НДС"}</span></div>
      </div>
    </section>
    <section class="section note-card wide"><h2>${lang === "he" ? "דיוק במספרים" : "О рыночных цифрах"}</h2><p>${lang === "he" ? "נתוני השוק מוצגים כמודל עסקי פנימי. האתר משתמש רק במסר רך: אלפי מרפסות בנתניה יכולות להפוך לחלל ירוק." : "Оценка рынка используется как бизнес-модель. Сайт использует только мягкую формулировку: тысячи балконов в Нетании можно превратить в зелёное пространство."}</p></section>
  `;
}

function faqPage(lang) {
  return `
    ${pageIntro(lang, "faq", lang === "he" ? "תשובות מועילות שאינן מחליפות בדיקה" : "Полезные ответы, которые не заменяют осмотр")}
    <section class="section faq-list">
      ${faqItems.map((item) => `<details data-faq="${item.id}"><summary>${esc(item[lang][0])}</summary><p>${esc(item[lang][1])}</p></details>`).join("")}
    </section>
  `;
}

function estimatePage(lang) {
  const t = languages[lang];
  return `
    ${pageIntro(lang, "estimate", lang === "he" ? "טופס קצר שמכין ליד איכותי" : "Короткая форма, которая готовит качественный лид")}
    <section class="section estimate-layout">
      <form class="estimate-form" data-estimate-form novalidate>
        <input type="text" name="company" tabindex="-1" autocomplete="off" class="honeypot" aria-hidden="true">
        <div class="form-progress" aria-label="${lang === "he" ? "התקדמות הטופס" : "Прогресс формы"}"><span data-progress-bar></span></div>
        <fieldset data-step="1">
          <legend>${lang === "he" ? "1. מרפסת ואזור" : "1. Балкон и район"}</legend>
          ${field(lang, "communication_language", "select", lang === "he" ? "שפת תקשורת" : "Язык общения", true, [["he", "HE"], ["ru", "RU"], ["en", "EN"]], lang)}
          ${field(lang, "district", "select", lang === "he" ? "אזור / עיר" : "Район / город", true, [["ir-yamim", serviceAreas[0][lang]], ["agamin", serviceAreas[1][lang]], ["nof-hatayeleth", serviceAreas[2][lang]], ["kiryat-hasharon", serviceAreas[3][lang]], ["ramat-poleg", serviceAreas[4][lang]], ["netanya-other", lang === "he" ? "נתניה - אחר" : "Нетания - другое"], ["outside", lang === "he" ? "מחוץ לנתניה" : "За пределами Нетании"]])}
          <label>${lang === "he" ? "אזור אחר" : "Другой район"}<input name="district_other" type="text" maxlength="80"></label>
          ${field(lang, "area", "select", lang === "he" ? "שטח משוער" : "Примерная площадь", true, [["under-8", "<8"], ["8-15", "8–15"], ["15-30", "15–30"], ["30-plus", "30+"], ["unknown", lang === "he" ? "לא יודע/ת" : "не знаю"]])}
          ${field(lang, "floor", "number", lang === "he" ? "קומה" : "Этаж", false)}
          <div class="form-actions"><button type="button" class="button button-primary" data-next>${t.common.next}</button></div>
        </fieldset>
        <fieldset data-step="2" hidden>
          <legend>${lang === "he" ? "2. תנאים ומטרה" : "2. Условия и цель"}</legend>
          ${field(lang, "sun", "select", lang === "he" ? "שמש" : "Солнце", false, [["morning", lang === "he" ? "בוקר" : "утро"], ["day", lang === "he" ? "יום" : "день"], ["shade", lang === "he" ? "צל" : "тень"], ["unknown", lang === "he" ? "לא יודע/ת" : "не знаю"]])}
          <label>${lang === "he" ? "מטרה" : "Цель"} <span class="required">${t.common.required}</span>
            <select name="goals" multiple required>
              <option value="green">${lang === "he" ? "ירוק" : "озеленение"}</option>
              <option value="privacy">${lang === "he" ? "פרטיות" : "приватность"}</option>
              <option value="lounge">${lang === "he" ? "אזור ישיבה" : "зона отдыха"}</option>
              <option value="refresh">${lang === "he" ? "חידוש מרפסת קיימת" : "обновление"}</option>
            </select>
          </label>
          ${field(lang, "budget", "select", lang === "he" ? "תקציב רצוי" : "Желаемый бюджет", true, [["under-7", lang === "he" ? "עד 7k" : "до 7k"], ["7-10", "7–10k"], ["10-20", "10–20k"], ["20-40", "20–40k"], ["40-plus", "40k+"], ["unknown", lang === "he" ? "לא יודע/ת" : "не знаю"]])}
          ${field(lang, "package", "select", lang === "he" ? "חבילה מעניינת" : "Интересующий пакет", false, [["start", "Start"], ["signature", "Signature"], ["premium", "Premium"], ["unknown", lang === "he" ? "לא יודע/ת" : "не знаю"]])}
          <div class="form-actions"><button type="button" class="button" data-prev>${t.common.prev}</button><button type="button" class="button button-primary" data-next>${t.common.next}</button></div>
        </fieldset>
        <fieldset data-step="3" hidden>
          <legend>${lang === "he" ? "3. תמונות והערות" : "3. Фото и комментарий"}</legend>
          <label>${lang === "he" ? "תמונות" : "Фотографии"} <span class="recommended">${t.common.recommended}</span>
            <input name="photos" type="file" accept=".jpg,.jpeg,.png,.heic,image/jpeg,image/png,image/heic" multiple data-photo-input>
            <span class="field-help">${lang === "he" ? "מומלץ 2–5 קבצים JPG/PNG/HEIC, עד 8MB לכל קובץ. אפשר גם לשלוח ב-WhatsApp." : "Рекомендуется 2–5 файлов JPG/PNG/HEIC, до 8 МБ каждый. Можно отправить фото в WhatsApp."}</span>
          </label>
          <div class="upload-status" data-upload-status aria-live="polite"></div>
          <label>${lang === "he" ? "תגובה" : "Комментарий"}<textarea name="comment" maxlength="1000" rows="5"></textarea></label>
          <div class="form-actions"><button type="button" class="button" data-prev>${t.common.prev}</button><button type="button" class="button button-primary" data-next>${t.common.next}</button></div>
        </fieldset>
        <fieldset data-step="4" hidden>
          <legend>${lang === "he" ? "4. פרטי קשר" : "4. Контакты"}</legend>
          ${field(lang, "name", "text", lang === "he" ? "שם" : "Имя", true)}
          ${field(lang, "phone", "tel", lang === "he" ? "טלפון" : "Телефон", true)}
          <label class="check-row"><input type="checkbox" name="consent" required> <span>${lang === "he" ? "אני מסכים/ה שייצרו איתי קשר ושיעבדו את הפרטים והתמונות לצורך הערכה." : "Я согласен/согласна на связь и обработку переданных данных и фотографий для оценки."} <a href="${pageHref(lang, "privacy")}">${lang === "he" ? "מדיניות פרטיות" : "Политика конфиденциальности"}</a></span></label>
          <div class="form-error" data-form-error aria-live="assertive"></div>
          <div class="form-actions"><button type="button" class="button" data-prev>${t.common.prev}</button><button type="submit" class="button button-primary">${t.common.send}</button></div>
        </fieldset>
      </form>
      <aside class="estimate-aside">
        <h2>${lang === "he" ? "אפשר גם ב-WhatsApp" : "Можно через WhatsApp"}</h2>
        <p>${lang === "he" ? "ההודעה נפתחת עם בקשה לאזור, גודל, 2–3 תמונות ותקציב." : "Сообщение откроется с просьбой прислать район, размер, 2–3 фото и бюджет."}</p>
        <a class="button button-full button-ghost" href="${whatsappHref(lang)}" data-whatsapp data-page="estimate">${icon("message")}<span>${t.common.whatsapp}</span></a>
        <div class="note-card"><h2>${lang === "he" ? "מה נשמר בליד" : "Что сохраняется в лиде"}</h2><p>${lang === "he" ? "מזהה, זמן, שפה, תשובות, שמות קבצים, UTM, referrer, עמוד נחיתה והסכמה. אנליטיקה לא מקבלת שם, טלפון, תגובה או URL תמונה." : "ID, время, язык, ответы, имена файлов, UTM, referrer, landing page и согласие. Аналитика не получает имя, телефон, комментарий или URL фото."}</p></div>
      </aside>
    </section>
  `;
}

function field(lang, name, type, label, required = false, options = [], value = "") {
  const t = languages[lang];
  const req = required ? ` required` : "";
  const tag = required ? `<span class="required">${t.common.required}</span>` : `<span class="optional">${t.common.optional}</span>`;
  if (type === "select") {
    const placeholder = required
      ? `<option value="" disabled${value ? "" : " selected"}>${lang === "he" ? "בחרו אפשרות" : "Выберите вариант"}</option>`
      : `<option value=""${value ? "" : " selected"}>${lang === "he" ? "לא יודע/ת" : "не знаю"}</option>`;
    return `<label>${esc(label)} ${tag}<select name="${name}"${req}>${placeholder}${options.map(([optionValue, optionLabel]) => `<option value="${esc(optionValue)}"${optionValue === value ? " selected" : ""}>${esc(optionLabel)}</option>`).join("")}</select></label>`;
  }
  const attrs = type === "number" ? ' min="0" max="60"' : type === "text" ? ' minlength="2" maxlength="60"' : type === "tel" ? ' inputmode="tel" pattern="^\\+?[0-9 ()-]{7,24}$"' : "";
  return `<label>${esc(label)} ${tag}<input name="${name}" type="${type}"${attrs}${req}></label>`;
}

function contactPage(lang) {
  return `
    ${pageIntro(lang, "contact", lang === "he" ? "נתניה קודם, בקשות חוץ מסומנות לבדיקה" : "Нетания в приоритете, внешние заявки помечаются для проверки")}
    <section class="section contact-grid">
      <div class="contact-card"><h2>${lang === "he" ? "WhatsApp" : "WhatsApp"}</h2><p>${lang === "he" ? "הדרך המהירה לשלוח תמונות ומידע בסיסי." : "Самый быстрый способ отправить фото и базовые параметры."}</p><a class="button button-full button-primary" href="${whatsappHref(lang)}" data-whatsapp data-page="contact">${icon("message")}<span>${languages[lang].common.whatsapp}</span></a></div>
      <div class="contact-card"><h2>${lang === "he" ? "טלפון" : "Телефон"}</h2><p><a href="${brand.phoneHref}" data-phone>${brand.phoneDisplay}</a></p><p>${esc(brand.responseWindow[lang])}</p></div>
      <div class="contact-card"><h2>${lang === "he" ? "אימייל" : "Email"}</h2><p><a href="mailto:${brand.email}">${brand.email}</a></p><p>${lang === "he" ? "לשאלות על שיתופי פעולה, מדיה או מסמכים." : "Для вопросов о сотрудничестве, медиа или документах."}</p></div>
    </section>
    <section class="section">
      <div class="section-heading"><h2>${lang === "he" ? "אזורי שירות" : "Зона работы"}</h2></div>
      <div class="area-grid">${serviceAreas.map((area) => `<article class="area-card"><strong>${esc(area[lang])}</strong><span>${area.priority === "A" ? (lang === "he" ? "עדיפות A" : "Приоритет A") : (lang === "he" ? "עדיפות B" : "Приоритет B")}</span></article>`).join("")}</div>
    </section>
  `;
}

function legalPage(lang, page) {
  const isPrivacy = page === "privacy";
  return `
    ${pageIntro(lang, page, languages[lang].common.legalReview)}
    <section class="section legal-copy">
      <h2>${isPrivacy ? (lang === "he" ? "איסוף מידע" : "Какие данные собираются") : (lang === "he" ? "מחויבות נגישות" : "Подход к доступности")}</h2>
      <p>${isPrivacy
        ? (lang === "he" ? "האתר אוסף פרטי קשר, תשובות לשאלון, מטא-דאטה של תמונות, UTM, referrer והסכמה כדי לטפל בבקשת הערכה." : "Сайт собирает контактные данные, ответы формы, метаданные фотографий, UTM, referrer и согласие, чтобы обработать заявку на оценку.")
        : (lang === "he" ? "האתר נבנה עם HTML סמנטי, ניווט מקלדת, ניגודיות מספקת, טקסט חלופי לתמונות ושמירה על RTL." : "Сайт построен с семантическим HTML, клавиатурной навигацией, достаточным контрастом, alt-текстами и поддержкой RTL.")}
      </p>
      <h2>${isPrivacy ? (lang === "he" ? "תמונות ולידים" : "Фотографии и лиды") : (lang === "he" ? "פנייה על בעיית נגישות" : "Сообщить о проблеме доступности")}</h2>
      <p>${isPrivacy
        ? (lang === "he" ? "תמונות אינן נשלחות לאנליטיקה. בפרודקשן הן חייבות להישמר באחסון מוגן עם גישה לעובדים מורשים בלבד ותקופת שמירה שאושרה." : "Фотографии не передаются в аналитику. В production они должны храниться в защищённом хранилище с доступом только для авторизованных сотрудников и утверждённым сроком хранения.")
        : (lang === "he" ? `אפשר לפנות ל-${brand.email} עם תיאור הבעיה, הדפדפן והמכשיר.` : `Можно написать на ${brand.email} с описанием проблемы, браузера и устройства.`)}
      </p>
      <p class="disclaimer">${esc(languages[lang].common.legalReview)}</p>
    </section>
  `;
}

function thankYouPage(lang) {
  const packageMessages = {
    start: lang === "he" ? "אם בחרתם Start, נבדוק שהתקציב, הגישה וכמות הכדים מתאימים להתחלה מהירה." : "Если выбран Start, мы проверим бюджет, доступ и количество кашпо для быстрого старта.",
    signature: lang === "he" ? "אם בחרתם Signature, נכין כיוון קונספטואלי לפרטיות, שכבות גובה והשקיה אוטומטית." : "Если выбран Signature, подготовим направление по приватности, слоям высоты и автополиву.",
    premium: lang === "he" ? "אם בחרתם Premium, השלב הבא הוא תיאום פגישת תכנון ובדיקת אלמנטים לא סטנדרטיים." : "Если выбран Premium, следующий шаг - проектная встреча и проверка нестандартных элементов.",
    unknown: lang === "he" ? "אם לא בטוחים בחבילה, נשתמש בתמונות ובתקציב כדי להציע כיוון." : "Если пакет не выбран, мы используем фото и бюджет, чтобы предложить направление."
  };
  return `
    <section class="section thank-you" data-thank-you>
      <p class="eyebrow">${brand.latin}</p>
      <h1>${lang === "he" ? "הבקשה התקבלה" : "Заявка получена"}</h1>
      <p class="lead">${lang === "he" ? "נבדוק את התמונות והפרטים ונחזור עם השלב הבא. אם חסרות תמונות, אפשר לשלוח אותן עכשיו ב-WhatsApp." : "Мы проверим фото и параметры и вернёмся со следующим шагом. Если фотографий не хватает, можно отправить их сейчас в WhatsApp."}</p>
      <p class="package-next" data-package-next data-messages="${esc(JSON.stringify(packageMessages))}">${esc(packageMessages.unknown)}</p>
      <div class="next-steps">
        ${(lang === "he" ? ["להשאיר את התמונות זמינות בשיחה", "להכין גודל משוער או מספר אריחים", "לחשוב על תקציב נוח ועל רמת תחזוקה"] : ["Оставить фотографии под рукой", "Подготовить примерный размер или число плиток", "Подумать о комфортном бюджете и уровне ухода"]).map((item) => `<span>${esc(item)}</span>`).join("")}
      </div>
      <div class="hero-actions"><a class="button button-primary" href="${whatsappHref(lang)}" data-whatsapp data-page="thank-you">${icon("message")}<span>${languages[lang].common.whatsapp}</span></a><a class="button button-ghost" href="${pageHref(lang)}">${lang === "he" ? "חזרה לאתר" : "Вернуться на сайт"}</a></div>
    </section>
  `;
}

function pageIntro(lang, page, eyebrow) {
  return `
    <section class="section page-intro">
      <p class="eyebrow">${esc(eyebrow)}</p>
      <h1>${esc(languages[lang].titles[page])}</h1>
      <p class="lead">${esc(languages[lang].descriptions[page])}</p>
    </section>
  `;
}

function render(lang, page, slug = "") {
  const bodies = {
    home: () => homePage(lang),
    services: () => servicesPage(lang),
    packages: () => packagesPage(lang),
    projects: () => projectsPage(lang),
    process: () => processPage(lang),
    maintenance: () => maintenancePage(lang),
    about: () => aboutPage(lang),
    faq: () => faqPage(lang),
    estimate: () => estimatePage(lang),
    contact: () => contactPage(lang),
    thankYou: () => thankYouPage(lang),
    privacy: () => legalPage(lang, "privacy"),
    accessibility: () => legalPage(lang, "accessibility"),
    project: () => projectPage(lang, projects.find((item) => item.slug === slug))
  };
  return layout(lang, page, bodies[page](), slug);
}

function build() {
  fs.rmSync(dist, { recursive: true, force: true });
  fs.mkdirSync(dist, { recursive: true });
  copyDir(path.join(root, "src/assets"), path.join(dist, "assets"));
  fs.copyFileSync(path.join(root, "src/styles.css"), path.join(dist, "styles.css"));
  fs.copyFileSync(path.join(root, "src/app.js"), path.join(dist, "app.js"));
  fs.mkdirSync(path.join(dist, "admin"), { recursive: true });
  fs.copyFileSync(path.join(root, "src/admin.html"), path.join(dist, "admin", "index.html"));

  const homeRedirect = pageHref("he");
  writeFile(path.join(dist, "index.html"), `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=${esc(homeRedirect)}"><script>location.replace(${JSON.stringify(homeRedirect)})</script><title>ATELIER VERT</title></head><body><a href="${esc(homeRedirect)}">ATELIER VERT</a></body></html>`);
  for (const lang of Object.keys(languages)) {
    writeFile(path.join(dist, lang, "index.html"), render(lang, "home"));
    for (const slug of pageSlugs) {
      const page = slug === "thank-you" ? "thankYou" : slug;
      writeFile(path.join(dist, lang, slug, "index.html"), render(lang, page));
    }
    for (const project of projects) {
      writeFile(path.join(dist, lang, "projects", project.slug, "index.html"), render(lang, "project", project.slug));
    }
  }

  const sitemapUrls = [];
  for (const lang of Object.keys(languages)) {
    sitemapUrls.push(canonical(lang, "home"));
    for (const slug of pageSlugs.filter((slug) => slug !== "thank-you")) {
      const page = slug === "thank-you" ? "thankYou" : slug;
      sitemapUrls.push(canonical(lang, page));
    }
    for (const project of projects) sitemapUrls.push(canonical(lang, "project", project.slug));
  }
  writeFile(path.join(dist, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapUrls.map((url) => `  <url><loc>${url}</loc></url>`).join("\n")}\n</urlset>\n`);
  writeFile(path.join(dist, "robots.txt"), `User-agent: *\nAllow: /\nDisallow: ${basePath}/he/thank-you/\nDisallow: ${basePath}/ru/thank-you/\nSitemap: ${publicSiteUrl}/sitemap.xml\n`);
}

build();
