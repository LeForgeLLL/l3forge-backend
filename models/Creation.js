// models/Creation.js
const mongoose = require('mongoose');

const CreationSchema = new mongoose.Schema({
  titre: { type: String, required: false }, // titre devient facultatif
  imagePath: { type: String, required: true },
  date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Creation', CreationSchema);
