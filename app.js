// --- DOM HELPER ---
const $ = (id) => document.getElementById(id);

// --- GLOBAL STATE ---
let globalExpensesCache = [];
let displayDate = new Date();

// --- COHESIVE PASTEL PALETTE CATEGORY MAP ---
const CATEGORY_MAP = {
    'food & drink': { emoji: '🍔', badgeColor: 'bg-rose-100 text-rose-800', barColor: 'bg-rose-300' },
    'shopping': { emoji: '🛍️', badgeColor: 'bg-pink-100 text-pink-800', barColor: 'bg-pink-300' },
    'subscriptions': { emoji: '📺', badgeColor: 'bg-purple-100 text-purple-800', barColor: 'bg-purple-300' },
    'events': { emoji: '🎟️', badgeColor: 'bg-indigo-100 text-indigo-800', barColor: 'bg-indigo-300' },
    'fees': { emoji: '💵', badgeColor: 'bg-blue-100 text-blue-800', barColor: 'bg-blue-300' },
    'health': { emoji: '💊', badgeColor: 'bg-teal-100 text-teal-800', barColor: 'bg-teal-300' },
    'transport': { emoji: '🚌', badgeColor: 'bg-emerald-100 text-emerald-800', barColor: 'bg-emerald-300' },
    'other': { emoji: '📦', badgeColor: 'bg-gray-100 text-gray-800', barColor: 'bg-gray-300' }
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    initDefaultDate();
    setupEventListeners();
    loadExpenses();
});

function initDefaultDate() {
    const today = new Date().toISOString().split('T')[0];
    if ($('expense-date')) $('expense-date').value = today;
    updateMonthDisplay();
}

function updateMonthDisplay() {
    const monthNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
    if ($('current-month-display')) {
        $('current-month-display').textContent = `${monthNames[displayDate.getMonth()]} ${displayDate.getFullYear()}`;
    }
}

// --- EVENT LISTENERS ---
function setupEventListeners() {
    // Form Submit
    $('expense-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const newExpense = {
            id: Date.now().toString(),
            description: $('expense-desc').value.toLowerCase(),
            amount: parseFloat($('expense-amount').value),
            date: $('expense-date').value,
            category: $('expense-category').value
        };
        globalExpensesCache.unshift(newExpense);
        saveExpenses();
        renderExpenses();
        $('expense-form').reset();
        initDefaultDate();
    });

    // Edit Form Submit
    $('edit-expense-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = $('edit-expense-id').value;
        const index = globalExpensesCache.findIndex(e => e.id === id);
        if (index !== -1) {
            globalExpensesCache[index] = {
                id,
                description: $('edit-expense-desc').value.toLowerCase(),
                amount: parseFloat($('edit-expense-amount').value),
                date: $('edit-expense-date').value,
                category: $('edit-expense-category').value
            };
            saveExpenses();
            renderExpenses();
            closeExpenseModal();
        }
    });

    // Month Navigation
    $('prev-month-btn')?.addEventListener('click', () => {
        displayDate.setMonth(displayDate.getMonth() - 1);
        updateMonthDisplay();
        renderExpenses();
    });

    $('next-month-btn')?.addEventListener('click', () => {
        displayDate.setMonth(displayDate.getMonth() + 1);
        updateMonthDisplay();
        renderExpenses();
    });

    // Escape Key Modal Listener
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (!$('expanded-ledger-modal')?.classList.contains('hidden')) {
                toggleLedgerFullscreen();
            }
            closeExpenseModal();
        }
    });
}

// --- PERSISTENCE ---
function saveExpenses() {
    localStorage.setItem('local_expenses_data', JSON.stringify(globalExpensesCache));
}

function loadExpenses() {
    const raw = localStorage.getItem('local_expenses_data');
    if (raw) {
        try {
            globalExpensesCache = JSON.parse(raw);
        } catch (e) {
            globalExpensesCache = [];
        }
    } else {
        // Mock Sample Data
        globalExpensesCache = [
            { id: '1', description: 'muji notebook', amount: 8.50, date: `${displayDate.getFullYear()}-${String(displayDate.getMonth() + 1).padStart(2, '0')}-02`, category: 'shopping' },
            { id: '2', description: 'iced matcha latte', amount: 6.80, date: `${displayDate.getFullYear()}-${String(displayDate.getMonth() + 1).padStart(2, '0')}-05`, category: 'food & drink' },
            { id: '3', description: 'mrt transport', amount: 3.20, date: `${displayDate.getFullYear()}-${String(displayDate.getMonth() + 1).padStart(2, '0')}-08`, category: 'transport' }
        ];
        saveExpenses();
    }
    renderExpenses();
}

