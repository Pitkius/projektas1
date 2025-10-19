const path = require('path');
const fs = require('fs');
const express = require('express');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

const dataDir = path.join(__dirname, 'data');
const usersPath = path.join(dataDir, 'users.json');
const categoriesPath = path.join(dataDir, 'categories.json');
const eventsPath = path.join(dataDir, 'events.json');

function readJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return []; } }
function writeJson(p, data) { fs.writeFileSync(p, JSON.stringify(data, null, 2)); }
function nextId(items) { return items.length ? Math.max(...items.map(i => i.id)) + 1 : 1; }

// Ensure data directory and files exist; seed demo users only if users file is missing or empty
(function ensureData(){
	if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
	if (!fs.existsSync(categoriesPath)) writeJson(categoriesPath, []);
	if (!fs.existsSync(eventsPath)) writeJson(eventsPath, []);

	let users = [];
	let shouldSeed = false;
	if (!fs.existsSync(usersPath)) { shouldSeed = true; }
	else { users = readJson(usersPath); if (!Array.isArray(users) || users.length === 0) shouldSeed = true; }

	if (shouldSeed) {
		users = [];
		const adminHash = bcrypt.hashSync('admin123', 10);
		const userHash = bcrypt.hashSync('user123', 10);
		users.push({ id: nextId(users), email: 'pijusadmin@example.com', passwordHash: adminHash, role: 'admin' });
		users.push({ id: nextId(users), email: 'pijususer@example.com', passwordHash: userHash, role: 'user' });
		writeJson(usersPath, users);
		console.log('Demo users created: pijusadmin@example.com/admin123, pijususer@example.com/user123');
	}
})();

app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

