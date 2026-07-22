import { APP_CONFIG, CATEGORY_MAP } from './config.js';

// --- SUPABASE CLIENT INITIALIZATION ---
const supabase = window.supabase?.createClient(APP_CONFIG.SUPABASE_URL, APP_CONFIG.SUPABASE_ANON_KEY);

// --- DOM HELPER ---
const $ = (id) => document.getElementById(id);

// --- GLOBAL STATE ---
let globalExpensesCache = [];
let displayDate = new Date();

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    initDefaultDate();
    setupEventListeners();
    fetchExpensesFromSupabase();
});

function initDefaultDate() {
    const today = new Date().toISOString().split('T')[0];
    if ($('expense-date'))$('expense-date').value = today;
    updateMonthDisplay();
}

function updateMonthDisplay() {
    const monthNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
    if ($('current-month-display')) {$('current-month-display').textContent = `${monthNames[displayDate.getMonth()]} ${displayDate.getFullYear()}`;
    }
}

// --- FETCH FROM SUPABASE ---
async function fetchExpensesFromSupabase() {
    if (!supabase) {
        console.error("Supabase client not initialized.");
        return;
    }

    try {
        const { data, error } = await supabase
            .from('expenses')
            .select('*')
            .order('date', { ascending: false });

        if (error) throw error;

        globalExpensesCache = data || [];
        renderExpenses();
    } catch (err) {
        console.error("Error fetching expenses from Supabase:", err.message);
    }
}

