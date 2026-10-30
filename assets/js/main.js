/* France Propreté Hygiène — interactions */
(function () {
  "use strict";

  var doc = document.documentElement;
  doc.classList.remove("no-js");
  doc.classList.add("js");

  /* En-tête : passe en fond blanc au défilement (accueil) */
  var header = document.querySelector(".header");
  var actionBar = document.querySelector(".action-bar");
  var hero = document.querySelector(".hero, .page-hero");

  function onScroll() {
    var y = window.scrollY;
    if (header && header.classList.contains("header--over")) {
      header.classList.toggle("is-solid", y > 40);
    }
    if (actionBar) {
      var limit = hero ? hero.offsetHeight * 0.6 : 200;
      actionBar.classList.toggle("is-visible", y > limit);
    }
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* Menu mobile */
  var menu = document.getElementById("mobile-menu");
  var openers = document.querySelectorAll("[data-menu-open]");
  var closers = document.querySelectorAll("[data-menu-close]");
  var lastFocus = null;

  function openMenu() {
    if (!menu) return;
    lastFocus = document.activeElement;
    menu.classList.add("is-open");
    menu.setAttribute("aria-hidden", "false");
    document.body.classList.add("menu-open");
    openers.forEach(function (b) { b.setAttribute("aria-expanded", "true"); });
    var first = menu.querySelector("nav a");
    if (first) first.focus();
  }
  function closeMenu() {
    if (!menu || !menu.classList.contains("is-open")) return;
    menu.classList.remove("is-open");
    menu.setAttribute("aria-hidden", "true");
    document.body.classList.remove("menu-open");
    openers.forEach(function (b) { b.setAttribute("aria-expanded", "false"); });
    if (lastFocus) lastFocus.focus();
  }
  openers.forEach(function (b) { b.addEventListener("click", openMenu); });
  closers.forEach(function (b) { b.addEventListener("click", closeMenu); });
  if (menu) {
    menu.querySelectorAll("nav a").forEach(function (a) { a.addEventListener("click", closeMenu); });
  }
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeMenu(); });

  /* Apparition au défilement */
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("is-in"); });
  }

  /* Ancres de la page prestations : état actif */
  var anchorLinks = document.querySelectorAll(".anchors a");
  if (anchorLinks.length && "IntersectionObserver" in window) {
    var map = {};
    anchorLinks.forEach(function (a) { map[a.getAttribute("href").slice(1)] = a; });
    var aio = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        anchorLinks.forEach(function (a) { a.classList.remove("is-active"); });
        var link = map[entry.target.id];
        if (link) {
          link.classList.add("is-active");
          link.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
        }
      });
    }, { rootMargin: "-40% 0px -55% 0px" });
    Object.keys(map).forEach(function (id) {
      var s = document.getElementById(id);
      if (s) aio.observe(s);
    });
  }

  /* Année du pied de page */
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  /* Accueil : aperçu photo qui suit le curseur sur la liste des prestations */
  var preview = document.querySelector(".svc-preview");
  if (preview && window.matchMedia("(hover: hover) and (min-width: 1024px)").matches) {
    var pimg = preview.querySelector("img");
    var tx = 0, ty = 0, cx = 0, cy = 0, raf = null;
    function follow() {
      cx += (tx - cx) * 0.18;
      cy += (ty - cy) * 0.18;
      preview.style.transform = "translate3d(" + (cx + 40) + "px," + (cy - 105) + "px,0)";
      raf = Math.abs(tx - cx) + Math.abs(ty - cy) > 0.5 ? requestAnimationFrame(follow) : null;
    }
    document.querySelectorAll(".svc-row").forEach(function (row) {
      row.addEventListener("mouseenter", function (e) {
        pimg.src = row.getAttribute("data-img");
        if (!preview.classList.contains("is-on")) { cx = tx = e.clientX; cy = ty = e.clientY; }
        preview.classList.add("is-on");
        if (!raf) raf = requestAnimationFrame(follow);
      });
      row.addEventListener("mousemove", function (e) {
        tx = e.clientX; ty = e.clientY;
        if (!raf) raf = requestAnimationFrame(follow);
      });
      row.addEventListener("mouseleave", function () { preview.classList.remove("is-on"); });
    });
  }

  /* Accueil : film de présentation (format vertical sur mobile, lecture à l'écran) */
  var film = document.querySelector(".film");
  if (film) {
    var video = film.querySelector("video");
    var portrait = window.matchMedia("(max-width: 767px)").matches;
    var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var userPaused = false;
    var toggleBtn = film.querySelector("[data-film-toggle]");
    if (portrait) video.poster = video.getAttribute("data-poster-portrait");

    function load() {
      if (!video.getAttribute("src")) {
        video.src = video.getAttribute(portrait ? "data-src-portrait" : "data-src-landscape");
      }
    }
    function play() {
      load();
      var p = video.play();
      if (p && p.catch) p.catch(function () {});
    }
    var soundBtn = film.querySelector("[data-film-sound]");
    function setSound(on) {
      video.muted = !on;
      soundBtn.setAttribute("aria-pressed", on ? "true" : "false");
      soundBtn.querySelector("use").setAttribute("href", on ? "#i-sound-on" : "#i-sound-off");
      soundBtn.querySelector("span").textContent = on ? "Couper le son" : "Activer le son";
    }
    soundBtn.addEventListener("click", function () {
      setSound(video.muted);
      if (video.paused) { userPaused = false; play(); }
    });

    function setIcon(paused) {
      toggleBtn.setAttribute("aria-label", paused ? "Lire la vidéo" : "Mettre en pause");
      toggleBtn.querySelector("use").setAttribute("href", paused ? "#i-play" : "#i-pause");
    }
    video.addEventListener("play", function () { film.classList.add("is-playing", "is-started"); setIcon(false); });
    video.addEventListener("pause", function () { film.classList.remove("is-playing"); setIcon(true); });

    // Un clic explicite sur « lire » ou « plein écran » lance la vidéo avec le son
    film.querySelector(".film__play").addEventListener("click", function () { userPaused = false; setSound(true); play(); });
    video.addEventListener("click", function () {
      if (video.paused) { userPaused = false; play(); } else { userPaused = true; video.pause(); }
    });
    toggleBtn.addEventListener("click", function () {
      if (video.paused) { userPaused = false; play(); } else { userPaused = true; video.pause(); }
    });
    film.querySelector("[data-film-full]").addEventListener("click", function () {
      load();
      if (video.requestFullscreen) video.requestFullscreen();
      else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen();
      setSound(true);
      play();
    });

    // Lecture automatique (sans son) quand le film est à l'écran, pause sinon
    if (!reduced && "IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting && !userPaused) play();
          else if (!entry.isIntersecting && !video.paused) video.pause();
        });
      }, { threshold: 0.45 }).observe(video);
    }
  }

  /* ---------- Formulaire de devis ---------- */
  var form = document.getElementById("devis-form");
  if (!form) return;

  var steps = Array.prototype.slice.call(form.querySelectorAll(".form-step"));
  var bar = document.querySelector(".progress__bar i");
  var stepLabel = document.querySelector("[data-step-label]");
  var stepName = document.querySelector("[data-step-name]");
  var alertBox = form.querySelector(".form-alert");
  var current = 0;

  // Pré-remplissage depuis l'URL (?locaux=bureaux&prestation=decapage-sol)
  var params = new URLSearchParams(window.location.search);
  var locaux = params.get("locaux");
  if (locaux) {
    var r = form.querySelector('input[name="locaux"][value="' + CSS.escape(locaux) + '"]');
    if (r) r.checked = true;
  }
  var presta = params.get("prestation");
  if (presta) {
    var c = form.querySelector('input[name="prestations[]"][value="' + CSS.escape(presta) + '"]');
    if (c) c.checked = true;
  }

  function showStep(i) {
    steps.forEach(function (s, n) { s.hidden = n !== i; });
    current = i;
    if (bar) bar.style.width = ((i + 1) / steps.length) * 100 + "%";
    if (stepLabel) stepLabel.textContent = "Étape " + (i + 1) + " sur " + steps.length;
    if (stepName) stepName.textContent = steps[i].getAttribute("data-name") || "";
  }

  function fieldOf(el) { return el.closest(".field"); }

  function validateStep(step) {
    var ok = true;
    var firstBad = null;
    step.querySelectorAll(".field").forEach(function (f) { f.classList.remove("is-invalid"); });

    // Groupes de boutons radio obligatoires
    var groups = {};
    step.querySelectorAll('input[type="radio"][required]').forEach(function (r) { groups[r.name] = true; });
    Object.keys(groups).forEach(function (name) {
      if (!step.querySelector('input[name="' + name + '"]:checked')) {
        var f = fieldOf(step.querySelector('input[name="' + name + '"]'));
        if (f) f.classList.add("is-invalid");
        ok = false;
        firstBad = firstBad || f;
      }
    });

    step.querySelectorAll("input:not([type=radio]):not([type=checkbox]), select, textarea, input[type=checkbox][required]").forEach(function (el) {
      if (el.closest(".hp")) return;
      if (!el.checkValidity()) {
        var f = fieldOf(el);
        if (f) f.classList.add("is-invalid");
        ok = false;
        firstBad = firstBad || f || el;
      }
    });

    if (firstBad) {
      firstBad.scrollIntoView({ behavior: "smooth", block: "center" });
      var focusable = firstBad.querySelector("input, select, textarea");
      if (focusable) setTimeout(function () { focusable.focus({ preventScroll: true }); }, 300);
    }
    return ok;
  }

  // Retire l'erreur dès que l'utilisateur corrige
  form.addEventListener("input", function (e) {
    var f = fieldOf(e.target);
    if (f && f.classList.contains("is-invalid")) {
      var inputs = f.querySelectorAll("input, select, textarea");
      var valid = Array.prototype.every.call(inputs, function (el) { return el.type === "radio" ? true : el.checkValidity(); });
      if (f.querySelector('input[type="radio"]')) valid = !!f.querySelector('input[type="radio"]:checked');
      if (valid) f.classList.remove("is-invalid");
    }
  });

  var card = form.closest(".form-card");

  function scrollToForm() {
    var top = card.getBoundingClientRect().top + window.scrollY - (header ? header.offsetHeight : 0) - 16;
    if (window.scrollY > top) window.scrollTo({ top: top, behavior: "smooth" });
  }

  form.querySelectorAll("[data-next]").forEach(function (b) {
    b.addEventListener("click", function () {
      if (!validateStep(steps[current])) return;
      showStep(current + 1);
      scrollToForm();
    });
  });
  form.querySelectorAll("[data-prev]").forEach(function (b) {
    b.addEventListener("click", function () { showStep(current - 1); scrollToForm(); });
  });

  // Entrée dans un champ texte : passe à l'étape suivante au lieu d'envoyer
  form.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && e.target.tagName === "INPUT" && current < steps.length - 1) {
      e.preventDefault();
      var next = steps[current].querySelector("[data-next]");
      if (next) next.click();
    }
  });

  function summary() {
    var data = new FormData(form);
    var lines = [];
    var labels = {
      locaux: "Locaux", "prestations[]": "Prestations", surface: "Surface", frequence: "Fréquence",
      cp: "Code postal", ville: "Ville", date: "Démarrage souhaité", visite: "Visite technique souhaitée", visite_dispo: "Disponibilités visite", message: "Message",
      nom: "Nom", societe: "Société", tel: "Téléphone", email: "E-mail", rappel: "Rappel"
    };
    var grouped = {};
    data.forEach(function (v, k) {
      if (!labels[k] || !v) return;
      grouped[k] = grouped[k] ? grouped[k] + ", " + v : v;
    });
    Object.keys(grouped).forEach(function (k) { lines.push(labels[k] + " : " + grouped[k]); });
    return lines.join("\n");
  }

  function showError() {
    var mail = form.getAttribute("data-mail");
    var href = "mailto:" + mail + "?subject=" + encodeURIComponent("Demande de devis") + "&body=" + encodeURIComponent(summary());
    alertBox.innerHTML = "L'envoi n'a pas abouti. Vous pouvez <a href=\"" + href + "\">nous écrire directement</a> (votre demande est déjà rédigée) ou nous appeler au <a href=\"tel:+33612345678\">06 12 34 56 78</a>.";
    alertBox.classList.add("is-visible");
    alertBox.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    alertBox.classList.remove("is-visible");
    // Vérifie toutes les étapes, et revient sur la première incomplète
    for (var i = 0; i < steps.length; i++) {
      steps[i].hidden = false;
      var ok = validateStep(steps[i]);
      steps[i].hidden = i !== current;
      if (!ok) { showStep(i); validateStep(steps[i]); return; }
    }

    var btn = form.querySelector('button[type="submit"]');
    btn.classList.add("is-loading");
    btn.querySelector("span").textContent = "Envoi en cours…";

    var payload = {};
    new FormData(form).forEach(function (v, k) {
      if (k.slice(-2) === "[]") (payload[k.slice(0, -2)] = payload[k.slice(0, -2)] || []).push(v);
      else payload[k] = v;
    });

    fetch(form.getAttribute("action"), {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json", "Accept": "application/json" }
    })
      .then(function (res) { return res.json().then(function (j) { return { ok: res.ok, body: j }; }); })
      .then(function (r) {
        if (!r.ok || !r.body.ok) throw new Error("send");
        var tpl = document.getElementById("form-success");
        card.innerHTML = "";
        card.appendChild(tpl.content.cloneNode(true));
        scrollToForm();
        card.querySelector(".form-success").focus({ preventScroll: true });
      })
      .catch(function () {
        btn.classList.remove("is-loading");
        btn.querySelector("span").textContent = "Envoyer ma demande";
        showError();
      });
  });

  showStep(0);
  form.classList.add("is-ready");
  if (params.get("erreur")) showError();
})();
