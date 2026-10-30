/* ============================================================
   summary.js — 每日 3:4 总结图生成器
   风格：简约清新 · 近白纸底 / 单一强调色 / 无衬线 / 大留白
   配色仍从当日餐照提取，但调制为干净可读的中明度色
   ============================================================ */
(function (global) {
  'use strict';

  var DEFAULT_PAPER = '#FCFDFC';
  var DEFAULT_COLORS = ['#2FA383', '#5A9BD5', '#E2925B', '#7FA8D8'];

  var INK = '#151A18';
  var INK2 = '#6E7873';
  var INK3 = '#A9B2AD';
  var LINE = '#E7EBE9';

  /* ================= 颜色工具 ================= */
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function hex(c) {
    function h(x) { var s = Math.round(clamp(x, 0, 255)).toString(16); return s.length < 2 ? '0' + s : s; }
    return '#' + h(c[0]) + h(c[1]) + h(c[2]);
  }
  function rgb2hsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    var h = 0, s = 0, l = (mx + mn) / 2, d = mx - mn;
    if (d) {
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0));
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    return [h, s, l];
  }
  function hsl2rgb(h, s, l) {
    if (!s) return [l * 255, l * 255, l * 255];
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    var p = 2 * l - q;
    function f(t) {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    }
    return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
  }

  /** 照片色 → 干净可读的强调色 */
  function accent(r, g, b) {
    var hsl = rgb2hsl(r, g, b);
    var h = hsl[0], s = hsl[1], l = hsl[2];
    s = clamp(s, 0.34, 0.58);
    l = clamp(l, 0.46, 0.58);
    return hex(hsl2rgb(h, s, l));
  }
  /** 近白纸底：保留一点点照片色温，但必须明亮干净 */
  function softPaper(r, g, b) {
    var hsl = rgb2hsl(r, g, b);
    return hex(hsl2rgb(hsl[0], clamp(hsl[1] * 0.25, 0.008, 0.035), 0.982));
  }

  /* ================= 从照片提取配色 ================= */
  function getPalette(src, want) {
    want = want || 3;
    return new Promise(function (resolve) {
      var out = { paper: DEFAULT_PAPER, colors: DEFAULT_COLORS.slice() };
      if (!src) return resolve(out);
      var img = new Image();
      img.onload = function () {
        try {
          var N = 44;
          var cv = document.createElement('canvas');
          cv.width = N; cv.height = N;
          var c = cv.getContext('2d');
          c.drawImage(img, 0, 0, N, N);
          var d = c.getImageData(0, 0, N, N).data;

          var sr = 0, sg = 0, sb = 0, n = 0;
          var buckets = {};
          for (var i = 0; i < d.length; i += 4) {
            var r = d[i], g = d[i + 1], b = d[i + 2];
            sr += r; sg += g; sb += b; n++;
            var key = (r >> 5) + '_' + (g >> 5) + '_' + (b >> 5);
            var bk = buckets[key];
            if (!bk) bk = buckets[key] = { r: 0, g: 0, b: 0, c: 0 };
            bk.r += r; bk.g += g; bk.b += b; bk.c++;
          }
          out.paper = softPaper(sr / n, sg / n, sb / n);

          var arr = [];
          for (var k in buckets) { if (buckets.hasOwnProperty(k)) arr.push(buckets[k]); }
          arr.sort(function (a, b2) { return b2.c - a.c; });

          var picks = [];
          for (var j = 0; j < arr.length && picks.length < want; j++) {
            var it = arr[j];
            var av = [it.r / it.c, it.g / it.c, it.b / it.c];
            var hsl = rgb2hsl(av[0], av[1], av[2]);
            if (hsl[1] < 0.18 || hsl[2] < 0.18 || hsl[2] > 0.92) continue;
            var close = false;
            for (var p = 0; p < picks.length; p++) {
              var dh = Math.abs(hsl[0] - picks[p].h);
              if (dh > 0.5) dh = 1 - dh;
              if (dh < 0.12) { close = true; break; }
            }
            if (close) continue;
            picks.push({ h: hsl[0], rgb: accent(av[0], av[1], av[2]) });
          }
          if (picks.length >= 2) out.colors = picks.map(function (p) { return p.rgb; });
          while (out.colors.length < 4) out.colors.push(DEFAULT_COLORS[out.colors.length % 4]);
          resolve(out);
        } catch (e) {
          resolve(out);
        }
      };
      img.onerror = function () { resolve(out); };
      img.src = src;
    });
  }

  /* ================= 绘制小工具 ================= */
  function setLS(ctx, ls) { if (ls && 'letterSpacing' in ctx) ctx.letterSpacing = ls + 'px'; }

  function txt(ctx, s, x, y, o) {
    o = o || {};
    setLS(ctx, o.ls || 0);
    RD.handText(ctx, s, x, y, {
      size: o.size || 24, weight: o.weight || '500',
      color: o.color || INK, align: o.align || 'left', font: o.font || RD.FONT_UI
    });
    setLS(ctx, 0);
  }
  function w(ctx, s, size, weight, ls, font) {
    setLS(ctx, ls || 0);
    var r = RD.measure(ctx, s, size, font || RD.FONT_UI, weight || '500');
    setLS(ctx, 0);
    return r;
  }
  function el(ctx, s) { return s; }
  function hr(ctx, x0, x1, y, th, color) {
    ctx.fillStyle = color || LINE;
    ctx.fillRect(x0, y, x1 - x0, th || 2);
  }
  function cut(ctx, s, size, weight, maxW, font) {
    if (w(ctx, s, size, weight) <= maxW) return s;
    var t = s;
    while (t.length > 1 && w(ctx, t + '…', size, weight) > maxW) t = t.slice(0, -1);
    return t + '…';
  }

  /* ================= 主绘制 ================= */
  function render(t, pal, opts) {
    opts = opts || {};
    var W = opts.width || 1080;
    var H = opts.height || 1440;
    var u = W / 1080;

    var cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    var ctx = cv.getContext('2d');

    var paper = (pal && pal.paper) || DEFAULT_PAPER;
    var C = (pal && pal.colors) || DEFAULT_COLORS;
    var c1 = C[0], c2 = C[1] || DEFAULT_COLORS[1];
    var c3 = C[2] || DEFAULT_COLORS[2], c4 = C[3] || DEFAULT_COLORS[3];

    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, W, H);
    RD.grain(ctx, W, H, 0.012, 20261030);

    var M = 88 * u;
    var RX = W - M;

    /* 顶部：日期 + 名字 */
    txt(ctx, opts.dateLabel || '', M, 128 * u, { size: 24 * u, ls: 1.5 * u, color: INK3 });
    txt(ctx, '单位 kcal', RX, 128 * u, { size: 22 * u, ls: 1.5 * u, color: INK3, align: 'right' });

    /* 大数字 */
    var y = 262 * u;
    txt(ctx, '今日热量缺口', M, y, { size: 27 * u, ls: 5 * u, color: INK2 });
    var ns = t.hasProfile ? (t.gap >= 0 ? String(t.gap) : '-' + Math.abs(t.gap)) : '--';
    var nc = !t.hasProfile ? INK3 : (t.gap >= 0 ? c1 : c4);
    var nsz = 164 * u;
    var baseY = y + nsz * 0.86;
    txt(ctx, ns, M, baseY, { size: nsz, weight: '600', color: nc, font: RD.FONT_NUM });
    var nw = w(ctx, ns, nsz, '600', -4 * u);
    txt(ctx, 'kcal', M + nw + 18 * u, baseY, { size: 32 * u, weight: '500', color: INK3 });

    /* 收支四条 */
    y = baseY + 54 * u;
    hr(ctx, M, RX, y, 2 * u);
    y += 62 * u;

    var rows = [
      { k: '基础代谢', v: t.bmr, c: c1 },
      { k: '日常额外', v: t.daily, c: c2 },
      { k: '运动消耗', v: t.move, c: c3, tag: t.moveEstimated ? '估' : null },
      { k: '饮食摄入', v: t.eat, c: c4 }
    ];
    var step = 84 * u;

    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      ctx.fillStyle = r.c;
      ctx.beginPath();
      ctx.arc(M + 5 * u, y - 9 * u, 5 * u, 0, Math.PI * 2);
      ctx.fill();

      txt(ctx, r.k, M + 24 * u, y, { size: 27 * u, weight: '500', color: INK2 });
      if (r.tag) {
        var kw = w(ctx, r.k, 27 * u, '500');
        txt(ctx, r.tag, M + 24 * u + kw + 10 * u, y, { size: 19 * u, color: INK3 });
      }
      txt(ctx, String(r.v), RX, y, { size: 36 * u, weight: '600', color: r.c, align: 'right', font: RD.FONT_NUM });
      y += step;
    }

    /* 吃了什么 */
    var meals = t.meals || [];
    var mvMin = 0;
    for (var mj = 0; mj < (t.moves || []).length; mj++) mvMin += (t.moves[mj].dur || 0);

    if (meals.length || mvMin > 0) {
      hr(ctx, M, RX, y - step * 0.42, 2 * u);
      y += 24 * u;
      if (meals.length) {
        txt(ctx, '今天吃了 ' + meals.length + ' 样', M, y, { size: 23 * u, ls: 3 * u, color: INK3 });
        y += 50 * u;
      }
      var maxRows = meals.length ? 4 : 0;
      var room = H - 246 * u;
      for (var mi = 0; mi < maxRows && mi < meals.length; mi++) {
        if (y > room) break;
        var it = meals[mi];
        var nm = cut(ctx, el(ctx, it.name) || '食物', 27 * u, '500', W * 0.52);
        txt(ctx, nm, M, y, { size: 27 * u, weight: '500', color: INK });
        txt(ctx, Math.round(it.kcal) + '', RX, y, { size: 28 * u, weight: '600', color: INK, align: 'right', font: RD.FONT_NUM });
        y += 56 * u;
      }
      if (meals.length > maxRows) {
        txt(ctx, '其余 ' + (meals.length - maxRows) + ' 项已计入', M, y, { size: 22 * u, color: INK3 });
        y += 44 * u;
      }
      if (mvMin > 0) {
        txt(ctx, '还动了 ' + mvMin + ' 分钟', M, y + 6 * u, { size: 24 * u, color: INK2 });
        y += 48 * u;
      }
    }

    /* 底部结论 */
    var fy = H - 158 * u;
    var line1 = t.hasProfile
      ? ('摄入 ' + t.eat + ' · 烧掉 ' + t.out + ' kcal')
      : '先在「我的」里填上身高体重';
    txt(ctx, line1, M, fy, { size: 27 * u, weight: '500', color: INK });

    setLS(ctx, 0);
    ctx.font = '500 ' + (24 * u) + 'px ' + RD.FONT_UI;
    var line2 = ENGINE.gapComment(t);
    var words = [], cur = '';
    for (var ci = 0; ci < line2.length; ci++) {
      var nx = cur + line2[ci];
      if (cur && ctx.measureText(nx).width > W * 0.62) { words.push(cur); cur = line2[ci]; }
      else cur = nx;
    }
    if (cur) words.push(cur);
    for (var li = 0; li < words.length && li < 2; li++) {
      txt(ctx, words[li], M, fy + 44 * u + li * 36 * u, { size: 24 * u, color: c1 });
    }

    if (opts.stamp) {
      txt(ctx, opts.stamp, RX, H - 66 * u, { size: 20 * u, color: INK3, align: 'right' });
    }
    return cv;
  }

  /* ================= 对外 ================= */
  function make(t, opts) {
    opts = opts || {};
    return getPalette(opts.photo).then(function (pal) {
      var cv = render(t, pal, opts);
      return cv.toDataURL('image/jpeg', opts.quality || 0.9);
    });
  }

  global.SUMMARY = {
    render: render,
    make: make,
    palette: getPalette,
    accent: accent,
    softPaper: softPaper,
    INK: INK, INK2: INK2, INK3: INK3,
    DEFAULTS: { paper: DEFAULT_PAPER, colors: DEFAULT_COLORS }
  };
})(typeof window !== 'undefined' ? window : globalThis);
