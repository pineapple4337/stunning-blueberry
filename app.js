// app.js
import { APP_CONFIG, CATEGORY_MAP } from './config.js';

// --- BASE CONNECTIONS ---
if (typeof supabase === 'undefined') {
    console.error('Supabase CDN script is missing or failed to load before app.js');
}

const supabaseClient = supabase.createClient(
    APP_CONFIG.SUPABASE_URL, 
    APP_CONFIG.SUPABASE_ANON_KEY
);

// --- DOM HOOKS ---
const todoForm = document.getElementById('todo-form');
const todoInput = document.getElementById('todo-input');
const todoDate = document.getElementById('todo-date');
const todoTime = document.getElementById('todo-time');
const todoList = document.getElementById('todo-list');
const loadingState = document.getElementById('loading-state');
const mobileTaskCount = document.getElementById('task-count');
const desktopTaskCount = document.getElementById('desktop-task-count');
const calendarDays = document.getElementById('calendar-days');
const calendarMonthYear = document.getElementById('calendar-month-year');
const expressExpenseForm = document.getElementById('express-expense-form');
const expressExpenseInput = document.getElementById('express-expense-input');
const expenseLedgerList = document.getElementById('expense-ledger-list');
const expenseVisualStats = document.getElementById('expense-visual-stats');

const taskModal = document.getElementById('task-modal');
const modalTaskId = document.getElementById('modal-task-id');
const modalTaskTitle = document.getElementById('modal-task-title');
const modalTaskDate = document.getElementById('modal-task-date');
const modalTaskTime = document.getElementById('modal-task-time');
const modalTaskNotes = document.getElementById('modal-task-notes');
const modalTaskProgress = document.getElementById('modal-task-progress');
const modalSliderValue = document.getElementById('modal-slider-value');

const pinkPurpleColors = ['pastel-pink-1', 'pastel-purple-1', 'pastel-orchid', 'pastel-pink-2', 'pastel-purple-2'];
const actualToday = new Date();
let displayDate = new Date(); 

if (todoDate) {
    const year = actualToday.getFullYear();
    const month = String(actualToday.getMonth() + 1).padStart(2, '0'); 
    const day = String(actualToday.getDate()).padStart(2, '0');
    todoDate.value = `${year}-${month}-${day}`;
}

let globalTodosCache = [];
let globalExpensesCache = [];
let pendingDuplicatePayload = null; 

let forceActiveCategoryHint = 'food & drink';

// --- AUTHENTICATION & AUTO-TIMEOUT LOGIC ---
let inactivityTimer = null;

function resetInactivityTimer() {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
        if (session) {
            inactivityTimer = setTimeout(autoLogout, APP_CONFIG.autoTimeoutMs || (15 * 60 * 1000));
        }
    });
}

async function autoLogout() {
    await supabaseClient.auth.signOut();
    alert("session expired due to inactivity.");
    window.location.reload();
}

['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach(evt => {
    window.addEventListener(evt, resetInactivityTimer, { passive: true });
});

async function checkSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    const authOverlay = document.getElementById('auth-overlay');
    if (session) {
        if (authOverlay) authOverlay.classList.add('hidden');
        fetchAllData();
        resetInactivityTimer();
    } else {
        if (authOverlay) authOverlay.classList.remove('hidden');
    }
}

window.handleLogin = async function(e) {
    e.preventDefault();
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const errorEl = document.getElementById('auth-error');
    const submitBtn = document.getElementById('auth-submit-btn');

    if (submitBtn) submitBtn.innerText = 'verifying...';
    if (errorEl) errorEl.classList.add('hidden');

    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) {
            if (errorEl) {
                errorEl.textContent = error.message.toLowerCase();
                errorEl.classList.remove('hidden');
            }
            if (submitBtn) submitBtn.innerText = 'unlock app 🔓';
        } else {
            const authOverlay = document.getElementById('auth-overlay');
            if (authOverlay) authOverlay.classList.add('hidden');
            fetchAllData();
            resetInactivityTimer();
        }
    } catch (err) {
        console.error("Login failure:", err);
        if (errorEl) {
            errorEl.textContent = "connection error during login.";
            errorEl.classList.remove('hidden');
        }
        if (submitBtn) submitBtn.innerText = 'unlock app 🔓';
    }
};

