# Passation — LP Couples (thème draft v25)

À lire avant de publier. Document en français, copie storefront en anglais (règle projet).

---

## Le draft

| | |
|---|---|
| Thème draft | **CraftStory v25 LP COUPLES (publie moi)** — `208038494539` |
| Base dupliquée | **CraftStory v24 PHOTO TIPS (publie moi)** — `207962898763`, `updatedAt` 2026-09-15T23:50:44Z |
| MAIN au moment de la duplication | **CraftStory v24 REGENERER (publie moi)** — `207895789899`, `updatedAt` 2026-09-15T00:45:41Z |
| Boutique | `fzddaf-k8.myshopify.com` (craftstory.co) — vérifiée avant écriture |
| Page créée | **« Your Song, Your Music Video »** — `gid://shopify/Page/719758098763`, handle `couples`, template `couples`, **non publiée** |

**Les 7 fichiers ont été poussés et vérifiés par empreinte MD5** : les checksums renvoyés
par Shopify sont identiques aux fichiers locaux, octet pour octet.

**Pourquoi la base PHOTO TIPS et pas MAIN.** Le draft PHOTO TIPS était encore non publié.
Construire sur MAIN aurait voulu dire que publier la LP **écrase le travail photo-tips**.
En partant de PHOTO TIPS, publier ce draft livre les deux : les photo tips *et* la LP.

> Si tu ne veux pas publier les photo tips maintenant, dis-le : je reconstruis la LP sur
> MAIN en quelques minutes (les fichiers sont additifs, rien à réécrire).

---

## Ce qui a été ajouté — 7 fichiers, tous nouveaux

| Fichier | Rôle |
|---|---|
| `sections/cs-duo-hero.liquid` | Hero : accroche, bullets, CTA, clip 16:9 en click-to-play |
| `sections/cs-duo-vsl.liquid` | **La VSL** — 16:9, click-to-play, fond night-blue, repères sous la vidéo |
| `sections/cs-duo-demos.liquid` | Les 6 clips : 3 music-vidéos + 3 réactions, en paysage, en deux rangées |
| `sections/cs-duo-steps.liquid` | « How it works » en 4 étapes |
| `sections/cs-duo-offer.liquid` | Ce qu'on reçoit + garantie + CTA final |
| `sections/cs-duo-faq.liquid` | FAQ en accordéon |
| `templates/page.couples.json` | Le template de page qui assemble tout, copie par défaut incluse |

## Ce qui n'a PAS été touché

- Le tunnel enfants : `cs-personalize.liquid`, `cs-personalize.js`, `cs-generate.js`,
  `cs-stories.js` — **aucune modification**.
- Le contrat HTTP du worker, les noms d'événements Klaviyo, les tags Shopify, les
  métafields `craftstory.*`, les 6 propriétés de ligne de commande.
- Les 8 templates produit, `index.json`, `page.movies.json`.
- Les sections `cs-*` partagées existantes.

Aucun fichier existant n'a été renommé, supprimé ou réaffecté. Tout est additif.

---

## Pour mettre la page en ligne

1. **Publier le thème** `208038494539` (c'est toi qui publies).
2. Dans l'admin Shopify → **Boutique en ligne ▸ Pages ▸ Ajouter une page**.
3. Titre : au choix. Handle suggéré : `couples`.
4. Dans **Modèle de thème**, choisir **`couples`** (le template apparaît une fois le
   thème publié).
5. Enregistrer. La page vit alors sur `https://craftstory.co/pages/couples`.

### Prévisualisation — à lire, il y a un piège

La page existe déjà (je l'ai créée) mais elle est **non publiée**. Une page non publiée
renvoie un 404 sur la boutique, **même avec `?preview_theme_id=`**. Donc cette URL ne
marchera pas tant que la page est en brouillon :

```
https://craftstory.co/pages/couples?preview_theme_id=208038494539   ← 404 pour l'instant
```

**Le bon chemin, sans rien publier** — l'éditeur de thème sait afficher une page en
brouillon :

```
https://admin.shopify.com/store/fzddaf-k8/themes/208038494539/editor?previewPath=%2Fpages%2Fcouples
```

**L'autre option** : publier la page (elle reste hors navigation et sans lien entrant,
c'est exactement ce que fait le concurrent avec sa LP). Attention : tant que le thème
n'est pas publié, la page s'affichera avec le template par défaut sur le thème live —
donc quasi vide. Publie le thème d'abord, la page ensuite.

---

## Ce qu'il reste à remplir dans l'éditeur de thème

La page est complète en structure et en copie. Il manque les médias — je ne peux pas les
générer, le domaine du studio est bloqué par la politique réseau de l'environnement.

| Section | À fournir |
|---|---|
| Duo Hero | 1 clip 16:9 + sa vignette |
| Duo VSL | la VSL montée (16:9) + sa vignette |
| Duo Demos | 6 clips 16:9 + 6 vignettes (3 taggés « Music video », 3 taggés « First listen ») |

Tous les emplacements affichent un repère visuel dans l'éditeur tant qu'ils sont vides, et
chaque clip accepte soit un MP4 uploadé, soit une URL `.mp4` directe.

Le script de la VSL, le découpage plan par plan et les prompts de génération des 6 clips
sont dans `03-vsl-script.md`.

---

## Trois décisions qui t'appartiennent

1. **Le lien des boutons.** Tous les CTA pointent sur `#` pour l'instant, réglable dans
   l'éditeur (champ « Button link » de chaque section). Je **n'ai pas** branché
   `data-cs-open` : cette pop-up est câblée sur le tunnel enfants et l'ouvrir ici
   créerait des leads avec les tags enfants, le mauvais titre d'histoire et le mauvais
   flow Klaviyo. Le tunnel couples a besoin de sa propre pop-up et de son propre worker.

2. **Le prix.** Il est masqué par défaut, comme partout ailleurs sur le site (le prix
   n'apparaît qu'après le preview gratuit). Un interrupteur « Show a price on this page »
   existe dans Duo Offer si tu décides le contraire.

3. **Les leviers que j'ai retirés.** Compteur client, capacité quotidienne, remise qui
   expire : ils marchent chez le concurrent mais entrent en conflit avec les règles
   écrites du projet (pas de faux chiffres, pas de fausse urgence). Détail et arbitrage
   dans `03-vsl-script.md` §2.

---

## Avant de publier

- [ ] **QA visuelle : à faire par toi, je n'ai pas pu.** `craftstory.co` est bloqué par
      la politique réseau de l'environnement, donc je n'ai jamais vu la page rendue. Ce
      qui est vérifié : les 6 schémas JSON parsent, les noms de section tiennent dans la
      limite de 25 caractères, le JS des 3 lecteurs passe `node --check`, aucune valeur
      hex brute (tout en `var(--cs-*)`), et les 7 fichiers sont byte-identiques côté
      Shopify. Ce qui n'est pas vérifié : le rendu réel, à 320, 375, 390 et 414 px.
- [ ] Vérifier qu'une page produit enfant n'a pas bougé (régression) : ouvrir
      `https://craftstory.co/products/dinosaur-adventure?preview_theme_id=208038494539`
- [ ] Vérifier que la pop-up enfants fonctionne toujours sur ce draft
- [ ] **Si le thème live a changé après 2026-09-17, ne publie pas ce draft : demande-moi
      de le rebaser.**
