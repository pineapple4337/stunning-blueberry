import { APP_CONFIG, CATEGORY_MAP } from './config.js';

// Initialize Supabase Client
const supabase = window.supabase.createClient(APP_CONFIG.SUPABASE_URL, APP_CONFIG.SUPABASE_ANON_KEY);

const $ = (id) => document.getElementById(id);

let globalExpensesCache = [];
let displayDate = new Date();

document.addEventListener('DOMContentLoaded', () => {
    initDefaultDate();
    setupEventListeners();
    fetchExpensesFromSupabase();
});

function initDefaultDate() {
    const today = new Date().toISOString().split('T')[0];
    if ($('expense-date')) $('expense-date').value = today;
    updateMonthDisplay();
}

function updateMonthDisplay() {
    const monthNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
    const monthText = `${monthNames[displayDate.getMonth()]} ${displayDate.getFullYear()}`;
    if ($('current-month-display')) $('current-month-display').textContent = monthText;
    if ($('ledger-month-badge')) $('ledger-month-badge').textContent = monthText;
}

// --- SUPABASE DATA FETCHING ---
async function fetchExpensesFromSupabase() {
    try {
        const { data, error } = await supabase
            .from('expenses')
            .select('*')
            .order('date', { ascending: false });

        if (error) throw error;

        globalExpensesCache = data || [];
        renderExpenses();
    } catch (err) {
        console.error("error fetching expenses from supabase:", err.message);
    }
}