window.handleLogout = async function() {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    await supabaseClient.auth.signOut();
    window.location.reload();
};

// --- CATEGORY SELECTOR ENGINE ---
window.setCategory = function(categoryName, emojiStr) {
    forceActiveCategoryHint = categoryName;
    const contextLabel = document.getElementById('active-cat-display');
    if (contextLabel) contextLabel.innerHTML = `${emojiStr} ${categoryName}`;
    
    Object.keys(CATEGORY_MAP).forEach(key => {
        if (CATEGORY_MAP[key].btnId) {
            const btn = document.getElementById(CATEGORY_MAP[key].btnId);
            if (btn) btn.className = "py-2 text-sm rounded-lg transition-all hover:bg-white/60 active:scale-95";
        }
    });
    
    const targetBtnId = CATEGORY_MAP[categoryName]?.btnId;
    if (targetBtnId) {
        const targetBtn = document.getElementById(targetBtnId);
        if (targetBtn) targetBtn.className = "py-2 text-sm rounded-lg transition-all bg-white shadow-3xs scale-105 active:scale-95";
    }
};

function format12Hour(timeStr) {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    let h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'pm' : 'am';
    h = h % 12 || 12;
    return `${h}:${minutes} ${ampm}`;
}

function getCountdownText(dueDateStr) {
    if (!dueDateStr) return '';
    const parts = dueDateStr.split(' ');
    const [y, m, d] = parts[0].split('-').map(num => parseInt(num, 10));
    const targetDateClean = new Date(y, m - 1, d);
    const todayClean = new Date(actualToday.getFullYear(), actualToday.getMonth(), actualToday.getDate());
    const differenceInDays = Math.ceil((targetDateClean.getTime() - todayClean.getTime()) / (1000 * 3600 * 24));
    
    if (differenceInDays === 0) return '📍 today';
    if (differenceInDays === 1) return '⏳ tomorrow';
    if (differenceInDays < 0) return '⚠️ overdue';
    return `📌 ${differenceInDays}d left`;
}

// --- FETCH ENGINE ---
async function fetchAllData() {
    try {
        const [todosRes, expensesRes] = await Promise.all([
            supabaseClient.from('todos').select('*').order('due_date', { ascending: true }),
            supabaseClient.from('expenses').select('*').order('date', { ascending: false })
        ]);

        globalTodosCache = todosRes.data || [];
        globalExpensesCache = expensesRes.data || [];

        globalTodosCache.sort((a, b) => {
            if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1;
            return (a.due_date || '').localeCompare(b.due_date || '');
        });

        renderDashboard();
        renderExpenses();
    } catch (err) {
        console.error("Critical database fetch failure:", err);
    }
}

