# Renginiai – pilna minimali versija

Node.js (admin sritis) + statinis HTML/CSS/Bootstrap (vieša sritis). JWT autentifikacija, registracija, kategorijos, renginiai su patvirtinimu/blokavimu, filtrai ir įvertinimas.

## Paleidimas
Windows PowerShell (be ExecutionPolicy kliūčių):
```powershell
cd C:\Users\pytka\Desktop\projektas1
npm.cmd install
node server.js
```
Atidarykite: http://localhost:3000

## Demo paskyros
- pijusadmin@example.com / admin123 (admin)
- pijususer@example.com / user123 (user)

## Reikalavimų atitikimas (santrauka)
- Admin sritis (NodeJS, tik autentifikuoti):
  - Patvirtinti renginį, blokuoti netinkamą turinį, kurti kategorijas – `/admin` UI
  - REST API: `POST /api/events/:id/approve`, `POST /api/events/:id/block`, `POST /api/categories`, `DELETE /api/categories/:id`
- Vartotojai:
  - Registracija `POST /api/register` (slaptažodis saugomas `bcrypt` hash)
  - Prisijungimas `POST /api/login` → JWT httpOnly slapukas
  - Kurti/redaguoti/šalinti savo renginius: `POST/PUT/DELETE /api/events/:id` (+ UI skiltyje „Mano renginiai“)
- Vieša sritis (HTML/CSS/Bootstrap, SPA be perkrovimo):
  - Filtrai pagal kategoriją ir laiką: `GET /api/events?categoryId&from&to`
  - Renginio įvertinimas: `POST /api/events/:id/rate` (kortelėje ⭐)

## API
Auth: `POST /api/register`, `POST /api/login`, `GET /api/me`, `POST /api/logout`
Kategorijos: `GET /api/categories`, `POST /api/categories` (admin), `DELETE /api/categories/:id` (admin)
Renginiai: `GET /api/events`, `GET /api/my/events` (auth), `POST /api/events` (auth), `PUT/DELETE /api/events/:id` (owner/admin), `POST /api/events/:id/approve` (admin), `POST /api/events/:id/block` (admin), `POST /api/events/:id/rate`

## Pastabos
- PORT nustatomas `PORT` env, JWT raktas `JWT_SECRET` (numatytasis `dev_secret_change_me`).
- Duomenys saugomi JSON failuose `data/` (paprastumui).
- Seed’inimas: demo vartotojai sukuriami tik jei `data/users.json` nėra arba jis tuščias. `data/` aplankas ir kiti JSON failai sukuriami automatiškai, jei trūksta.
