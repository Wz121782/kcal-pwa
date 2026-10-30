/* ============================================================
   ui.js — 界面逻辑：四个页面的交互与渲染
   ============================================================ */
(function (global) {
  'use strict';

  var E = global.ENGINE;
  var D = global.DATA;

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var state = {
    mealImg: null,
    marks: [],
    pending: null,
    selFood: null,
    mvMet: null,
    mvName: null,
    summaryURL: null
  };

  /* ================= Toast ================= */
  var toastTimer = null;
  function toast(msg) {
    var el = $('#toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 2200);
  }

  /* ================= 页面切换 ================= */
  function go(name) {
    $$('.page').forEach(function (p) { p.classList.remove('is-active'); });
    var p = $('#page-' + name);
    if (p) {
      p.classList.add('is-active');
      p.scrollTop = 0;
    }
    $$('.tab').forEach(function (t) { t.classList.toggle('is-on', t.getAttribute('data-go') === name); });
    if (name === 'home') refreshHome();
    if (name === 'move') refreshMovePage();
    if (name === 'me') refreshMe();
  }

  /* ================= 今天 ================= */
  /* 统一色板：与 css/app.css 变量保持一致 */
  var PAL = {
    track: '#EDF0EE',
    brand: '#2FA383',
    warn: '#E2925B',
    mid: '#E9B45A',
    eat: '#E2925B',
    move: '#5A9BD5',
    bmr: '#2FA383',
    neat: '#7FA8D8'
  };

  function drawRing(pct) {
    var cv = $('#gapRing');
    var ctx = cv.getContext('2d');
    var S = 480, cx = 240, cy = 240, r = 196;
    ctx.clearRect(0, 0, S, S);

    ctx.lineWidth = 14;
    ctx.strokeStyle = PAL.track;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    var col = PAL.brand;
    if (pct > 1.05) col = PAL.warn;
    else if (pct > 0.88) col = PAL.mid;

    if (pct > 0) {
      var a0 = -Math.PI / 2;
      var a1 = a0 + Math.PI * 2 * Math.min(pct, 1);
      ctx.strokeStyle = col;
      ctx.lineWidth = 14;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(cx, cy, r, a0, a1);
      ctx.stroke();

      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a1) * r, cy + Math.sin(a1) * r, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    if (pct > 1) {
      var over = Math.min(pct - 1, 1);
      ctx.strokeStyle = PAL.warn;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(cx, cy, r - 28, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * over);
      ctx.stroke();
    }
  }

  function refreshHome() {
    var t = E.calcDay();
    $('#hhDate').textContent = E.prettyDate();

    var numEl = $('#gapNum');
    if (!t.hasProfile) {
      numEl.textContent = '--';
      numEl.className = 'gap-num';
      drawRing(0);
    } else {
      numEl.textContent = t.gap >= 0 ? String(t.gap) : '-' + Math.abs(t.gap);
      numEl.className = 'gap-num ' + (t.gap >= 0 ? 'is-plus' : 'is-minus');
      var denom = t.target > 0 ? t.target : Math.max(t.out, 1);
      drawRing(t.eat / denom);
    }
    $('#gapNote').textContent = E.gapComment(t);

    $('#balBmr').textContent = t.hasProfile ? t.bmr : '--';
    $('#balNeat').textContent = t.hasProfile ? t.daily : '--';
    $('#balMove').textContent = t.hasProfile ? t.move : '--';
    $('#balEat').textContent = t.eat;

    /* 今天吃了什么 */
    var meals = t.meals || [];
    $('#eatCount').textContent = meals.length + ' 项';
    var box = $('#homeMeals');
    if (!meals.length) {
      box.innerHTML = '<p class="empty">还没有记录。点下面的「记一餐」，拍张照就行。</p>';
    } else {
      box.innerHTML = meals.map(function (m) {
        var info = D.catInfo(m.cat);
        return '<div class="meal-item">' +
          (m.thumb
            ? '<img class="meal-thumb" src="' + m.thumb + '" alt="">'
            : '<div class="meal-thumb is-ph">' + info.emoji + '</div>') +
          '<div class="meal-body">' +
          '<div class="meal-name">' + esc(m.name) + '</div>' +
          '<div class="meal-meta">' + E.hhmm(m.ts) + ' · ' + esc(m.note || info.note) + '</div>' +
          '</div>' +
          '<div class="meal-k">' + Math.round(m.kcal) + '</div>' +
          '<button class="meal-del" data-del-meal="' + m.id + '" aria-label="删除">×</button>' +
          '</div>';
      }).join('');
    }

    /* 今天动了多少 */
    var moves = t.moves || [];
    $('#moveCount').textContent = moves.length + ' 项';
    var mb = $('#homeMoves');
    if (!moves.length) {
      mb.innerHTML = '<p class="empty">今天还没出汗。散步也算，别偷懒</p>';
    } else {
      mb.innerHTML = moves.map(function (m) {
        return '<div class="move-chip">' +
          '<span class="mc-dot" style="background:' + PAL.move + '"></span>' +
          '<span class="mc-n">' + esc(m.name) + (m.dur ? ' · ' + m.dur + '分钟' : '') + '</span>' +
          '<span class="mc-k">' + Math.round(m.kcal) + '</span>' +
          '<button class="meal-del" data-del-move="' + m.id + '" aria-label="删除">×</button>' +
          '</div>';
      }).join('');
    }

    /* 留痕 */
    var traces = t.traces || [];
    $('#traceCount').textContent = traces.length + ' 张';
    $('#traceBlock').hidden = traces.length === 0;
    $('#traceGrid').innerHTML = traces.map(function (tr) {
      return '<div class="trace-item">' +
        '<img src="' + tr.img + '" alt="留痕">' +
        '<div class="trace-cap"><span>' + E.hhmm(tr.ts) + '</span><span>' +
        (tr.kind === 'summary' ? '总结图' : Math.round(tr.kcal) + ' kcal') + '</span></div>' +
        '</div>';
    }).join('');
  }

  /* ================= 记饮食 ================= */
  function drawStage() {
    var cv = $('#stageCanvas');
    var st = $('#stage');
    var w = st.clientWidth || 300;
    var h = st.clientHeight || 400;
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    var ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ANNO.render(ctx, w, h, state.marks, {
      total: pickTotal(), label: '这一餐'
    });
  }

  function pickTotal() {
    var n = 0;
    for (var i = 0; i < state.marks.length; i++) n += (state.marks[i].kcal || 0);
    return Math.round(n);
  }

  function renderPicks() {
    var list = $('#pickList');
    var n = state.marks.length;
    $('#pickCount').textContent = n + ' 项';
    $('#saveMealSub').textContent = '合计 ' + pickTotal() + ' kcal';
    if (!n) {
      list.innerHTML = '<p class="empty">选完照片后，直接点画面上的食物，我来圈它。</p>';
      return;
    }
    list.innerHTML = state.marks.map(function (m, i) {
      var info = D.catInfo(m.cat);
      var sizeRow = (m.pos == null) ? '' :
        '<div class="pi-size" data-i="' + i + '">' +
        ['S', 'M', 'L'].map(function (lab, k) {
          return '<b class="' + ((m.size || 1) === k ? 'on' : '') + '" data-sz="' + k + '">' + lab + '</b>';
        }).join('') + '</div>';
      return '<div class="pick-item">' +
        '<div class="pi-top">' +
        '<span class="pi-emo">' + info.emoji + '</span>' +
        '<div class="pi-body">' +
        '<div class="pi-n">' + esc(m.name) + '</div>' +
        '<div class="pi-m">' + esc(m.note || info.note) + (m.pos == null ? ' · 只记账' : '') + '</div>' +
        '</div>' +
        '<div class="pi-k">' + Math.round(m.kcal) + '</div>' +
        '<button class="meal-del" data-del-pick="' + i + '" aria-label="删除">×</button>' +
        '</div>' + sizeRow + '</div>';
    }).join('');
  }

  function pickFileChoose() {
    $('#fileFood').click();
  }

  function onFileFood(e) {
    var f = e.target.files && e.target.files[0];
    if (!f) return;
    var fr = new FileReader();
    fr.onload = function () {
      state.mealImg = String(fr.result);
      var img = $('#stageImg');
      img.onload = function () {
        $('#stagePh').hidden = true;
        img.hidden = false;
        $('#stageTools').hidden = false;
        $('#stageHint').textContent = '点一下画面上的食物 → 我来给它画注解';
        drawStage();
      };
      img.src = state.mealImg;
    };
    fr.readAsDataURL(f);
    e.target.value = '';
  }

  function onStageClick(ev) {
    if (!state.mealImg) { pickFileChoose(); return; }
    var st = $('#stage');
    var r = st.getBoundingClientRect();
    var x = (ev.clientX - r.left) / r.width;
    var y = (ev.clientY - r.top) / r.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    state.pending = { x: x, y: y };
    openSheet('这个是什么?');
  }

  function resetStage() {
    state.mealImg = null;
    state.marks = [];
    $('#stageImg').hidden = true;
    $('#stageImg').removeAttribute('src');
    $('#stagePh').hidden = false;
    $('#stageTools').hidden = true;
    $('#stageHint').textContent = '还没选图';
    var cv = $('#stageCanvas');
    cv.getContext('2d').clearRect(0, 0, cv.width, cv.height);
    renderPicks();
  }

  /* ---------- 食物选择弹层 ---------- */
  function openSheet(title) {
    $('#sheetT').textContent = title || '这是什么?';
    state.selFood = null;
    $('#foodSearch').value = '';
    $('#portNote').value = '';
    $('#sheetPort').hidden = true;
    $('#sheet').hidden = false;
    $('#mask').hidden = false;
    renderFoodRes(D.searchFood('', 40));
    setTimeout(function () { $('#foodSearch').focus(); }, 60);
  }

  function closeSheet() {
    $('#sheet').hidden = true;
    $('#mask').hidden = true;
    state.selFood = null;
  }

  function renderFoodRes(list) {
    $('#foodRes').innerHTML = list.map(function (f, i) {
      var info = D.catInfo(f.c);
      return '<div class="food-row" data-food="' + esc(f.n) + '">' +
        '<span class="fr-cat">' + esc(info.label.slice(0, 4)) + '</span>' +
        '<span class="fr-n">' + esc(f.n) + '<span class="fr-u"> ' + esc(f.u) + '</span></span>' +
        '<span class="fr-k">' + f.k + '</span>' +
        '</div>';
    }).join('') || '<p class="empty">没找到，直接在下面手填吧</p>';
  }

  function selectFoodByName(name) {
    var f = D.findFood(name);
    if (f) {
      state.selFood = f;
      $('#portQty').value = 1;
      $('#portKcal').value = f.k;
      $('#sheetPort').hidden = false;
      $('#foodSearch').value = f.n;
      renderFoodRes([f]);
      return;
    }
    // 库里没有 → 当作自定义
    state.selFood = { n: name, c: 'x', k: 0, u: '自定义' };
    $('#portQty').value = 1;
    $('#portKcal').value = '';
    $('#sheetPort').hidden = false;
    renderFoodRes([]);
  }

  function confirmFood() {
    var f = state.selFood;
    var qty = parseFloat($('#portQty').value) || 1;
    var kcal = parseFloat($('#portKcal').value);
    if (!f) { toast('先选一个吧'); return; }
    if (isNaN(kcal) || kcal < 0) { toast('热量填个数字'); return; }
    kcal = Math.round(kcal * (isFinite(qty) ? 1 : 1));

    var note = $('#portNote').value.trim() || D.autoNote(f, '');
    var mark = {
      id: E.uid(),
      name: f.n,
      cat: f.c,
      kcal: kcal,
      qty: qty,
      unit: f.u,
      note: note,
      seed: Math.floor(Math.random() * 900) + 100,
      size: 1,
      x: 0.5, y: 0.5, pos: null
    };
    if (state.pending) {
      mark.x = state.pending.x;
      mark.y = state.pending.y;
      mark.pos = { x: state.pending.x, y: state.pending.y };
    }
    state.marks.push(mark);
    state.pending = null;
    closeSheet();
    drawStage();
    renderPicks();
    toast('加上了 · ' + kcal + ' kcal');
  }

  /* ---------- 保存一餐 ---------- */
  function saveMeal() {
    if (!state.marks.length) { toast('还没加东西呢'); return; }
    var btn = $('#btnSaveMeal');
    btn.disabled = true;
    var total = pickTotal();
    var chips = state.marks.map(function (m) { return m.name; }).slice(0, 3).join(' / ');
    composeShot().then(function (res) {
      E.addTrace({ kind: 'meal', ts: Date.now(), img: res.img, thumb: res.thumb, kcal: total, label: chips });
      state.marks.forEach(function (m) {
        E.addMeal({
          ts: Date.now(), name: m.name, cat: m.cat, kcal: m.kcal,
          note: m.note, unit: m.unit, qty: m.qty
        });
      });
      resetStage();
      btn.disabled = false;
      toast('记下了 · ' + total + ' kcal');
      go('home');
    }).catch(function () {
      btn.disabled = false;
      toast('图片处理失败，再试一次');
    });
  }

  function composeShot() {
    var labelled = state.marks.filter(function (m) { return m.pos; });
    var opts = { width: 680, total: pickTotal(), label: '这一餐' };
    return E.shrink(state.mealImg, 240, 'image/jpeg', 0.66).then(function (thumb) {
      if (!labelled.length) {
        return E.shrink(state.mealImg, 680, 'image/jpeg', 0.74).then(function (img) {
          return { img: img, thumb: thumb };
        });
      }
      return ANNO.compose(state.mealImg, labelled, opts).then(function (img) {
        return { img: img, thumb: thumb };
      });
    });
  }

  /* ================= 记运动 ================= */
  function renderMoveGrid() {
    $('#moveGrid').innerHTML = D.EXERCISES.map(function (x) {
      return '<button class="mv" data-mv="' + esc(x.n) + '" data-met="' + x.m + '">' +
        '<span class="mv-e">' + x.e + '</span>' +
        '<span class="mv-n">' + esc(x.n) + '</span>' +
        '<span class="mv-m">MET ' + x.m + '</span>' +
        '</button>';
    }).join('');
  }

  function updateMovePreview() {
    var p = E.getProfile() || {};
    var w = parseFloat(p.w) || 55;
    var dur = parseFloat($('#mvDur').value) || 0;
    var k = state.mvMet ? E.metKcal(state.mvMet, w, dur) : 0;
    $('#mvPrevTxt').textContent = state.mvName ? (state.mvName + ' · ' + dur + ' 分钟') : '选一个看看';
    $('#mvPrevNum').innerHTML = k + '<small>kcal</small>';
  }

  function addMove(name, kcal, dur, met) {
    if (!kcal || kcal <= 0) { toast('消耗得大于 0'); return; }
    E.addMove({ ts: Date.now(), name: name, kcal: Math.round(kcal), dur: dur || 0, met: met || 0 });
    toast('加上了 · ' + Math.round(kcal) + ' kcal');
    refreshMovePage();
  }

  function refreshMovePage() {
    var t = E.calcDay();
    var moves = t.moves || [];
    $('#mvCount').textContent = moves.length + ' 项';
    var box = $('#mvList');
    if (!moves.length) {
      box.innerHTML = '<p class="empty">还没记录</p>';
    } else {
      box.innerHTML = moves.map(function (m) {
        return '<div class="move-chip">' +
          '<span class="mc-dot" style="background:' + PAL.move + '"></span>' +
          '<span class="mc-n">' + esc(m.name) + (m.dur ? ' · ' + m.dur + '分钟' : '') + '</span>' +
          '<span class="mc-k">' + Math.round(m.kcal) + '</span>' +
          '<button class="meal-del" data-del-move="' + m.id + '">×</button>' +
          '</div>';
      }).join('');
    }
    updateMovePreview();
  }

  /* ================= 我的 ================= */
  function refreshMe() {
    var p = E.getProfile();
    if (p) {
      $('#pfH').value = p.h || '';
      $('#pfW').value = p.w || '';
      $('#pfA').value = p.a || '';
      $$('#sexSeg .seg-i').forEach(function (b) {
        b.classList.toggle('is-on', b.getAttribute('data-sex') === p.sex);
      });
      $$('#freqList .freq').forEach(function (b) {
        b.classList.toggle('is-on', Math.abs(parseFloat(b.getAttribute('data-f')) - p.freq) < 0.001);
      });
      $$('#goalList .freq').forEach(function (b) {
        b.classList.toggle('is-on', Math.abs(parseFloat(b.getAttribute('data-g')) - (p.goal || -0.2)) < 0.001);
      });
    }
    updateBmrCard();
  }

  function readProfileForm() {
    var cur = E.getProfile() || { sex: 'f', freq: 1.375, goal: -0.2 };
    var h = parseFloat($('#pfH').value);
    var w = parseFloat($('#pfW').value);
    var a = parseFloat($('#pfA').value);
    return {
      sex: cur.sex || 'f',
      h: isFinite(h) ? h : (cur.h || 0),
      w: isFinite(w) ? w : (cur.w || 0),
      a: isFinite(a) ? a : (cur.a || 0),
      freq: cur.freq || 1.375,
      goal: cur.goal == null ? -0.2 : cur.goal
    };
  }

  function updateBmrCard() {
    var p = E.getProfile();
    var t = E.calcDay();
    var card = $('#bmrCard');
    if (!p || !p.h || !p.w || !p.a) { card.hidden = true; $('#goalHint').textContent = '填完身高体重就能算了'; return; }
    card.hidden = false;
    $('#rcBmr').textContent = t.bmr;
    $('#rcNote').textContent = '加上日常走动和消化，一天大约要烧 ' + Math.round(t.tdee) + ' kcal';

    var items = [
      { k: '基础代谢', v: t.bmr, max: t.tdee, c: PAL.bmr },
      { k: '日常活动', v: t.daily, max: t.tdee, c: PAL.neat },
      { k: '目标摄入', v: t.target, max: t.tdee, c: PAL.eat }
    ];
    $('#rcBars').innerHTML = items.map(function (it) {
      var w = Math.max(4, Math.min(100, it.max ? (it.v / it.max * 100) : 4));
      return '<div class="rc-bar-row">' +
        '<span class="rc-bar-lab">' + it.k + '</span>' +
        '<span class="rc-bar-track"><span class="rc-bar-fill" style="width:' + w.toFixed(1) + '%;background:' + it.c + '"></span></span>' +
        '<span class="rc-bar-num">' + Math.round(it.v) + '</span>' +
        '</div>';
    }).join('');

    var goalTxt = p.goal < -0.15 ? '每天吃 ' + t.target + ' kcal 左右比较合适'
      : (p.goal > 0.05 ? '每天吃到 ' + t.target + ' kcal 才长肉'
        : '每天 ' + t.target + ' kcal 左右，基本持平');
    $('#goalHint').textContent = goalTxt;
  }

  function exportData() {
    var txt = E.exportJSON();
    var blob = new Blob([txt], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'kcal-backup-' + E.dateKey() + '.json';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
    toast('已导出');
  }

  function importData(file) {
    var fr = new FileReader();
    fr.onload = function () {
      try {
        E.importJSON(String(fr.result));
        refreshMe();
        refreshHome();
        toast('导入成功');
      } catch (e) {
        toast('这个文件读不出来');
      }
    };
    fr.readAsText(file);
  }

  /* ================= 总结图 ================= */
  function makeSummary() {
    var t = E.calcDay();
    var traces = t.traces || [];
    var photo = null;
    for (var i = traces.length - 1; i >= 0; i--) {
      if (traces[i].kind === 'meal') { photo = traces[i].thumb || traces[i].img; break; }
    }
    $('#btnSummary').disabled = true;
    $('#btnSummary').querySelector('.cta-txt').textContent = '正在画…';
    SUMMARY.make(t, {
      photo: photo,
      dateLabel: E.prettyDate(),
      stamp: E.dateKey(),
      width: 1080,
      height: 1440
    }).then(function (url) {
      state.summaryURL = url;
      return E.shrink(url, 700, 'image/jpeg', 0.78).then(function (small) {
        E.addTrace({ kind: 'summary', ts: Date.now(), img: small, thumb: small, kcal: t.gap, label: '今日总结' });
        $('#shotImg').src = url;
        $('#shotT').textContent = E.prettyDate() + ' · 今日总结';
        $('#shotMask').hidden = false;
        $('#btnSummary').disabled = false;
        $('#btnSummary').querySelector('.cta-txt').textContent = '生成今日总结图';
        refreshHome();
      });
    }).catch(function (e) {
      $('#btnSummary').disabled = false;
      $('#btnSummary').querySelector('.cta-txt').textContent = '生成今日总结图';
      toast('画图失败了，再点一次');
    });
  }

  function saveShot() {
    if (!state.summaryURL) return;
    // iOS Safari 不支持 a[download]，只能让用户长按
    var ua = global.navigator ? (global.navigator.userAgent || '') : '';
    var isIOS = /iPhone|iPad|iPod/i.test(ua) ||
      (global.navigator.platform === 'MacIntel' && global.navigator.maxTouchPoints > 1);
    if (isIOS) {
      $('#shotImg').scrollIntoView({ behavior: 'smooth', block: 'center' });
      toast('长按这张图，就能存到相册');
      return;
    }
    var a = document.createElement('a');
    a.href = state.summaryURL;
    a.download = 'kcal-' + E.dateKey() + '.jpg';
    a.click();
    toast('已经存好啦');
  }

  /* ================= 事件绑定 ================= */
  function bind() {
    /* tabs */
    $$('.tab').forEach(function (t) {
      t.addEventListener('click', function () { go(t.getAttribute('data-go')); });
    });

    /* 今天：删除 */
    $('#homeMeals').addEventListener('click', function (e) {
      var b = e.target.closest('[data-del-meal]');
      if (b) { E.delMeal(b.getAttribute('data-del-meal')); refreshHome(); }
    });
    $('#homeMoves').addEventListener('click', function (e) {
      var b = e.target.closest('[data-del-move]');
      if (b) { E.delMove(b.getAttribute('data-del-move')); refreshHome(); }
    });
    $('#btnSummary').addEventListener('click', makeSummary);

    /* 记饮食 */
    $('#stage').addEventListener('click', onStageClick);
    $('#stagePh').addEventListener('click', function (e) { e.stopPropagation(); pickFileChoose(); });
    $('#fileFood').addEventListener('change', onFileFood);
    $('#btnRePick').addEventListener('click', pickFileChoose);
    $('#btnClearMarks').addEventListener('click', function () {
      state.marks = state.marks.filter(function (m) { return m.pos == null; });
      drawStage(); renderPicks(); toast('标注清空了');
    });
    $('#btnAddPlain').addEventListener('click', function () {
      state.pending = null;
      openSheet('加了什么?');
    });
    $('#btnSaveMeal').addEventListener('click', saveMeal);

    $('#pickList').addEventListener('click', function (e) {
      var del = e.target.closest('[data-del-pick]');
      if (del) {
        state.marks.splice(parseInt(del.getAttribute('data-del-pick'), 10), 1);
        drawStage(); renderPicks();
        return;
      }
      var sz = e.target.closest('[data-sz]');
      if (sz) {
        var wrap = sz.closest('.pi-size');
        var i = parseInt(wrap.getAttribute('data-i'), 10);
        state.marks[i].size = parseInt(sz.getAttribute('data-sz'), 10);
        drawStage(); renderPicks();
      }
    });

    /* 弹层 */
    $('#mask').addEventListener('click', closeSheet);
    $('#btnCancelFood').addEventListener('click', function () { state.pending = null; closeSheet(); });
    $('#btnOkFood').addEventListener('click', confirmFood);
    $('#foodSearch').addEventListener('input', function () {
      renderFoodRes(D.searchFood(this.value, 40));
    });
    $('#foodRes').addEventListener('click', function (e) {
      var row = e.target.closest('[data-food]');
      if (row) selectFoodByName(row.getAttribute('data-food'));
    });
    $('#portQty').addEventListener('input', function () {
      var f = state.selFood;
      if (!f || !f.k) return;
      var q = parseFloat(this.value);
      if (isFinite(q)) $('#portKcal').value = Math.round(f.k * q);
    });
    // 自定义名称：搜索框里输入的内容也能当名字
    $('#portQty').addEventListener('keydown', function (e) { if (e.key === 'Enter') confirmFood(); });
    $('#portKcal').addEventListener('keydown', function (e) { if (e.key === 'Enter') confirmFood(); });

    /* 记运动 */
    $$('#moveSeg .seg-i').forEach(function (b) {
      b.addEventListener('click', function () {
        var mode = b.getAttribute('data-mode');
        $$('#moveSeg .seg-i').forEach(function (x) { x.classList.remove('is-on'); });
        b.classList.add('is-on');
        $('#movePickPane').hidden = mode !== 'pick';
        $('#moveManualPane').hidden = mode !== 'manual';
      });
    });
    $('#moveGrid').addEventListener('click', function (e) {
      var b = e.target.closest('[data-mv]');
      if (!b) return;
      $$('.mv').forEach(function (x) { x.classList.remove('is-on'); });
      b.classList.add('is-on');
      state.mvName = b.getAttribute('data-mv');
      state.mvMet = parseFloat(b.getAttribute('data-met'));
      updateMovePreview();
    });
    $('#mvDur').addEventListener('input', updateMovePreview);
    $$('.dur-mini').forEach(function (b) {
      b.addEventListener('click', function () {
        var inp = $('#mvDur');
        var v = (parseFloat(inp.value) || 0) + parseFloat(b.getAttribute('data-d'));
        inp.value = Math.max(1, Math.min(600, v));
        updateMovePreview();
      });
    });
    $('#btnAddMove').addEventListener('click', function () {
      if (!state.mvMet) { toast('先选一个运动'); return; }
      var dur = parseFloat($('#mvDur').value) || 0;
      addMove(state.mvName, E.metKcal(state.mvMet, (E.getProfile() || {}).w || 55, dur), dur, state.mvMet);
    });
    $('#btnAddMove2').addEventListener('click', function () {
      var n = $('#mvName').value.trim() || '随手一动';
      var k = parseFloat($('#mvKcal').value);
      if (!isFinite(k) || k <= 0) { toast('填一下消耗'); return; }
      addMove(n, k, 0, 0);
      $('#mvName').value = '';
      $('#mvKcal').value = '';
    });
    $('#mvList').addEventListener('click', function (e) {
      var b = e.target.closest('[data-del-move]');
      if (b) { E.delMove(b.getAttribute('data-del-move')); refreshMovePage(); refreshHome(); }
    });

    /* 我的 */
    $$('#sexSeg .seg-i').forEach(function (b) {
      b.addEventListener('click', function () {
        $$('#sexSeg .seg-i').forEach(function (x) { x.classList.remove('is-on'); });
        b.classList.add('is-on');
        var p = readProfileForm();
        p.sex = b.getAttribute('data-sex');
        E.setProfile(p);
        updateBmrCard(); refreshHome();
      });
    });
    ['#pfH', '#pfW', '#pfA'].forEach(function (sel) {
      $(sel).addEventListener('input', function () {
        E.setProfile(readProfileForm());
        updateBmrCard();
      });
      $(sel).addEventListener('blur', function () {
        E.setProfile(readProfileForm());
        updateBmrCard(); refreshHome();
      });
    });
    $$('#freqList .freq').forEach(function (b) {
      b.addEventListener('click', function () {
        $$('#freqList .freq').forEach(function (x) { x.classList.remove('is-on'); });
        b.classList.add('is-on');
        var p = readProfileForm();
        p.freq = parseFloat(b.getAttribute('data-f'));
        E.setProfile(p);
        updateBmrCard(); refreshHome();
      });
    });
    $$('#goalList .freq').forEach(function (b) {
      b.addEventListener('click', function () {
        $$('#goalList .freq').forEach(function (x) { x.classList.remove('is-on'); });
        b.classList.add('is-on');
        var p = readProfileForm();
        p.goal = parseFloat(b.getAttribute('data-g'));
        E.setProfile(p);
        updateBmrCard(); refreshHome();
      });
    });
    $('#btnExport').addEventListener('click', exportData);
    $('#btnImport').addEventListener('click', function () { $('#fileJson').click(); });
    $('#fileJson').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      if (f) importData(f);
      e.target.value = '';
    });
    $('#btnReset').addEventListener('click', function () {
      if (global.confirm('确定要清空所有记录吗?建议先导出备份。')) {
        E.reset();
        state.marks = [];
        resetStage();
        refreshMe(); refreshHome();
        toast('已清空');
      }
    });

    /* 总结图预览 */
    $('#btnShotClose').addEventListener('click', function () { $('#shotMask').hidden = true; });
    $('#shotMask').addEventListener('click', function (e) {
      if (e.target === this) this.hidden = true;
    });
    $('#btnShotSave').addEventListener('click', saveShot);

    /* 尺寸变化时重绘预览 */
    var rt = null;
    global.addEventListener('resize', function () {
      if (!state.mealImg) return;
      clearTimeout(rt);
      rt = setTimeout(drawStage, 160);
    });
  }


  /* ================= 放到手机桌面 ================= */
  var INS_KEY = 'kcal-ins-hint-v1';
  var P = global.PWA || null;

  function insPlatform() {
    return P ? P.platform() : 'desktop';
  }

  function insStepsHTML() {
    var pf = insPlatform();
    var steps;

    if (pf === 'wechat' || pf === 'qq') {
      steps = [
        '点右上角的 <b>···</b>',
        '选「<b>在浏览器打开</b>」',
        '在浏览器里点一次「添加」，就装好了'
      ];
    } else if (pf === 'ios') {
      steps = [
        '确认用的是 <b>Safari</b> 浏览器',
        '点底部中间的 <b>分享</b>（方框带向上箭头）',
        '往下滑，选「<b>添加到主屏幕</b>」',
        '右上角点「<b>添加</b>」'
      ];
    } else if (pf === 'android') {
      steps = [
        '点右上角的 <b>⋮</b> 菜单',
        '选「<b>安装应用</b>」或「添加到主屏幕」',
        '确认「添加」'
      ];
    } else {
      steps = [
        '这条链接在手机上打开',
        '点浏览器菜单里的「<b>安装应用</b>」或「添加到主屏幕」'
      ];
    }

    return steps.map(function (t, i) {
      return '<div class="ins-step"><span class="ins-n">' + (i + 1) + '</span>' +
        '<p class="ins-step-t">' + t + '</p></div>';
    }).join('');
  }

  function openIns() {
    var canNow = !!(P && P.canInstallNow());
    $('#insSteps').innerHTML = canNow ? '' : insStepsHTML();
    $('#insGo').hidden = !canNow;
    $('#insLead').textContent = canNow
      ? '点下面的一键添加，主屏幕就会多一个图标。'
      : '跟着下面几步，主屏幕就会多一个图标，点开就是全屏。';
    $('#insSheet').hidden = false;
    $('#insMask').hidden = false;
  }

  function closeIns() {
    $('#insSheet').hidden = true;
    $('#insMask').hidden = true;
  }

  function refreshIns() {
    var card = $('#insCard');
    if (!card) return;
    var done = false;
    if (P) {
      var st = P.state();
      done = st.standalone || st.installed;
    }
    card.classList.toggle('is-done', !!done);
    $('#insSub').textContent = done
      ? '已经装好了，从主屏幕点开就行'
      : (P && P.canInstallNow() ? '点「添加」，主屏幕多一个图标' : '点开就用，不用每次找网址');
  }

  function maybeBanner() {
    var b = $('#insBanner');
    if (!b) return;
    if (P && (P.isStandalone() || P.state().installed)) return;
    try { if (localStorage.getItem(INS_KEY) === '1') return; } catch (e) { }
    setTimeout(function () {
      b.hidden = false;
      // 9 秒后自己收起，不挡着下面的内容
      setTimeout(function () { b.hidden = true; }, 9000);
    }, 1800);
  }

  function initInstall() {
    refreshIns();
    maybeBanner();
    $('#insSteps').innerHTML = insStepsHTML();   // 预填，打开时不闪空白

    $('#insBtn').addEventListener('click', openIns);
    $('#insClose').addEventListener('click', closeIns);
    $('#insMask').addEventListener('click', closeIns);
    $('#insGo').addEventListener('click', function () {
      if (!P) return;
      P.install().then(function (outcome) {
        if (outcome === 'accepted') {
          closeIns();
          toast('装好了，去主屏幕看看');
        } else {
          toast('取消了，随时在「我的」里再添加');
        }
      });
    });
    $('#insBannerGo').addEventListener('click', function () {
      $('#insBanner').hidden = true;
      try { localStorage.setItem(INS_KEY, '1'); } catch (e) { }
      openIns();
    });
    $('#insBannerX').addEventListener('click', function () {
      $('#insBanner').hidden = true;
      try { localStorage.setItem(INS_KEY, '1'); } catch (e) { }
    });

    if (P) {
      P.onChange(function () { refreshIns(); });
    }
  }

  /* 从主屏快捷方式进来时，直接落到对应页面 */
  function startPage() {
    var m = /[?&]go=(eat|move|me|home)/.exec(location.search || '');
    if (!m) return false;
    go(m[1]);
    return true;
  }

  /* ================= 启动 ================= */
  function init() {
    paintIcons(document);
    renderMoveGrid();
    bind();
    renderPicks();
    refreshHome();
    refreshMe();
    refreshMovePage();
    initInstall();

    if (startPage()) return;

    var p = E.getProfile();
    if (!p || !p.h || !p.w || !p.a) {
      // 第一次进来，直接落到「我的」
      go('me');
      setTimeout(function () { toast('先填身高体重年纪，我才能算基础代谢'); }, 400);
    } else {
      go('home');
    }
  }

  global.UI = { toast: toast, go: go, refreshHome: refreshHome, init: init };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : globalThis);
