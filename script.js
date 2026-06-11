/* ===== Premium To-Do App — Vanilla JS ===== */
(() => {
  'use strict';
  // ---------- State ----------
  const LS_KEY = 'premium-todo-state-v1';
  const defaultCategories = [
    { id: 'work', name: 'Work', color: '#6DDCCF' },
    { id: 'study', name: 'Study', color: '#CDB4DB' },
    { id: 'personal', name: 'Personal', color: '#A8E6CF' },
    { id: 'shopping', name: 'Shopping', color: '#FFD6A5' },
    { id: 'health', name: 'Health', color: '#7BC7A4' },
  ];
  let state = {
    tasks: [],
    categories: defaultCategories,
    theme: 'light',
    filters: { category: 'all', status: 'all', priority: 'all', sort: 'due', search: '' },
    view: 'all',
    selectedDate: null,
    streak: 0,
    lastCompletionDate: null,
    dailyGoal: 5,
    calMonth: new Date().getMonth(),
    calYear: new Date().getFullYear(),
  };
  const load = () => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) state = { ...state, ...JSON.parse(raw) };
    } catch (e) { console.warn('LS load failed', e); }
  };
  const save = () => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); }
    catch (e) { console.warn('LS save failed', e); }
  };
  const uid = () => Math.random().toString(36).slice(2, 10);
  // ---------- DOM helpers ----------
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const el = (tag, attrs = {}, ...children) => {
    const n = document.createElement(tag);
    for (const k in attrs) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    }
    for (const c of children) {
      if (c == null) continue;
      n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return n;
  };
  // ---------- Greeting ----------
  const greet = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  };
  // ---------- Filters ----------
  const filteredTasks = () => {
    let t = [...state.tasks];
    const f = state.filters;
    const v = state.view;
    const today = new Date(); today.setHours(0,0,0,0);
    if (v === 'today') {
      t = t.filter(x => {
        if (!x.dueDate) return false;
        const d = new Date(x.dueDate); d.setHours(0,0,0,0);
        return d.getTime() === today.getTime();
      });
    } else if (v === 'upcoming') {
      t = t.filter(x => x.dueDate && new Date(x.dueDate) >= today && !x.completed);
    } else if (v === 'overdue') {
      t = t.filter(x => x.dueDate && new Date(x.dueDate + 'T' + (x.dueTime || '23:59')) < new Date() && !x.completed);
    } else if (v === 'completed') {
      t = t.filter(x => x.completed);
    } else if (v.startsWith('cat:')) {
      t = t.filter(x => x.category === v.slice(4));
    }
    if (f.category !== 'all') t = t.filter(x => x.category === f.category);
    if (f.status !== 'all') {
      if (f.status === 'completed') t = t.filter(x => x.completed);
      else t = t.filter(x => !x.completed && x.status === f.status);
    }
    if (f.priority !== 'all') t = t.filter(x => x.priority === f.priority);
    if (f.search) {
      const q = f.search.toLowerCase();
      t = t.filter(x => x.title.toLowerCase().includes(q) || (x.description || '').toLowerCase().includes(q));
    }
    const prioRank = { high: 0, medium: 1, low: 2 };
    if (f.sort === 'due') t.sort((a,b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
    else if (f.sort === 'priority') t.sort((a,b) => prioRank[a.priority] - prioRank[b.priority]);
    else if (f.sort === 'created') t.sort((a,b) => b.createdAt - a.createdAt);
    else if (f.sort === 'alpha') t.sort((a,b) => a.title.localeCompare(b.title));
    return t;
  };
  // ---------- Stats ----------
  const stats = () => {
    const total = state.tasks.length;
    const done = state.tasks.filter(t => t.completed).length;
    const now = new Date();
    const overdue = state.tasks.filter(t => !t.completed && t.dueDate && new Date(t.dueDate + 'T' + (t.dueTime || '23:59')) < now).length;
    const pending = total - done;
    const pct = total ? Math.round((done / total) * 100) : 0;
    return { total, done, pending, overdue, pct };
  };
  // ---------- Render ----------
  const renderSidebar = () => {
    const counts = {
      all: state.tasks.length,
      today: state.tasks.filter(t => t.dueDate === todayISO() && !t.completed).length,
      upcoming: state.tasks.filter(t => t.dueDate && t.dueDate > todayISO() && !t.completed).length,
      overdue: stats().overdue,
      completed: stats().done,
    };
    const navHTML = `
      <div class="nav-section">
        <div class="nav-label">Workspace</div>
        ${navItem('all', '📋', 'All Tasks', counts.all)}
        ${navItem('today', '🌤️', 'Today', counts.today)}
        ${navItem('upcoming', '📅', 'Upcoming', counts.upcoming)}
        ${navItem('overdue', '⏰', 'Overdue', counts.overdue)}
        ${navItem('completed', '✓', 'Completed', counts.completed)}
      </div>
      <div class="nav-section">
        <div class="nav-label">Categories</div>
        ${state.categories.map(c => `
          <button class="nav-item ${state.view === 'cat:' + c.id ? 'active' : ''}" data-view="cat:${c.id}">
            <span class="cat-row" style="flex:1;display:flex;align-items:center;gap:8px;">
              <span class="cat-dot" style="background:${c.color}"></span>
              <span>${escapeHTML(c.name)}</span>
              <span class="cat-del" data-del-cat="${c.id}" title="Delete">×</span>
            </span>
          </button>
        `).join('')}
        <div class="add-cat">
          <input id="newCatInput" placeholder="New category..." maxlength="20"/>
          <button id="addCatBtn">+</button>
        </div>
      </div>
    `;
    $('#nav').innerHTML = navHTML;
    $$('#nav .nav-item').forEach(n => {
      n.addEventListener('click', (e) => {
        if (e.target.dataset.delCat) return;
        state.view = n.dataset.view;
        save(); render();
        if (window.innerWidth <= 720) $('#sidebar').classList.remove('open');
      });
    });
    $$('#nav [data-del-cat]').forEach(b => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = b.dataset.delCat;
        if (confirm('Delete this category? Tasks will remain but become uncategorized.')) {
          state.categories = state.categories.filter(c => c.id !== id);
          state.tasks.forEach(t => { if (t.category === id) t.category = ''; });
          if (state.view === 'cat:' + id) state.view = 'all';
          save(); render();
        }
      });
    });
    $('#addCatBtn').addEventListener('click', addCategory);
    $('#newCatInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') addCategory(); });
  };
  const navItem = (view, icon, label, count) => `
    <button class="nav-item ${state.view === view ? 'active' : ''}" data-view="${view}">
      <span>${icon}</span><span>${label}</span><span class="count">${count}</span>
    </button>
  `;
  const addCategory = () => {
    const input = $('#newCatInput');
    const name = input.value.trim();
    if (!name) return;
    const palette = ['#A8E6CF','#6DDCCF','#7BC7A4','#CDB4DB','#FFD6A5','#FFB5A7','#B4D8FF','#FFE5B4'];
    const color = palette[state.categories.length % palette.length];
    state.categories.push({ id: uid(), name, color });
    input.value = '';
    save(); render();
  };
  const renderStats = () => {
    const s = stats();
    const cards = [
      { icon: '📋', label: 'Total Tasks', value: s.total, grad: 'linear-gradient(135deg,#A8E6CF,transparent)' },
      { icon: '✅', label: 'Completed', value: s.done, grad: 'linear-gradient(135deg,#7BC7A4,transparent)' },
      { icon: '🕐', label: 'Pending', value: s.pending, grad: 'linear-gradient(135deg,#FFD6A5,transparent)' },
      { icon: '⚠️', label: 'Overdue', value: s.overdue, grad: 'linear-gradient(135deg,#FFB5A7,transparent)' },
      { icon: '📈', label: 'Completion', value: s.pct + '%', grad: 'linear-gradient(135deg,#CDB4DB,transparent)' },
    ];
    $('#stats').innerHTML = cards.map((c, i) => `
      <div class="stat-card" style="--accent-grad:${c.grad}; animation-delay:${i * 60}ms">
        <div class="stat-icon">${c.icon}</div>
        <div class="stat-label">${c.label}</div>
        <div class="stat-value">${c.value}</div>
      </div>
    `).join('');
  };
  const renderTasks = () => {
    const tasks = filteredTasks();
    const wrap = $('#taskList');
    wrap.innerHTML = '';
    if (!tasks.length) {
      wrap.appendChild(el('div', { class: 'empty' },
        el('span', { class: 'empty-emoji' }, '🌱'),
        el('div', {}, 'No tasks here yet. Add one to get started!')
      ));
      return;
    }
    tasks.forEach(t => wrap.appendChild(renderTask(t)));
    initDragDrop();
  };
  const renderTask = (t) => {
    const cat = state.categories.find(c => c.id === t.category);
    const now = new Date();
    const dueStr = t.dueDate ? (t.dueDate + (t.dueTime ? ' • ' + t.dueTime : '')) : null;
    const isOverdue = !t.completed && t.dueDate && new Date(t.dueDate + 'T' + (t.dueTime || '23:59')) < now;
    const node = el('div', {
      class: 'task' + (t.completed ? ' completed' : ''),
      draggable: 'true',
      'data-id': t.id,
    });
    const check = el('button', { class: 'check', title: 'Toggle complete' }, t.completed ? '✓' : '');
    check.addEventListener('click', () => toggleTask(t.id, node));
    node.appendChild(check);
    const body = el('div', { class: 'task-body' });
    body.appendChild(el('div', { class: 'task-title' }, t.title));
    if (t.description) body.appendChild(el('div', { class: 'task-desc' }, t.description));
    const meta = el('div', { class: 'task-meta' });
    if (cat) {
      const chip = el('span', { class: 'chip' });
      chip.innerHTML = `<span class="cat-dot" style="background:${cat.color}"></span>${escapeHTML(cat.name)}`;
      meta.appendChild(chip);
    }
    meta.appendChild(el('span', { class: 'chip prio-' + t.priority }, t.priority[0].toUpperCase() + t.priority.slice(1)));
    if (dueStr) meta.appendChild(el('span', { class: 'chip' + (isOverdue ? ' overdue' : '') }, '📅 ' + dueStr));
    if (t.status && t.status !== 'not-started' && !t.completed) {
      meta.appendChild(el('span', { class: 'chip' }, t.status === 'in-progress' ? '⚡ In Progress' : t.status));
    }
    body.appendChild(meta);
    node.appendChild(body);
    const actions = el('div', { class: 'task-actions' });
    actions.appendChild(el('button', { title: 'Edit', onclick: () => openTaskModal(t) }, '✏️'));
    actions.appendChild(el('button', { title: 'Duplicate', onclick: () => duplicateTask(t.id) }, '📋'));
    actions.appendChild(el('button', { title: 'Delete', onclick: () => deleteTask(t.id) }, '🗑️'));
    node.appendChild(actions);
    return node;
  };
  const renderProgress = () => {
    const s = stats();
    const R = 70;
    const C = 2 * Math.PI * R;
    const off = C - (C * s.pct) / 100;
    $('#progressPanel').innerHTML = `
      <div class="panel-head"><h3>Progress</h3></div>
      <div class="ring-wrap">
        <div class="ring">
          <svg width="160" height="160">
            <defs>
              <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#7BC7A4"/>
                <stop offset="100%" stop-color="#CDB4DB"/>
              </linearGradient>
            </defs>
            <circle class="bg-c" cx="80" cy="80" r="${R}"/>
            <circle class="fg-c" cx="80" cy="80" r="${R}"
              stroke-dasharray="${C}" stroke-dashoffset="${off}"/>
          </svg>
          <div class="ring-label">
            <div>
              <div class="ring-pct">${s.pct}%</div>
              <div class="ring-sub">${s.done} of ${s.total}</div>
            </div>
          </div>
        </div>
      </div>
      <div class="progress-row">
        <div class="label"><span>Daily Goal</span><span>${Math.min(s.done, state.dailyGoal)} / ${state.dailyGoal}</span></div>
        <div class="bar"><div style="width:${Math.min(100, (s.done / state.dailyGoal) * 100)}%"></div></div>
      </div>
      <div class="mini-stats">
        <div class="mini-stat"><div class="v">🔥 ${state.streak}</div><div class="l">Day Streak</div></div>
        <div class="mini-stat"><div class="v">${weeklyDone()}</div><div class="l">This Week</div></div>
      </div>
      <div class="panel-head" style="margin-top:22px"><h3>Pomodoro</h3></div>
      <div class="pomo">
        <div class="pomo-time" id="pomoTime">25:00</div>
        <div class="pomo-mode" id="pomoMode">Focus session</div>
        <div class="pomo-btns">
          <button class="primary" id="pomoToggle">Start</button>
          <button id="pomoReset">Reset</button>
          <button id="focusBtn">Focus Mode</button>
        </div>
      </div>
    `;
    $('#pomoToggle').addEventListener('click', togglePomo);
    $('#pomoReset').addEventListener('click', resetPomo);
    $('#focusBtn').addEventListener('click', () => $('#focusOverlay').classList.add('open'));
  };
  const weeklyDone = () => {
    const wk = new Date(); wk.setDate(wk.getDate() - 7);
    return state.tasks.filter(t => t.completed && t.completedAt && new Date(t.completedAt) >= wk).length;
  };
  // ---------- Calendar ----------
  const renderCalendar = () => {
    const m = state.calMonth, y = state.calYear;
    const monthName = new Date(y, m, 1).toLocaleString(undefined, { month: 'long', year: 'numeric' });
    const first = new Date(y, m, 1).getDay();
    const days = new Date(y, m + 1, 0).getDate();
    const prevDays = new Date(y, m, 0).getDate();
    const tasksByDate = {};
    state.tasks.forEach(t => { if (t.dueDate) (tasksByDate[t.dueDate] = tasksByDate[t.dueDate] || []).push(t); });
    const today = todayISO();
    let html = `
      <div class="cal-head-bar">
        <h4>${monthName}</h4>
        <div class="cal-nav">
          <button id="calPrev">‹</button>
          <button id="calNext">›</button>
        </div>
      </div>
      <div class="cal-grid">
        ${['S','M','T','W','T','F','S'].map(d => `<div class="cal-head">${d}</div>`).join('')}
    `;
    for (let i = 0; i < first; i++) {
      html += `<div class="cal-cell muted">${prevDays - first + i + 1}</div>`;
    }
    for (let d = 1; d <= days; d++) {
      const iso = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const classes = ['cal-cell'];
      if (iso === today) classes.push('today');
      if (tasksByDate[iso]) classes.push('has-tasks');
      if (state.selectedDate === iso) classes.push('selected');
      html += `<div class="${classes.join(' ')}" data-date="${iso}">${d}</div>`;
    }
    html += `</div>`;
    if (state.selectedDate && tasksByDate[state.selectedDate]) {
      html += `<div style="margin-top:14px;font-size:13px;color:var(--text-soft);">
        <strong>${state.selectedDate}</strong> — ${tasksByDate[state.selectedDate].length} task(s)
        <ul style="margin-top:6px;padding-left:18px;">
          ${tasksByDate[state.selectedDate].map(t => `<li>${escapeHTML(t.title)}</li>`).join('')}
        </ul>
      </div>`;
    }
    $('#calendarPanel').innerHTML = `<div class="panel-head"><h3>Calendar</h3></div>` + html;
    $('#calPrev').addEventListener('click', () => {
      state.calMonth--; if (state.calMonth < 0) { state.calMonth = 11; state.calYear--; }
      renderCalendar();
    });
    $('#calNext').addEventListener('click', () => {
      state.calMonth++; if (state.calMonth > 11) { state.calMonth = 0; state.calYear++; }
      renderCalendar();
    });
    $$('#calendarPanel .cal-cell[data-date]').forEach(c => {
      c.addEventListener('click', () => {
        state.selectedDate = state.selectedDate === c.dataset.date ? null : c.dataset.date;
        renderCalendar();
      });
    });
  };
  const renderGreeting = () => {
    const s = stats();
    $('#greeting').innerHTML = `
      <h2>${greet()} 👋</h2>
      <p>You have <strong>${s.pending}</strong> pending task${s.pending === 1 ? '' : 's'}${s.overdue ? `, <strong style="color:#c43f3c">${s.overdue} overdue</strong>` : ''}.</p>
    `;
  };
  const render = () => {
    renderSidebar();
    renderGreeting();
    renderStats();
    renderTasks();
    renderProgress();
    renderCalendar();
    populateCategoryFilter();
  };
  const populateCategoryFilter = () => {
    const sel = $('#filterCategory');
    if (!sel) return;
    const cur = sel.value || 'all';
    sel.innerHTML = `<option value="all">All categories</option>` +
      state.categories.map(c => `<option value="${c.id}">${escapeHTML(c.name)}</option>`).join('');
    sel.value = cur;
  };
  // ---------- Task CRUD ----------
  const toggleTask = (id, node) => {
    const t = state.tasks.find(x => x.id === id);
    if (!t) return;
    t.completed = !t.completed;
    t.status = t.completed ? 'completed' : 'not-started';
    if (t.completed) {
      t.completedAt = Date.now();
      updateStreak();
      if (node) {
        node.classList.add('just-completed');
        setTimeout(() => node.classList.remove('just-completed'), 500);
      }
      const all = state.tasks;
      if (all.length && all.every(x => x.completed)) {
        confetti();
        toast('🎉 All tasks completed! Amazing work!');
      }
    } else {
      t.completedAt = null;
    }
    save(); render();
  };
  const deleteTask = (id) => {
    if (!confirm('Delete this task?')) return;
    state.tasks = state.tasks.filter(t => t.id !== id);
    save(); render();
    toast('🗑️ Task deleted');
  };
  const duplicateTask = (id) => {
    const t = state.tasks.find(x => x.id === id);
    if (!t) return;
    state.tasks.unshift({ ...t, id: uid(), title: t.title + ' (copy)', completed: false, completedAt: null, status: 'not-started', createdAt: Date.now() });
    save(); render();
    toast('📋 Task duplicated');
  };
  const updateStreak = () => {
    const today = todayISO();
    const last = state.lastCompletionDate;
    if (last === today) return;
    const yest = new Date(); yest.setDate(yest.getDate() - 1);
    const yestISO = yest.toISOString().slice(0,10);
    state.streak = last === yestISO ? state.streak + 1 : 1;
    state.lastCompletionDate = today;
  };
  // ---------- Modal ----------
  let editingId = null;
  const openTaskModal = (task = null) => {
    editingId = task ? task.id : null;
    $('#modalTitle').textContent = task ? 'Edit Task' : 'New Task';
    $('#mTitle').value = task?.title || '';
    $('#mDesc').value = task?.description || '';
    $('#mCategory').innerHTML = `<option value="">None</option>` +
      state.categories.map(c => `<option value="${c.id}" ${task?.category === c.id ? 'selected' : ''}>${escapeHTML(c.name)}</option>`).join('');
    $('#mPriority').value = task?.priority || 'medium';
    $('#mStatus').value = task?.status || 'not-started';
    $('#mDate').value = task?.dueDate || '';
    $('#mTime').value = task?.dueTime || '';
    $('#taskModal').classList.add('open');
    setTimeout(() => $('#mTitle').focus(), 50);
  };
  const closeModal = () => { $('#taskModal').classList.remove('open'); editingId = null; };
  const saveTask = () => {
    const title = $('#mTitle').value.trim();
    if (!title) { $('#mTitle').focus(); return; }
    const payload = {
      title,
      description: $('#mDesc').value.trim(),
      category: $('#mCategory').value,
      priority: $('#mPriority').value,
      status: $('#mStatus').value,
      dueDate: $('#mDate').value || null,
      dueTime: $('#mTime').value || null,
    };
    if (editingId) {
      const t = state.tasks.find(x => x.id === editingId);
      Object.assign(t, payload);
    } else {
      state.tasks.unshift({
        id: uid(), ...payload,
        completed: payload.status === 'completed',
        completedAt: payload.status === 'completed' ? Date.now() : null,
        createdAt: Date.now(),
      });
    }
    save(); closeModal(); render();
    toast(editingId ? '✓ Task updated' : '✨ Task added');
  };
  // ---------- Drag & Drop ----------
  let dragId = null;
  const initDragDrop = () => {
    $$('#taskList .task').forEach(node => {
      node.addEventListener('dragstart', (e) => {
        dragId = node.dataset.id;
        node.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      node.addEventListener('dragend', () => {
        node.classList.remove('dragging');
        dragId = null;
      });
      node.addEventListener('dragover', (e) => {
        e.preventDefault();
        const dragging = $('.task.dragging');
        if (!dragging || dragging === node) return;
        const rect = node.getBoundingClientRect();
        const after = (e.clientY - rect.top) > rect.height / 2;
        node.parentNode.insertBefore(dragging, after ? node.nextSibling : node);
      });
      node.addEventListener('drop', (e) => {
        e.preventDefault();
        const order = $$('#taskList .task').map(n => n.dataset.id);
        state.tasks.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
        save();
      });
    });
  };
  // ---------- Pomodoro ----------
  let pomo = { running: false, secs: 25 * 60, mode: 'focus', interval: null };
  const fmtTime = (s) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  const updatePomoUI = () => {
    const t = $('#pomoTime'); if (t) t.textContent = fmtTime(pomo.secs);
    const t2 = $('#focusTime'); if (t2) t2.textContent = fmtTime(pomo.secs);
    const m = $('#pomoMode'); if (m) m.textContent = pomo.mode === 'focus' ? 'Focus session' : 'Break time';
    const b = $('#pomoToggle'); if (b) b.textContent = pomo.running ? 'Pause' : 'Start';
  };
  const togglePomo = () => {
    pomo.running = !pomo.running;
    if (pomo.running) {
      pomo.interval = setInterval(() => {
        pomo.secs--;
        if (pomo.secs <= 0) {
          clearInterval(pomo.interval);
          pomo.running = false;
          notify(pomo.mode === 'focus' ? '🎯 Focus session complete!' : '☕ Break over!');
          pomo.mode = pomo.mode === 'focus' ? 'break' : 'focus';
          pomo.secs = pomo.mode === 'focus' ? 25 * 60 : 5 * 60;
        }
        updatePomoUI();
      }, 1000);
    } else {
      clearInterval(pomo.interval);
    }
    updatePomoUI();
  };
  const resetPomo = () => {
    clearInterval(pomo.interval);
    pomo = { running: false, secs: 25 * 60, mode: 'focus', interval: null };
    updatePomoUI();
  };
  // ---------- Theme ----------
  const applyTheme = () => {
    document.documentElement.classList.toggle('dark', state.theme === 'dark');
    const btn = $('#themeBtn'); if (btn) btn.textContent = state.theme === 'dark' ? '☀️' : '🌙';
  };
  const toggleTheme = () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    save(); applyTheme();
  };
  // ---------- Export / Import ----------
  const exportData = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `tasks-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('📤 Tasks exported');
  };
  const importData = (file) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.tasks) state.tasks = data.tasks;
        if (data.categories) state.categories = data.categories;
        save(); render();
        toast('📥 Tasks imported');
      } catch (err) { toast('❌ Invalid file'); }
    };
    reader.readAsText(file);
  };
  // ---------- Notifications & Reminders ----------
  const notify = (msg) => {
    toast(msg);
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Premium To-Do', { body: msg });
    }
  };
  const checkReminders = () => {
    const now = new Date();
    state.tasks.forEach(t => {
      if (t.completed || t._notified) return;
      if (!t.dueDate) return;
      const due = new Date(t.dueDate + 'T' + (t.dueTime || '09:00'));
      const diff = (due - now) / 60000;
      if (diff > 0 && diff < 15) {
        notify(`⏰ "${t.title}" due in ${Math.round(diff)} min`);
        t._notified = true;
      } else if (diff < 0 && diff > -5 && !t._overdueNotified) {
        notify(`⚠️ "${t.title}" is now overdue`);
        t._overdueNotified = true;
      }
    });
  };
  // ---------- Toast & Confetti ----------
  const toast = (msg) => {
    const t = el('div', { class: 'toast' }, msg);
    $('#toastWrap').appendChild(t);
    setTimeout(() => t.remove(), 3000);
  };
  const confetti = () => {
    const colors = ['#A8E6CF', '#6DDCCF', '#7BC7A4', '#CDB4DB', '#FFD6A5', '#FFB5A7'];
    for (let i = 0; i < 80; i++) {
      const c = document.createElement('div');
      c.className = 'confetti';
      c.style.left = Math.random() * 100 + 'vw';
      c.style.background = colors[Math.floor(Math.random() * colors.length)];
      c.style.animationDuration = (2 + Math.random() * 2) + 's';
      c.style.animationDelay = Math.random() * 0.5 + 's';
      c.style.transform = `rotate(${Math.random()*360}deg)`;
      c.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
      document.body.appendChild(c);
      setTimeout(() => c.remove(), 4500);
    }
  };
  // ---------- Utils ----------
  const todayISO = () => new Date().toISOString().slice(0, 10);
  const escapeHTML = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  // ---------- Init ----------
  const init = () => {
    load();
    applyTheme();
    render();
    $('#addTaskBtn').addEventListener('click', () => openTaskModal());
    $('#mSave').addEventListener('click', saveTask);
    $('#mCancel').addEventListener('click', closeModal);
    $('#taskModal').addEventListener('click', (e) => { if (e.target.id === 'taskModal') closeModal(); });
    $('#searchInput').addEventListener('input', (e) => {
      state.filters.search = e.target.value;
      renderTasks();
    });
    ['filterCategory','filterStatus','filterPriority','filterSort'].forEach(id => {
      const elx = $('#' + id);
      if (elx) elx.addEventListener('change', (e) => {
        const key = id.replace('filter','').toLowerCase();
        const k = key === 'sort' ? 'sort' : key;
        state.filters[k] = e.target.value;
        renderTasks();
      });
    });
    $('#themeBtn').addEventListener('click', toggleTheme);
    $('#exportBtn').addEventListener('click', exportData);
    $('#importInput').addEventListener('change', (e) => {
      if (e.target.files[0]) importData(e.target.files[0]);
      e.target.value = '';
    });
    $('#importBtn').addEventListener('click', () => $('#importInput').click());
    $('#menuToggle').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
    $('#focusExit').addEventListener('click', () => $('#focusOverlay').classList.remove('open'));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { closeModal(); $('#focusOverlay').classList.remove('open'); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); $('#searchInput').focus(); }
      if ((e.metaKey || e.ctrlKey) && e.key === '/') { e.preventDefault(); openTaskModal(); }
    });
    if ('Notification' in window && Notification.permission === 'default') {
      setTimeout(() => Notification.requestPermission(), 4000);
    }
    setInterval(checkReminders, 60000);
    setTimeout(checkReminders, 2000);
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
