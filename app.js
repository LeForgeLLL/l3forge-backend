// backend/app.js avec Cloudinary intégré proprement
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Admin = require('./models/Admin');
const path = require('path');
const nodemailer = require('nodemailer');
const fs = require('fs');
require('dotenv').config();

// 📦 Cloudinary (stockage cloud)
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
const Creation = require('./models/Creation');
const Produit = require('./models/Produit');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'l3forge',
    format: async (req, file) => 'jpg',
    public_id: (req, file) => Date.now() + '-' + file.originalname.split('.')[0]
  }
});
const upload = multer({ storage });

const app = express();
app.use(cors());
app.use(express.json());

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

// 📩 Transport mail via Infomaniak
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT),
  secure: true,
  auth: {
    user: process.env.EMAIL_USER?.trim(),
    pass: process.env.EMAIL_PASS?.trim()
  }
});

// 📬 Formulaire de contact
const ContactSchema = new mongoose.Schema({
  nom: String, prenom: String, email: String, telephone: String,
  budget: String, usage: String, jeux: String, logiciels: String,
  usageType: String, tailleEntreprise: String, description: String,
  date: { type: Date, default: Date.now }
});
const Contact = mongoose.model('Contact', ContactSchema);

app.post('/api/formulaire', async (req, res) => {
  const {
    nom, prenom, email, telephone,
    budget, usage, jeux, logiciels,
    type_client, taille_entreprise, infos_supplementaires
  } = req.body;
  try {
    const nouveauContact = new Contact({
      nom, prenom, email, telephone,
      budget, usage, jeux, logiciels,
      usageType: type_client,
      tailleEntreprise: taille_entreprise,
      description: infos_supplementaires
    });
    await nouveauContact.save();

    await transporter.sendMail({
      from: `"L3Forge" <${process.env.EMAIL_USER}>`,
      to: 'veton.llukaj@l3forge.ch',
      subject: `Nouvelle demande - ${nom} ${prenom}`,
      text: `Nom : ${nom}\nPrénom : ${prenom}\nEmail : ${email}\nTéléphone : ${telephone}\nBudget : ${budget}\nUsage : ${usage}\nJeux : ${jeux}\nLogiciels : ${logiciels}\nType : ${type_client}\nTaille entreprise : ${taille_entreprise}\nInfos : ${infos_supplementaires}`
    });

    await transporter.sendMail({
      from: `"L3Forge" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `Confirmation de votre demande - L3Forge`,
      text: `Bonjour ${prenom},\nMerci pour votre demande, nous vous recontacterons rapidement.`
    });

    res.status(200).json({ msg: 'Message enregistré et mails envoyés.' });
  } catch (err) {
    console.error('Erreur formulaire:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// 🔐 Connexion Admin
app.post('/admin/login', async (req, res) => {
  const { username, password } = req.body;
  const admin = await Admin.findOne({ username });
  if (!admin || !(await bcrypt.compare(password, admin.password))) return res.status(401).json({ msg: 'Connexion invalide' });
  const token = jwt.sign({ id: admin._id }, 'L3ForgeSuperSecretKey123!', { expiresIn: '1h' });
  res.json({ token });
});

// 📬 Liste des messages
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

// 📸 Créations (Portfolio)
app.post('/admin/creations', verifyToken, upload.single('image'), async (req, res) => {
  try {
    const titre = req.body.titre || 'Création L3Forge';
    const imagePath = req.file.path;
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
    await creation.deleteOne();
    res.json({ msg: 'Création supprimée' });
  } catch (err) {
    res.status(500).json({ msg: 'Erreur serveur' });
  }
});

// 🛒 Produits Boutique
app.post('/admin/produits', verifyToken, upload.single('image'), async (req, res) => {
  try {
    const { nom, description, prix, lien } = req.body;
    const imagePath = req.file.path;
    const produit = new Produit({ nom, description, prix, lien, imagePath });
    await produit.save();
    res.status(200).json({ msg: 'Produit ajouté', produit });
  } catch (err) {
    console.error('Erreur ajout produit :', err);
    res.status(500).json({ msg: 'Erreur serveur' });
  }
});

app.get('/produits', async (req, res) => {
  try {
    const produits = await Produit.find().sort({ date: -1 });
    res.json(produits);
  } catch (err) {
    res.status(500).json({ msg: 'Erreur serveur' });
  }
});

app.delete('/admin/produits/:id', verifyToken, async (req, res) => {
  try {
    const produit = await Produit.findById(req.params.id);
    if (!produit) return res.status(404).json({ msg: 'Produit non trouvé' });
    await Produit.findByIdAndDelete(req.params.id);
    res.json({ msg: 'Produit supprimé' });
  } catch (err) {
    console.error('Erreur suppression produit :', err);
    res.status(500).json({ msg: 'Erreur serveur' });
  }
});

// 🚀 Lancement serveur
app.listen(5000, () => console.log('🚀 Serveur démarré sur le port 5000'));
