# Brief "KB-Studio", interface de gestion de base de connaissance 

Date : 2026-03-02

Auteur : Baptiste PIRAULT

Objectif : Permettre un utilisateur non technique de gérer une base de connaissance qui servira pour un système de rag dans le cadre d'agent conversationnel IA. 

Tagline : Pilotez votre base de connaissances


## Contexte

La base de connaissance est constituée de documents (pdf, html, docx, pptx, xlsx and txt.) stockés dans un bucket.
La base de connaissance est elle-même stockée dans fichier `kb.ndjson` (à la racine du bucket), reprenant la structure attendue par vertex ai search pour les documents non structurés avec metatata.

## Architecture technique

- Backend : Node.js, Express
- Frontend : React
- Storage : Cloud Storage (Bucket pour les documents et le fichier `kb.ndjson`)
- Hosting : Cloud Run avec Identity-Aware Proxy (IAP) activé directement sur le service
- AI : Gemini 3 (pour l'extraction de métadonnées et la génération de descriptions)


## Détails d'implémentation technique

### 1. Structure de la Base de Connaissances (`kb.ndjson`)
Le fichier de métadonnées doit suivre le format NDJSON (Newline Delimited JSON) attendu par Vertex AI Search pour les données non structurées. Chaque ligne doit être un objet JSON valide :
```json
{
  "id": "unique-doc-id",
  "structData": {
    "category": "how_to"
    "description": "Description générée par l'IA",
    "folder": "Dossier du fichier",
    "title": "Nom du fichier",
    "value_date": "YYYY-MM-DD",
  },
  "content": {
    "mimeType": "application/pdf",
    "uri": "gs://votre-bucket/chemin/vers/document.pdf"
  }
}
```

### 2. Traitement Automatisé (Pipeline d'Upload)
Lors de l'upload d'un document, le backend doit :
1. Enregistrer le fichier dans le bucket Cloud Storage.
2. Mettre à jour (append) le fichier `kb.ndjson` avec l'entrée correspondante.

### 3. Utiliser **Gemini 3** (Pipeline Metadata Extract)
L'analyse par Gemini doit permettre d'extraire les métadonnnées (unitairement ou massivement) :
- Analyser le contenu et le nom du fichier pour extraire la "date de valeur".
- Générer un court descriptif du fichier.
- Catégoriser le document.

### 4. Gestion des Dossiers et Déplacements
Cloud Storage utilisant un namespace "flat", les dossiers sont simulés par des préfixes dans les noms d'objets.
- Création de dossier : Création d'un objet vide avec un suffixe `/`.
- Déplacement : Utilisation de la méthode `file.move()` pour renommer le préfixe du fichier vers la nouvelle destination.

### 5. Sécurité (Cloud Run + IAP)
L'accès à l'interface est sécurisé via IAP configuré directement sur le service Cloud Run. Cela permet une authentification basée sur l'identité (Google Workspace) sans nécessiter de Load Balancer externe, garantissant que seuls les utilisateurs autorisés accèdent à l'outil de gestion.


## User Stories

- En tant qu'utilisateur, je dois pouvoir uploader un nouveau fichier dans la base de connaissances. Mettre à jour avec une nouvelle version du fichier, le supprimer et le récupérer en téléchargement. 

- En tant qu'utilisateur, je dois pouvoir lancer une analyse IA (unitaire ou par lot) pour extraire la date de valeur, générer un court descriptif et catégoriser le document.

- En tant qu'utilisateur, je dois pouvoir corriger manuellement les métadonnées générées par l'IA (date de valeur, description, catégorie).

- En tant qu'utilisateur, je dois pouvoir gérer les dossiers( création édition suppression).

- En tant qu'utilisateur, je dois pouvoir déplacer les fichiers dans l'arborescence de dossier. Par défaut, au chargement d'un nouveau fichier, il est stocké à la racine utilisateur doit pouvoir choisir un autre dossier.


## Features nice to have : 

- Permettre le chargement de multiples fichiers en même temps via drag n drop sélection dans dossier en local

- Intégrer une visionneuse de documents

- Preview du search avec une application vertex ai search directement interface


## Endpoints API à implémenter

### 📁 Gestion des Dossiers
*   **`GET /api/folders`** : Lister tous les dossiers (structure arborescente).
*   **`POST /api/folders`** : Créer un nouveau dossier.
*   **`PUT /api/folders/:id`** : Renommer ou modifier un dossier.
*   **`DELETE /api/folders/:id`** : Supprimer un dossier.

### 📄 Gestion des Fichiers
*   **`GET /api/files`** : Lister les fichiers. Possibilité de filtrer par dossier (`?folderId=`) ou par nom de fichier (`?search=`).
*   **`POST /api/files`** : Uploader un ou plusieurs fichiers et créer l'entrée dans `kb.ndjson`.
*   **`PUT /api/files/:id`** : Mettre à jour le fichier physique (nouvelle version). Redéclenche l'analyse Gemini.
*   **`PATCH /api/files/:id`** : Mettre à jour uniquement les métadonnées du fichier (Renommage, correction manuelle de la `Date de valeur` ou `Description` via le volet latéral).
*   **`DELETE /api/files/:id`** : Supprimer un fichier (et son entrée dans `kb.ndjson`).
*   **`GET /api/files/:id/download`** : Récupérer une URL signée pour la prévisualisation (*inline*) ou le téléchargement.
*   **`PUT /api/files/:id/move`** : Déplacer un fichier vers un autre dossier (renommage du préfixe Cloud Storage).


## Organisation de l'Interface (UI)

### 📐 Mise en page globale (Layout)
*   **Barre de navigation supérieure (Header)** :
    *   **Logo/Titre** : KB-Studio.
    *   **Barre de recherche rapide** : Pour trouver un document par son nom.
*   **Sidebar gauche (Arborescence uniquement)** :
    *   **Arbre des dossiers** : Une vue hiérarchique dépliable de tous les dossiers pour une navigation rapide et servant de cible pour le "Glisser-Déposer".

### 🖼️ Vues principales

#### 1. L'Explorateur (Vue centrale)
*   **Barre d'actions** : 
    *   Boutons `+ Nouveau Dossier`, `⬆️ Téléverser des fichiers`.
    *   Zone de "Drag & Drop" globale sur la vue pour l'upload.
*   **Tableau des données (Liste)** :
    *   **Colonnes** : 
        *   Icône (Type de fichier/dossier), Nom, Date de valeur (Extraite par Gemini 3 Pro), Description (Résumé généré par Gemini 3 Pro), Actions (Menu "..." : Renommer, Déplacer, Télécharger, Supprimer).
*   **Interactions** : Le clic sur un dossier permet d'y entrer. Le clic sur un fichier ouvre le volet de détails/prévisualisation.

#### 2. Volet de détails (Panel latéral droit)
Lorsqu'un fichier est sélectionné, un volet coulissant s'affiche à droite :
*   **Aperçu** : Visionneuse intégrée (PDF, Image, Texte).
*   **Métadonnées éditables** :
    *   Permet à l'utilisateur de modifier manuellement la `Date de valeur` ou la `Description` si l'IA a fait une erreur.
    *   Bouton d'enregistrement pour mettre à jour le fichier `kb.ndjson`.
*   **Actions rapides** : Télécharger, Supprimer.


