# Biblio-IA — MVP Build Prompt for Gemini CLI

> **How to use this file:** Feed this document to Gemini CLI as your master prompt.
> Start each session with: `gemini -p @biblio-ia-master-prompt.md`
> Or paste it directly as the system context before giving task-level instructions.

---

## 🎯 Project Overview

You are building **Biblio-IA**, a full-stack library management web application with an integrated local AI assistant. The project must be delivered as a working MVP in **3 sprints (6 sessions × 2h = 12h total)**.

**Stack:**
- **Frontend:** React + TypeScript (Vite) with Tailwind CSS
- **Backend API:** FastAPI (Python 3.10+)
- **Database:** MySQL 8.0
- **LLM:** Mistral or Llama 3 (via Ollama, local — zero external data leakage)
- **Cache:** Redis 7 (for LLM request queuing)
- **Infra:** Docker + Docker Compose (single command deployment)
- **Auth:** JWT (access + refresh tokens), bcrypt password hashing

**Two user roles:**
- `bibliothécaire` (librarian) — full CRUD + admin dashboard + AI stock analysis
- `adhérent` (member/reader) — browse catalog, borrow, reserve, natural language search

---

## 📁 Target Project Structure

```
biblio-ia/
├── docker-compose.yml
├── .env.example
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py
│   ├── core/
│   │   ├── config.py            # pydantic settings from .env
│   │   ├── security.py          # JWT, bcrypt
│   │   └── database.py          # SQLAlchemy async engine + session
│   ├── models/
│   │   ├── user.py
│   │   ├── book.py
│   │   ├── loan.py
│   │   └── ai_analysis.py
│   ├── schemas/
│   │   ├── user.py
│   │   ├── book.py
│   │   └── loan.py
│   ├── routers/
│   │   ├── auth.py              # /api/auth/login, /api/auth/register
│   │   ├── books.py             # /api/books CRUD
│   │   ├── loans.py             # /api/loans
│   │   ├── members.py           # /api/members (librarian only)
│   │   └── ai.py                # /api/ai/summary, /api/ai/search, /api/ai/stock-analysis
│   ├── services/
│   │   ├── loan_service.py      # borrow/return logic, overdue detection
│   │   ├── llm_service.py       # Ollama HTTP client
│   │   └── queue_service.py     # Redis-based LLM request queue
│   └── seed/
│       └── seed_data.py         # 20+ sample books with realistic data
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── api/                 # axios clients per resource
│       ├── components/
│       │   ├── Navbar/
│       │   ├── BookCard/
│       │   ├── BookList/        # list view mode
│       │   └── AiSearchBox/
│       ├── pages/
│       │   ├── LoginPage.tsx
│       │   ├── SearchPage.tsx       # adhérent homepage
│       │   ├── CatalogPage.tsx      # book grid / list
│       │   ├── DashboardPage.tsx    # bibliothécaire only
│       │   ├── MembersPage.tsx      # bibliothécaire only
│       │   └── LoansPage.tsx        # bibliothécaire only
│       ├── store/               # Zustand auth store
│       └── types/               # TypeScript interfaces
└── nginx/
    └── nginx.conf
```

---

## 🗄️ Database Schema (MySQL)

Generate Alembic migrations for the following exact schema:

