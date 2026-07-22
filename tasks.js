import { APP_CONFIG } from './config.js';

// Initialize Supabase Client
const supabase = window.supabase.createClient(APP_CONFIG.SUPABASE_URL, APP_CONFIG.SUPABASE_ANON_KEY);

const $ = (id) => document.getElementById(id);

document.addEventListener('DOMContentLoaded', () => {
    fetchTasks();
    setupEventListeners();
});

function setupEventListeners() {
    $('task-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = $('task-input');
        const title = input.value.trim().toLowerCase();

        if (!title) return;

        try {
            const { error } = await supabase
                .from('todos')
                .insert([{ title, is_complete: false }]);

            if (error) throw error;

            input.value = '';
            fetchTasks();
        } catch (err) {
            console.error('failed to add task:', err.message);
        }
    });
}

async function fetchTasks() {
    const list = $('task-list');
    if (!list) return;

    try {
        const { data: todos, error } = await supabase
            .from('todos')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!todos || todos.length === 0) {
            list.innerHTML = `<li class="py-4 text-center text-xs text-gray-400 lowercase">no pending tasks</li>`;
            return;
        }

        list.innerHTML = todos.map(todo => {
            const dateObj = new Date(todo.created_at || Date.now());
            const formattedDate = `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()}`;

            return `
                <li class="py-3 flex items-center justify-between gap-3 group">
                    <div class="flex items-center gap-3">
                        <input type="checkbox" ${todo.is_complete ? 'checked' : ''} 
                            onchange="window.toggleTask('${todo.id}', ${!todo.is_complete})"
                            class="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer">
                        <span class="text-xs font-semibold lowercase ${todo.is_complete ? 'line-through text-gray-300' : 'text-gray-700'}">
                            ${todo.title}
                        </span>
                    </div>
                    <div class="flex items-center gap-3">
                        <span class="text-[10px] text-gray-400 font-mono">${formattedDate}</span>
                        <button onclick="window.deleteTask('${todo.id}')" class="text-gray-300 hover:text-rose-500 text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                            ✕
                        </button>
                    </div>
                </li>
            `;
        }).join('');

    } catch (err) {
        console.error('failed to fetch tasks:', err.message);
        list.innerHTML = `<li class="py-4 text-center text-xs text-rose-400 lowercase">error loading tasks</li>`;
    }
}

window.toggleTask = async function(id, is_complete) {
    try {
        const { error } = await supabase
            .from('todos')
            .update({ is_complete })
            .eq('id', id);

        if (error) throw error;
        fetchTasks();
    } catch (err) {
        console.error('failed to update task:', err.message);
    }
};

window.deleteTask = async function(id) {
    try {
        const { error } = await supabase
            .from('todos')
            .delete()
            .eq('id', id);

        if (error) throw error;
        fetchTasks();
    } catch (err) {
        console.error('failed to delete task:', err.message);
    }
};
