const loginContainer = document.getElementById('login-container');
const loginForm = document.getElementById('login-form');
const loginUsername = document.getElementById('login-username');
const loginPassword = document.getElementById('login-password');
const createAccountButton = document.getElementById('create-account');
const loginMessage = document.getElementById('login-message');
const appMessage = document.getElementById('app-message');
const appContainer = document.getElementById('app-container');
const logoutButton = document.getElementById('logout-button');
const userNameLabel = document.getElementById('user-name-label');
const userGreeting = document.getElementById('user-greeting');
const studyForm = document.getElementById('study-form');
const titleInput = document.getElementById('title');
const notesInput = document.getElementById('notes');
const categoryInput = document.getElementById('category');
const imageUrlInput = document.getElementById('imageUrl');
const imageFileInput = document.getElementById('imageFile');
const imagePreviewContainer = document.getElementById('image-preview-container');
const imagePreview = document.getElementById('image-preview');
const clearFormButton = document.getElementById('clear-form');
const activeList = document.getElementById('active-list');
const completedList = document.getElementById('completed-list');
const activeEmpty = document.getElementById('active-empty');
const completedEmpty = document.getElementById('completed-empty');
const activeCount = document.getElementById('active-count');
const completedCount = document.getElementById('completed-count');
const totalCount = document.getElementById('total-count');
const clearCompletedButton = document.getElementById('clear-completed');
const restoreAllButton = document.getElementById('restore-all');

let authToken = localStorage.getItem('studyAuthToken');
let currentUser = localStorage.getItem('studyUser') || '';
let tasks = [];
let editingTaskId = null;
let previewImage = '';

function fetchWithAuth(path, options = {}) {
    const headers = options.headers || {};
    if (options.body && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
    }

    if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
    }

    return fetch(path, { ...options, headers });
}

async function fetchJson(path, options = {}) {
    const response = await fetchWithAuth(path, options);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(body.error || 'API request failed');
    }
    return body;
}

function setAuthToken(token) {
    authToken = token;
    if (token) {
        localStorage.setItem('studyAuthToken', token);
    } else {
        localStorage.removeItem('studyAuthToken');
    }
}

function setCurrentUser(username) {
    currentUser = username || '';
    if (currentUser) {
        localStorage.setItem('studyUser', currentUser);
    } else {
        localStorage.removeItem('studyUser');
    }
}

function updateHeader(username) {
    const label = username || currentUser || 'Learner';
    if (userNameLabel) {
        userNameLabel.textContent = label;
    }
    if (userGreeting) {
        userGreeting.textContent = username ? `Welcome back, ${username}!` : '';
    }
    if (logoutButton) {
        logoutButton.classList.toggle('hidden', !username);
    }
}

function showLoginMessage(message) {
    loginMessage.textContent = message || '';
}

function showAppMessage(message) {
    if (appMessage) {
        appMessage.textContent = message || '';
    }
}

function showApp() {
    loginContainer.classList.add('hidden');
    appContainer.classList.remove('hidden');
}

function showLogin() {
    appContainer.classList.add('hidden');
    loginContainer.classList.remove('hidden');
    showLoginMessage('');
    showAppMessage('');
    loginForm.reset();
    resetForm();
}

function resetForm() {
    studyForm.reset();
    editingTaskId = null;
    previewImage = '';
    imagePreviewContainer.classList.add('hidden');
    imagePreview.src = '';
}

function getTaskPayload() {
    const title = titleInput.value.trim();
    const category = categoryInput.value;
    const notes = notesInput.value.trim();
    const image = previewImage || imageUrlInput.value.trim();
    return { title, category, notes, image };
}

function createTaskElement(task) {
    const card = document.createElement('article');
    card.className = `task-card${task.completed ? ' completed' : ''}`;

    const topRow = document.createElement('div');
    topRow.className = 'task-top';

    const titleBlock = document.createElement('div');
    titleBlock.className = 'task-title';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = task.completed;
    checkbox.addEventListener('change', () => toggleComplete(task.id));

    const titleText = document.createElement('div');
    titleText.innerHTML = `<h3>${escapeHtml(task.title)}</h3><div class="task-meta">${escapeHtml(task.category)} • ${new Date(task.updatedAt).toLocaleString()}</div>`;

    titleBlock.appendChild(checkbox);
    titleBlock.appendChild(titleText);

    const actions = document.createElement('div');
    actions.className = 'task-actions';

    const primaryButton = document.createElement('button');
    primaryButton.type = 'button';
    primaryButton.className = 'primary';
    primaryButton.textContent = task.completed ? 'Restore' : 'Complete';
    primaryButton.addEventListener('click', () => toggleComplete(task.id));

    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.className = 'secondary';
    editButton.textContent = 'Edit';
    editButton.addEventListener('click', () => editTask(task.id));

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'danger';
    deleteButton.textContent = 'Remove';
    deleteButton.addEventListener('click', () => removeTask(task.id));

    actions.append(primaryButton, editButton, deleteButton);
    topRow.append(titleBlock, actions);
    card.append(topRow);

    if (task.notes) {
        const notesPara = document.createElement('p');
        notesPara.className = 'task-description';
        notesPara.textContent = task.notes;
        card.append(notesPara);
    }

    if (task.image) {
        const preview = document.createElement('div');
        preview.className = 'task-preview';
        const image = document.createElement('img');
        image.src = task.image;
        image.alt = `Preview for ${task.title}`;
        preview.append(image);
        card.append(preview);
    }

    return card;
}