```sql
-- users
CREATE TABLE users (
  id            CHAR(36)      PRIMARY KEY DEFAULT (UUID()),
  username      VARCHAR(100)  UNIQUE NOT NULL,
  email         VARCHAR(255)  UNIQUE NOT NULL,
  password_hash VARCHAR(255)  NOT NULL,
  role          ENUM('adherent', 'bibliothecaire') DEFAULT 'adherent',
  est_bloque    BOOLEAN       DEFAULT FALSE,        -- auto-blocked if overdue > 15 days
  created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

-- books
CREATE TABLE books (
  id                CHAR(36)      PRIMARY KEY DEFAULT (UUID()),
  title             VARCHAR(255)  NOT NULL,
  author            VARCHAR(255)  NOT NULL,
  isbn              VARCHAR(20)   UNIQUE,
  publication_year  INT,
  category          VARCHAR(100),                    -- e.g. SF, Classique, Histoire, Psychologie
  resume_ia         TEXT,                            -- AI-generated summary (stored after first generation)
  cover_image_url   VARCHAR(500),                    -- optional cover image
  shelf_row         VARCHAR(10),                     -- e.g. "R. 4"
  shelf_number      VARCHAR(10),                     -- e.g. "Étagère B"
  quantity_total    INT           DEFAULT 1,
  quantity_available INT          DEFAULT 1,
  created_at        TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- loans
CREATE TABLE loans (
  id                CHAR(36)  PRIMARY KEY DEFAULT (UUID()),
  book_id           CHAR(36)  NOT NULL REFERENCES books(id),
  user_id           CHAR(36)  NOT NULL REFERENCES users(id),
  loan_date         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  due_date          TIMESTAMP NOT NULL,              -- loan_date + 14 days by default
  return_date       TIMESTAMP,                       -- NULL until returned
  status            ENUM('active', 'returned', 'overdue') DEFAULT 'active'
);

-- reservations
CREATE TABLE reservations (
  id                CHAR(36)  PRIMARY KEY DEFAULT (UUID()),
  book_id           CHAR(36)  NOT NULL REFERENCES books(id),
  user_id           CHAR(36)  NOT NULL REFERENCES users(id),
  reservation_date  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status            ENUM('pending', 'fulfilled', 'cancelled') DEFAULT 'pending'
);

-- ai_analyses (audit log for LLM calls)
CREATE TABLE ai_analyses (
  id            CHAR(36)  PRIMARY KEY DEFAULT (UUID()),
  analysis_type VARCHAR(100),                        -- e.g. "stock_analysis", "book_summary", "natural_search"
  input_data    JSON,
  output_data   JSON,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes to create:**
```sql
CREATE INDEX idx_books_title ON books(title);
CREATE INDEX idx_books_author ON books(author);
CREATE INDEX idx_books_category ON books(category);
CREATE INDEX idx_loans_user ON loans(user_id, status);
CREATE INDEX idx_loans_book ON loans(book_id, status);
```

---

## 🤖 AI Features (via Ollama — fully local)

All AI features call Ollama at `http://ollama:11434` using the `mistral` model (or `llama3` as fallback).

### A. Book Summary Generation
- Triggered when a librarian adds a new book (by title)
- Prompt: `"Génère un résumé de 10 lignes pour le livre intitulé '[TITLE]' de '[AUTHOR]'. Inclus les thèmes principaux, le style d'écriture et le public cible. Réponds uniquement avec le résumé, sans introduction."`
- Result stored in `books.resume_ia`
- Displayed on book cards as "RÉSUMÉ IA" with a robot icon

### B. Natural Language Search (Adhérent)
- User writes a free-text description of what they want to read
- Example: *"Un livre de survie en mer, inspirant et dramatique"*
- Backend sends the full book catalog (titles + categories + IA summaries) to the LLM
- Prompt: `"Voici une liste de livres disponibles dans notre catalogue: [CATALOG_JSON]. Un utilisateur cherche: '[USER_QUERY]'. Retourne UNIQUEMENT une liste JSON des IDs des livres les plus pertinents dans cet ordre de pertinence, format: {\"ids\": [\"id1\", \"id2\", ...]}. Maximum 5 résultats."`
- Backend then fetches those book IDs from MySQL and returns enriched results
- This is keyword-based semantic reasoning, NO vector DB needed

### C. Stock Analysis (Bibliothécaire Dashboard)
- Triggered by the librarian clicking "Analyser le stock" on their dashboard
- Backend fetches loan data for the last 6 months from MySQL
- Calculates rotation rate per book
- Sends aggregated stats to LLM
- Prompt: `"Voici les statistiques d'emprunts des 6 derniers mois de notre bibliothèque: [STATS_JSON]. Identifie: 1) Les livres en tension (taux de rotation > 90%) à racheter en priorité. 2) Les livres dormants (0 emprunts depuis 1 an) à désherber. Formule des recommandations concrètes et chiffrées. Réponds en français, de manière concise et professionnelle."`
- Response displayed on dashboard in the "Assistant IA : Analyse des stocks" widget

---

## 🎨 UI Design — Based on Mockups

The application has two distinct interfaces for each role:

### Adhérent Interface