function requireAuth(req, res, next) {
	const token = req.cookies.token;
	if (!token) return res.status(401).json({ message: 'Neautorizuota' });
	try { req.user = jwt.verify(token, JWT_SECRET); return next(); } catch { return res.status(401).json({ message: 'Neautorizuota' }); }
}
function requireAdmin(req, res, next) { if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Reikalingas admin' }); next(); }

// Registration
app.post('/api/register', async (req, res) => {
	const { email, password } = req.body || {};
	if (!email || !password) return res.status(400).json({ message: 'Trūksta duomenų' });
	const users = readJson(usersPath);
	if (users.find(u => u.email === email)) return res.status(409).json({ message: 'Vartotojas jau yra' });
	const passwordHash = await bcrypt.hash(password, 10);
	const user = { id: nextId(users), email, passwordHash, role: 'user' };
	users.push(user);
	writeJson(usersPath, users);
	res.json({ ok: true });
});

// Login
app.post('/api/login', async (req, res) => {
	const { email, password } = req.body || {};
	const users = readJson(usersPath);
	const found = users.find(u => u.email === email);
	if (!found) return res.status(401).json({ message: 'Neteisingi prisijungimo duomenys' });
	let ok = false;
	if (found.passwordHash) ok = await bcrypt.compare(password, found.passwordHash).catch(() => false);
	if (!ok && found.password) ok = found.password === password;
	if (!ok) return res.status(401).json({ message: 'Neteisingi prisijungimo duomenys' });
	const token = jwt.sign({ sub: found.id, email: found.email, role: found.role }, JWT_SECRET, { expiresIn: '2h' });
	res.cookie('token', token, { httpOnly: true, sameSite: 'lax' });
	res.json({ ok: true });
});

app.get('/api/me', requireAuth, (req, res) => { res.json({ id: req.user.sub, email: req.user.email, role: req.user.role }); });
app.post('/api/logout', (req, res) => { res.clearCookie('token'); res.json({ ok: true }); });

// Categories
app.get('/api/categories', (req, res) => { res.json(readJson(categoriesPath)); });
app.post('/api/categories', requireAuth, requireAdmin, (req, res) => {
	const { name } = req.body || {};
	if (!name) return res.status(400).json({ message: 'Reikia pavadinimo' });
	const cats = readJson(categoriesPath);
	const cat = { id: nextId(cats), name };
	cats.push(cat);
	writeJson(categoriesPath, cats);
	res.json(cat);
});
app.delete('/api/categories/:id', requireAuth, requireAdmin, (req, res) => {
	const id = Number(req.params.id);
	let cats = readJson(categoriesPath);
	cats = cats.filter(c => c.id !== id);
	writeJson(categoriesPath, cats);
	res.json({ ok: true });
});

// Events
app.get('/api/events', (req, res) => {
	const { categoryId, from, to, includeUnapproved, includeBlocked, mine } = req.query;
	let events = readJson(eventsPath);
	if (!includeBlocked) events = events.filter(e => !e.blocked);
	if (!includeUnapproved) events = events.filter(e => e.approved);
	if (categoryId) events = events.filter(e => String(e.categoryId) === String(categoryId));
	if (from) events = events.filter(e => new Date(e.time) >= new Date(from));
	if (to) events = events.filter(e => new Date(e.time) <= new Date(to));
	res.json(events);
});

app.get('/api/my/events', requireAuth, (req, res) => { let events = readJson(eventsPath).filter(e => e.ownerId === req.user.sub); res.json(events); });

app.post('/api/events', requireAuth, (req, res) => {
	const { title, categoryId, time, place, imageUrl } = req.body || {};
	if (!title || !categoryId || !time || !place) return res.status(400).json({ message: 'Trūksta laukų' });
	if (isNaN(new Date(time).getTime())) return res.status(400).json({ message: 'Neteisinga data/laikas' });
    const events = readJson(eventsPath);
    const isAdmin = req.user?.role === 'admin';
    const ev = { id: nextId(events), title, categoryId: Number(categoryId), time, place, imageUrl: imageUrl || '', approved: isAdmin ? true : false, blocked: false, ratings: 0, ownerId: req.user.sub };
	events.push(ev);
	writeJson(eventsPath, events);
	res.json(ev);
});

app.put('/api/events/:id', requireAuth, (req, res) => {
	const id = Number(req.params.id);
	const events = readJson(eventsPath);
	const idx = events.findIndex(e => e.id === id);
	if (idx === -1) return res.status(404).json({ message: 'Nerasta' });
	const ev = events[idx];
	if (req.user.role !== 'admin' && ev.ownerId !== req.user.sub) return res.status(403).json({ message: 'Draudžiama' });
	const { title, categoryId, time, place, imageUrl } = req.body || {};
	if (time && isNaN(new Date(time).getTime())) return res.status(400).json({ message: 'Neteisinga data/laikas' });
	Object.assign(ev, { title: title ?? ev.title, categoryId: categoryId ? Number(categoryId) : ev.categoryId, time: time ?? ev.time, place: place ?? ev.place, imageUrl: imageUrl ?? ev.imageUrl });
	writeJson(eventsPath, events);
	res.json(ev);
});

app.delete('/api/events/:id', requireAuth, (req, res) => {
	const id = Number(req.params.id);
	let events = readJson(eventsPath);
	const found = events.find(e => e.id === id);
	if (!found) return res.status(404).json({ message: 'Nerasta' });
	if (req.user.role !== 'admin' && found.ownerId !== req.user.sub) return res.status(403).json({ message: 'Draudžiama' });
	events = events.filter(e => e.id !== id);
	writeJson(eventsPath, events);
	res.json({ ok: true });
});

app.post('/api/events/:id/approve', requireAuth, requireAdmin, (req, res) => { const id = Number(req.params.id); const events = readJson(eventsPath); const ev = events.find(e => e.id === id); if (!ev) return res.status(404).json({ message: 'Nerasta' }); ev.approved = true; ev.blocked = false; writeJson(eventsPath, events); res.json({ ok: true }); });
app.post('/api/events/:id/block', requireAuth, requireAdmin, (req, res) => { const id = Number(req.params.id); const events = readJson(eventsPath); const ev = events.find(e => e.id === id); if (!ev) return res.status(404).json({ message: 'Nerasta' }); ev.blocked = true; ev.approved = false; writeJson(eventsPath, events); res.json({ ok: true }); });
app.post('/api/events/:id/rate', (req, res) => { const id = Number(req.params.id); const events = readJson(eventsPath); const ev = events.find(e => e.id === id && e.approved && !e.blocked); if (!ev) return res.status(404).json({ message: 'Nerasta' }); ev.ratings = (ev.ratings || 0) + 1; writeJson(eventsPath, events); res.json({ ratings: ev.ratings }); });

app.get('/admin', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'admin.html')); });

// 404 handler (after all routes)
app.use((req, res) => { res.status(404).json({ message: 'Nerasta' }); });

// Centralized error handler
// Only sends minimal message to client; logs full error on server
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ message: 'Serverio klaida' }); });

app.listen(PORT, () => { console.log(`Server is running on http://localhost:${PORT}`); });
