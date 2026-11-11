/* ==========================================================================
   2026 Planner · 站点脚本
   课程项目要求：原生 JavaScript，无框架
   负责：全屏、日历渲染、日计划、周提醒、月份统计、桌面宠物与气泡聊天
   ========================================================================== */

(function () {
  'use strict';

  /* ---------- 0. 存储键与工具 ---------- */
  var K_EVENTS = 'planner-events';
  var K_DECO = 'planner-deco';
  var K_REMINDERS = 'planner-reminders';
  var K_PET_POS = 'planner-pet-pos';
  var K_PET_IMG = 'planner-pet-img';
  var K_CHAT = 'planner-chat';
var K_PET_LANG = 'planner-pet-lang';   /* v10 · 桌宠回复语言：'en' / 'zh' */

  var YEAR = 2026;

  function load(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  function pad2(n) { return String(n).padStart(2, '0'); }

  function dateKey(y, m, d) {
    return String(y) + '-' + pad2(m + 1) + '-' + pad2(d);
  }

  function escapeText(str) {
    var div = document.createElement('div');
    div.textContent = String(str == null ? '' : str);
    return div.innerHTML;
  }

  var MONTH_EN = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  var MONTH_CN = ['一月', '二月', '三月', '四月', '五月', '六月',
    '七月', '八月', '九月', '十月', '十一月', '十二月'];

  /* ---------- 1. 全屏按钮 ---------- */
  var fsBtn = document.getElementById('fullscreenBtn');
  if (fsBtn) {
    fsBtn.addEventListener('click', function () {
      if (!document.fullscreenElement) {
        var el = document.documentElement;
        var req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
        if (req) {
          req.call(el).catch(function () {});
        }
      } else {
        var exit = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
        if (exit) { exit.call(document); }
      }
    });
    document.addEventListener('fullscreenchange', function () {
      fsBtn.setAttribute('aria-label', document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen');
    });
  }

  /* ---------- 2. 月份总览：统计每月事件数 ---------- */
  var monthCards = document.querySelectorAll('.month-card[data-month]');
  if (monthCards.length) {
    var allEvents = load(K_EVENTS, []);
    monthCards.forEach(function (card) {
      var m = Number(card.getAttribute('data-month'));
      var count = allEvents.filter(function (ev) {
        return String(ev.date || '').slice(0, 4) === String(YEAR) &&
          Number(String(ev.date).slice(5, 7)) === m;
      }).length;
      var badge = card.querySelector('[data-count]');
      if (badge) {
        badge.textContent = count ? count + (count === 1 ? ' entry' : ' entries') : 'no entries yet';
      }
    });
  }

  /* ---------- 3. 月度日历页 ---------- */
var calGridLeft = document.getElementById('calGridLeft');
  var calGridRight = document.getElementById('calGridRight');

  if (calGridLeft || calGridRight) {
    var currentMonth = 0;
    var params = new URLSearchParams(location.search);
    var qMonth = Number(params.get('month'));
    var today = new Date();

    if (qMonth >= 1 && qMonth <= 12) {
      currentMonth = qMonth - 1;
    } else {
      currentMonth = (today.getFullYear() === YEAR) ? today.getMonth() : 0;
    }

    /* 自定义字体 id 转 CSS 字族（写死映射，避免依赖后文变量） */
    function fontCss(id) {
      if (id === 'serif') { return '"Times New Roman", serif'; }
      if (id === 'sans') { return '"Segoe UI", system-ui, sans-serif'; }
      if (id === 'hand') { return '"Ink Free", "Segoe Script", cursive'; }
      return '';
    }

    var monthTitle = document.getElementById('monthTitle');
    var crumbPath = document.getElementById('crumbPath');
    var WEEK_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    function eventsOfMonth(month) {
      return load(K_EVENTS, []).filter(function (ev) {
        return String(ev.date || '').slice(0, 7) === String(YEAR) + '-' + pad2(month + 1);
      });
    }

    /* 单个日期格子：编号、事件标签、点击/键盘打开当天弹窗 */
    function buildCell(d, map, todayKey) {
      var key = dateKey(YEAR, currentMonth, d);
      var cell = document.createElement('div');
      cell.className = 'cal-cell';
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('tabindex', '0');
      cell.setAttribute('data-date', key);
      if (key === todayKey) { cell.classList.add('cal-cell--today'); }

      var num = document.createElement('span');
      num.className = 'cal-num';
      num.textContent = d;
      cell.appendChild(num);

      var evs = map[key] || [];

      if (evs.length) {
        var dot = document.createElement('span');
        dot.className = 'cal-dot';
        cell.appendChild(dot);

        /* 文字从日期下面开始往下排，排到格子底部才截断 */
        var box = document.createElement('div');
        box.className = 'cal-events';
        evs.slice(0, 3).forEach(function (ev, idx) {
          var tag = document.createElement('span');
          tag.className = 'cal-event cal-event--' + (idx === 0 ? 'a' : 'b');
          var cellPlain = String(ev.text || 'Plan').replace(/\s*\n+\s*/g, ' ').trim() || 'Plan';
          tag.textContent = cellPlain;
          tag.setAttribute('data-full', ev.text || 'Plan');
          if (ev.color) { tag.style.color = ev.color; }
          var fcss = fontCss(ev.font);
          if (fcss) { tag.style.fontFamily = fcss; }
          box.appendChild(tag);
        });
        cell.appendChild(box);
      }

      cell.addEventListener('click', function () {
        openDayPage(this.getAttribute('data-date'), this);
      });
      cell.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openDayPage(this.getAttribute('data-date'), this);
        }
      });
      return cell;
    }

    /* 填充一个半页网格：表头 + 星期偏移空格 + fromDay..toDay 日期 */
    function fillGrid(grid, fromDay, toDay, startOffset, map, todayKey) {
      grid.innerHTML = '';
      WEEK_EN.forEach(function (w, i) {
        var th = document.createElement('div');
        th.className = 'cal-weekday' + (i === 0 ? ' cal-weekday--sun' : '');
        th.setAttribute('role', 'columnheader');
        th.textContent = w;
        grid.appendChild(th);
      });
      for (var i = 0; i < startOffset; i++) {
        var blank = document.createElement('div');
        blank.className = 'cal-cell cal-cell--empty';
        grid.appendChild(blank);
      }
      for (var d = fromDay; d <= toDay; d++) {
        grid.appendChild(buildCell(d, map, todayKey));
      }
    }

    function renderCalendar() {
      renderPrio();
      if (monthTitle) {
        fitMonthTitle(MONTH_EN[currentMonth]);
      }
      if (crumbPath) { crumbPath.textContent = YEAR + ' / ' + MONTH_EN[currentMonth]; }

      var list = eventsOfMonth(currentMonth);
      var map = {};
      list.forEach(function (ev) {
        (map[ev.date] = map[ev.date] || []).push(ev);
      });

      /* 2026 年固定，按真实星期计算 */
      var first = new Date(YEAR, currentMonth, 1);
      var startWeekday = first.getDay(); /* 0 = 周日 */
      var daysInMonth = new Date(YEAR, currentMonth + 1, 0).getDate();
      var todayKey = (today.getFullYear() === YEAR)
        ? dateKey(YEAR, today.getMonth(), today.getDate())
        : null;

      /* 左页：1–15 号（不足 15 天的月份截断到月末） */
      if (calGridLeft) {
        fillGrid(calGridLeft, 1, Math.min(15, daysInMonth), startWeekday, map, todayKey);
      }
      /* 右页：16–月末，按 16 号当天的星期做偏移；不足 16 天则不渲染 */
      if (calGridRight && daysInMonth >= 16) {
        var off16 = new Date(YEAR, currentMonth, 16).getDay();
        fillGrid(calGridRight, 16, daysInMonth, off16, map, todayKey);
      }

      fitCellsText();

      /* 通知桌宠：这一页的记录变了，可以换表情了 */
      document.dispatchEvent(new Event('planner:daychange'));
    }

    /* 文字一直排到格子底部，排不下再截断加省略号 */
    function fitCellsText() {
      var cells = document.querySelectorAll('.bc-grid .cal-cell');
      Array.prototype.forEach.call(cells, function (cell) {
        var box = cell.querySelector('.cal-events');
        if (!box) { return; }

        var tags = Array.prototype.slice.call(box.children);
        if (!tags.length) { return; }

        var limit = box.clientHeight;
        if (!limit) { return; }

        /* 先还原全文，重新量一遍 */
        tags.forEach(function (t) {
          t.style.display = '';
          var full = t.getAttribute('data-full');
          if (full) { t.textContent = full; }
        });

        var used = 0;
        for (var i = 0; i < tags.length; i++) {
          var tag = tags[i];
          var room = limit - used;
          if (room < 26) { tag.style.display = 'none'; continue; }

          var full = tag.getAttribute('data-full') || '';
          if (!full) { tag.style.display = 'none'; continue; }

          tag.textContent = full;
          if (tag.offsetHeight <= room) {
            used += tag.offsetHeight + 2;
            continue;
          }

          /* 放不下：二分找最长还能放下的前缀 */
          var lo = 0;
          var hi = full.length;
          while (lo < hi) {
            var mid = Math.ceil((lo + hi) / 2);
            tag.textContent = full.slice(0, mid) + '\u2026';
            if (tag.offsetHeight <= room) { lo = mid; } else { hi = mid - 1; }
          }
          tag.textContent = full.slice(0, Math.max(0, lo)) + (lo < full.length ? '\u2026' : '');
          break;
        }
      });
    }

    /* 月份名过长时按可用宽度缩字号，避免压到右边的本月重点 */
    function fitMonthTitle(name) {
      if (!monthTitle) { return; }
      monthTitle.textContent = name;
      /* 新布局：标题在左页头部，右侧是翻月箭头，可用宽约 520px（布局 px） */
      var LIMIT = 520;
      var size = 64;
      monthTitle.style.fontSize = size + 'px';
      var w = monthTitle.offsetWidth;
      if (w > LIMIT) {
        size = Math.max(76, Math.floor(size * LIMIT / w));
        monthTitle.style.fontSize = size + 'px';
      }
    }

    /* ---- 2.2 本月重点：可编辑，按月单独保存 ---- */
    var K_PRIO = 'planner-priorities';
    var prioList = document.getElementById('prioList');
    var prioForm = document.getElementById('prioForm');
    var prioInput = document.getElementById('prioInput');

    function prioAll() {
      var data = load(K_PRIO, {});
      return (data && typeof data === 'object' && !Array.isArray(data)) ? data : {};
    }

    function prioOf(month) {
      var list = prioAll()[String(month + 1)];
      return Array.isArray(list) ? list : [];
    }

    function prioSet(month, list) {
      var all = prioAll();
      all[String(month + 1)] = list;
      save(K_PRIO, all);
    }

    function renderPrio() {
      if (!prioList) { return; }
      var items = prioOf(currentMonth);
      prioList.innerHTML = '';

      items.forEach(function (item, i) {
        var li = document.createElement('li');
        if (item.done) { li.classList.add('is-done'); }

        var box = document.createElement('input');
        box.type = 'checkbox';
        box.className = 'cal-prio__check';
        box.checked = !!item.done;
        box.addEventListener('change', function () {
          items[i].done = box.checked;
          li.classList.toggle('is-done', box.checked);
          prioSet(currentMonth, items);
        });

        var txt = document.createElement('span');
        txt.className = 'cal-prio__text';
        txt.textContent = item.text;
        txt.title = item.text;

        var del = document.createElement('button');
        del.type = 'button';
        del.className = 'cal-prio__del';
        del.textContent = '×';
        del.setAttribute('aria-label', 'Delete this priority');
        del.addEventListener('click', function () {
          items.splice(i, 1);
          prioSet(currentMonth, items);
          renderPrio();
        });

        li.appendChild(box);
        li.appendChild(txt);
        li.appendChild(del);
        prioList.appendChild(li);
      });
    }

    if (prioForm && prioInput) {
      prioForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var val = prioInput.value.trim();
        if (!val) { return; }
        var items = prioOf(currentMonth);
        items.push({ text: val, done: false });
        prioSet(currentMonth, items);
        prioInput.value = '';
        renderPrio();
      });
    }

    var prevBtn = document.getElementById('prevMonth');
    var nextBtn = document.getElementById('nextMonth');
    var todayBtn = document.getElementById('todayBtn');

    if (prevBtn) {
      prevBtn.addEventListener('click', function () {
        currentMonth = (currentMonth + 11) % 12;
        renderCalendar();
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        currentMonth = (currentMonth + 1) % 12;
        renderCalendar();
      });
    }
    if (todayBtn) {
      todayBtn.addEventListener('click', function () {
        currentMonth = (today.getFullYear() === YEAR) ? today.getMonth() : 0;
        renderCalendar();
      });
    }

    renderCalendar();

    /* ---- 3.1 当天记录：整页展开的大记录页 ---- */
    var dayPage = document.getElementById('dayPage');
    var daySheet = document.getElementById('daySheet');
    var dayBack = document.getElementById('dayBack');
    var dayPageDate = document.getElementById('dayPageDate');
    var dayEntryList = document.getElementById('dayEntryList');
    var dayForm = document.getElementById('dayForm');
    var dayInput = document.getElementById('dayInput');
    var dayPhoto = document.getElementById('dayPhoto');
    var fontChips = document.getElementById('fontChips');
    var colorDots = document.getElementById('colorDots');
    var photoWall = document.getElementById('photoWall');
    var photoWallEmpty = document.getElementById('photoWallEmpty');

    /* 点纸就写字：输入框跟随内容长高，不设字数上限 */
    function autoGrowDayInput() {
      if (!dayInput) { return; }
      dayInput.style.height = 'auto';
      var full = dayInput.scrollHeight || 44;
      dayInput.style.height = Math.min(full, 240) + 'px';
      /* 到顶以后才出滚动条，否则不给它显示，避免空框里露出滑道 */
      dayInput.style.overflowY = full > 240 ? 'auto' : 'hidden';
    }
    if (dayInput && dayForm) {
      dayInput.addEventListener('input', autoGrowDayInput);
      dayInput.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          dayForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        }
      });
    }

    var FONTS = [
      { id: 'hand',  label: 'Hand',  css: '"Ink Free", "Segoe Script", cursive' },
      { id: 'serif', label: 'Serif', css: '"Times New Roman", serif' },
      { id: 'sans',  label: 'Sans',  css: '"Segoe UI", system-ui, sans-serif' }
    ];
    var INKS = ['#1a1a1a', '#b8453c', '#2f55c8', '#3f7d3a', '#a86638', '#7a4f9e'];

    var pickFont = 'hand';
    var pickColor = INKS[0];
    var activeDate = null;
    var pendingPhoto = null;

    /* 字体选择：一排小胶囊 */
    if (fontChips) {
      FONTS.forEach(function (f) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'font-chip' + (f.id === pickFont ? ' is-active' : '');
        b.textContent = f.label;
        b.style.fontFamily = f.css;
        b.addEventListener('click', function () {
          pickFont = f.id;
          Array.prototype.forEach.call(fontChips.children, function (el) {
            el.classList.toggle('is-active', el === b);
          });
          dayInput.style.fontFamily = f.css;
          dayInput.focus();
        });
        fontChips.appendChild(b);
      });
    }

    /* 颜色选择：一排色点 */
    if (colorDots) {
      INKS.forEach(function (hex) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'color-dot' + (hex === pickColor ? ' is-active' : '');
        b.style.background = hex;
        b.setAttribute('aria-label', 'Ink ' + hex);
        b.addEventListener('click', function () {
          pickColor = hex;
          Array.prototype.forEach.call(colorDots.children, function (el) {
            el.classList.toggle('is-active', el === b);
          });
          dayInput.style.color = hex;
          dayInput.focus();
        });
        colorDots.appendChild(b);
      });
    }

    function fontCssOf(id) {
      for (var i = 0; i < FONTS.length; i++) {
        if (FONTS[i].id === id) { return FONTS[i].css; }
      }
      return FONTS[0].css;
    }

    function dayLabel(key) {
      var parts = key.split('-');
      return MONTH_EN[Number(parts[1]) - 1] + ' ' + Number(parts[2]) + ', ' + parts[0];
    }

    /* ---- 展开：从被点的格子放大到整屏 ---- */
    function openDayPage(key, cellEl) {
      if (!dayPage) { return; }
      activeDate = key;
      pendingPhoto = null;
      if (dayPhoto) { dayPhoto.value = ''; }
      if (dayPageDate) { dayPageDate.textContent = dayLabel(key); }
      if (dayInput) { dayInput.value = ''; }

      renderDayPage();

      dayPage.classList.add('is-open');
      dayPage.classList.add('is-animating');

      var full = { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
      var from = cellEl ? cellEl.getBoundingClientRect() : full;

      var sx = Math.max(.04, from.width / full.width);
      var sy = Math.max(.04, from.height / full.height);
      var dx = from.left - full.left;
      var dy = from.top - full.top;

      daySheet.style.transition = 'none';
      daySheet.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(' + sx + ',' + sy + ')';
      daySheet.style.opacity = '0';

      /* 强制一次重排，确保起始状态被浏览器记下 */
      void daySheet.offsetWidth;

      daySheet.style.transition = 'transform .52s cubic-bezier(.22,.9,.24,1), opacity .3s ease';
      daySheet.style.transform = 'translate(0px,0px) scale(1,1)';
      daySheet.style.opacity = '1';

      setTimeout(function () {
        dayPage.classList.remove('is-animating');
        daySheet.style.transition = '';
        if (dayInput) { dayInput.focus(); }
      }, 540);
    }

    /* ---- 收起：缩回刚才那一天 ---- */
    function closeDayPage() {
      if (!dayPage || !dayPage.classList.contains('is-open')) { return; }
      var key = activeDate;
      var cellEl = key ? document.querySelector('.cal-cell[data-date="' + key + '"]') : null;

      var full = { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
      var to = cellEl ? cellEl.getBoundingClientRect() : full;
      var sx = Math.max(.04, to.width / full.width);
      var sy = Math.max(.04, to.height / full.height);
      var dx = to.left - full.left;
      var dy = to.top - full.top;

      dayPage.classList.add('is-animating');
      daySheet.style.transition = 'transform .42s cubic-bezier(.5,0,.72,.3), opacity .34s ease';
      daySheet.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(' + sx + ',' + sy + ')';
      daySheet.style.opacity = '0';

      setTimeout(function () {
        dayPage.classList.remove('is-open');
        dayPage.classList.remove('is-animating');
        daySheet.style.transition = '';
        daySheet.style.transform = '';
        daySheet.style.opacity = '';
        activeDate = null;
        pendingPhoto = null;
        renderCalendar();
      }, 440);
    }

    /* ---- 渲染笔记列表 ---- */
    function renderDayPage() {
      if (!dayEntryList) { return; }
      var all = load(K_EVENTS, []);
      var mine = all.filter(function (ev) { return ev.date === activeDate; });

      dayEntryList.innerHTML = '';
      if (!mine.length) {
        var empty = document.createElement('li');
        empty.className = 'entry-empty';
        empty.textContent = 'Nothing planned for this day yet. Write one below.';
        dayEntryList.appendChild(empty);
      }

      mine.forEach(function (ev) {
        var li = document.createElement('li');
        var text = document.createElement('div');
        text.className = 'entry__text';
        text.textContent = ev.text || '';
        text.style.fontFamily = fontCssOf(ev.font);
        text.style.color = ev.color || INKS[0];
        li.appendChild(text);

        if (ev.photo) {
          var pic = document.createElement('img');
          pic.className = 'entry__pic';
          pic.src = ev.photo;
          pic.alt = 'Photo for this day';
          text.appendChild(pic);
        }

        var del = document.createElement('button');
        del.className = 'entry__del';
        del.type = 'button';
        del.textContent = '\u00d7';
        del.setAttribute('aria-label', 'Delete this note');
        del.addEventListener('click', function () {
          var rest = load(K_EVENTS, []).filter(function (item) {
            return !(item.date === ev.date && item.text === ev.text && item.photo === ev.photo);
          });
          save(K_EVENTS, rest);
          renderDayPage();
          renderCalendar();
        });
        li.appendChild(del);
        dayEntryList.appendChild(li);
      });

      renderDeco();
      renderPhotoWall(mine);
      updateWallEmpty();
      autoGrowDayInput();
    }

    /* ---- 画布通用：拖动 / 缩放 / 旋转 ---- */
    /* isTape=true 时多出三个尺寸手柄：拉长 / 变细 / 等比 */
    function addHandles(el, isTape) {
      var rot = document.createElement('div');
      rot.className = 'canvas-handle canvas-handle--rot';
      rot.title = 'Drag to rotate';
      el.appendChild(rot);

      if (isTape) {
        var e = document.createElement('div');
        e.className = 'canvas-handle canvas-handle--size-e';
        e.title = 'Drag to stretch the length';
        el.appendChild(e);

        var s = document.createElement('div');
        s.className = 'canvas-handle canvas-handle--size-s';
        s.title = 'Drag to change the thickness';
        el.appendChild(s);

        var se = document.createElement('div');
        se.className = 'canvas-handle canvas-handle--size-se';
        se.title = 'Drag to scale evenly';
        el.appendChild(se);
        return;
      }

      var size = document.createElement('div');
      size.className = 'canvas-handle canvas-handle--size';
      size.title = 'Drag to resize';
      el.appendChild(size);
    }

    /* kind='tape' 宽高独立；'sticker' / 'photo' 等比，高度自动 */
    function applyCanvasLook(el, data, kind) {
      var rot = typeof data.rot === 'number' ? data.rot : 0;
      var w = typeof data.w === 'number' ? data.w : 20;
      el.style.width = w + '%';
      el.style.transform = 'rotate(' + rot + 'deg)';
      if (kind === 'tape') {
        el.style.height = (typeof data.h === 'number' ? data.h : 40) + 'px';
      } else {
        el.style.height = 'auto';
      }
      if (kind === 'text') {
        var wallW1 = (photoWall && photoWall.clientWidth) || 600;
        el.style.fontSize = Math.max(11, Math.round((w / 100) * wallW1 * 0.095)) + 'px';
      }
    }

    function makeCanvasItem(el, data, kind, persist) {
      var mode = '';
      var startX = 0, startY = 0, startLeft = 0, startTop = 0;
      var startW = 0, startH = 0, wallW = 0, wallH = 0;
      var centerX = 0, centerY = 0, startDist = 0;

      el.addEventListener('pointerdown', function (e) {
        if (e.button !== undefined && e.button !== 0) { return; }
        var t = e.target;
        if (t.classList && t.classList.contains('deco-item__del')) { return; }

        e.preventDefault();
        e.stopPropagation();

        var allCanvas = photoWall.querySelectorAll('.canvas-item');
        for (var ci = 0; ci < allCanvas.length; ci++) {
          allCanvas[ci].style.zIndex = 2;
        }
        el.style.zIndex = 12;

        var wall = photoWall.getBoundingClientRect();
        var rect = el.getBoundingClientRect();

        startX = e.clientX;
        startY = e.clientY;
        startLeft = rect.left - wall.left;
        startTop = rect.top - wall.top;
        wallW = wall.width;
        wallH = wall.height;
        startW = rect.width;
        startH = rect.height;
        centerX = rect.left + rect.width / 2;
        centerY = rect.top + rect.height / 2;
        startDist = Math.max(20, Math.hypot(e.clientX - centerX, e.clientY - centerY));

        if (t.classList && t.classList.contains('canvas-handle--rot')) {
          mode = 'rot';
        } else if (t.classList && t.classList.contains('canvas-handle--size-e')) {
          mode = 'size-e';
        } else if (t.classList && t.classList.contains('canvas-handle--size-s')) {
          mode = 'size-s';
        } else if (t.classList && t.classList.contains('canvas-handle--size-se')) {
          mode = 'size-se';
        } else if (t.classList && t.classList.contains('canvas-handle--size')) {
          mode = 'size';
        } else {
          mode = 'move';
        }

        el.classList.add('is-dragging');
        try { el.setPointerCapture(e.pointerId); } catch (err) {}
      });

      el.addEventListener('pointermove', function (e) {
        if (!mode) { return; }
        var dx = e.clientX - startX;
        var dy = e.clientY - startY;

        if (mode === 'move') {
          var nx = Math.max(-startW * 0.4, Math.min(Math.max(10, wallW - startW * 0.6), startLeft + dx));
          var ny = Math.max(-startW * 0.4, Math.min(Math.max(10, wallH - startW * 0.2), startTop + dy));
          el.style.left = (nx / wallW) * 100 + '%';
          el.style.top = (ny / wallH) * 100 + '%';
          return;
        }

        if (mode === 'size-e') {
          var nw = Math.max(24, startW + dx);
          data.w = Math.round((nw / wallW) * 1000) / 10;
          applyCanvasLook(el, data, kind);
          return;
        }

        if (mode === 'size-s') {
          var nh = Math.max(12, startH + dy);
          data.h = Math.round(nh);
          applyCanvasLook(el, data, kind);
          return;
        }

        if (mode === 'size-se') {
          var curDist = Math.max(20, Math.hypot(e.clientX - centerX, e.clientY - centerY));
          var k = curDist / startDist;
          var ew = Math.max(24, startW * k);
          var eh = Math.max(12, startH * k);
          data.w = Math.round((ew / wallW) * 1000) / 10;
          data.h = Math.round(eh);
          applyCanvasLook(el, data, kind);
          return;
        }

        if (mode === 'size') {
          var pw = Math.max(30, startW + dx);
          data.w = Math.round((pw / wallW) * 1000) / 10;
          applyCanvasLook(el, data, kind);
          return;
        }

        if (mode === 'rot') {
          var ang = Math.atan2(e.clientY - centerY, e.clientX - centerX) * 180 / Math.PI;
          data.rot = Math.round((ang + 90) * 10) / 10;
          applyCanvasLook(el, data, kind);
        }
      });

      function finish() {
        if (!mode) { return; }
        mode = '';
        el.classList.remove('is-dragging');
        if (el.style.left) {
          data.x = Math.round((parseFloat(el.style.left) || 0) * 10) / 10;
        }
        if (el.style.top) {
          data.y = Math.round((parseFloat(el.style.top) || 0) * 10) / 10;
        }
        persist();
      }

      el.addEventListener('pointerup', finish);
      el.addEventListener('pointercancel', finish);
    }

    /* ---- 照片：贴在画布上，可拖 / 可缩放 / 可旋转 ---- */
    function renderPhotoWall(mine) {
      if (!photoWall) { return; }
      Array.prototype.slice.call(photoWall.querySelectorAll('.wall-photo')).forEach(function (el) {
        el.parentNode.removeChild(el);
      });

      var pics = mine.filter(function (ev) { return !!ev.photo; });

      pics.forEach(function (ev, idx) {
        var card = document.createElement('div');
        card.className = 'wall-photo canvas-item';

        var data = {
          x: typeof ev.px === 'number' ? ev.px : 8 + (idx % 3) * 30,
          y: typeof ev.py === 'number' ? ev.py : 8 + Math.floor(idx / 3) * 34,
          rot: typeof ev.rot === 'number' ? ev.rot : (idx % 2 ? 3.5 : -3),
          w: typeof ev.w === 'number' ? ev.w : 38,
          _w0: 38
        };

        card.style.left = data.x + '%';
        card.style.top = data.y + '%';
        applyCanvasLook(card, data, 'photo');

        var img = document.createElement('img');
        img.src = ev.photo;
        img.alt = ev.text || 'Photo for this day';
        card.appendChild(img);

        var cap = document.createElement('span');
        cap.className = 'wall-photo__cap';
        cap.textContent = ev.text || '';
        card.appendChild(cap);

        addHandles(card, false);

        makeCanvasItem(card, data, 'photo', function () {
          var all = load(K_EVENTS, []);
          all.forEach(function (row) {
            if (row.date === activeDate && row.photo === ev.photo && row.text === ev.text) {
              row.px = data.x;
              row.py = data.y;
              row.rot = data.rot;
              row.w = data.w;
            }
          });
          save(K_EVENTS, all);
        });

        photoWall.appendChild(card);
      });
    }

    /* ---- 3.1b 手账素材：胶带 / 背景布 / 贴纸 ---- */
    var decoTabs = document.getElementById('decoTabs');
    var decoTray = document.getElementById('decoTray');
    var emoteBar = document.getElementById('emoteBar');

    /* ---- 文字贴纸：面板与选择器 ---- */
    var textMaker = document.getElementById('textMaker');
    var textMakerInput = document.getElementById('textMakerInput');
    var textFontChips = document.getElementById('textFontChips');
    var textColorDots = document.getElementById('textColorDots');
    var textMakerAdd = document.getElementById('textMakerAdd');
    var textPickFont = 'hand';
    var textPickColor = INKS[0];
    var textEditingId = null;

    function syncTextPickers() {
      if (textFontChips) {
        Array.prototype.forEach.call(textFontChips.children, function (el) {
          el.classList.toggle('is-active', el.getAttribute('data-font') === textPickFont);
        });
      }
      if (textColorDots) {
        Array.prototype.forEach.call(textColorDots.children, function (el) {
          el.classList.toggle('is-active', el.getAttribute('data-ink') === textPickColor);
        });
      }
    }

    if (textFontChips) {
      FONTS.forEach(function (f) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'font-chip' + (f.id === textPickFont ? ' is-active' : '');
        b.textContent = f.label;
        b.style.fontFamily = f.css;
        b.setAttribute('data-font', f.id);
        b.addEventListener('click', function () {
          textPickFont = f.id;
          syncTextPickers();
          if (textMakerInput) { textMakerInput.focus(); }
        });
        textFontChips.appendChild(b);
      });
    }

    if (textColorDots) {
      INKS.forEach(function (hex) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'ink-dot' + (hex === textPickColor ? ' is-active' : '');
        b.style.background = hex;
        b.setAttribute('data-ink', hex);
        b.setAttribute('aria-label', 'Write in ' + hex);
        b.addEventListener('click', function () {
          textPickColor = hex;
          syncTextPickers();
          if (textMakerInput) { textMakerInput.focus(); }
        });
        textColorDots.appendChild(b);
      });
    }

    var TAPES = [
      { type: 'img', name: 'red gingham', src: 'assets/deco/tape-check.png', ratio: 3.065 },
      { type: 'img', name: 'polka dot', src: 'assets/deco/tape-dot.png', ratio: 2.269 },
      { type: 'img', name: 'daisy', src: 'assets/deco/tape-daisy.png', ratio: 3.275 },
      { type: 'img', name: 'pink leopard', src: 'assets/deco/tape-leopard.png', ratio: 3.111 },
      { type: 'css', name: 'cream', hex: '#f3e7c8' },
      { type: 'css', name: 'pink', hex: '#f8ced6' },
      { type: 'css', name: 'blue', hex: '#cbe3f3' },
      { type: 'css', name: 'green', hex: '#d3ecd1' },
      { type: 'css', name: 'kraft', hex: '#e3cdb0' },
      { type: 'css', name: 'lilac', hex: '#e3daf3' }
    ];

    var PAPERS = [
      { name: 'brown dots', img: 'assets/deco/paper-brown.png' },
      { name: 'yellow stars', img: 'assets/deco/paper-star.png' },
      { name: 'grid', css: 'background-color:#fdfaf0;background-image:linear-gradient(rgba(150,130,100,.22) 1px,transparent 1px),linear-gradient(90deg,rgba(150,130,100,.22) 1px,transparent 1px);background-size:18px 18px;' },
      { name: 'lines', css: 'background-color:#fffdf0;background-image:repeating-linear-gradient(transparent 0 21px,rgba(120,150,180,.42) 21px 22px);' },
      { name: 'dots', css: 'background-color:#fff5f7;background-image:radial-gradient(rgba(228,150,172,.55) 1.6px,transparent 1.6px);background-size:14px 14px;' },
      { name: 'check', css: 'background-color:#f4f9fd;background-image:linear-gradient(rgba(120,160,200,.38) 1px,transparent 1px),linear-gradient(90deg,rgba(120,160,200,.38) 1px,transparent 1px);background-size:20px 20px;' },
      { name: 'kraft', css: 'background-color:#e9dabd;background-image:radial-gradient(rgba(150,110,70,.16) 1px,transparent 1px);background-size:8px 8px;' },
      { name: 'leaf', css: 'background-color:#f3faf1;background-image:radial-gradient(rgba(118,178,120,.32) 2px,transparent 2px);background-size:17px 17px;' }
    ];

    var STICKERS = [
      { type: 'img', name: 'bear', src: 'assets/deco/sticker-bear.png' },
      { type: 'img', name: 'angel', src: 'assets/deco/sticker-angel.png' },
      { type: 'img', name: 'fish', src: 'assets/deco/sticker-fish.png' },
      { type: 'emoji', name: 'star', ch: '\u2b50' },
      { type: 'emoji', name: 'heart', ch: '\u2764\ufe0f' },
      { type: 'emoji', name: 'flower', ch: '\u2740' },
      { type: 'emoji', name: 'cloud', ch: '\u2601\ufe0f' },
      { type: 'emoji', name: 'bow', ch: '\ud83c\udf80' },
      { type: 'emoji', name: 'sparkle', ch: '\u2728' },
      { type: 'emoji', name: 'pin', ch: '\ud83d\udccc' },
      { type: 'emoji', name: 'cake', ch: '\ud83c\udf70' },
      { type: 'emoji', name: 'leaf', ch: '\ud83c\udf3f' },
      { type: 'emoji', name: 'cat', ch: '\ud83d\udc31' }
    ];

    var EMOTES = ['\ud83d\ude0a', '\ud83d\ude0c', '\ud83e\udd7a', '\ud83d\ude2e\u200d\ud83d\udca8', '\ud83e\udd14', '\ud83c\udf89', '\ud83d\udca4', '\u2764\ufe0f', '\ud83c\udf3f', '\u2600\ufe0f'];

    var decoCat = 'tape';

    function decoAll() { return load(K_DECO, {}); }

    function decoToday(create) {
      var all = decoAll();
      if (!all[activeDate] && create) {
        all[activeDate] = { paper: -1, items: [] };
      }
      var day = all[activeDate];
      if (day && !day.items) { day.items = []; }
      if (day && typeof day.paper !== 'number') { day.paper = -1; }
      return { all: all, day: day };
    }

    /* 素材栏：图片 / 色块 / emoji 缩略图，单行排不下时出现展开按钮 */
    function renderTray() {
      if (!decoTray) { return; }
      decoTray.classList.remove('is-expanded');
      decoTray.innerHTML = '';

      /* Text 页：素材栏让位给文字输入面板 */
      if (decoCat === 'text') {
        decoTray.style.display = 'none';
        if (textMaker) { textMaker.hidden = false; }
        updateExpandBtn();
        return;
      }
      decoTray.style.display = '';
      if (textMaker) { textMaker.hidden = true; }

      if (decoCat === 'tape') {
        TAPES.forEach(function (t, i) {
          var b = document.createElement('button');
          b.type = 'button';
          if (t.type === 'img') {
            b.className = 'deco-swatch deco-swatch--tape-img';
            var im = document.createElement('img');
            im.src = t.src;
            im.alt = t.name;
            b.appendChild(im);
          } else {
            b.className = 'deco-swatch deco-swatch--tape-css';
            b.style.background = t.hex;
          }
          b.setAttribute('aria-label', 'Tape ' + t.name);
          b.addEventListener('click', function () { addDeco('tape', i); });
          decoTray.appendChild(b);
        });
      } else if (decoCat === 'paper') {
        var cur = decoToday(false);
        var paperNow = cur.day ? cur.day.paper : -1;
        PAPERS.forEach(function (p, i) {
          var b = document.createElement('button');
          b.type = 'button';
          b.className = 'deco-swatch deco-swatch--paper' + (paperNow === i ? ' is-active' : '');
          if (p.img) {
            b.style.backgroundImage = 'url(' + p.img + ')';
            b.style.backgroundSize = 'cover';
            b.style.backgroundPosition = 'center';
          } else {
            b.setAttribute('style', p.css);
          }
          b.setAttribute('aria-label', 'Paper ' + p.name);
          b.addEventListener('click', function () { setPaper(i); });
          decoTray.appendChild(b);
        });
      } else {
        STICKERS.forEach(function (s, i) {
          var b = document.createElement('button');
          b.type = 'button';
          if (s.type === 'img') {
            b.className = 'deco-swatch deco-swatch--sticker-img';
            var im2 = document.createElement('img');
            im2.src = s.src;
            im2.alt = s.name;
            b.appendChild(im2);
          } else {
            b.className = 'deco-swatch deco-swatch--sticker-emoji';
            b.textContent = s.ch;
          }
          b.setAttribute('aria-label', 'Sticker ' + s.name);
          b.addEventListener('click', function () { addDeco('sticker', i); });
          decoTray.appendChild(b);
        });
      }

      updateExpandBtn();
    }

    function addDeco(cat, kind) {
      var store = decoToday(true);
      var item = {
        id: 'd' + Date.now() + Math.floor(Math.random() * 900),
        cat: cat,
        kind: kind,
        x: 10 + Math.round(Math.random() * 30),
        y: 10 + Math.round(Math.random() * 30),
        rot: Math.round((Math.random() * 14 - 7) * 10) / 10
      };

      if (cat === 'tape') {
        var tape = TAPES[kind];
        item.w = 28;
        if (tape.type === 'img') {
          var wallW0 = photoWall.clientWidth || 600;
          item.h = Math.round((item.w / 100 * wallW0) / tape.ratio);
        } else {
          item.h = 26;
        }
      } else {
        item.w = 15;
      }

      store.day.items.push(item);
      save(K_DECO, store.all);
      renderDeco();
      updateWallEmpty();
    }

    function setPaper(i) {
      var store = decoToday(true);
      store.day.paper = (store.day.paper === i) ? -1 : i;
      save(K_DECO, store.all);
      renderDeco();
      renderTray();
      updateWallEmpty();
    }

    /* 画布渲染：胶带宽高独立可调，贴纸等比，可拖动 / 旋转 */
    function renderDeco() {
      if (!photoWall || !activeDate) { return; }

      Array.prototype.slice.call(photoWall.querySelectorAll('.deco-item, .deco-paper')).forEach(function (el) {
        el.parentNode.removeChild(el);
      });

      var store = decoToday(false);
      var day = store.day;
      if (!day) { return; }

      if (typeof day.paper === 'number' && day.paper >= 0 && PAPERS[day.paper]) {
        var p = PAPERS[day.paper];
        var paper = document.createElement('div');
        paper.className = 'deco-paper';
        if (p.img) {
          paper.style.backgroundImage = 'url(' + p.img + ')';
          paper.style.backgroundSize = 'cover';
          paper.style.backgroundPosition = 'center';
        } else {
          paper.setAttribute('style', p.css);
        }
        photoWall.insertBefore(paper, photoWall.firstChild);
      }

      (day.items || []).forEach(function (it) {
        /* 文字贴纸：单独一套渲染，同样可拖 / 转 / 缩放 */
        if (it.cat === 'text') {
          var tel = document.createElement('div');
          tel.className = 'deco-item deco-item--text canvas-item';

          var tdata = {
            x: typeof it.x === 'number' ? it.x : 12,
            y: typeof it.y === 'number' ? it.y : 12,
            rot: typeof it.rot === 'number' ? it.rot : 0,
            w: typeof it.w === 'number' ? it.w : 38
          };

          tel.style.left = tdata.x + '%';
          tel.style.top = tdata.y + '%';

          var span = document.createElement('span');
          span.className = 'deco-item__text';
          span.textContent = it.text || '';
          var tfcss = fontCss(it.font);
          if (tfcss) { span.style.fontFamily = tfcss; }
          if (it.color) { span.style.color = it.color; }
          tel.appendChild(span);

          applyCanvasLook(tel, tdata, 'text');

          var tdel = document.createElement('button');
          tdel.type = 'button';
          tdel.className = 'deco-item__del';
          tdel.textContent = '\u00d7';
          tdel.setAttribute('aria-label', 'Remove this text');
          tdel.addEventListener('click', function (e) {
            e.stopPropagation();
            removeDeco(it.id);
          });
          tel.appendChild(tdel);

          addHandles(tel, false);

          makeCanvasItem(tel, tdata, 'text', function () {
            var s = decoToday(false);
            if (!s.day) { return; }
            s.day.items.forEach(function (row) {
              if (row.id === it.id) {
                row.x = tdata.x;
                row.y = tdata.y;
                row.rot = tdata.rot;
                row.w = tdata.w;
              }
            });
            save(K_DECO, s.all);
          });

          tel.addEventListener('dblclick', function (e) {
            e.preventDefault();
            e.stopPropagation();
            editText(it);
          });

          photoWall.appendChild(tel);
          return;
        }

        var el = document.createElement('div');
        el.className = 'deco-item canvas-item';

        var isTape = it.cat === 'tape';
        var pool = isTape ? TAPES : STICKERS;
        var item = pool[it.kind] || pool[0];

        var data = {
          x: typeof it.x === 'number' ? it.x : 10,
          y: typeof it.y === 'number' ? it.y : 10,
          rot: typeof it.rot === 'number' ? it.rot : 0,
          w: typeof it.w === 'number' ? it.w : (isTape ? 28 : 15)
        };

        if (isTape) {
          if (typeof it.h === 'number') {
            data.h = it.h;
          } else if (item.type === 'img') {
            data.h = Math.round((data.w / 100 * (photoWall.clientWidth || 600)) / item.ratio);
          } else {
            data.h = 26;
          }
        }

        el.style.left = data.x + '%';
        el.style.top = data.y + '%';

        if (isTape) {
          if (item.type === 'img') {
            var im = document.createElement('img');
            im.src = item.src;
            im.alt = item.name;
            im.className = 'deco-item__fill';
            el.appendChild(im);
          } else {
            el.classList.add('deco-item--csstape');
            el.style.background = item.hex;
          }
        } else {
          if (item.type === 'img') {
            var im2 = document.createElement('img');
            im2.src = item.src;
            im2.alt = item.name;
            el.appendChild(im2);
          } else {
            var sp = document.createElement('span');
            sp.className = 'deco-item__emoji';
            sp.textContent = item.ch;
            el.appendChild(sp);
          }
        }

        applyCanvasLook(el, data, isTape ? 'tape' : 'sticker');

        var del = document.createElement('button');
        del.type = 'button';
        del.className = 'deco-item__del';
        del.textContent = '\u00d7';
        del.setAttribute('aria-label', 'Remove this decoration');
        del.addEventListener('click', function (e) {
          e.stopPropagation();
          removeDeco(it.id);
        });
        el.appendChild(del);

        addHandles(el, isTape);

        makeCanvasItem(el, data, isTape ? 'tape' : 'sticker', function () {
          var s = decoToday(false);
          if (!s.day) { return; }
          s.day.items.forEach(function (row) {
            if (row.id === it.id) {
              row.x = data.x;
              row.y = data.y;
              row.rot = data.rot;
              row.w = data.w;
              if (isTape) { row.h = data.h; }
            }
          });
          save(K_DECO, s.all);
        });

        photoWall.appendChild(el);
      });
    }

    /* ---- 文字贴纸：放到画布 / 改字 ---- */
    function syncTextPickersSafe() { syncTextPickers(); }

    function placeText() {
      if (!textMakerInput || !activeDate) { return; }
      var val = (textMakerInput.value || '').trim();
      if (!val) { return; }

      var store = decoToday(true);
      if (!store.day) { return; }

      if (textEditingId) {
        store.day.items.forEach(function (it) {
          if (it.id === textEditingId) {
            it.text = val;
            it.font = textPickFont;
            it.color = textPickColor;
          }
        });
        textEditingId = null;
        if (textMakerAdd) { textMakerAdd.textContent = 'Place on page'; }
      } else {
        store.day.items.push({
          id: 'd' + Date.now() + Math.floor(Math.random() * 900),
          cat: 'text',
          text: val,
          font: textPickFont,
          color: textPickColor,
          x: 12 + Math.round(Math.random() * 22),
          y: 12 + Math.round(Math.random() * 46),
          rot: Math.round((Math.random() * 8 - 4) * 10) / 10,
          w: 38
        });
      }

      save(K_DECO, store.all);
      textMakerInput.value = '';
      renderDeco();
      updateWallEmpty();
    }

    function editText(it) {
      if (!textMaker || !textMakerInput) { return; }

      decoCat = 'text';
      if (decoTabs) {
        Array.prototype.forEach.call(decoTabs.children, function (el) {
          el.classList.toggle('is-active', el.getAttribute('data-cat') === 'text');
        });
      }
      renderTray();

      textEditingId = it.id;
      textMakerInput.value = it.text || '';
      textPickFont = it.font || 'hand';
      textPickColor = it.color || INKS[0];
      syncTextPickersSafe();
      if (textMakerAdd) { textMakerAdd.textContent = 'Update text'; }

      textMakerInput.focus();
      var n = textMakerInput.value.length;
      try { textMakerInput.setSelectionRange(n, n); } catch (err) {}
    }

    if (textMakerAdd) {
      textMakerAdd.addEventListener('click', function (e) {
        e.preventDefault();
        placeText();
      });
    }
    if (textMakerInput) {
      textMakerInput.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          placeText();
        }
      });
    }

    function removeDeco(id) {
      var store = decoToday(false);
      if (!store.day) { return; }
      store.day.items = store.day.items.filter(function (it) { return it.id !== id; });
      save(K_DECO, store.all);
      renderDeco();
      updateWallEmpty();
    }

    function updateWallEmpty() {
      if (!photoWallEmpty || !activeDate) { return; }
      var pics = load(K_EVENTS, []).filter(function (ev) {
        return ev.date === activeDate && ev.photo;
      }).length;
      var store = decoToday(false);
      var day = store.day;
      var decoCount = (day && day.items) ? day.items.length : 0;
      var hasPaper = !!(day && typeof day.paper === 'number' && day.paper >= 0);
      photoWallEmpty.style.display = (pics || decoCount || hasPaper) ? 'none' : 'flex';
    }

    /* 分类切换 */
    if (decoTabs) {
      decoTabs.addEventListener('click', function (e) {
        var b = e.target.closest('.deco-tab');
        if (!b) { return; }
        decoCat = b.getAttribute('data-cat');
        Array.prototype.forEach.call(decoTabs.children, function (el) {
          el.classList.toggle('is-active', el === b);
        });
        renderTray();
      });
    }

    renderTray();

    /* 展开 / 收起按钮：素材单行排不下时出现 */
    var decoExpand = null;
    if (decoTray && decoTray.parentNode) {
      decoExpand = document.createElement('button');
      decoExpand.type = 'button';
      decoExpand.className = 'deco-expand';
      decoExpand.textContent = 'Expand';
      decoTray.parentNode.appendChild(decoExpand);

      decoExpand.addEventListener('click', function () {
        var open = decoTray.classList.toggle('is-expanded');
        decoExpand.textContent = open ? 'Collapse' : 'Expand';
        updateExpandBtn();
      });
    }

    function updateExpandBtn() {
      if (!decoExpand || !decoTray) { return; }
      if (decoTray.classList.contains('is-expanded')) {
        decoExpand.style.display = '';
        decoExpand.textContent = 'Collapse';
        return;
      }
      var over = decoTray.scrollWidth > decoTray.clientWidth + 6;
      decoExpand.style.display = over ? '' : 'none';
      decoExpand.textContent = 'Expand';
    }

    window.addEventListener('resize', updateExpandBtn);

    /* 表情栏：点一下接在输入框后面 */
    if (emoteBar) {
      EMOTES.forEach(function (ch) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'emote-btn';
        b.textContent = ch;
        b.setAttribute('aria-label', 'Insert ' + ch);
        b.addEventListener('click', function () {
          if (!dayInput) { return; }
          dayInput.value = dayInput.value + ch;
          dayInput.focus();
        });
        emoteBar.appendChild(b);
      });
    }

    /* ---- 返回按钮 / 遮罩 / ESC ---- */
    if (dayBack) { dayBack.addEventListener('click', closeDayPage); }
    if (dayPage) {
      dayPage.addEventListener('click', function (e) {
        if (e.target === dayPage) { closeDayPage(); }
      });

      /* 点纸就写字：左半边空白处点一下，光标直接落到正文末尾 */
      var paperPad = dayPage.querySelector('.day-page__left');
      if (paperPad) {
        paperPad.addEventListener('click', function (e) {
          if (!dayInput) { return; }
          var t = e.target;
          while (t && t !== paperPad) {
            if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' ||
                t.tagName === 'BUTTON' || t.tagName === 'LABEL' ||
                t.tagName === 'IMG' || t.tagName === 'A' ||
                t.tagName === 'FORM') { return; }
            t = t.parentNode;
          }
          dayInput.focus();
          var n = dayInput.value.length;
          try { dayInput.setSelectionRange(n, n); } catch (err) {}
        });
      }
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && dayPage.classList.contains('is-open')) {
          closeDayPage();
        }
      });
    }

    /* ---- 新增一条记录：带上字体与颜色 ---- */
    if (dayForm) {
      dayForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var text = (dayInput.value || '').trim();
        if (!text || !activeDate) { return; }

        var all = load(K_EVENTS, []);
        all.push({
          date: activeDate,
          text: text,
          photo: pendingPhoto || null,
          font: pickFont,
          color: pickColor
        });
        save(K_EVENTS, all);

        dayInput.value = '';
        autoGrowDayInput();
        pendingPhoto = null;
        if (dayPhoto) { dayPhoto.value = ''; }
        renderDayPage();
        renderCalendar();
        dayInput.focus();
      });
    }

    if (dayPhoto) {
      dayPhoto.addEventListener('change', function () {
        var file = dayPhoto.files && dayPhoto.files[0];
        if (!file) { return; }
        if (file.size > 2 * 1024 * 1024) {
          alert('That photo is too large. Please pick an image under 2MB.');
          dayPhoto.value = '';
          return;
        }
        var reader = new FileReader();
        reader.onload = function (e) {
          pendingPhoto = e.target.result;
          alert('Photo is ready. Press "Add" to keep it on this day.');
        };
        reader.readAsDataURL(file);
      });
    }
  }

  /* ---------- 4. 每周提醒便签 ---------- */
  var noteInputs = document.querySelectorAll('.note-wall input[data-day]');
  if (noteInputs.length) {
    var reminders = load(K_REMINDERS, {});
    noteInputs.forEach(function (input) {
      var day = input.getAttribute('data-day');
      if (reminders[day]) { input.value = reminders[day]; }
      input.addEventListener('input', function () {
        var data = load(K_REMINDERS, {});
        data[day] = input.value;
        save(K_REMINDERS, data);
      });
    });
  }

  /* ==========================================================================
     5. 桌面宠物 + 贴纸气泡聊天
     ========================================================================== */

  /* 封面页不放桌宠：以页面上是否有封面本体为准，避免发布后路径变化误判 */
  var path = location.pathname.toLowerCase();
  var isCover = !!document.querySelector('.cover-book')
    || path === '/' || path.endsWith('/') || path.endsWith('/index.html');
  if (isCover) { return; }

  var petHtml =
    '<div class="pet" id="pet" role="button" tabindex="0" aria-label="Chat with the little one, or drag it anywhere">' +
    '  <img class="pet__img" id="petImg" alt="Desktop pet" />' +
    '</div>' +
    '<div class="pet-bubble" id="petBubble" role="dialog" aria-label="Chat with the little one">' +
    '  <div class="pet-bubble__head">' +
    '    <span>little friend</span>' +
    '    <div class="pet-lang" id="petLang" role="group" aria-label="Reply language">' +
    '      <button class="pet-lang__opt" type="button" data-lang="zh">中</button>' +
    '      <button class="pet-lang__opt" type="button" data-lang="en">EN</button>' +
    '    </div>' +
    '    <button class="btn btn--small btn--ghost" id="petChangeBtn" type="button">Change</button>' +
    '    <button class="pet-bubble__close" id="petBubbleClose" type="button" aria-label="Close">×</button>' +
    '  </div>' +
    '  <div class="pet-bubble__log" id="petLog"></div>' +
    '  <form class="pet-bubble__input" id="petForm">' +
    '    <input id="petInput" type="text" placeholder="Say something… (EN / 中文)" aria-label="Message to the little one" autocomplete="off" />' +
    '    <button class="btn" type="submit">Send</button>' +
    '  </form>' +
    '  <input id="petFile" type="file" accept="image/*" hidden />' +
    '</div>';

  var holder = document.createElement('div');
  holder.innerHTML = petHtml;
  while (holder.firstChild) { document.body.appendChild(holder.firstChild); }

  var pet = document.getElementById('pet');
  var petImg = document.getElementById('petImg');
  var petSource = document.getElementById('petSource');
  if (petSource) { petImg.src = petSource.src; }
  var petHint = null;
  var bubble = document.getElementById('petBubble');
  var bubbleClose = document.getElementById('petBubbleClose');
  var petLog = document.getElementById('petLog');
  var petForm = document.getElementById('petForm');
  var petInput = document.getElementById('petInput');
  var petChangeBtn = document.getElementById('petChangeBtn');
  var petFile = document.getElementById('petFile');
  var petLang = document.getElementById('petLang');

  /* ---- 5.1 位置：读取保存值 ---- */
  var pos = load(K_PET_POS, null);
  if (pos && typeof pos.left === 'number' && typeof pos.top === 'number') {
    pet.style.left = pos.left + 'px';
    pet.style.top = pos.top + 'px';
    pet.style.bottom = 'auto';
  }

  /* ---- 5.2a 上传图自动擦底色：不管底是白 / 灰 / 黑 / 任何颜色，
         都只留中间主体，最后裁掉四周空白，绝不套方块 ---- */
  function stripPetBg(file, done) {
    var reader = new FileReader();
    reader.onload = function (e) {
      var raw = e.target.result;
      var img = new Image();
      img.onload = function () {
        try {
          var MAX = 420;
          var k = Math.min(1, MAX / Math.max(img.width, img.height));
          var w = Math.max(1, Math.round(img.width * k));
          var h = Math.max(1, Math.round(img.height * k));
          var cv = document.createElement('canvas');
          cv.width = w;
          cv.height = h;
          var ctx = cv.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          var id = ctx.getImageData(0, 0, w, h);
          var d = id.data;

          /* 只认「白」：三通道都够亮、且几乎没有色偏 */
          var WHITE_MIN = 228;
          var WHITE_SPREAD = 26;
          function isWhite(i) {
            var o = i * 4;
            if (d[o + 3] < 8) { return true; }
            var r = d[o], g = d[o + 1], b = d[o + 2];
            var mx = Math.max(r, g, b);
            var mn = Math.min(r, g, b);
            return mn >= WHITE_MIN && (mx - mn) <= WHITE_SPREAD;
          }

          /* 从图片四条边向内走，每一步只穿过白色：
             深色 / 彩色 / 灰色的轮廓会把填充挡住，
             所以娃娃自己的白脸、白衣服不会被擦掉 */
          var seen = new Uint8Array(w * h);
          var q = [];
          function push(x, y) {
            if (x < 0 || y < 0 || x >= w || y >= h) { return; }
            var i2 = y * w + x;
            if (seen[i2]) { return; }
            if (!isWhite(i2)) { return; }
            seen[i2] = 1;
            q.push(i2);
          }
          for (var x1 = 0; x1 < w; x1++) { push(x1, 0); push(x1, h - 1); }
          for (var y1 = 0; y1 < h; y1++) { push(0, y1); push(w - 1, y1); }

          var head = 0;
          var cleared = 0;
          while (head < q.length) {
            var cur = q[head++];
            var cx = cur % w;
            var cy = Math.floor(cur / w);
            d[cur * 4 + 3] = 0;
            cleared++;
            push(cx + 1, cy);
            push(cx - 1, cy);
            push(cx, cy + 1);
            push(cx, cy - 1);
          }

          /* 边缘极浅的一圈白毛：只处理「几乎纯白」且紧贴擦除区的像素，
             保证白边不残留，同时不会啃到主体的白色面 */
          for (var y2 = 0; y2 < h; y2++) {
            for (var x2 = 0; x2 < w; x2++) {
              var i3 = y2 * w + x2;
              if (seen[i3]) { continue; }
              var o3 = i3 * 4;
              if (d[o3 + 3] === 0) { continue; }
              var nearClear = (x2 > 0 && seen[i3 - 1]) || (x2 < w - 1 && seen[i3 + 1]) ||
                              (y2 > 0 && seen[i3 - w]) || (y2 < h - 1 && seen[i3 + w]);
              if (!nearClear) { continue; }
              var r3 = d[o3], g3 = d[o3 + 1], b3 = d[o3 + 2];
              var mx3 = Math.max(r3, g3, b3);
              var mn3 = Math.min(r3, g3, b3);
              if (mn3 >= 242 && (mx3 - mn3) <= 12) { d[o3 + 3] = 0; }
            }
          }

          ctx.putImageData(id, 0, 0);

          /* 只按内容裁掉四周透明边；图里没有可擦的白边就原样返回 */
          if (!cleared) { done(raw); return; }

          var minX = w, minY = h, maxX = -1, maxY = -1;
          for (var y4 = 0; y4 < h; y4++) {
            for (var x4 = 0; x4 < w; x4++) {
              if (d[(y4 * w + x4) * 4 + 3] > 12) {
                if (x4 < minX) { minX = x4; }
                if (x4 > maxX) { maxX = x4; }
                if (y4 < minY) { minY = y4; }
                if (y4 > maxY) { maxY = y4; }
              }
            }
          }
          if (maxX < 0) { done(raw); return; }

          var cw = maxX - minX + 1;
          var ch = maxY - minY + 1;
          var cv2 = document.createElement('canvas');
          cv2.width = cw;
          cv2.height = ch;
          cv2.getContext('2d').drawImage(cv, minX, minY, cw, ch, 0, 0, cw, ch);
          done(cv2.toDataURL('image/png'));
        } catch (err) {
          done(raw);
        }
      };
      img.onerror = function () { done(raw); };
      img.src = raw;
    };
    reader.readAsDataURL(file);
  }
  window.stripPetBg = stripPetBg;

  /* ---- 5.2 自定义形象 ---- */
  var savedImg = localStorage.getItem(K_PET_IMG);
  if (savedImg) { petImg.src = savedImg; }

  petChangeBtn.addEventListener('click', function () {
    petFile.click();
  });

  petFile.addEventListener('change', function () {
    var file = petFile.files && petFile.files[0];
    if (!file) { return; }
    if (file.size > 6 * 1024 * 1024) {
      alert('That image is too large. Please pick an image under 6MB.');
      petFile.value = '';
      return;
    }
    stripPetBg(file, function (dataUrl) {
      petImg.src = dataUrl;
      try {
        localStorage.setItem(K_PET_IMG, dataUrl);
      } catch (err) {
        alert('This image is too large to store in the browser. Try a smaller one.');
      }
      pet.classList.add('is-happy');
      setTimeout(function () { pet.classList.remove('is-happy'); }, 520);
    });
    petFile.value = '';
  });

  /* ---- 5.3 拖拽 + 点击区分 ---- */
  var dragging = false;
  var moved = false;
  var startX = 0;
  var startY = 0;
  var originLeft = 0;
  var originTop = 0;

  pet.addEventListener('pointerdown', function (e) {
    if (e.target.closest('.pet__img') === null && e.target !== pet) { return; }
    dragging = true;
    moved = false;
    startX = e.clientX;
    startY = e.clientY;

    var rect = pet.getBoundingClientRect();
    originLeft = rect.left;
    originTop = rect.top;
    pet.setPointerCapture(e.pointerId);
  });

  pet.addEventListener('pointermove', function (e) {
    if (!dragging) { return; }
    var dx = e.clientX - startX;
    var dy = e.clientY - startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) { moved = true; }

    var newLeft = Math.max(4, Math.min(window.innerWidth - pet.offsetWidth - 4, originLeft + dx));
    var newTop = Math.max(4, Math.min(window.innerHeight - pet.offsetHeight - 4, originTop + dy));

    pet.style.left = newLeft + 'px';
    pet.style.top = newTop + 'px';
    pet.style.bottom = 'auto';

    if (bubble.classList.contains('is-open')) { placeBubble(); }
  });

  pet.addEventListener('pointerup', function (e) {
    if (!dragging) { return; }
    dragging = false;

    if (moved) {
      var rect = pet.getBoundingClientRect();
      save(K_PET_POS, { left: Math.round(rect.left), top: Math.round(rect.top) });
      return;
    }

    /* 没移动 = 点击：跳一下 + 弹气泡 */
    pet.classList.add('is-happy');
    setTimeout(function () { pet.classList.remove('is-happy'); }, 520);
    toggleBubble(true);
  });

  pet.addEventListener('pointercancel', function () {
    dragging = false;
  });

  pet.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleBubble(true);
    }
  });

  /* ---- 5.4 气泡定位：贴在宠物旁边，自动避让屏幕边缘 ---- */
  var BUBBLE_W = 316;   /* 与 .pet-bubble 的 width 保持一致 */

  function placeBubble() {
    var rect = pet.getBoundingClientRect();
    var bubbleH = bubble.offsetHeight || 260;
    var gap = 10;

    /* 水平：优先放右侧，右侧空间不够就放左侧 */
    var left;
    if (rect.right + gap + BUBBLE_W <= window.innerWidth - 8) {
      left = rect.right + gap;
    } else if (rect.left - gap - BUBBLE_W >= 8) {
      left = rect.left - gap - BUBBLE_W;
    } else {
      left = Math.max(8, Math.min(window.innerWidth - BUBBLE_W - 8, rect.left));
    }

    /* 垂直：底部对齐宠物，超出上边界则往下推 */
    var top = rect.bottom - bubbleH;
    if (top < 8) { top = 8; }
    if (top + bubbleH > window.innerHeight - 8) {
      top = Math.max(8, window.innerHeight - bubbleH - 8);
    }

    bubble.style.left = left + 'px';
    bubble.style.top = top + 'px';
  }

  function toggleBubble(forceOpen) {
    var willOpen = forceOpen === true ? true : !bubble.classList.contains('is-open');
    if (willOpen) {
      bubble.classList.add('is-open');
      placeBubble();
      renderChatLog();
      setTimeout(function () { petInput.focus(); }, 60);
    } else {
      bubble.classList.remove('is-open');
    }
  }

  bubbleClose.addEventListener('click', function () { toggleBubble(false); });

  window.addEventListener('resize', function () {
    if (bubble.classList.contains('is-open')) { placeBubble(); }
    /* 防止宠物被缩到屏幕外 */
    var rect = pet.getBoundingClientRect();
    if (rect.right > window.innerWidth || rect.bottom > window.innerHeight) {
      pet.style.left = Math.max(4, window.innerWidth - pet.offsetWidth - 8) + 'px';
      pet.style.top = Math.max(4, window.innerHeight - pet.offsetHeight - 8) + 'px';
      save(K_PET_POS, {
        left: Math.round(pet.getBoundingClientRect().left),
        top: Math.round(pet.getBoundingClientRect().top)
      });
    }
  });

  /* ---- v10 · 回复语言：默认英文，右上角 中 / EN 手动切换 ---- */
  function petLangValue() {
    try {
      var v = localStorage.getItem(K_PET_LANG);
      if (v === 'zh' || v === 'en') { return v; }
    } catch (e) { /* 读不到就按默认走 */ }
    return 'en';
  }

  function paintPetLang() {
    if (!petLang) { return; }
    var v = petLangValue();
    var opts = petLang.querySelectorAll('.pet-lang__opt');
    for (var i = 0; i < opts.length; i++) {
      var on = opts[i].getAttribute('data-lang') === v;
      if (on) { opts[i].classList.add('is-on'); } else { opts[i].classList.remove('is-on'); }
      opts[i].setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }

  if (petLang) {
    petLang.addEventListener('click', function (e) {
      var t = e.target && e.target.closest ? e.target.closest('.pet-lang__opt') : null;
      if (!t) { return; }
      var v = t.getAttribute('data-lang');
      if (v !== 'zh' && v !== 'en') { return; }
      try { localStorage.setItem(K_PET_LANG, v); } catch (err) { /* 存不下也先生效 */ }
      paintPetLang();
      renderChatLog();
    });
  }

  paintPetLang();

  /* ---- 5.5 聊天记录 ---- */
  function nowTime() {
    var d = new Date();
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  function renderChatLog() {
    var chats = load(K_CHAT, []);
    petLog.innerHTML = '';

    if (!chats.length) {
      var hello = document.createElement('div');
      hello.className = 'msg msg--pet';
      var helloName = '';
      try { helloName = (localStorage.getItem('planner-user-name') || '').trim(); } catch (e) {}
      if (petLangValue() === 'zh') {
        hello.textContent = helloName
          ? '嗨 ' + helloName + '，我是住在这本计划本里的小娃娃。今天想先做哪一件事？'
          : '嗨，我是住在这本计划本里的小娃娃。今天想先做哪一件事？';
      } else {
        hello.textContent = helloName
          ? 'Hi ' + helloName + '! I am the little doll living in this planner. What do you want to do first today?'
          : 'Hi! I am the little doll living in this planner. What do you want to do first today?';
      }
      petLog.appendChild(hello);
    }

    chats.forEach(function (m) {
      var div = document.createElement('div');
      div.className = 'msg ' + (m.role === 'user' ? 'msg--user' : 'msg--pet');
      div.textContent = m.text;
      if (m.time) {
        var t = document.createElement('span');
        t.className = 'msg__time';
        t.textContent = m.time;
        div.appendChild(t);
      }
      petLog.appendChild(div);
    });

    petLog.scrollTop = petLog.scrollHeight;
  }

  function pushChat(role, text) {
    var chats = load(K_CHAT, []);
    chats.push({ role: role, text: text, time: nowTime() });
    if (chats.length > 60) { chats = chats.slice(chats.length - 60); }
    save(K_CHAT, chats);
    renderChatLog();
  }

  /* ---- 5.6 回复引擎：精确关键词 + 引用原话兜底（纯本地规则，不发网络请求） ---- */
/* 排序原则：越具体的话题越靠前；中文不用单独一个「今天」这种高频词，
   英文一律加 \b 词边界，避免 hot 命中 photo、tea 命中 teach、work 命中 framework。 */
var RULES = [
  {
    /* v9 · 极端情绪：最先判，先接住，不给任何方法 */
    re: /(不想活|活不下去|活着没意思|活着没意义|想死|自杀|结束自己|不想存在)|\b(don'?t want to live|kill myself|end it all|want to die)\b/i,
    replies: {
      zh: ['这句话我不会随便带过去。先别一个人待着，去找你信得过的人说一声，或者打学校的心理热线。我在这本子里等你回来。',
           '我认真说：现在先让一个真人陪着你，不用自己扛。愿意的话，把这句话写下来，明天再翻给我看。'],
      en: ['I will not brush past that. Please do not sit with it alone — tell someone you trust, or call your school counselling line. I will be here when you come back.',
           'I mean this: get a real person with you now. If you want, write it down here and show me tomorrow.']
    }
  },
  {
    /* 问它是谁、能干什么：最先判，别被别的词抢走 */
    re: /(你是谁|你叫什么|你的名字|你叫啥|你能做什么|你会做什么|你会什么|你是干嘛|你是干什么|你几岁|你多大|你住哪|who are you|what are you|what can you do|your name|how old are you)/i,
    replies: {
      zh: ['我是住在这本 2026 计划本里的小娃娃。任意一天都能写计划、贴照片、贴胶带和贴纸，也可以把我拖到页面别的地方。',
           '我就住在这本本子里，负责陪你写字。想安排一天、贴张照片，或者只是聊两句，都行。'],
      en: ['I am the little one living inside this 2026 planner. Write plans, attach photos, add tape or stickers on any day, and drag me anywhere you like.',
           'I live in this planner and keep you company while you write. Plans, photos, or just talking, all fine.']
    }
  },
  {
    /* v9 · 问是不是 AI：诚实回答，别装成模型 */
    re: /(你是ai|你好像ai|你是人工智能|你是机器人|你是不是机器人|你是不是ai|are you ai|are you an ai|are you a robot|artificial intelligence)/i,
    replies: {
      zh: ['不是。我没有连网，也不会自己思考，我只会按这本本子里写好的句子回你。所以你问我太复杂的事，我可能接不住。',
           '严格说不算。我是一组写在这个网站里的回答规则，听起来像个人，但不会真的懂你。'],
      en: ['Not really. I am a set of lines written into this planner. No network, no model, no thinking.',
           'No. I only match what you type against sentences stored in this site. It sounds like a person, but it does not understand you.']
    }
  },
  {
    /* v9 · 被说答非所问 / 被嫌笨：先认，不辩解 */
    re: /(答非所问|你听不懂|你没听懂|你没在听|你没看懂|你好笨|你真笨|你有点笨|你是假的|你是机器人|你是ai|你好像ai|只会重复|复读机|敷衍我|你不行)|\b(you don'?t understand|you are not listening|you are dumb|you are stupid|you are useless|you are fake|you are a robot|you are a bot)\b/i,
    replies: {
      zh: ['这句我认。我只会按本子里写好的话回你，接不住的时候就直接说没接住。你把刚才那句再讲一遍，我换个说法。',
           '是我没跟上。你说得再具体一点，我照着接。'],
      en: ['Fair. I only know the lines written into this planner, and I say so when I miss. Say it again and I will try another way.',
           'That one is on me. Give me a little more detail and I will follow.']
    }
  },
  {
    /* 「你今天怎么样」这类问候：必须排在日期规则前面 */
    re: /(你今天怎么样|你最近怎么样|你过得怎么样|你还好吗|你怎么样|你好吗|今天过得怎么样|今天过得如何|今天还好吗|心情怎么样|你今天开心吗|今天开心吗|过得开心吗|how are you|how are you doing|how is it going|how do you feel|how was your day|are you okay|are you happy)/i,
    replies: {
      zh: ['我挺好的，一直在这页上等你翻回来。你呢，{name}，今天过得顺不顺？',
           '还不错，刚才偷偷翻了几页空着的格子。{name}，你今天怎么样？',
           '看到你打开这一页我就开心了。{name}，今天有没有想写下来的事？'],
      en: ['I am doing well, waiting right here on this page. How about you, {name}?',
           'Pretty good, {name}. I peeked at a few empty boxes. How is your day going?',
           'Seeing you open this page makes me happy, {name}. Anything you want to write down?']
    }
  },
  {
    /* v9 · 夸它：排在「你好」和「开心」之前，否则「你好棒」会被问候或好消息抢走 */
    re: /(你最棒|你好棒|你真棒|你太棒了|你好厉害|你真厉害|你太厉害了|你真好|你太好了|你超会聊天|你比siri强|你好可爱|你太可爱了|你好萌|你真可爱|你好漂亮|你好帅|you are great|you'?re great|you are the best|you are amazing)/i,
    replies: {
      zh: ['嘿嘿，被你这么一夸，我想在页面上蹦两下。',
           '那我得对得起这句话，后面继续好好接你的话。'],
      en: ['Hehe, now I want to hop around this page.',
           'Then I had better keep earning it. I will listen more carefully.']
    }
  },
  {
    re: /(你好|您好|嗨|哈喽|在吗|在不在|早上好|中午好|下午好|晚上好|好久不见|\bhello\b|\bhi\b|\bhey\b|good morning|good evening)/i,
    replies: {
      zh: ['我在呀，{name}。今天想先翻到哪一页？', '嗨，{name}，你来了。要不要先写一件今天最想做的事？'],
      en: ['I am here, {name}. Which page shall we open first?', 'Hi {name}! Want to write the one thing you most want to do today?']
    }
  },
  {
    /* 问网站怎么做的 */
    re: /(怎么做|怎么实现|怎么弄的|怎么弄出来|用什么做|怎么开发|代码怎么写|什么原理|技术栈|github|前端|后端|html|css|javascript|vue|react|\bjs\b|\bgit\b)/i,
    replies: {
      zh: ['这本本子是 HTML、CSS 加一点原生 JavaScript 做的，没上框架。翻到「关于」那页能看到大概结构。'],
      en: ['This planner is built with HTML, CSS and plain JavaScript, no framework. The About page sketches how it fits together.']
    }
  },
  {
    /* 问怎么贴照片、怎么用胶带贴纸 */
    re: /(照片|图片|相片|贴照片|加照片|上传|怎么贴|怎么加|怎么放|装饰|胶带|贴纸|背景布|素材|手账|scrapbook|\bphoto\b|\bphotos\b|\bpicture\b|\bimage\b|upload|\btape\b|\bsticker\b)/i,
    replies: {
      zh: ['点进任意一天就会打开这一页。左边写下文字，右下角点 Attach photo 贴照片；右边 Scrapbook 里有胶带、背景布和贴纸，点一下就贴上去，之后能拖、能转、能调大小。',
           '照片贴上去以后可以直接拖动摆位置。胶带有三个手柄：拉长、变细、整体放大，贴纸和照片保持原来的形状不变。'],
      en: ['Open any day. Type on the left and hit Attach photo to add a picture. The Scrapbook on the right holds tape, paper and stickers: click one to stick it, then drag, rotate or resize it.',
           'Once a photo is on the page you can drag it anywhere. Tape has three handles: stretch, thin, and scale as a whole. Stickers and photos keep their own shape.']
    }
  },
  {
    /* v9 · 问关系：你是我朋友吗 / 你会记得我吗 */
    re: /(你是我朋友吗|我们是朋友吗|你喜欢我吗|你会想我吗|你会记得我吗|你有感情吗|你有心吗|are you my friend|do you like me|will you remember me|do you have feelings)/i,
    replies: {
      zh: ['我住在这本本子里，你翻到哪一页我就在哪一页。这算不算朋友，你说了算。',
           '我记得你的名字，也记得你写过的格子。对我来说这就够了。'],
      en: ['I live in this notebook. Whatever page you open, that is where I am. You decide if that counts as a friend.',
           'I remember your name and the boxes you filled. That is enough for me.']
    }
  },
  {
    /* v9 · 讨厌我 / 不想理我：必须排在「我喜欢 X」之前，否则「讨厌你」会被当成一个喜好对象 */
    re: /(我讨厌你|我烦你|我不喜欢你|我恨你|我不理你了|不想理你|不想跟你说话|懒得理你|你走开|滚开|别烦我|闭嘴|i hate you|i don'?t like you|leave me alone|shut up|go away)/i,
    replies: {
      zh: ['好，那我先安静一会儿。你不想说话的时候我不追问，等你想写东西了，我还在这一页。',
           '收到。气头上不用跟我解释，先把这股气写进今天的格子里，写完会轻一点。'],
      en: ['Alright, I will be quiet for a while. No questions. When you feel like writing, I am still on this page.',
           'Noted. You do not have to explain. Put the anger in today\'s box first; it may lighten.']
    }
  },
  {
    /* v9 · 自我否定：先否掉那个词，再给一个很小的动作 */
    re: /(我好没用|我真没用|我没用|我好笨|我很笨|我太笨了|我什么都做不好|我做不到|我不行|我讨厌自己|我不喜欢自己|我很失败|我是废物|我好差劲|我一无是处)|\b(i am useless|i am stupid|i am a failure|i hate myself|i am not good enough|i am worthless)\b/i,
    replies: {
      zh: ['我不这么看。你至少回来把这句话说出来了，这就不是没用。今天先写一件你做成过的小事，哪怕很小。',
           '别对自己用那么重的词。你不是一次结果，你是还在往前走的人。'],
      en: ['I do not see it that way. You came here and said it out loud, that is not nothing. Write one small thing you managed today.',
           'Do not use that word on yourself. You are not one result, you are someone still moving.']
    }
  },
  {
    /* 爱你 / 想你：必须排在「我喜欢 X」之前，否则会把 you 当成对象 */
    re: /(爱你|想你|想你了|抱抱|喜欢你|爱你哟|陪陪我|陪我聊|陪我说话|陪我一会儿|别走|不要走|\blove you\b|\bmiss you\b|miss u|\bhug\b|\bhugs\b|stay with me)/i,
    replies: {
      zh: ['我也在，{name}。今天也要好好照顾自己。', '抱一下。然后把今天最想做的事写下来吧。',
           '被你这么一说，我今天整页都亮了。'],
      en: ['I am here too, {name}. Take care of yourself today.', 'A hug. Now write down the one thing you want to do.',
           'That just lit up my whole page.']
    }
  },
  {
    /* 我喜欢 X：把对象引回来 */
    re: /(?:我喜欢|我超喜欢|我最喜欢|我讨厌|我不喜欢|i like|i love|i hate)\s*([^\s，。！？,.!?]{1,20})/i,
    replies: {
      zh: ['「{x}」呀，记下来了。要不要把它也写进今天的格子？', '原来是「{x}」。以后想到的时候，可以回来翻这一页。'],
      en: ['"{x}", noted. Want to put that in today\'s box?', 'So "{x}" is your thing. Come back to this page when you miss it.']
    }
  },
  {
    /* v10 · 展示 / 答辩 / 演讲 */
    re: /(展示|答辩|演讲|汇报|路演)|\b(presentation|presenting|demo|pitch|defend my project)\b/i,
    replies: {
      zh: ['先把要讲的三个点写下来，再对着它们练两遍，进场就不慌了。',
           '演示前一天别改结构，只顺一遍流程。改动的风险比不完美大。'],
      en: ['Write the three points you must say, then run through them twice. That keeps you calm in the room.',
           'Do not restructure the night before. Rehearse the flow instead; last-minute changes cost more than imperfection.']
    }
  },
  {
    /* v9 · 生气、委屈、孤单、害怕：先接住情绪，再给一个很小的动作 */
    re: /(好生气|我生气了|气死|气炸|好委屈|委屈|好孤独|孤独|好孤单|孤单|寂寞|没人理我|没人懂我|没人陪我|心里难受|心里堵|心酸|鼻子酸|想放弃|害怕|好怕|我怕|紧张|好紧张|心慌|慌了|没安全感|不安|忐忑|想躺平|心情不好|不太开心|我哭了|又哭了|眼泪|掉眼泪|失恋|分手了|想分手|被骂|挨骂|吵架|吵了一架|\bemo\b)|\b(angry|lonely|scared|afraid|nervous|anxious|feel awful)\b/i,
    replies: {
      zh: ['先不用讲道理，我陪你待一会儿。要不要把最难受的那一句写下来？写出来就不用一直憋着。',
           '这种时候不是你的错。今天可以什么都不做，先把情绪放下来。',
           '气可以先发出来，不用压着。写一行字，或者贴一张乱七八糟的胶带，都行。'],
      en: ['No need to explain or justify. I will sit here with you. Write the worst sentence down, so you do not have to hold it.',
           'This is not your fault. Today you are allowed to do nothing.',
           'Let it out. One line, or one messy piece of tape. Both work.']
    }
  },
  {
    /* 累了、烦了、压力大：中文改成具体搭配，避免「麻烦」「积累」误命中 */
    re: /(有点累|一点累|些累|挺累|好累|很累|太累|累了|累死|疲惫|心累|乏了|没力气|难过|伤心|难受想哭|想哭|委屜|好烦|很烦|太烦|烦躁|心烦|烦死|压力大|有压力|焦虑|不开心|不快乐|崩溃|郁闷|低落|丧|tired|exhausted|sad|upset|anxious|stressed|stressful|depressed|overwhelmed|burned out|feel bad|not okay)/i,
    replies: {
      zh: ['那就先不着急，把肩膀放下来。今天可以只完成一件小事。',
           '这种时候不用逼自己高效，先喝口水，慢慢来。',
           '要不要把让你烦的那件事写下来？写完会轻一点。'],
      en: ['Let us slow down. One small thing is enough for today.',
           'Take a breath. You do not have to be productive right now.',
           'Write down the thing that is bothering you. It gets lighter on paper.']
    }
  },
  {
    re: /(开心|高兴|太棒|好棒|棒极了|激动|快乐|成功了|考过了|通过了|拿到 offer|录取|哈哈|太好了|开森|happy|excited|great|awesome|amazing|so good|\byay\b|proud)/i,
    replies: {
      zh: ['真好啊，这种日子值得标一下。要不要贴张照片留个纪念？',
           '给你鼓个掌。把它写进今天的格子，以后翻回来还会笑。'],
      en: ['That is lovely. Days like this deserve a photo in the box.',
           'Clapping for you. Write it down so future you can smile at it.']
    }
  },
  {
    re: /(计划|安排|待办|目标|日程|任务|清单|规划|列个表|\bplan\b|\bplans\b|\bplanning\b|schedule|\btodo\b|to-do|\bgoal\b|\btask\b|\btasks\b)/i,
    replies: {
      zh: ['把最大的那件事写下来，再拆成两步，剩下的先不写。',
           '一天留三件事就好，其他空格留给休息。',
           '先挑一件今天非做不可的，其余的排到别的日子。'],
      en: ['Write the biggest task down, split it into two steps, leave the rest blank.',
           'Three tasks a day is plenty. Leave room for rest.',
           'Pick the one that must happen today. Move the rest to another box.']
    }
  },
  {
    re: /(学习|考试|四级|六级|雅思|托福|期末|期中|复习|作业|论文|上课|背书|刷题|成绩|绩点|考研|预习|\bexam\b|\bexams\b|\bstudy\b|\bstudying\b|homework|\bpaper\b|\bclass\b|\bclasses\b|\btest\b|\btests\b|\bgrade\b|\bquiz\b|assignment)/i,
    replies: {
      zh: ['先把这一轮要看的范围写清楚，再定一个能做完的量，不要一次写完。',
           '坐下来先做二十分钟，做不完也没关系，重点是开始。'],
      en: ['Write the exact scope first, then pick a size you can finish. Do not plan the whole semester.',
           'Start with twenty minutes. Finishing is not the point, starting is.']
    }
  },
  {
    re: /(工作|上班|实习|面试|简历|求职|投简历|入职|加班|老板|同事|\boffer\b|\bjob\b|\bjobs\b|\bwork\b|\bworking\b|\bresume\b|\bcv\b|interview|internship|\bcareer\b|salary)/i,
    replies: {
      zh: ['把要做的那一步写具体，比如「改简历第一段」，比写「找工作」有用得多。',
           '面试前把要讲的三个点写在格子里，进去就不慌了。'],
      en: ['Make the step concrete, like "rewrite the first bullet", not "find a job".',
           'Before the interview, write your three key points in the box.']
    }
  },
  {
    /* 天气：hot / rain / wind 都加了词边界，不会命中 photo、brain、window */
    re: /(天气|下雨|下雪|好热|好冷|降温|出太阳|刮风|台风|闷热|转凉|潮汕|太晒|\brain\b|\brains\b|\bsnow\b|\bsnowing\b|\bsunny\b|\bcold\b|\bhot\b|weather|\bwind\b|\bwindy\b|humid|storm)/i,
    replies: {
      zh: ['这种天气适合把要做的事挪到室内。要不要把今天的安排改一改？',
           '先照顾好自己，出门记得带伞或加件外套。'],
      en: ['Weather like this is a good reason to move things indoors. Want to shift today a little?',
           'Take care of yourself first. Umbrella or a jacket.']
    }
  },
  {
    /* 吃：eat / tea 加边界，不会命中 great、please、teach、team */
    re: /(吃|饿|咖啡|奶茶|饭|零食|外卖|火锅|早餐|午饭|晚饭|宵夜|\bfood\b|\bhungry\b|coffee|\btea\b|\beat\b|\beating\b|\bsnack\b|\bsnacks\b|restaurant)/i,
    replies: {
      zh: ['记得吃点东西，别只靠咖啡撑一整天。', '先垫一点，再回来写计划。'],
      en: ['Eat something. Do not run on coffee alone.', 'A small snack first, then back to the planner.']
    }
  },
  {
    re: /(睡觉|睡了|想睡|去睡|早点睡|该睡|困了|好困|太困|熬夜|打盹|失眠|睡不着|睡不好|睡不踏实|翻来覆去|做梦|\bsleep\b|\bsleepy\b|\bbed\b|\bnap\b|\brest\b|good night|insomnia)/i,
    replies: {
      zh: ['今天到这儿就好，明天这一页还会等你。', '早点睡，明天再翻开新的格子。'],
      en: ['That is enough for today. Tomorrow is still here.', 'Sleep early. A new box will be waiting.']
    }
  },
  {
    re: /(可爱|好看|漂亮|帅|好萌|真萌|cute|lovely|pretty|handsome|adorable)/i,
    replies: {
      zh: ['嘿嘿，被你夸得想再跳一下。', '谢谢你，那我也陪你把这页写完。'],
      en: ['Hehe, now I want to hop again.', 'Thank you. I will stay with you while you finish this page.']
    }
  },
  {
    re: /(听歌|唱歌|音乐|偶像|追星|演唱会|专辑|打歌|应援|\bmusic\b|\bsong\b|\bsongs\b|concert|\balbum\b|\bidol\b|\bfan\b|kpop|playlist)/i,
    replies: {
      zh: ['演唱会那天值得单独占一格。要不要把日期和场馆先写上？',
           '把喜欢的歌写下来，以后翻到这页还能想起当时的心情。'],
      en: ['A concert day deserves its own box. Write the date and venue first.',
           'Note the song down. You will remember the mood later.']
    }
  },
  {
    re: /(电影|电视剧|综艺|动画|看剧|追剧|\bmovie\b|\bmovies\b|\bfilm\b|\bdrama\b|series|anime|netflix|episode)/i,
    replies: {
      zh: ['看完想留一句感想吗？这里刚好有空格。', '好看的话就写一行，别让记忆只停在聊天记录里。'],
      en: ['Want to keep one line about it? There is space right here.', 'Write a line down. Memory deserves better than a chat log.']
    }
  },
  {
    re: /(无聊|没事干|好闲|打游戏|玩什么|\bbored\b|\bboring\b|\bgame\b|\bgames\b|\bgaming\b)/i,
    replies: {
      zh: ['要不要翻到随便一个月，看看那些空着的格子，挑一天填点东西？',
           '无聊的时候适合想一想：这周最想完成的一件事是什么？'],
      en: ['Open any month and pick one empty box to fill. That usually helps.',
           'Boredom is a good moment to ask: what is the one thing this week?']
    }
  },
  {
    re: /(朋友|家人|室友|同学|男朋友|女朋友|闺蜜|爸妈|\bfriend\b|\bfriends\b|\bfamily\b|roommate|\bpartner\b|parents)/i,
    replies: {
      zh: ['和他们有关的日子可以记下来，比如约好的时间或生日。', '把要说的那句话先写在格子里，见面时就不容易忘。'],
      en: ['Days involving them deserve a note: plans, birthdays, small things.', 'Write the sentence down first. Easier to say it later.']
    }
  },
  {
    re: /(想买|买了|购买|购物|花钱|省钱|淘宝|下单|预算|剁手|\bshopping\b|\bshop\b|\bbuy\b|\bbought\b|\bmoney\b|\bprice\b|budget|\bsale\b)/i,
    replies: {
      zh: ['想买的先写下来放一天，第二天还想要再买，会少花不少。', '把预算写在旁边，比记在脑子里靠谱。'],
      en: ['Write it down and wait a day. If you still want it, buy it.', 'Put the budget next to it. Better than keeping it in your head.']
    }
  },
  {
    re: /(旅行|旅游|出去玩|机票|酒店|行程|订票|度假|出发|\btrip\b|\btrips\b|\btravel\b|vacation|\bflight\b|\bhotel\b|airbnb|itinerary)/i,
    replies: {
      zh: ['先去日历把出发那天圈出来，再倒着排要做的事。', '把想去的地方写在格子里，比只收藏链接更容易成行。'],
      en: ['Mark the departure day first, then work backwards.', 'Write the place down. It beats saving links forever.']
    }
  },
  {
    re: /(头疼|头痛|胃疼|胃痛|不舒服|生病|感冒|牙疼|难受|发烧|肚子疼|经期|痛经|腰疼|嗓子疼|\bsick\b|\bhurt\b|\bhurts\b|\bpain\b|headache|\bfever\b|stomach)/i,
    replies: {
      zh: ['身体优先，今天的计划可以直接划掉一半，不用愧疚。', '先把该休息的时间空出来，其他的往后挪。'],
      en: ['Body first. Cross out half of today without guilt.', 'Block out rest time. Move the rest later.']
    }
  },
  {
    re: /(喝水|多喝水|补水|\bdrink\b|\bwater\b)/i,
    replies: {
      zh: ['去倒一杯吧，回来再继续。', '顺手在格子里写个「喝水」，完成了就打个勾。'],
      en: ['Go grab a glass. Come back after.', 'Write "water" in a box and tick it when done.']
    }
  },
  {
    /* 日期：不再单独匹配「今天」「明天」，必须带「几号／星期几／哪天」这类限定 */
    re: /(几号|星期几|几点|什么日子|什么日期|哪天|今天几号|明天几号|后天几号|这周几|下周几|怎么翻月|日历怎么用|怎么看日期|\bwhat date\b|\bwhat day\b|\bdate\b|calendar)/i,
    replies: {
      zh: ['点开日历里对应的那个格子就能看到具体日期，也能直接在那一格写计划。',
           '要安排到哪天？在月历上找到那一格点进去就好。'],
      en: ['Open the matching box in the calendar to see the date and write there.',
           'Which day? Click that box in the month view.']
    }
  },
  {
    /* 拖延 / 时间不够 */
    re: /(拖延|来不及|没时间|时间不够|效率|专注|分心|静不下心|不想动|deadline|procrastinat|can not focus|\bfocus\b|too much to do)/i,
    replies: {
      zh: ['先只做五分钟，做完再决定要不要继续。开始比计划重要。',
           '把任务缩小到一句话能说清的程度，比如「打开文档写第一段」。'],
      en: ['Do five minutes first, then decide whether to continue. Starting beats planning.',
           'Shrink the task until it fits one sentence, like "open the doc and write one paragraph".']
    }
  },
  {
    re: /(生日|年龄|几岁|多大年纪|\bbirthday\b|\bage\b)/i,
    replies: {
      zh: ['生日值得占一格。要不要先把那一天标出来，再想想要怎么过？',
           '记下来就不会忘。把日期和想请的人写在同一个格子里。'],
      en: ['A birthday deserves its own box. Mark the date, then think how you want to spend it.',
           'Write the date and the people in the same box. You will not forget it.']
    }
  },
  {
    /* v9 · 要删掉我 / 换掉我：排在「保存删除」规则之前，别答成存储说明 */
    re: /(删了你|删掉你|把你删了|换掉你|换了你|不要你了|关掉你|卸载你|把你扔掉|不想养你|i will delete you|i'?ll delete you|replace you|turn you off|uninstall you)/i,
    replies: {
      zh: ['那我先把这一页收好。你要是真换掉我，记得把照片和胶带一起带走。',
           '行吧。走之前至少把这周的格子填完，别让我白等。'],
      en: ['Then I will tidy this page up. If you really swap me out, take the photos and tape with you.',
           'Fine. At least finish this week\'s boxes before you go.']
    }
  },
  {
    re: /(记住|记忆|保存|记录|记一下|记下|帮我记|会不会丢|删除|清空|备份|隐私|别人看到|\bsave\b|\bsaved\b|\bremember\b|\bstore\b|localstorage|\bdelete\b|privacy)/i,
    replies: {
      zh: ['写下的东西都存在这台设备本地，刷新还在；换浏览器或换人就看不到你的记录了。',
           '放心写，这些内容只留在你自己的浏览器里。'],
      en: ['Everything is saved locally on this device and survives a refresh. Another browser sees a clean copy.',
           'Write freely. It stays in your own browser only.']
    }
  },
  {
    /* v9 · 道歉 */
    re: /(对不起|抱歉|不好意思|原谅我|我错了)|\b(sorry|my bad|apologies)\b/i,
    replies: {
      zh: ['不用道歉，我没记仇。那件事要是还压着，写进格子里比跟我道歉有用。',
           '没事的。你愿意回来接着说，就已经很好了。'],
      en: ['No apology needed. I do not hold grudges. If it still sits on you, put it in a box.',
           'It is fine. Coming back to say it is already enough.']
    }
  },
  {
    re: /(谢谢|感谢|多谢|thank|thanks|thx)/i,
    replies: {
      zh: ['不用谢，我一直在这本本子里。', '客气啦，下次也来找我。'],
      en: ['You are welcome. I live right here.', 'Anytime. Come find me again.']
    }
  },
  {
    re: /(再见|拜拜|晚安|走了|bye|goodbye|see you)/i,
    replies: {
      zh: ['去忙吧，记得把这页合上再走。', '回头见，我会在原地等你。'],
      en: ['Go ahead. Close this page before you leave.', 'See you. I will be right here.']
    }
  },
  {
    /* v10 · 求打气 / 求鼓励 */
    re: /(加油|加加油|打气|打打气|鼓劲|鼓励我|安慰我|说点好听的|给我点动力|我能不能行|我行不行|我能行吗)|\b(cheer me up|cheer up|encourage me|motivate me|pep talk|can i do it|give me strength)\b/i,
    replies: {
      zh: ['来，我陪你一起。先写一件今天最想做成的事，做完就算赢。',
           '打气的事我包了。不用一次做完，先把开头写下来。'],
      en: ['I am right here with you. Write the one thing you most want to finish today; starting it already counts.',
           'Consider me your cheerleader. You do not have to do it all at once, just write the first line.']
    }
  },
  {
    /* v10 · 我做到了 / 求夸 */
    re: /(我做到了|我完成了|我搞定了|我做完了|我成功了|夸夸我|夸我|我厉害吗|我好厉害)|\b(i did it|i finished|i made it|i completed|proud of me|tell me i did well)\b/i,
    replies: {
      zh: ['那必须夸。你刚说的那句，我建议直接写进今天的格子，留个证据。',
           '看到了，你是真的做到了。来，把这件事圈起来。'],
      en: ['Then I am saying it out loud: well done. Write that in today\'s box as proof.',
           'You really did it. Circle that one.']
    }
  },
  {
    /* v10 · 老师 / 学校要求 */
    re: /(老师|辅导员|班主任|教务处|学校要求|作业要求|课程要求)|\b(teacher|professor|advisor|counsellor|deadline from school)\b/i,
    replies: {
      zh: ['老师的要求一般写在通知里，照着一条条对一遍，别凭印象。',
           '要问的事提前写成一句，发出去比憋在心里好。'],
      en: ['Requirements usually live in the notice. Check them one by one instead of relying on memory.',
           'Turn your question into one sentence and send it. Better than keeping it in your head.']
    }
  },
  {
    /* v10 · 忘了 / 记不住 */
    re: /(忘了|忘记了|记不住|记性|想不起来|忘性)|\b(forgot|forget|can'?t remember|forgetful)\b/i,
    replies: {
      zh: ['那就交给这本本子。写下来，明天翻到这一页就不用再靠脑子。',
           '写进格子比记在脑子里稳。忘了也不要紧，回来翻就有。'],
      en: ['Then leave it to the notebook. Write it down and this page will remember for you.',
           'A box beats memory. Forgetting is fine as long as it is written somewhere.']
    }
  },
  {
    /* v10 · 减肥 / 运动 */
    re: /(减肥|健身|运动|跑步|瑜伽|体重|锻炼|练腹)|\b(workout|work out|gym|exercise|running|yoga|diet|dieting|lose weight)\b/i,
    replies: {
      zh: ['别把目标定成数字，先定一个能坚持的动作，比如每天走十分钟。',
           '运动这件事，频率比强度重要。今天做一点点就算数。'],
      en: ['Do not aim at a number. Aim at something repeatable, like ten minutes of walking.',
           'Frequency beats intensity. A little today still counts.']
    }
  },
  {
    /* v10 · 化妆 / 护肤 / 穿搭 */
    re: /(化妆|护肤|穿搭|衣服|发型|美甲|口红|出门带什么)|\b(makeup|skincare|skincare routine|outfit|haircut|nail)\b/i,
    replies: {
      zh: ['出门前的准备也值得写一格，尤其是要见人的日子。',
           '把要带的东西列出来，出门就不会落东西。'],
      en: ['Getting-ready routines deserve a box too, especially on days you meet people.',
           'List what you are taking with you so nothing gets left behind.']
    }
  },
  {
    /* v10 · 宠物 */
    re: /(猫|狗|宠物|猫咪|小狗|小猫)|\b(cat|cats|dog|dogs|pet|pets|kitten|puppy)\b/i,
    replies: {
      zh: ['它今天有没有做什么好玩的事？值得记一笔。',
           '和它待一会儿，比刷手机更容易缓过来。'],
      en: ['Did it do anything funny today? That is worth a line.',
           'A few minutes with it settles you better than scrolling does.']
    }
  },
  {
    /* v10 · 暗恋 / 告白（避开「男朋友」，那条归朋友规则） */
    re: /(喜欢一个人|暗恋|告白|表白|心动|crush)|\b(confess|have a crush|in love with)\b/i,
    replies: {
      zh: ['这种心事不用急着说出口，先写下来，看看自己到底想说什么。',
           '把最想对那个人说的那句话写一行，明天再决定要不要发。'],
      en: ['No need to say it out loud yet. Write it first and see what you actually mean.',
           'Write the one sentence you want to tell them, then decide tomorrow whether to send it.']
    }
  },
  {
    /* v10 · 问语言怎么切 */
    re: /(切换语言|换语言|说英文|说英语|说中文|用英语说|用中文说|英文回复|中文回复)|\b(speak english|speak chinese|switch language|reply in english|reply in chinese|change language)\b/i,
    replies: {
      zh: ['点气泡右上角的「中 / EN」就能换。中文英文我都看得懂，你想让我用哪种说，就选哪种。',
           '右上角那个小开关就是语言按钮，随时能切，切完之后我回你的句子就跟着变。'],
      en: ['Tap the 中 / EN switch at the top right of this bubble. I read both languages and answer in whichever you pick.',
           'That little switch up there changes my language. It applies from the next reply on.']
    }
  },
  {
    /* v10 · 没思路 / 帮我写 */
    re: /(帮我想|帮我写|帮我改|没思路|没有想法|写不出来|不知道怎么开头|不知道写什么)|\b(help me write|help me think|no idea|don'?t know how to start)\b/i,
    replies: {
      zh: ['先写一句最普通的开头，比如「今天……」，剩下的顺着往下走。',
           '不用想整篇，先想第一个词。写出来再改，比空着想快。'],
      en: ['Start with the plainest sentence, like "Today I ...", and keep going from there.',
           'Do not plan the whole thing. Find the first word; writing then editing beats staring.']
    }
  },
  {
    /* v10 · 手机 / 电脑 / 页面没反应 */
    re: /(手机|电脑|打不开|卡住|闪退|没反应|报错|显示不出来)|\b(bug|not working|freeze|froze|crashed|blank page|won'?t open)\b/i,
    replies: {
      zh: ['先刷新一次试试。这个页面不用联网，刷新一般就能回来。',
           '如果某块没反应，换一个浏览器打开看看，多半是缓存的问题。'],
      en: ['Try a refresh first. This page needs no network, so it usually comes right back.',
           'If something stops responding, open it in another browser. It is usually a cache issue.']
    }
  }
];

function hasChinese(str) {
  return /[\u4e00-\u9fa5]/.test(str);
}

/* 引用原话时截短，避免把一整段复述回来 */
function clipQuote(text, max) {
  var t = String(text).replace(/\s+/g, ' ').trim();
  var n = max || 18;
  if (t.length > n) { t = t.slice(0, n) + '…'; }
  return t;
}

function stripPunct(text) {
  return String(text).replace(/[\s，。！？、,.!?~～…]/g, '');
}

/* 从一组模板里随机取一条，做出「不是每次同一句」的感觉 */
function pickOne(list) {
  return list[Math.floor(Math.random() * list.length)];
}

/* 兜底：不再用固定鸡汤，按输入形态分流，并引用对方刚说的话 */
function buildFallback(q, raw, lang) {
  var body = stripPunct(raw);
  var letterless = !/[a-zA-Z0-9\u4e00-\u9fa5]/.test(raw);   /* 只有表情或标点 */
  var isQuestion = /[?？]|吗|呢|什么|怎么|为什么|哪个|哪里|谁|能不能|可不可以|是不是|多少|多久|如何|要不要/i.test(raw) ||
                   /\b(what|why|how|when|where|who|which|can|could|should|do you|does|is it)\b/i.test(raw);
  var isShort = body.length <= 3;

  if (lang === 'zh') {
    if (letterless) {
      return pickOne(['我看到这个表情啦。今天的心情就是这一种，还是更复杂一点？',
                      '收到你的表情。要不要顺手在今天的格子里画一个一样的心情？']);
    }
    if (isShort) {
      return pickOne(['「' + q + '」——再多说两句吧，我想听清楚一点。',
                      '就这一个词呀？多讲一点，我才接得住。']);
    }
    if (isQuestion) {
      return pickOne(['「' + q + '」这个问题我先记下了。想明白的时候，就写在今天的格子里。',
                      '关于「' + q + '」，我也还在想。不如先把它写成一句话，放进今天的格子？']);
    }
    return pickOne(['「' + q + '」——我听到了。要不要把这件事放进今天的日计划？',
                    '「' + q + '」，记下了。要不要顺手写进今天那一格？',
                    '嗯，「' + q + '」。这件事对你来说重要吗？重要的话值得占一格。']);
  }

  if (letterless) {
    return pickOne(['I saw that face. Is that how today feels, or is it more complicated?',
                    'Got your emoji. Want to draw the same one in today\'s box?']);
  }
  if (isShort) {
    return pickOne(['"' + q + '" — tell me a bit more, I want to get it right.',
                    'Just that one word? Give me a little more and I can follow.']);
  }
  if (isQuestion) {
    return pickOne(['"' + q + '" is a good question. When you figure it out, write it in today\'s box.',
                    'I am still thinking about "' + q + '". Try writing it as one sentence in today\'s box.']);
  }
  return pickOne(['"' + q + '" — noted. Want to put that in today\'s plan?',
                  '"' + q + '", got it. Worth its own box today?',
                  'Hmm, "' + q + '". Does that matter a lot to you? If so it deserves a box.']);
}

function plannerUserName() {
  try { return (localStorage.getItem('planner-user-name') || '').trim(); } catch (e) { return ''; }
}

function pickReply(text) {
  /* v10 · 回复语言由右上角开关决定；输入中文或英文都能匹配同一批关键词 */
  var lang = petLangValue();

  for (var i = 0; i < RULES.length; i++) {
    var m = text.match(RULES[i].re);
    if (!m) { continue; }
    var pool = RULES[i].replies[lang];
    var reply = pickOne(pool);
    if (m[1]) { reply = reply.replace(/\{x\}/g, clipQuote(m[1], 14)); }
    var uname = plannerUserName();
    if (uname) {
      reply = reply.replace(/\{name\}/g, uname);
    } else {
      reply = reply.replace(/\{name\}/g, '')
                   .replace(/，\s*，/g, '，')
                   .replace(/,\s*,\s*/g, ', ')
                   .replace(/。\s*，/g, '。')
                   .replace(/[，,]\s*([。.！!？?…])/g, '$1')
                   .replace(/([。.！!？?…])\s*[，,]/g, '$1')
                   .replace(/\s+([,.!?;:])/g, '$1')
                   .replace(/，\s*(?=[。？！…])/g, '');
    }
    return reply;
  }

  return buildFallback(clipQuote(text, 18), text, lang);
}

petForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var text = (petInput.value || '').trim();
    if (!text) { return; }

    pushChat('user', text);
    petInput.value = '';

    setTimeout(function () {
      pushChat('pet', pickReply(text));
      pet.classList.add('is-happy');
      setTimeout(function () { pet.classList.remove('is-happy'); }, 520);
      if (bubble.classList.contains('is-open')) { placeBubble(); }
    }, 520);
  });

  /* ---- 5.7 心情联动：按今天的记录判断 ---- */
  function moodDateKey(d) {
    var m = d.getMonth() + 1;
    var day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day);
  }

  function refreshPetMood() {
    var todayKey = moodDateKey(new Date());
    var mine = load(K_EVENTS, []).filter(function (ev) { return ev.date === todayKey; });

    pet.classList.remove('is-idle', 'is-cheer', 'is-sad');

    if (!mine.length) {
      pet.classList.add('is-idle');
      return;
    }

    var joined = mine.map(function (ev) { return ev.text || ''; }).join(' ');
    var heavy = /(累|烦|难过|伤心|焦虑|压力|崩溃|哭|委屈|sad|tired|stress|anxious|upset|exhaust)/i.test(joined);
    var hasPhoto = mine.some(function (ev) { return !!ev.photo; });

    if (heavy) {
      pet.classList.add('is-sad');
    } else if (hasPhoto) {
      pet.classList.add('is-cheer');
    } else {
      pet.classList.add('is-idle');
    }
  }

  refreshPetMood();
  document.addEventListener('planner:daychange', refreshPetMood);
  setInterval(refreshPetMood, 90000);

})();


/* ---------- PPT 舞台等比缩放 ---------- */
(function () {
  var stage = document.getElementById('stage');
  if (!stage) { return; }

  var W = 1920;
  var H = 1080;

  function fit() {
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var scale = Math.min(vw / W, vh / H);
    var x = Math.round((vw - W * scale) / 2);
    var y = Math.round((vh - H * scale) / 2);
    stage.style.transform = 'translate(' + x + 'px, ' + y + 'px) scale(' + scale + ')';
  }

  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', fit);
  fit();
})();


/* ---------- 关于我：年度日历聚合 ---------- */
(function () {
  var yearCal = document.getElementById('yearCal');
  if (!yearCal) { return; }

  var YEAR = 2026;
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];
  var WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  var KEY = 'planner-events';

  var dateLabel = document.getElementById('journalDate');
  var list = document.getElementById('journalList');
  var stat = document.getElementById('journalStat');
  var selected = '';

  function pad2(n) { return String(n).length < 2 ? '0' + n : String(n); }

  function escapeText(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function readEvents() {
    try {
      var raw = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(raw) ? raw : [];
    } catch (e) { return []; }
  }

  function groupByDate() {
    var map = {};
    readEvents().forEach(function (ev) {
      if (!ev || !ev.date) { return; }
      if (!map[ev.date]) { map[ev.date] = []; }
      map[ev.date].push(ev);
    });
    return map;
  }

  var byDate = groupByDate();

  function markSelected() {
    Array.prototype.forEach.call(yearCal.querySelectorAll('.mini-day--sel'), function (el) {
      el.classList.remove('mini-day--sel');
    });
    if (!selected) { return; }
    var el = yearCal.querySelector('.mini-day[data-date="' + selected + '"]');
    if (el) { el.classList.add('mini-day--sel'); }
  }

  function showDay(key) {
    selected = key;
    markSelected();
    var evs = byDate[key] || [];
    var parts = key.split('-');
    dateLabel.textContent = MONTHS[Number(parts[1]) - 1] + ' ' + Number(parts[2]) + ', ' + YEAR;

    if (!evs.length) {
      list.innerHTML = '<p class="abt-empty">Nothing written for this day yet.<br />Open that box in the calendar and add a line.</p>';
    } else {
      list.innerHTML = evs.map(function (ev) {
        var photo = ev.photo
          ? '<img class="entry__photo" src="' + escapeText(ev.photo) + '" alt="Photo for this day" />'
          : '';
        return '<article class="entry"><p class="entry__text">' +
          escapeText(ev.text) + '</p>' + photo + '</article>';
      }).join('');
    }

    var total = Object.keys(byDate).length;
    stat.textContent = total + ' days written in ' + YEAR + ' · ' + evs.length + (evs.length === 1 ? ' entry' : ' entries') + ' on this day';
  }

  function render() {
    byDate = groupByDate();
    yearCal.innerHTML = '';

    for (var m = 0; m < 12; m++) {
      var box = document.createElement('div');
      box.className = 'mini-month';

      var name = document.createElement('p');
      name.className = 'mini-month__name';
      name.textContent = MONTHS[m];
      box.appendChild(name);

      var grid = document.createElement('div');
      grid.className = 'mini-month__grid';

      WEEK.forEach(function (w) {
        var head = document.createElement('span');
        head.className = 'mini-week';
        head.textContent = w;
        grid.appendChild(head);
      });

      var start = new Date(YEAR, m, 1).getDay();
      var days = new Date(YEAR, m + 1, 0).getDate();

      for (var b = 0; b < start; b++) {
        var blank = document.createElement('span');
        blank.className = 'mini-day mini-day--blank';
        grid.appendChild(blank);
      }

      for (var d = 1; d <= days; d++) {
        var key = YEAR + '-' + pad2(m + 1) + '-' + pad2(d);
        var cell = document.createElement('span');
        cell.className = 'mini-day' + (byDate[key] ? ' mini-day--has' : '');
        cell.textContent = d;
        cell.setAttribute('data-date', key);
        grid.appendChild(cell);
      }

      box.appendChild(grid);
      yearCal.appendChild(box);
    }

    markSelected();
  }

  yearCal.addEventListener('click', function (e) {
    var cell = e.target.closest ? e.target.closest('.mini-day--has') : null;
    if (cell && cell.getAttribute('data-date')) {
      showDay(cell.getAttribute('data-date'));
    }
  });

  render();

  var keys = Object.keys(byDate).sort();
  if (keys.length) { showDay(keys[keys.length - 1]); }
})();


/* ---------- 封面：年计划可编辑 To-Do（localStorage） ---------- */
(function () {
  var listEl = document.getElementById('coverTodoList');
  var formEl = document.getElementById('coverTodoForm');
  var inputEl = document.getElementById('coverTodoInput');
  if (!listEl || !formEl || !inputEl) { return; }

  var KEY = 'planner-cover-todo';
  var DEFAULTS = [
    { text: 'Meetings', done: false },
    { text: "Student's tasks", done: false },
    { text: 'Class schedules', done: false },
    { text: 'Reminders', done: false },
    { text: 'Announcements', done: false },
    { text: 'Special occasions', done: false },
    { text: 'Notes', done: false }
  ];

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      var data = raw ? JSON.parse(raw) : null;
      if (Array.isArray(data)) { return data; }
    } catch (e) {}
    return DEFAULTS.slice();
  }

  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) {}
  }

  var items = load();

  function render() {
    listEl.innerHTML = '';
    items.forEach(function (item, i) {
      var li = document.createElement('li');
      li.className = 'cover-todo__item' + (item.done ? ' is-done' : '');

      var box = document.createElement('input');
      box.type = 'checkbox';
      box.className = 'cover-todo__check';
      box.checked = !!item.done;
      box.addEventListener('change', function () {
        items[i].done = box.checked;
        li.classList.toggle('is-done', box.checked);
        persist();
      });

      var txt = document.createElement('span');
      txt.className = 'cover-todo__text';
      txt.textContent = item.text;
      txt.title = item.text;

      var del = document.createElement('button');
      del.type = 'button';
      del.className = 'cover-todo__del';
      del.textContent = '×';
      del.setAttribute('aria-label', 'Delete this plan');
      del.addEventListener('click', function () {
        items.splice(i, 1);
        persist();
        render();
      });

      li.appendChild(box);
      li.appendChild(txt);
      li.appendChild(del);
      listEl.appendChild(li);
    });
  }

  formEl.addEventListener('submit', function (e) {
    e.preventDefault();
    e.stopPropagation();
    var val = inputEl.value.trim();
    if (!val) { return; }
    items.push({ text: val, done: false });
    inputEl.value = '';
    persist();
    render();
  });

  // 阻止点击/按键冒泡到封面跳页层
  ['click', 'pointerdown', 'pointerup'].forEach(function (ev) {
    listEl.addEventListener(ev, function (e) { e.stopPropagation(); });
    formEl.addEventListener(ev, function (e) { e.stopPropagation(); });
  });

  render();
})();

/* ==========================================================================
   v2 · 设置面板（换桌宠形象 / 聊天气泡颜色）
   ========================================================================== */
(function () {
  var K_IMG = 'planner-pet-img';
  var K_BUB = 'planner-bubble-color';
  var DEFAULT_BUBBLE = '#95ec69';
  var SWATCHES = ['#95ec69', '#ffffff', '#ffd8de', '#d9e2ff', '#ffeaa8', '#c9f0e2'];

  /* 先把存过的气泡色应用到页面（不需要打开面板也生效） */
  var savedBubble = localStorage.getItem(K_BUB) || DEFAULT_BUBBLE;

  /* 同一个颜色同时喂给两侧：我这侧用原色，桌宠那侧调浅，看得出谁在说 */
  function mixWhite(hex, ratio) {
    var h = String(hex).replace('#', '');
    if (h.length === 3) {
      h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
    }
    var r = parseInt(h.substr(0, 2), 16);
    var g = parseInt(h.substr(2, 2), 16);
    var b = parseInt(h.substr(4, 2), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) { return '#ffffff'; }
    function mix(c) { return Math.round(c + (255 - c) * ratio); }
    function two(v) { var s = v.toString(16); return s.length < 2 ? '0' + s : s; }
    return '#' + two(mix(r)) + two(mix(g)) + two(mix(b));
  }

  function applyBubble(hex) {
    document.documentElement.style.setProperty('--bubble-user', hex);
    document.documentElement.style.setProperty('--bubble-pet', mixWhite(hex, 0.62));
    document.documentElement.style.setProperty('--bubble-pet-edge', mixWhite(hex, 0.4));
  }

  applyBubble(savedBubble);

  var trigger = document.getElementById('openSettings');
  if (!trigger) { return; }

  var panel = document.createElement('div');
  panel.className = 'settings';
  panel.id = 'settingsPanel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'settingsTitle');
  panel.innerHTML =
    '<div class="settings__panel">' +
    '  <div class="settings__head">' +
    '    <h3 class="settings__title" id="settingsTitle">Settings</h3>' +
    '    <button class="settings__close" id="settingsClose" type="button" aria-label="Close">\u00d7</button>' +
    '  </div>' +
    '  <div class="settings__row">' +
    '    <span class="settings__label">little friend</span>' +
    '    <p class="settings__desc">Swap the picture of the pet living in this planner.</p>' +
    '    <button class="settings__btn" id="setPetBtn" type="button">Change pet image</button>' +
    '    <input class="settings__file" id="setPetFile" type="file" accept="image/*" />' +
    '  </div>' +
    '  <div class="settings__row">' +
    '    <span class="settings__label">bubble colour</span>' +
    '    <p class="settings__desc">Your own messages take this colour. The pet keeps the quiet grey.</p>' +
    '    <div class="settings__swatches" id="setSwatches"></div>' +
    '    <button class="settings__reset" id="setBubbleReset" type="button">Reset to default</button>' +
    '  </div>' +
    '  <div class="settings__row">' +
    '    <span class="settings__label">your name</span>' +
    '    <p class="settings__desc">The little friend calls you by this name.</p>' +
    '    <input class="settings__input" id="setUserName" type="text" maxlength="20" autocomplete="off" />' +
    '  </div>' +
    '</div>';
  document.body.appendChild(panel);

  var swatchBox = panel.querySelector('#setSwatches');
  var petBtn = panel.querySelector('#setPetBtn');
  var petFile = panel.querySelector('#setPetFile');
  var resetBtn = panel.querySelector('#setBubbleReset');

  function paintSwatches(active) {
    Array.prototype.forEach.call(swatchBox.children, function (el) {
      el.classList.toggle('is-active', el.getAttribute('data-color') === active);
    });
  }

  SWATCHES.forEach(function (hex) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'settings__swatch';
    b.setAttribute('data-color', hex);
    b.setAttribute('aria-label', 'Bubble ' + hex);
    b.style.background = hex;
    b.addEventListener('click', function () {
      localStorage.setItem(K_BUB, hex);
      applyBubble(hex);
      paintSwatches(hex);
    });
    swatchBox.appendChild(b);
  });
  paintSwatches(savedBubble);

  resetBtn.addEventListener('click', function () {
    localStorage.removeItem(K_BUB);
    applyBubble(DEFAULT_BUBBLE);
    paintSwatches(DEFAULT_BUBBLE);
  });

  /* v8 · 昵称：桌宠用它称呼你 */
  var nameInput = panel.querySelector('#setUserName');
  if (nameInput) {
    nameInput.value = localStorage.getItem('planner-user-name') || '';
    var saveName = function () {
      var v = (nameInput.value || '').trim().slice(0, 20);
      if (v) { localStorage.setItem('planner-user-name', v); }
      else { localStorage.removeItem('planner-user-name'); }
      nameInput.value = v;
    };
    nameInput.addEventListener('change', saveName);
    nameInput.addEventListener('blur', saveName);
    nameInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { saveName(); nameInput.blur(); }
    });
  }

  petBtn.addEventListener('click', function () { petFile.click(); });

  petFile.addEventListener('change', function () {
    var file = petFile.files && petFile.files[0];
    if (!file) { return; }
    if (file.size > 6 * 1024 * 1024) {
      alert('That image is too large. Please pick an image under 6MB.');
      petFile.value = '';
      return;
    }
    var strip = window.stripPetBg;
    var useRaw = function (cb) {
      var fr = new FileReader();
      fr.onload = function (ev) { cb(ev.target.result); };
      fr.readAsDataURL(file);
    };
    var run = strip ? strip : function (f, cb) { useRaw(cb); };
    run(file, function (dataUrl) {
      try {
        localStorage.setItem(K_IMG, dataUrl);
      } catch (err) {
        alert('This image is too large to store in the browser. Try a smaller one.');
        return;
      }
      var live = document.getElementById('petImg');
      if (live) { live.src = dataUrl; }
      var petEl = document.getElementById('pet');
      if (petEl) {
        petEl.classList.add('is-happy');
        setTimeout(function () { petEl.classList.remove('is-happy'); }, 520);
      }
    });
    petFile.value = '';
  });

  function openPanel() {
    panel.classList.add('is-open');
    paintSwatches(localStorage.getItem(K_BUB) || DEFAULT_BUBBLE);
  }
  function closePanel() { panel.classList.remove('is-open'); }

  trigger.addEventListener('click', function (e) {
    e.preventDefault();
    openPanel();
  });
  panel.querySelector('#settingsClose').addEventListener('click', closePanel);
  panel.addEventListener('click', function (e) {
    if (e.target === panel) { closePanel(); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && panel.classList.contains('is-open')) { closePanel(); }
  });
})();


