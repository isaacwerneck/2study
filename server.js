const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'database.json');

app.use(express.json());
app.use(express.static(__dirname));

async function readDatabase() {
  try {
    const raw = await fs.readFile(DB_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { users: {} };
    }
    throw error;
  }
}

async function writeDatabase(data) {
  await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function generateToken() {
  return crypto.randomBytes(24).toString('hex');
}

function getUserByToken(database, token) {
  if (!token) return null;
  return Object.entries(database.users).find(([, user]) => user.token === token);
}

function createTaskObject(data) {
  return {
    id: crypto.randomUUID(),
    title: data.title.trim(),
    category: data.category || 'General',
    notes: data.notes.trim(),
    image: data.image || '',
    completed: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const database = await readDatabase();
  const normalized = username.trim();

  if (database.users[normalized]) {
    return res.status(400).json({ error: 'That username is already taken.' });
  }

  const token = generateToken();
  database.users[normalized] = {
    password,
    token,
    tasks: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  database.currentUser = normalized;
  await writeDatabase(database);

  return res.json({ username: normalized, token, tasks: [] });
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const database = await readDatabase();
  const normalized = username.trim();
  const user = database.users[normalized];

  if (!user) {
    return res.status(400).json({ error: 'No account found with that username.' });
  }

  if (user.password !== password) {
    return res.status(400).json({ error: 'Password is incorrect.' });
  }

  const token = generateToken();
  user.token = token;
  user.updatedAt = Date.now();
  database.currentUser = normalized;
  await writeDatabase(database);

  return res.json({ username: normalized, token, tasks: user.tasks || [] });
});

app.post('/api/logout', async (req, res) => {
  const token = getBearerToken(req);
  const database = await readDatabase();
  const found = getUserByToken(database, token);

  if (found) {
    const [username, user] = found;
    delete user.token;
    database.currentUser = null;
    await writeDatabase(database);
  }

  return res.json({ success: true });
});

function getBearerToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const [, token] = authHeader.split(' ');
  return token;
}

async function authMiddleware(req, res, next) {
  const token = getBearerToken(req);
  const database = await readDatabase();
  const found = getUserByToken(database, token);
  if (!found) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const [username, user] = found;
  req.username = username;
  req.user = user;
  req.database = database;
  next();
}

app.get('/api/user', authMiddleware, async (req, res) => {
  return res.json({ username: req.username });
});

app.get('/api/tasks', authMiddleware, async (req, res) => {
  const tasks = Array.isArray(req.user.tasks) ? req.user.tasks : [];
  tasks.sort((a, b) => b.updatedAt - a.updatedAt);
  return res.json({ tasks });
});

app.post('/api/tasks', authMiddleware, async (req, res) => {
  const task = createTaskObject(req.body);
  req.user.tasks = req.user.tasks || [];
  req.user.tasks.unshift(task);
  req.user.updatedAt = Date.now();
  await writeDatabase(req.database);
  return res.json({ tasks: req.user.tasks });
});

app.put('/api/tasks/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const existing = (req.user.tasks || []).find(task => task.id === id);
  if (!existing) {
    return res.status(404).json({ error: 'Task not found' });
  }

  existing.title = req.body.title?.trim() || existing.title;
  existing.category = req.body.category || existing.category;
  existing.notes = req.body.notes || existing.notes;
  existing.image = req.body.image || existing.image;
  existing.completed = typeof req.body.completed === 'boolean' ? req.body.completed : existing.completed;
  existing.updatedAt = Date.now();

  req.user.updatedAt = Date.now();
  await writeDatabase(req.database);
  return res.json({ tasks: req.user.tasks });
});

app.delete('/api/tasks/:id', authMiddleware, async (req, res) => {
  req.user.tasks = (req.user.tasks || []).filter(task => task.id !== req.params.id);
  req.user.updatedAt = Date.now();
  await writeDatabase(req.database);
  return res.json({ tasks: req.user.tasks });
});

app.delete('/api/tasks', authMiddleware, async (req, res) => {
  if (req.query.completed !== 'true') {
    return res.status(400).json({ error: 'Missing completed=true query parameter' });
  }

  req.user.tasks = (req.user.tasks || []).filter(task => !task.completed);
  req.user.updatedAt = Date.now();
  await writeDatabase(req.database);
  return res.json({ tasks: req.user.tasks });
});

app.post('/api/tasks/restore-all', authMiddleware, async (req, res) => {
  req.user.tasks = (req.user.tasks || []).map(task => ({ ...task, completed: false, updatedAt: Date.now() }));
  req.user.updatedAt = Date.now();
  await writeDatabase(req.database);
  return res.json({ tasks: req.user.tasks });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'html.html'));
});

function startServer(port) {
  const server = app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });

  server.on('error', async (error) => {
    if (error.code === 'EADDRINUSE') {
      const fallbackPort = port + 1;
      console.warn(`Port ${port} is in use, trying ${fallbackPort}...`);
      startServer(fallbackPort);
      return;
    }
    console.error('Server error', error);
    process.exit(1);
  });
}

startServer(PORT);
