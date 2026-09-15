(function () {
  const LS_THEME = "feed_theme";
  const ASSET_V = "10";
  let deferredPrompt = null;

  function currentTheme() {
    const t = localStorage.getItem(LS_THEME) || "red";
    return ["red", "blue", "green"].includes(t) ? t : "red";
  }
  function applyTheme(name) {
    const t = ["red", "blue", "green"].includes(name) ? name : "red";
    document.documentElement.setAttribute("data-theme", t);
    localStorage.setItem(LS_THEME, t);
    const meta = document.getElementById("meta-theme");
    const colors = { red: "#b71c1c", blue: "#0d47a1", green: "#1b5e20" };
    if (meta) meta.setAttribute("content", colors[t]);
  }
  window.setAppTheme = function (name) {
    applyTheme(name);
    if (typeof showManageSection === "function") showManageSection("settings");
    if (typeof showToast === "function") showToast("צבע עודכן");
  };
  applyTheme(currentTheme());

  function applyConnLabel(ok, label) {
    if (ok) return "Online";
    if (!label || /טוען|שיטס|מחובר|מכשיר/.test(label)) return "מתחבר לשרת";
    return label;
  }
  if (typeof setConn === "function") {
    const origSetConn = setConn;
    window.setConn = function (ok, label) {
      origSetConn(ok, applyConnLabel(ok, label));
    };
  }
  if (typeof setConn === "function") setConn(false, "מתחבר לשרת");
  else {
    const lab = document.getElementById("conn-label");
    if (lab && (/טוען|שיטס/.test(lab.textContent || "") || !lab.textContent)) {
      lab.textContent = "מתחבר לשרת";
    }
  }

  (function applyOfficialLogo() {
    if (!document.querySelector('link[href*="logo-fix.css"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "logo-fix.css?v=" + ASSET_V;
      document.head.appendChild(link);
    }
    document.querySelectorAll(".header-icon img, .splash-corner img").forEach(function (img) {
      img.src = "logo-mark-v8.svg?v=" + ASSET_V;
      img.style.objectFit = "contain";
      img.style.background = "transparent";
      img.alt = "Itzkovich Group";
    });
    document.querySelectorAll(".splash-logo img").forEach(function (img) {
      if (img.src && img.src.indexOf("data:image") === 0) return;
      img.src = "logo-full-v8.svg?v=" + ASSET_V;
      img.style.width = "100%";
      img.style.height = "auto";
      img.style.objectFit = "contain";
      img.style.background = "transparent";
      img.alt = "Itzkovich Group";
    });
  })();

  window.isInstalled = function () {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  };
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferredPrompt = e;
  });
  window.addEventListener("appinstalled", function () {
    deferredPrompt = null;
    window.enterApp();
  });

  window.enterApp = function () {
    const splash = document.getElementById("splash");
    if (splash) splash.classList.add("hidden");
    if (typeof showScreen === "function") showScreen("home");
  };

  window.installApp = async function () {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      window.enterApp();
      return;
    }
    if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
      const hint = document.getElementById("ios-hint");
      if (hint) hint.style.display = "block";
      if (typeof showToast === "function") showToast("באייפון: שיתוף ← הוסף למסך הבית");
      return;
    }
    if (typeof showToast === "function") showToast("בתפריט הדפדפן: התקן אפליקציה");
  };

  function finishSplash() {
    if (window.isInstalled()) {
      window.enterApp();
      return;
    }
    const sub = document.getElementById("splash-sub");
    if (sub) sub.textContent = "להתקנה על המסך הראשי";
    const barWrap = document.getElementById("splash-bar");
    if (barWrap) barWrap.style.display = "none";
    const actions = document.getElementById("splash-actions");
    if (actions) actions.classList.add("show");
    if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
      const hint = document.getElementById("ios-hint");
      if (hint) hint.style.display = "block";
    }
  }

  function startSplash() {
    const bar = document.querySelector("#splash-bar span");
    if (!bar) {
      window.enterApp();
      return;
    }
    const t0 = performance.now();
    function tick(now) {
      const p = Math.min(1, (now - t0) / 2000);
      bar.style.width = (p * 100) + "%";
      if (p < 1) requestAnimationFrame(tick);
      else finishSplash();
    }
    requestAnimationFrame(tick);
  }

  if (typeof showManageSection === "function") {
    const orig = showManageSection;
    window.showManageSection = function (section) {
      orig(section);
      if (section !== "settings") return;
      const c = document.getElementById("manage-content");
      if (!c || c.querySelector(".theme-row")) return;
      const th = currentTheme();
      const box = document.createElement("div");
      box.className = "card";
      box.innerHTML =
        '<div class="card-title">ערכת צבעים</div><div class="theme-row">' +
        '<button class="theme-swatch' + (th === "red" ? " on" : "") + '" onclick="setAppTheme(\'red\')"><div class="theme-dot" style="background:#d32f2f"></div>אדום</button>' +
        '<button class="theme-swatch' + (th === "blue" ? " on" : "") + '" onclick="setAppTheme(\'blue\')"><div class="theme-dot" style="background:#1976d2"></div>כחול</button>' +
        '<button class="theme-swatch' + (th === "green" ? " on" : "") + '" onclick="setAppTheme(\'green\')"><div class="theme-dot" style="background:#2e7d32"></div>ירוק</button>' +
        "</div>";
      c.insertBefore(box, c.firstChild);
    };
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then(function (regs) {
      return Promise.all(regs.map(function (r) { return r.unregister(); }));
    }).then(function () {
      if (!window.caches) return;
      return caches.keys().then(function (keys) {
        return Promise.all(keys.map(function (k) { return caches.delete(k); }));
      });
    }).then(function () {
      return navigator.serviceWorker.register("./sw.js?v=" + ASSET_V);
    }).catch(function () {});
  }
  if (!window.__splashStarted) { window.__splashStarted = true; startSplash(); }
})();