function renderDashboard() {
    if (!todoList) return;
    todoList.innerHTML = '';
    if (loadingState) loadingState.classList.add('hidden');
    todoList.classList.remove('hidden');
    
    const countStr = `${globalTodosCache.length} task${globalTodosCache.length === 1 ? '' : 's'}`;
    if (mobileTaskCount) mobileTaskCount.textContent = countStr;
    if (desktopTaskCount) desktopTaskCount.textContent = countStr;

    globalTodosCache.forEach((todo, index) => {
        const colorClass = pinkPurpleColors[index % pinkPurpleColors.length];
        const parts = todo.due_date ? todo.due_date.split(' ') : [];
        const displayTime = parts[1] ? format12Hour(parts[1]) : '';
        const isDone = todo.is_completed;
        const countdown = isDone ? '✅ done' : getCountdownText(todo.due_date);

        const li = document.createElement('li');
        li.className = `flex gap-3.5 items-start p-4 rounded-2xl border border-black/5 shadow-2xs hover:shadow-xs hover:scale-[1.01] transition-all duration-200 cursor-pointer ${colorClass} ${isDone ? 'opacity-40 line-through' : ''}`;
        li.onclick = () => openModal(todo.id);
        
        li.innerHTML = `
            <div onclick="event.stopPropagation(); fastToggleTodo('${todo.id}', ${isDone})" class="w-5 h-5 rounded-full border-2 border-purple-950/20 bg-white/90 flex items-center justify-center font-bold text-[10px] text-purple-700 select-none shrink-0 mt-0.5 hover:bg-purple-100 active:scale-90 transition-all">
                ${isDone ? '✓' : ''}
            </div>
            <div class="flex-1 min-w-0">
                <div class="flex items-start justify-between gap-2">
                    <div class="text-sm font-bold tracking-tight text-gray-800 lowercase break-words leading-snug">${todo.title}</div>
                    <button onclick="event.stopPropagation(); deleteTodo('${todo.id}')" class="text-gray-400 hover:text-rose-500 font-bold -mt-3 -mr-3 p-3.5 cursor-pointer shrink-0 transition-colors">✕</button>
                </div>
                <div class="flex items-center justify-between mt-2 text-[10px] font-bold tracking-wider text-purple-950/50 uppercase leading-none">
                    <span class="opacity-80">${displayTime ? '🕒 ' + displayTime : '📅 full day'}</span>
                    <span class="bg-white/80 px-2 py-1 rounded-lg shadow-3xs text-[9px]">${countdown}</span>
                </div>
            </div>
        `;
        todoList.appendChild(li);
    });

    renderCalendarGrid();
}

function renderCalendarGrid() {
    if (!calendarDays) return;
    calendarDays.innerHTML = '';
    const viewYear = displayDate.getFullYear();
    const viewMonth = displayDate.getMonth();
    const monthNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
    if (calendarMonthYear) calendarMonthYear.textContent = `${monthNames[viewMonth]} ${viewYear}`;

    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();
    const totalDays = new Date(viewYear, viewMonth + 1, 0).getDate();

    for (let i = 0; i < firstDayIndex; i++) {
        const blank = document.createElement('div');
        blank.className = "bg-purple-50/5 rounded-2xl border border-dashed border-purple-100/20 aspect-square";
        calendarDays.appendChild(blank);
    }

    for (let day = 1; day <= totalDays; day++) {
        const dayBox = document.createElement('div');
        const isRealToday = day === actualToday.getDate() && viewMonth === actualToday.getMonth() && viewYear === actualToday.getFullYear();
        const currentDayString = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        const dayTasks = globalTodosCache.filter(t => t.due_date && t.due_date.startsWith(currentDayString));
        const dayExpenses = globalExpensesCache.filter(e => e.date === currentDayString);
        const dayExpenseTotal = dayExpenses.reduce((sum, item) => sum + parseFloat(item.amount), 0);
    
        let heatmapStyleClass = 'bg-white/40 shadow-3xs';
        if (dayExpenseTotal > 0 && dayExpenseTotal <= 20) heatmapStyleClass = 'background-color: #ffeff2; box-shadow: inset 0 0 0 1px rgba(255,214,220,0.4);';
        else if (dayExpenseTotal > 20 && dayExpenseTotal <= 50) heatmapStyleClass = 'background-color: #ffd6e0; box-shadow: inset 0 0 0 1px rgba(255,180,195,0.5);';
        else if (dayExpenseTotal > 50) heatmapStyleClass = 'background-color: #fbcbf5; box-shadow: inset 0 0 0 1px rgba(240,180,230,0.6);';
    
        const pendingTasksCount = dayTasks.filter(t => !t.is_completed).length;
        let borderThicknessClass = 'border'; 
        let borderColorClass = 'border-gray-100/70';
    
        if (pendingTasksCount > 0) {
            borderColorClass = 'border-purple-400/80';
            borderThicknessClass = pendingTasksCount === 1 ? 'border-2' : (pendingTasksCount === 2 ? 'border-[3px]' : 'border-[4px]');
        }
    
        dayBox.className = `p-1 rounded-2xl ${borderThicknessClass} ${borderColorClass} flex flex-col items-center justify-center text-center text-xs font-semibold transition-all aspect-square overflow-hidden cursor-pointer hover:scale-[1.05] hover:shadow-2xs ${isRealToday ? 'ring-2 ring-purple-400 bg-white shadow-2xs' : ''}`;
        if (!isRealToday && dayExpenseTotal > 0) dayBox.style = heatmapStyleClass;
        
        dayBox.onclick = () => showDaySchedulePopup(currentDayString, dayTasks);
        dayBox.innerHTML = `<span class="text-xs ${isRealToday ? 'text-purple-700 font-extrabold bg-purple-50 px-2 py-0.5 rounded-lg' : 'text-gray-500'}">${day}</span>`;
        calendarDays.appendChild(dayBox);
    }
}