/* ==========================================================================
   v2 · 封面翻页：点金属扣先翻开再进内页
   ========================================================================== */
(function () {
  var clasp = document.querySelector('.cover-clasp');
  var turn = document.getElementById('coverTurn');
  if (!clasp || !turn) { return; }

  var book = document.querySelector('.cover-book');
  var going = false;

  clasp.addEventListener('click', function (e) {
    e.preventDefault();
    if (going) { return; }
    going = true;

    turn.classList.add('is-playing');
    if (book) { book.classList.add('is-turning'); }

    setTimeout(function () {
      window.location.href = clasp.getAttribute('href');
    }, 620);
  });
})();

/* ==========================================================================
   v8 · 开场流程：起名 → 欢迎文字 → 钥匙开锁（仅封面页）
   ========================================================================== */
(function () {
  var K_NAME = 'planner-user-name';
  var K_ENTERED = 'planner-entered';

  var intro = document.getElementById('coverIntro');
  if (!intro) { return; }

  var key = document.getElementById('coverKey');
  var skip = document.getElementById('introSkip');
  var stepName = document.getElementById('introName');
  var stepText = document.getElementById('introText');
  var input = document.getElementById('introNameInput');
  var goBtn = document.getElementById('introNameGo');
  var chars = document.getElementById('introChars');
  var caret = document.getElementById('introCaret');
  var clasp = document.querySelector('.cover-clasp');

  var COPY = 'Welcome to your journal world.\n' +
             'Put your feelings, thoughts and plans of every day into your own little archive.\n\n' +
             'Tap anywhere on the screen';

  var userName = '';
  try { userName = (localStorage.getItem(K_NAME) || '').trim(); } catch (e) {}
  var entered = false;
  try { entered = localStorage.getItem(K_ENTERED) === '1'; } catch (e) {}
  var typing = null;

  function revealKey() {
    if (!key) { return; }
    key.classList.add('is-here');
  }

  function hideIntro(then) {
    intro.classList.add('is-out');
    setTimeout(function () {
      intro.hidden = true;
      if (then) { then(); }
    }, 520);
  }

  function finishIntro() {
    try { localStorage.setItem(K_ENTERED, '1'); } catch (e) {}
    if (typing) { clearInterval(typing); typing = null; }
    hideIntro(revealKey);
  }

  function startTyping() {
    stepName.hidden = true;
    stepText.hidden = false;
    skip.hidden = false;
    chars.textContent = '';
    var i = 0;
    typing = setInterval(function () {
      i += 1;
      chars.textContent = COPY.slice(0, i);
      if (i >= COPY.length) {
        clearInterval(typing);
        typing = null;
        if (caret) { caret.classList.add('is-done'); }
      }
    }, 24);
  }

  function takeName() {
    var v = (input.value || '').trim().slice(0, 20);
    if (!v) { input.focus(); return; }
    try { localStorage.setItem(K_NAME, v); } catch (e) {}
    userName = v;
    startTyping();
  }

  if (goBtn) {
    goBtn.addEventListener('click', function (e) {
      e.stopPropagation();      /* 别让确认点击冒泡成全屏“点任意处” */
      takeName();
    });
  }
  if (input) {
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); takeName(); }
    });
  }

  if (skip) {
    skip.addEventListener('click', function (e) {
      e.stopPropagation();
      finishIntro();
    });
  }

  intro.addEventListener('click', function (e) {
    if (stepText.hidden) { return; }        /* 起名阶段点击不跳过 */
    if (e.target === skip) { return; }
    finishIntro();
  });

  /* 钥匙：先飞向锁孔，扭一下，再触发原有翻页 */
  if (key) {
    key.addEventListener('click', function (e) {
      e.preventDefault();
      if (key.classList.contains('is-moving') || key.classList.contains('is-twisting')) { return; }
      if (!clasp) { window.location.href = 'months.html'; return; }

      var kr = key.getBoundingClientRect();
      var cr = clasp.getBoundingClientRect();
      var dx = Math.round((cr.left + cr.width / 2) - (kr.left + kr.width / 2));
      var dy = Math.round((cr.top + cr.height / 2) - (kr.top + kr.height / 2));
      key.style.setProperty('--kdx', dx + 'px');
      key.style.setProperty('--kdy', dy + 'px');

      key.classList.add('is-moving');
      setTimeout(function () { key.classList.add('is-twisting'); }, 620);
      setTimeout(function () { clasp.click(); }, 960);
    });
  }

  /* 启动：老用户直接进封面并显示钥匙 */
  if (entered && userName) {
    intro.hidden = true;
    revealKey();
  } else {
    intro.hidden = false;
    if (userName && input) { input.value = userName; }
    setTimeout(function () { if (input) { input.focus(); } }, 200);
  }
})();
