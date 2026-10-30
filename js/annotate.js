/* ============================================================
   annotate.js — 照片上的手绘风注解
   规则：白色细线一笔画轮廓 + 虚线/箭头视线引导 + 手写体短句
        右下角合计 kcal~，其余留白
   预览与导出走完全相同的绘制函数，所见即所得
   ============================================================ */
(function (global) {
  'use strict';

  var WHITE = '#FFFFFF';
  var INK_HALO = 'rgba(28,24,20,.42)';

  var SIZE_K = [0.062, 0.092, 0.132]; // S / M / L，相对短边

  /** 某个标注圈的像素半径 */
  function radii(mark, W, H) {
    var MIN = Math.min(W, H);
    var k = SIZE_K[mark.size == null ? 1 : mark.size];
    var rx = MIN * k;
    return { rx: rx, ry: rx * 0.8 };
  }

  /* ---------- 单个标注 ---------- */
  function drawMark(ctx, m, W, H, idx) {
    var r = radii(m, W, H);
    var cx = m.x * W;
    var cy = m.y * H;
    var seed = (m.seed || 100) + idx * 13;

    var food = m.food || {};
    var name = m.name || food.n || '这个';
    var kcal = Math.round(m.kcal || 0);
    var note = m.note || '';

    /* 1) 外描边轮廓：先深色柔影，再白色细线，两遍成一笔画的感觉 */
    var base = {
      roughness: 0.95, bowing: 0.6, maxOff: 1.1, passes: 1, seed: seed, steps: 26
    };
    RD.ellipse(ctx, cx, cy, r.rx, r.ry, Object.assign({}, base, {
      stroke: 'rgba(30,25,20,.4)', width: 4.5, alpha: 0.28
    }));
    RD.ellipse(ctx, cx, cy, r.rx, r.ry, Object.assign({}, base, {
      stroke: WHITE, width: 2.0, alpha: 0.95
    }));

    /* 2) 决定文字放在哪一侧：靠中间就往空的一侧推 */
    var toRight = cx < W * 0.52;
    var padX = W * 0.045;
    var leadLen = Math.min(W, H) * 0.085;

    var tx = toRight ? cx + r.rx + leadLen + padX * 0.4 : cx - r.rx - leadLen - padX * 0.4;
    var ty = cy;

    // 先把文字块约束进画面
    var size1 = Math.max(15, Math.min(W, H) * 0.036);
    var size2 = size1 * 0.66;
    var size3 = size1 * 0.86;
    var blockW = Math.max(
      RD.measure(ctx, name, size1, RD.FONT_HAND, '700'),
      RD.measure(ctx, note, size2, RD.FONT_HAND, '500'),
      RD.measure(ctx, kcal + ' kcal', size3, RD.FONT_HAND, '700')
    );

    if (toRight && tx + blockW > W - padX) tx = Math.max(padX, W - padX - blockW);
    if (!toRight && tx - blockW < padX) tx = padX + blockW;

    // 垂直方向别顶到边
    var topLimit = H * 0.1, botLimit = H * 0.9;
    if (ty < topLimit) ty = topLimit;
    if (ty > botLimit) ty = botLimit;

    /* 3) 视线引导：虚线 + 小箭头 */
    var startX = toRight ? cx + r.rx * 0.94 : cx - r.rx * 0.94;
    var endX = toRight ? tx - padX * 0.5 : tx + padX * 0.5;
    RD.dashed(ctx, startX, cy + r.ry * 0.35, endX, ty - size1 * 0.35, {
      stroke: 'rgba(30,25,20,.4)', width: 4.5, alpha: 0.5, dash: 6, gap: 5, seed: seed + 3
    });
    RD.dashed(ctx, startX, cy + r.ry * 0.35, endX, ty - size1 * 0.35, {
      stroke: WHITE, width: 2, alpha: 0.9, dash: 6, gap: 5, seed: seed + 3
    });

    /* 4) 手写注解（三层：名字 / 描述 / 热量） */
    var align = toRight ? 'left' : 'right';
    var ax = toRight ? tx : tx;

    RD.handText(ctx, RD.clip(ctx, name, size1, W * 0.42), ax, ty, {
      size: size1, weight: '500', color: WHITE, halo: INK_HALO, haloW: size1 * 0.2,
      align: align, baseline: 'alphabetic'
    });
    if (note) {
      RD.handText(ctx, RD.clip(ctx, note, size2, W * 0.42), ax, ty + size2 * 1.5, {
        size: size2, weight: '500', color: 'rgba(255,255,255,.93)',
        halo: INK_HALO, haloW: size2 * 0.24, align: align
      });
    }
    RD.handText(ctx, kcal + ' kcal', ax, ty + size2 * 1.5 + size3 * 1.35, {
      size: size3, weight: '500', color: WHITE, halo: INK_HALO, haloW: size3 * 0.22, align: align
    });
  }

  /* ---------- 右下角合计 ---------- */
  function drawTotal(ctx, W, H, total, label) {
    var MIN = Math.min(W, H);
    var padX = W * 0.05;
    var padY = H * 0.045;

    // 底部一道很轻的白雾，保证字可读（不做整图滤镜，保留留白）
    var g = ctx.createLinearGradient(0, H * 0.72, 0, H);
    g.addColorStop(0, 'rgba(24,20,16,0)');
    g.addColorStop(1, 'rgba(24,20,16,.34)');
    ctx.fillStyle = g;
    ctx.fillRect(0, H * 0.72, W, H * 0.28);

    var x = W - padX;
    var y = H - padY;

    var s2 = MIN * 0.032;
    var s1 = MIN * 0.062;

    RD.handText(ctx, total + ' kcal~', x, y, {
      size: s1, weight: '500', color: WHITE, halo: INK_HALO, haloW: s1 * 0.16, align: 'right'
    });
    if (label) {
      RD.handText(ctx, label, x, y - s1 * 1.35, {
        size: s2, weight: '500', color: 'rgba(255,255,255,.88)',
        halo: INK_HALO, haloW: s2 * 0.3, align: 'right'
      });
    }
  }

  /* ---------- 主绘制入口 ---------- */
  function render(ctx, W, H, marks, opts) {
    opts = opts || {};
    for (var i = 0; i < marks.length; i++) {
      drawMark(ctx, marks[i], W, H, i);
    }
    if (opts.total != null) {
      drawTotal(ctx, W, H, Math.round(opts.total), opts.label);
    }
  }

  /* ---------- 合成导出：照片 + 注解 → dataURL ---------- */
  function compose(imgSrc, marks, opts) {
    opts = opts || {};
    var TW = opts.width || 720;
    var TH = opts.height || Math.round(TW * 4 / 3);
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        var cv = document.createElement('canvas');
        cv.width = TW; cv.height = TH;
        var ctx = cv.getContext('2d');

        // 与预览一致的 cover 裁切
        var iw = img.naturalWidth || img.width;
        var ih = img.naturalHeight || img.height;
        var k = Math.max(TW / iw, TH / ih);
        var dw = iw * k, dh = ih * k;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, TW, TH);
        ctx.drawImage(img, (TW - dw) / 2, (TH - dh) / 2, dw, dh);

        render(ctx, TW, TH, marks, opts);
        try {
          resolve(cv.toDataURL('image/jpeg', opts.quality || 0.82));
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = function () { reject(new Error('图片读取失败')); };
      img.src = imgSrc;
    });
  }

  global.ANNO = {
    render: render,
    compose: compose,
    radii: radii,
    SIZE_K: SIZE_K
  };
})(typeof window !== 'undefined' ? window : globalThis);
