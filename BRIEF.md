# Brief "KB-Studio", interface de gestion de base de connaissance 

Date : 2026-03-02
Auteur : Baptiste PIRAULT

Objectif : Permettre un utilisateur non technique de gérer une base de connaissance qui servira pour un système de rag dans le cadre d'agent conversationnel IA. 
Tagline : Pilotez votre base de connaissances


## Contexte

La base de connaissance est constituée de documents (pdf, html, docx, pptx, xlsx and txt.) stockés dans un bucket.
La base de connaissance est elle-même stockée dans fichier `kb.ndjson` (à la racine du bucket), reprenant la structure attendue par vertex ai search pour les documents non structurés avec metatata.

## Architecture technique

- Backend : node, express
- Frontend : React
- Storage : Cloud Storage
- Hosting : Cloud Run with IAP


## User Stories

- En tant qu'utilisateur, je dois pouvoir uploader un nouveau fichier dans la base de connaissances. Mettre à jour avec une nouvelle version du fichier, le supprimer et le récupérer en téléchargement. 

- Lors du chargement d'un fichier, il y a doit extraire la date de valeur soit dans le contenu. Exemple date de réunion ou dans le nom du fichier. 

- Lors du chargement d'un fichier, il y a doit générer un cours descriptif du fichier. 

- En tant qu'utilisateur, je dois pouvoir gérer les dossiers( création édition suppression).

- En tant qu'utilisateur, je dois pouvoir déplacer les fichiers dans l'arborescence de dossier. Par défaut, au chargement d'un nouveau fichier, il est stocké à la racine utilisateur doit pouvoir choisir un autre dossier.


## Features nice to have : 

- Permettre le chargement de multiples fichiers en même temps via drag n drop sélection dans dossier en local

- Intégrer une visionneuse de documents

- Intégration des solutions de stockage type Google drive, onedrive, box, etc

- Preview du search avec une application vertex ai search directement interface

