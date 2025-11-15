const mongoose = require('mongoose');

const clinicSchema = new mongoose.Schema({
  clinicId: { type: String, required: true, unique: true },
  dr_name: { type: String, required: true },
  clinic_name: { type: String, required: true },
  contact_number: { type: String },
  whatsapp_business_number: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Clinic', clinicSchema);
