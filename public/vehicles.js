/* vehicles.js - 10 hand-authored side-view SVG vehicles (facing RIGHT). Global script, no deps. */
(function (root) {
  'use strict';
  var UID = 0;

  /* ---------- colour helpers ---------- */
  function parse(c) {
    if (typeof c !== 'string') return [128, 128, 128];
    c = c.trim();
    var m;
    if ((m = /^#([0-9a-f]{3})$/i.exec(c))) return m[1].split('').map(function (h) { return parseInt(h + h, 16); });
    if ((m = /^#([0-9a-f]{6})/i.exec(c))) return [0, 2, 4].map(function (i) { return parseInt(m[1].substr(i, 2), 16); });
    if ((m = /^rgba?\(([^)]+)\)/i.exec(c))) return m[1].split(/[ ,\/]+/).map(parseFloat).slice(0, 3);
    try {
      var cv = document.createElement('canvas').getContext('2d');
      cv.fillStyle = '#000'; cv.fillStyle = c;
      if (cv.fillStyle !== c) return parse(cv.fillStyle);
    } catch (e) {}
    return [128, 128, 128];
  }
  function hex(a) {
    return '#' + a.map(function (v) { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? '0' : '') + v.toString(16); }).join('');
  }
  function mix(c, t, amt) { var a = parse(c), b = parse(t); return hex(a.map(function (v, i) { return v + (b[i] - v) * amt; })); }
  function lighten(c, t) { return mix(c, '#ffffff', t); }
  function darken(c, t) { return mix(c, '#000000', t); }

  function mk(paint, accent) {
    var n = ++UID, p = hex(parse(paint)), a = hex(parse(accent));
    return {
      n: n, p: p, a: a, c: 0,
      hi: lighten(p, 0.5), md: lighten(p, 0.18), lo: darken(p, 0.3), dk: darken(p, 0.62),
      ah: lighten(a, 0.5), ad: darken(a, 0.42),
      id: function (s) { return s + n; }
    };
  }

  /* ---------- svg snippet helpers ---------- */
  function P(d, f, x) { return '<path d="' + d + '" fill="' + f + '" ' + (x || '') + '/>'; }
  function R(x, y, w, h, f, rx, e) { return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + (rx || 0) + '" fill="' + f + '" ' + (e || '') + '/>'; }
  function Ci(x, y, r, f, e) { return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + f + '" ' + (e || '') + '/>'; }
  function El(x, y, rx, ry, f, e) { return '<ellipse cx="' + x + '" cy="' + y + '" rx="' + rx + '" ry="' + ry + '" fill="' + f + '" ' + (e || '') + '/>'; }
  function L(d, s, w, o, e) { return '<path d="' + d + '" fill="none" stroke="' + s + '" stroke-width="' + w + '" stroke-opacity="' + (o == null ? 1 : o) + '" stroke-linecap="round" stroke-linejoin="round" ' + (e || '') + '/>'; }
  function U(k, n) { return 'url(#' + k.id(n) + ')'; }

  function lg(id, stops, x1, y1, x2, y2) {
    return '<linearGradient id="' + id + '" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '">' +
      stops.map(function (s) { return '<stop offset="' + s[0] + '" stop-color="' + s[1] + '"' + (s[2] != null ? ' stop-opacity="' + s[2] + '"' : '') + '/>'; }).join('') + '</linearGradient>';
  }
  function rg(id, stops) {
    return '<radialGradient id="' + id + '">' +
      stops.map(function (s) { return '<stop offset="' + s[0] + '" stop-color="' + s[1] + '"' + (s[2] != null ? ' stop-opacity="' + s[2] + '"' : '') + '/>'; }).join('') + '</radialGradient>';
  }

  function defs(k) {
    var I = k.id;
    return lg(I('bg'), [[0, k.hi], [0.26, k.md], [0.58, k.p], [1, k.lo]], 0, 0, 0, 1) +
      lg(I('ag'), [[0, k.ah], [0.5, k.a], [1, k.ad]], 0, 0, 0, 1) +
      lg(I('sx'), [[0, '#fff', 0], [0.3, '#fff', 0.2], [0.42, '#fff', 0], [0.78, '#fff', 0.1], [1, '#fff', 0]], 0, 0, 1, 0.25) +
      lg(I('sh'), [[0, '#fff', 0.38], [0.22, '#fff', 0.08], [0.4, '#fff', 0]], 0, 0, 0, 1) +
      lg(I('ds'), [[0.5, '#000', 0], [1, '#000', 0.5]], 0, 0, 0, 1) +
      lg(I('wg'), [[0, '#7fa6c8'], [0.4, '#243a55'], [1, '#0a1220']], 0, 0, 0, 1) +
      lg(I('ch'), [[0, '#ffffff'], [0.38, '#c9d1da'], [0.52, '#6c7682'], [1, '#e8edf2']], 0, 0, 0, 1) +
      lg(I('dkm'), [[0, '#3a3f49'], [1, '#101216']], 0, 0, 0, 1) +
      lg(I('tl'), [[0, '#ff7a7a'], [0.5, '#e11d2e'], [1, '#7a0a14']], 0, 0, 0, 1) +
      rg(I('hl'), [[0, '#ffffff'], [0.55, '#fff3b0'], [1, '#e8b923']]) +
      rg(I('gl'), [[0, '#fff6c8', 0.7], [1, '#fff6c8', 0]]) +
      rg(I('tg'), [[0, '#ff2a3a', 0.7], [1, '#ff2a3a', 0]]) +
      rg(I('ac'), [[0, k.ah, 0.95], [0.5, k.a, 0.5], [1, k.a, 0]]);
  }

  function win(k, d, x, y, w, h) {
    var c = k.id('cw' + (++k.c)), x0 = x + w * 0.12, sl = h * 0.6;
    return '<clipPath id="' + c + '"><path d="' + d + '"/></clipPath>' + P(d, U(k, 'wg')) +
      '<g clip-path="url(#' + c + ')">' +
      P('M' + x0 + ' ' + (y + h) + ' L' + (x0 + w * 0.2) + ' ' + (y + h) + ' L' + (x0 + w * 0.2 + sl) + ' ' + y + ' L' + (x0 + sl) + ' ' + y + 'Z', '#fff', 'opacity=".24"') +
      P('M' + (x0 + w * 0.26) + ' ' + (y + h) + ' L' + (x0 + w * 0.32) + ' ' + (y + h) + ' L' + (x0 + w * 0.32 + sl) + ' ' + y + ' L' + (x0 + w * 0.26 + sl) + ' ' + y + 'Z', '#fff', 'opacity=".14"') +
      '</g>' + L(d, '#05080d', 0.9, 0.6);
  }
  function head(k, x, y, w, h, rx) {
    rx = rx == null ? 2 : rx;
    return El(x + w + 2, y + h / 2, 15, h + 3, U(k, 'gl')) + R(x - 0.8, y - 0.8, w + 1.6, h + 1.6, '#626b76', rx + 0.5) +
      R(x, y, w, h, U(k, 'hl'), rx) + El(x + w * 0.65, y + h * 0.35, w * 0.2, h * 0.18, '#fff', 'opacity=".9"');
  }
  function tail(k, x, y, w, h) {
    return El(x - 1, y + h / 2, 9, h + 2, U(k, 'tg')) + R(x - 0.6, y - 0.6, w + 1.2, h + 1.2, '#2a0d10', 2) +
      R(x, y, w, h, U(k, 'tl'), 1.5) + R(x + 0.6, y + 0.5, w * 0.5, 1.2, '#fff', 0.6, 'opacity=".5"');
  }
  function handle(x, y) { return R(x, y, 9, 2.6, '#000', 1.3, 'opacity=".55"') + R(x, y - 0.7, 9, 1.4, '#fff', 0.7, 'opacity=".4"'); }
  function mirror(k, x, y) { return P('M' + x + ' ' + y + ' L' + (x + 8) + ' ' + y + ' Q' + (x + 11) + ' ' + (y + 1) + ' ' + (x + 10) + ' ' + (y + 5) + ' L' + (x + 2) + ' ' + (y + 5) + 'Z', U(k, 'bg')) + L('M' + x + ' ' + (y + 0.6) + ' L' + (x + 8) + ' ' + (y + 0.6), '#fff', 0.8, 0.5) + L('M' + (x + 1) + ' ' + (y + 5) + ' L' + (x - 1) + ' ' + (y + 8), '#14161a', 1.4); }
  function pipe(k, x, y, w, h) { return R(x, y, w, h, U(k, 'ch'), h / 2) + Ci(x, y + h / 2, h / 2, '#14161a') + Ci(x, y + h / 2, h / 2 - 1, '#050607'); }

  /* ---------- body wrapper: wheel arches, gradients, gloss ---------- */
  function wrap(k, sil, wheels, inner, o) {
    o = o || {};
    var I = k.id, ar = o.arch || wheels.map(function () { return true; });
    var holes = '', wells = '', lips = '';
    wheels.forEach(function (w, i) {
      if (!ar[i]) return;
      holes += Ci(w.x, w.y, w.r + 4, '#000');
      wells += Ci(w.x, w.y, w.r + 7, '#05060a');
      lips += '<circle cx="' + w.x + '" cy="' + w.y + '" r="' + (w.r + 4.6) + '" fill="none" stroke="' + k.dk + '" stroke-width="1.6"/>' +
        '<circle cx="' + w.x + '" cy="' + w.y + '" r="' + (w.r + 6.2) + '" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="1"/>';
    });
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 100" width="240" height="100">' +
      '<defs>' + defs(k) + '<clipPath id="' + I('sil') + '"><path d="' + sil + '"/></clipPath>' +
      '<mask id="' + I('wm') + '" maskUnits="userSpaceOnUse" x="0" y="0" width="240" height="100"><rect width="240" height="100" fill="#fff"/>' + holes + '</mask></defs>' +
      (o.back || '') +
      '<g clip-path="url(#' + I('sil') + ')">' + wells + '</g>' +
      '<g mask="url(#' + I('wm') + ')">' + P(sil, U(k, 'bg')) + P(sil, U(k, 'sx')) + P(sil, U(k, 'sh')) + P(sil, U(k, 'ds')) + inner + '</g>' +
      '<g clip-path="url(#' + I('sil') + ')">' + lips + '</g>' + (o.front || '') + '</svg>';
  }

  /* ---------- wheels ---------- */
  function wheelInner(r) {
    var n = ++UID, g = 'wr' + n, s = '';
    for (var i = 0; i < 5; i++) s += '<rect x="' + (-r * 0.085) + '" y="' + (-r * 0.6) + '" width="' + (r * 0.17) + '" height="' + (r * 0.6) + '" rx="' + (r * 0.06) + '" fill="url(#' + g + 's)" transform="rotate(' + (i * 72) + ')"/>';
    var lugs = '';
    for (i = 0; i < 5; i++) lugs += '<circle cx="0" cy="' + (-r * 0.2) + '" r="' + (r * 0.035) + '" fill="#2b2f36" transform="rotate(' + (i * 72 + 36) + ')"/>';
    return '<defs><radialGradient id="' + g + '"><stop offset="0.7" stop-color="#e9edf2"/><stop offset="0.92" stop-color="#8a95a2"/><stop offset="1" stop-color="#cfd6de"/></radialGradient>' +
      '<linearGradient id="' + g + 's" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9aa4b0"/><stop offset="0.5" stop-color="#f4f7fa"/><stop offset="1" stop-color="#7d8793"/></linearGradient></defs>' +
      '<circle r="' + r + '" fill="#0d0e11"/>' +
      '<circle r="' + (r * 0.9) + '" fill="none" stroke="#2b2e35" stroke-width="' + (r * 0.17) + '" stroke-dasharray="' + (r * 0.2) + ' ' + (r * 0.17) + '"/>' +
      '<circle r="' + (r * 0.76) + '" fill="#17181c" stroke="#32353d" stroke-width="' + Math.max(0.6, r * 0.04) + '"/>' +
      '<circle r="' + (r * 0.62) + '" fill="url(#' + g + ')"/>' +
      '<circle r="' + (r * 0.5) + '" fill="#15171b"/>' + s +
      '<circle r="' + (r * 0.2) + '" fill="#d5dbe2" stroke="#6c7682" stroke-width="' + (r * 0.03) + '"/>' + lugs +
      '<circle r="' + (r * 0.07) + '" fill="#3b4048"/>';
  }
  function wheelSVG(r) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + (-r) + ' ' + (-r) + ' ' + (2 * r) + ' ' + (2 * r) + '" width="' + (2 * r) + '" height="' + (2 * r) + '">' + wheelInner(r) + '</svg>';
  }

  /* ================== THE VEHICLES ================== */
  var V = [];
  function add(def) { V.push(def); }

  /* 1. SPRINT - compact hatchback */
  (function () {
    var wheels = [{ x: 62, y: 76, r: 14 }, { x: 180, y: 76, r: 14 }];
    var sil = 'M24 78 L24 56 Q24 46 34 38 Q44 23 68 22 L122 22 Q142 22 152 36 L168 50 L204 55 Q218 58 219 68 L219 78 Z';
    add({
      id: 'sprint', name: 'Sprint', tagline: 'Peppy little hatch. Everyone starts here.', price: 0, level: 1,
      w: 240, h: 100, wheels: wheels, hover: false, exhaust: { x: 14, y: 75 },
      body: function (paint, accent) {
        var k = mk(paint, accent);
        var inner =
          P('M24 69 L219 71 L219 75 L24 73Z', U(k, 'ag')) + P('M24 69 L219 71 L219 71.8 L24 69.8Z', '#fff', 'opacity=".35"') +
          L('M26 55 L204 61', '#fff', 1, 0.28) +
          L('M96 48 L96 70 M150 49 L152 70', k.dk, 1, 0.6) +
          win(k, 'M32 47 Q34 38 44 32 Q54 28 68 28 L94 28 L94 47Z', 32, 28, 62, 19) +
          win(k, 'M99 28 L121 28 Q138 28 146 38 L156 47 L99 47Z', 99, 28, 57, 19) +
          L('M38 36 Q47 25 68 23.6 L122 23.6 Q141 23.8 150 35', '#fff', 1.6, 0.55) +
          L('M156 38 L168 51 L204 56.4', '#fff', 1.2, 0.5) +
          handle(104, 53) + handle(139, 53) + mirror(k, 152, 42) +
          R(198, 68, 22, 8, U(k, 'dkm'), 2) + R(206, 70, 10, 2, '#000', 1) + R(202, 66, 18, 1.6, U(k, 'ch'), 0.8) +
          head(k, 203, 58, 13, 6.5, 2.5) + L('M205 66 L218 68', '#000', 0.8, 0.4) +
          tail(k, 24, 52, 5, 11) + R(22, 70, 11, 8, U(k, 'dkm'), 2) +
          P('M50 26 L72 22 Q76 21 80 23 L62 27Z', k.dk, 'opacity=".0"') +
          R(46, 18.4, 70, 2.4, U(k, 'ch'), 1.2) +
          pipe(k, 14, 73.5, 10, 4);
        return wrap(k, sil, wheels, inner);
      }
    });
  })();

  /* 2. CRUISER - classic three-box sedan/coupe */
  (function () {
    var wheels = [{ x: 60, y: 77, r: 14 }, { x: 184, y: 77, r: 14 }];
    var sil = 'M12 80 L12 62 Q12 56 20 55 L52 53 Q62 52 70 40 Q80 28 106 27 L134 27 Q148 28 158 38 Q166 48 176 52 L216 56 Q229 58 230 68 L230 80 Z';
    add({
      id: 'cruiser', name: 'Cruiser', tagline: 'Smooth, stylish and chrome-trimmed.', price: 400, level: 2,
      w: 240, h: 100, wheels: wheels, hover: false, exhaust: { x: 6, y: 77 },
      body: function (paint, accent) {
        var k = mk(paint, accent);
        var inner =
          win(k, 'M70 50 Q78 34 96 32 L104 32 L104 50Z', 70, 32, 34, 18) +
          win(k, 'M109 32 L132 32 Q144 33 152 41 Q158 48 164 50 L109 50Z', 109, 32, 55, 18) +
          L('M66 51.5 L168 51.5', U(k, 'ch'), 1.8) +
          L('M14 65 L228 67', U(k, 'ch'), 1.6) + L('M14 71 L228 73', k.a, 2.4, 0.95) +
          L('M106 51 L106 72 M154 51 L156 72', k.dk, 1, 0.6) +
          L('M24 54 L50 52.5 Q62 51 70 40 Q80 29 106 28 L134 28 Q146 29 154 37', '#fff', 1.4, 0.5) +
          L('M176 52.5 L216 56.5', '#fff', 1.2, 0.5) +
          handle(112, 56) + handle(142, 56) + mirror(k, 152, 43) +
          R(222, 60, 8, 12, U(k, 'ch'), 1.5) + L('M224 62 L224 70 M226.5 62 L226.5 70', '#2a2f36', 0.8) +
          head(k, 212, 57, 11, 6, 2.5) + R(206, 72, 24, 6, U(k, 'ch'), 2.5) +
          tail(k, 12, 57, 5, 9) + R(8, 72, 11, 6, U(k, 'ch'), 2.5) +
          R(14, 70.5, 3, 1.5, '#fff', 0.7, 'opacity=".5"') +
          pipe(k, 2, 75, 12, 4);
        return wrap(k, sil, wheels, inner);
      }
    });
  })();

  /* 3. BRAWLER - muscle car */
  (function () {
    var wheels = [{ x: 60, y: 77, r: 15 }, { x: 182, y: 77, r: 15 }];
    var sil = 'M10 80 L10 58 Q10 52 18 51 L50 49 Q56 48 62 46 Q76 32 100 30 L124 30 Q134 30 142 36 L160 49 L206 52 Q229 54 231 66 L231 80 Z';
    add({
      id: 'brawler', name: 'Brawler', tagline: 'Big V8 attitude with a hood scoop to match.', price: 900, level: 4,
      w: 240, h: 100, wheels: wheels, hover: false, exhaust: { x: 100, y: 74 },
      body: function (paint, accent) {
        var k = mk(paint, accent);
        var scoop = 'M166 50 Q170 41 184 40 L196 41 Q205 43 208 52Z';
        var inner =
          P('M10 61 L170 60 L206 64 L206 68.5 L170 65 L10 66Z', U(k, 'ag')) +
          P('M10 61 L170 60 L206 64 L206 65 L170 61 L10 62Z', '#fff', 'opacity=".3"') +
          win(k, 'M69 46 Q78 35 98 33 L110 33 L110 47Z', 69, 33, 41, 14) +
          win(k, 'M115 33 L123 33 Q131 33 136 39 L148 48 L115 48Z', 115, 33, 33, 15) +
          L('M16 51 L50 49.5 Q56 48.6 62 46.4 Q76 32.6 100 30.8 L124 30.8 Q133 30.8 141 36.5', '#fff', 1.4, 0.55) +
          L('M160 49.5 L206 52.5', '#fff', 1.2, 0.5) +
          L('M112 48 L112 72 M150 50 L152 72', k.dk, 1, 0.6) +
          handle(118, 54) + mirror(k, 148, 41) +
          '<g>' + P(scoop, U(k, 'bg')) + P(scoop, U(k, 'sh')) + P('M178 44 L196 44.6 L199 49.5 L174.5 49.5Z', '#07080b') + L('M180 46 L196 46.5 M178.5 48 L197.5 48.4', '#3a3f49', 0.8) + L(scoop, '#fff', 0.8, 0.35) + '</g>' +
          P('M8 50 L10 45 L36 46.5 L30 50Z', U(k, 'ag')) + L('M10 45.4 L36 46.7', '#fff', 0.8, 0.6) +
          R(98, 71.5, 56, 4.5, U(k, 'ch'), 2.2) + L('M102 72.8 L150 72.8', '#fff', 0.8, 0.6) +
          R(220, 58, 11, 11, '#07080b', 1.5) + L('M221 61 L230 61 M221 64 L230 64 M221 67 L230 67', U(k, 'ch'), 0.9) +
          head(k, 210, 55, 8, 6, 3) + head(k, 200, 55.4, 7, 5.6, 3) +
          R(206, 72, 26, 6, U(k, 'ch'), 2.5) +
          tail(k, 10, 54, 4, 11) + R(7, 70, 12, 8, U(k, 'ch'), 2.5) +
          pipe(k, 2, 72, 12, 3.6) + pipe(k, 4, 76, 12, 3.6);
        return wrap(k, sil, wheels, inner);
      }
    });
  })();

  /* 4. HAULER - pickup */
  (function () {
    var wheels = [{ x: 62, y: 76, r: 15 }, { x: 186, y: 76, r: 15 }];
    var sil = 'M8 80 L8 50 L90 50 L92 32 Q94 27 100 27 L146 27 Q154 27 160 35 L172 50 L216 54 Q229 56 230 66 L230 80 Z';
    add({
      id: 'hauler', name: 'Hauler', tagline: 'Built tough with room in the back.', price: 1500, level: 6,
      w: 240, h: 100, wheels: wheels, hover: false, exhaust: { x: 5, y: 77 },
      body: function (paint, accent) {
        var k = mk(paint, accent);
        var inner =
          R(8, 47, 84, 5, k.dk, 1.5) + R(8, 47, 84, 1.6, '#fff', 0.8, 'opacity=".4"') +
          R(8, 51, 5, 29, k.dk, 1, 'opacity=".55"') +
          L('M26 57 L26 74 M42 57 L42 74 M78 57 L78 74', k.dk, 1.6, 0.55) + L('M27.5 57 L27.5 74 M43.5 57 L43.5 74 M79.5 57 L79.5 74', '#fff', 0.8, 0.25) +
          P('M8 70 L230 71 L230 75 L8 74Z', U(k, 'ag')) +
          win(k, 'M97 31 L143 31 Q151 31 156 38 L164 49 L97 49Z', 97, 31, 67, 18) +
          L('M120 31 L120 49', '#14161a', 2) +
          L('M95 28.4 L146 28.4 Q153 28.6 158 35', '#fff', 1.4, 0.5) +
          L('M163 38 L172 50.5 L216 54.5', '#fff', 1.2, 0.5) +
          L('M93 49.5 L93 74 M160 52 L162 73', k.dk, 1, 0.6) +
          handle(100, 54) + mirror(k, 156, 41) +
          R(86, 36, 4, 12, U(k, 'ch'), 1.5) + R(86, 33, 6, 3, '#14161a', 1.2) +
          Ci(104, 23.5, 2.6, U(k, 'hl')) + Ci(113, 23.5, 2.6, U(k, 'hl')) + Ci(122, 23.5, 2.6, U(k, 'hl')) + Ci(131, 23.5, 2.6, U(k, 'hl')) + R(100, 25.5, 35, 2, '#14161a', 1) +
          R(222, 56, 8, 14, '#0a0b0e', 1.5) + L('M223 59 L229 59 M223 62.5 L229 62.5 M223 66 L229 66', U(k, 'ch'), 1) +
          head(k, 212, 57, 11, 7, 2.5) + R(210, 70, 21, 8, U(k, 'dkm'), 2) + R(212, 69, 18, 2, U(k, 'ch'), 1) +
          R(6, 70, 14, 8, U(k, 'dkm'), 2) + tail(k, 8, 53, 4, 12) +
          pipe(k, 1, 76, 11, 4);
        return wrap(k, sil, wheels, inner);
      }
    });
  })();

  /* 5. EMBER - flame hot rod */
  (function () {
    var wheels = [{ x: 62, y: 73, r: 17 }, { x: 190, y: 77, r: 13 }];
    var sil = 'M18 72 L18 52 Q20 46 32 45 L46 44 L55 34 Q59 30 68 30 L100 30 Q108 30 112 36 L118 44 L128 47 L192 47 L196 42 L212 42 L212 72 Z';
    add({
      id: 'ember', name: 'Ember', tagline: 'Chopped, blown and covered in flames.', price: 2400, level: 8,
      w: 240, h: 100, wheels: wheels, hover: false, exhaust: { x: 12, y: 71 },
      body: function (paint, accent) {
        var k = mk(paint, accent);
        var fl = [
          'M198 68 C180 69 160 66 142 60 C150 59 156 56 150 52 C164 56 170 55 168 49 C180 54 190 54 198 52Z',
          'M160 69 C146 69 130 67 112 62 C119 61 122 58 117 55 C128 58 134 57 134 52 C142 57 150 58 160 58Z'
        ];
        var inner =
          win(k, 'M58 43 L62 36 Q64 33 70 33 L98 33 Q104 33 107 38 L111 43Z', 58, 33, 53, 10) +
          L('M54 34.5 Q58 29.8 68 29.8 L100 29.8 Q108 29.8 112 35.6', '#fff', 1.4, 0.55) +
          P(fl[0], U(k, 'ag')) + P(fl[1], U(k, 'ag')) +
          P('M196 66 C182 67 168 64 154 60 C161 59 163 57 160 55 C170 58 180 58 196 56Z', '#fff7c0', 'opacity=".8"') +
          P('M138 66 C128 65 120 63 112 61 C118 60 120 58 118 57 C124 59 132 60 138 60Z', '#fff7c0', 'opacity=".7"') +
          L('M196 66 C180 69 160 66 142 60 M160 69 C146 69 130 67 112 62', '#fff', 0.8, 0.5) +
          L('M130 48 L192 48', '#fff', 1.2, 0.5) +
          L('M134 49 L134 56 M140 49 L140 56 M146 49 L146 56', '#000', 1.2, 0.35) +
          L('M110 44 L110 70', k.dk, 1, 0.6) + handle(96, 46) +
          R(196, 36, 16, 36, U(k, 'ch'), 3) + R(198, 40, 12, 28, '#101216', 2) +
          L('M200 41 L200 67 M203 41 L203 67 M206 41 L206 67 M209 41 L209 67', U(k, 'ch'), 0.9) +
          R(193, 70, 22, 5, U(k, 'ch'), 2.5) +
          tail(k, 18, 53, 4, 8) + R(15, 66, 8, 7, U(k, 'dkm'), 2) +
          R(30, 71, 108, 4, U(k, 'ch'), 2) + L('M34 72.2 L134 72.2', '#fff', 0.8, 0.6) +
          pipe(k, 12, 70, 14, 4);
        var front =
          /* supercharger + stacks drawn on top of the hood */
          P('M146 47 L148 37 Q155 33 170 35 L174 47Z', U(k, 'ch')) + P('M150 38 Q158 35 169 37 L170 40 L151 41Z', '#fff', 'opacity=".5"') +
          R(166, 30, 14, 9, '#0b0c0f', 2) + L('M168 33 L178 33 M168 36 L178 36', U(k, 'ch'), 0.9) +
          R(150, 28, 10, 8, U(k, 'dkm'), 2) + R(151, 26, 8, 3, U(k, 'ch'), 1.5) +
          R(180, 40, 4, 8, U(k, 'ch'), 1.5) + R(186, 40, 4, 8, U(k, 'ch'), 1.5) +
          Ci(204, 36, 6, '#6b747e') + Ci(204, 36, 5, U(k, 'hl')) + Ci(203, 34.5, 1.6, '#fff', 'opacity=".9"') + El(214, 36, 14, 10, U(k, 'gl'));
        return wrap(k, sil, wheels, inner, { arch: [true, false], front: front });
      }
    });
  })();

  /* 6. VORTEX - low supercar */
  (function () {
    var wheels = [{ x: 58, y: 77, r: 13 }, { x: 184, y: 77, r: 13 }];
    var sil = 'M12 80 L12 66 Q12 60 20 58 L54 54 Q84 38 112 36 L138 37 Q152 39 164 49 L210 59 Q230 63 231 72 L231 80 Z';
    add({
      id: 'vortex', name: 'Vortex', tagline: 'Low, wide and brutally fast.', price: 3800, level: 11,
      w: 240, h: 100, wheels: wheels, hover: false, exhaust: { x: 10, y: 68 },
      body: function (paint, accent) {
        var k = mk(paint, accent);
        var inner =
          win(k, 'M66 54 Q88 41 112 40 L136 41 Q148 42 158 50 L160 52 L66 55Z', 66, 40, 94, 14) +
          L('M108 40 L106 55', '#0a0b0e', 2.2) + L('M60 56.4 Q86 38.5 112 36.8 L138 37.8 Q151 39.6 163 49', '#fff', 1.4, 0.6) +
          L('M164 49.4 L210 59.4', '#fff', 1.2, 0.55) +
          P('M118 56 L146 61 L150 68 L112 68Z', '#07080b') + P('M118 56 L146 61 L147 63 L116 59Z', U(k, 'ag')) + L('M122 62 L146 65 M120 65 L148 68', '#3a3f49', 1) +
          P('M12 66 L40 64 L120 70 L204 66 L231 72 L231 74 L204 69 L120 73 L40 67 L12 69Z', U(k, 'ag')) +
          L('M80 57 L84 74 M154 64 L156 76', k.dk, 1, 0.55) + handle(94, 59) +
          P('M214 61 L229 66 L229 69 L212 64.5Z', '#07080b') + P('M215 62 L228 66.4 L228 67.6 L214 63.6Z', U(k, 'hl')) + El(228, 67, 10, 5, U(k, 'gl')) +
          P('M214 70 L231 74 L231 78 L212 76Z', '#07080b') + P('M216 72.5 L229 75.5', U(k, 'ch'), '') + L('M216 73 L229 76', U(k, 'ch'), 1) +
          P('M12 64 L16 62 L16 67 L12 68Z', U(k, 'tl')) + Ci(14, 65, 8, U(k, 'tg'), 'opacity=".8"') +
          P('M12 70 L34 70 L34 80 L12 80Z', '#0b0c0f') + L('M17 71 L17 80 M22 71 L22 80 M27 71 L27 80', '#2b2f36', 1.4) +
          pipe(k, 6, 66, 9, 3.4) +
          mirror(k, 150, 44);
        var front =
          /* rear wing */
          L('M18 57 L16 46 M34 56 L34 46', '#14161a', 2.2) +
          P('M2 42 L48 38 Q50 38 50 40 L50 41.5 L4 46Z', '#101216') + P('M2 42 L48 38 L49 39.2 L3 43.2Z', U(k, 'ag')) +
          P('M0 38 L8 37 L8 48 L2 48Z', U(k, 'ag')) + P('M44 36 L50 36 L50 45 L45 45Z', U(k, 'ag')) + L('M3 40 L47 36.6', '#fff', 0.8, 0.6);
        return wrap(k, sil, wheels, inner, { front: front });
      }
    });
  })();

  /* 7. WASP - motorcycle with rider */
  (function () {
    var wheels = [{ x: 52, y: 73, r: 17 }, { x: 190, y: 73, r: 17 }];
    var sil = 'M96 48 Q104 34 128 34 Q146 36 150 46 L150 58 L96 58Z M148 58 L148 46 Q152 32 172 28 Q192 28 204 42 Q208 48 202 52 L186 54 L170 58Z M22 50 Q40 40 66 42 L90 46 L90 56 L28 58Z';
    add({
      id: 'wasp', name: 'Wasp', tagline: 'Light, nimble. Stings the corners.', price: 5200, level: 14,
      w: 240, h: 100, wheels: wheels, hover: false, exhaust: { x: 18, y: 76 },
      body: function (paint, accent) {
        var k = mk(paint, accent);
        var suit = lg(k.id('su'), [[0, '#3a3f4b'], [1, '#0e1015']], 0, 0, 0, 1);
        var back =
          /* rider is behind nothing; drawn in "back" so bike panels overlap legs */
          '<defs>' + suit + '</defs>' +
          L('M190 73 L168 38', '#2b2f36', 5.5) + L('M186 73 L164 38', U(k, 'ch'), 2.2) + L('M193 73 L171 38', '#14161a', 1.2) +
          L('M52 73 L98 63', '#1a1c21', 6) + L('M52 73 L98 63', '#4a505a', 1.4) +
          R(86, 58, 56, 24, U(k, 'dkm'), 5) + R(92, 62, 22, 16, '#1a1d22', 3) +
          L('M118 62 L138 62 M118 66 L138 66 M118 70 L138 70 M118 74 L138 74', '#4a505a', 1.4) +
          L('M96 80 Q60 82 36 78', U(k, 'ch'), 5.5) + R(16, 72, 30, 8, U(k, 'ch'), 4) + R(16, 72, 30, 2.4, '#fff', 1.2, 'opacity=".55"') + R(14, 73, 5, 6, '#0a0b0e', 2.5) +
          L('M100 66 L114 78', '#2b2f36', 3) + Ci(114, 78, 3, '#596271') +
          /* rider */
          L('M88 44 L124 54', 'url(#' + k.id('su') + ')', 11) + L('M124 54 L110 76', 'url(#' + k.id('su') + ')', 9) + R(104, 74, 14, 6, '#0a0b0e', 3) +
          L('M88 42 L124 22', 'url(#' + k.id('su') + ')', 15) + L('M92 39 L122 21', k.a, 2.4, 0.9) +
          L('M127 25 L150 24 L166 33', 'url(#' + k.id('su') + ')', 7) + Ci(167, 34, 4.2, '#0a0b0e') +
          Ci(136, 11, 10.5, U(k, 'bg')) + Ci(136, 11, 10.5, U(k, 'sh')) +
          P('M140 5 Q149 6 148 14 L147 17 Q140 18 137 13Z', '#0a1018') + P('M141 7 Q146 7.4 146.5 11 L142 11Z', '#9ec5e8', 'opacity=".55"') +
          L('M128 6 Q136 0 144 3', '#fff', 1.2, 0.6) + L('M127 11 L135 17', k.a, 2, 0.95);
        var inner =
          /* tank + fairing + tail cowl */
          L('M98 47 Q106 35.6 128 35.4 Q144 37 148 46', '#fff', 1.6, 0.6) + L('M104 50 L148 52', k.a, 3, 0.95) +
          R(96, 57, 54, 2.4, '#000', 1, 'opacity=".25"') +
          P('M30 50 Q44 44 66 45 L90 49 L90 55 L36 57Z', '#0f1114') +
          L('M24 50 Q40 41.4 66 43.4', '#fff', 1.2, 0.55) + P('M26 54 L88 55 L88 57 L28 57.6Z', U(k, 'ag')) +
          tail(k, 22, 49, 4, 6) +
          P('M170 29 Q176 18 188 15 L192 18 Q184 23 182 31Z', '#9ec5e8', 'opacity=".42"') + L('M170 29 Q176 18 188 15', '#fff', 1, 0.7) +
          L('M150 56 Q176 54 202 50', k.dk, 1.2, 0.7) +
          L('M150 46 Q154 33 172 29.6 Q190 29.6 202 42', '#fff', 1.4, 0.55) + P('M170 36 L200 44 L198 50 L168 44Z', U(k, 'ag'), 'opacity=".85"') +
          head(k, 191, 41, 9, 6, 3);
        return wrap(k, sil, wheels, inner, { arch: [false, false], back: back });
      }
    });
  })();

  /* 8. TITAN - monster truck */
  (function () {
    var wheels = [{ x: 64, y: 72, r: 26 }, { x: 178, y: 72, r: 26 }];
    var sil = 'M14 66 L14 34 Q14 30 20 30 L84 30 L88 14 Q90 9 96 9 L138 9 Q146 9 152 16 L166 30 L214 33 Q228 35 230 46 L230 66 Z';
    add({
      id: 'titan', name: 'Titan', tagline: 'Crushes anything in its lane.', price: 7500, level: 18,
      w: 240, h: 100, wheels: wheels, hover: false, exhaust: { x: 80, y: 3 },
      body: function (paint, accent) {
        var k = mk(paint, accent);
        var inner =
          P('M14 54 L40 40 L60 52 L120 40 L165 54 L230 40 L230 46 L165 60 L120 47 L60 59 L40 47 L14 60Z', U(k, 'ag'), 'opacity=".95"') +
          L('M14 54 L40 40 L60 52 L120 40 L165 54 L230 40', '#fff', 1, 0.45) +
          R(14, 61, 216, 6, '#0a0b0e', 1) +
          win(k, 'M94 13 L138 13 Q145 13 150 19 L160 29 L94 29Z', 94, 13, 66, 16) +
          L('M116 13 L116 29', '#0a0b0e', 2) +
          L('M90 10.4 L138 10.4 Q144 10.6 149 17', '#fff', 1.4, 0.55) + L('M20 31 L84 31', '#fff', 1.2, 0.5) + L('M166 31.4 L214 34.4', '#fff', 1.2, 0.5) +
          L('M90 30 L90 60 M162 30 L164 60', k.dk, 1, 0.6) + handle(98, 33) +
          R(98, 4.4, 38, 5, '#14161a', 2) + Ci(104, 6.6, 2.4, U(k, 'hl')) + Ci(112, 6.6, 2.4, U(k, 'hl')) + Ci(120, 6.6, 2.4, U(k, 'hl')) + Ci(128, 6.6, 2.4, U(k, 'hl')) +
          R(78, 3, 4, 31, U(k, 'ch'), 2) + R(86, 8, 3, 26, U(k, 'ch'), 1.5, 'opacity=".9"') + Ci(80, 3, 2, '#14161a') +
          R(220, 40, 10, 18, '#0a0b0e', 2) + L('M221 44 L229 44 M221 48 L229 48 M221 52 L229 52', U(k, 'ch'), 1) +
          head(k, 212, 36, 10, 7, 2.5) + R(208, 58, 24, 8, U(k, 'dkm'), 2) + R(209, 57, 22, 2, U(k, 'ch'), 1) +
          tail(k, 14, 36, 4, 10) + R(12, 58, 12, 8, U(k, 'dkm'), 2);
        var front =
          /* chassis, shocks, axles */
          R(30, 66, 176, 5, '#121418', 2) + R(32, 66, 172, 1.4, '#fff', 0.7, 'opacity=".25"') +
          L('M82 66 L78 50 M96 66 L102 50 M146 66 L142 50 M160 66 L166 50', U(k, 'ch'), 3) +
          L('M82 64 L79.5 52 M146 64 L143.5 52', k.a, 1.8, 0.95);
        return wrap(k, sil, wheels, inner, { front: front });
      }
    });
  })();

  /* 9. NIMBUS - hover pod */
  (function () {
    var sil = 'M18 56 Q24 40 66 36 L146 34 Q190 34 220 50 Q232 56 228 62 Q224 70 196 72 L50 72 Q22 72 18 62 Z';
    add({
      id: 'nimbus', name: 'Nimbus', tagline: 'Floats on a cushion of pure light.', price: 11000, level: 22,
      w: 240, h: 100, wheels: [], hover: true, exhaust: { x: 6, y: 56 },
      body: function (paint, accent) {
        var k = mk(paint, accent);
        var I = k.id;
        var back =
          '<defs>' + rg(I('gu'), [[0, k.ah, 0.9], [0.45, k.a, 0.45], [1, k.a, 0]]) + lg(I('bm'), [[0, k.a, 0.7], [1, k.a, 0]], 0, 0, 0, 1) +
          rg(I('th'), [[0, '#fff', 1], [0.35, k.ah, 0.95], [1, k.a, 0]]) + lg(I('cn'), [[0, '#a9d4f5'], [0.35, '#27456a'], [1, '#0b1626']], 0, 0, 0, 1) + '</defs>' +
          P('M36 72 L204 72 L228 98 L12 98Z', U(k, 'bm'), 'opacity=".5"') +
          El(120, 77, 108, 11, U(k, 'gu')) + El(120, 74, 70, 4, '#fff', 'opacity=".35"') +
          P('M22 56 L10 18 Q32 18 62 38Z', U(k, 'bg')) + P('M22 56 L10 18 Q16 18 22 20Z', U(k, 'ag')) + L('M12 18.4 Q32 19 60 37.4', '#fff', 1, 0.5);
        var inner =
          P('M116 34 Q140 30 160 36 L170 70 L108 70Z', U(k, 'sh'), 'opacity=".6"') +
          L('M26 64 Q100 76 204 69', U(k, 'ag'), 2.6) + L('M26 64 Q100 76 204 69', '#fff', 0.8, 0.7) +
          L('M62 38 Q64 56 58 71 M150 34.4 Q156 52 150 71', k.dk, 1, 0.55) +
          L('M24 50 Q30 42.6 66 38 L144 35.6 Q190 35.6 216 50', '#fff', 1.6, 0.6) +
          P('M80 58 L120 58 L128 66 L88 66Z', k.dk, 'opacity=".45"') + L('M84 60 L118 60 M88 63 L123 63', k.ah, 1, 0.8) +
          Ci(176, 56, 2.2, U(k, 'hl')) + Ci(168, 57, 1.6, k.ah) + Ci(160, 58, 1.6, k.ah) +
          P('M214 49 Q228 54 226 60 Q220 58 208 55Z', U(k, 'hl')) + Ci(222, 53, 1.4, '#fff') + El(231, 55, 10, 9, U(k, 'gl')) +
          R(10, 46, 12, 20, '#0b0c10', 4) + R(12, 49, 8, 14, U(k, 'th'), 3);
        var front =
          Ci(14, 56, 9, U(k, 'th'), 'opacity=".9"') + Ci(14, 56, 3.6, '#fff') +
          R(78, 70, 14, 4, '#14161a', 2) + R(150, 70, 14, 4, '#14161a', 2) + R(80, 72, 10, 2.2, U(k, 'th'), 1) + R(152, 72, 10, 2.2, U(k, 'th'), 1) +
          /* canopy */
          P('M92 37 Q108 12 150 18 Q176 25 190 41Z', U(k, 'cn')) +
          '<clipPath id="' + I('cc') + '"><path d="M92 37 Q108 12 150 18 Q176 25 190 41Z"/></clipPath>' +
          '<g clip-path="url(#' + I('cc') + ')">' + P('M104 40 L118 40 L134 14 L120 14Z', '#fff', 'opacity=".28"') + P('M126 40 L130 40 L146 14 L142 14Z', '#fff', 'opacity=".16"') + '</g>' +
          L('M92 37 Q108 12 150 18 Q176 25 190 41', '#0b1626', 1.2) + L('M100 26 Q112 14.6 148 19.6', '#fff', 1.2, 0.7) + L('M92 38 L190 42', k.dk, 2.4);
        return wrap(k, sil, [], inner, { back: back, front: front });
      }
    });
  })();

  /* 10. COMET - rocket dragster */
  (function () {
    var wheels = [{ x: 56, y: 72, r: 18 }, { x: 192, y: 78, r: 12 }];
    var sil = 'M14 42 L186 38 Q222 40 237 52 Q222 62 186 64 L14 62 Z';
    add({
      id: 'comet', name: 'Comet', tagline: 'A rocket with a number plate.', price: 16000, level: 27,
      w: 240, h: 100, wheels: wheels, hover: false, exhaust: { x: 2, y: 52 },
      body: function (paint, accent) {
        var k = mk(paint, accent);
        var I = k.id;
        var back =
          '<defs>' + rg(I('nz'), [[0, '#fff', 1], [0.4, '#ffd27a', 0.95], [1, '#ff6a00', 0]]) + '</defs>' +
          L('M70 66 L56 72 M110 62 L56 72', '#14161a', 3) + L('M178 64 L192 78 M204 63 L192 78', '#14161a', 3) + L('M178 64 L192 78', '#8f99a5', 1) + L('M70 66 L56 72', '#8f99a5', 1);
        var inner =
          P('M14 54 L130 53 Q170 54 237 52 Q222 62 186 64 L14 62Z', U(k, 'ag'), 'opacity=".95"') + L('M14 54.4 L130 53.4 Q170 54.4 232 52.4', '#fff', 1, 0.6) +
          P('M196 39 Q222 41 237 52 Q226 55 214 55 Q210 44 196 39Z', U(k, 'ag')) +
          L('M60 45 L180 41', '#fff', 1.4, 0.55) +
          R(150, 44, 3, 14, '#000', 1, 'opacity=".25"') + R(20, 44, 48, 16, '#000', 3, 'opacity=".2"') + L('M24 48 L62 48 M24 52 L62 52 M24 56 L62 56', U(k, 'ch'), 1.1, 0.8) +
          Ci(120, 51, 7.5, '#fff', 'opacity=".92"') + '<text x="120" y="54.4" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="10" text-anchor="middle" fill="' + k.dk + '">7</text>' +
          Ci(226, 52, 2, '#fff', 'opacity=".7"') +
          P('M10 40 L16 40 L16 64 L10 62Z', '#0b0c10');
        var front =
          /* nozzle + flame cone */
          P('M0 44 L14 38 L14 66 L0 60Z', U(k, 'dkm')) + P('M2 47 L12 43 L12 61 L2 57Z', '#0b0c10') + P('M1 49 L10 47 L10 57 L1 55Z', U(k, 'nz')) + L('M1 44.4 L14 39.4', U(k, 'ch'), 1) +
          /* tail fin */
          P('M22 41 L16 12 Q22 10 34 14 Q56 24 72 40Z', U(k, 'bg')) + P('M22 41 L16 12 Q18 11.6 22 12 L30 41Z', U(k, 'ag')) + L('M18 12.4 Q26 11 34 14.4 Q54 24 70 39', '#fff', 1, 0.5) +
          /* cockpit */
          P('M88 42 Q98 22 124 22 Q144 24 152 41Z', U(k, 'wg')) +
          '<clipPath id="' + I('cc') + '"><path d="M88 42 Q98 22 124 22 Q144 24 152 41Z"/></clipPath>' +
          '<g clip-path="url(#' + I('cc') + ')">' + P('M96 42 L110 42 L120 20 L108 20Z', '#fff', 'opacity=".26"') + '</g>' +
          L('M88 42 Q98 22 124 22 Q144 24 152 41', '#05080d', 1.2) + L('M96 32 Q106 24.6 122 24', '#fff', 1.1, 0.7) + R(94, 39, 52, 4, k.dk, 2) +
          /* chute pack + slick fender */
          R(152, 34, 16, 8, U(k, 'dkm'), 3) + L('M154 36 L166 36', '#6c7682', 1) +
          Ci(192, 78, 14.5, 'none', 'stroke="#000" stroke-opacity=".0"');
        return wrap(k, sil, wheels, inner, { arch: [false, false], back: back, front: front });
      }
    });
  })();

  /* ---------- paints ---------- */
  var PAINTS = [
    { id: 'race-red', name: 'Race Red', paint: '#e11d2e', accent: '#ffffff' },
    { id: 'ocean', name: 'Ocean Blue', paint: '#1e6fe0', accent: '#ffd23f' },
    { id: 'lime', name: 'Lime Zest', paint: '#9dff00', accent: '#111827' },
    { id: 'sunset', name: 'Sunset Orange', paint: '#ff7a1a', accent: '#1f2937' },
    { id: 'midnight', name: 'Midnight Metal', paint: '#27345e', accent: '#5ee7ff' },
    { id: 'silver', name: 'Silver Bullet', paint: '#b9c2cf', accent: '#e11d2e' },
    { id: 'pink', name: 'Neon Pink', paint: '#ff2e93', accent: '#35f2ff' },
    { id: 'purple', name: 'Royal Purple', paint: '#7c3aed', accent: '#fbbf24' },
    { id: 'gold', name: 'Gold Rush', paint: '#d4a72c', accent: '#1b1b1f' },
    { id: 'mint', name: 'Mint Chrome', paint: '#34d9b4', accent: '#0f3d3e' },
    { id: 'pearl', name: 'Pearl White', paint: '#f1f5f9', accent: '#2563eb' },
    { id: 'cyan', name: 'Toxic Cyan', paint: '#00e5ff', accent: '#ff2e93' }
  ];

  /* ---------- public API ---------- */
  function find(id) { for (var i = 0; i < V.length; i++) if (V[i].id === id) return V[i]; return V[0]; }
  var cache = {};
  var VehicleArt = {
    wheelSVG: wheelSVG,
    image: function (id, paint, accent) {
      var key = id + '|' + paint + '|' + accent;
      if (cache[key]) return cache[key];
      cache[key] = new Promise(function (res, rej) {
        var svg = find(id).body(paint, accent).replace('width="240" height="100"', 'width="480" height="200"');
        var url;
        try { url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })); }
        catch (e) { url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); }
        var img = new Image();
        img.onload = function () { res(img); };
        img.onerror = function (e) { delete cache[key]; rej(e); };
        img.src = url;
      });
      return cache[key];
    },
    previewSVG: function (id, paint, accent) {
      var v = find(id), s = '';
      v.wheels.forEach(function (w) { s += '<g transform="translate(' + w.x + ' ' + w.y + ')">' + wheelInner(w.r) + '</g>'; });
      var shadow = v.hover ? '<ellipse cx="120" cy="95" rx="80" ry="3" fill="#000" opacity=".25"/>' : '<ellipse cx="120" cy="91" rx="104" ry="3.5" fill="#000" opacity=".35"/>';
      return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 100" width="240" height="100">' + shadow + v.body(paint, accent) + s + '</svg>';
    },
    _wheelInner: wheelInner
  };

  root.VEHICLES = V;
  root.VehicleArt = VehicleArt;
  root.PAINTS = PAINTS;
})(typeof window !== 'undefined' ? window : globalThis);