// --- EXPENSE PARSING ENGINE ---
function parseExpenseInput(rawVal, defaultDate = null) {
    const cleanLine = rawVal.trim().toLowerCase();
    const fallbackDate = defaultDate || `${actualToday.getFullYear()}-${String(actualToday.getMonth() + 1).padStart(2, '0')}-${String(actualToday.getDate()).padStart(2, '0')}`;

    if (cleanLine.includes('|')) {
        const parts = cleanLine.split('|').map(p => p.trim());
        if (parts.length < 4) return null;
        
        const date = parts[0];               
        const amount = parseFloat(parts[1]); 
        const category = parts[2];           
        let description = parts[3];          
        
        if (isNaN(amount)) return null;
        if (!description) description = "pasted transaction";
        
        return { date, amount, description, category };
    }

    const numMatch = cleanLine.match(/(\d+(\.\d+)?)/);
    if (numMatch) {
        const amount = parseFloat(numMatch[0]);
        const description = cleanLine.replace(numMatch[0], '').trim() || 'quick expense';
        return {
            date: fallbackDate,
            amount: amount,
            description: description,
            category: forceActiveCategoryHint
        };
    }

    return null;
}

if (expressExpenseForm) {
    expressExpenseForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const rawClipboardContent = expressExpenseInput ? expressExpenseInput.value : '';
        const lines = rawClipboardContent.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        let processedCount = 0;

        for (const line of lines) {
            const result = parseExpenseInput(line);
            if (result) {
                evaluateAndLogExpense({
                    date: result.date,             
                    amount: result.amount,
                    description: result.description.toLowerCase(), 
                    category: result.category
                });
                processedCount++;
            }
        }

        if (processedCount === 0) {
            alert('formatting error: please use pipe-separated lines (e.g. yyyy-mm-dd | amount | category | description) or standard amount text');
        }
        if (expressExpenseInput) expressExpenseInput.value = ''; 
    });
}

function evaluateAndLogExpense(payload) {
    const isDuplicate = globalExpensesCache.find(exp => {
        return (exp.date === payload.date) && 
               (Math.abs(parseFloat(exp.amount) - payload.amount) < 0.01) && 
               (exp.description.includes(payload.description) || payload.description.includes(exp.description));
    });

    if (isDuplicate) {
        pendingDuplicatePayload = payload;
        const msgEl = document.getElementById('duplicate-toast-msg');
        const toastEl = document.getElementById('duplicate-toast');
        if (msgEl) msgEl.textContent = `"${payload.description}" ($${payload.amount.toFixed(2)}) matches a logged entry.`;
        if (toastEl) toastEl.classList.remove('hidden');
    } else {
        executeInsertExpense(payload);
    }
}

async function executeInsertExpense(payload) {
    const { error } = await supabaseClient.from('expenses').insert([payload]);
    if (error) console.error('Supabase write failure:', error);
    fetchAllData();
}

window.forceInsertDuplicate = function() {
    if (pendingDuplicatePayload) executeInsertExpense(pendingDuplicatePayload);
    dismissDuplicate();
};

window.dismissDuplicate = function() {
    pendingDuplicatePayload = null;
    const toastEl = document.getElementById('duplicate-toast');
    if (toastEl) toastEl.classList.add('hidden');
};

