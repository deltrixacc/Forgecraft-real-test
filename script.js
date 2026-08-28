/* ============================================================
   FORGECRAFT v2 — interactions
   ============================================================ */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var easeOut = function (t) { return 1 - Math.pow(1 - t, 3); };

  /* ---------- hero particle canvas ---------- */
  var heroCanvas = document.getElementById("heroParticles");
  if (heroCanvas && !reduceMotion) {
    var hctx = heroCanvas.getContext("2d");
    var particles = [];

    function resizeCanvas() {
      var hero = heroCanvas.parentElement;
      heroCanvas.width  = hero ? hero.offsetWidth  : heroCanvas.offsetWidth;
      heroCanvas.height = hero ? hero.offsetHeight : heroCanvas.offsetHeight;
    }

    function initParticles() {
      particles = [];
      var w = heroCanvas.width, h = heroCanvas.height;
      var count = Math.min(300, Math.max(120, Math.floor(w * h / 3500)));
      for (var i = 0; i < count; i++) {
        var isBlue = Math.random() > 0.3;
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.28,
          vy: -(Math.random() * 0.22 + 0.06),
          r: Math.random() * 2.5 + 1.2,
          baseAlpha: Math.random() * 0.4 + 0.45,
          pulseSpeed: Math.random() * 0.007 + 0.002,
          pulseOffset: Math.random() * Math.PI * 2,
          blue: isBlue
        });
      }
    }

    function start() {
      resizeCanvas();
      initParticles();
      animParticles();
    }

    var ptRaf, ptTick = 0;
    function animParticles() {
      hctx.clearRect(0, 0, heroCanvas.width, heroCanvas.height);
      ptTick++;
      var w = heroCanvas.width, h = heroCanvas.height;

      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -8) { p.y = h + 8; p.x = Math.random() * w; }
        if (p.x < -8) p.x = w + 8;
        if (p.x > w + 8) p.x = -8;

        /* hide particles that are inside the monitor (bezel + screen + stand) */
        if (monitorPoly && pointInPoly(p.x, p.y, monitorPoly)) continue;

        var pulse = (Math.sin(ptTick * p.pulseSpeed + p.pulseOffset) + 1) * 0.5;
        var alpha = p.baseAlpha * (0.4 + pulse * 0.6);
        var ex = Math.min(p.x / 60, (w - p.x) / 60, 1);
        var ey = Math.min(p.y / 60, (h - p.y) / 60, 1);
        alpha *= Math.min(ex, ey, 1);
        if (alpha < 0.01) continue;

        hctx.save();
        hctx.globalAlpha = alpha;
        if (p.blue) {
          hctx.shadowColor = "#4FA8DE";
          hctx.fillStyle = "#4FA8DE";
        } else {
          hctx.shadowColor = "rgba(255,255,255,0.9)";
          hctx.fillStyle = "#fff";
        }
        hctx.shadowBlur = p.r * 20;
        hctx.beginPath();
        hctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        hctx.fill();
        hctx.restore();
      }
      ptRaf = requestAnimationFrame(animParticles);
    }

    /* defer one frame so aspect-ratio hero is fully laid out */
    requestAnimationFrame(function () { requestAnimationFrame(start); });

    var resizeTimer;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        cancelAnimationFrame(ptRaf);
        resizeCanvas();
        initParticles();
        animParticles();
      }, 160);
    }, { passive: true });
  }

  /* ---------- intro: rise in ---------- */
  if (reduceMotion) {
    document.body.classList.add("loaded");
  } else {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        document.body.classList.add("loaded");
      });
    });
  }

  /* ---------- marquee: duplicate content for seamless loop ---------- */
  var track = document.getElementById("marqueeTrack");
  if (track && !reduceMotion) {
    track.innerHTML += track.innerHTML;
  }

  /* ---------- dock menu ---------- */
  var burger = document.getElementById("dockBurger");
  var overlay = document.getElementById("menuOverlay");
  function closeMenu() {
    overlay.classList.remove("open");
    burger.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  }
  burger.addEventListener("click", function () {
    var open = overlay.classList.toggle("open");
    burger.setAttribute("aria-expanded", open ? "true" : "false");
    document.body.style.overflow = open ? "hidden" : "";
  });
  var overlayLinks = overlay.querySelectorAll("a");
  for (var oi = 0; oi < overlayLinks.length; oi++) {
    overlayLinks[oi].addEventListener("click", closeMenu);
  }
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && overlay.classList.contains("open")) closeMenu();
  });

  /* ---------- scroll-down button ---------- */
  var scrollDown = document.getElementById("scrollDown");
  if (scrollDown) {
    scrollDown.addEventListener("click", function () {
      document.getElementById("configurator").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
    });
  }

  /* ---------- reveal on scroll ----------
     .reveal starts at opacity:0, so a failure here would leave the page blank.
     Fall back to showing everything if IntersectionObserver is missing or throws. */
  var revealTargets = document.querySelectorAll(".reveal");
  function revealAll() {
    for (var i = 0; i < revealTargets.length; i++) revealTargets[i].classList.add("in");
  }
  if (!("IntersectionObserver" in window)) {
    revealAll();
  } else {
    try {
      var revealObserver = new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].isIntersecting) {
            entries[i].target.classList.add("in");
            revealObserver.unobserve(entries[i].target);
          }
        }
      }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
      for (var ri = 0; ri < revealTargets.length; ri++) revealObserver.observe(revealTargets[ri]);
    } catch (revErr) {
      revealAll();
    }
  }

  /* ---------- process timeline ---------- */
  var procTimeline = document.getElementById("procTimeline");
  if (procTimeline) {
    var procObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          procObserver.unobserve(e.target);
        }
      });
    }, { threshold: 0.05, rootMargin: "0px 0px -60px 0px" });
    if (reduceMotion || !("IntersectionObserver" in window)) {
      procTimeline.classList.add("in");
    } else {
      try { procObserver.observe(procTimeline); }
      catch (procErr) { procTimeline.classList.add("in"); }
    }
  }

  /* ---------- process stage accordion ---------- */
  document.querySelectorAll(".proc-item").forEach(function (item) {
    var btn = item.querySelector(".proc-toggle");
    var wrap = item.querySelector(".proc-points-wrap");
    if (!btn || !wrap) return;

    function setOpen(open) {
      var start = wrap.scrollHeight;
      item.classList.toggle("open", open);
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      if (reduceMotion) { wrap.style.maxHeight = ""; return; }
      wrap.style.maxHeight = "none";
      var end = wrap.scrollHeight;
      wrap.style.maxHeight = start + "px";
      void wrap.offsetHeight;
      wrap.style.maxHeight = end + "px";
    }

    wrap.addEventListener("transitionend", function (e) {
      if (e.propertyName !== "max-height") return;
      wrap.style.maxHeight = item.classList.contains("open") ? "none" : "";
    });

    item.addEventListener("click", function (e) {
      if (e.target.closest("a")) return;
      if (window.getSelection && String(window.getSelection())) return;
      setOpen(!item.classList.contains("open"));
    });
    btn.addEventListener("click", function (e) { e.stopPropagation(); setOpen(!item.classList.contains("open")); });
  });

  /* ---------- FAQ: animated open/close ---------- */
  document.querySelectorAll(".faq-item").forEach(function (item) {
    var summary = item.querySelector("summary");
    var body = item.querySelector(".faq-body");
    summary.addEventListener("click", function (e) {
      if (reduceMotion) return; // native behavior
      e.preventDefault();
      if (item.open) {
        body.style.height = body.scrollHeight + "px";
        requestAnimationFrame(function () {
          body.style.transition = "height 0.45s cubic-bezier(0.22,1,0.36,1)";
          body.style.height = "0px";
        });
        body.addEventListener("transitionend", function h() {
          item.open = false;
          body.style.cssText = "";
          body.removeEventListener("transitionend", h);
        });
      } else {
        item.open = true;
        var target = body.scrollHeight;
        body.style.height = "0px";
        requestAnimationFrame(function () {
          body.style.transition = "height 0.5s cubic-bezier(0.22,1,0.36,1)";
          body.style.height = target + "px";
        });
        body.addEventListener("transitionend", function h() {
          body.style.cssText = "";
          body.removeEventListener("transitionend", h);
        });
      }
    });
  });

  /* ---------- website configurator: live estimate ---------- */
  var cfgForm = document.getElementById("cfgForm");
  if (cfgForm) {
    var cfgSummary = document.getElementById("cfgSummary");
    var cfgWeeks = document.getElementById("cfgWeeks");
    var cfgPrice = document.getElementById("cfgPrice");
    var euro = function (n) { return "€" + n.toLocaleString("en-US"); };
    var round100 = function (n) { return Math.round(n / 100) * 100; };
    function updateCfg() {
      var checked = cfgForm.querySelectorAll("input:checked");
      var base = 0, mult = 1, weeks = "6–8 weeks", items = [];
      Array.prototype.forEach.call(checked, function (inp) {
        if (inp.dataset.price) base += parseInt(inp.dataset.price, 10);
        if (inp.dataset.mult) { mult = parseFloat(inp.dataset.mult); weeks = inp.dataset.weeks || weeks; }
        if (inp.dataset.label) items.push(inp.dataset.label);
      });
      var total = base * mult;
      var low = round100(total), high = round100(total * 1.18);
      cfgSummary.innerHTML = items.map(function (t) { return "<li>" + t + "</li>"; }).join("");
      cfgWeeks.textContent = weeks;
      cfgPrice.innerHTML = euro(low) + '<span class="to">–</span>' + euro(high);
      cfgPrice.classList.remove("pulse"); void cfgPrice.offsetWidth; cfgPrice.classList.add("pulse");
    }
    cfgForm.addEventListener("change", updateCfg);
    updateCfg();
  }

  /* ---------- live site viewer: click the monitor to open Autohaus Pufahl ---------- */
  // Deployed Autohaus Pufahl site — shown inside the monitor viewer on desktop,
  // and opened directly as a link on mobile.
  var SITES = [
    { url: "https://deltrixacc.github.io/Autohaus-Pufahl/",
      name: "Autohaus Pufahl", kind: "Car dealership · Lengerich" },
    { url: "volta/index.html",
      name: "Volta", kind: "Shopify storefront · RFID wallets" }
  ];
  var siteIndex = 0;
  // On small screens we skip the monitor mockup and just open the site.
  var viewerMobileMQ = window.matchMedia("(max-width: 820px)");
  var hotspot      = document.getElementById("screenHotspot");
  var hint         = document.getElementById("screenHotspotHint");
  var viewer       = document.getElementById("siteViewer");
  var viewFrame    = document.getElementById("siteViewerFrame");
  var viewClose    = document.getElementById("siteViewerClose");
  var viewPrev     = document.getElementById("siteViewerPrev");
  var viewNext     = document.getElementById("siteViewerNext");
  var viewName     = document.getElementById("siteViewerName");
  var viewKind     = document.getElementById("siteViewerKind");
  var viewDots     = document.getElementById("siteViewerDots");

  // Per-viewport layouts. Each hero image has its own pixel size and monitor-screen
  // quad (TL, TR, BR, BL). The active one is chosen by the same aspect-ratio
  // media queries used in the CSS.
  var LAYOUTS = [
    { mq: window.matchMedia("(min-aspect-ratio: 2 / 1)"),  // ultrawide
      w: 3828, h: 1644, posY: 0.65, quad: [[1864,363],[3257,281],[3257,1179],[1864,1147]] },
    { mq: window.matchMedia("(max-aspect-ratio: 11 / 10)"), // portrait / phone (image is 2x = 1706x3036)
      w: 1706, h: 3036, quad: [[532,1334],[1602,1302],[1592,1994],[516,1958]] },
    { mq: null,                                             // default: 16:9 desktop (image is 2x = 3344x1882)
      w: 3344, h: 1882, quad: [[1510,448],[2858,378],[2858,1250],[1508,1220]] }
  ];
  function activeLayout() {
    for (var i = 0; i < LAYOUTS.length; i++) {
      if (LAYOUTS[i].mq && LAYOUTS[i].mq.matches) return LAYOUTS[i];
    }
    return LAYOUTS[LAYOUTS.length - 1];
  }

  // scale the fixed-size hero stage (1600x687) to the current hero width so all
  // overlaid content keeps the same proportions on any device
  /* polygon for particle masking: the full monitor (bezel + screen + stand) */
  var monitorPoly = null;

  function pointInPoly(x, y, poly) {
    var inside = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }

  var HERO_STAGE_W = 1600;
  var portraitMQ = window.matchMedia("(max-aspect-ratio: 11 / 10)");
  function scaleHeroStage() {
    var hero = document.getElementById("hero");
    // cap at 1 so overlaid text never grows past its original size; below the
    // reference width it scales down. Tall/narrow (portrait) screens use a
    // smaller reference so the text stays readable in the taller hero.
    if (hero && hero.clientWidth) {
      var ref = portraitMQ.matches ? 820 : HERO_STAGE_W;
      hero.style.setProperty("--hero-scale", Math.min(1, hero.clientWidth / ref).toFixed(4));
    }
  }

  /* Keep the hero headline clear of the monitor. The title lives in the empty
     wall area to the left of the screen, so instead of guessing per breakpoint we
     derive its box from where the monitor actually landed: the available width is
     everything up to the bezel minus a gap, and if the longest line still doesn't
     fit at its CSS size the font-size is scaled down to match. */
  var heroTitle = document.querySelector(".hero-title");
  function fitHeroTitle(screenLeft, screenW, screenTop, screenH) {
    if (!heroTitle) return;
    var hero = document.getElementById("hero");
    if (!hero || !hero.clientWidth) return;

    // Portrait: the title sits in the wall band between the nav dock and the
    // top of the monitor. Fit it to that band rather than trusting a fixed
    // percentage - a fixed top clipped the first line off the hero on every
    // phone size, and a tall band would otherwise let the type reach the screen.
    // Portrait: the title sits in the wall band between the nav dock and the
    // top of the monitor. Fit it to that band rather than trusting a fixed
    // percentage - a fixed top clipped the first line off the hero on every
    // phone size, and a tall band would otherwise let the type reach the screen.
    if (portraitMQ.matches) {
      heroTitle.style.removeProperty("left");
      heroTitle.style.removeProperty("max-width");
      heroTitle.style.removeProperty("font-size");
      heroTitle.style.removeProperty("top");
      if (screenTop == null) return;

      var hRect = hero.getBoundingClientRect();
      var heroH = hero.clientHeight;
      // the dock casts a 14px-offset, 40px-blur shadow, so its visual
      // footprint reaches well past its box - clear that too
      var vGap = Math.max(26, heroH * 0.035);

      // clear the floating dock, which overlays the top of the hero
      var dock = document.querySelector(".dock");
      var dockBottom = 0;
      if (dock) {
        var dRect = dock.getBoundingClientRect();
        if (dRect.height) dockBottom = dRect.bottom - hRect.top;
      }

      var bandTop = Math.max(dockBottom + vGap, heroH * 0.05);
      var bandBottom = screenTop - vGap;
      var band = bandBottom - bandTop;
      if (band <= 0) return;

      heroTitle.style.top = bandTop.toFixed(1) + "px";

      // shrink until the block fits the band; two passes settle the reflow
      var baseFs = parseFloat(getComputedStyle(heroTitle).fontSize) || 16;
      for (var pass = 0; pass < 2; pass++) {
        var natural = heroTitle.offsetHeight;
        if (natural <= band) break;
        var next = Math.max(18, parseFloat(getComputedStyle(heroTitle).fontSize) * (band / natural));
        heroTitle.style.fontSize = next.toFixed(2) + "px";
      }
      if (parseFloat(getComputedStyle(heroTitle).fontSize) > baseFs) {
        heroTitle.style.removeProperty("font-size");
      }
      return;
    }

    // read the placement the stylesheet wants, with our overrides off
    heroTitle.style.removeProperty("left");
    heroTitle.style.removeProperty("font-size");
    var baseLeft = heroTitle.offsetLeft;
    var baseFs   = parseFloat(getComputedStyle(heroTitle).fontSize) || 16;

    // measure the widest line unwrapped, so the shrink factor is exact
    var lines = heroTitle.querySelectorAll(".ht-line");
    var prevMax = heroTitle.style.maxWidth;
    heroTitle.style.maxWidth = "none";
    heroTitle.style.whiteSpace = "nowrap";
    var widest = 0;
    for (var i = 0; i < lines.length; i++) {
      widest = Math.max(widest, lines[i].scrollWidth);
    }
    heroTitle.style.whiteSpace = "";
    heroTitle.style.maxWidth = prevMax;

    // rightmost x the headline may occupy: clear the bezel, not just the lit
    // screen, then leave a breathing gap
    var limit = screenLeft - screenW * 0.035 - Math.max(24, hero.clientWidth * 0.035);

    // slide left into the empty wall first; only shrink the type once that runs out
    var left  = baseLeft;
    var avail = limit - left;
    if (widest > avail) {
      left  = Math.max(hero.clientWidth * 0.045, limit - widest);
      avail = Math.max(140, limit - left);
    }

    heroTitle.style.left = left.toFixed(1) + "px";
    heroTitle.style.maxWidth = avail.toFixed(1) + "px";
    if (widest > avail && widest > 0) {
      heroTitle.style.fontSize = (baseFs * (avail / widest)).toFixed(2) + "px";
    }

    // A short, wide window makes the block taller than the hero once it wraps.
    // Pull it back inside so the first line is never clipped by the hero edge.
    var hH = hero.clientHeight;
    var tH = heroTitle.offsetHeight;
    if (tH > hH * 0.92) {
      var fs = parseFloat(getComputedStyle(heroTitle).fontSize) || baseFs;
      heroTitle.style.fontSize = Math.max(18, fs * (hH * 0.92 / tH)).toFixed(2) + "px";
      tH = heroTitle.offsetHeight;
    }
    var half = tH / 2;                       // transform is translateY(-50%)
    var centre = heroTitle.offsetTop;

    // The dock floats over the top of the hero. Only give it clearance when the
    // headline actually runs under it horizontally - on a wide screen the title
    // sits well left of the dock and should not be pushed down for nothing.
    var topGuard = hH * 0.02;
    var dockEl = document.querySelector(".dock");
    if (dockEl) {
      var dRect = dockEl.getBoundingClientRect();
      var hRect = hero.getBoundingClientRect();
      var tLeft = left, tRight = left + Math.min(widest, avail);
      var dLeft = dRect.left - hRect.left, dRight = dRect.right - hRect.left;
      var sharesColumn = tRight > dLeft && tLeft < dRight;
      if (dRect.height && sharesColumn) {
        topGuard = Math.max(topGuard, (dRect.bottom - hRect.top) + 14);
      }
    }

    var minC = half + topGuard;
    var maxC = hH - half - hH * 0.02;
    if (maxC > minC) {
      var clamped = Math.min(Math.max(centre, minC), maxC);
      if (Math.abs(clamped - centre) > 0.5) heroTitle.style.top = clamped.toFixed(1) + "px";
    }
  }

  function positionHotspot() {
    scaleHeroStage();
    if (!hotspot) return;
    var L = activeLayout();
    var hero = document.getElementById("hero");
    var photo = hero.querySelector(".hero-photo");
    var w = photo.offsetWidth, h = photo.offsetHeight;
    var offX = photo.offsetLeft, offY = photo.offsetTop;
    // background-size: cover. The vertical anchor must match .hero-photo's
    // background-position in styles.css: the ultrawide image is anchored at
    // `center 65%`, every other breakpoint at `center`. Using 50% here shifted
    // the whole overlay down by (dh - h) * 0.15 on ultrawide screens.
    var scale = Math.max(w / L.w, h / L.h);
    var dw = L.w * scale, dh = L.h * scale;
    var posY = (L.posY == null) ? 0.5 : L.posY;
    var ox = offX + (w - dw) * 0.5, oy = offY + (h - dh) * posY;
    var pts = L.quad.map(function (p) { return [ox + p[0] * scale, oy + p[1] * scale]; });
    var xs = pts.map(function (p) { return p[0]; });
    var ys = pts.map(function (p) { return p[1]; });
    var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
    var minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
    var bw = maxX - minX, bh = maxY - minY;

    /* build expanded monitor polygon: bezel (1.28×) + stand extension below */
    (function () {
      var cx = (pts[0][0] + pts[1][0] + pts[2][0] + pts[3][0]) / 4;
      var cy = (pts[0][1] + pts[1][1] + pts[2][1] + pts[3][1]) / 4;
      var bf = 1.28, standY = bh * 0.5;
      var exp = pts.map(function (p) {
        return [cx + (p[0] - cx) * bf, cy + (p[1] - cy) * bf];
      });
      /* extend bottom-right and bottom-left further down for the stand */
      exp[2] = [exp[2][0], exp[2][1] + standY];
      exp[3] = [exp[3][0], exp[3][1] + standY];
      monitorPoly = exp;
    }());

    hotspot.style.left = minX + "px";
    hotspot.style.top = minY + "px";
    hotspot.style.width = bw + "px";
    hotspot.style.height = bh + "px";
    hotspot.style.clipPath = "polygon(" + pts.map(function (p) {
      return ((p[0] - minX) / bw * 100).toFixed(2) + "% " + ((p[1] - minY) / bh * 100).toFixed(2) + "%";
    }).join(", ") + ")";
    if (hint) {
      // anchor the tab to the top-center edge of the screen itself, with a
      // small lift so its pointer nub tucks against the top bezel
      var topMidX = (pts[0][0] + pts[1][0]) / 2;
      var topMidY = (pts[0][1] + pts[1][1]) / 2;
      hint.style.left = topMidX + "px";
      hint.style.top = (topMidY - bh * 0.055) + "px";
    }

    fitHeroTitle(minX, bw, minY, bh);

  }

  // swap the site shown inside the monitor; wraps around at both ends
  function showSite(i) {
    siteIndex = (i + SITES.length) % SITES.length;
    var site = SITES[siteIndex];
    if (viewFrame) {
      viewFrame.setAttribute("src", site.url);
      viewFrame.setAttribute("title", site.name + " website");
    }
    if (viewName) viewName.textContent = site.name;
    if (viewKind) viewKind.textContent = site.kind;
    if (viewDots) {
      viewDots.innerHTML = SITES.map(function (s, n) {
        return '<i class="sv-dot' + (n === siteIndex ? " on" : "") + '"></i>';
      }).join("");
    }
  }

  function openViewer() {
    // on mobile, skip the monitor mockup and just open the live site
    if (viewerMobileMQ.matches) {
      window.open(SITES[siteIndex].url, "_blank", "noopener");
      return;
    }
    if (!viewer) return;
    if (!viewFrame.getAttribute("src")) showSite(siteIndex);
    viewer.classList.add("open");
    viewer.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }
  function closeViewer() {
    if (!viewer) return;
    viewer.classList.remove("open");
    viewer.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  if (hotspot) {
    positionHotspot();
    window.addEventListener("load", positionHotspot);
    // the shrink factor is measured from rendered text, so redo it once the
    // display webfont has actually swapped in
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(positionHotspot);
    }
    window.addEventListener("resize", positionHotspot, { passive: true });
    // ResizeObserver keeps the hotspot locked to the monitor once layout/fonts settle
    if (window.ResizeObserver) {
      new ResizeObserver(positionHotspot).observe(document.getElementById("hero"));
    }
    hotspot.addEventListener("click", openViewer);
    hotspot.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openViewer(); }
    });
  }
  if (hint) {
    // the hint now sits on the desk as its own button, independent of the screen hotspot
    hint.addEventListener("click", openViewer);
    hint.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openViewer(); }
    });
  }
  if (viewClose) viewClose.addEventListener("click", closeViewer);
  if (viewPrev) viewPrev.addEventListener("click", function () { showSite(siteIndex - 1); });
  if (viewNext) viewNext.addEventListener("click", function () { showSite(siteIndex + 1); });
  if (viewer) viewer.addEventListener("click", function (e) {
    if (e.target.hasAttribute("data-close")) closeViewer();
  });
  document.addEventListener("keydown", function (e) {
    if (!viewer || !viewer.classList.contains("open")) return;
    if (e.key === "Escape") closeViewer();
    if (e.key === "ArrowLeft") showSite(siteIndex - 1);
    if (e.key === "ArrowRight") showSite(siteIndex + 1);
  });
  // deep link: /#live opens the monitor preview straight away (desktop only)
  if (viewer && location.hash === "#live" && !viewerMobileMQ.matches) {
    requestAnimationFrame(openViewer);
  }

})();
