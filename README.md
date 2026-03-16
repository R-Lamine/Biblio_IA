# Biblio-IA - Bibliothèque Intelligente

Application de gestion de bibliothèque avec analyse IA des résumés de livres.

## Prérequis

- Docker
- Docker Compose
- Git

## Configuration Initiale

### 1. Cloner le projet

```bash
git clone <repository-url>
cd Biblio_IA
```

### 2. Créer le fichier `.env`

Copier les variables d'environnement nécessaires :

```bash
cp .env.example .env  # Si le fichier existe
```

Ou créer manuellement `.env` à la racine du projet avec :

```env
MYSQL_ROOT_PASSWORD=root123
MYSQL_DATABASE=biblio_db
MYSQL_USER=biblio_user
MYSQL_PASSWORD=biblio_pass123
```

## Build & Démarrage

### Premier Build (complet)

Le premier build inclut **tous les services** y compris l'IA (Ollama) :

```bash
docker-compose up --build -d
```

Cela va :
- ✅ Construire l'image du backend (Python)
- ✅ Construire l'image du frontend (Node.js)
- ✅ Télécharger et initialiser Ollama (service IA)
- ✅ Initialiser MySQL
- ✅ Démarrer Redis
- ✅ Configurer Nginx comme reverse proxy

**Durée estimée : 5-10 minutes** (première fois, Ollama télécharge les modèles)

### Redémarrage (après modifications)

```bash
# Redémarrer tous les services
docker-compose restart

# Ou redémarrer un service spécifique
docker-compose restart backend
docker-compose restart frontend
```

### Arrêter les services

```bash
docker-compose down
```

### Arrêter et supprimer les volumes (réinitialiser la base de données)

```bash
docker-compose down -v
```

## Accès à l'Application

Après le démarrage, l'application est accessible via :

- **Frontend** : http://localhost (via Nginx)
- **API Backend** : http://localhost/api (via Nginx)
- **Backend direct** : http://localhost:8000
- **Ollama (IA)** : http://localhost:11434

## Services et Ports

| Service | Port | URL |
|---------|------|-----|
| MySQL | 3307 | `localhost:3307` |
| Redis | 6379 | `localhost:6379` |
| Ollama (IA) | 11434 | `localhost:11434` |
| Backend | 8000 | `localhost:8000` |
| Frontend Dev | 3000 | `localhost:3000` |
| Nginx (Reverse Proxy) | 80 | `localhost:80` |

## Architecture

```
                    ┌─────────────────┐
                    │   Nginx (80)    │
                    └────────┬────────┘
                             │
                ┌────────────┴────────────┐
                │                         │
        ┌───────▼────────┐    ┌──────────▼─────┐
        │ Frontend (3000)│    │  Backend (8000)│
        └────────────────┘    └────────┬────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    │                  │                  │
            ┌───────▼────────┐ ┌──────▼─────┐ ┌────────▼────┐
            │  MySQL (3307)  │ │ Redis (6379)│ │ Ollama (11434)
            └────────────────┘ └────────────┘ └─────────────┘
                                    (IA)
```

## Logs et Debugging

### Voir les logs de tous les services

```bash
docker-compose logs -f
```

### Voir les logs d'un service spécifique

```bash
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f ollama
```

### Accéder à un conteneur

```bash
# Backend
docker-compose exec backend bash

# Frontend
docker-compose exec frontend sh

# Base de données
docker-compose exec db mysql -u root -p
```

## Variables d'Environnement (Backend)

| Variable | Défaut | Description |
|----------|--------|-------------|
| `MYSQL_ROOT_PASSWORD` | - | Mot de passe root MySQL |
| `MYSQL_DATABASE` | - | Nom de la base de données |
| `MYSQL_USER` | - | Utilisateur MySQL |
| `MYSQL_PASSWORD` | - | Mot de passe utilisateur MySQL |

## Comptes de Test

### Client
- **Email** : adherent@biblioia.fr
- **Mot de passe** : adherent123
- **Rôle** : Adhérent (client)  

### Administrateur
- **Email** : bibliothecaire@biblioia.fr
- **Mot de passe** : admin123
- **Rôle** : Bibliothécaire (admin)

## Structure du Projet

```
Biblio_IA/
├── backend/              # API FastAPI (Python)
│   ├── models/          # Modèles de données
│   ├── routers/         # Routes API
│   ├── services/        # Services métier
│   ├── core/            # Configuration et sécurité
│   ├── ai/              # Intégration IA (Ollama)
│   ├── seed/            # Données de test
│   └── requirements.txt
├── frontend/             # Application React (TypeScript)
│   ├── src/
│   │   ├── pages/       # Pages principales
│   │   ├── components/  # Composants React
│   │   ├── store/       # État global (Zustand)
│   │   └── api/         # Appels API
│   └── package.json
├── nginx/               # Configuration Nginx
│   └── nginx.conf
├── docker-compose.yml   # Configuration Docker Compose
└── README.md           # Ce fichier
```

## Workflow de Développement

### 1. Après clonage (première fois)

```bash
docker-compose up --build -d
```

### 2. Pendant le développement

Les volumes sont configurés pour auto-reload :
- **Backend** : Uvicorn reload automatique (`--reload`)
- **Frontend** : Vite HMR (Hot Module Replacement)

Modifier les fichiers → Les changements se rechargent automatiquement

### 3. Avant de pusher les changements

```bash
# Vérifier que tout compile
docker-compose up --build

# Arrêter
docker-compose down
```

## Intégration IA (Ollama)

L'IA est intégrée via **Ollama** et démarre automatiquement lors du premier build.

### Informations

- **Service** : Conteneur `ollama` (basé sur `ollama/ollama:latest`)
- **Port** : 11434
- **Stockage des modèles** : Volume `./ollama_models`

### Vérifier le statut d'Ollama

```bash
curl http://localhost:11434/api/tags
```

### Accéder à Ollama

```bash
docker-compose exec ollama ollama list
```

## Troubleshooting

### Services ne démarre pas

```bash
# Vérifier les logs
docker-compose logs

# Reconstruire
docker-compose down -v
docker-compose up --build -d
```

### Port déjà utilisé

Modifier les ports dans `docker-compose.yml` si nécessaire.

### Database connection error

Vérifier que MySQL est en bonne santé :

```bash
docker-compose logs db
```

### Cache/node_modules issues

```bash
# Supprimer les caches et reconstruire
docker-compose down -v
docker-compose up --build -d
```

## Déploiement

Pour déployer en production :

1. Modifier les variables d'environnement (`.env`)
2. Utiliser `docker-compose.prod.yml` ou adapter la config
3. Configurer les secrets pour les données sensibles

## Contributeurs

Pour contribuer :

1. Créer une branche
2. Faire les changements
3. Tester localement avec `docker-compose up --build`
4. Pusher et créer une PR

---

**Questions ?** Vérifier les logs avec `docker-compose logs -f`
