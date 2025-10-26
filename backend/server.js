require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

const path = require('path');

// Serve frontend static files (frontend lives at repo root ../frontend when backend is in /backend)
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

// Redirect root to frontend index
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Expose a small clinic config endpoint used by the frontend
app.get('/api/clinic-config', (req, res) => {
  try {
    console.log('Clinic config requested');
    return res.json({ clinicId: process.env.CLINIC_ID || '' });
  } catch (err) {
    console.error('Error in clinic-config:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});



// MongoDB connection
const mongoUri = process.env.MONGO_URI;
if (!mongoUri) {
  console.warn('⚠️  MONGO_URI is not set. Database features will be disabled. To enable, set MONGO_URI in your .env (e.g. mongodb://localhost:27017/clinics_db)');
} else {
  mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  .then(async () => {
    console.log("✅ MongoDB Connected");
    // Auto-create clinic from .env if it doesn't exist (only after DB connect)
    await createClinic();
  })
  .catch(err => console.error("❌ MongoDB Connection Error:", err));
}

// Schemas
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

// Appointment schema (also store a copy of patient data for integration with whatsapp_chatbot)
const appointmentSchema = new mongoose.Schema({
  clinicId: String,
  clinicName: String,
  patient_name: String,
  name: String,
  phone: String,
  email: String,
  service: String,
  price: Number,
  appointment_date: String,
  appointment_time: String,
  date: String,
  time: String,
  status: String
}, { timestamps: true });

const userSchema = new mongoose.Schema({
  clinicId: { type: String, required: true },
  username: { type: String, required: true },
  password: { type: String, required: true }
});

const Patient = mongoose.model('Patient', patientSchema);
// Use a generic 'appointments' collection for cross-app data; if you prefer clinic-specific collections change the third arg
const Appointment = mongoose.model('Appointment', appointmentSchema, 'appointments');
const User = mongoose.model('User', userSchema);

// Auto-create clinic from .env if it doesn't exist (defined here but only called after DB connect)
async function createClinic() {
  const { CLINIC_ID, USERNAME, PASSWORD } = process.env;
  if (!CLINIC_ID || !USERNAME || !PASSWORD) return;

  try {
    const existing = await User.findOne({ clinicId: CLINIC_ID });
    if (!existing) {
      const clinic = new User({ clinicId: CLINIC_ID, username: USERNAME, password: PASSWORD });
      await clinic.save();
      console.log(`✅ Clinic created: ${CLINIC_ID}`);
    } else {
      console.log(`ℹ️ Clinic already exists: ${CLINIC_ID}`);
    }
  } catch (err) {
    console.error('❌ Error creating clinic during initialization:', err.message || err);
  }
}

// Routes

// Auth login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username, password });
    if (user) {
      res.json({ clinicId: user.clinicId });
    } else {
      res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get patients (by clinicId) — combined from Patients collection and shared Appointments collection
app.get('/api/patients', async (req, res) => {
  try {
    const { clinicId } = req.query;
    if (!clinicId) return res.status(400).json({ message: 'Clinic ID required' });

    // Fetch patients stored in Clinics_CRM
    const patients = await Patient.find({ clinicId }).lean();

    // Fetch shared appointments (from whatsapp_chatbot or other sources)
    const appts = await Appointment.find({ clinicId }).lean();

    // Normalize appointments to the same shape as patients
    const apptMapped = appts.map(a => ({
      _id: a._id,
      clinicId: a.clinicId,
      name: a.name || a.patient_name || '',
      phone: a.phone || '',
      email: a.email || '',
      service: a.service || '',
      price: a.price || 0,
      date: a.appointment_date || a.date || '',
      time: a.appointment_time || a.time || '',
      status: a.status || ''
    }));

    // Combine and sort by date/time (newest first)
    const combined = patients.map(p => ({
      _id: p._id,
      clinicId: p.clinicId,
      name: p.name,
      phone: p.phone,
      email: p.email,
      service: p.service,
      price: p.price,
      date: p.date,
      time: p.time,
      status: p.status
    })).concat(apptMapped);

    combined.sort((a, b) => {
      const ta = new Date((a.date || '') + ' ' + (a.time || '00:00'));
      const tb = new Date((b.date || '') + ' ' + (b.time || '00:00'));
      return tb - ta;
    });

    res.json(combined);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add patient
app.post('/api/patients', async (req, res) => {
  try {
    const patient = new Patient(req.body);
    await patient.save();

    // Also store a copy in the shared appointments collection for integration
    try {
      const clinicName = process.env.CLINIC_NAME || process.env.CLINIC_ID || '';
      const appt = new Appointment({
        clinicId: patient.clinicId,
        clinicName,
        patient_name: patient.name,
        name: patient.name,
        phone: patient.phone,
        email: patient.email,
        service: patient.service,
        price: patient.price,
        appointment_date: patient.date,
        appointment_time: patient.time,
        date: patient.date,
        time: patient.time,
        status: patient.status
      });
      await appt.save();
    } catch (apptErr) {
      console.warn('Warning: failed to save appointment copy:', apptErr.message || apptErr);
    }

    res.json(patient);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to add patient' });
  }
});

// Update patient
app.put('/api/patients/:id', async (req, res) => {
  try {
    const updated = await Patient.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to update patient' });
  }
});

// Delete patient
app.delete('/api/patients/:id', async (req, res) => {
  try {
    await Patient.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to delete patient' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