**Page 1 — Search Page (Homepage after login)**
- Centered layout, clean white background
- Big title: **"Que voulez-vous lire aujourd'hui ?"**
- Subtitle: *"Utilisez la recherche classique ou laissez-vous guider par notre assistant."*
- **Classic search bar**: `Recherche classique (Titre, auteur, ISBN)` with a "Rechercher" button
- **Separator**: `— OU —`
- **AI search box** with a purple "NOUVEAU" badge:
  - Label: **"Assistant de recherche Intelligent"**
  - Textarea with wand icon: placeholder *"Décrivez votre envie (ex: Un livre de survie en mer, inspirant et dramatique...)"*
  - "Analyser mon besoin" button (indigo/purple)
- **Results section** below: "Résultats suggérés" with book count badge
- Nav bar: "Mon Profil" | "Mes Lectures" | blue "Déconnexion" button

**Page 2 — Catalog Page (Book list)**
- Nav: "Biblio-IA" logo (book icon) + "Catalogue Complet (X ouvrages)" + Avatar
- Title: **"Nos Ouvrages"**
- **View toggle**: grid icon | list icon (top right)
- **Grid view (3 columns)**: Large book cards with:
  - Cover image (or themed placeholder if no image)
  - Category badge (colored pill, top-right of image): SF/Fantastique = blue, Classique = purple, Histoire = orange, Psychologie = green, etc.
  - Book title (bold)
  - Author with "Par" prefix in grey
  - **"RÉSUMÉ IA"** section with robot icon, light blue background, 3-line truncated summary
  - **Location**: "R. 4, Étagère B" in grey (bottom left)
  - **"Emprunter"** button (blue) — if available
  - **"Retour le DD/MM"** + **"Réserver"** button (grey) — if borrowed
- **List view**: compact rows with title + ISBN only

### Bibliothécaire Interface

**Dashboard Page**
- Left sidebar (dark navy): "Biblio-IA" title at top, nav items: Dashboard (highlighted), Catalogue, Adhérents, Emprunts
- Main area header: "Tableau de bord" + "Connecté : Admin Bibliothécaire" (italic, top right)
- **3 KPI cards** in a row:
  - "Livres sortis" → **142** (blue left border)
  - "Retards critiques" → **12** (red number, red left border)
  - "Nouveaux adhérents" → **8** (green left border)
- **AI Analysis Widget** (bordered box with purple gradient border):
  - Header: robot icon + **"Assistant IA : Analyse des stocks"**
  - Text box (light grey background) with the LLM analysis in italic
  - **"Valider les suggestions"** button (indigo)

---

## 🚀 Sprint Plan

### Sprint 1 — Foundation (Sessions 1–2)
**Goal:** Docker stack running, auth working, full book CRUD, DB seeded.

**Task 1.1 — docker-compose.yml**
```
Generate a complete docker-compose.yml that starts:
- mysql:8.0 (port 3306, volume for persistence, MYSQL_DATABASE=biblioia)
- redis:7-alpine (port 6379, for LLM queue)
- ollama/ollama:latest (port 11434, volume ollama_data for model persistence)
- backend (build ./backend, port 8000, depends_on mysql + redis + ollama)
- frontend (build ./frontend, port 3000)
- nginx (port 80, reverse proxy: /api → backend:8000, / → frontend:3000)
Include healthcheck for mysql. All secrets via shared .env file.
All services: restart: unless-stopped
```

**Task 1.2 — FastAPI Backend Skeleton**
```
Generate the complete FastAPI backend:
- main.py: app factory, CORS (allow localhost:3000 and localhost:80), include all routers, lifespan event for DB table creation
- core/config.py: pydantic BaseSettings from .env (DATABASE_URL, REDIS_URL, OLLAMA_URL, JWT_SECRET, JWT_EXPIRE_MINUTES=30)
- core/database.py: async SQLAlchemy engine + AsyncSession + get_db dependency
- core/security.py: create_access_token(data, expires_delta), verify_token, get_current_user dependency, hash_password(pwd), verify_password(plain, hashed), require_role(role) dependency factory
- All SQLAlchemy models (users, books, loans, reservations, ai_analyses) matching the schema above
- Alembic setup with initial migration auto-generated from models
```

