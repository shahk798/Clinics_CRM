require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const { handleMessage } = require('./chatLogic');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ------------------ MongoDB Connection ------------------ //
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// ------------------ Models ------------------ //
const patientSchema = new mongoose.Schema({
  clinicId: String,
  name: String,
  phone: String,
  email: String,
  service: String,
  price: String,
  date: String,
  time: String,
  status: String
}, { timestamps: true });

const Patient = mongoose.model('Patient', patientSchema);

// ------------------ Clinics Config ------------------ //
const clinics = {}; // can be extended for multiple clinics
if (process.env.CLINIC_IDS && process.env.CLINIC_NAMES && process.env.CLINIC_CONTACTS) {
  const ids = process.env.CLINIC_IDS.split(',');
  const names = process.env.CLINIC_NAMES.split(',');
  const contacts = process.env.CLINIC_CONTACTS.split(',');
  ids.forEach((id, idx) => {
    clinics[id] = { clinic_name: names[idx], contact: contacts[idx], clinic_id: id };
  });
}

// ------------------ Serve Frontend ------------------ //
app.use(express.static(path.join(__dirname, 'public'))); // login.html, dashboard.html, js, css

// ------------------ API ROUTES ------------------ //

// Login
app.post('/api/auth/login', (req, res) => {
  const { clinicId, username, password } = req.body;
  // Simple auth: check clinicId exists
  if (!clinics[clinicId]) return res.status(400).json({ message: 'Invalid clinic ID' });
  // For demo, accept any username/password (replace with real auth later)
  return res.json({ clinicId, username });
});

// Get environment info (pre-fill login)
app.get('/api/env', (req, res) => {
  res.json({
    CLINIC_ID: process.env.CLINIC_IDS?.split(',')[0] || '',
    USERNAME: process.env.DEFAULT_USERNAME || ''
  });
});

// Get patients for a clinic
app.get('/api/patients', async (req, res) => {
  const { clinicId } = req.query;
  if (!clinicId) return res.status(400).json([]);
  const patients = await Patient.find({ clinicId }).sort({ createdAt: -1 });
  res.json(patients);
});

// Add patient
app.post('/api/patients', async (req, res) => {
  try {
    const patient = new Patient(req.body);
    await patient.save();
    res.json(patient);
  } catch (err) {
    res.status(500).json({ message: 'Error saving patient' });
  }
});

// Edit patient
app.put('/api/patients/:id', async (req, res) => {
  try {
    const patient = await Patient.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(patient);
  } catch (err) {
    res.status(500).json({ message: 'Error updating patient' });
  }
});

// Delete patient
app.delete('/api/patients/:id', async (req, res) => {
  try {
    await Patient.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting patient' });
  }
});

// ------------------ Chatbot Webhook ------------------ //
app.post('/webhook', async (req, res) => {
  const body = req.body;
  if (body.object === 'whatsapp_business_account') {
    for (const entry of body.entry) {
      for (const change of entry.changes) {
        const value = change.value;
        const messages = value.messages;
        if (messages) {
          for (const message of messages) {
            const from = message.from;
            const msgBody = message.text?.body || '';
            const phoneNumberId = value.metadata.phone_number_id;
            const clinicConfig = clinics[phoneNumberId];
            if (!clinicConfig) continue;
            try {
              await handleMessage(clinicConfig, from, msgBody);
            } catch (err) {
              console.error('Error handling chatbot message:', err);
            }
          }
        }
      }
    }
  }
  res.sendStatus(200);
});

// ------------------ Catch-all for frontend routing ------------------ //
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// ------------------ Start Server ------------------ //
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
