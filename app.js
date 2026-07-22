// app.js
import { APP_CONFIG, CATEGORY_MAP } from './config.js';

if (typeof supabase === 'undefined') console.error('Supabase CDN missing.');

const supabaseClient = supabase.createClient(APP_CONFIG.SUPABASE_URL, APP_CONFIG.SUPABASE_ANON_KEY);

// --- DOM HOOKS ---
const $ = id => document.getElementById(id);
const actualToday = new Date();
let displayDate = new Date(); 
let globalTodosCache = [], globalExpensesCache = [], pendingDuplicatePayload = null; 
let forceActiveCategoryHint = 'food & drink', inactivityTimer = null;
const DEFAULT_AUTH_EMAIL = 'ateghddw@gmail.com';
const pinkPurpleColors = ['pastel-pink-1', 'pastel-purple-1', 'pastel-orchid', 'pastel-pink-2', 'pastel-purple-2'];

if ($('todo-date')) {
    const [y, m, d] = [actualToday.getFullYear(), String(actualToday.getMonth() + 1).padStart(2, '0'), String(actualToday.getDate()).padStart(2, '0')];
    $('todo-date').value = `${y}-${m}-${d}`;
}

// --- AUTH & TIMEOUT ---
function resetInactivityTimer() {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
        if (session) inactivityTimer = setTimeout(autoLogout, APP_CONFIG.autoTimeoutMs || 900000);
    });
}

async function autoLogout() {
    await supabaseClient.auth.signOut();
    alert("session expired due to inactivity.");
    window.location.reload();
}

['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach(evt => window.addEventListener(evt, resetInactivityTimer, { passive: true }));

async function checkSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    $('auth-overlay')?.classList.toggle('hidden', !!session);
    if (session) { fetchAllData(); resetInactivityTimer(); }
}

async function handleLogin(e) {
    if (e) e.preventDefault();
    const passcode = $('auth-passcode')?.value || '';
    const errorEl = $('auth-error');
    const submitBtn = $('auth-submit-btn');

    if (submitBtn) submitBtn.innerText = 'verifying...';
    errorEl?.classList.add('hidden');

    try {
        const { error } = await supabaseClient.auth.signInWithPassword({ email: DEFAULT_AUTH_EMAIL, password: passcode });
        if (error) {
            if (errorEl) { errorEl.textContent = 'incorrect passcode'; errorEl.classList.remove('hidden'); }
            if (submitBtn) submitBtn.innerText = 'unlock app 🔓';
        } else {
            $('auth-overlay')?.classList.add('hidden');
            if ($('auth-passcode')) $('auth-passcode').value = '';
            fetchAllData();
            resetInactivityTimer();
        }
    } catch (err) {
        if (errorEl) { errorEl.textContent = "connection error."; errorEl.classList.remove('hidden'); }
        if (submitBtn) submitBtn.innerText = 'unlock app 🔓';
    }
}

window.handleLogout = async () => { clearTimeout(inactivityTimer); await supabaseClient.auth.signOut(); window.location.reload(); };

// --- HELPERS & CATEGORIES ---
window.setCategory = (categoryName, emojiStr) => {
    forceActiveCategoryHint = categoryName;
    if ($('active-cat-display')) $('active-cat-display').innerHTML = `${emojiStr} ${categoryName}`;
    Object.keys(CATEGORY_MAP).forEach(k => {
        const btn = $(CATEGORY_MAP[k]?.btnId);
        if (btn) btn.className = k === categoryName 
            ? "py-2 text-sm rounded-lg transition-all bg-white shadow-3xs scale-105 active:scale-95" 
            : "py-2 text-sm rounded-lg transition-all hover:bg-white/60 active:scale-95";
    });
};