window.toggleLedgerFullscreen = function() {
    const expenseSection = document.getElementById('mobile-sec-expenses');
    const calendarSection = document.getElementById('mobile-sec-calendar');
    const timelineSection = document.getElementById('mobile-sec-timeline');
    const headingRow = document.getElementById('expenses-heading-row');
    const inputArea = document.getElementById('ledger-input-area');
    const workspaceWrapper = document.getElementById('ledger-workspace-wrapper');
    const summaryBlock = document.getElementById('summary-card-block');
    const zoomBtn = document.getElementById('ledger-zoom-btn');
    
    if (!expenseSection) return;
    const isExpanded = expenseSection.classList.contains('md:flex-1');
    
    if (!isExpanded) {
        if (calendarSection) calendarSection.classList.replace('md:flex', 'md:hidden');
        if (timelineSection) timelineSection.classList.replace('flex', 'md:hidden');
        if (headingRow) headingRow.classList.add('hidden');
        if (inputArea) inputArea.classList.add('hidden');
        
        expenseSection.classList.replace('md:w-96', 'md:flex-1');
        expenseSection.classList.add('md:max-h-[85vh]');
        
        if (workspaceWrapper) workspaceWrapper.classList.replace('flex-col', 'flex-row');
        if (summaryBlock) summaryBlock.className = "w-72 bg-gray-50/60 p-4 rounded-2xl border border-gray-100 shrink-0 h-full overflow-y-auto no-scrollbar";
        
        if (zoomBtn) zoomBtn.innerHTML = '<span>collapse view</span> ↙';
    } else {
        if (calendarSection) calendarSection.classList.replace('md:hidden', 'md:flex');
        if (timelineSection) timelineSection.classList.replace('md:hidden', 'flex');
        if (headingRow) headingRow.classList.remove('hidden');
        if (inputArea) inputArea.classList.remove('hidden');
        
        expenseSection.classList.replace('md:flex-1', 'md:w-96');
        expenseSection.classList.remove('md:max-h-[85vh]');
        
        if (workspaceWrapper) workspaceWrapper.classList.replace('flex-row', 'flex-col');
        if (summaryBlock) summaryBlock.className = "bg-gray-50/60 p-4 rounded-2xl border border-gray-100 shrink-0";
        
        if (zoomBtn) zoomBtn.innerHTML = '<span>expand view</span> ↗';
    }
    
    renderExpenses();
    renderCalendarGrid();
};

