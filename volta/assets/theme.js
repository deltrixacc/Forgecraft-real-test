/* ==========================================================================
   VOLTA theme behaviour
   --------------------------------------------------------------------------
   Vanilla ES2019, no build step, no framework. Every module maps onto a
   Shopify equivalent (cart AJAX API, section rendering, predictive search),
   noted in comments where the mapping is not obvious.
   Scroll work uses IntersectionObserver only. No scroll event listeners.
   ========================================================================== */
(function () {
  'use strict';

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- storage ------------------------------------------- */
  var Store = {
    read: function (k, fb) {
      try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; }
      catch (e) { return fb; }
    },
    write: function (k, v) {
      try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ }
    }
  };

  /* Shopify equivalent: /cart/add.js, /cart/change.js, /cart.js */
  var Cart = {
    key: 'volta.cart',
    items: Store.read('volta.cart', []),
    save: function () { Store.write(this.key, this.items); emit(); },
    id: function (h, c, f) { return h + '::' + c + '::' + f; },
    add: function (handle, colour, finish, qty) {
      var id = this.id(handle, colour, finish);
      var found = null;
      for (var i = 0; i < this.items.length; i++) { if (this.items[i].id === id) { found = this.items[i]; break; } }
      if (found) { found.qty = Math.min(20, found.qty + qty); }
      else { this.items.push({ id: id, handle: handle, colour: colour, finish: finish, qty: qty }); }
      this.save();
    },
    setQty: function (id, qty) {
      for (var i = 0; i < this.items.length; i++) {
        if (this.items[i].id === id) {
          if (qty <= 0) { this.items.splice(i, 1); } else { this.items[i].qty = Math.min(20, qty); }
          break;
        }
      }
      this.save();
    },
    remove: function (id) { this.setQty(id, 0); },
    clear: function () { this.items = []; this.save(); },
    count: function () { return this.items.reduce(function (s, i) { return s + i.qty; }, 0); },
    subtotal: function () {
      return this.items.reduce(function (s, i) {
        var p = byHandle(i.handle);
        return s + (p ? p.price * i.qty : 0);
      }, 0);
    }
  };

  /* A cart saved before the range changed can hold a discontinued product, or a
     colourway that no longer exists. Validate the whole variant, not just the
     handle: an unknown colour throws inside the line renderer and blanks the
     entire drawer while the header badge keeps counting. */
  (function pruneCart() {
    var kept = Cart.items.filter(function (i) {
      var p = byHandle(i.handle);
      return p &&
        p.colours.indexOf(i.colour) > -1 &&
        p.finishes.indexOf(i.finish) > -1;
    });
    if (kept.length !== Cart.items.length) {
      Cart.items = kept;
      Store.write(Cart.key, kept);
    }
  })();

  var Wish = {
    key: 'volta.wish',
    items: Store.read('volta.wish', []).filter(function (h) { return !!byHandle(h); }),
    has: function (h) { return this.items.indexOf(h) > -1; },
    toggle: function (h) {
      var i = this.items.indexOf(h);
      if (i > -1) { this.items.splice(i, 1); } else { this.items.push(h); }
      Store.write(this.key, this.items); emit();
      return this.has(h);
    }
  };

  var listeners = [];
  function onChange(fn) { listeners.push(fn); }
  function emit() { listeners.forEach(function (f) { f(); }); }

  /* ---------------- toast ---------------------------------------------- */
  var toaster;
  function toast(msg, linkText, linkHref) {
    if (!toaster) {
      toaster = document.createElement('div');
      toaster.className = 'toaster';
      toaster.setAttribute('role', 'status');
      toaster.setAttribute('aria-live', 'polite');
      document.body.appendChild(toaster);
    }
    var el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = '<i class="ph ph-check-circle" aria-hidden="true"></i><span>' + msg + '</span>' +
      (linkText ? '<a href="' + linkHref + '">' + linkText + '</a>' : '');
    toaster.appendChild(el);
    setTimeout(function () {
      el.style.transition = 'opacity .3s, transform .3s';
      el.style.opacity = '0'; el.style.transform = 'translateY(8px)';
      setTimeout(function () { el.remove(); }, 320);
    }, 3600);
  }

  /* ---------------- focus trap ----------------------------------------- */
  var SEL = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,summary,[tabindex]:not([tabindex="-1"])';
  function trap(panel) {
    function onKey(e) {
      if (e.key !== 'Tab') return;
      var f = $$(SEL, panel).filter(function (n) { return n.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    panel.addEventListener('keydown', onKey);
    return function () { panel.removeEventListener('keydown', onKey); };
  }

  var openLayers = [];
  function openLayer(root, panel, onClose) {
    root.classList.add('is-open');
    root.setAttribute('aria-hidden', 'false');
    document.body.classList.add('is-locked');
    var untrap = trap(panel);
    var prev = document.activeElement;
    var focusable = $$(SEL, panel)[0];
    if (focusable) setTimeout(function () { focusable.focus(); }, 60);
    var layer = {
      close: function () {
        root.classList.remove('is-open');
        root.setAttribute('aria-hidden', 'true');
        untrap();
        openLayers = openLayers.filter(function (l) { return l !== layer; });
        if (!openLayers.length) document.body.classList.remove('is-locked');
        if (prev && prev.focus) prev.focus();
        if (onClose) onClose();
      }
    };
    openLayers.push(layer);
    return layer;
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && openLayers.length) openLayers[openLayers.length - 1].close();
  });

  /* ---------------- shared renderers ----------------------------------- */
  function stars(n) {
    var out = '';
    for (var i = 1; i <= 5; i++) {
      out += '<i class="ph-fill ph-star' + (i <= Math.round(n) ? '' : ' is-off') + '" aria-hidden="true"></i>';
    }
    return out;
  }

  function cardHTML(p) {
    var media = mediaFor(p, p.colours[0]);
    var main = media[0], alt = media[1] || media[0];
    var badge = p.badge ? '<span class="card__badge">' + p.badge + '</span>'
      : (p.isNew ? '<span class="card__badge card__badge--new">New</span>' : '');
    var sw = p.colours.map(function (c) {
      return '<span class="swatch-dot" style="background:' + COLOURS[c].hex + '" title="' + COLOURS[c].name + '"></span>';
    }).join('');
    return '' +
      '<article class="card" data-handle="' + p.handle + '">' +
        '<div class="card__media">' + badge +
          '<img class="card__main" src="' + main.src + '" srcset="' + main.srcset + '" sizes="(max-width:860px) 50vw, 25vw" alt="' + main.alt + '" loading="lazy" width="720" height="900">' +
          '<img class="card__alt" src="' + alt.src + '" alt="" aria-hidden="true" loading="lazy" width="720" height="900">' +
          '<button class="card__wish' + (Wish.has(p.handle) ? ' is-on' : '') + '" type="button" data-wish="' + p.handle + '" aria-pressed="' + Wish.has(p.handle) + '" aria-label="Save ' + p.title + ' to wishlist"><i class="' + (Wish.has(p.handle) ? 'ph-fill' : 'ph') + ' ph-heart" aria-hidden="true"></i></button>' +
          '<button class="card__quick" type="button" data-quickadd="' + p.handle + '">Add to cart</button>' +
        '</div>' +
        '<div class="card__body">' +
          '<h3 class="card__title"><a href="product.html?handle=' + p.handle + '">' + p.title + '</a></h3>' +
          '<div class="card__meta">' +
            '<span class="card__price">' + money(p.price) + '</span>' +
            (p.compareAt ? '<s class="card__was">' + money(p.compareAt) + '</s>' : '') +
            '<span class="rating"><i class="ph-fill ph-star" aria-hidden="true"></i>' + p.rating.toFixed(1) + ' <span class="sr-only">out of 5 from ' + p.reviews + ' reviews</span></span>' +
          '</div>' +
          '<p class="card__sub">' + p.tagline + '</p>' +
          '<div class="card__swatches" aria-hidden="true">' + sw + '</div>' +
        '</div>' +
      '</article>';
  }

  /* One tile per colourway. The range is three wallets but six things you can
     actually buy, and each colourway has its own shot. Shopify equivalent:
     a collection rendered at variant level rather than product level. */
  function variantCardHTML(v) {
    var p = v.product, colour = v.colour;
    var media = mediaFor(p, colour);
    var main = media[0], alt = media[1] || media[0];
    var url = 'product.html?handle=' + p.handle + '&colour=' + colour;
    var out = p.finishes.every(function (f) {
      return p.soldOut.some(function (s) { return s.colour === colour && s.finish === f; });
    });
    var badge = out ? '<span class="card__badge card__badge--out">Sold out</span>'
      : (p.badge ? '<span class="card__badge">' + p.badge + '</span>'
        : (p.isNew ? '<span class="card__badge card__badge--new">New</span>' : ''));
    return '' +
      '<article class="card" data-handle="' + p.handle + '" data-colour="' + colour + '">' +
        '<div class="card__media">' + badge +
          '<img class="card__main" src="' + main.src + '" srcset="' + main.srcset + '" sizes="(max-width:860px) 50vw, 25vw" alt="' + main.alt + '" loading="lazy" width="720" height="900">' +
          '<img class="card__alt" src="' + alt.src + '" alt="" aria-hidden="true" loading="lazy" width="720" height="900">' +
          '<button class="card__wish' + (Wish.has(p.handle) ? ' is-on' : '') + '" type="button" data-wish="' + p.handle + '" aria-pressed="' + Wish.has(p.handle) + '" aria-label="Save ' + p.title + ' to wishlist"><i class="' + (Wish.has(p.handle) ? 'ph-fill' : 'ph') + ' ph-heart" aria-hidden="true"></i></button>' +
          (out ? '' : '<button class="card__quick" type="button" data-quickadd="' + p.handle + '" data-colour="' + colour + '">Add to cart</button>') +
        '</div>' +
        '<div class="card__body">' +
          '<h3 class="card__title"><a href="' + url + '">' + p.title + '</a></h3>' +
          '<p class="card__colour"><span class="swatch-dot" style="background:' + COLOURS[colour].hex + '" aria-hidden="true"></span>' + COLOURS[colour].name + '</p>' +
          '<div class="card__meta">' +
            '<span class="card__price">' + money(p.price) + '</span>' +
            (p.compareAt ? '<s class="card__was">' + money(p.compareAt) + '</s>' : '') +
            '<span class="rating"><i class="ph-fill ph-star" aria-hidden="true"></i>' + p.rating.toFixed(1) + ' <span class="sr-only">out of 5 from ' + p.reviews + ' reviews</span></span>' +
          '</div>' +
          '<p class="card__sub">' + p.tagline + '</p>' +
        '</div>' +
      '</article>';
  }

  function rangeCardHTML(p) {
    var img = mediaFor(p, p.colours[0])[0];
    var badge = p.badge ? '<span class="rcard__badge">' + p.badge + '</span>'
      : (p.isNew ? '<span class="rcard__badge rcard__badge--new">New</span>' : '');
    var sw = p.colours.map(function (c) {
      return '<span class="swatch-dot" style="background:' + COLOURS[c].hex + '" title="' + COLOURS[c].name + '"></span>';
    }).join('');
    return '<div class="rcard" data-handle="' + p.handle + '">' +
      '<div class="rcard__media">' + badge +
        '<img src="' + img.src + '" srcset="' + img.srcset + '" sizes="(max-width:640px) 90vw, 38vw" alt="' + img.alt + '" loading="lazy" width="720" height="900">' +
      '</div>' +
      '<div class="rcard__body">' +
        '<h3 class="rcard__name"><a href="product.html?handle=' + p.handle + '">' + p.title + '</a></h3>' +
        '<p class="rcard__tagline">' + p.tagline + '</p>' +
        '<div class="rcard__foot">' +
          '<div class="rcard__price-line">' +
            '<span class="rcard__price">' + money(p.price) + '</span>' +
            (p.compareAt ? '<s class="rcard__was">' + money(p.compareAt) + '</s>' : '') +
          '</div>' +
          '<div class="rcard__swatches" aria-hidden="true">' + sw + '</div>' +
        '</div>' +
        '<a class="btn btn--primary rcard__cta" href="product.html?handle=' + p.handle + '">Shop now</a>' +
      '</div>' +
    '</div>';
  }

  /* Big alternating rows, one per wallet. Alternates colourway as it goes so
     both Onyx and Navy get shown at size somewhere on the page. */
  function initRangeFeature() {
    var host = $('[data-range-feature]');
    if (!host) return;

    host.innerHTML = PRODUCTS.map(function (p, i) {
      var colour = p.colours[i % p.colours.length];
      var shot = mediaFor(p, colour)[2] || mediaFor(p, colour)[0];
      var url = 'product.html?handle=' + p.handle + '&colour=' + colour;
      var feats = p.features.map(function (f) {
        return '<li><i class="ph ph-check" aria-hidden="true"></i><span>' + f + '</span></li>';
      }).join('');
      return '' +
        '<article class="feature__row reveal">' +
          '<div class="feature__media">' +
            '<img src="' + shot.src + '" srcset="' + shot.srcset + '" sizes="(max-width:860px) 100vw, 46vw" alt="' + shot.alt + '" loading="lazy" width="960" height="1200">' +
          '</div>' +
          '<div class="feature__body">' +
            '<p class="feature__index">' + p.category + ' &middot; ' + p.cards + ' cards &middot; ' + p.weight + ' g &middot; ' + p.dims + '</p>' +
            '<h3 class="feature__title"><a href="' + url + '">' + p.title + '</a></h3>' +
            '<p class="feature__lede">' + p.choose + '</p>' +
            '<ul class="feature__list">' + feats + '</ul>' +
            '<div class="feature__foot">' +
              '<span class="feature__price">' + money(p.price) + '</span>' +
              (p.compareAt ? '<s class="card__was">' + money(p.compareAt) + '</s>' : '') +
              '<a class="btn btn--primary" href="' + url + '">See the ' + p.title.split(' ')[0] + '</a>' +
            '</div>' +
          '</div>' +
        '</article>';
    }).join('');
  }

  function initRangeCarousel(container) {
    var track = $('[data-range-track]', container);
    var prevBtn = $('[data-range-prev]', container);
    var nextBtn = $('[data-range-next]', container);
    var n = PRODUCTS.length;
    var active = -1;

    track.innerHTML = PRODUCTS.map(rangeCardHTML).join('');
    var cards = Array.prototype.slice.call(track.querySelectorAll('.rcard'));

    /* Cards never move — only the active highlight travels between them. */
    function go(idx) {
      if (idx === active) return;
      active = idx;
      cards.forEach(function (card, i) {
        card.classList.toggle('rcard--active', i === active);
      });
    }

    var resetTimer = null;
    function cancelReset() { clearTimeout(resetTimer); resetTimer = null; }

    prevBtn.addEventListener('click', function () { cancelReset(); go((Math.max(active, 0) - 1 + n) % n); });
    nextBtn.addEventListener('click', function () { cancelReset(); go((Math.max(active, 0) + 1) % n); });

    /* Touch has no hover to leave, so a tap would latch a card active with no
       way back. There the CSS shows every card at full strength instead. */
    var canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (canHover) {
      cards.forEach(function (card, i) {
        card.addEventListener('mouseenter', function () { cancelReset(); go(i); });
        /* Hold the highlight for a beat after the cursor leaves, then settle back. */
        card.addEventListener('mouseleave', function () {
          cancelReset();
          resetTimer = setTimeout(function () { go(-1); }, 100);
        });
      });
    }
  }

  function lineHTML(item) {
    var p = byHandle(item.handle);
    if (!p) return '';
    var shot = mediaFor(p, item.colour)[0];
    return '' +
      '<li class="lineitem" data-id="' + item.id + '">' +
        '<a class="lineitem__media" href="product.html?handle=' + p.handle + '">' +
          '<img src="' + shot.thumb + '" alt="' + shot.alt + '" width="152" height="190" loading="lazy">' +
        '</a>' +
        '<div>' +
          '<div class="lineitem__top">' +
            '<div>' +
              '<a class="lineitem__title" href="product.html?handle=' + p.handle + '">' + p.title + '</a>' +
              '<p class="lineitem__variant">' + COLOURS[item.colour].name + ' / ' + item.finish.charAt(0).toUpperCase() + item.finish.slice(1) + '</p>' +
            '</div>' +
            '<span class="lineitem__price">' + money(p.price * item.qty) + '</span>' +
          '</div>' +
          '<div class="lineitem__foot">' +
            '<div class="qty">' +
              '<button type="button" data-step="-1" aria-label="Decrease quantity"><i class="ph ph-minus" aria-hidden="true"></i></button>' +
              '<input type="number" value="' + item.qty + '" min="1" max="20" aria-label="Quantity for ' + p.title + '">' +
              '<button type="button" data-step="1" aria-label="Increase quantity"><i class="ph ph-plus" aria-hidden="true"></i></button>' +
            '</div>' +
            '<button class="lineitem__remove" type="button" data-remove>Remove</button>' +
          '</div>' +
        '</div>' +
      '</li>';
  }

  function bindLineControls(scope) {
    $$('.lineitem', scope).forEach(function (li) {
      var id = li.dataset.id;
      var input = $('input', li);
      $$('[data-step]', li).forEach(function (b) {
        b.addEventListener('click', function () {
          Cart.setQty(id, parseInt(input.value, 10) + parseInt(b.dataset.step, 10));
        });
      });
      input.addEventListener('change', function () {
        var v = parseInt(input.value, 10);
        Cart.setQty(id, isNaN(v) ? 1 : v);
      });
      $('[data-remove]', li).addEventListener('click', function () { Cart.remove(id); });
    });
  }

  /* ---------------- header --------------------------------------------- */
  function initHeader() {
    var header = $('.header');
    if (!header) return;

    /* sticky state without a scroll listener */
    var sentinel = document.createElement('div');
    sentinel.style.cssText = 'position:absolute;top:0;height:1px;width:1px;';
    document.body.prepend(sentinel);
    new IntersectionObserver(function (entries) {
      header.classList.toggle('is-stuck', !entries[0].isIntersecting);
    }).observe(sentinel);

    var ann = $('.announce');
    if (ann) {
      if (Store.read('volta.announceClosed', false)) ann.hidden = true;
      var close = $('.announce__close', ann);
      if (close) close.addEventListener('click', function () {
        ann.hidden = true; Store.write('volta.announceClosed', true);
      });
    }

    var menu = $('.mobilemenu');
    var toggle = $('.nav-toggle');
    if (menu && toggle) {
      var layer = null;
      toggle.addEventListener('click', function () {
        layer = openLayer(menu, $('.mobilemenu__panel', menu), function () { layer = null; });
      });
      $('.mobilemenu__scrim', menu).addEventListener('click', function () { if (layer) layer.close(); });
      $('[data-close-menu]', menu).addEventListener('click', function () { if (layer) layer.close(); });
    }

    function paint() {
      var c = Cart.count();
      $$('[data-cart-count]').forEach(function (n) {
        n.textContent = c; n.classList.toggle('is-on', c > 0);
      });
      var w = Wish.items.length;
      $$('[data-wish-count]').forEach(function (n) {
        n.textContent = w; n.classList.toggle('is-on', w > 0);
      });
    }
    onChange(paint); paint();
  }

  /* ---------------- cart drawer ---------------------------------------- */
  function initCartDrawer() {
    var drawer = $('#cart-drawer');
    if (!drawer) return;
    var body = $('[data-cart-body]', drawer);
    var foot = $('[data-cart-foot]', drawer);
    var layer = null;

    function render() {
      if (!Cart.items.length) {
        body.innerHTML = '<div class="empty"><i class="ph ph-shopping-bag" aria-hidden="true"></i>' +
          '<strong>Your cart is empty</strong><p>Nothing here yet. The Meridian Bifold is where most people start.</p>' +
          '<a class="btn btn--primary" href="shop.html">Shop wallets</a></div>';
        foot.hidden = true;
        return;
      }
      foot.hidden = false;
      body.innerHTML = '<ul>' + Cart.items.map(lineHTML).join('') + '</ul>';
      bindLineControls(body);

      var sub = Cart.subtotal();
      var left = Math.max(0, FREE_SHIPPING_THRESHOLD - sub);
      var pct = Math.min(100, (sub / FREE_SHIPPING_THRESHOLD) * 100);
      $('[data-progress-fill]', foot).style.width = pct + '%';
      $('[data-progress-text]', foot).innerHTML = left > 0
        ? 'Add <b>' + money(left) + '</b> for free EU shipping'
        : 'Free EU shipping applied';
      $('[data-subtotal]', foot).textContent = money(sub);
    }

    function open() {
      render();
      layer = openLayer(drawer, $('.drawer__panel', drawer), function () { layer = null; });
    }
    $$('[data-open-cart]').forEach(function (b) {
      b.addEventListener('click', function (e) { e.preventDefault(); open(); });
    });
    $('.drawer__scrim', drawer).addEventListener('click', function () { if (layer) layer.close(); });
    $('[data-close-cart]', drawer).addEventListener('click', function () { if (layer) layer.close(); });
    onChange(function () { if (drawer.classList.contains('is-open')) render(); });
    window.VoltaOpenCart = open;
  }

  /* ---------------- global click delegates ------------------------------ */
  function initDelegates() {
    document.addEventListener('click', function (e) {
      var wishBtn = e.target.closest('[data-wish]');
      if (wishBtn) {
        e.preventDefault();
        var on = Wish.toggle(wishBtn.dataset.wish);
        $$('[data-wish="' + wishBtn.dataset.wish + '"]').forEach(function (b) {
          b.classList.toggle('is-on', on);
          b.setAttribute('aria-pressed', String(on));
          var ico = $('i', b);
          if (ico) ico.className = (on ? 'ph-fill' : 'ph') + ' ph-heart';
        });
        toast(on ? 'Saved to wishlist' : 'Removed from wishlist', 'View wishlist', 'wishlist.html');
        return;
      }
      /* The Everyday Set: two products, one click. */
      var set = e.target.closest('[data-addset]');
      if (set) {
        e.preventDefault();
        [['meridian-bifold', 'onyx'], ['halden-cardholder', 'onyx']].forEach(function (pair) {
          var sp = byHandle(pair[0]);
          if (sp) Cart.add(sp.handle, pair[1], sp.finishes[0], 1);
        });
        toast('The Everyday Set added to cart', 'View cart', 'cart.html');
        if (window.VoltaOpenCart) window.VoltaOpenCart();
        return;
      }
      var quick = e.target.closest('[data-quickadd]');
      if (quick) {
        e.preventDefault();
        var p = byHandle(quick.dataset.quickadd);
        if (!p) return;
        /* A colourway tile knows which colour it is; a product tile picks the
           first one that is not sold out. */
        var colour = p.colours.indexOf(quick.dataset.colour) > -1
          ? quick.dataset.colour
          : (p.colours.find(function (c) {
              return !p.soldOut.some(function (s) { return s.colour === c && s.finish === p.finishes[0]; });
            }) || p.colours[0]);
        Cart.add(p.handle, colour, p.finishes[0], 1);
        toast(p.title + ' added to cart', 'View cart', 'cart.html');
        if (window.VoltaOpenCart) window.VoltaOpenCart();
      }
    });
  }

  /* ---------------- reveal on scroll ----------------------------------- */
  function initReveal() {
    var nodes = $$('.reveal, .reveal-stagger');
    if (!nodes.length) return;
    if (reduced) { nodes.forEach(function (n) { n.classList.add('is-in'); }); return; }
    $$('.reveal-stagger').forEach(function (g) {
      Array.prototype.forEach.call(g.children, function (c, i) { c.style.setProperty('--i', i); });
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    nodes.forEach(function (n) { io.observe(n); });
  }

  /* ---------------- search --------------------------------------------- */
  /* Shopify equivalent: /search/suggest.json predictive search */
  function matches(q) {
    q = q.trim().toLowerCase();
    if (!q) return [];
    return PRODUCTS.filter(function (p) {
      return (p.title + ' ' + p.category + ' ' + p.tagline + ' ' + p.description).toLowerCase().indexOf(q) > -1;
    });
  }

  function initSearch() {
    var pane = $('#searchpane');
    if (!pane) return;
    var input = $('input[type="search"]', pane);
    var out = $('[data-search-results]', pane);
    var layer = null;

    function render(q) {
      var res = matches(q);
      if (!q.trim()) {
        out.innerHTML = '<p class="eyebrow" style="margin-bottom:.7rem">Popular</p><div class="suggest">' +
          ['Bifold', 'Cardholder', 'Zip', 'Onyx', 'Navy'].map(function (t) {
            return '<button class="chip" type="button" data-suggest="' + t + '">' + t + '</button>';
          }).join('') + '</div>';
        return;
      }
      if (!res.length) {
        out.innerHTML = '<div class="empty"><i class="ph ph-magnifying-glass" aria-hidden="true"></i>' +
          '<strong>No matches for "' + q.replace(/</g, '&lt;') + '"</strong>' +
          '<p>Try a product name, a colour, or a category such as Travel.</p></div>';
        return;
      }
      out.innerHTML = '<p class="eyebrow" style="margin-bottom:.9rem">' + res.length + ' result' + (res.length > 1 ? 's' : '') + '</p>' +
        '<div class="grid-products">' + res.slice(0, 4).map(cardHTML).join('') + '</div>' +
        (res.length > 4 ? '<p style="margin-top:1.25rem"><a class="textlink" href="search.html?q=' + encodeURIComponent(q) + '">See all ' + res.length + ' results</a></p>' : '');
    }

    var t;
    input.addEventListener('input', function () {
      clearTimeout(t);
      t = setTimeout(function () { render(input.value); }, 140);
    });
    out.addEventListener('click', function (e) {
      var s = e.target.closest('[data-suggest]');
      if (s) { input.value = s.dataset.suggest; render(input.value); input.focus(); }
    });
    $('form', pane).addEventListener('submit', function (e) {
      e.preventDefault();
      window.location.href = 'search.html?q=' + encodeURIComponent(input.value);
    });
    $$('[data-open-search]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.preventDefault();
        render(input.value);
        layer = openLayer(pane, $('.searchpane__panel', pane), function () { layer = null; });
      });
    });
    $('.searchpane__scrim', pane).addEventListener('click', function () { if (layer) layer.close(); });
    $('[data-close-search]', pane).addEventListener('click', function () { if (layer) layer.close(); });
  }

  /* ---------------- home page ------------------------------------------ */
  function initHome() {
    var carousel = $('[data-range-carousel]');
    if (carousel) initRangeCarousel(carousel);

    var revRail = $('[data-reviews]');
    if (revRail) {
      revRail.innerHTML = REVIEWS.map(function (r) {
        return '<figure class="quote">' +
          '<div class="quote__stars" aria-label="' + r.rating + ' out of 5">' + stars(r.rating) + '</div>' +
          '<blockquote><p>' + r.text + '</p></blockquote>' +
          '<figcaption class="quote__by"><strong>' + r.name + '</strong><span>' + r.place + ', on the ' + r.product + '</span></figcaption>' +
          '</figure>';
      }).join('');
    }
    /* Comparison matrix. Worth building precisely because the range is three:
       a shopper can weigh the whole line in one view instead of navigating it. */
    var cmp = $('[data-compare]');
    if (cmp) {
      var rows = [
        { label: 'Choose it if',  get: function (p) { return p.choose; }, wide: true },
        { label: 'Card slots',    get: function (p) { return p.cards; }, num: true },
        { label: 'Banknotes',     get: function (p) { return p.notes; } },
        { label: 'Coins',         get: function (p) { return p.coins; } },
        { label: 'Weight',        get: function (p) { return p.weight + 'g'; }, num: true },
        { label: 'Closed size',   get: function (p) { return p.dims; }, num: true }
      ];
      cmp.innerHTML =
        '<table>' +
          '<caption class="sr-only">The three VOLTA wallets compared by capacity, weight and size</caption>' +
          '<thead><tr><td></td>' +
            PRODUCTS.map(function (p) {
              var shot = mediaFor(p, p.colours[0])[1];
              return '<th scope="col">' +
                '<a class="compare__shot" href="product.html?handle=' + p.handle + '">' +
                  '<img src="' + shot.thumb + '" alt="' + shot.alt + '" width="240" height="300" loading="lazy">' +
                '</a>' +
                '<span class="compare__name">' + p.title + '</span>' +
                '<span class="compare__price">' + money(p.price) + '</span>' +
              '</th>';
            }).join('') +
          '</tr></thead>' +
          '<tbody>' +
            rows.map(function (r) {
              return '<tr><th scope="row">' + r.label + '</th>' +
                PRODUCTS.map(function (p) {
                  return '<td' + (r.num ? ' class="num"' : '') + '>' + r.get(p) + '</td>';
                }).join('') + '</tr>';
            }).join('') +
          '</tbody>' +
          '<tfoot><tr><td></td>' +
            PRODUCTS.map(function (p) {
              return '<td><a class="btn btn--sm" href="product.html?handle=' + p.handle + '">View</a></td>';
            }).join('') +
          '</tr></tfoot>' +
        '</table>';
    }

    var avg = $('[data-avg-rating]');
    if (avg) avg.textContent = averageRating().toFixed(1);
    var tot = $('[data-total-reviews]');
    if (tot) tot.textContent = totalReviews().toLocaleString('de-DE');
  }

  /* ---------------- collection page ------------------------------------ */
  function initCollection() {
    var grid = $('[data-collection-grid]');
    if (!grid) return;

    var params = new URLSearchParams(location.search);
    var state = {
      cats: (params.get('cat') || '').split(',').filter(Boolean),
      colours: (params.get('colour') || '').split(',').filter(Boolean),
      min: params.get('min') ? Number(params.get('min')) : null,
      max: params.get('max') ? Number(params.get('max')) : null,
      inStock: params.get('stock') === '1',
      q: params.get('q') || '',
      sort: params.get('sort') || 'featured'
    };

    var catBox = $('[data-filter-cats]');
    var colBox = $('[data-filter-colours]');
    var chipBox = $('[data-active-chips]');
    var countEl = $('[data-result-count]');
    var sortSel = $('[data-sort]');
    var qInput = $('[data-collection-search]');
    var minInput = $('[data-min]');
    var maxInput = $('[data-max]');
    var stockInput = $('[data-instock]');

    var cats = [];
    PRODUCTS.forEach(function (p) { if (cats.indexOf(p.category) < 0) cats.push(p.category); });

    catBox.innerHTML = cats.map(function (c) {
      return '<button class="chip" type="button" data-cat="' + c + '" aria-pressed="' +
        (state.cats.indexOf(c) > -1) + '">' + c + '</button>';
    }).join('');

    colBox.innerHTML = Object.keys(COLOURS).map(function (k) {
      return '<button class="swatch-pick" type="button" data-colour="' + k + '" title="' + COLOURS[k].name + '"' +
        ' aria-label="Filter by ' + COLOURS[k].name + '" aria-pressed="' + (state.colours.indexOf(k) > -1) + '"' +
        ' style="background:' + COLOURS[k].hex + '"></button>';
    }).join('');

    if (sortSel) sortSel.value = state.sort;
    if (qInput) qInput.value = state.q;
    if (minInput && state.min !== null) minInput.value = state.min;
    if (maxInput && state.max !== null) maxInput.value = state.max;
    if (stockInput) stockInput.checked = state.inStock;

    /* The grid runs at colourway level, so filters narrow to {product, colour}
       pairs rather than whole products. */
    function filtered() {
      var out = PRODUCTS.slice();
      if (state.cats.length) out = out.filter(function (p) { return state.cats.indexOf(p.category) > -1; });
      if (state.min !== null) out = out.filter(function (p) { return p.price >= state.min; });
      if (state.max !== null) out = out.filter(function (p) { return p.price <= state.max; });
      if (state.q.trim()) {
        var q = state.q.trim().toLowerCase();
        out = out.filter(function (p) {
          return (p.title + ' ' + p.category + ' ' + p.tagline).toLowerCase().indexOf(q) > -1;
        });
      }

      var rows = [];
      out.forEach(function (p) {
        p.colours.forEach(function (c) {
          if (state.colours.length && state.colours.indexOf(c) < 0) return;
          var live = p.finishes.some(function (f) {
            return !p.soldOut.some(function (s) { return s.colour === c && s.finish === f; });
          });
          if (state.inStock && !live) return;
          rows.push({ product: p, colour: c, inStock: live });
        });
      });

      switch (state.sort) {
        case 'price-asc':  rows.sort(function (a, b) { return a.product.price - b.product.price; }); break;
        case 'price-desc': rows.sort(function (a, b) { return b.product.price - a.product.price; }); break;
        case 'rating':     rows.sort(function (a, b) { return b.product.rating - a.product.rating; }); break;
        case 'newest':     rows.sort(function (a, b) { return (b.product.isNew ? 1 : 0) - (a.product.isNew ? 1 : 0); }); break;
        default:           rows.sort(function (a, b) { return (b.product.featured ? 1 : 0) - (a.product.featured ? 1 : 0); });
      }
      return rows;
    }

    function syncURL() {
      var p = new URLSearchParams();
      if (state.cats.length) p.set('cat', state.cats.join(','));
      if (state.colours.length) p.set('colour', state.colours.join(','));
      if (state.min !== null) p.set('min', state.min);
      if (state.max !== null) p.set('max', state.max);
      if (state.inStock) p.set('stock', '1');
      if (state.q.trim()) p.set('q', state.q.trim());
      if (state.sort !== 'featured') p.set('sort', state.sort);
      var qs = p.toString();
      history.replaceState(null, '', qs ? '?' + qs : location.pathname);
    }

    function chips() {
      var out = [];
      state.cats.forEach(function (c) { out.push({ label: c, kind: 'cat', value: c }); });
      state.colours.forEach(function (c) { out.push({ label: COLOURS[c].name, kind: 'colour', value: c }); });
      if (state.min !== null || state.max !== null) {
        out.push({ label: 'Price ' + (state.min !== null ? money(state.min) : 'any') + ' to ' + (state.max !== null ? money(state.max) : 'any'), kind: 'price', value: '' });
      }
      if (state.inStock) out.push({ label: 'In stock', kind: 'stock', value: '' });
      if (state.q.trim()) out.push({ label: '"' + state.q.trim() + '"', kind: 'q', value: '' });

      chipBox.innerHTML = out.length
        ? out.map(function (c) {
            return '<button class="chip chip--active" type="button" data-kind="' + c.kind + '" data-value="' + c.value + '">' +
              c.label + '<i class="ph ph-x" aria-hidden="true"></i></button>';
          }).join('') + '<button class="chip" type="button" data-kind="all">Clear all</button>'
        : '';
    }

    function syncControls() {
      $$('[data-cat]', catBox).forEach(function (i) {
        i.setAttribute('aria-pressed', String(state.cats.indexOf(i.dataset.cat) > -1));
      });
      $$('[data-colour]', colBox).forEach(function (i) {
        i.setAttribute('aria-pressed', String(state.colours.indexOf(i.dataset.colour) > -1));
      });
      if (stockInput) stockInput.checked = state.inStock;
      if (qInput) qInput.value = state.q;
    }

    function paint() {
      var res = filtered();
      var seen = {};
      res.forEach(function (v) { seen[v.product.handle] = 1; });
      var nW = Object.keys(seen).length;
      countEl.textContent = res.length + (res.length === 1 ? ' option' : ' options') +
        ' across ' + nW + (nW === 1 ? ' wallet' : ' wallets');
      grid.innerHTML = res.length
        ? res.map(variantCardHTML).join('')
        : '';
      var emptyBox = $('[data-collection-empty]');
      emptyBox.hidden = res.length > 0;
      grid.hidden = res.length === 0;
      chips();
      syncURL();
    }

    catBox.addEventListener('click', function (e) {
      var b = e.target.closest('[data-cat]');
      if (!b) return;
      var v = b.dataset.cat;
      var on = state.cats.indexOf(v) > -1;
      state.cats = on ? state.cats.filter(function (c) { return c !== v; }) : state.cats.concat(v);
      b.setAttribute('aria-pressed', String(!on));
      paint();
    });
    colBox.addEventListener('click', function (e) {
      var b = e.target.closest('[data-colour]');
      if (!b) return;
      var v = b.dataset.colour;
      var on = state.colours.indexOf(v) > -1;
      if (on) state.colours = state.colours.filter(function (c) { return c !== v; });
      else state.colours.push(v);
      b.setAttribute('aria-pressed', String(!on));
      paint();
    });
    chipBox.addEventListener('click', function (e) {
      var b = e.target.closest('[data-kind]');
      if (!b) return;
      var k = b.dataset.kind;
      if (k === 'all') {
        state.cats = []; state.colours = []; state.min = null; state.max = null;
        state.inStock = false; state.q = '';
      }
      if (k === 'cat') state.cats = state.cats.filter(function (c) { return c !== b.dataset.value; });
      if (k === 'colour') state.colours = state.colours.filter(function (c) { return c !== b.dataset.value; });
      if (k === 'price') { state.min = null; state.max = null; }
      if (k === 'stock') state.inStock = false;
      if (k === 'q') state.q = '';
      $$('[data-cat]', catBox).forEach(function (i) { i.setAttribute('aria-pressed', String(state.cats.indexOf(i.dataset.cat) > -1)); });
      $$('[data-colour]', colBox).forEach(function (i) { i.setAttribute('aria-pressed', String(state.colours.indexOf(i.dataset.colour) > -1)); });
      if (minInput) minInput.value = state.min === null ? '' : state.min;
      if (maxInput) maxInput.value = state.max === null ? '' : state.max;
      if (stockInput) stockInput.checked = state.inStock;
      if (qInput) qInput.value = state.q;
      paint();
    });
    if (sortSel) sortSel.addEventListener('change', function () { state.sort = sortSel.value; paint(); });
    if (stockInput) stockInput.addEventListener('change', function () { state.inStock = stockInput.checked; paint(); });
    [minInput, maxInput].forEach(function (i) {
      if (!i) return;
      i.addEventListener('change', function () {
        var v = i.value === '' ? null : Number(i.value);
        if (i === minInput) state.min = v; else state.max = v;
        paint();
      });
    });
    if (qInput) {
      var tq;
      qInput.addEventListener('input', function () {
        clearTimeout(tq);
        tq = setTimeout(function () { state.q = qInput.value; paint(); }, 180);
      });
    }
    $$('[data-price-preset]').forEach(function (b) {
      b.addEventListener('click', function () {
        var parts = b.dataset.pricePreset.split('-');
        state.min = parts[0] ? Number(parts[0]) : null;
        state.max = parts[1] ? Number(parts[1]) : null;
        if (minInput) minInput.value = state.min === null ? '' : state.min;
        if (maxInput) maxInput.value = state.max === null ? '' : state.max;
        paint();
      });
    });

    var clearBtn = $('[data-clear-filters]');
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        state.cats = []; state.colours = []; state.min = null; state.max = null;
        state.inStock = false; state.q = '';
        syncControls();
        paint();
      });
    }

    paint();
    onChange(function () {
      $$('[data-wish]', grid).forEach(function (b) {
        var on = Wish.has(b.dataset.wish);
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-pressed', String(on));
        var ico = $('i', b);
        if (ico) ico.className = (on ? 'ph-fill' : 'ph') + ' ph-heart';
      });
    });
  }

  /* ---------------- product page --------------------------------------- */
  function initProduct() {
    var root = $('[data-product]');
    if (!root) return;
    var qs = new URLSearchParams(location.search);
    var handle = qs.get('handle') || 'meridian-bifold';
    var p = byHandle(handle) || PRODUCTS[0];

    document.title = p.title + ' | VOLTA';
    var md = $('meta[name="description"]');
    if (md) md.setAttribute('content', p.tagline + ' ' + p.description.slice(0, 110));

    /* Colourway tiles link straight to their variant, so honour ?colour= */
    var wantColour = qs.get('colour');
    var sel = {
      colour: p.colours.indexOf(wantColour) > -1 ? wantColour : p.colours[0],
      finish: p.finishes[0], qty: 1, image: 0
    };

    function isSoldOut(c, f) {
      return p.soldOut.some(function (s) { return s.colour === c && s.finish === f; });
    }

    /* ---- gallery ---- */
    var main = $('[data-gal-main]');
    var thumbs = $('[data-gal-thumbs]');
    var media = mediaFor(p, sel.colour);

    function paintGallery() {
      media = mediaFor(p, sel.colour);
      if (sel.image >= media.length) sel.image = 0;
      var m = media[sel.image];

      thumbs.innerHTML = media.map(function (t, i) {
        return '<button class="gallery__thumb" type="button" data-i="' + i + '" aria-current="' + (i === sel.image) + '" aria-label="View ' + t.alt + '">' +
          '<img src="' + t.thumb + '" alt="" width="76" height="76" loading="lazy"></button>';
      }).join('');

      main.innerHTML =
        '<img class="gal-base" src="' + m.src + '" srcset="' + m.srcset + '" sizes="(max-width:980px) 100vw, 55vw" alt="' + m.alt + '" width="1000" height="1250" fetchpriority="high">' +
        '<button class="gallery__zoom" type="button" data-zoom aria-label="Open larger image"><i class="ph ph-magnifying-glass-plus" aria-hidden="true"></i></button>';
    }

    /* Picking a colour is simply a different photograph, so repaint the gallery
       and keep the shopper on the angle they were already looking at. */
    function showColour() {
      paintGallery();
    }

    thumbs.addEventListener('click', function (e) {
      var b = e.target.closest('[data-i]');
      if (b) { sel.image = Number(b.dataset.i); paintGallery(); }
    });

    /* ---- lightbox ---- */
    var lb = $('#lightbox');
    main.addEventListener('click', function (e) {
      if (!e.target.closest('[data-zoom]') && e.target.tagName !== 'IMG') return;
      var m = media[sel.image];
      var lbBase = $('.lb-base', lb);
      lbBase.src = m.full;
      lbBase.alt = m.alt;
      openLayer(lb, lb);
    });
    $('.lightbox__close', lb).addEventListener('click', function () {
      if (openLayers.length) openLayers[openLayers.length - 1].close();
    });

    /* ---- head ---- */
    $('[data-p-title]').textContent = p.title;
    $('[data-p-tagline]').textContent = p.tagline;
    $('[data-p-cat]').textContent = p.category;
    $('[data-p-cat]').href = 'shop.html?cat=' + encodeURIComponent(p.category);
    $('[data-p-crumb]').textContent = p.title;
    $('[data-p-desc]').textContent = p.description;
    $('[data-p-care]').textContent = p.care;
    $('[data-p-rating]').innerHTML = stars(p.rating) +
      '<span style="margin-left:.4rem">' + p.rating.toFixed(1) + '</span>' +
      '<a href="#reviews" style="margin-left:.5rem;text-decoration:underline;text-underline-offset:3px">' + p.reviews + ' reviews</a>';
    $('[data-p-price]').innerHTML = '<b>' + money(p.price) + '</b>' +
      (p.compareAt ? '<s>' + money(p.compareAt) + '</s>' : '');
    $('[data-p-features]').innerHTML = p.features.map(function (f) { return '<li>' + f + '</li>'; }).join('');
    var pWish = $('[data-p-wish]');
    pWish.dataset.wish = p.handle;
    pWish.classList.toggle('is-on', Wish.has(p.handle));
    pWish.setAttribute('aria-pressed', String(Wish.has(p.handle)));
    $('i', pWish).className = (Wish.has(p.handle) ? 'ph-fill' : 'ph') + ' ph-heart';

    $('[data-p-specs]').innerHTML = [
      { v: p.cards, l: 'card slots', n: 'Fits ' + p.cards + ' cards without stretching the leather.' },
      { v: p.weight + 'g', l: 'weight', n: 'Weighed empty, in the Onyx colourway.' },
      { v: p.dims.split(' x ')[0], l: 'cm wide', n: 'Closed dimension: ' + p.dims + '.' },
      { v: '2yr', l: 'warranty', n: 'Stitching and hardware, repaired or replaced.' }
    ].map(function (s) {
      return '<div class="spec-tile"><b>' + s.v + '</b><span>' + s.l + '</span><p>' + s.n + '</p></div>';
    }).join('');

    /* ---- options ---- */
    var colourRow = $('[data-p-colours]');
    var finishRow = $('[data-p-finishes]');
    var colourLabel = $('[data-p-colour-label]');
    var finishLabel = $('[data-p-finish-label]');
    var stockLine = $('[data-p-stock]');
    var addBtn = $('[data-p-add]');
    var buyBtn = $('[data-p-buy]');

    function paintOptions() {
      colourRow.innerHTML = p.colours.map(function (c) {
        var dead = p.finishes.every(function (f) { return isSoldOut(c, f); });
        return '<button class="swatch-big" type="button" data-c="' + c + '" aria-pressed="' + (c === sel.colour) + '"' +
          (dead ? ' disabled' : '') + ' aria-label="' + COLOURS[c].name + '" style="background:' + COLOURS[c].hex + '"></button>';
      }).join('');
      finishRow.innerHTML = p.finishes.map(function (f) {
        var meta = FINISHES.find(function (x) { return x.id === f; });
        var dead = isSoldOut(sel.colour, f);
        return '<button class="optpill" type="button" data-f="' + f + '" aria-pressed="' + (f === sel.finish) + '"' +
          (dead ? ' disabled' : '') + '>' + meta.name + '<small>' + meta.note + '</small></button>';
      }).join('');
      colourLabel.textContent = COLOURS[sel.colour].name;
      finishLabel.textContent = (FINISHES.find(function (x) { return x.id === sel.finish; }) || {}).name || '';

      var out = isSoldOut(sel.colour, sel.finish);
      stockLine.className = 'stockline' + (out ? ' stockline--out' : '');
      stockLine.innerHTML = out
        ? '<i class="ph ph-x-circle" aria-hidden="true"></i> Out of stock in this combination'
        : '<i class="ph ph-check-circle" aria-hidden="true"></i> In stock, ships within 24 hours';
      addBtn.disabled = out;
      buyBtn.disabled = out;
      addBtn.textContent = out ? 'Out of stock' : 'Add to cart';
    }

    colourRow.addEventListener('click', function (e) {
      var b = e.target.closest('[data-c]');
      if (!b || b.disabled) return;
      sel.colour = b.dataset.c;
      if (isSoldOut(sel.colour, sel.finish)) {
        sel.finish = p.finishes.find(function (f) { return !isSoldOut(sel.colour, f); }) || sel.finish;
      }
      /* Keep the same shot and recolour it, rather than jumping to a different
         photo: the point is to show this wallet in the chosen hide. */
      paintOptions(); showColour();
    });
    finishRow.addEventListener('click', function (e) {
      var b = e.target.closest('[data-f]');
      if (!b || b.disabled) return;
      sel.finish = b.dataset.f;
      paintOptions(); showColour();
    });

    var qtyInput = $('[data-p-qty]');
    $$('[data-p-step]').forEach(function (b) {
      b.addEventListener('click', function () {
        var v = parseInt(qtyInput.value, 10) + parseInt(b.dataset.pStep, 10);
        qtyInput.value = Math.max(1, Math.min(20, v));
      });
    });

    addBtn.addEventListener('click', function () {
      Cart.add(p.handle, sel.colour, sel.finish, parseInt(qtyInput.value, 10) || 1);
      toast(p.title + ' added to cart', 'View cart', 'cart.html');
      if (window.VoltaOpenCart) window.VoltaOpenCart();
    });
    buyBtn.addEventListener('click', function () {
      Cart.add(p.handle, sel.colour, sel.finish, parseInt(qtyInput.value, 10) || 1);
      window.location.href = 'checkout.html';
    });

    /* ---- reviews ---- */
    var rv = REVIEWS.filter(function (r) { return r.product === p.title; });
    if (!rv.length) rv = REVIEWS.slice(0, 2);
    $('[data-p-rev-avg]').textContent = p.rating.toFixed(1);
    $('[data-p-rev-stars]').innerHTML = stars(p.rating);
    $('[data-p-rev-count]').textContent = p.reviews + ' reviews';
    var dist = [72, 21, 5, 1, 1];
    $('[data-p-rev-bars]').innerHTML = dist.map(function (pc, i) {
      return '<div class="rev-bar"><span>' + (5 - i) + ' star</span>' +
        '<span class="rev-bar__line"><i style="width:' + pc + '%"></i></span>' +
        '<span class="n">' + pc + '%</span></div>';
    }).join('');
    $('[data-p-rev-list]').innerHTML = rv.map(function (r) {
      return '<figure class="quote">' +
        '<div class="quote__stars" aria-label="' + r.rating + ' out of 5">' + stars(r.rating) + '</div>' +
        '<blockquote><p>' + r.text + '</p></blockquote>' +
        '<figcaption class="quote__by"><strong>' + r.name + '</strong><span>' + r.place + ', verified purchase</span></figcaption>' +
        '</figure>';
    }).join('');

    /* ---- related ---- */
    /* With a range this small, "related" is simply the rest of the line. */
    var related = PRODUCTS.filter(function (x) { return x.handle !== p.handle; });
    var relHost = $('[data-p-related]');
    relHost.className = 'grid-products grid-products--' + Math.min(related.length, 3);
    relHost.innerHTML = related.map(cardHTML).join('');

    /* ---- structured data ---- */
    var ld = {
      '@context': 'https://schema.org', '@type': 'Product',
      name: p.title, description: p.description, sku: p.handle,
      brand: { '@type': 'Brand', name: 'VOLTA' },
      image: mediaFor(p, p.colours[0]).map(function (m) {
        return new URL(m.full, location.href).href;
      }),
      aggregateRating: { '@type': 'AggregateRating', ratingValue: p.rating, reviewCount: p.reviews },
      offers: {
        '@type': 'Offer', price: p.price.toFixed(2), priceCurrency: 'EUR',
        availability: 'https://schema.org/InStock', url: location.href
      }
    };
    var s = document.createElement('script');
    s.type = 'application/ld+json';
    s.textContent = JSON.stringify(ld);
    document.head.appendChild(s);

    paintOptions();
    paintGallery();
    root.hidden = false;
  }

  /* ---------------- cart page ------------------------------------------ */
  function initCartPage() {
    var root = $('[data-cart-page]');
    if (!root) return;
    var list = $('[data-cart-list]', root);
    var side = $('[data-cart-summary]', root);
    var empty = $('[data-cart-empty]', root);

    function render() {
      var has = Cart.items.length > 0;
      empty.hidden = has;
      list.hidden = !has;
      side.hidden = !has;
      if (!has) {
        /* Clear the markup, do not just hide it: stale line items stay
           queryable and a discount must not survive an emptied cart. */
        list.innerHTML = '';
        delete root.dataset.discount;
        var stale = $('.form-note', root);
        if (stale) { stale.className = 'form-note'; stale.innerHTML = ''; }
        return;
      }
      list.innerHTML = '<ul>' + Cart.items.map(lineHTML).join('') + '</ul>';
      bindLineControls(list);
      var sub = Cart.subtotal();
      var ship = sub >= FREE_SHIPPING_THRESHOLD || sub === 0 ? 0 : 4.9;
      var disc = root.dataset.discount ? sub * 0.1 : 0;
      $('[data-sum-sub]', side).textContent = money(sub);
      $('[data-sum-ship]', side).textContent = ship === 0 ? 'Free' : money(ship);
      $('[data-sum-total]', side).textContent = money(sub - disc + ship);
      var dRow = $('[data-sum-disc-row]', side);
      dRow.hidden = !disc;
      if (disc) $('[data-sum-disc]', side).textContent = '-' + money(disc);
    }

    var codeForm = $('[data-discount-form]', root);
    if (codeForm) {
      codeForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var input = $('input', codeForm);
        var note = $('.form-note', codeForm);
        var ok = input.value.trim().toUpperCase() === 'VOLTA10';
        note.className = 'form-note is-on ' + (ok ? 'form-note--ok' : 'form-note--err');
        note.innerHTML = '<i class="ph ph-' + (ok ? 'check-circle' : 'warning-circle') + '" aria-hidden="true"></i>' +
          (ok ? 'Code applied, 10 percent off' : 'That code is not recognised');
        if (ok) { root.dataset.discount = '1'; }
        render();
      });
    }

    onChange(render);
    render();
  }

  /* ---------------- wishlist page --------------------------------------- */
  function initWishPage() {
    var grid = $('[data-wish-grid]');
    if (!grid) return;
    function render() {
      var items = PRODUCTS.filter(function (p) { return Wish.has(p.handle); });
      $('[data-wish-empty]').hidden = items.length > 0;
      grid.hidden = items.length === 0;
      grid.innerHTML = items.map(cardHTML).join('');
    }
    onChange(render);
    render();
  }

  /* ---------------- search page ----------------------------------------- */
  function initSearchPage() {
    var grid = $('[data-search-grid]');
    if (!grid) return;
    var q = new URLSearchParams(location.search).get('q') || '';
    var input = $('[data-search-page-input]');
    if (input) input.value = q;
    var res = matches(q);
    $('[data-search-term]').textContent = q ? '"' + q + '"' : 'everything';
    $('[data-search-count]').textContent = res.length + (res.length === 1 ? ' result' : ' results');
    $('[data-search-empty]').hidden = res.length > 0;
    grid.hidden = res.length === 0;
    grid.innerHTML = (res.length ? res : PRODUCTS.slice(0, 4)).map(cardHTML).join('');
    if (!res.length) $('[data-search-fallback]').hidden = false;
  }

  /* ---------------- checkout summary ------------------------------------ */
  function initCheckout() {
    var root = $('[data-checkout]');
    if (!root) return;
    var list = $('[data-checkout-list]', root);
    if (!Cart.items.length) {
      root.innerHTML = '<div class="empty"><i class="ph ph-shopping-bag" aria-hidden="true"></i>' +
        '<strong>Nothing to check out</strong><p>Your cart is empty.</p>' +
        '<a class="btn btn--primary" href="shop.html">Shop wallets</a></div>';
      return;
    }
    list.innerHTML = Cart.items.map(function (i) {
      var p = byHandle(i.handle);
      return '<li class="totals__row"><span>' + p.title + ' <span class="body-muted">x' + i.qty + '</span></span>' +
        '<span>' + money(p.price * i.qty) + '</span></li>';
    }).join('');
    var sub = Cart.subtotal();
    var ship = sub >= FREE_SHIPPING_THRESHOLD ? 0 : 4.9;
    $('[data-co-sub]').textContent = money(sub);
    $('[data-co-ship]').textContent = ship === 0 ? 'Free' : money(ship);
    $('[data-co-total]').textContent = money(sub + ship);
    $('[data-co-vat]').textContent = money((sub + ship) - (sub + ship) / 1.19);
  }

  /* ---------------- forms ------------------------------------------------ */
  function initForms() {
    $$('[data-validate]').forEach(function (form) {
      form.setAttribute('novalidate', '');
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var ok = true;
        $$('.field', form).forEach(function (field) {
          var input = $('input, textarea, select', field);
          if (!input || !input.required) return;
          var valid = input.type === 'email'
            ? /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.value.trim())
            : input.value.trim().length > 0;
          if (input.type === 'checkbox') valid = input.checked;
          field.classList.toggle('is-invalid', !valid);
          if (!valid && ok) { input.focus(); ok = false; }
        });
        var note = $('.form-note', form);
        if (!ok) {
          if (note) {
            note.className = 'form-note is-on form-note--err';
            note.innerHTML = '<i class="ph ph-warning-circle" aria-hidden="true"></i>Check the highlighted fields and try again.';
          }
          return;
        }
        if (note) {
          note.className = 'form-note is-on form-note--ok';
          note.innerHTML = '<i class="ph ph-check-circle" aria-hidden="true"></i>' + (form.dataset.success || 'Thank you, that is on its way.');
        }
        form.reset();
        $$('.field', form).forEach(function (f) { f.classList.remove('is-invalid'); });
      });
      $$('input, textarea', form).forEach(function (i) {
        i.addEventListener('input', function () {
          var f = i.closest('.field');
          if (f) f.classList.remove('is-invalid');
        });
      });
    });
  }

  /* ---------------- FAQ tabs --------------------------------------------- */
  function initFaqTabs() {
    var row = $('[data-faq-tabs]');
    if (!row) return;
    row.addEventListener('click', function (e) {
      var b = e.target.closest('[data-faq-group]');
      if (!b) return;
      var g = b.dataset.faqGroup;
      $$('[data-faq-group]', row).forEach(function (x) { x.classList.toggle('chip--active', x === b); });
      $$('[data-faq-section]').forEach(function (s) {
        s.hidden = g !== 'all' && s.dataset.faqSection !== g;
      });
    });
  }

  /* ---------------- boot -------------------------------------------------- */
  function boot() {
    initHeader();
    initCartDrawer();
    initDelegates();
    initSearch();
    /* Renders .reveal nodes, so it has to run before the observer is attached. */
    initRangeFeature();
    initReveal();
    initHome();
    initCollection();
    initProduct();
    initCartPage();
    initWishPage();
    initSearchPage();
    initCheckout();
    initForms();
    initFaqTabs();
    var y = $('[data-year]');
    if (y) y.textContent = new Date().getFullYear();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
