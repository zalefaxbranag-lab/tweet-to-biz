# Pousser des fichiers de thème sans les retranscrire

## Le problème

`themeFilesUpsert` accepte un corps `TEXT`, ce qui oblige à faire passer le
contenu entier du fichier dans l'appel d'outil. Pour 20 sections, cela
représente ~305 Ko à retranscrire à la main, avec le risque d'erreur que ça
suppose et un coût de contexte absurde.

## La voie rapide, vérifiée

`OnlineStoreThemeFileBodyInput.type` accepte aussi **`URL`**. Et
`shopify-staged-uploads.storage.googleapis.com` **est joignable** depuis cet
environnement — un GET nu renvoie `403`, c'est-à-dire une réponse du serveur et
non un refus de `CONNECT` du proxy. Donc :

1. **`stagedUploadsCreate`** — une seule requête pour N cibles, avec
   `resource: FILE`, `mimeType: "text/plain"`, `httpMethod: POST`. Chaque cible
   renvoie une `resourceUrl` et une liste de `parameters`.
2. **`curl -F "file=@chemin/local"`** vers `https://shopify-staged-uploads.storage.googleapis.com/`
   en rejouant tous les `parameters` comme champs de formulaire. Le fichier part
   **depuis le disque** : rien ne transite par le contexte. Succès = `HTTP 201`.
3. **`themeFilesUpsert`** avec `body: { type: URL, value: <resourceUrl> }`.

Coût total : 3 appels d'API au lieu de 40, et zéro octet retranscrit.

## Ce qu'il faut savoir avant de s'en servir

- **L'upsert est asynchrone.** Il renvoie `upsertedThemeFiles: []` et
  `userErrors: []` même quand il a accepté le travail. Ne jamais conclure à un
  échec sur une liste vide : **revérifier par une requête**
  `theme(id:){ files(filenames:){ nodes { size checksumMd5 } } }` et comparer
  les MD5 aux fichiers locaux. Les gros fichiers arrivent en dernier.
- Les cibles expirent au bout de 24 h et ne servent qu'une fois.
- La signature et la politique sont propres à chaque cible ; seuls
  `x-goog-date`, `x-goog-credential` et `x-goog-algorithm` sont communs au lot.
- `acl` vaut `private`, et Shopify sait quand même lire l'objet : c'est son
  propre bucket de transit.
- Cela ne marche que sur un thème **non publié**. Le connecteur bloque
  volontairement toute écriture sur le thème live, et c'est la règle du projet :
  le propriétaire publie, pas l'assistant.

## Vérification systématique après un push

```
md5sum theme/sections/*.liquid theme/templates/page.couples.json
```
puis la même liste côté thème, et comparaison. Un MD5 identique est la seule
preuve que le fichier est réellement arrivé à l'octet près.

## Les rejets silencieux de Shopify — lire avant de pousser une section

`themeFilesUpsert` peut renvoyer **201 a l'upload et `userErrors: []` a l'upsert
sans appliquer le fichier**. Aucune erreur, nulle part. Deux causes ont ete
isolees a la main, les deux invisibles cote API :

| Cause | Symptome | Ce qui bloquait |
|---|---|---|
| `"default": ""` sur un setting | fichier jamais applique, zero erreur | `cs-duo-hero`, `cs-duo-trust` |
| `name` de section, de bloc ou de preset **> 25 caracteres** | idem | `cs-duo-how` (`"CraftStory Duo How It Works"` = 27) |

Un `default` present doit etre non vide : **on omet la cle** plutot que de la
mettre a `""`.

`qa/schema_check.py` refuse desormais ces deux motifs, plus tout ce que la
documentation Shopify liste et qui coute zero a verifier : cles racine inconnues,
ids dupliques, `select` sans options ou avec un default hors options, `range` a
plus de 101 pas ou dont le pas ne divise pas l'intervalle, `header`/`paragraph`
portant un id ou un default, preset depassant `max_blocks`, et tout
`section.settings.x` lu dans le markup mais absent du schema.

**A lancer avant chaque push, avec les deux autres portes :**

```bash
python3 qa/liquid_check.py theme/sections/*.liquid   # balises Liquid equilibrees
python3 qa/schema_check.py theme/sections/*.liquid   # rejets silencieux
```

## Un piege qui n'a rien a voir avec l'API : l'editeur de theme

L'editeur de theme Shopify **reecrit `templates/page.*.json` en entier** depuis
son etat interne. Shopify l'ecrit lui-meme en tete du fichier. Concretement : une
seule sauvegarde dans l'editeur annule toutes les poussees API faites sur ce
template. C'est arrive une fois sur ce projet — le template est revenu de 21 a 11
sections, avec l'ancien titre et l'ancien bouton.

Donc : **relire le template depuis le theme avant de le modifier**, et fusionner
depuis cette version. Jamais pousser une version locale par-dessus sans l'avoir
relue, sinon on ecrase le travail fait dans l'editeur.

## Un fichier plus gros que ~34 Ko ne passe pas

Constate, pas documente : `cs-duo-reviews.liquid` (42 236 octets) est refuse
alors que `cs-duo-hero.liquid` (33 579) passe, avec un schema propre dans les
deux cas. Le plafond se situe donc entre les deux. A verifier en decoupant la
section si le besoin revient.