const format12Hour = t => {
    if (!t) return '';
    let [h, m] = t.split(':').map(Number);
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'pm' : 'am'}`;
};

const getCountdownText = dStr => {
    if (!dStr) return '';
    const [y, m, d] = dStr.split(' ')[0].split('-').map(Number);
    const diff = Math.ceil((new Date(y, m - 1, d) - new Date(actualToday.getFullYear(), actualToday.getMonth(), actualToday.getDate())) / 86400000);
    return diff === 0 ? '📍 today' : diff === 1 ? '⏳ tomorrow' : diff < 0 ? '⚠️ overdue' : `📌 ${diff}d left`;
};

// --- DATA FETCH & RENDER ---
async function fetchAllData() {
    try {
        const [todosRes, expensesRes] = await Promise.all([
            supabaseClient.from('todos').select('*').order('due_date', { ascending: true }),
            supabaseClient.from('expenses').select('*').order('date', { ascending: false })
        ]);
        globalTodosCache = (todosRes.data || []).sort((a, b) => a.is_completed === b.is_completed ? (a.due_date || '').localeCompare(b.due_date || '') : (a.is_completed ? 1 : -1));
        globalExpensesCache = expensesRes.data || [];
        renderDashboard();
        renderExpenses();
    } catch (err) { console.error("Database fetch failure:", err); }
}

function renderDashboard() {
    const list = $('todo-list');
    if (!list) return;
    list.innerHTML = '';
    $('loading-state')?.classList.add('hidden');
    list.classList.remove('hidden');
    
    const countStr = `${globalTodosCache.length} task${globalTodosCache.length === 1 ? '' : 's'}`;
    if ($('task-count')) $('task-count').textContent = countStr;
    if ($('desktop-task-count')) $('desktop-task-count').textContent = countStr;

    globalTodosCache.forEach((todo, index) => {
        const parts = todo.due_date ? todo.due_date.split(' ') : [];
        const li = document.createElement('li');
        li.className = `flex gap-3.5 items-start p-4 rounded-2xl border border-black/5 shadow-2xs hover:shadow-xs hover:scale-[1.01] transition-all duration-200 cursor-pointer ${pinkPurpleColors[index % pinkPurpleColors.length]} ${todo.is_completed ? 'opacity-40 line-through' : ''}`;
        li.onclick = () => openModal(todo.id);
        li.innerHTML = `
            <div onclick="event.stopPropagation(); fastToggleTodo('${todo.id}', ${todo.is_completed})" class="w-5 h-5 rounded-full border-2 border-purple-950/20 bg-white/90 flex items-center justify-center font-bold text-[10px] text-purple-700 select-none shrink-0 mt-0.5 hover:bg-purple-100 active:scale-90 transition-all">${todo.is_completed ? '✓' : ''}</div>
            <div class="flex-1 min-w-0">
                <div class="flex items-start justify-between gap-2">
                    <div class="text-sm font-bold tracking-tight text-gray-800 lowercase break-words leading-snug">${todo.title}</div>
                    <button onclick="event.stopPropagation(); deleteTodo('${todo.id}')" class="text-gray-400 hover:text-rose-500 font-bold -mt-3 -mr-3 p-3.5 cursor-pointer shrink-0 transition-colors">✕</button>
                </div>
                <div class="flex items-center justify-between mt-2 text-[10px] font-bold tracking-wider text-purple-950/50 uppercase leading-none">
                    <span class="opacity-80">${parts[1] ? '🕒 ' + format12Hour(parts[1]) : '📅 full day'}</span>
                    <span class="bg-white/80 px-2 py-1 rounded-lg shadow-3xs text-[9px]">${todo.is_completed ? '✅ done' : getCountdownText(todo.due_date)}</span>
                </div>
            </div>`;
        list.appendChild(li);
    });
    renderCalendarGrid();
}

function renderCalendarGrid() {
    const grid = $('calendar-days');
    if (!grid) return;
    grid.innerHTML = '';
    const [y, m] = [displayDate.getFullYear(), displayDate.getMonth()];
    if ($('calendar-month-year')) $('calendar-month-year').textContent = `${["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"][m]} ${y}`;

    for (let i = 0; i < new Date(y, m, 1).getDay(); i++) {
        grid.appendChild(Object.assign(document.createElement('div'), { className: "bg-purple-50/5 rounded-2xl border border-dashed border-purple-100/20 aspect-square" }));
    }

    const totalDays = new Date(y, m + 1, 0).getDate();
    for (let day = 1; day <= totalDays; day++) {
        const isToday = day === actualToday.getDate() && m === actualToday.getMonth() && y === actualToday.getFullYear();
        const dStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayTasks = globalTodosCache.filter(t => t.due_date?.startsWith(dStr));
        const totalExp = globalExpensesCache.filter(e => e.date === dStr).reduce((acc, i) => acc + parseFloat(i.amount), 0);

        const pending = dayTasks.filter(t => !t.is_completed).length;
        const borderClass = pending > 0 ? `border-${pending === 1 ? '2' : pending === 2 ? '[3px]' : '[4px]'} border-purple-400/80` : 'border border-gray-100/70';

        const dayBox = document.createElement('div');
        dayBox.className = `p-1 rounded-2xl ${borderClass} flex flex-col items-center justify-center text-center text-xs font-semibold transition-all aspect-square overflow-hidden cursor-pointer hover:scale-[1.05] hover:shadow-2xs ${isToday ? 'ring-2 ring-purple-400 bg-white shadow-2xs' : ''}`;
        if (!isToday && totalExp > 0) {
            const bg = totalExp <= 20 ? '#ffeff2' : totalExp <= 50 ? '#ffd6e0' : '#fbcbf5';
            dayBox.style = `background-color: ${bg}; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.05);`;
        }
        dayBox.onclick = () => showDaySchedulePopup(dStr, dayTasks);
        dayBox.innerHTML = `<span class="text-xs ${isToday ? 'text-purple-700 font-extrabold bg-purple-50 px-2 py-0.5 rounded-lg' : 'text-gray-500'}">${day}</span>`;
        grid.appendChild(dayBox);
    }
}

// --- EXPENSES & MODALS ---
function parseExpenseInput(rawVal, fallbackDate = null) {
    const clean = rawVal.trim().toLowerCase();
    const defaultDate = fallbackDate || `${actualToday.getFullYear()}-${String(actualToday.getMonth() + 1).padStart(2, '0')}-${String(actualToday.getDate()).padStart(2, '0')}`;

    if (clean.includes('|')) {
        const [date, amt, category, ...desc] = clean.split('|').map(p => p.trim());
        return isNaN(parseFloat(amt)) ? null : { date, amount: parseFloat(amt), category, description: desc.join(' ') || 'pasted transaction' };
    }
    const numMatch = clean.match(/(\d+(\.\d+)?)/);
    return numMatch ? { date: defaultDate, amount: parseFloat(numMatch[0]), description: clean.replace(numMatch[0], '').trim() || 'quick expense', category: forceActiveCategoryHint } : null;
}

$('express-expense-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const lines = ($('express-expense-input')?.value || '').split('\n').map(l => l.trim()).filter(Boolean);
    let count = 0;
    lines.forEach(l => {
        const res = parseExpenseInput(l);
        if (res) { evaluateAndLogExpense(res); count++; }
    });
    if (!count) alert('format error: use date | amount | category | description');
    if ($('express-expense-input')) $('express-expense-input').value = '';
});

function evaluateAndLogExpense(payload) {
    const dupe = globalExpensesCache.find(e => e.date === payload.date && Math.abs(parseFloat(e.amount) - payload.amount) < 0.01 && (e.description.includes(payload.description) || payload.description.includes(e.description)));
    if (dupe) {
        pendingDuplicatePayload = payload;
        if ($('duplicate-toast-msg')) $('duplicate-toast-msg').textContent = `"${payload.description}" ($${payload.amount.toFixed(2)}) matches an entry.`;
        $('duplicate-toast')?.classList.remove('hidden');
    } else executeInsertExpense(payload);
}

async function executeInsertExpense(payload) {
    await supabaseClient.from('expenses').insert([payload]);
    fetchAllData();
}

window.forceInsertDuplicate = () => { if (pendingDuplicatePayload) executeInsertExpense(pendingDuplicatePayload); dismissDuplicate(); };
window.dismissDuplicate = () => { pendingDuplicatePayload = null; $('duplicate-toast')?.classList.add('hidden'); };

function renderExpenses() {
    const list = $('expense-ledger-list'), stats = $('expense-visual-stats');
    if (!list || !stats) return;
    list.innerHTML = ''; stats.innerHTML = '';

    let totals = {}, totalAll = 0;
    Object.keys(CATEGORY_MAP).forEach(k => totals[k] = 0);
    const prefix = `${displayDate.getFullYear()}-${String(displayDate.getMonth() + 1).padStart(2, '0')}`;
    const active = globalExpensesCache.filter(e => e.date?.startsWith(prefix));

    active.forEach(e => { const a = parseFloat(e.amount); totalAll += a; if (totals[e.category] !== undefined) totals[e.category] += a; });

    Object.entries(totals).forEach(([cat, sum]) => {
        if (!sum) return;
        const pct = totalAll ? (sum / totalAll) * 100 : 0;
        const meta = CATEGORY_MAP[cat] || { emoji: '📦', color: 'bg-purple-200' };
        stats.appendChild(Object.assign(document.createElement('div'), {
            className: "text-xs lowercase",
            innerHTML: `<div class="flex justify-between font-semibold text-gray-600 items-center mb-1">
                <span class="font-bold text-gray-700">${meta.emoji} ${cat}</span>
                <span class="font-bold text-gray-500">$${sum.toFixed(2)} (${Math.round(pct)}%)</span>
            </div>
            <div class="w-full bg-gray-200/50 h-2 rounded-full overflow-hidden"><div class="${meta.color} h-full" style="width: ${pct}%"></div></div>`
        }));
    });

    active.forEach(exp => {
        const meta = CATEGORY_MAP[exp.category] || { emoji: '💰', color: 'bg-gray-200' };
        const [y, m, d] = exp.date.split('-');
        const li = document.createElement('li');
        li.className = "flex items-center justify-between p-3 bg-gray-50/50 rounded-2xl border border-gray-100/70 lowercase shadow-3xs cursor-pointer hover:bg-white transition-all";
        li.onclick = () => openExpenseModal(exp.id);
        li.innerHTML = `
            <div class="flex items-center gap-3 min-w-0">
                <div class="w-8 h-8 rounded-xl flex items-center justify-center text-sm ${meta.color}">${meta.emoji}</div>
                <div class="min-w-0"><div class="font-bold text-gray-700 truncate">${exp.description}</div><div class="text-[10px] text-gray-400">${d}/${m}/${y}</div></div>
            </div>
            <div class="flex items-center gap-1"><span class="font-extrabold text-gray-700">-$${parseFloat(exp.amount).toFixed(2)}</span><button onclick="event.stopPropagation();deleteExpense('${exp.id}')" class="text-gray-300 hover:text-rose-500 font-bold p-2">✕</button></div>`;
        list.appendChild(li);
    });
}

window.deleteExpense = async id => { if (confirm("delete expense?")) { await supabaseClient.from('expenses').delete().eq('id', id); fetchAllData(); } };
window.openModal = id => {
    const todo = globalTodosCache.find(t => t.id === id);
    if (!todo) return;
    if ($('modal-task-id')) $('modal-task-id').value = todo.id;
    if ($('modal-task-title')) $('modal-task-title').value = todo.title;
    if ($('modal-task-notes')) $('modal-task-notes').value = todo.notes || '';
    const [d, t] = todo.due_date ? todo.due_date.split(' ') : ['', ''];
    if ($('modal-task-date')) $('modal-task-date').value = d;
    if ($('modal-task-time')) $('modal-task-time').value = t;
    $('task-modal')?.classList.remove('hidden');
};
window.closeModal = () => $('task-modal')?.classList.add('hidden');

window.openExpenseModal = id => {
    const exp = globalExpensesCache.find(e => e.id === id);
    if (!exp) return;
    ['id', 'date', 'amount', 'description', 'category'].forEach(k => { if ($(`modal-expense-${k}`)) $(`modal-expense-${k}`).value = exp[k] || ''; });
    $('expense-modal')?.classList.remove('hidden');
};
window.closeExpenseModal = () => $('expense-modal')?.classList.add('hidden');

window.saveExpenseModalChanges = async () => {
    const [id, date, amount, description, category] = ['id', 'date', 'amount', 'description', 'category'].map(k => $(`modal-expense-${k}`)?.value);
    if (!date || isNaN(parseFloat(amount)) || !description) return alert('all fields required.');
    await supabaseClient.from('expenses').update({ date, amount: parseFloat(amount), description: description.toLowerCase(), category }).eq('id', id);
    closeExpenseModal(); fetchAllData();
};

window.showDaySchedulePopup = (dateStr, dayTasks) => {
    const popup = $('calendar-day-popup'), content = $('popup-schedule-content');
    if (!popup || !content) return;
    const [y, m, d] = dateStr.split('-');
    if ($('popup-schedule-date')) $('popup-schedule-date').textContent = `schedule: ${d}/${m}/${y}`;
    content.innerHTML = dayTasks.length ? '' : '<div class="text-center py-6 text-xs text-gray-400">no tasks scheduled</div>';
    dayTasks.forEach(t => {
        const timeParts = t.due_date ? t.due_date.split(' ') : [];
        content.appendChild(Object.assign(document.createElement('div'), {
            className: "p-3.5 rounded-2xl border border-gray-100 bg-gray-50/50 flex items-center justify-between cursor-pointer",
            onclick: () => { closeDaySchedulePopup(); openModal(t.id); },
            innerHTML: `<div class="text-xs font-bold text-gray-700 ${t.is_completed ? 'line-through text-gray-400' : ''}">${t.title}</div><div class="text-[10px] text-purple-950/40">🕒 ${timeParts[1] ? format12Hour(timeParts[1]) : 'full day'}</div>`
        }));
    });
    popup.classList.remove('hidden');
};
window.closeDaySchedulePopup = () => $('calendar-day-popup')?.classList.add('hidden');

window.fastToggleTodo = async (id, status) => { await supabaseClient.from('todos').update({ is_completed: !status, progress: !status ? 100 : 0 }).eq('id', id); fetchAllData(); };
window.changeMonth = dir => { displayDate.setDate(1); displayDate.setMonth(displayDate.getMonth() + dir); renderCalendarGrid(); renderExpenses(); };

$('todo-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const raw = $('todo-input')?.value.trim().toLowerCase();
    const d = $('todo-date')?.value, t = $('todo-time')?.value;
    if (!raw) return;
    if ($('entry-type')?.value === 'expense') {
        const res = parseExpenseInput(raw, d);
        if (res) evaluateAndLogExpense(res);
    } else {
        if (!d) return alert('date required.');
        await supabaseClient.from('todos').insert([{ title: raw, is_completed: false, due_date: t ? `${d} ${t}` : d, notes: '', progress: 0 }]);
    }
    if ($('todo-input')) $('todo-input').value = '';
    fetchAllData();
});

window.deleteTodo = async id => { if (confirm("delete task?")) { await supabaseClient.from('todos').delete().eq('id', id); fetchAllData(); } };

document.addEventListener('DOMContentLoaded', () => $('auth-form')?.addEventListener('submit', handleLogin));
checkSession();
