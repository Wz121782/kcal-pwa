/* ============================================================
   engine.js — 基础代谢 / 热量缺口计算 + 本地数据留痕
   数据全部存在本机 localStorage，不联网
   ============================================================ */
(function (global) {
  'use strict';

  var KEY = 'kcal-diary-v1';
  var MAX_IMG_EDGE = 720;

  /* ---------------- 日期 ---------------- */
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function dateKey(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function prettyDate(d) {
    d = d || new Date();
    var wk = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()];
    return (d.getMonth() + 1) + '月' + d.getDate() + '日 · ' + wk;
  }
  function hhmm(ts) {
    var d = new Date(ts);
    return pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /* ---------------- 存储 ---------------- */
  var mem = null;
  var warned = false;

  function blank() {
    return { v: 1, profile: null, days: {} };
  }

  function load() {
    if (mem) return mem;
    try {
      var raw = global.localStorage ? global.localStorage.getItem(KEY) : null;
      mem = raw ? JSON.parse(raw) : blank();
    } catch (e) {
      mem = blank();
    }
    if (!mem.days) mem.days = {};
    return mem;
  }

  function save() {
    try {
      global.localStorage.setItem(KEY, JSON.stringify(mem));
      return true;
    } catch (e) {
      if (!warned) {
        warned = true;
        if (global.UI && global.UI.toast) {
          global.UI.toast('手机存储快满了，去「我的 → 导出备份」清理一下');
        }
      }
      return false;
    }
  }

  function reset() {
    mem = blank();
    try { global.localStorage.removeItem(KEY); } catch (e) {}
    return mem;
  }

  function exportJSON() {
    return JSON.stringify(load(), null, 2);
  }

  function importJSON(txt) {
    var obj = JSON.parse(txt);
    if (!obj || typeof obj !== 'object' || !obj.days) throw new Error('格式不对');
    mem = obj;
    if (!mem.days) mem.days = {};
    save();
    return true;
  }

  /* ---------------- profile ---------------- */
  function getProfile() { return load().profile; }
  function setProfile(p) { load().profile = p; save(); }

  /* ---------------- 当日数据 ---------------- */
  function getDay(key) {
    key = key || dateKey();
    var db = load();
    if (!db.days[key]) db.days[key] = { meals: [], moves: [], traces: [] };
    return db.days[key];
  }

  function allDays() { return load().days; }

  function addMeal(meal, key) {
    var d = getDay(key);
    meal.id = meal.id || uid();
    d.meals.push(meal);
    save();
    return meal;
  }
  function delMeal(id, key) {
    var d = getDay(key);
    d.meals = d.meals.filter(function (m) { return m.id !== id; });
    save();
  }
  function addMove(mv, key) {
    var d = getDay(key);
    mv.id = mv.id || uid();
    d.moves.push(mv);
    save();
    return mv;
  }
  function delMove(id, key) {
    var d = getDay(key);
    d.moves = d.moves.filter(function (m) { return m.id !== id; });
    save();
  }
  /** 留痕图片占空间，超量时从最早的记录开始丢，保证 App 不会因为存储写满而坏掉 */
  function pruneTraces(db, max) {
    var days = Object.keys(db.days).sort();
    var total = 0, i;
    for (i = 0; i < days.length; i++) total += (db.days[days[i]].traces || []).length;
    var guard = 0;
    while (total > max && guard < 400) {
      guard++;
      for (i = 0; i < days.length && total > max; i++) {
        var arr = db.days[days[i]].traces;
        if (arr && arr.length) { arr.shift(); total--; }
      }
    }
  }

  function addTrace(t, key) {
    key = key || dateKey();
    var db = load();
    var d = getDay(key);
    t.id = t.id || uid();
    if (d.traces.length > 7) d.traces.shift();
    d.traces.push(t);
    pruneTraces(db, 32);
    save();
    return t;
  }

  /* ---------------- 核心计算 ---------------- */
  /**
   * Mifflin-St Jeor
   * 男: 10w + 6.25h - 5a + 5
   * 女: 10w + 6.25h - 5a - 161
   */
  function calcBMR(p) {
    if (!p || !p.h || !p.w || !p.a) return 0;
    var base = 10 * p.w + 6.25 * p.h - 5 * p.a;
    return Math.round(p.sex === 'm' ? base + 5 : base - 161);
  }

  /**
   * 计算某一天的完整收支
   * 缺口 = 基础代谢 + 日常额外消耗 + 运动消耗 - 饮食摄入
   */
  function calcDay(key) {
    var db = load();
    var p = db.profile;
    key = key || dateKey();
    var d = db.days[key] || { meals: [], moves: [], traces: [] };

    var bmr = calcBMR(p);
    var eat = 0;
    for (var i = 0; i < d.meals.length; i++) eat += (d.meals[i].kcal || 0);
    eat = Math.round(eat);

    var moveActual = 0;
    for (var j = 0; j < d.moves.length; j++) moveActual += (d.moves[j].kcal || 0);
    moveActual = Math.round(moveActual);

    // freq 系数里包含「日常活动」与「规律运动」两部分，各占一半
    var freq = (p && p.freq) || 1.375;
    var surplus = (freq - 1) * bmr;
    var daily = Math.round(surplus * 0.5);          // 日常额外：走动/通勤/家务/咀嚼消化
    var plannedMove = Math.round(surplus * 0.5);    // 档位隐含的运动消耗

    var hasMove = d.moves.length > 0;
    var move = hasMove ? moveActual : plannedMove;
    // 还没到晚上时给个提醒，不计入结算
    var out = bmr + daily + move;
    var gap = out - eat;

    var target = 0;
    if (p && p.goal) target = Math.round(out * (1 + p.goal));

    return {
      key: key,
      hasProfile: !!p,
      bmr: bmr,
      daily: daily,
      move: move,
      moveActual: moveActual,
      hasMove: hasMove,
      moveEstimated: !hasMove,
      eat: eat,
      out: out,
      gap: gap,
      target: target,
      tdee: bmr + surplus,
      meals: d.meals,
      moves: d.moves,
      traces: d.traces
    };
  }

  /* ---------------- MET 计算 ---------------- */
  /** kcal = MET × 3.5 × 体重kg ÷ 200 × 分钟 */
  function metKcal(met, weight, minutes) {
    if (!met || !weight || !minutes) return 0;
    return Math.round(met * 3.5 * weight / 200 * minutes);
  }

  /* ---------------- 图片压缩 ---------------- */
  function shrink(dataURL, maxEdge, type, quality) {
    return new Promise(function (resolve) {
      maxEdge = maxEdge || MAX_IMG_EDGE;
      type = type || 'image/jpeg';
      quality = quality || 0.75;
      var img = new Image();
      img.onload = function () {
        var w = img.naturalWidth || img.width;
        var h = img.naturalHeight || img.height;
        var k = Math.min(1, maxEdge / Math.max(w, h));
        var cw = Math.max(1, Math.round(w * k));
        var ch = Math.max(1, Math.round(h * k));
        var cv = document.createElement('canvas');
        cv.width = cw; cv.height = ch;
        var ctx = cv.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, cw, ch);
        ctx.drawImage(img, 0, 0, cw, ch);
        resolve(cv.toDataURL(type, quality));
      };
      img.onerror = function () { resolve(dataURL); };
      img.src = dataURL;
    });
  }

  /* ---------------- 建议文案 ---------------- */
  function gapComment(t) {
    if (!t.hasProfile) return '先去「我的」填一下身高体重，我才能算';
    var g = t.gap;
    if (g < -400) return '今天吃超了不少，明天稍微收一收就好，别自责';
    if (g < -150) return '略微超一点点，基本可以忽略';
    if (g < 150) return '今天几乎持平，身体很舒服的状态';
    if (g < 450) return '留出了不错的缺口，稳稳的在变轻';
    if (g < 800) return '缺口有点大，注意别饿着自己';
    return '缺口过大了，记得补点蛋白质';
  }

  global.ENGINE = {
    KEY: KEY,
    pad: pad,
    dateKey: dateKey,
    prettyDate: prettyDate,
    hhmm: hhmm,
    uid: uid,
    load: load,
    save: save,
    reset: reset,
    exportJSON: exportJSON,
    importJSON: importJSON,
    getProfile: getProfile,
    setProfile: setProfile,
    getDay: getDay,
    allDays: allDays,
    addMeal: addMeal,
    delMeal: delMeal,
    addMove: addMove,
    delMove: delMove,
    addTrace: addTrace,
    calcBMR: calcBMR,
    calcDay: calcDay,
    metKcal: metKcal,
    shrink: shrink,
    gapComment: gapComment
  };
})(typeof window !== 'undefined' ? window : globalThis);