**Task 1.3 — Auth + Book CRUD Routers**
```
Generate routers with full Pydantic schemas:

routers/auth.py:
- POST /api/auth/register → creates adherent account
- POST /api/auth/login → returns {access_token, token_type, user: {id, username, email, role}}
- GET /api/auth/me → returns current user (requires auth)

routers/books.py:
- GET /api/books → list with filters: ?search=, ?category=, ?available=true/false, ?year=
- GET /api/books/{id} → single book detail
- POST /api/books → create (bibliothécaire only) — after creation, trigger async AI summary if resume_ia is empty
- PUT /api/books/{id} → update (bibliothécaire only)
- DELETE /api/books/{id} → soft delete via setting quantity_total=0 (bibliothécaire only)

routers/loans.py:
- POST /api/loans → create loan, decrements quantity_available, sets due_date = now + 14 days
- PUT /api/loans/{id}/return → sets return_date=now, status=returned, increments quantity_available. Also auto-updates book reservations.
- GET /api/loans/my → current user's active loans
- GET /api/loans → all loans (bibliothécaire only), with ?status= filter
- Background task: every hour, update loans where due_date < now and status=active to status=overdue. Also block users with overdue > 15 days.

routers/members.py (bibliothécaire only):
- GET /api/members → list all users with role=adherent
- GET /api/members/{id} → user detail + loan history
- PUT /api/members/{id}/unblock → set est_bloque=false
```

**Task 1.4 — Seed Script**
```
Generate backend/seed/seed_data.py that:
1. Creates 2 test users:
   - bibliothecaire@biblioia.fr / password: admin123 (role: bibliothecaire)
   - adherent@biblioia.fr / password: user123 (role: adherent)
2. Inserts 20 books covering these categories: SF/Fantastique, Classique, Histoire, Psychologie, Dystopie, Policier, Romance, Biographie
   Use real book titles and authors. Examples:
   - "Le Nom du Vent" by Patrick Rothfuss (SF/Fantastique)
   - "Germinal" by Émile Zola (Classique)
   - "Sapiens" by Yuval Noah Harari (Histoire)
   - "L'Étranger" by Albert Camus (Classique)
   - "1984" by George Orwell (Dystopie)
   - "Le Petit Prince" by Antoine de Saint-Exupéry (Jeunesse)
   - "Dune" by Frank Herbert (SF/Fantastique)
   - "Le Comte de Monte-Cristo" by Alexandre Dumas (Classique)
   Each book: isbn, publication_year, category, resume_ia (pre-written 3-4 sentence summary), shelf_row (R. 1–5), shelf_number (Étagère A/B/C), quantity_total=2, quantity_available=1 or 2
3. Creates 5 sample loans (some active, some returned, one overdue)
```

---

### Sprint 2 — AI Integration (Sessions 3–4)
**Goal:** All 3 AI features working end-to-end.

**Task 2.1 — LLM Service**
```
Generate services/llm_service.py:
- Async HTTP client using httpx to call Ollama at OLLAMA_URL
- async def generate_book_summary(title: str, author: str) -> str
  Calls POST /api/generate with model=mistral, stream=False
  Returns the generated summary text
- async def natural_language_search(user_query: str, catalog: list[dict]) -> list[str]
  Sends catalog as JSON to LLM, asks for ranked list of matching book IDs
  Parses the JSON response {"ids": [...]} and returns list of UUIDs
  Fallback: if JSON parse fails, returns empty list (graceful degradation)
- async def analyze_stock(stats: dict) -> str
  Sends loan statistics to LLM, returns analysis text
- All methods: timeout=60s, proper error handling, log errors without crashing
```

**Task 2.2 — Queue Service**
```
Generate services/queue_service.py using Redis:
- Simple rate limiter: max 1 concurrent LLM request
- async def enqueue_llm_task(task_fn, *args) -> result
  Uses Redis SETNX as a distributed lock with 120s TTL
  Queues the task if another is running, waits max 30s
- This prevents server saturation when multiple users trigger AI simultaneously
```

**Task 2.3 — AI Router**
```
Generate routers/ai.py:
- POST /api/ai/summary/{book_id}
  Triggers LLM summary generation for a specific book
  Saves result to books.resume_ia
  Returns {summary: str}
  bibliothécaire role required

- POST /api/ai/search
  Body: {query: str}
  1. Fetch all books from DB (id, title, author, category, resume_ia)
  2. Call llm_service.natural_language_search(query, catalog)
  3. Fetch matching books in order from DB
  4. Return enriched book list
  Available to all authenticated users

- GET /api/ai/stock-analysis
  bibliothécaire role required
  1. Query loans table: GROUP BY book_id, COUNT(*) for last 6 months
  2. Also find books with 0 loans in last 12 months
  3. Build stats dict, call llm_service.analyze_stock(stats)
  4. Save to ai_analyses table
  5. Return {analysis: str, generated_at: datetime}
```

