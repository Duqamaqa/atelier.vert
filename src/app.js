(function () {
  const config = window.ATELIER || {};
  const lang = config.lang || document.documentElement.lang || "he";
  const labels = config.labels || {};

  function track(event, params = {}) {
    const safe = { ...params, language: lang };
    delete safe.name;
    delete safe.phone;
    delete safe.comment;
    delete safe.photo_url;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event, ...safe });
    if (window.console) console.debug("[atelier-event]", event, safe);
  }

  function qs(selector, root = document) {
    return root.querySelector(selector);
  }

  function qsa(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }

  function currentPageName() {
    const parts = location.pathname.split("/").filter(Boolean);
    if (parts[1] === "projects" && parts[2]) return "project";
    return parts[1] || "home";
  }

  function setupMenu() {
    const toggle = qs("[data-menu-toggle]");
    const nav = qs("[data-nav]");
    if (!toggle || !nav) return;
    const setNavState = (open) => {
      nav.classList.toggle("is-open", open);
      document.body.classList.toggle("menu-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      if ("inert" in nav) nav.inert = !open && window.matchMedia("(max-width: 900px)").matches;
      qsa("a", nav).forEach((link) => {
        if (!open && window.matchMedia("(max-width: 900px)").matches) link.setAttribute("tabindex", "-1");
        else link.removeAttribute("tabindex");
      });
    };
    setNavState(false);
    toggle.addEventListener("click", () => {
      const open = !nav.classList.contains("is-open");
      setNavState(open);
    });
    qsa("a", nav).forEach((link) => link.addEventListener("click", () => {
      setNavState(false);
    }));
    window.addEventListener("resize", () => setNavState(nav.classList.contains("is-open")));
  }

  function setupWhatsApp() {
    const text = encodeURIComponent(config.whatsappText || "");
    const base = `https://wa.me/${config.whatsappNumber || ""}?text=${text}`;
    qsa("[data-whatsapp]").forEach((link) => {
      link.setAttribute("href", base);
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener");
      link.addEventListener("click", () => {
        track("whatsapp_click", {
          page: link.dataset.page || currentPageName(),
          package: link.dataset.package || selectedPackageFromUrl()
        });
      });
    });
    qsa("[data-phone]").forEach((link) => {
      link.addEventListener("click", () => track("phone_click", { page: currentPageName() }));
    });
  }

  function setupLanguageTracking() {
    qsa("[data-track='language_switch']").forEach((link) => {
      const base = link.dataset.localizedBase || link.getAttribute("href") || "/";
      const query = preservedQueryString();
      link.setAttribute("href", `${base}${query ? `?${query}` : ""}`);
      link.addEventListener("click", () => {
        track("language_switch", { from: link.dataset.from, to: link.dataset.to, page: currentPageName() });
      });
    });
  }

  function setupPackageTracking() {
    qsa("[data-package-card]").forEach((card) => {
      let tracked = false;
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !tracked) {
            tracked = true;
            track("view_package", { package: card.dataset.packageCard });
            observer.disconnect();
          }
        });
      }, { threshold: 0.5 });
      observer.observe(card);
    });
    qsa("[data-package-select]").forEach((link) => {
      link.addEventListener("click", () => {
        track("package_select", { package: link.dataset.packageSelect, page: currentPageName() });
      });
    });
  }

  function setupBeforeAfter() {
    qsa("[data-before-after]").forEach((wrap) => {
      const input = qs("input[type='range']", wrap);
      if (!input) return;
      let dragging = false;
      const update = () => wrap.style.setProperty("--split", `${input.value}%`);
      const setFromPointer = (event) => {
        const rect = wrap.getBoundingClientRect();
        const percent = ((event.clientX - rect.left) / rect.width) * 100;
        const clamped = Math.min(100, Math.max(0, percent));
        input.value = String(Math.round(clamped));
        update();
      };
      input.addEventListener("input", update);
      input.addEventListener("change", () => track("before_after_interaction", { project: currentPageName() }));
      wrap.addEventListener("pointerdown", (event) => {
        dragging = true;
        wrap.setPointerCapture(event.pointerId);
        setFromPointer(event);
        event.preventDefault();
      });
      wrap.addEventListener("pointermove", (event) => {
        if (!dragging) return;
        setFromPointer(event);
      });
      wrap.addEventListener("pointerup", (event) => {
        if (!dragging) return;
        dragging = false;
        wrap.releasePointerCapture(event.pointerId);
        track("before_after_interaction", { project: currentPageName() });
      });
      update();
    });
  }

  function setupFaq() {
    qsa("[data-faq]").forEach((details) => {
      details.addEventListener("toggle", () => {
        if (details.open) track("faq_open", { question_id: details.dataset.faq });
      });
    });
  }

  function setupProjectFilters() {
    const form = qs("[data-project-filters]");
    const list = qs("[data-project-list]");
    if (!form || !list) return;
    const cards = qsa("[data-project-card]", list);
    const empty = qs("[data-empty-state]");
    const params = new URLSearchParams(location.search);
    qsa("select", form).forEach((select) => {
      if (params.get(select.name)) select.value = params.get(select.name);
    });

    function applyFilters(push = true) {
      const data = new FormData(form);
      const next = new URLSearchParams(location.search);
      let visible = 0;
      for (const [key, value] of data.entries()) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      cards.forEach((card) => {
        const matches = Array.from(data.entries()).every(([key, value]) => !value || card.dataset[key] === value);
        card.hidden = !matches;
        if (matches) visible += 1;
      });
      if (empty) empty.hidden = visible !== 0;
      if (push) {
        const query = next.toString();
        history.replaceState(null, "", `${location.pathname}${query ? `?${query}` : ""}`);
      }
    }

    form.addEventListener("change", () => applyFilters(true));
    applyFilters(false);
  }

  function setupProjectView() {
    const parts = location.pathname.split("/").filter(Boolean);
    if (parts[1] !== "projects" || !parts[2]) return;
    const cardContext = document.querySelector(".project-meta")?.innerText || "";
    track("project_view", {
      project: parts[2],
      district: document.querySelector(".eyebrow")?.innerText || "",
      category: cardContext
    });
  }

  function setupCalculator() {
    const form = qs("[data-calculator]");
    if (!form) return;
    const result = qs("[data-calculator-result]", form);
    const copy = {
      he: {
        start: ["Start", "נראה שהכיוון הוא Start. נבדוק גישה, מספר כדים והשקיה."],
        signature: ["Signature", "נראה שהכיוון הוא Signature, במיוחד אם יש צורך בפרטיות או שכבות גובה."],
        premium: ["Premium / Penthouse", "נראה שנדרשת פגישת תכנון לפרויקט גדול או לא סטנדרטי."],
        consult: ["ייעוץ / פתרון קומפקטי", "תקציב עד 7k לא מבטיח חבילת Start מלאה. כדאי לשלוח תמונות כדי לבדוק פתרון קומפקטי."],
        unknown: ["בדיקה ידנית", "אם הגודל לא ידוע, שלחו תמונות וגודל אריח/צעד כדי שנעריך את הכיוון."],
        wind: "בקומה גבוהה או רוח חזקה נדרשת בדיקת יציבות והתאמת צמחים בכל חבילה."
      },
      ru: {
        start: ["Start", "Похоже, подходит Start. Проверим доступ, количество кашпо и полив."],
        signature: ["Signature", "Похоже, подходит Signature, особенно если нужна приватность или слои высоты."],
        premium: ["Premium / Penthouse", "Похоже, нужна проектная встреча для большого или нестандартного решения."],
        consult: ["Консультация / компактное решение", "Бюджет до 7k не обещает полный Start. Лучше отправить фото, чтобы проверить компактный вариант."],
        unknown: ["Ручная проверка", "Если площадь неизвестна, пришлите фото и размер плитки/шага, чтобы оценить направление."],
        wind: "Высокий этаж или сильный ветер требуют проверки устойчивости и подбора растений в любом пакете."
      }
    }[lang] || {};

    function recommend() {
      const data = new FormData(form);
      const size = data.get("size");
      const budget = data.get("budget");
      const goal = data.get("goal");
      const wind = data.get("wind") === "yes";
      let key = "start";
      if (budget === "under-7") key = "consult";
      else if (size === "unknown") key = "unknown";
      else if (size === "30-plus" || goal === "premium" || budget === "40-plus") key = "premium";
      else if (size === "15-30" || goal === "privacy" || budget === "10-20" || budget === "20-40") key = "signature";
      const [title, text] = copy[key];
      result.innerHTML = `<strong>${title}</strong><p>${text}${wind ? ` ${copy.wind}` : ""}</p><a class="button button-primary" href="${config.estimatePath}?package=${encodeURIComponent(packageKey(key))}">${labels.estimate || "Estimate"}</a>`;
    }

    form.addEventListener("change", recommend);
    recommend();
  }

  function packageKey(key) {
    if (key === "premium") return "premium";
    if (key === "signature") return "signature";
    if (key === "start") return "start";
    return "unknown";
  }

  function selectedPackageFromUrl() {
    return new URLSearchParams(location.search).get("package") || "";
  }

  function preservedQueryString() {
    const source = new URLSearchParams(location.search);
    const allowed = ["package", "size", "exposure", "district", "goal", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
    const next = new URLSearchParams();
    allowed.forEach((key) => {
      if (source.get(key)) next.set(key, source.get(key));
    });
    return next.toString();
  }

  function setupEstimateForm() {
    const form = qs("[data-estimate-form]");
    if (!form) return;
    const steps = qsa("[data-step]", form);
    const progress = qs("[data-progress-bar]", form);
    const error = qs("[data-form-error]", form);
    const uploadStatus = qs("[data-upload-status]", form);
    const photoInput = qs("[data-photo-input]", form);
    const draftKey = `atelier_estimate_draft_${lang}`;
    let current = 0;

    const params = new URLSearchParams(location.search);
    const packageSelect = form.elements.package;

    restoreDraft();
    if (packageSelect && params.get("package")) packageSelect.value = params.get("package");
    syncConditionalFields();
    showStep(0);
    track("estimate_start", { source_page: document.referrer || "direct" });

    form.addEventListener("input", saveDraft);
    form.addEventListener("change", () => {
      syncConditionalFields();
      saveDraft();
    });
    qsa("[data-next]", form).forEach((button) => button.addEventListener("click", () => {
      if (validateStep(current)) showStep(Math.min(current + 1, steps.length - 1));
    }));
    qsa("[data-prev]", form).forEach((button) => button.addEventListener("click", () => showStep(Math.max(current - 1, 0))));

    if (photoInput) {
      photoInput.addEventListener("change", () => validatePhotos(true));
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!validateStep(current)) return;
      if (form.elements.company && form.elements.company.value) return;
      if (rateLimited()) {
        setError(lang === "he" ? "יותר מדי ניסיונות. נסו שוב מאוחר יותר או פתחו WhatsApp." : "Слишком много попыток. Попробуйте позже или откройте WhatsApp.");
        track("form_error", { error_type: "rate_limit", step: current + 1 });
        return;
      }
      const submitButton = qs('button[type="submit"]', form);
      if (submitButton) submitButton.disabled = true;
      try {
        const lead = await submitLead(form);
        sessionStorage.setItem("atelier_last_submission", lead.id);
        localStorage.removeItem(draftKey);
        track("form_submit", {
          package: lead.answers.package,
          district: lead.answers.district,
          budget: lead.answers.budget,
          lead_id: lead.id
        });
        location.href = `${config.thankYouPath}?lead=${encodeURIComponent(lead.id)}&package=${encodeURIComponent(lead.answers.package || "")}`;
      } catch (err) {
        saveOutbox(form, err);
        setError(lang === "he" ? "השליחה לא הושלמה. הטיוטה נשמרה בדפדפן; אפשר לנסות שוב או לפתוח WhatsApp." : "Отправка не завершилась. Черновик сохранён в браузере; можно попробовать снова или открыть WhatsApp.");
        track("form_error", { error_type: "submit_failed", step: current + 1 });
        if (submitButton) submitButton.disabled = false;
      }
    });

    function showStep(index) {
      current = index;
      steps.forEach((step, stepIndex) => {
        step.hidden = stepIndex !== index;
      });
      if (progress) progress.style.inlineSize = `${((index + 1) / steps.length) * 100}%`;
      track("estimate_step", { step: index + 1, answers_summary: summarizeAnswers(form) });
    }

    function validateStep(index) {
      clearError();
      syncConditionalFields();
      const step = steps[index];
      if (index === 0 && requiresDistrictOther() && !String(form.elements.district_other.value || "").trim()) {
        setError(lang === "he" ? "כתבו את האזור או העיר כדי שנוכל לבדוק לוגיסטיקה." : "Укажите район или город, чтобы мы могли проверить логистику.");
        form.elements.district_other.focus();
        track("form_error", { error_type: "district_other_required", step: index + 1 });
        return false;
      }
      const controls = qsa("input, select, textarea", step).filter((control) => !control.disabled && control.type !== "button");
      for (const control of controls) {
        if (!control.checkValidity()) {
          control.reportValidity();
          track("form_error", { error_type: "validation", step: index + 1 });
          return false;
        }
      }
      if (index === 3 && !validPhone(form.elements.phone.value)) {
        setError(lang === "he" ? "הכניסו מספר טלפון ישראלי או בינלאומי תקין." : "Введите корректный израильский или международный номер телефона.");
        form.elements.phone.focus();
        track("form_error", { error_type: "phone_format", step: index + 1 });
        return false;
      }
      if (photoInput && index === 2 && !validatePhotos(false)) return false;
      return true;
    }

    function requiresDistrictOther() {
      return ["netanya-other", "outside"].includes(form.elements.district?.value);
    }

    function syncConditionalFields() {
      if (!form.elements.district_other) return;
      form.elements.district_other.required = requiresDistrictOther();
      form.elements.district_other.setAttribute("aria-required", String(requiresDistrictOther()));
    }

    function validatePhotos(showSuccess) {
      if (!photoInput || !photoInput.files.length) {
        if (uploadStatus) {
          uploadStatus.textContent = lang === "he" ? "אפשר להמשיך בלי תמונות ולשלוח אותן ב-WhatsApp." : "Можно продолжить без фото и отправить их в WhatsApp.";
          uploadStatus.classList.remove("success");
        }
        return true;
      }
      const files = Array.from(photoInput.files);
      const allowed = ["image/jpeg", "image/png", "image/heic", "image/heif"];
      const namesAllowed = /\.(jpe?g|png|heic)$/i;
      if (files.length > 5) {
        setUpload(lang === "he" ? "אפשר להעלות עד 5 תמונות." : "Можно загрузить до 5 фотографий.", false);
        track("photo_upload_error", { error_type: "too_many" });
        return false;
      }
      for (const file of files) {
        if (file.size > 8 * 1024 * 1024) {
          setUpload(lang === "he" ? "כל קובץ צריך להיות עד 8MB." : "Каждый файл должен быть до 8 МБ.", false);
          track("photo_upload_error", { error_type: "too_large" });
          return false;
        }
        if (!(allowed.includes(file.type) || namesAllowed.test(file.name))) {
          setUpload(lang === "he" ? "קבצים נתמכים: JPG, PNG או HEIC." : "Поддерживаются JPG, PNG или HEIC.", false);
          track("photo_upload_error", { error_type: "file_type" });
          return false;
        }
      }
      const note = files.length < 2
        ? (lang === "he" ? "תמונה אחת התקבלה. 2–5 תמונות יעזרו להערכה טובה יותר." : "Одна фотография принята. 2–5 фото помогут оценить точнее.")
        : (lang === "he" ? `${files.length} תמונות מוכנות לשליחה.` : `${files.length} фото готовы к отправке.`);
      setUpload(note, true);
      if (showSuccess) track("photo_upload_success", { count: files.length, file_type: [...new Set(files.map((f) => f.type || fileExtension(f.name)))].join(",") });
      return true;
    }

    function setUpload(message, success) {
      if (!uploadStatus) return;
      uploadStatus.textContent = message;
      uploadStatus.classList.toggle("success", success);
    }

    function saveDraft() {
      const data = formDataObject(new FormData(form), false);
      localStorage.setItem(draftKey, JSON.stringify(data));
    }

    function restoreDraft() {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const data = JSON.parse(raw);
      Object.entries(data).forEach(([key, value]) => {
        const element = form.elements[key];
        if (!element || key === "photos") return;
        if (element instanceof RadioNodeList) return;
        if (element.type === "checkbox") element.checked = Boolean(value);
        else if (element.multiple && Array.isArray(value)) qsa("option", element).forEach((option) => option.selected = value.includes(option.value));
        else element.value = value;
      });
    }

    function setError(message) {
      if (error) error.textContent = message;
    }

    function clearError() {
      if (error) error.textContent = "";
    }
  }

  function formDataObject(formData, includePrivate) {
    const data = {};
    for (const [key, value] of formData.entries()) {
      if (key === "company") continue;
      if (!includePrivate && ["name", "phone", "comment"].includes(key)) continue;
      if (value instanceof File) continue;
      if (data[key]) {
        data[key] = Array.isArray(data[key]) ? [...data[key], value] : [data[key], value];
      } else {
        data[key] = value;
      }
    }
    return data;
  }

  async function submitLead(form) {
    const formData = new FormData(form);
    const params = new URLSearchParams(location.search);
    const savedUtm = JSON.parse(sessionStorage.getItem("atelier_utm") || "{}");
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach((key) => {
      if (params.get(key)) formData.set(key, params.get(key));
      else if (savedUtm[key]) formData.set(key, savedUtm[key]);
    });
    formData.set("page_language", lang);
    formData.set("referrer", document.referrer || "");
    formData.set("landing_page", sessionStorage.getItem("atelier_landing_page") || location.pathname + location.search);
    formData.set("source_page", currentPageName());
    const response = await fetch("/api/leads", {
      method: "POST",
      body: formData
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.ok) throw new Error(payload.error || "submit_failed");
    return {
      id: payload.lead_id,
      answers: {
        package: String(formData.get("package") || ""),
        district: String(formData.get("district") || ""),
        budget: String(formData.get("budget") || "")
      }
    };
  }

  function saveOutbox(form, err) {
    const outbox = JSON.parse(localStorage.getItem("atelier_lead_outbox") || "[]");
    outbox.push({
      timestamp: new Date().toISOString(),
      language: lang,
      reason: err?.message || "submit_failed",
      answers: formDataObject(new FormData(form), true),
      note: "Files are not persisted in browser fallback; ask visitor to retry or send photos in WhatsApp."
    });
    localStorage.setItem("atelier_lead_outbox", JSON.stringify(outbox.slice(-10)));
  }

  function summarizeAnswers(form) {
    const data = formDataObject(new FormData(form), false);
    return Object.entries(data)
      .filter(([, value]) => Boolean(value))
      .slice(0, 6)
      .map(([key, value]) => `${key}:${Array.isArray(value) ? value.join("|") : value}`)
      .join(",");
  }

  function fileExtension(name) {
    return name.split(".").pop()?.toLowerCase() || "unknown";
  }

  function validPhone(value) {
    const raw = String(value || "").trim();
    const digits = raw.replace(/\D/g, "");
    return /^\+?[0-9 ()-]{7,24}$/.test(raw) && digits.length >= 7 && digits.length <= 15;
  }

  function rateLimited() {
    const key = "atelier_submit_times";
    const now = Date.now();
    const hour = 60 * 60 * 1000;
    const times = JSON.parse(localStorage.getItem(key) || "[]").filter((time) => now - time < hour);
    times.push(now);
    localStorage.setItem(key, JSON.stringify(times));
    return times.length > 5;
  }

  function rememberLandingPage() {
    if (!sessionStorage.getItem("atelier_landing_page")) {
      sessionStorage.setItem("atelier_landing_page", location.pathname + location.search);
    }
  }

  function rememberAttribution() {
    const params = new URLSearchParams(location.search);
    const keys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
    const current = JSON.parse(sessionStorage.getItem("atelier_utm") || "{}");
    let changed = false;
    keys.forEach((key) => {
      if (params.get(key)) {
        current[key] = params.get(key);
        changed = true;
      }
    });
    if (changed) sessionStorage.setItem("atelier_utm", JSON.stringify(current));
  }

  function setupThankYou() {
    const node = qs("[data-package-next]");
    if (!node) return;
    const key = selectedPackageFromUrl() || "unknown";
    const messages = JSON.parse(node.dataset.messages || "{}");
    node.textContent = messages[key] || messages.unknown || node.textContent;
  }

  rememberLandingPage();
  rememberAttribution();
  setupMenu();
  setupWhatsApp();
  setupLanguageTracking();
  setupPackageTracking();
  setupBeforeAfter();
  setupFaq();
  setupProjectFilters();
  setupProjectView();
  setupCalculator();
  setupThankYou();
  setupEstimateForm();
})();
