# Gestions Access — Table Builder No-Code

Une plateforme **No-Code de gestion de données** permettant de créer des tableaux dynamiques, à la manière d'Airtable, Notion Database ou Microsoft Lists.

## 🚀 Fonctionnalités

### 📊 Gestion des tableaux
- Création de tableaux avec nom, description, icône, couleur, catégorie
- **21 types de colonnes** : Texte, Nombre, Date, Case à cocher, Liste déroulante, Image, Email, URL, Formule, etc.
- Ajout, modification, suppression de lignes en inline
- Tri par colonne (A→Z, Z→A, numérique, date)

### 🔍 Recherche & Filtres
- Recherche instantanée plein texte
- Filtres multicritères

### 👁️ Vues multiples
- **Tableau** (grille de données)
- **Cartes** (vue carte)
- **Kanban** (vue tableau Kanban)
- Calendrier et Galerie (à venir)

### 📥📤 Import / Export
- **Import** CSV (création auto d'un tableau depuis un fichier)
- **Export** CSV, Excel, PDF

### 👥 Gestion des utilisateurs
- Rôles : **Administrateur**, **Éditeur**, **Lecteur**
- Permissions par tableau
- Authentification JWT

### 📋 Audit & Historique
- Toutes les modifications sont enregistrées
- Tableau de bord avec statistiques

## 🏗️ Architecture

```
gestions_access/
├── frontend/          # React + TypeScript + Tailwind CSS + TanStack Table
│   ├── src/
│   │   ├── components/   # Composants UI
│   │   ├── contexts/     # Contextes (Auth)
│   │   ├── pages/        # Pages de l'application
│   │   ├── services/     # API client (Axios)
│   │   └── types/        # Types TypeScript
│   ├── Dockerfile
│   └── nginx.conf
├── backend/           # Node.js + Express + Prisma ORM
│   ├── src/
│   │   ├── middleware/   # Auth JWT + rôles
│   │   ├── routes/       # Routes API REST
│   │   └── utils/        # Utilitaires (audit)
│   ├── prisma/
│   │   └── schema.prisma # Modèle de données
│   └── Dockerfile
├── docker-compose.yml # PostgreSQL + MinIO + Backend + Frontend
└── uploads/           # Dossier uploads local
```

## 🛠️ Stack Technique

| Couche       | Technologie                                     |
|-------------|-------------------------------------------------|
| **Frontend** | React 18, TypeScript, Tailwind CSS, TanStack Table |
| **Backend**  | Node.js, Express, Prisma ORM, TypeScript        |
| **Database** | PostgreSQL 16                                   |
| **Storage**  | MinIO (S3-compatible)                           |
| **Auth**     | JWT (JSON Web Tokens)                           |
| **DevOps**   | Docker & Docker Compose                         |

## 🚀 Démarrage Rapide

### Prérequis
- Node.js 20+
- Docker & Docker Compose

### 1. Démarrer les services (PostgreSQL + MinIO)
```bash
docker-compose up -d postgres minio
```

### 2. Configurer le backend
```bash
cd backend
npm install
cp .env.example .env  # Configurer les variables d'environnement
npx prisma migrate dev --name init
npx prisma db seed
npm run dev
```

### 3. Configurer le frontend
```bash
cd frontend
npm install
npm run dev
```

### 4. Accéder à l'application
- **Frontend** : http://localhost:5173
- **API** : http://localhost:3001/api
- **MinIO Console** : http://localhost:9001 (admin / minioadmin123)
- **PostgreSQL** : localhost:5432

### Comptes de démo
| Rôle  | Email              | Mot de passe |
|-------|--------------------|--------------|
| Admin | admin@example.com  | admin123     |
| Éditeur | editor@example.com | editor123  |
| Lecteur | reader@example.com | reader123   |

## 📦 Modèle de Données

```
User ── créé ── Table ── contient ── Column
  │                │                      │
  │                ├── contient ── Row ───┴── CellValue
  │                ├── possède ── View ── ViewColumn + Filter
  │                ├── a ── Permission
  │                └── a ── AuditLog
```

## 🗺️ Roadmap

- [x] Création de tableaux et colonnes dynamiques
- [x] CRUD complet des données
- [x] Authentification JWT avec rôles
- [x] Import/Export (CSV, Excel, PDF)
- [x] Recherche et tris
- [x] Vues (Tableau, Cartes, Kanban)
- [x] Dashboard et audit
- [ ] Formulaires de saisie liés aux tableaux
- [ ] Workflows d'approbation
- [ ] Relations entre tableaux
- [ ] Graphiques et tableaux de bord avancés
- [ ] API REST publique
- [ ] SSO / Azure AD

## 📄 Licence

MIT
