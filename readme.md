# OSM Data 3D Tiles

Générateur de tuiles 3D (3D Tiles) à partir de données OpenStreetMap (OSM). Ce projet convertit les bâtiments OSM en format B3DM (Batched 3D Model) compatible avec QGIS/CESIUM/Giro3D

## 🎯 Fonctionnalités

- **Modélisation des bâtiments** : Modélise en LOD 2 (norme CityGML) les bâtiments OSM sous le format B3DM
- **Génération de tilesets** : Création de fichiers `tileset.json` pour la hiérarchie des tuiles
- **Projections multiples** : Support de projections multiple, pour l'instant Mercator et ECEF (2154 fait mais non exposé pour le moment)
- **Pré-génération** : Possibilité de pré-générer (seed) les fichiers B3DM 
- **Textures** : Support de textures pour les façades et toits des bâtiments
- **Serveur de tuiles** : Pour l'environnement de dev/tes un serveur Express pour servir les tuiles B3DM et JSON à la demande.

## 📋 Prérequis

- **Node.js** : Version 20.3.0 (géré par Volta)
- **npm** 
- **Données OSM** : Accès à un serveur de tuiles MVT contenant les données de bâtiments (cf https://github.com/TANK2003/osm-data-vector-tiles)

## 🚀 Installation

1. Clonez le dépôt :
```bash
git clone <url-du-repo>
cd osm-data-3d-tiles
```

2. Installez les dépendances :
```bash
npm install
```

3. Configurez les variables d'environnement :
Créez un fichier `.env` à la racine du projet :
```env
PORT=3300
HOST=localhost
TILE_URL=http://serveur-tuile/maps/osm_data
EXTENT=483846.38180292473,5694711.4384306185,594527.2326621102,5785212.880144494
```

## ⚙️ Configuration

### Variables d'environnement

- `PORT` : Port du serveur (défaut: 3300)
- `HOST` : Adresse IP/hostname du serveur (défaut: localhost)
- `TILE_URL` : URL de base du serveur de tuiles MVT contenant les données OSM (requis)
- `EXTENT` : Emprise géographique pour la génération des tuiles au format `minX,minY,maxX,maxY` en coordonnées Mercator (EPSG:3857) (requis). Exemple pour Lyon : `483846.38180292473,5694711.4384306185,594527.2326621102,5785212.880144494`

### Structure des dossiers

Le projet génère les fichiers suivants dans le dossier `exported/` :

- `tileset.json` : Fichier tileset principal
- `subtiles/` : Fichiers tileset pour chaque sous-tuile
- `b3dm/` : Fichiers B3DM pré-générés (optionnel)

Créez ces dossiers si nécessaire :
```bash
mkdir -p exported/subtiles
mkdir -p exported/b3dm
```

## 📖 Utilisation

### Commandes disponibles

#### 1. Packer les textures

Génère un atlas de textures à partir des textures individuelles :

```bash
node run pack-textures
```

#### 2. Générer un tileset

Génère le fichier `tileset.json` et les sous-tuiles :

**Pour toutes les tuiles :**
```bash
npm run generate-tileset
```

**Pour une tuile spécifique :**
```bash
npm run generate-tileset -- --tile_coord 16_33174_22536
```

**Avec projection spécifique :**
```bash
npm run generate-tileset  -- --tile_coord 16_33174_22536 --projection ecef
# Options de projection : 'mercator' (défaut) ou 'ecef'
```

#### 3. Pré-générer les fichiers B3DM (seed)

Génère tous les fichiers B3DM pour une tuile donnée :

```bash
npm run seed-b3dm -- --tile_json 16_33174_22536.json
```


#### 4. Démarrer le serveur

Démarre le serveur Express pour servir les tuiles :

```bash
npm run dev

```

Le serveur écoute sur `http://localhost:3300` (ou le port configuré).

**Endpoints disponibles :**
- `GET /:b3dm_path` : Récupère un fichier B3DM ou JSON

**Exemples :**
- `http://localhost:3300/tileset.json` : Fichier tileset principal
- `http://localhost:3300/16_33174_22536.b3dm` : Fichier B3DM (généré à la demande si non pré-généré)
- `http://localhost:3300/subtiles/12_2074_1408.json` : Fichier tileset d'une sous-tuile


## 🏗️ Architecture

### Structure du projet

```
osm-data-3d-tiles/
├── assets/                 # Assets statiques (textures)
│   └── textures/
│       ├── buildings/      # Textures des bâtiments
│       │   ├── facades/   # Textures des façades
│       │   └── roofs/     # Textures des toits
│       ├── rails/          # Textures des rails
│       ├── noise/          # Textures de bruit
│       └── packed/         # Atlas de textures générés
├── building-tile-db/       # Base de données SQLite pour déduplication
├── src/
│   ├── building/          # Logique de construction 3D des bâtiments
│   │   ├── roof/          # Générateurs de toits (gabled, hipped, etc.)
│   │   └── worker/        # Workers pour traitement parallèle
│   ├── math/              # Utilitaires mathématiques (OMBB, vecteurs)
│   ├── ring/               # Gestion des anneaux (rings) géométriques
│   ├── textures/          # Gestion des textures
│   ├── tileset/           # Génération des tilesets JSON
│   ├── utils/             # Utilitaires généraux (géométrie)
│   ├── b3dmGenerator.ts   # Génération des fichiers B3DM
│   ├── build3dBuilding.ts # Construction 3D à partir des features OSM
│   ├── texturesLoader.ts  # Chargeur de textures
│   ├── type.ts            # Types TypeScript
│   └── unique-tile-per-building.ts # Déduplication des bâtiments
├── exported/              # Fichiers générés
│   ├── tileset.json       # Tileset principal
│   ├── subtiles/          # Tilesets des sous-tuiles
│   ├── b3dm/              # Fichiers B3DM pré-générés
│   └── analyzed/          # Fichiers d'analyse
├── config.ts              # Configuration du projet
├── main.ts                # Point d'entrée principal
├── generate-tileset.ts    # Génération des tilesets
├── seed-b3dm.ts           # Pré-génération des B3DM
├── serve.ts               # Serveur Express pour les tuiles
```

### Flux de traitement

1. **Récupération des données** : Le serveur récupère les tuiles MVT depuis `TILE_URL`
2. **Filtrage** : Extraction des features de type "buildings"
3. **Déduplication** : Évite les doublons de bâtiments entre tuiles adjacentes
4. **Construction 3D** : Génération de la géométrie 3D avec toits et façades
5. **Export GLB** : Conversion en format GLB avec Three.js
6. **Compression** : Compression Draco de la géométrie
7. **B3DM** : Encapsulation dans le format B3DM avec métadonnées

## 🔧 Dépendances principales

- **three.js** : Rendu 3D et géométries
- **@gltf-transform** : Transformation et compression GLTF/GLB
- **3d-tiles-tools** : Création des fichiers B3DM
- **draco3dgltf** : Compression Draco
- **ol (OpenLayers)** : Traitement des données géospatiales et MVT
- **express** : Serveur HTTP
- **better-sqlite3** : Base de données pour la déduplication des bâtiments
- **straight-skeleton** : Génération de toits complexes

## 📝 Notes

- Les fichiers B3DM sont générés à la demande si non pré-générés, ce qui peut prendre du temps
- La pré-génération (seed) améliore significativement les performances
- Le projet utilise un système de workers pour le traitement parallèle des tuiles
- Les textures sont packées dans des atlas pour optimiser les performances

## 🔮 Améliorations futures

Les améliorations suivantes sont prévues pour les prochaines versions (sans ordre) :

- **Requête directe à la base de données** : Interroger directement une base de données OSM (osm2pgsql) sans passer par un serveur de tuiles MVT.
- **Stockage cloud** : Ajouter un support pour le stockage des fichiers B3DM et tilesets dans un disque distant (S3, Azure Blob Storage, etc.)
- **Points d'intérêt OSM** : Étendre la génération de tuiles 3D pour inclure d'autres éléments OSM comme les points d'intérêt (POI), en plus des bâtiments
- **Support des altitudes** : Ajouter le support des données d'altitude (DEM, MNT) pour positionner correctement les éléments 3D selon le relief du terrain
