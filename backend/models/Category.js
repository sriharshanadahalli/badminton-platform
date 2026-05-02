const mongoose = require('mongoose');

const CategorySchema = new mongoose.Schema({
  categoryId: { type: String, required: true, unique: true, set: v => v ? v.toUpperCase() : v },
  categoryName: { type: String, required: true, set: v => v ? v.toUpperCase() : v }
}, { timestamps: true });

module.exports = mongoose.model('Category', CategorySchema);