function renderTasks() {
    activeList.innerHTML = '';
    completedList.innerHTML = '';

    const activeTasks = tasks.filter(task => !task.completed).sort((a, b) => b.updatedAt - a.updatedAt);
    const completedTasks = tasks.filter(task => task.completed).sort((a, b) => b.updatedAt - a.updatedAt);

    activeEmpty.classList.toggle('hidden', activeTasks.length > 0);
    completedEmpty.classList.toggle('hidden', completedTasks.length > 0);

    activeTasks.forEach(task => activeList.append(createTaskElement(task)));
    completedTasks.forEach(task => completedList.append(createTaskElement(task)));

    activeCount.textContent = activeTasks.length;
    completedCount.textContent = completedTasks.length;
    totalCount.textContent = tasks.length;
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

async function loadTasks() {
    const result = await fetchJson('/api/tasks', { method: 'GET' });
    tasks = result.tasks || [];
    renderTasks();
}

async function addTask(payload) {
    const result = await fetchJson('/api/tasks', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
    tasks = result.tasks || [];
    renderTasks();
}

async function updateTask(task) {
    const result = await fetchJson(`/api/tasks/${task.id}`, {
        method: 'PUT',
        body: JSON.stringify(task),
    });
    tasks = result.tasks || [];
    renderTasks();
}

async function removeTask(id) {
    const result = await fetchJson(`/api/tasks/${id}`, { method: 'DELETE' });
    tasks = result.tasks || [];
    renderTasks();
}

async function clearCompletedTasks() {
    const result = await fetchJson('/api/tasks?completed=true', { method: 'DELETE' });
    tasks = result.tasks || [];
    renderTasks();
}

async function restoreAllCompleted() {
    const result = await fetchJson('/api/tasks/restore-all', { method: 'POST' });
    tasks = result.tasks || [];
    renderTasks();
}

async function toggleComplete(id) {
    const task = tasks.find(item => item.id === id);
    if (!task) return;
    await updateTask({ ...task, completed: !task.completed });
}

function editTask(id) {
    const task = tasks.find(item => item.id === id);
    if (!task) return;
    editingTaskId = id;
    titleInput.value = task.title;
    notesInput.value = task.notes;
    categoryInput.value = task.category || 'General';
    imageUrlInput.value = task.image || '';
    previewImage = task.image || '';
    if (previewImage) {
        imagePreview.src = previewImage;
        imagePreviewContainer.classList.remove('hidden');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function handleLoginSubmit(event) {
    event.preventDefault();
    showLoginMessage('');
    const username = loginUsername.value.trim();
    const password = loginPassword.value.trim();
    if (!username || !password) {
        showLoginMessage('Enter both username and password.');
        return;
    }
    try {
        const result = await fetchJson('/api/login', {
            method: 'POST',
            body: JSON.stringify({ username, password }),
        });
        setAuthToken(result.token);
        setCurrentUser(result.username);
        updateHeader(result.username);
        showApp();
        await loadTasks();
    } catch (error) {
        showLoginMessage(error.message);
    }
}

async function handleRegister() {
    showLoginMessage('');
    const username = loginUsername.value.trim();
    const password = loginPassword.value.trim();
    if (!username || !password) {
        showLoginMessage('Enter both username and password.');
        return;
    }
    try {
        const result = await fetchJson('/api/register', {
            method: 'POST',
            body: JSON.stringify({ username, password }),
        });
        setAuthToken(result.token);
        setCurrentUser(result.username);
        updateHeader(result.username);
        showApp();
        await loadTasks();
    } catch (error) {
        showLoginMessage(error.message);
    }
}

async function logout() {
    await fetchJson('/api/logout', { method: 'POST' }).catch(() => null);
    setAuthToken(null);
    setCurrentUser('');
    showLogin();
}

function updatePreview(source) {
    if (!source) {
        previewImage = '';
        imagePreview.src = '';
        imagePreviewContainer.classList.add('hidden');
        return;
    }
    imagePreview.src = source;
    imagePreviewContainer.classList.remove('hidden');
}

function handleImageUrlChange() {
    previewImage = imageUrlInput.value.trim();
    if (!previewImage) {
        updatePreview('');
        return;
    }
    updatePreview(previewImage);
}

function handleImageFileChange() {
    const file = imageFileInput.files && imageFileInput.files[0];
    if (!file) {
        return;
    }
    const reader = new FileReader();
    reader.onload = () => {
        previewImage = reader.result;
        updatePreview(previewImage);
    };
    reader.readAsDataURL(file);
}

async function init() {
    loginForm.addEventListener('submit', handleLoginSubmit);
    createAccountButton.addEventListener('click', handleRegister);
    studyForm.addEventListener('submit', async event => {
        event.preventDefault();
        const payload = getTaskPayload();
        if (!payload.title) {
            showLoginMessage('Add a title before saving a study item.');
            return;
        }
        try {
            if (editingTaskId) {
                await updateTask({ id: editingTaskId, ...payload, completed: tasks.find(item => item.id === editingTaskId)?.completed || false });
            } else {
                await addTask(payload);
            }
            resetForm();
            showLoginMessage('');
            showAppMessage('');
        } catch (error) {
            showAppMessage(error.message);
        }
    });
    imageUrlInput.addEventListener('input', handleImageUrlChange);
    imageFileInput.addEventListener('change', handleImageFileChange);
    clearFormButton.addEventListener('click', resetForm);
    clearCompletedButton.addEventListener('click', clearCompletedTasks);
    restoreAllButton.addEventListener('click', restoreAllCompleted);
    logoutButton.addEventListener('click', logout);

    if (authToken) {
        try {
            const profile = await fetchJson('/api/user', { method: 'GET' });
            setCurrentUser(profile.username);
            updateHeader(profile.username);
            showApp();
            await loadTasks();
        } catch (error) {
            setAuthToken(null);
            setCurrentUser('');
            showLogin();
        }
    } else {
        showLogin();
    }
}

document.addEventListener('DOMContentLoaded', init);
