# France Propreté Hygiène, site vitrine

Site statique (HTML, CSS, JS) avec une fonction Vercel (`api/devis.js`) qui envoie les demandes de devis par e-mail en SMTP.

## Déployer sur Vercel

1. Mettre le dossier sur GitHub, puis sur vercel.com : **Add New > Project**, importer le dépôt. Aucun réglage de build à changer.
2. Dans **Settings > Environment Variables**, ajouter les variables listées dans `.env.example`.
3. Relancer un déploiement (**Deployments > Redeploy**) pour que les variables soient prises en compte.

## Recevoir les devis sur Gmail

1. Activer la validation en deux étapes sur le compte Google.
2. Créer un mot de passe d'application : https://myaccount.google.com/apppasswords
3. Sur Vercel : `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_USER=` l'adresse Gmail, `SMTP_PASS=` le mot de passe d'application (16 caractères).

Autre boîte mail : utiliser les réglages SMTP de l'hébergeur (OVH : `ssl0.ovh.net`, port 465 ; Outlook : `smtp-mail.outlook.com`, port 587).

`MAIL_TO` (facultatif) : l'adresse qui reçoit les demandes, si elle diffère de `SMTP_USER`.
Chaque e-mail reçu a le client en « Répondre à » : il suffit de cliquer sur Répondre.

## En local

Ouvrir `index.html` dans le navigateur. Le formulaire ne s'envoie qu'une fois en ligne : en local, il propose d'écrire par e-mail à la place.

## Film de présentation

Le film est une animation (`video/composition.html`, photos réelles dans `video/media/`) rendue image par image en MP4.

```
cd video
npm install
npm run stills   # quelques images fixes pour vérifier la mise en page
npm run render   # rend le film en 16:9 et en 9:16
```

- Versions pour le site : `assets/video/` (16:9 sur ordinateur, 9:16 sur mobile, choisies automatiquement).
- Versions haute qualité pour les réseaux sociaux : `video/exports/` (non envoyées sur GitHub).

Pour changer un texte, le numéro ou l'e-mail du film : modifier `video/composition.html`, puis relancer `npm run render`.
Le dossier `video/` n'est pas mis en ligne (voir `.vercelignore`).