---

### Sprint 3 — Frontend (Sessions 5–6)
**Goal:** Complete React UI matching the mockups, connected to backend.

**Task 3.1 — React App Setup**
```
Generate the Vite + React + TypeScript project:
- Dependencies: axios, react-router-dom v6, zustand, tailwindcss, lucide-react, @tanstack/react-query
- src/api/: axios instance with base URL from env + JWT interceptor
  - api/books.ts, api/auth.ts, api/loans.ts, api/ai.ts
- src/types/index.ts: TypeScript interfaces for Book, User, Loan, Reservation, AiAnalysis
- src/store/authStore.ts: zustand store {user, token, login(token, user), logout()}
- Tailwind config: custom colors:
  - primary: indigo (#4F46E5)
  - navy: #1a2332 (sidebar background)
  - light-bg: #f0f2f5 (page background)
- Global fonts: system font stack, clean and modern
```

**Task 3.2 — Login Page**
```
Generate src/pages/LoginPage.tsx:
- Clean centered card with "Biblio-IA" logo (book icon + text)
- Two tabs or toggle: "Connexion" / "Inscription"
- Login form: Email, Mot de passe, "Se connecter" button
- Register form: Prénom/Nom, Email, Mot de passe, "Créer un compte" button
- On login success: store token + user in zustand, redirect based on role:
  - bibliothécaire → /dashboard
  - adhérent → /recherche
- Error display: red alert box below form
- Light grey background, white card, subtle shadow
```

**Task 3.3 — Adhérent Search Page**
```
Generate src/pages/SearchPage.tsx (route: /recherche):
- Top navbar: "Biblio-IA" logo left, "Mon Profil" | "Mes Lectures" | "Déconnexion" right
- Centered content (max-width 700px):
  - H1: "Que voulez-vous lire aujourd'hui ?"
  - Subtitle in grey italic
  - Classic search section:
    - Label: "Recherche classique (Titre, auteur, ISBN)"
    - Input + "Rechercher" button (calls GET /api/books?search=...)
  - Divider: horizontal line with "OU" centered
  - AI search section (white card, subtle border):
    - "NOUVEAU" badge (indigo pill)
    - Bold title: "Assistant de recherche Intelligent"
    - Textarea with wand (Wand2) icon, placeholder text
    - "Analyser mon besoin" button (indigo, full width)
    - Loading spinner while waiting for AI response
  - Results section below:
    - "Résultats suggérés" title + "X ouvrages trouvés" count
    - Book cards grid (responsive: 1 col mobile, 2 col tablet, 3 col desktop)
```

**Task 3.4 — Catalog Page (Book Grid + List View)**
```
Generate src/pages/CatalogPage.tsx (route: /catalogue):
- Navbar with "Catalogue Complet (X ouvrages)" and user avatar circle
- "Nos Ouvrages" H1 with view toggle (grid/list icons) top-right

BookCard component (grid mode):
- Rounded card with subtle shadow, hover: slight lift
- Cover image area (aspect-ratio 3:2):
  - If cover_image_url: display it
  - Else: gradient background based on category (SF=dark blue, Classique=dark teal, Histoire=dark amber, etc.) with a book icon
- Category badge: colored pill, position absolute top-right of image
- Book title: bold, 2-line clamp
- Author: "Par [Name]" in grey
- AI Summary box: light blue background (#EEF2FF), robot icon (Bot from lucide), blue label "RÉSUMÉ IA", 3-line truncated text
- Footer: location (grey left) + action button (right):
  - If available: blue "Emprunter" button
  - If borrowed: red "Retour le DD/MM" text + grey "Réserver" button

BookList component (list mode):
- Compact table-like rows: ISBN | Title | Author | Category | Location | Status
- Striped rows, hover highlight

Category color mapping:
- SF/Fantastique: indigo
- Classique: purple
- Histoire: amber
- Psychologie: green
- Dystopie: red
- Jeunesse: pink
- Policier: slate
- Romance: rose
- Biographie: teal
```

