const mongoose = require('mongoose');

const ProduitSchema = new mongoose.Schema({
  nom: { type: String, required: true },
  description: { type: String, required: true },
  prix: { type: Number, required: true },
  imagePath: { type: String, required: true },
  lien: { type: String },
  date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Produit', ProduitSchema);
