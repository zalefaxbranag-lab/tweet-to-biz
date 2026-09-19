# Déployer la page couples dans le thème live, sans dupliquer ni republier

## Pourquoi ça ne peut pas venir d'ici

Le connecteur Shopify de l'assistant refuse toute écriture de fichier sur le
thème publié. Message exact du refus :

> This mutation targets the live (published) theme. Theme file writes against
> the live storefront are blocked.

Ce n'est pas contournable et ce n'est pas une question d'autorisation : le
refus arrive avant l'écriture, rien n'est modifié. Le CLI Shopify, lui, tourne
sur ta machine avec tes identifiants et n'a pas cette limite.

## Les fichiers concernés, et eux seuls

- `theme/sections/cs-duo-*.liquid` — 20 fichiers
- `theme/templates/page.couples.json` — 1 fichier

Rien d'autre. En particulier **jamais** : `sections/header.liquid`,
`sections/footer.liquid`, `layout/theme.liquid`, `templates/index.json`,
`sections/cs-head.liquid`, `sections/cs-hero.liquid`,
`sections/cs-adventures.liquid`.

Vérifié sur le thème live : la page d'accueil tourne sur `cs-head`, `cs-hero`
et `cs-adventures`. Aucun template autre que `page.couples.json` n'appelle une
section `cs-duo-*`. Les préfixes ne se croisent pas.

## Les commandes

```bash
# 1. Le CLI, une seule fois
npm install -g @shopify/cli

# 2. Récupérer le thème live dans un dossier de travail
#    (lecture seule côté boutique, ne modifie rien)
shopify theme pull --store fzddaf-k8 --theme 208162816331 --path ~/craftstory-live

# 3. Récupérer les fichiers de la page couples
git clone -b claude/ecommerce-mariage-musique-ia-92sgat \
  https://github.com/zalefaxbranag-lab/tweet-to-biz.git ~/tweet-to-biz
# déjà cloné ? : cd ~/tweet-to-biz && git pull

# 4. Poser UNIQUEMENT les fichiers de la page couples par-dessus
cp ~/tweet-to-biz/craftstory-couples/theme/sections/cs-duo-*.liquid ~/craftstory-live/sections/
cp ~/tweet-to-biz/craftstory-couples/theme/templates/page.couples.json ~/craftstory-live/templates/

# 5. Pousser UNIQUEMENT ces fichiers dans le thème live
cd ~/craftstory-live
shopify theme push --store fzddaf-k8 --theme 208162816331 \
  --only "sections/cs-duo-*.liquid" \
  --only "templates/page.couples.json" \
  --nodelete --allow-live
```

## Ce que chaque garde-fou fait

| Option | Ce qu'elle garantit |
|---|---|
| `--only` (deux fois) | seuls ces fichiers quittent la machine. L'en-tête, le pied de page et la page d'accueil ne sont pas envoyés. |
| `--nodelete` | aucun fichier du thème n'est supprimé, même absent en local. |
| `--theme 208162816331` | le thème actuel, celui qui est déjà en ligne. |
| `--allow-live` | obligatoire pour viser le thème publié. Sans elle, le CLI refuse. |
| pas de `--publish` | aucune republication. Le thème reste celui qui l'est déjà. |

Et la page `couples` est en brouillon (`isPublished: false`) : même une fois les
fichiers en place, le public ne la voit pas tant que tu ne la publies pas
toi-même dans **Boutique en ligne → Pages**.

## Vérifier après coup

```bash
cd ~/tweet-to-biz/craftstory-couples
md5sum theme/sections/cs-duo-*.liquid
```
puis les mêmes empreintes côté thème. Le template JSON fait exception :
Shopify le réindente et remplace l'en-tête de commentaire, donc son MD5 ne
correspondra jamais. Pour lui, compter les sections : il doit y en avoir 21.