function renderExpenses() {
    if (!expenseLedgerList || !expenseVisualStats) return;
    expenseLedgerList.innerHTML = '';
    expenseVisualStats.innerHTML = '';

    let totals = {};
    Object.keys(CATEGORY_MAP).forEach(k => totals[k] = 0);
    let totalCombinedAll = 0;

    const prefix = `${displayDate.getFullYear()}-${String(displayDate.getMonth() + 1).padStart(2, '0')}`;
    const activeExpenses = globalExpensesCache.filter(exp => exp.date && exp.date.startsWith(prefix));
    
    activeExpenses.forEach(exp => {
        const amt = parseFloat(exp.amount);
        totalCombinedAll += amt;
        if (totals[exp.category] !== undefined) totals[exp.category] += amt;
    });

    Object.keys(totals).forEach(cat => {
        const categorySum = totals[cat];
        if (categorySum === 0) return;
        
        const pct = totalCombinedAll > 0 ? (categorySum / totalCombinedAll) * 100 : 0;
        const meta = CATEGORY_MAP[cat] || { emoji: '📦', color: 'bg-purple-200' };

        const block = document.createElement('div');
        block.className = "text-xs lowercase";
        block.innerHTML = `
            <div class="flex justify-between font-semibold text-gray-600 items-center mb-1">
                <span class="flex items-center gap-1.5 font-bold text-gray-700"><span>${meta.emoji}</span> ${cat}</span>
                <span class="font-bold text-gray-500">$${categorySum.toFixed(2)} <span class="text-[10px] text-gray-400 font-normal">(${Math.round(pct)}%)</span></span>
            </div>
            <div class="w-full bg-gray-200/50 h-2 rounded-full overflow-hidden shadow-4xs">
                <div class="${meta.color} h-full rounded-full transition-all duration-500" style="width: ${pct}%"></div>
            </div>
        `;
        expenseVisualStats.appendChild(block);
    });

    const expenseSection = document.getElementById('mobile-sec-expenses');
    const isExpandedMode = expenseSection && expenseSection.classList.contains('md:flex-1');

    if (isExpandedMode) {
        const tableContainer = document.createElement('div');
        tableContainer.className = "w-full h-full overflow-y-auto no-scrollbar border border-gray-100 rounded-2xl bg-white shadow-3xs";
        
        let tableHtml = `
            <table class="w-full text-left border-collapse text-xs lowercase relative">
                <thead>
                    <tr class="bg-gray-50 sticky top-0 border-b border-gray-100 font-bold text-gray-400 tracking-wider z-10">
                        <th class="p-3.5 w-24 pl-5">date</th>
                        <th class="p-3.5 w-36">category</th>
                        <th class="p-3.5">description</th>
                        <th class="p-3.5 w-28 text-right pr-6">amount</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-50 font-semibold text-gray-600">
        `;

        activeExpenses.forEach(exp => {
            const amt = parseFloat(exp.amount);
            const meta = CATEGORY_MAP[exp.category] || { emoji: '💰', color: 'bg-gray-200' };
            const [y, m, d] = exp.date.split('-');
            
            tableHtml += `
                <tr onclick="openExpenseModal('${exp.id}')" class="hover:bg-purple-50/40 transition-colors group cursor-pointer">
                    <td class="p-3.5 pl-5 text-gray-400 font-mono font-medium">${d}/${m}/${y}</td>
                    <td class="p-3.5">
                        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl ${meta.color} bg-opacity-70 text-[11px] font-bold shadow-4xs">
                            <span>${meta.emoji}</span> ${exp.category}
                        </span>
                    </td>
                    <td class="p-3.5 font-bold text-gray-700">${exp.description}</td>
                    <td class="p-3.5 text-right pr-5 font-extrabold text-gray-800">
                        <div class="flex items-center justify-end gap-2">
                            <span>-$${amt.toFixed(2)}</span>
                            <button onclick="event.stopPropagation();deleteExpense('${exp.id}')" class="text-gray-300 hover:text-rose-500 font-bold p-1 cursor-pointer transition-colors opacity-0 group-hover:opacity-100">✕</button>
                        </div>
                    </td>
                </tr>
            `;
        });

        if (activeExpenses.length === 0) {
            tableHtml += `<tr><td colspan="4" class="p-8 text-center text-gray-400 font-medium">no logged expenses this month</td></tr>`;
        }

        tableHtml += `</tbody></table>`;
        tableContainer.innerHTML = tableHtml;
        expenseLedgerList.appendChild(tableContainer);
        
    } else {
        activeExpenses.forEach(exp => {
            const amt = parseFloat(exp.amount);
            const meta = CATEGORY_MAP[exp.category] || { emoji: '💰', color: 'bg-gray-200' };
            const [y, m, d] = exp.date.split('-');

            const li = document.createElement('li');
            li.className = "flex items-center justify-between p-3 bg-gray-50/50 rounded-2xl border border-gray-100/70 lowercase shadow-3xs cursor-pointer hover:bg-white hover:shadow-2xs transition-all duration-150";
            li.onclick = () => openExpenseModal(exp.id);
            li.innerHTML = `
                <div class="min-w-0 flex-1 flex items-center gap-3">
                    <div class="w-8 h-8 rounded-xl flex items-center justify-center text-sm shrink-0 shadow-3xs ${meta.color}">${meta.emoji}</div>
                    <div class="min-w-0 flex-1">
                        <div class="font-bold text-gray-700 truncate leading-tight">${exp.description}</div>
                        <div class="text-[10px] text-gray-400 font-medium mt-0.5">${d}/${m}/${y}</div>
                    </div>
                </div>
                <div class="flex items-center gap-1 ml-2 shrink-0">
                    <span class="font-extrabold text-gray-700 mr-1">-$${amt.toFixed(2)}</span>
                    <button onclick="event.stopPropagation();deleteExpense('${exp.id}')" class="text-gray-300 hover:text-rose-500 font-bold text-sm transition-colors cursor-pointer -my-3 -mr-2 p-3.5">✕</button>
                </div>
            `;
            expenseLedgerList.appendChild(li);
        });
    }
}

