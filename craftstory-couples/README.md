# CraftStory Couples — chanson + vidéo IA personnalisées (avatar couple / mariage)

Dossier de travail neuf, isolé du reste du dépôt. Rien ici ne touche au code existant.

## Objet

Lancer un second avatar pour CraftStory : **les couples et le mariage**, sur le modèle
économique d'UniqueSong (chanson personnalisée générée par IA, preview gratuite, paywall),
avec une brique différenciante : **une vidéo générée par IA en plus de la musique**.

L'avatar existant (cadeaux personnalisés pour enfants, commandés par parents et
grands-parents) continue sans modification.

## État

| Étape | Statut |
|---|---|
| 1. Analyse du concurrent et du mécanisme | **fait** — `docs/01-teardown-uniquesong.md` |
| 2. Adaptation à l'avatar couple + brique vidéo | arbitrages ouverts — `docs/02-questions-ouvertes.md` |
| 3. Landing page dédiée + VSL | **bloqué** — accès Shopify à rétablir |
| 4. Intégration technique (génération, livraison, échecs) | **bloqué** — API KIE injoignable depuis l'env |

## Sources de l'analyse

- Trendtrack (MCP) : snapshot boutique, ladder produits, séquence email, 954 transcripts
  publicitaires, 367 créas actives suivies. Données au 2026-09-17.
- Skill `craftstory-project` (export 2026-09-16) : architecture, worker Cloudflare, chaîne
  KIE, contrats de production à ne pas casser.

## Règles héritées de CraftStory qui s'appliquent ici

- Aucun secret dans le dépôt : noms de variables d'environnement seulement (`KIE_KEY`, etc.).
- Un seul environnement : la production. Pas de store de test, pas de worker de test.
- Travail additif : on ajoute des fichiers, on ne renomme ni ne réaffecte l'existant.
- Le propriétaire publie les thèmes et déploie le worker. On prépare et on livre.