### La troisieme cause : la taille du fichier

Mesures faites sur ce thème, même pipeline, même session :

| Fichier | Octets | Resultat |
|---|---|---|
| `cs-duo-head.liquid` | 25 247 | applique |
| `cs-duo-faq.liquid` | 25 364 | applique |
| `cs-duo-hero.liquid` | 33 622 | applique |
| `cs-duo-reviews.liquid` (carrousel) | 42 250 | **refuse** |

Le plafond est entre **33 622 et 42 250 octets**. Au-dessus, meme symptome que
les deux autres causes : 201 a l'upload, `userErrors: []` a l'upsert, fichier
jamais applique. Pour passer, sortir le JavaScript dans `assets/` et l'appeler
avec `asset_url | script_tag`.

## Les cibles de staging expirent — et l'upsert doit suivre l'upload

Les cibles renvoyees par `stagedUploadsCreate` portent une `expiration` dans
leur `policy` (24 h) mais ne survivent pas a une interruption longue entre
l'upload et l'upsert : quatre fichiers uploades en 201 puis upsertes plus tard
ont ete ignores en silence, et il a fallu tout re-stager. **Faire les trois
appels a la suite, sans rien entre eux**, puis verifier par MD5.

## Les templates JSON sont reecrits par Shopify

`templates/*.json` ne conserve jamais le MD5 local : Shopify remplace l'en-tete
de commentaire par son propre avertissement auto-genere et reindente le JSON.
Ici : 18 418 octets en local, 11 294 sur le theme, contenu identique. Pour un
template, la verification se fait sur le **corps** (`body { ... on
OnlineStoreThemeFileBodyText { content } }`), pas sur le MD5 : compter les
sections et comparer la liste `order`.

## La regle la plus importante : `TEXT` pour les templates, `URL` pour les sections

`OnlineStoreThemeFileBodyInput.type` accepte `URL` et `TEXT`. Ils ne se
comportent **pas** pareil face a une erreur :

| Corps | Contenu invalide | Ce que renvoie l'API |
|---|---|---|
| `URL` | refuse | `upsertedThemeFiles: []`, `userErrors: []` — **silence total** |
| `TEXT` | refuse | `userErrors: [{code: FILE_VALIDATION_ERROR, message: "..."}]` |

Une soiree entiere a ete perdue a chercher pourquoi un template ne changeait
pas. La cause reelle, visible en une seconde des qu'on est passe en `TEXT` :

> `Setting 'icon' must be a valid shopify url`

`cs-duo-ann` declare `icon` en `image_picker`. Le template lui donnait `"★"`.

**Correction, mesuree apres coup.** `upsertedThemeFiles` n'est renseigne que
pour un corps `TEXT`. Avec un corps `URL` il revient **toujours vide, meme quand
les fichiers sont bien ecrits** — six sections poussees en `URL` sont arrivees
a l'octet pres avec une liste vide en reponse. Donc :

- corps `TEXT` : liste pleine = ecrit, liste vide + `userErrors` = la raison.
- corps `URL` : la liste ne dit rien. **Seule la reverification compte** —
  rerequeter `files(filenames:){ size checksumMd5 }` et comparer au local.

La demander reste utile, mais uniquement en `TEXT` :

```graphql
themeFilesUpsert(themeId: $id, files: $files) {
  upsertedThemeFiles { filename size }   # <- vide = echec, toujours
  userErrors { filename code message }
}
```

**Donc :**
- **Templates JSON** — toujours en `TEXT`. Ils font moins de 8 Ko en compact
  (`json.dumps(d, separators=(',', ':'))`), ca passe largement dans un appel.
  Retirer les sauts de ligne des valeurs avant, sinon l'echappement casse.
- **Sections liquid** — en `URL` via le transit, elles sont trop grosses. Mais
  passer la section fautive en `TEXT` des qu'un push reste sans effet, pour
  obtenir le message.

## Les reglages de type ressource n'acceptent pas la chaine vide

`image_picker`, `video`, `url`, `video_url`, `collection`, `product`, `page`…
attendent une vraie reference (`shopify://…`, `https://…` ou `/chemin`). Ni
`""` ni un caractere decoratif ne passent. Dans un template, **omettre le
reglage** : le defaut du schema s'applique.

`qa/template_check.py` refuse tout ca avant le push :

```
python3 qa/template_check.py theme/templates/page.couples.json
```

## Les prompts images : une seule source

`docs/11-prompts-images.md` n'est pas ecrit a la main. Il est **genere depuis
`tools/kie.py`**, qui assemble scene + style + negatif exactement comme il les
envoie a l'API. Recopier les prompts a la main les ferait diverger du script au
premier ajustement.

Pour le regenerer apres avoir touche a un prompt :

```
cd tools && python3 - <<'PY'
src = open("kie.py", encoding="utf-8").read().replace("\nmain()\n", "\n")
ns = {}; exec(compile(src, "kie.py", "exec"), ns)
# ... voir l'historique git du fichier docs/11-prompts-images.md
PY
```

Le remplacement de `main()` est necessaire : `kie.py` l'appelle en fin de
fichier, donc un import nu demanderait la cle et lancerait une generation.