window.deleteExpense = async function(id) {
    if (!window.confirm("delete this expense?")) return;
    await supabaseClient.from('expenses').delete().eq('id', id);
    fetchAllData();
};

function getModalSnapshot() {
    return ['modal-task-title', 'modal-task-date', 'modal-task-time', 'modal-task-notes', 'modal-task-progress']
        .map(id => {
            const el = document.getElementById(id);
            return el ? el.value : '';
        }).join('|');
}

window.openModal = function(id) {
    const todo = globalTodosCache.find(t => t.id === id);
    if (!todo) return;
    if (modalTaskId) modalTaskId.value = todo.id;
    if (modalTaskTitle) modalTaskTitle.value = todo.title;
    if (modalTaskNotes) modalTaskNotes.value = todo.notes || '';
    const parts = todo.due_date ? todo.due_date.split(' ') : ['', ''];
    if (modalTaskDate) modalTaskDate.value = parts[0] || '';
    if (modalTaskTime) modalTaskTime.value = parts[1] || '';
    const pct = todo.progress || (todo.is_completed ? 100 : 0);
    if (modalTaskProgress) {
        modalTaskProgress.value = pct;
        modalTaskProgress.style.background = `linear-gradient(to right, #ffd6e0 0%, #e8dbfc ${pct}%, #e5e7eb ${pct}%)`;
    }
    if (modalSliderValue) modalSliderValue.textContent = pct + '%';
    
    if (taskModal) taskModal.classList.remove('hidden');
    window.originalModalSnapshotString = getModalSnapshot();
};

window.closeModal = () => {
    if (taskModal) taskModal.classList.add('hidden');
};

window.openExpenseModal = function(id) {
    const exp = globalExpensesCache.find(e => e.id === id);
    if (!exp) return;
    const idEl = document.getElementById('modal-expense-id');
    const dateEl = document.getElementById('modal-expense-date');
    const amtEl = document.getElementById('modal-expense-amount');
    const descEl = document.getElementById('modal-expense-description');
    const catEl = document.getElementById('modal-expense-category');
    const modalEl = document.getElementById('expense-modal');

    if (idEl) idEl.value = exp.id;
    if (dateEl) dateEl.value = exp.date || '';
    if (amtEl) amtEl.value = exp.amount || '';
    if (descEl) descEl.value = exp.description || '';
    if (catEl) catEl.value = exp.category || 'food & drink';
    if (modalEl) modalEl.classList.remove('hidden');
};

window.closeExpenseModal = () => {
    const modalEl = document.getElementById('expense-modal');
    if (modalEl) modalEl.classList.add('hidden');
};

window.saveExpenseModalChanges = async function() {
    const id = document.getElementById('modal-expense-id')?.value;
    const d = document.getElementById('modal-expense-date')?.value;
    const a = parseFloat(document.getElementById('modal-expense-amount')?.value);
    const desc = document.getElementById('modal-expense-description')?.value.trim().toLowerCase();
    const cat = document.getElementById('modal-expense-category')?.value;

    if (!d || isNaN(a) || !desc) return alert('all fields required.');
    await supabaseClient.from('expenses').update({ date: d, amount: a, description: desc, category: cat }).eq('id', id);
    closeExpenseModal(); 
    fetchAllData();
};

window.showDaySchedulePopup = function(dateStr, dayTasks) {
    const popup = document.getElementById('calendar-day-popup');
    const headerTitle = document.getElementById('popup-schedule-date');
    const content = document.getElementById('popup-schedule-content');

    if (!popup || !headerTitle || !content) return;

    const [y, m, d] = dateStr.split('-');
    headerTitle.textContent = `schedule: ${d}/${m}/${y}`;
    content.innerHTML = '';

    if (dayTasks.length === 0) {
        content.innerHTML = '<div class="text-center py-6 text-xs text-gray-400 font-medium lowercase">no tasks scheduled</div>';
    } else {
        dayTasks.forEach(task => {
            const timeParts = task.due_date ? task.due_date.split(' ') : [];
            const tDisplay = timeParts[1] ? format12Hour(timeParts[1]) : 'full day';
            const card = document.createElement('div');
            card.className = `p-3.5 rounded-2xl border border-gray-100 bg-gray-50/50 shadow-3xs hover:bg-white hover:shadow-2xs transition-all duration-150 flex items-center justify-between gap-3 cursor-pointer ${task.is_completed ? 'opacity-50' : ''}`;
            card.onclick = () => { closeDaySchedulePopup(); openModal(task.id); };
            card.innerHTML = `
                <div class="min-w-0 flex-1">
                    <div class="text-xs font-bold text-gray-700 truncate lowercase ${task.is_completed ? 'line-through text-gray-400' : ''}">${task.title}</div>
                    <div class="text-[10px] text-purple-950/40 font-bold mt-1">🕒 ${tDisplay}</div>
                </div>
            `;
            content.appendChild(card);
        });
    }
    popup.classList.remove('hidden');
};