// --- EVENT LISTENERS ---
function setupEventListeners() {
    // Single Form Submit (Add Entry)
    $('expense-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newExpense = {
            description: $('expense-desc').value.toLowerCase(),
            amount: parseFloat($('expense-amount').value),
            date: $('expense-date').value,
            category: $('expense-category').value
        };

        try {
            const { data, error } = await supabase
                .from('expenses')
                .insert([newExpense])
                .select();

            if (error) throw error;

            if (data && data.length > 0) {
                globalExpensesCache.unshift(data[0]);
            }
            
            renderExpenses();
            $('expense-form').reset();
            initDefaultDate();
        } catch (err) {
            console.error("Failed to add expense:", err.message);
        }
    });

    // BULK JSON IMPORT LISTENER
    $('import-json-btn')?.addEventListener('click', async () => {
        let rawText = $('json-text-input')?.value?.trim();

        if (!rawText) {
            alert('please paste text into the box first!');
            return;
        }

        // Strip markdown code block wrappers if Gemini wraps response in ```json ... ```
        if (rawText.startsWith('```')) {
            rawText = rawText.replace(/^```(json)?/i, '').replace(/```$/, '').trim();
        }

        try {
            // Native 1-line JS parse
            const parsed = JSON.parse(rawText);

            if (!Array.isArray(parsed) || parsed.length === 0) {
                alert('json must be a non-empty list/array of items.');
                return;
            }

            // Clean & format fields
            const formattedEntries = parsed.map(item => {
                let date = item.date;

                // Convert DD/MM/YYYY to YYYY-MM-DD if necessary
                if (date && date.includes('/')) {
                    const [d, m, y] = date.split('/');
                    date = `${y.padStart(4, '20')}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
                }

                return {
                    date: date,
                    category: (item.category || 'other').toLowerCase().trim(),
                    amount: parseFloat(item.amount) || 0,
                    description: (item.description || 'expense').toLowerCase().trim()
                };
            });

            // Single batch insert into Supabase
            const { data, error } = await supabase
                .from('expenses')
                .insert(formattedEntries)
                .select();

            if (error) throw error;

            alert(`successfully imported ${formattedEntries.length} entries!`);
            $('json-text-input').value = '';
            
            // Refresh UI
            await fetchExpensesFromSupabase();

        } catch (err) {
            console.error("JSON import error:", err);
            alert(`could not parse json. make sure gemini's output matches the raw json array format.\n\nError: ${err.message}`);
        }
    });

    // Edit Form Submit
    $('edit-expense-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = $('edit-expense-id').value;
        const updatedFields = {
            description: $('edit-expense-desc').value.toLowerCase(),
            amount: parseFloat($('edit-expense-amount').value),
            date: $('edit-expense-date').value,
            category: $('edit-expense-category').value
        };

        try {
            const { error } = await supabase
                .from('expenses')
                .update(updatedFields)
                .eq('id', id);

            if (error) throw error;

            const index = globalExpensesCache.findIndex(e => e.id == id);
            if (index !== -1) {
                globalExpensesCache[index] = { ...globalExpensesCache[index], ...updatedFields };
            }

            renderExpenses();
            closeExpenseModal();
        } catch (err) {
            console.error("Failed to update expense:", err.message);
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

    // Transaction Ledger Modal Toggles
    $('open-ledger-btn')?.addEventListener('click', () => toggleLedgerFullscreen());
    $('close-ledger-btn')?.addEventListener('click', () => toggleLedgerFullscreen());
    $('expanded-ledger-modal')?.addEventListener('click', (e) => {
        if (e.target === $('expanded-ledger-modal')) toggleLedgerFullscreen();
    });

    // Edit Modal Toggles
    $('cancel-edit-modal-btn')?.addEventListener('click', () => closeExpenseModal());

    // Escape Key Listener
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (!$('expanded-ledger-modal')?.classList.contains('hidden')) {
                toggleLedgerFullscreen();
            }
            closeExpenseModal();
        }
    });
}

// --- RENDER MONTHLY BREAKDOWN ---
function renderExpenses() {
    const stats = $('expense-visual-stats');
    if (!stats) return;

    stats.innerHTML = '';

    let totals = {}, totalAll = 0;
    
    // Build initial category map
    const activeCatMap = CATEGORY_MAP || {
        'food & drink': { emoji: '🍔', barColor: 'bg-rose-300', badgeColor: 'bg-rose-100 text-rose-800' },
        'shopping': { emoji: '🛍️', barColor: 'bg-pink-300', badgeColor: 'bg-amber-100 text-amber-800' },
        'subscriptions': { emoji: '📺', barColor: 'bg-purple-300', badgeColor: 'bg-purple-100 text-purple-800' },
        'events': { emoji: '🎟️', barColor: 'bg-indigo-300', badgeColor: 'bg-indigo-100 text-indigo-800' },
        'fees': { emoji: '💵', barColor: 'bg-blue-300', badgeColor: 'bg-blue-100 text-blue-800' },
        'health': { emoji: '💊', barColor: 'bg-teal-300', badgeColor: 'bg-teal-100 text-teal-800' },
        'transport': { emoji: '🚌', barColor: 'bg-emerald-300', badgeColor: 'bg-emerald-100 text-emerald-800' },
        'utilities': { emoji: '⚡', barColor: 'bg-amber-300', badgeColor: 'bg-sky-100 text-sky-800' },
        'other': { emoji: '📦', barColor: 'bg-gray-300', badgeColor: 'bg-gray-100 text-gray-800' }
    };

    Object.keys(activeCatMap).forEach(k => totals[k] = 0);
    
    // Filter by selected month
    const prefix = `${displayDate.getFullYear()}-${String(displayDate.getMonth() + 1).padStart(2, '0')}`;
    const active = globalExpensesCache.filter(e => e.date?.startsWith(prefix));

    active.forEach(e => {
        const a = parseFloat(e.amount);
        totalAll += a;
        if (totals[e.category] !== undefined) {
            totals[e.category] += a;
        } else {
            totals['other'] = (totals['other'] || 0) + a;
        }
    });

    let hasEntries = false;

    // Render category stats
    Object.entries(totals).forEach(([cat, sum]) => {
        if (!sum) return;
        hasEntries = true;
        const pct = totalAll ? (sum / totalAll) * 100 : 0;
        const meta = activeCatMap[cat] || { emoji: '📦', barColor: 'bg-gray-300' };

        stats.appendChild(Object.assign(document.createElement('div'), {
            className: "text-xs lowercase",
            innerHTML: `<div class="flex justify-between font-semibold text-gray-600 items-center mb-1">
                <span class="font-bold text-gray-700">${meta.emoji || '📦'} ${cat}</span>
                <span class="font-bold text-gray-500">$${sum.toFixed(2)} (${Math.round(pct)}%)</span>
            </div>
            <div class="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                <div class="${meta.barColor || 'bg-purple-300'} h-full transition-all duration-300" style="width: ${pct}%"></div>
            </div>`
        }));
    });

    if (!hasEntries) {
        stats.innerHTML = `<div class="text-xs text-gray-400 lowercase text-center py-4">no expense data for this month</div>`;
    }

    if (!$('expanded-ledger-modal')?.classList.contains('hidden')) {
        renderExpandedLedger();
    }
}

// --- FULLSCREEN EXPANDED LEDGER MODAL ---
function toggleLedgerFullscreen() {
    const modal = $('expanded-ledger-modal');
    if (!modal) return;

    const isHidden = modal.classList.contains('hidden');
    if (isHidden) {
        modal.classList.remove('hidden');
        renderExpandedLedger();
    } else {
        modal.classList.add('hidden');
    }
}
window.toggleLedgerFullscreen = toggleLedgerFullscreen;

function renderExpandedLedger() {
    const tableContainer = $('expanded-table-container');
    const statsContainer = $('expanded-visual-stats');
    const monthLabel = $('expanded-month-label');
    if (!tableContainer || !statsContainer) return;

    const monthNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
    if (monthLabel) monthLabel.textContent = `${monthNames[displayDate.getMonth()]} ${displayDate.getFullYear()}`;

    const prefix = `${displayDate.getFullYear()}-${String(displayDate.getMonth() + 1).padStart(2, '0')}`;
    const active = globalExpensesCache.filter(e => e.date?.startsWith(prefix));

    statsContainer.innerHTML = $('expense-visual-stats')?.innerHTML || '';

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
            const catKey = (exp.category || 'other').toLowerCase();
            const meta = (CATEGORY_MAP && CATEGORY_MAP[catKey]) || { emoji: '📦', badgeColor: 'bg-gray-100 text-gray-800' };
            const badgeClass = meta.badgeColor || 'bg-gray-100 text-gray-800';

            const dateParts = exp.date ? exp.date.split('-') : ['2026', '01', '01'];
            const [y, m, d] = dateParts.length === 3 ? dateParts : ['2026', '01', '01'];

            tableHtml += `<tr onclick="window.openExpenseModal('${exp.id}')" class="hover:bg-purple-50/40 transition-colors group cursor-pointer">
                <td class="p-3.5 pl-5 text-gray-400 font-mono font-medium">${d}/${m}/${y}</td>
                <td class="p-3.5"><span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl ${badgeClass} text-[11px] font-bold">${meta.emoji || '📦'} ${exp.category}</span></td>
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
window.deleteExpense = async function(id) {
    try {
        const { error } = await supabase
            .from('expenses')
            .delete()
            .eq('id', id);

        if (error) throw error;

        globalExpensesCache = globalExpensesCache.filter(e => e.id != id);
        renderExpenses();
    } catch (err) {
        console.error("Failed to delete expense:", err.message);
    }
};

window.openExpenseModal = function(id) {
    const exp = globalExpensesCache.find(e => e.id == id);
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
