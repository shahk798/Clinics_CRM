const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  clinic_name: String,
  patient_name: String,
  phone: String,
  email: String,
  service: String,
  price: { type: Number, default: 0 },
  appointment_date: String,
  appointment_time: String,
  status: { type: String, enum: ['pending', 'complete', 'cancel'], default: 'pending' },
  source: { type: String, enum: ['whatsapp', 'dashboard'], default: 'dashboard' }
}, { 
  collection: 'appointments',
  timestamps: true 
});

module.exports = mongoose.model('Appointment', appointmentSchema);