window.closeDaySchedulePopup = () => {
    const popup = document.getElementById('calendar-day-popup');
    if (popup) popup.classList.add('hidden');
};

window.handleModalOutsideClick = function(event) {
    if (window.originalModalSnapshotString === getModalSnapshot()) { closeModal(); return; }
    if (window.confirm("save changes before closing?")) saveModalChanges();
    else closeModal();
};

window.saveModalChanges = async function() {
    const id = modalTaskId?.value;
    const title = modalTaskTitle?.value.trim().toLowerCase();
    const d = modalTaskDate?.value;
    const t = modalTaskTime?.value;
    const notes = modalTaskNotes?.value;
    const prog = parseInt(modalTaskProgress?.value || '0', 10);
    if (!title || !d) return alert('description and date required.');

    await supabaseClient.from('todos').update({ 
        title, 
        due_date: t ? `${d} ${t}` : d, 
        notes, 
        progress: prog, 
        is_completed: (prog === 100) 
    }).eq('id', id);
    
    closeModal(); 
    fetchAllData();
};

window.fastToggleTodo = async function(id, status) {
    await supabaseClient.from('todos').update({ is_completed: !status, progress: !status ? 100 : 0 }).eq('id', id);
    fetchAllData();
};

window.changeMonth = function(dir) {
    displayDate.setDate(1); 
    displayDate.setMonth(displayDate.getMonth() + dir);
    renderCalendarGrid();
    renderExpenses();
};

window.switchMobileTab = function(activeTab) {
    ['timeline', 'calendar', 'expenses'].forEach(t => {
        const btn = document.getElementById(`tab-btn-${t}`);
        const sec = document.getElementById(`mobile-sec-${t}`);
        if (!btn || !sec) return;
        if (t === activeTab) {
            btn.className = "flex-1 text-center py-2 text-xs font-bold rounded-xl transition-all pastel-purple-1 text-purple-800 shadow-2xs";
            sec.classList.remove('hidden'); sec.classList.add('flex');
        } else {
            btn.className = "flex-1 text-center py-2 text-xs font-bold rounded-xl transition-all text-gray-400 hover:text-gray-600";
            sec.classList.add('hidden'); sec.classList.remove('flex');
        }
    });
};

if (todoForm) {
    todoForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const typeEl = document.getElementById('entry-type');
        const type = typeEl ? typeEl.value : 'todo';
        const raw = todoInput ? todoInput.value.trim().toLowerCase() : '';
        const d = todoDate ? todoDate.value : '';
        const t = todoTime ? todoTime.value : '';
        if (!raw) return;

        if (type === 'expense') {
            const res = parseExpenseInput(raw, d);
            if (!res) return alert('could not parse expense line.');
            evaluateAndLogExpense({ date: res.date, amount: res.amount, description: res.description, category: res.category });
        } else {
            if (!d) return alert('date selection required.');
            await supabaseClient.from('todos').insert([{ title: raw, is_completed: false, due_date: t ? `${d} ${t}` : d, notes: '', progress: 0 }]);
        }
        if (todoInput) todoInput.value = ''; 
        if (todoTime) todoTime.value = '';
        fetchAllData();
    });
}

window.deleteTodo = async function(id) {
    if (!window.confirm("delete this task?")) return;
    await supabaseClient.from('todos').delete().eq('id', id);
    fetchAllData();
};

// Initialize session check on load
checkSession();
