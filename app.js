// backend/app.js
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
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Connexion MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connexion MongoDB réussie !'))
  .catch(err => console.error('❌ Erreur MongoDB:', err));

// Middleware token
function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(403).json({ msg: 'Aucun token fourni' });
  try {
    const decoded = jwt.verify(token, 'L3ForgeSuperSecretKey123!');
    req.adminId = decoded.id;
    next();
  } catch (err) {
    return res.status(401).json({ msg: 'Token invalide' });
  }
}

// Nodemailer avec Infomaniak (SSL - port 465)
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT),
  secure: true, // SSL = true (obligatoire sur le port 465)
  auth: {
    user: process.env.EMAIL_USER?.trim(),
    pass: process.env.EMAIL_PASS?.trim()
  }
});



// MongoDB - Schéma des demandes
const ContactSchema = new mongoose.Schema({
  nom: String, prenom: String, email: String, telephone: String,
  budget: String, usage: String, jeux: String, logiciels: String,
  usageType: String, tailleEntreprise: String, description: String,
  date: { type: Date, default: Date.now }
});
const Contact = mongoose.model('Contact', ContactSchema);

// 📩 Route pour traiter le formulaire
app.post('/api/formulaire', async (req, res) => {
  const {
    nom, prenom, email, telephone,
    budget, usage, jeux, logiciels,
    type_client, taille_entreprise, infos_supplementaires
  } = req.body;

  try {
    // Enregistrement dans MongoDB
    const nouveauContact = new Contact({
      nom, prenom, email, telephone,
      budget, usage, jeux, logiciels,
      usageType: type_client,
      tailleEntreprise: taille_entreprise,
      description: infos_supplementaires
    });
    await nouveauContact.save();

    // Transport SMTP (Infomaniak)
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT),
      secure: true,
      auth: {
        user: process.env.EMAIL_USER?.trim(),
        pass: process.env.EMAIL_PASS?.trim()
      }
    });

    // Mail vers toi
    await transporter.sendMail({
      from: `"L3Forge" <${process.env.EMAIL_USER}>`,
      to: 'veton.llukaj@l3forge.ch',
      subject: `Nouvelle demande - ${nom} ${prenom}`,
      text: `Nom : ${nom}
Prénom : ${prenom}
Email : ${email}
Téléphone : ${telephone}
Budget : ${budget}
Usage : ${usage}
Jeux : ${jeux}
Logiciels : ${logiciels}
Type : ${type_client}
Taille entreprise : ${taille_entreprise}
Infos : ${infos_supplementaires}`
    });

    // Mail au client
    await transporter.sendMail({
      from: `"L3Forge" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `Confirmation de votre demande - L3Forge`,
      text: `Bonjour ${prenom},
Merci pour votre demande, nous vous recontacterons rapidement.

Récapitulatif :
Nom : ${nom}
Prénom : ${prenom}
Téléphone : ${telephone}
Budget : ${budget}
Usage : ${usage}
Jeux : ${jeux}
Logiciels : ${logiciels}
Type : ${type_client}
Taille entreprise : ${taille_entreprise}

Description : ${infos_supplementaires}
      `
    });

    res.status(200).json({ msg: 'Message enregistré et mails envoyés.' });

  } catch (err) {
    console.error('Erreur formulaire:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});


// Admin Login
app.post('/admin/login', async (req, res) => {
  const { username, password } = req.body;
  const admin = await Admin.findOne({ username });
  if (!admin || !(await bcrypt.compare(password, admin.password))) return res.status(401).json({ msg: 'Connexion invalide' });
  const token = jwt.sign({ id: admin._id }, 'L3ForgeSuperSecretKey123!', { expiresIn: '1h' });
  res.json({ token });
});

// Messages
app.get('/admin/messages', verifyToken, async (req, res) => {
  try {
    const messages = await Contact.find().sort({ date: -1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ msg: 'Erreur serveur' });
  }
});
app.delete('/admin/messages/:id', verifyToken, async (req, res) => {
  try {
    await Contact.findByIdAndDelete(req.params.id);
    res.json({ msg: 'Message supprimé' });
  } catch (err) {
    res.status(500).json({ msg: 'Erreur serveur' });
  }
});

// Créations
app.post('/admin/creations', verifyToken, upload.single('image'), async (req, res) => {
  try {
    const imagePath = `/uploads/${req.file.filename}`;
    const titre = req.body.titre || 'Création L3Forge';
    const creation = new Creation({ titre, imagePath });
    await creation.save();
    res.status(200).json({ msg: 'Création ajoutée', creation });
  } catch (err) {
    res.status(500).json({ msg: 'Erreur serveur' });
  }
});
app.get('/creations', async (req, res) => {
  try {
    const creations = await Creation.find().sort({ date: -1 });
    res.json(creations);
  } catch (err) {
    res.status(500).json({ msg: 'Erreur serveur' });
  }
});
app.delete('/admin/creations/:id', verifyToken, async (req, res) => {
  try {
    const creation = await Creation.findById(req.params.id);
    if (!creation) return res.status(404).json({ msg: 'Introuvable' });
    fs.unlink(__dirname + creation.imagePath, () => {});
    await creation.deleteOne();
    res.json({ msg: 'Supprimé' });
  } catch (err) {
    res.status(500).json({ msg: 'Erreur serveur' });
  }
});

// Produits
app.post('/admin/produits', verifyToken, upload.single('image'), async (req, res) => {
  try {
    const { nom, description, prix, lien } = req.body;
    const imagePath = `/uploads/${req.file.filename}`;
    const produit = new Produit({ nom, description, prix, lien, imagePath });
    await produit.save();
    res.status(200).json({ msg: "Produit ajouté", produit });
  } catch (err) {
    console.error('Erreur ajout produit :', err);
    res.status(500).json({ msg: "Erreur serveur" });
  }
});
app.get('/produits', async (req, res) => {
  try {
    const produits = await Produit.find().sort({ date: -1 });
    res.json(produits);
  } catch (err) {
    res.status(500).json({ msg: "Erreur serveur" });
  }
});
// backend/app.js
app.delete('/admin/produits/:id', verifyToken, async (req, res) => {
  try {
    const produit = await Produit.findById(req.params.id);
    if (!produit) return res.status(404).json({ msg: 'Produit non trouvé' });

    const fs = require('fs');
    const imagePath = path.join(__dirname, produit.imagePath);

    fs.unlink(imagePath, (err) => {
      if (err) console.error("Erreur suppression image :", err);
    });

    await Produit.findByIdAndDelete(req.params.id); //✅ Correction ici
    res.json({ msg: "Produit supprimé" });
  } catch (err) {
    console.error("Erreur suppression produit :", err);
    res.status(500).json({ msg: "Erreur serveur" });
  }
});



// Start server
app.listen(5000, () => console.log('🚀 Serveur démarré sur le port 5000'));

// 📩 Route pour recevoir les demandes de formulaire
app.post('/api/formulaire', async (req, res) => {
  try {
    const data = req.body;

    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT),
      secure: true, // SSL (port 465)
      auth: {
        user: process.env.EMAIL_USER?.trim(),
        pass: process.env.EMAIL_PASS?.trim()
      }
    });

    const mailOptions = {
      from: `"L3Forge" <${process.env.EMAIL_USER}>`,
      to: 'veton.llukaj@l3forge.ch',
      subject: 'Nouvelle demande de configuration',
      text: `
Nom : ${data.nom}
Prénom : ${data.prenom}
Téléphone : ${data.telephone}
Email : ${data.email}
Budget : ${data.budget}
Usage : ${data.usage}
Jeux : ${data.jeux}
Logiciels : ${data.logiciels}
Type : ${data.type_client}
Taille entreprise : ${data.taille_entreprise}
Description : ${data.infos_supplementaires}
      `
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ msg: "Message envoyé !" });

  } catch (err) {
    console.error("Erreur formulaire:", err);
    res.status(500).json({ msg: "Erreur lors de l'envoi du formulaire." });
  }
});