**Task 3.5 — Bibliothécaire Dashboard**
```
Generate src/pages/DashboardPage.tsx (route: /dashboard):
Layout:
- Left sidebar (dark navy #1a2332, width 200px):
  - "Biblio-IA" white text top
  - Nav links: Dashboard (highlighted blue), Catalogue, Adhérents, Emprunts
  - White text, active = blue pill background
- Main content area (light grey background):
  - Header: "Tableau de bord" (H1) + "Connecté : [username]" italic top-right

KPI Cards Row (3 cards):
- White background, left colored border (4px), subtle shadow
- "Livres sortis" + count (blue border)
- "Retards critiques" + count in red (red border)
- "Nouveaux adhérents" + count (green border)
- Fetch real data: GET /api/loans?status=active, GET /api/loans?status=overdue, GET /api/members

AI Analysis Widget:
- White card with purple gradient border (2px, border-image or box-shadow trick)
- Header: Bot icon (purple) + "Assistant IA : Analyse des stocks" (bold)
- If analysis loaded: grey inner box, italic analysis text
- If not loaded: "Aucune analyse récente. Lancez une analyse pour obtenir des insights."
- "Analyser le stock" button (indigo) → calls GET /api/ai/stock-analysis, shows loading state
- "Valider les suggestions" button (indigo outline) → appears after analysis loads

Recent Loans Table below the widget:
- Columns: Adhérent | Livre | Date d'emprunt | Échéance | Statut
- Status badges: active=blue, overdue=red, returned=green
- Fetch from GET /api/loans (last 10)
```

**Task 3.6 — Members + Loans Pages + Route Guards**
```
Generate:

src/pages/MembersPage.tsx (route: /adherents, bibliothécaire only):
- Table of all members: Username | Email | Status | Active loans | Actions
- Status badge: "Actif" green or "Bloqué" red
- "Débloquer" button for blocked members (calls PUT /api/members/{id}/unblock)
- Click row → expand to show loan history

src/pages/LoansPage.tsx (route: /emprunts, bibliothécaire only):
- Tabs: "En cours" | "En retard" | "Historique"
- For each loan: Book title | Member | Loan date | Due date | Status
- "Marquer retourné" button on active/overdue loans

src/components/ProtectedRoute.tsx:
- If no token → redirect to /login
- If role mismatch → redirect to appropriate page

src/App.tsx routes:
  /login → LoginPage (public)
  /recherche → SearchPage (adhérent)
  /catalogue → CatalogPage (adhérent)
  /dashboard → DashboardPage (bibliothécaire)
  /adherents → MembersPage (bibliothécaire)
  /emprunts → LoansPage (bibliothécaire)
  / → redirect based on role
```

---

## ⚡ Performance Requirements

| Operation | Target | How |
|---|---|---|
| Classic book search | < 500ms | MySQL indexes on title, author, category |
| AI natural search | < 15s | Show loading spinner, async with queue |
| Stock analysis | < 30s | Background + loading state on button |
| CRUD operations | < 300ms | Async SQLAlchemy + connection pool |
| Page load | < 1s | Vite build + nginx gzip |
| LLM first token | < 10s | Mistral 7B quantized (Q4) |

---

## 🔒 Security Requirements

- Passwords hashed with **bcrypt** (cost factor 12)
- JWT tokens expire in **30 minutes**, refresh flow via re-login
- **Role-based guards**: bibliothécaire endpoints use `require_role("bibliothecaire")` dependency
- All DB queries via **SQLAlchemy ORM** — no raw string interpolation
- **CORS** restricted to frontend origin
- LLM runs **locally via Ollama** — zero external data leakage
- Blocked users (`est_bloque=True`) cannot borrow books — checked in loan creation endpoint

---

## 🧪 Acceptance Tests (MVP Checklist)

