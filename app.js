/* Indiana Kite Tribe — spine scroll + i18n + WhatsApp */

const WA_NUMBER = "5585992792065";
const STORAGE_KEY = "indiana-tribe-lang";
const LANGS = ["es", "pt", "en"];
const STOPS = [
  { id: "cumbuco", km: 0 },
  { id: "paracuru", km: 41 },
  { id: "baleia", km: 106 },
  { id: "almofala", km: 158 },
  { id: "arpoeiras", km: 190 },
  { id: "jeri", km: 242 },
];

let dict = null;
let lang = "es";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function detectLang() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && LANGS.includes(stored)) return stored;
  const nav = (navigator.language || "es").toLowerCase();
  if (nav.startsWith("pt")) return "pt";
  if (nav.startsWith("en")) return "en";
  return "es";
}

function lookup(key) {
  if (!dict || !dict[lang]) return "";
  const val = key.split(".").reduce((acc, part) => (acc == null ? acc : acc[part]), dict[lang]);
  return typeof val === "string" ? val : "";
}

function applyI18n() {
  if (!dict) return;
  document.documentElement.lang = lang === "pt" ? "pt-BR" : lang;

  $$("[data-i18n]").forEach((el) => {
    const val = lookup(el.dataset.i18n);
    if (val) el.textContent = val;
  });

  $$("[data-i18n-html]").forEach((el) => {
    const val = lookup(el.dataset.i18nHtml);
    if (val) el.innerHTML = val;
  });

  $$("[data-i18n-aria]").forEach((el) => {
    const val = lookup(el.dataset.i18nAria);
    if (val) el.setAttribute("aria-label", val);
  });

  const title = lookup("meta.title");
  if (title) document.title = title;
  const desc = lookup("meta.description");
  const meta = $('meta[name="description"]');
  if (desc && meta) meta.setAttribute("content", desc);

  $$("[data-lang]").forEach((btn) => {
    btn.setAttribute("aria-pressed", btn.dataset.lang === lang ? "true" : "false");
  });

  $$("[data-wa]").forEach((a) => {
    const msg = lookup(`wa.${a.dataset.wa}`);
    if (msg) a.href = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;
  });
}

async function loadI18n() {
  try {
    const res = await fetch("i18n.json");
    if (!res.ok) throw new Error(res.status);
    dict = await res.json();
    lang = detectLang();
    applyI18n();
  } catch (err) {
    console.warn("i18n.json no cargó. Corré ./preview.sh", err);
    lang = "es";
  }
}

function initLangSwitcher() {
  $$("[data-lang]").forEach((btn) => {
    btn.addEventListener("click", () => {
      lang = btn.dataset.lang;
      localStorage.setItem(STORAGE_KEY, lang);
      applyI18n();
    });
  });
}

function initNav() {
  const toggle = $(".menu-toggle");
  const links = $(".nav-links");
  if (!toggle || !links) return;
  toggle.addEventListener("click", () => {
    const open = links.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  });
  links.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", () => {
      links.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    });
  });
}

function currentStop(km) {
  let current = STOPS[0];
  for (const stop of STOPS) {
    if (km + 0.8 >= stop.km) current = stop;
  }
  return current;
}

function initSpine() {
  const section = $("#recorrido");
  const svg = $(".spine-canvas svg");
  if (!section) return;

  const path = svg && svg.querySelector("#coast-line");
  const progress = svg && svg.querySelector("#coast-progress");
  const rider = svg && svg.querySelector("#kite-dot");
  const days = $$("[data-day]", section);
  const legend = $$(".spine-legend [data-stop]");
  const mobileSpot = $(".spine-mobile-spot");
  const mobileKm = $(".spine-mobile-km");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const len = path ? path.getTotalLength() : 0;
  let rideLen = len;
  if (path && len) {
    let best = len;
    let bestD = Infinity;
    for (let i = 0; i <= 120; i++) {
      const l = (i / 120) * len;
      const pt = path.getPointAtLength(l);
      const d = (pt.x - 34) ** 2 + (pt.y - 50) ** 2;
      if (d < bestD) {
        bestD = d;
        best = l;
      }
    }
    rideLen = best;
  }

  const stopNames = () => ({
    cumbuco: lookup("spotsList.cumbuco.name") || "Cumbuco",
    paracuru: lookup("spotsList.paracuru.name") || "Paracuru",
    baleia: lookup("spotsList.baleia.name") || "Baleia",
    almofala: lookup("spotsList.almofala.name") || "Almofala",
    arpoeiras: lookup("spotsList.arpoeiras.name") || "Arpoeiras",
    jeri: lookup("spotsList.jeri.name") || "Jeri",
  });

  function setKm(km) {
    const clamped = Math.max(0, Math.min(242, km));
    document.documentElement.style.setProperty("--spine-p", String(clamped / 242));

    if (progress) progress.style.strokeDashoffset = String(242 - clamped);

    if (rider && path && rideLen) {
      const pt = path.getPointAtLength((clamped / 242) * rideLen);
      rider.setAttribute("transform", `translate(${pt.x} ${pt.y})`);
    }

    if (svg) {
      svg.querySelectorAll(".coast-stop").forEach((g) => {
        const stopKm = Number(g.dataset.km);
        g.classList.toggle("is-reached", stopKm <= clamped + 0.5);
        g.classList.toggle("is-current", Math.abs(stopKm - currentStop(clamped).km) < 0.1);
      });
    }

    const cur = currentStop(clamped);
    legend.forEach((li) => li.classList.toggle("is-current", li.dataset.stop === cur.id));

    const names = stopNames();
    if (mobileSpot) mobileSpot.textContent = names[cur.id] || cur.id;
    if (mobileKm) mobileKm.textContent = `${Math.round(clamped)} / 242 km`;
  }

  function activeDayIndex() {
    const vh = window.innerHeight;
    const focus = vh * 0.48;
    let active = 1;
    days.forEach((day) => {
      const r = day.getBoundingClientRect();
      if (r.top < focus) active = Number(day.dataset.day);
    });
    return active;
  }

  function kiteProgress() {
    if (!days.length) return 0;
    const vh = window.innerHeight;
    const focus = vh * 0.46;
    const first = days[0].getBoundingClientRect();
    const last = days[days.length - 1].getBoundingClientRect();
    const startY = first.top + first.height * 0.18;
    const endY = last.top + last.height * 0.42;
    const span = endY - startY;
    if (span <= 1) return startY > focus ? 0 : 1;
    return Math.max(0, Math.min(1, (focus - startY) / span));
  }

  function onScroll() {
    const day = activeDayIndex();
    days.forEach((el) => el.classList.toggle("is-active", Number(el.dataset.day) === day));

    if (reduced) {
      const endKm = [41, 106, 158, 190, 242][day - 1] || 0;
      setKm(endKm);
      return;
    }

    setKm(kiteProgress() * 242);
  }

  setKm(0);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
}

function phImg(img) {
  const slot = img.dataset.slot;
  if (!slot) return;
  const jpg = new Image();
  jpg.onload = () => {
    img.src = `assets/${slot}.jpg`;
    img.closest(".day-media, .spot-media, .g-item, .review-media, .hero-photo")?.classList.add("has-photo");
  };
  jpg.src = `assets/${slot}.jpg`;
}

function boot() {
  $$("img[data-slot]").forEach(phImg);
  initLangSwitcher();
  initNav();
  initSpine();
}

loadI18n().finally(boot);
