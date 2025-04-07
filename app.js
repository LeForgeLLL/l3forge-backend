// app.js complet avec ajout de /api/formulaire sans rien retirer
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Admin = require('./models/Admin');
const path = require('path');
const multer = require('multer');
const Creation = require('./models/Creation');
const Produit = require('./models/Produit');
const nodemailer = require('nodemailer');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('✅ Connecté à MongoDB'))
  .catch((err) => console.error('❌ Erreur MongoDB:', err));

const Contact = mongoose.model('Contact', new mongoose.Schema({
  nom: String,
  prenom: String,
  email: String,
  telephone: String,
  budget: String,
  usage: String,
  jeux: String,
  logiciels: String,
  usageType: String,
  tailleEntreprise: String,
  description: String,
  date: { type: Date, default: Date.now }
}));

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'veton.llukaj@l3forge.ch',
    pass: process.env.MAIL_PASS
  }
});

// ✅ Ajout de la route professionnelle REST /api/formulaire
app.post('/api/formulaire', async (req, res) => {
  const {
    nom, prenom, email, telephone, budget,
    usage, jeux, logiciels, type_client,
    taille_entreprise, infos_supplementaires
  } = req.body;

  try {
    const nouveauContact = new Contact({
      nom,
      prenom,
      email,
      telephone,
      budget,
      usage,
      jeux,
      logiciels,
      usageType: type_client,
      tailleEntreprise: taille_entreprise,
      description: infos_supplementaires
    });
    await nouveauContact.save();

    await transporter.sendMail({
      from: 'L3Forge <veton.llukaj@l3forge.ch>',
      to: 'veton.llukaj@l3forge.ch',
      subject: `Nouvelle demande - ${nom} ${prenom}`,
      text: `Nom : ${nom}\nPrénom : ${prenom}\nEmail : ${email}\nTéléphone : ${telephone}\nBudget : ${budget}\nUsage : ${usage}\nJeux : ${jeux}\nLogiciels : ${logiciels}\nType : ${type_client}\nTaille entreprise : ${taille_entreprise}\nDescription : ${infos_supplementaires}`
    });

    await transporter.sendMail({
      from: 'L3Forge <veton.llukaj@l3forge.ch>',
      to: email,
      subject: `Confirmation de votre demande - L3Forge`,
      text: `Bonjour ${prenom},\n\nMerci pour votre demande. Nous vous contacterons rapidement.\n\nRécapitulatif:\nNom : ${nom}\nPrénom : ${prenom}\nTéléphone : ${telephone}\nBudget : ${budget}\nUsage : ${usage}\nJeux : ${jeux}\nLogiciels : ${logiciels}\nType : ${type_client}\nTaille entreprise : ${taille_entreprise}\n\nDescription : ${infos_supplementaires}`
    });

    res.status(200).json({ msg: 'Message reçu et mails envoyés.' });
  } catch (err) {
    console.error('Erreur formulaire:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// 🔁 Tu peux laisser toutes tes autres routes actuelles ici

app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
});