| ID | Test | Expected Result |
|---|---|---|
| T01 | `docker-compose up` | All 5 services healthy in < 3min |
| T02 | Ollama model pull | `mistral` model loaded, RAM < 8GB |
| T03 | LLM summary | Book summary generated in < 30s |
| T04 | DB persistence | Data survives `docker-compose restart` |
| F01 | Auth + roles | Bibliothécaire sees dashboard, adhérent sees search page |
| F02 | Borrow flow | quantity_available decreases by 1, loan appears in history |
| F03 | Return flow | quantity_available restored, reservation notified if any |
| F04 | Overdue auto-block | User with 15+ day overdue gets est_bloque=true |
| F05 | Classic search | Filter by title/author/ISBN returns correct results |
| F06 | AI search | Natural language query returns 1–5 relevant books |
| F07 | Stock analysis | AI generates recommendations text in < 30s |
| F08 | Grid/List toggle | Catalog switches between card and list view |
| F09 | Reservation flow | Reserved book becomes "Emprunter" when returned |

---

## 🐳 Ollama Setup in Docker

```yaml
ollama:
  image: ollama/ollama:latest
  ports:
    - "11434:11434"
  volumes:
    - ollama_data:/root/.ollama
  restart: unless-stopped
  # Optional GPU support — remove deploy section if no GPU:
  deploy:
    resources:
      reservations:
        devices:
          - driver: nvidia
            count: all
            capabilities: [gpu]
```

After first `docker-compose up`, pull the model:
```bash
docker exec -it biblio-ia-ollama-1 ollama pull mistral
```

For CPU-only machines, use a smaller model:
```bash
docker exec -it biblio-ia-ollama-1 ollama pull mistral:7b-instruct-q4_K_M
```

---

## 📋 Gemini CLI — Session-by-Session Instructions

### Session 1
```
Read biblio-ia-master-prompt.md fully.
Execute Task 1.1: generate docker-compose.yml and .env.example.
Execute Task 1.2: generate the FastAPI backend skeleton (models, config, security, database).
Do not proceed until I confirm the docker-compose and models look correct.
```

### Session 2
```
Execute Task 1.3: Auth router, Books CRUD router, Loans router, Members router with all Pydantic schemas.
Execute Task 1.4: seed script with 20 books and 2 test users.
Run: docker-compose up --build and confirm all services healthy.
Run: python seed/seed_data.py and confirm books visible via GET /api/books.
```

### Session 3
```
Execute Task 2.1: LLM service (summary, natural search, stock analysis).
Execute Task 2.2: Queue service with Redis rate limiting.
Test POST /api/ai/summary/{book_id} and confirm a summary is generated and saved.
```

### Session 4
```
Execute Task 2.3: AI router with all 3 endpoints.
Integration test: POST /api/ai/search with query "Un livre sombre et dystopique" — confirm relevant results.
Integration test: GET /api/ai/stock-analysis — confirm AI text response.
Fix any timeout or JSON parsing issues.
```

### Session 5
```
Execute Tasks 3.1, 3.2, 3.3, 3.4: React setup, Login page, Search page, Catalog page.
Connect to backend: verify login → token stored → catalog loaded correctly.
Test borrow button: confirm quantity decreases and button changes to "Réserver".
```

### Session 6
```
Execute Tasks 3.5, 3.6: Dashboard, Members page, Loans page, Route guards, App routing.
Run all acceptance tests from the MVP checklist.
Fix any failing tests. Verify role-based routing works (bibliothécaire vs adhérent).
Final: docker-compose up --build → full system working from login to AI analysis.
```

---

## 🧠 Important Constraints for Gemini

- Always generate **complete, runnable files** — no `# TODO`, no `pass`, no placeholders
- Use **async/await** throughout the FastAPI backend
- Every API endpoint must have **try/except** with proper HTTPException responses
- React components must use **TypeScript strictly** — no `any` types allowed
- The LLM **natural search prompt must return valid JSON** — always include a JSON parse fallback
- If Ollama is unavailable, the app must **degrade gracefully**: classic search and CRUD still work, AI features show a clear error message
- All Docker services must have **restart: unless-stopped**
- Use **French language** for all UI text (labels, buttons, placeholders, error messages) — the application is in French
- Backend API responses should be in **English keys** (JSON), but error messages for the frontend can be in French
- The seed script must be **idempotent** (safe to run multiple times — check for existing data before inserting)

---

*Document generated for Biblio-IA v1.0 — Gestion de Bibliothèque avec Assistant IA Local*
*Based on cahier des charges — Méthodes Agiles, Master Informatique et Mobilité, UHA 2025-2026*
*Tech stack: FastAPI + React + MySQL + Ollama (Mistral) — 100% local, zero data leakage*
