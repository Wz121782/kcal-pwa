/* ============================================================
   rough.js — 轻量手绘线条生成器
   灵感来自 Rough.js 的抖动算法，精简重写，零依赖、可离线
   提供：抖直线 / 抖闭合轮廓 / 抖路径 / 虚线 / 箭头 / 蜡笔色块 / 纸张颗粒
   ============================================================ */
(function (global) {
  'use strict';

  /* 中文：标准黑体系统字。字重只用 400/500，避免合成加粗发糊 */
  var FONT_UI = '-apple-system,BlinkMacSystemFont,"PingFang SC","HarmonyOS Sans SC","Source Han Sans SC","Noto Sans CJK SC","Hiragino Sans GB","Microsoft YaHei","Helvetica Neue",Arial,sans-serif';
  /* 旧名保留，指向同一套无衬线，避免调用处报错 */
  var FONT_HAND = FONT_UI;
  /* 数字/西文：走西文字体，数字形状更利落，可用 600 真实字重 */
  var FONT_NUM = '"SF Pro Display","SF Pro Text","Helvetica Neue",Helvetica,"Segoe UI",Roboto,Arial,"PingFang SC","Microsoft YaHei",sans-serif';

  /* ---------- 伪随机 ---------- */
  function makeRng(seed) {
    var t = (seed >>> 0) || 1;
    return function () {
      t += 0x6D2B79F5;
      var z = t;
      z = Math.imul(z ^ (z >>> 15), z | 1);
      z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
      return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
    };
  }
  function jr(rnd, amp) { return (rnd() * 2 - 1) * amp; }

  /* ---------- 默认参数 ---------- */
  function opt(o) {
    o = o || {};
    return {
      roughness: o.roughness != null ? o.roughness : 1.4,
      bowing: o.bowing != null ? o.bowing : 1.1,
      maxOff: o.maxOff != null ? o.maxOff : 1.6,
      width: o.width != null ? o.width : 2,
      stroke: o.stroke || '#3A352F',
      passes: o.passes != null ? o.passes : 2,
      seed: o.seed,
      alpha: o.alpha != null ? o.alpha : 1,
      steps: o.steps,
      openGap: o.openGap
    };
  }

  /* ---------- 一根抖直线 ---------- */
  function line(ctx, x1, y1, x2, y2, o, rnd) {
    var lenSq = (x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2);
    var len = Math.sqrt(lenSq) || 1;
    var amp = o.roughness;
    if (amp * amp * 100 > lenSq) amp = len / 10;
    if (len < 36) amp *= 0.55;

    var ax1 = x1 + jr(rnd, o.maxOff), ay1 = y1 + jr(rnd, o.maxOff);
    var ax2 = x2 + jr(rnd, o.maxOff), ay2 = y2 + jr(rnd, o.maxOff);

    var bx = o.bowing * amp * (y2 - y1) / len;
    var by = o.bowing * amp * (x1 - x2) / len;
    var midX = (ax1 + ax2) / 2 + bx + jr(rnd, amp * 0.5);
    var midY = (ay1 + ay2) / 2 + by + jr(rnd, amp * 0.5);

    // 让曲线真正经过 mid：ctrl = 2*M - (A+B)/2
    var cx = midX * 2 - (ax1 + ax2) / 2;
    var cy = midY * 2 - (ay1 + ay2) / 2;

    ctx.beginPath();
    ctx.moveTo(ax1, ay1);
    ctx.quadraticCurveTo(cx, cy, ax2, ay2);
    ctx.stroke();
  }

  /* ---------- 通过点序列做平滑手绘曲线 ---------- */
  function curve(ctx, pts, o, rnd, closed) {
    var amp = o.roughness;
    var jp = [];
    for (var i = 0; i < pts.length; i++) {
      jp.push([pts[i][0] + jr(rnd, o.maxOff), pts[i][1] + jr(rnd, o.maxOff)]);
    }
    ctx.beginPath();
    ctx.moveTo(jp[0][0], jp[0][1]);
    var n = jp.length;
    var last = closed ? n : n - 1;
    for (var k = 1; k <= last; k++) {
      var p0 = jp[(k - 1) % n];
      var p1 = jp[k % n];
      var p2 = jp[(k + 1) % n];
      var mx = (p0[0] + p1[0]) / 2 + jr(rnd, amp * 0.45);
      var my = (p0[1] + p1[1]) / 2 + jr(rnd, amp * 0.45);
      // 二次曲线平滑：控制点为 p1 的偏移
      var cx = p1[0] + jr(rnd, amp * 0.7);
      var cy = p1[1] + jr(rnd, amp * 0.7);
      if (k === last && !closed) {
        ctx.quadraticCurveTo(cx, cy, p1[0], p1[1]);
      } else {
        ctx.quadraticCurveTo(cx, cy, mx, my);
      }
    }
    if (closed) ctx.closePath();
    ctx.stroke();
  }

  /* ---------- 对外 API ---------- */
  var RD = { FONT_HAND: FONT_HAND, FONT_UI: FONT_UI, FONT_NUM: FONT_NUM, rng: makeRng };

  /** 抖直线 */
  RD.line = function (ctx, x1, y1, x2, y2, o) {
    o = opt(o);
    var rnd = makeRng(o.seed || 7);
    ctx.save();
    ctx.strokeStyle = o.stroke; ctx.lineWidth = o.width;
    ctx.globalAlpha = o.alpha; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (var i = 0; i < o.passes; i++) line(ctx, x1, y1, x2, y2, o, rnd);
    ctx.restore();
  };

  /** 抖椭圆/圆：沿圆周错位采样，两遍叠画，形成一笔画的不完美闭合圈 */
  RD.ellipse = function (ctx, cx, cy, rx, ry, o) {
    o = opt(o);
    var rnd = makeRng(o.seed || 11);
    ctx.save();
    ctx.strokeStyle = o.stroke; ctx.lineWidth = o.width;
    ctx.globalAlpha = o.alpha; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    var steps = o.steps || 11;
    for (var p = 0; p < o.passes; p++) {
      var start = rnd() * Math.PI * 2;
      var inc = Math.PI * 2 / steps;
      var pts = [];
      for (var i = 0; i <= steps; i++) {
        var a = start + i * inc;
        pts.push([
          cx + Math.cos(a) * rx + jr(rnd, rx * 0.055 + o.roughness),
          cy + Math.sin(a) * ry + jr(rnd, ry * 0.055 + o.roughness)
        ]);
      }
      // 不闭合最后一小段，留出一个"笔没画完"的缺口
      var end = pts.length - (o.openGap ? 1 : 0);
      curve(ctx, pts.slice(0, end), o, rnd, !o.openGap);
    }
    ctx.restore();
  };

  RD.circle = function (ctx, cx, cy, r, o) {
    RD.ellipse(ctx, cx, cy, r, r, o);
  };

  /** 抖圆角矩形 */
  RD.rect = function (ctx, x, y, w, h, o) {
    o = opt(o);
    var rnd = makeRng(o.seed || 5);
    ctx.save();
    ctx.strokeStyle = o.stroke; ctx.lineWidth = o.width;
    ctx.globalAlpha = o.alpha; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    var rr = o.radius != null ? o.radius : Math.min(w, h) * 0.16;
    var pts = [];
    function edge(x1, y1, x2, y2) {
      var n = 4;
      for (var i = 0; i <= n; i++) {
        pts.push([x1 + (x2 - x1) * i / n, y1 + (y2 - y1) * i / n]);
      }
    }
    function arcC(cxx, cyy, a1, a2) {
      var n = 4;
      for (var i = 0; i <= n; i++) {
        var a = a1 + (a2 - a1) * i / n;
        pts.push([cxx + Math.cos(a) * rr, cyy + Math.sin(a) * rr]);
      }
    }
    var xEnd = x + w - rr, yEnd = y + h - rr;
    edge(x + rr, y, xEnd, y);
    arcC(xEnd, y + rr, -Math.PI / 2, 0);
    edge(x + w, y + rr, x + w, yEnd);
    arcC(xEnd, yEnd, 0, Math.PI / 2);
    edge(xEnd, y + h, x + rr, y + h);
    arcC(x + rr, yEnd, Math.PI / 2, Math.PI);
    edge(x, yEnd, x, y + rr);
    arcC(x + rr, y + rr, Math.PI, Math.PI * 1.5);
    var save = o.maxOff; o.maxOff = Math.min(save, 1.2);
    for (var p = 0; p < o.passes; p++) curve(ctx, pts, o, rnd, false);
    o.maxOff = save;
    ctx.restore();
  };

  /** 自由手绘路径（点数组） */
  RD.path = function (ctx, pts, o) {
    o = opt(o);
    var rnd = makeRng(o.seed || 13);
    ctx.save();
    ctx.strokeStyle = o.stroke; ctx.lineWidth = o.width;
    ctx.globalAlpha = o.alpha; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (var i = 0; i < o.passes; i++) curve(ctx, pts, o, rnd, !!o.closed);
    ctx.restore();
  };

  /** 虚线（每段都带一点点抖动，像随手点的） */
  RD.dashed = function (ctx, x1, y1, x2, y2, o) {
    o = opt(o);
    var rnd = makeRng(o.seed || 23);
    var dx = x2 - x1, dy = y2 - y1;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var dash = o.dash || 7, gap = o.gap || 6;
    var ux = dx / len, uy = dy / len;
    var t = 0;
    ctx.save();
    ctx.strokeStyle = o.stroke; ctx.lineWidth = o.width;
    ctx.globalAlpha = o.alpha; ctx.lineCap = 'round';
    var save = o.maxOff; o.maxOff = Math.min(save, 0.9);
    while (t < len) {
      var e = Math.min(t + dash, len);
      var sx = x1 + ux * t + jr(rnd, 0.5), sy = y1 + uy * t + jr(rnd, 0.5);
      var ex = x1 + ux * e + jr(rnd, 0.5), ey = y1 + uy * e + jr(rnd, 0.5);
      line(ctx, sx, sy, ex, ey, o, rnd);
      t = e + gap + jr(rnd, 1.2);
    }
    o.maxOff = save;
    ctx.restore();
  };

  /** 箭头（两条短线做箭羽，带抖动） */
  RD.arrow = function (ctx, x1, y1, x2, y2, o) {
    o = opt(o);
    ctx.save();
    ctx.strokeStyle = o.stroke; ctx.lineWidth = o.width;
    ctx.globalAlpha = o.alpha; ctx.lineCap = 'round';
    var rnd = makeRng(o.seed || 31);
    line(ctx, x1, y1, x2, y2, o, rnd);
    var a = Math.atan2(y2 - y1, x2 - x1);
    var s = o.head || 9;
    line(ctx, x2, y2, x2 - Math.cos(a - 0.42) * s, y2 - Math.sin(a - 0.42) * s, o, rnd);
    line(ctx, x2, y2, x2 - Math.cos(a + 0.42) * s, y2 - Math.sin(a + 0.42) * s, o, rnd);
    ctx.restore();
  };

  /** 蜡笔色块：多圈低透明度的抖动椭圆反复涂抹 */
  RD.blob = function (ctx, cx, cy, rx, ry, o) {
    o = opt(o);
    var rnd = makeRng(o.seed || 41);
    ctx.save();
    ctx.strokeStyle = o.stroke; ctx.lineWidth = o.width || 6;
    ctx.globalAlpha = o.alpha != null ? o.alpha : 0.16;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    var n = o.layers || 9;
    for (var i = 0; i < n; i++) {
      var k = i / n;
      var sx = rx * (0.42 + 0.58 * k) + jr(rnd, rx * 0.05);
      var sy = ry * (0.42 + 0.58 * k) + jr(rnd, ry * 0.05);
      RD.ellipse(ctx, cx + jr(rnd, rx * 0.06), cy + jr(rnd, ry * 0.06), sx, sy, {
        stroke: o.stroke, width: o.width || 6, alpha: 1,
        roughness: o.roughness || 1.6, bowing: 1.4, passes: 1, seed: (o.seed || 41) + i * 7
      });
    }
    ctx.restore();
  };

  /** 纸张纤维颗粒 */
  RD.grain = function (ctx, w, h, alpha, seed) {
    var rnd = makeRng(seed || 99);
    ctx.save();
    var n = Math.floor(w * h / 900);
    n = Math.min(n, 26000);
    for (var i = 0; i < n; i++) {
      var x = rnd() * w, y = rnd() * h;
      var v = rnd();
      ctx.globalAlpha = alpha * (0.25 + v * 0.75);
      ctx.fillStyle = v > 0.55 ? '#B9AE9C' : '#FFFFFF';
      var s = rnd() < 0.86 ? 1 : 1.7;
      ctx.fillRect(x, y, s, s);
    }
    ctx.restore();
  };

  /** 给文字加"笔迹感"：轻微重影 + 描边 */
  RD.handText = function (ctx, text, x, y, o) {
    o = o || {};
    ctx.save();
    ctx.font = (o.weight || '600') + ' ' + (o.size || 20) + 'px ' + (o.font || FONT_HAND);
    if (o.ls && 'letterSpacing' in ctx) ctx.letterSpacing = o.ls + 'px';
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = o.baseline || 'alphabetic';
    if (o.rotate) {
      ctx.translate(x, y); ctx.rotate(o.rotate); x = 0; y = 0;
    }
    if (o.halo) {
      ctx.lineJoin = 'round';
      ctx.strokeStyle = o.halo;
      ctx.lineWidth = o.haloW || 5;
      ctx.strokeText(text, x, y);
    }
    if (o.shadowShift) {
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = o.color || '#3A352F';
      ctx.fillText(text, x + 0.9, y + 0.9);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = o.color || '#3A352F';
    ctx.fillText(text, x, y);
    ctx.restore();
  };

  RD.measure = function (ctx, text, size, font, weight, ls) {
    ctx.save();
    ctx.font = (weight || '600') + ' ' + size + 'px ' + (font || FONT_HAND);
    if (ls && 'letterSpacing' in ctx) ctx.letterSpacing = ls + 'px';
    var w = ctx.measureText(text).width;
    ctx.restore();
    return w;
  };

  /** 截断文字到指定宽度 */
  RD.clip = function (ctx, text, size, maxW, font, weight) {
    if (RD.measure(ctx, text, size, font, weight) <= maxW) return text;
    var t = text;
    while (t.length > 1 && RD.measure(ctx, t + '…', size, font, weight) > maxW) {
      t = t.slice(0, -1);
    }
    return t + '…';
  };

  global.RD = RD;
})(typeof window !== 'undefined' ? window : globalThis);
