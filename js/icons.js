/* ============================================================
   icons.js — 规整线性图标（几何、正圆、统一线宽）
   ============================================================ */
(function (global) {
  'use strict';

  function s(inner) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
      'stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>';
  }

  var ICONS = {
    home: s('<path d="M3.2 10 12 3.2 20.8 10"/><path d="M5.6 9.2V19a1.6 1.6 0 0 0 1.6 1.6h9.6a1.6 1.6 0 0 0 1.6-1.6V9.2"/><path d="M9.8 20.6v-5.4h4.4v5.4"/>'),

    eat: s('<path d="M4 2.6v6.2a2.4 2.4 0 0 0 4.8 0V2.6"/><path d="M6.4 2.6v18.8"/><path d="M19.6 15.4V6.2a3.6 3.6 0 0 0-3.6 3.6v3.2a1.6 1.6 0 0 0 1.6 1.6h2z"/><path d="M19.6 15.4v6"/>'),

    move: s('<path d="M13.2 2.6 5 14h7l-.8 7.4L19.6 10h-7l.6-7.4z"/>'),

    me: s('<circle cx="12" cy="8.2" r="3.6"/><path d="M4.6 20.8a7.4 7.4 0 0 1 14.8 0"/>'),

    camera: s('<path d="M3 8.6A2.2 2.2 0 0 1 5.2 6.4h2.1l1.2-1.8c.24-.36.64-.6 1.1-.6h4.8c.46 0 .86.24 1.1.6l1.2 1.8h2.1A2.2 2.2 0 0 1 21 8.6v9a2.2 2.2 0 0 1-2.2 2.2H5.2A2.2 2.2 0 0 1 3 17.6z"/><circle cx="12" cy="12.9" r="3.6"/>'),

    flame: s('<path d="M12 2.8c.6 2.4 2 4.1 3.6 5.6 1.7 1.6 2.8 3.4 2.8 5.5a6.4 6.4 0 0 1-12.8 0c0-1.6.6-3 1.6-4.2.3 1.1 1 1.9 1.9 2.2-.3-3.4.4-6.5 2.9-9.1z"/>'),

    leaf: s('<path d="M20 3.8c-9.4-.9-15 2.9-15 8.6 0 4.4 3.1 7.4 7.4 7.4 6.1 0 7.6-6.9 7.6-16z"/><path d="M3.6 20.6c1.6-6.2 5.9-9.9 12.2-12.4"/>'),

    wave: s('<path d="M2.6 9.4c2.1-2.6 4.2 2.6 6.3 0s4.2-2.6 6.3 0 4.2 2.6 6.2 0"/><path d="M2.6 15.4c2.1-2.6 4.2 2.6 6.3 0s4.2-2.6 6.3 0 4.2 2.6 6.2 0"/>'),

    bowl: s('<path d="M3 11.2h18a9 9 0 0 1-18 0z"/><path d="M9.2 7.4c0-1.1.9-1.7.9-2.9"/><path d="M12.4 7.2c0-1.2.9-1.8.9-3"/><path d="M15.6 7.4c0-1.1.9-1.7.9-2.9"/>'),

    star: s('<path d="M12 3.4l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17.4 6.6 20.3l1-6.1L3.2 9.9l6.1-.9z"/>'),

    arrow: s('<path d="M4 12h15.4"/><path d="M15.2 7.6 19.6 12l-4.4 4.4"/>')
  };

  function paint(root) {
    root = root || document;
    var nodes = root.querySelectorAll('[data-ico]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.getAttribute('data-ico-done') === '1') continue;
      var name = el.getAttribute('data-ico');
      if (ICONS[name]) {
        el.setAttribute('data-ico-done', '1');
        el.innerHTML = ICONS[name];
      }
    }
  }

  global.ICONS = ICONS;
  global.paintIcons = paint;
})(typeof window !== 'undefined' ? window : globalThis);
