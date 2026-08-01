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
    if (typeof window.gtag === "function") window.gtag("event", event, safe);
    if (window.console) console.debug("[atelier-event]", event, safe);
  }

  function qs(selector, root = document) {
    return root.querySelector(selector);
  }

  function qsa(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }

  function currentPageName() {
    const parts = routeParts();
    if (parts[1] === "projects" && parts[2]) return "project";
    return parts[1] || "home";
  }

  function routeParts() {
    const parts = location.pathname.split("/").filter(Boolean);
    const baseParts = String(config.basePath || "").split("/").filter(Boolean);
    if (baseParts.length && baseParts.every((part, index) => parts[index] === part)) {
      return parts.slice(baseParts.length);
    }
    return parts;
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
          package: link.dataset.package || selectedPackageFromUrl(),
          cta: link.dataset.whatsappCta || "generic"
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
    const parts = routeParts();
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
    const messagePreview = qs("[data-estimate-message-preview]", form);
    const draftKey = `atelier_estimate_draft_${lang}`;
    let current = 0;

    const params = new URLSearchParams(location.search);
    const packageSelect = form.elements.package;

    restoreDraft();
    if (packageSelect && params.get("package")) packageSelect.value = params.get("package");
    syncConditionalFields();
    showStep(0);
    updateEstimateMessagePreview();
    track("estimate_start", { source_page: document.referrer || "direct" });

    form.addEventListener("input", () => {
      saveDraft();
      updateEstimateMessagePreview();
    });
    form.addEventListener("change", () => {
      syncConditionalFields();
      saveDraft();
      updateEstimateMessagePreview();
    });
    qsa("[data-next]", form).forEach((button) => button.addEventListener("click", () => {
      if (validateStep(current)) showStep(Math.min(current + 1, steps.length - 1));
    }));
    qsa("[data-prev]", form).forEach((button) => button.addEventListener("click", () => showStep(Math.max(current - 1, 0))));

    if (photoInput) {
      photoInput.addEventListener("change", () => validatePhotos(true));
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!validateStep(current)) return;
      if (form.elements.company && form.elements.company.value) return;
      const messageLanguage = selectedEstimateLanguage(form);
      const message = buildEstimateWhatsAppMessage(form);
      updateEstimateMessagePreview();
      saveDraft();
      sessionStorage.setItem("atelier_last_whatsapp_message", message);
      track("form_submit", {
        submit_type: "whatsapp",
        language_choice: messageLanguage,
        package: String(new FormData(form).get("package") || ""),
        district: String(new FormData(form).get("district") || ""),
        budget: String(new FormData(form).get("budget") || "")
      });
      track("estimate_whatsapp_open", {
        language_choice: messageLanguage,
        photo_count: photoInput?.files?.length || 0
      });
      location.href = whatsappUrl(message);
    });

    function showStep(index) {
      current = index;
      steps.forEach((step, stepIndex) => {
        step.hidden = stepIndex !== index;
      });
      if (progress) progress.style.inlineSize = `${((index + 1) / steps.length) * 100}%`;
      updateEstimateMessagePreview();
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

    function updateEstimateMessagePreview() {
      if (!messagePreview) return;
      messagePreview.value = buildEstimateWhatsAppMessage(form);
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

  function whatsappUrl(message) {
    const number = String(config.whatsappNumber || "").replace(/\D/g, "");
    return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
  }

  function selectedEstimateLanguage(form) {
    const preferred = String(form.elements.communication_language?.value || lang || "ru").toLowerCase();
    return ["he", "ru", "en"].includes(preferred) ? preferred : "ru";
  }

  function buildEstimateWhatsAppMessage(form) {
    const messageLang = selectedEstimateLanguage(form);
    const copy = estimateMessageCopy(messageLang);
    const data = new FormData(form);
    const value = (name) => String(data.get(name) || "").trim();
    const labeled = (group, raw) => labelEstimateValue(messageLang, group, raw);
    const goals = data.getAll("goals").filter(Boolean).map((goal) => labeled("goals", goal)).join(", ");
    const district = value("district") === "netanya-other" || value("district") === "outside"
      ? `${labeled("district", value("district"))}${value("district_other") ? `: ${value("district_other")}` : ""}`
      : labeled("district", value("district"));
    const files = form.elements.photos?.files ? Array.from(form.elements.photos.files) : [];
    const photoLine = files.length
      ? copy.photosSelected(files.length, files.map((file) => file.name).join(", "))
      : copy.photosEmpty;
    const landingPage = sessionStorage.getItem("atelier_landing_page") || location.pathname + location.search;
    const sourcePage = currentPageName();

    return [
      copy.greeting,
      "",
      copy.contactHeading,
      `${copy.name}: ${value("name") || copy.empty}`,
      `${copy.phone}: ${value("phone") || copy.empty}`,
      `${copy.communicationLanguage}: ${labeled("communication_language", value("communication_language") || messageLang)}`,
      "",
      copy.balconyHeading,
      `${copy.district}: ${district || copy.empty}`,
      `${copy.area}: ${labeled("area", value("area"))}`,
      `${copy.floor}: ${value("floor") || copy.empty}`,
      "",
      copy.goalHeading,
      `${copy.sun}: ${labeled("sun", value("sun"))}`,
      `${copy.goals}: ${goals || copy.empty}`,
      `${copy.budget}: ${labeled("budget", value("budget"))}`,
      `${copy.package}: ${labeled("package", value("package"))}`,
      "",
      copy.notesHeading,
      `${copy.comment}: ${value("comment") || copy.empty}`,
      `${copy.photos}: ${photoLine}`,
      "",
      `${copy.source}: ${sourcePage}`,
      `${copy.landingPage}: ${landingPage}`
    ].join("\n");
  }

  function estimateMessageCopy(messageLang) {
    const copy = {
      he: {
        greeting: "שלום ATELIER VERT, אשמח להערכה ראשונית למרפסת. הנה הפרטים מהטופס:",
        contactHeading: "פרטי קשר",
        balconyHeading: "מרפסת",
        goalHeading: "תנאים ומטרה",
        notesHeading: "הערות ותמונות",
        name: "שם",
        phone: "טלפון",
        communicationLanguage: "שפת תקשורת",
        district: "אזור / עיר",
        area: "שטח משוער",
        floor: "קומה",
        sun: "שמש",
        goals: "מטרות",
        budget: "תקציב רצוי",
        package: "חבילה מעניינת",
        comment: "תגובה",
        photos: "תמונות",
        source: "עמוד מקור",
        landingPage: "עמוד נחיתה",
        empty: "לא צוין",
        photosEmpty: "לא נבחרו תמונות בטופס. אשלח אותן כאן ב-WhatsApp במידת הצורך.",
        photosSelected: (count, names) => `נבחרו ${count} תמונות בטופס (${names}). אצרף אותן כאן ב-WhatsApp אחרי פתיחת השיחה.`
      },
      ru: {
        greeting: "Здравствуйте, ATELIER VERT. Хочу получить предварительную оценку балкона. Вот данные из формы:",
        contactHeading: "Контакты",
        balconyHeading: "Балкон",
        goalHeading: "Условия и цель",
        notesHeading: "Комментарий и фото",
        name: "Имя",
        phone: "Телефон",
        communicationLanguage: "Язык общения",
        district: "Район / город",
        area: "Примерная площадь",
        floor: "Этаж",
        sun: "Солнце",
        goals: "Цели",
        budget: "Желаемый бюджет",
        package: "Интересующий пакет",
        comment: "Комментарий",
        photos: "Фотографии",
        source: "Страница источника",
        landingPage: "Страница входа",
        empty: "не указано",
        photosEmpty: "Фото не выбраны в форме. При необходимости отправлю их здесь в WhatsApp.",
        photosSelected: (count, names) => `В форме выбрано фото: ${count} (${names}). Прикреплю их здесь в WhatsApp после открытия чата.`
      },
      en: {
        greeting: "Hello ATELIER VERT. I would like an initial balcony assessment. Here are the details from the form:",
        contactHeading: "Contact",
        balconyHeading: "Balcony",
        goalHeading: "Conditions and goal",
        notesHeading: "Notes and photos",
        name: "Name",
        phone: "Phone",
        communicationLanguage: "Communication language",
        district: "Area / city",
        area: "Approximate area",
        floor: "Floor",
        sun: "Sun",
        goals: "Goals",
        budget: "Desired budget",
        package: "Interested package",
        comment: "Comment",
        photos: "Photos",
        source: "Source page",
        landingPage: "Landing page",
        empty: "not specified",
        photosEmpty: "No photos were selected in the form. I will send them here in WhatsApp if needed.",
        photosSelected: (count, names) => `${count} photos were selected in the form (${names}). I will attach them here in WhatsApp after the chat opens.`
      }
    };
    return copy[messageLang] || copy.ru;
  }

  function labelEstimateValue(messageLang, group, rawValue) {
    const raw = String(rawValue || "").trim();
    const copy = estimateMessageCopy(messageLang);
    if (!raw) return copy.empty;
    const labels = estimateValueLabels(messageLang);
    return labels[group]?.[raw] || raw;
  }

  function estimateValueLabels(messageLang) {
    const labels = {
      he: {
        communication_language: { he: "עברית", ru: "רוסית", en: "אנגלית" },
        district: { "ir-yamim": "עיר ימים", agamin: "אגמים", "nof-hatayeleth": "נוף הטיילת", "kiryat-hasharon": "קריית השרון", "ramat-poleg": "רמת פולג", "netanya-other": "נתניה - אחר", outside: "מחוץ לנתניה" },
        area: { "under-8": "פחות מ-8 מ\"ר", "8-15": "8-15 מ\"ר", "15-30": "15-30 מ\"ר", "30-plus": "30+ מ\"ר", unknown: "לא יודע/ת" },
        sun: { morning: "בוקר", day: "יום", shade: "צל", unknown: "לא יודע/ת" },
        goals: { green: "ירוק", privacy: "פרטיות", lounge: "אזור ישיבה", refresh: "חידוש מרפסת קיימת" },
        budget: { "under-7": "עד 7k", "7-10": "7-10k", "10-20": "10-20k", "20-40": "20-40k", "40-plus": "40k+", unknown: "לא יודע/ת" },
        package: { start: "Start", signature: "Signature", premium: "Premium", unknown: "לא יודע/ת" }
      },
      ru: {
        communication_language: { he: "иврит", ru: "русский", en: "английский" },
        district: { "ir-yamim": "Ир-Ямим", agamin: "Агамим", "nof-hatayeleth": "Ноф-ха-Тайелет", "kiryat-hasharon": "Кирьят-ха-Шарон", "ramat-poleg": "Рамат-Полег", "netanya-other": "Нетания - другое", outside: "За пределами Нетании" },
        area: { "under-8": "меньше 8 м²", "8-15": "8-15 м²", "15-30": "15-30 м²", "30-plus": "30+ м²", unknown: "не знаю" },
        sun: { morning: "утро", day: "день", shade: "тень", unknown: "не знаю" },
        goals: { green: "озеленение", privacy: "приватность", lounge: "зона отдыха", refresh: "обновление существующего балкона" },
        budget: { "under-7": "до 7k", "7-10": "7-10k", "10-20": "10-20k", "20-40": "20-40k", "40-plus": "40k+", unknown: "не знаю" },
        package: { start: "Start", signature: "Signature", premium: "Premium", unknown: "не знаю" }
      },
      en: {
        communication_language: { he: "Hebrew", ru: "Russian", en: "English" },
        district: { "ir-yamim": "Ir Yamim", agamin: "Agamim", "nof-hatayeleth": "Nof HaTayelet", "kiryat-hasharon": "Kiryat HaSharon", "ramat-poleg": "Ramat Poleg", "netanya-other": "Netanya - other", outside: "Outside Netanya" },
        area: { "under-8": "under 8 m²", "8-15": "8-15 m²", "15-30": "15-30 m²", "30-plus": "30+ m²", unknown: "not sure" },
        sun: { morning: "morning", day: "day", shade: "shade", unknown: "not sure" },
        goals: { green: "greenery", privacy: "privacy", lounge: "lounge area", refresh: "refresh existing balcony" },
        budget: { "under-7": "up to 7k", "7-10": "7-10k", "10-20": "10-20k", "20-40": "20-40k", "40-plus": "40k+", unknown: "not sure" },
        package: { start: "Start", signature: "Signature", premium: "Premium", unknown: "not sure" }
      }
    };
    return labels[messageLang] || labels.ru;
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
