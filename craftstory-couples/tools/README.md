# tools/ — génération d'images KIE

## Pourquoi ça tourne sur ta machine et pas ici

L'environnement d'exécution de l'assistant passe tout le HTTPS sortant par un
proxy d'organisation qui refuse `api.kie.ai` et `kieai.redpandaai.co` : le refus
(`403 Forbidden`) tombe sur le `CONNECT`, donc la requête ne quitte jamais le
conteneur et la clé n'est jamais transmise. Ce n'est pas un bug de la clé ni du
compte KIE — la même clé fonctionne depuis un poste normal. Sur ton Mac il n'y a
pas ce filtre : c'est là que la génération se lance.

## Deux fichiers, le même travail

| fichier | à quoi il sert |
|---|---|
| `kie.py` | version compacte, faite pour être **collée dans un terminal** en une commande. C'est celle à utiliser. |
| `kie_images.py` | version longue et commentée (mêmes prompts, mêmes endpoints), gardée comme référence de lecture. |

## Lancer

```bash
cd ~/Downloads
python3 kie.py probe        # quels modèles le compte accepte — 0 crédit
python3 kie.py page         # les 9 visuels d'occasions — ~18 crédits/image
python3 kie.py demo --photo photo-du-couple.jpg   # 3 visuels avec votre ressemblance
```

Options : `--model <id>`, `--only proposal,golden`, `--out ./images`, `--dry-run`
(affiche les prompts sans rien dépenser).

La clé n'est jamais écrite dans le fichier. Le script lit `KIE_KEY` si elle est
dans l'environnement, sinon il la demande à l'écran en saisie masquée — elle ne
passe donc pas dans l'historique du shell.

## Ce que `probe` sert à trancher

Les ids de modèles KIE ne se devinent pas. Un nom inconnu renvoie `422 model name
not supported`, un nom connu avec des paramètres vides renvoie une erreur de
paramètre : les deux coûtent 0 crédit. `probe` sépare donc les deux listes
gratuitement, et imprime la commande `page` à lancer ensuite avec le premier
modèle valide.

## Modèles réellement disponibles sur le compte

Résultat de `probe` lancé le 2026-09-17 depuis la machine du propriétaire
(solde à ce moment-là : 105 080 crédits). Un `500 … is required` veut dire que
le modèle existe et réclame ses paramètres ; un `422 model name … not supported`
veut dire qu'il n'existe pas.

| id | verdict | paramètre d'image réclamé |
|---|---|---|
| `nano-banana-pro` | existe | `image_input` |
| `seedream/4.5-edit` | existe | `image_urls` + `quality` obligatoire |
| `seedream/5-pro-image-to-image` | existe | non déterminé |
| `flux-2/pro-text-to-image` | existe | aucun (texte seul) |
| `flux-2/pro-image-to-image` | existe | **`input_urls`** |
| `google/nano-banana-edit` | existe | non déterminé |
| `gpt-image-2` | **n'existe pas** | — |

À retenir : les trois familles nomment le champ image différemment
(`image_input`, `image_urls`, `input_urls`). Se tromper de nom donne un
`500 … is required` et coûte 0 crédit, donc l'erreur est bénigne mais elle fait
perdre un aller-retour. Ne pas deviner : sonder.

## Placer les images sans ouvrir l'éditeur de thème

Les réglages `image_picker` d'un template Shopify stockent une référence, pas un
fichier. Format confirmé sur les templates en production de la boutique :

```json
"image": "shopify://shop_images/craftstory-ba-jungle.png"
```

Donc dès que les PNG sont dans **Contenu → Fichiers** de l'admin Shopify, les
neuf emplacements se câblent côté template, en une seule poussée, sans passer
par les sélecteurs d'image un par un. Les fichiers gardent le nom que
`tools/kie.py` leur donne (`cs-duo-<emplacement>.png`), ce qui rend la
correspondance emplacement → fichier mécanique.

**Requête à utiliser, et pourquoi elle est filtrée :**

```graphql
files(first: 20, query: "filename:cs-duo*", sortKey: FILENAME) { nodes { ... } }
```

Une requête `files` non filtrée sur cette boutique remonte les aperçus clients
générés par le worker, dont le champ `alt` contient des prénoms d'enfants et des
adresses e-mail. Toujours filtrer sur `filename:cs-duo*` : ces données n'ont
aucune raison d'entrer dans une session de travail sur la landing page.

## Règles de prompt (elles viennent d'échecs constatés, pas de goût)

- **Jamais** de description de visage : l'identité vient uniquement de la photo de
  référence. Décrire un visage fait dériver vers un visage générique.
- Clause anti-split obligatoire — sans elle le modèle rend régulièrement une
  image en deux moitiés ou un collage.
- `nano-banana-pro` attend `image_input`, **pas** `image_urls`.
- Les visuels de la page sont des couples fictifs : aucune photo de client n'est
  utilisée pour du marketing ou pour des tests.
