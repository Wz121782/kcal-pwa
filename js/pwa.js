/* ============================================================
   pwa.js — 添加到主屏幕
   · 注册 Service Worker（离线可用 + 满足安装条件）
   · 捕获 beforeinstallprompt，给「一键添加」
   · 分平台给出引导文案（iOS / Android / 微信 / 电脑）
   ============================================================ */
(function (global) {
  'use strict';

  var deferred = null;          // 浏览器给的安装凭据
  var installed = false;        // 本次已安装（appinstalled 事件）
  var listeners = [];

  /* ---------------- 环境判断 ---------------- */

  function isStandalone() {
    try {
      if (global.matchMedia && global.matchMedia('(display-mode: standalone)').matches) return true;
      if (global.matchMedia && global.matchMedia('(display-mode: fullscreen)').matches) return true;
      if (global.navigator.standalone === true) return true;
    } catch (e) { }
    return false;
  }

  function platform() {
    var u = (navigator.userAgent || '') + ' ' + (navigator.platform || '');
    if (/MicroMessenger/i.test(u)) return 'wechat';
    if (/QQ\/[0-9]/i.test(u)) return 'qq';
    if (/iPhone|iPad|iPod/i.test(u)) return 'ios';
    // iPadOS 13+ 伪装成 Mac
    if (/Macintosh/i.test(u) && navigator.maxTouchPoints > 1) return 'ios';
    if (/Android/i.test(u)) return 'android';
    return 'desktop';
  }

  function isiOS() { return platform() === 'ios'; }

  /* 能否一键安装（有 beforeinstallprompt 凭据） */
  function canInstallNow() { return !!deferred; }

  /* ---------------- 安装动作 ---------------- */

  function install() {
    if (!deferred) return Promise.resolve('unavailable');
    var d = deferred;
    deferred = null;
    emit();
    return d.prompt().then(function () {
      return d.userChoice;
    }).then(function (res) {
      return (res && res.outcome) || 'dismissed';
    }).catch(function () {
      return 'dismissed';
    });
  }

  /* ---------------- 事件 ---------------- */

  function emit() {
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](state()); } catch (e) { }
    }
  }

  function state() {
    return {
      standalone: isStandalone(),
      platform: platform(),
      canInstall: canInstallNow(),
      installed: installed
    };
  }

  function onChange(fn) {
    listeners.push(fn);
    return function () {
      var i = listeners.indexOf(fn);
      if (i > -1) listeners.splice(i, 1);
    };
  }

  /* ---------------- 启动 ---------------- */

  global.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
    emit();
  });

  global.addEventListener('appinstalled', function () {
    installed = true;
    deferred = null;
    emit();
  });

  if (global.matchMedia) {
    try {
      var mq = global.matchMedia('(display-mode: standalone)');
      if (mq.addEventListener) mq.addEventListener('change', emit);
    } catch (e) { }
  }

  /* Service Worker：只在 https 或 localhost 下注册 */
  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    var host = location.hostname;
    var ok = location.protocol === 'https:' ||
      host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
    if (!ok) return;

    global.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').then(function (reg) {
        // 有新版本时静默更新
        if (reg.waiting) reg.waiting.postMessage({ type: 'skip' });
      }).catch(function () { });
    });
  }

  registerSW();

  global.PWA = {
    state: state,
    onChange: onChange,
    install: install,
    canInstallNow: canInstallNow,
    isStandalone: isStandalone,
    platform: platform,
    isiOS: isiOS
  };
})(window);