// --- EVENT LISTENERS ---
function setupEventListeners() {
    // Single Entry Submit
    $('expense-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const description = $('expense-desc').value.trim().toLowerCase();
        const amount = parseFloat($('expense-amount').value);
        const date = $('expense-date').value;
        const category = $('expense-category').value.toLowerCase();

        try {
            const { error } = await supabase
                .from('expenses')
                .insert([{ description, amount, date, category }]);

            if (error) throw error;

            $('expense-form').reset();
            initDefaultDate();
            await fetchExpensesFromSupabase();
        } catch (err) {
            console.error('failed to add expense:', err.message);
        }
    });

    // Piped Input Import Handler
    $('toggle-pipe-btn')?.addEventListener('click', () => {
        const container = $('piped-input-container');
        if (container) container.classList.toggle('hidden');
    });

    $('import-piped-btn')?.addEventListener('click', async () => {
        const text = $('piped-text-input')?.value.trim();
        if (!text) return;

        const parsedEntries = parsePipedResponses(text);
        if (parsedEntries.length === 0) {
            alert('no valid entries parsed. check the piped format!');
            return;
        }

        try {
            const { error } = await supabase.from('expenses').insert(parsedEntries);
            if (error) throw error;

            $('piped-text-input').value = '';
            $('piped-input-container').classList.add('hidden');
            await fetchExpensesFromSupabase();
        } catch (err) {
            console.error('failed to insert piped expenses:', err.message);
        }
    });

    // Edit Form Submit
    $('edit-expense-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = $('edit-expense-id').value;
        const description = $('edit-expense-desc').value.trim().toLowerCase();
        const amount = parseFloat($('edit-expense-amount').value);
        const date = $('edit-expense-date').value;
        const category = $('edit-expense-category').value.toLowerCase();

        try {
            const { error } = await supabase
                .from('expenses')
                .update({ description, amount, date, category })
                .eq('id', id);

            if (error) throw error;

            closeExpenseModal();
            await fetchExpensesFromSupabase();
        } catch (err) {
            console.error('failed to update expense:', err.message);
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

    // Modal Close Listeners
    $('close-edit-modal-btn')?.addEventListener('click', closeExpenseModal);
    $('cancel-edit-modal-btn')?.addEventListener('click', closeExpenseModal);
}

// --- PIPED RESPONSES PARSER ---
function parsePipedResponses(rawText) {
    const lines = rawText.split('\n');
    const entries = [];

    lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('| :---') || trimmed.startsWith('|-')) return;

        const parts = trimmed.split('|').map(p => p.trim()).filter(p => p !== '');
        if (parts.length < 3) return;

        // Skip headers if present
        if (parts[0].toLowerCase() === 'date' || parts[1].toLowerCase() === 'category') return;

        let [rawDate, category, amountStr, description] = parts;
        if (!description && parts.length === 3) {
            // Alternate ordering fallback
            description = category;
            category = 'other';
        }

        // Convert dd/mm/yyyy -> yyyy-mm-dd for Supabase
        let date = rawDate;
        if (rawDate.includes('/')) {
            const dateParts = rawDate.split('/');
            if (dateParts.length === 3) {
                const [d, m, y] = dateParts;
                date = `${y.padStart(4, '20')}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
            }
        }

        const amount = parseFloat(amountStr?.replace(/[^0-9.]/g, '')) || 0;
        let cleanCategory = (category || 'other').toLowerCase();

        // Standardize category if mapped
        if (!CATEGORY_MAP[cleanCategory]) {
            cleanCategory = 'other';
        }

        if (amount > 0 && date) {
            entries.push({
                date,
                category: cleanCategory,
                amount,
                description: (description || 'expense').toLowerCase()
            });
        }
    });

    return entries;
}

// --- RENDER FUNCTION FOR BREAKDOWN & INLINE LEDGER ---
function renderExpenses() {
    renderMonthlyBreakdown();
    renderInlineLedger();
}

function renderMonthlyBreakdown() {
    const stats = $('expense-visual-stats');
    if (!stats) return;

    stats.innerHTML = '';

    const prefix = `${displayDate.getFullYear()}-${String(displayDate.getMonth() + 1).padStart(2, '0')}`;
    const active = globalExpensesCache.filter(e => e.date?.startsWith(prefix));

    let totals = {};
    let totalAll = 0;

    active.forEach(e => {
        const amt = parseFloat(e.amount) || 0;
        const cat = (e.category || 'other').toLowerCase();
        totals[cat] = (totals[cat] || 0) + amt;
        totalAll += amt;
    });

    const categoriesWithExpenses = Object.entries(totals).filter(([_, sum]) => sum > 0);

    if (categoriesWithExpenses.length === 0) {
        stats.innerHTML = `<div class="text-xs text-gray-400 lowercase text-center py-4">no expense data for this month</div>`;
        return;
    }

    // Sort categories highest spending first
    categoriesWithExpenses.sort((a, b) => b[1] - a[1]);

    categoriesWithExpenses.forEach(([cat, sum]) => {
        const pct = totalAll > 0 ? (sum / totalAll) * 100 : 0;
        const meta = CATEGORY_MAP[cat] || CATEGORY_MAP['other'];

        const itemEl = document.createElement('div');
        itemEl.className = "text-xs lowercase space-y-1";
        itemEl.innerHTML = `
            <div class="flex justify-between font-semibold text-gray-600 items-center">
                <span class="font-bold text-gray-700 inline-flex items-center gap-1.5">
                    <span>${meta.emoji}</span>
                    <span>${cat}</span>
                </span>
                <span class="font-bold text-gray-500">$${sum.toFixed(2)} (${Math.round(pct)}%)</span>
            </div>
            <div class="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                <div class="${meta.barColor} h-full transition-all duration-500" style="width: ${pct}%"></div>
            </div>
        `;
        stats.appendChild(itemEl);
    });
}

function renderInlineLedger() {
    const container = $('inline-ledger-container');
    if (!container) return;

    const prefix = `${displayDate.getFullYear()}-${String(displayDate.getMonth() + 1).padStart(2, '0')}`;
    const active = globalExpensesCache.filter(e => e.date?.startsWith(prefix));

    let tableHtml = `<table class="w-full text-left border-collapse text-xs lowercase relative">
        <thead>
            <tr class="bg-gray-50/80 sticky top-0 border-b border-gray-100 font-bold text-gray-400 tracking-wider z-10 backdrop-blur-xs">
                <th class="p-3.5 w-28 pl-6">date</th>
                <th class="p-3.5 w-40">category</th>
                <th class="p-3.5">description</th>
                <th class="p-3.5 w-32 text-right pr-6">amount</th>
            </tr>
        </thead>
        <tbody class="divide-y divide-gray-50 font-semibold text-gray-600">`;

    if (active.length === 0) {
        tableHtml += `<tr><td colspan="4" class="p-12 text-center text-gray-400">no transactions logged for this month</td></tr>`;
    } else {
        active.forEach(exp => {
            const catKey = (exp.category || 'other').toLowerCase();
            const meta = CATEGORY_MAP[catKey] || CATEGORY_MAP['other'];
            
            let dateFormatted = exp.date;
            if (exp.date && exp.date.includes('-')) {
                const [y, m, d] = exp.date.split('-');
                dateFormatted = `${d}/${m}/${y}`;
            }

            tableHtml += `<tr onclick="window.openExpenseModal('${exp.id}')" class="hover:bg-purple-50/40 transition-colors group cursor-pointer">
                <td class="p-3.5 pl-6 text-gray-400 font-mono font-medium">${dateFormatted}</td>
                <td class="p-3.5"><span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl ${meta.badgeColor} text-[11px] font-bold">${meta.emoji} ${catKey}</span></td>
                <td class="p-3.5 font-bold text-gray-700">${exp.description}</td>
                <td class="p-3.5 text-right pr-6 font-extrabold text-gray-800">
                    <div class="flex items-center justify-end gap-2">
                        <span>-$${parseFloat(exp.amount).toFixed(2)}</span>
                        <button onclick="event.stopPropagation(); window.deleteExpense('${exp.id}')" class="text-gray-300 hover:text-rose-500 font-bold p-1 cursor-pointer transition-colors opacity-0 group-hover:opacity-100">✕</button>
                    </div>
                </td>
            </tr>`;
        });
    }

    tableHtml += `</tbody></table>`;
    container.innerHTML = tableHtml;
}

// --- MODALS & DELETION ---
window.deleteExpense = async function(id) {
    try {
        const { error } = await supabase
            .from('expenses')
            .delete()
            .eq('id', id);

        if (error) throw error;
        await fetchExpensesFromSupabase();
    } catch (err) {
        console.error('failed to delete expense:', err.message);
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

    $('edit-expense-modal')?.classList.remove('hidden');
};

window.closeExpenseModal = function() {
    $('edit-expense-modal')?.classList.add('hidden');
};
