const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema({
  clinicId: { type: String, required: true },
  name: String,
  phone: String,
  email: String,
  service: String,
  price: Number,
  date: String,
  time: String,
  status: String
});

module.exports = mongoose.model('Patient', patientSchema);