// --- RENDER MONTHLY BREAKDOWN (ALL CATEGORIES WITH EXPENSES) ---
function renderExpenses() {
    const stats = $('expense-visual-stats');
    if (!stats) return;

    stats.innerHTML = '';

    let totals = {}, totalAll = 0;
    Object.keys(CATEGORY_MAP).forEach(k => totals[k] = 0);
    const prefix = `${displayDate.getFullYear()}-${String(displayDate.getMonth() + 1).padStart(2, '0')}`;
    const active = globalExpensesCache.filter(e => e.date?.startsWith(prefix));

    active.forEach(e => {
        const a = parseFloat(e.amount);
        totalAll += a;
        if (totals[e.category] !== undefined) totals[e.category] += a;
    });

    let hasEntries = false;

    // Render progress bars for ALL categories with expenses
    Object.entries(totals).forEach(([cat, sum]) => {
        if (!sum) return; // Skip categories with $0.00
        hasEntries = true;
        const pct = totalAll ? (sum / totalAll) * 100 : 0;
        const meta = CATEGORY_MAP[cat] || { emoji: '📦', barColor: 'bg-gray-300' };

        stats.appendChild(Object.assign(document.createElement('div'), {
            className: "text-xs lowercase",
            innerHTML: `<div class="flex justify-between font-semibold text-gray-600 items-center mb-1">
                <span class="font-bold text-gray-700">${meta.emoji} ${cat}</span>
                <span class="font-bold text-gray-500">$${sum.toFixed(2)} (${Math.round(pct)}%)</span>
            </div>
            <div class="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                <div class="${meta.barColor} h-full transition-all duration-300" style="width: ${pct}%"></div>
            </div>`
        }));
    });

    if (!hasEntries) {
        stats.innerHTML = `<div class="text-xs text-gray-400 lowercase text-center py-4">no expense data for this month</div>`;
    }

    // Sync expanded ledger modal if open
    if (!$('expanded-ledger-modal')?.classList.contains('hidden')) {
        renderExpandedLedger();
    }
}

// --- FULLSCREEN EXPANDED LEDGER MODAL LOGIC ---
window.toggleLedgerFullscreen = function() {
    const modal = $('expanded-ledger-modal');
    if (!modal) return;

    const isHidden = modal.classList.contains('hidden');
    if (isHidden) {
        modal.classList.remove('hidden');
        renderExpandedLedger();
    } else {
        modal.classList.add('hidden');
    }
};

function renderExpandedLedger() {
    const tableContainer = $('expanded-table-container');
    const statsContainer = $('expanded-visual-stats');
    const monthLabel = $('expanded-month-label');
    if (!tableContainer || !statsContainer) return;

    const monthNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
    if (monthLabel) monthLabel.textContent = `${monthNames[displayDate.getMonth()]} ${displayDate.getFullYear()}`;

    const prefix = `${displayDate.getFullYear()}-${String(displayDate.getMonth() + 1).padStart(2, '0')}`;
    const active = globalExpensesCache.filter(e => e.date?.startsWith(prefix));

    // Clone monthly stats into modal sidebar
    statsContainer.innerHTML = $('expense-visual-stats')?.innerHTML || '';

    // Render Table (dd/mm/yyyy date formatting)
    let tableHtml = `<table class="w-full text-left border-collapse text-xs lowercase relative">
        <thead>
            <tr class="bg-gray-50 sticky top-0 border-b border-gray-100 font-bold text-gray-400 tracking-wider z-10">
                <th class="p-3.5 w-28 pl-5">date</th>
                <th class="p-3.5 w-40">category</th>
                <th class="p-3.5">description</th>
                <th class="p-3.5 w-32 text-right pr-6">amount</th>
            </tr>
        </thead>
        <tbody class="divide-y divide-gray-50 font-semibold text-gray-600">`;

    if (active.length === 0) {
        tableHtml += `<tr><td colspan="4" class="p-8 text-center text-gray-400">no transactions found for this month</td></tr>`;
    } else {
        active.forEach(exp => {
            const meta = CATEGORY_MAP[exp.category] || { emoji: '💰', badgeColor: 'bg-gray-100 text-gray-800' };
            const [y, m, d] = exp.date.split('-');
            tableHtml += `<tr onclick="window.openExpenseModal('${exp.id}')" class="hover:bg-purple-50/40 transition-colors group cursor-pointer">
                <td class="p-3.5 pl-5 text-gray-400 font-mono font-medium">${d}/${m}/${y}</td>
                <td class="p-3.5"><span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl ${meta.badgeColor} text-[11px] font-bold">${meta.emoji} ${exp.category}</span></td>
                <td class="p-3.5 font-bold text-gray-700">${exp.description}</td>
                <td class="p-3.5 text-right pr-5 font-extrabold text-gray-800">
                    <div class="flex items-center justify-end gap-2">
                        <span>-$${parseFloat(exp.amount).toFixed(2)}</span>
                        <button onclick="event.stopPropagation(); window.deleteExpense('${exp.id}')" class="text-gray-300 hover:text-rose-500 font-bold p-1 cursor-pointer transition-colors opacity-0 group-hover:opacity-100">✕</button>
                    </div>
                </td>
            </tr>`;
        });
    }

    tableHtml += `</tbody></table>`;
    tableContainer.innerHTML = tableHtml;
}

// --- ACTIONS & MODAL UTILS ---
window.deleteExpense = function(id) {
    globalExpensesCache = globalExpensesCache.filter(e => e.id !== id);
    saveExpenses();
    renderExpenses();
};

window.openExpenseModal = function(id) {
    const exp = globalExpensesCache.find(e => e.id === id);
    if (!exp) return;

    $('edit-expense-id').value = exp.id;
    $('edit-expense-desc').value = exp.description;
    $('edit-expense-amount').value = exp.amount;
    $('edit-expense-date').value = exp.date;
    $('edit-expense-category').value = exp.category;

    $('edit-expense-modal').classList.remove('hidden');
};

window.closeExpenseModal = function() {
    $('edit-expense-modal')?.classList.add('hidden');
};
