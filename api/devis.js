/**
 * France Propreté Hygiène — envoi des demandes de devis (fonction Vercel).
 * Reçoit le formulaire (JSON ou formulaire classique) et l'envoie par e-mail via SMTP.
 *
 * Variables d'environnement (Vercel > Settings > Environment Variables) :
 *   SMTP_HOST   ex. smtp.gmail.com
 *   SMTP_PORT   ex. 465
 *   SMTP_USER   adresse de connexion à la boîte mail
 *   SMTP_PASS   mot de passe (pour Gmail : mot de passe d'application)
 *   MAIL_TO     adresse qui reçoit les demandes (par défaut SMTP_USER)
 */
const nodemailer = require("nodemailer");

const LOCAUX = {
  bureaux: "Bureaux", copropriete: "Copropriété, résidence", commerce: "Commerce, magasin",
  medical: "Médical, paramédical", entrepot: "Industrie, entrepôt", logement: "Logement particulier",
  autre: "Autre",
};
const PRESTATIONS = {
  "entretien-regulier": "Entretien régulier", ponctuel: "Nettoyage ponctuel", desinfection: "Désinfection",
  vitrerie: "Vitrerie", moquettes: "Moquettes", "apres-travaux": "Après travaux",
  "decapage-sol": "Décapage de sol", "decapage-facade": "Décapage de façade",
};
const RE_CP = /^(0[1-9]|[1-8]\d|9[0-8]|2[AaBb])\d{3}$/;
const RE_TEL = /^(?:(?:\+|00)33[\s.\-]?|0)[1-9](?:[\s.\-]?\d{2}){4}$/;
const RE_EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

function champ(body, nom, max = 200) {
  let v = body[nom];
  if (Array.isArray(v)) v = v[0];
  if (typeof v !== "string") return "";
  return v.replace(/[\r\0]/g, "").trim().slice(0, max);
}

function liste(body, nom) {
  const v = body[nom] ?? body[nom + "[]"];
  if (v == null) return [];
  return (Array.isArray(v) ? v : [v]).filter((x) => typeof x === "string");
}

module.exports = async function handler(req, res) {
  const wantsJson = (req.headers.accept || "").includes("application/json");

  function repondre(ok, erreur = "", code = 200) {
    if (wantsJson) return res.status(code).json({ ok, error: erreur });
    res.writeHead(303, { Location: ok ? "/merci" : "/devis?erreur=1" });
    return res.end();
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return repondre(false, "methode", 405);
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};

  // Piège à robots : ce champ est invisible pour un humain.
  if (champ(body, "site_web")) return repondre(true);

  const locaux = LOCAUX[champ(body, "locaux")] || "";
  const prestations = liste(body, "prestations").map((p) => PRESTATIONS[p]).filter(Boolean);
  const d = {
    surface: champ(body, "surface", 60),
    frequence: champ(body, "frequence", 60),
    cp: champ(body, "cp", 5),
    ville: champ(body, "ville", 100),
    date: champ(body, "date", 60),
    message: champ(body, "message", 3000),
    nom: champ(body, "nom", 120).replace(/\n/g, " "),
    societe: champ(body, "societe", 120),
    tel: champ(body, "tel", 30),
    email: champ(body, "email", 180),
    rappel: champ(body, "rappel", 30),
    visiteDispo: champ(body, "visite_dispo", 200),
  };
  const visite = champ(body, "visite") === "oui";

  const valide = locaux && d.surface && d.frequence && RE_CP.test(d.cp) && d.ville && d.nom
    && RE_TEL.test(d.tel) && RE_EMAIL.test(d.email) && champ(body, "consent") === "oui";
  if (!valide) return repondre(false, "validation", 422);

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_TO } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.error("Configuration SMTP manquante");
    return repondre(false, "configuration", 500);
  }

  const port = Number(SMTP_PORT) || 465;
  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  const date = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short" });
  const texte = [
    "Nouvelle demande de devis depuis le site",
    "",
    "LOCAUX",
    "Type : " + locaux,
    "Prestations : " + (prestations.length ? prestations.join(", ") : "non précisé"),
    "Surface : " + d.surface,
    "Fréquence : " + d.frequence,
    "Lieu : " + d.cp + " " + d.ville,
    "Démarrage : " + (d.date || "non précisé"),
    "Visite technique : " + (visite ? "OUI, à prévoir" + (d.visiteDispo ? " (disponibilités : " + d.visiteDispo + ")" : "") : "non demandée"),
    "",
    "PRÉCISIONS",
    d.message || "(aucune)",
    "",
    "CONTACT",
    "Nom : " + d.nom,
    "Société : " + (d.societe || "-"),
    "Téléphone : " + d.tel,
    "E-mail : " + d.email,
    "Rappel : " + (d.rappel || "indifférent"),
    "",
    "Envoyé le " + date,
    "Répondez directement à ce message pour écrire au client.",
  ].join("\n");

  try {
    await transport.sendMail({
      from: { name: "Site France Propreté Hygiène", address: SMTP_USER },
      to: MAIL_TO || SMTP_USER,
      replyTo: { name: d.nom, address: d.email },
      subject: `${visite ? "[Visite à prévoir] " : ""}Demande de devis : ${locaux} – ${d.cp} ${d.ville}`,
      text: texte,
    });
    return repondre(true);
  } catch (err) {
    console.error("Échec de l'envoi :", err.message);
    return repondre(false, "envoi", 500);
  }
};
