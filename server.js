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

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'frontend')));

// Redirect root to login page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/index.html'));
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
const appointmentSchema = new mongoose.Schema({
  clinicId: { type: String, required: true },
  name: String,
  phone: String,
  service: String,
  date: String,
  time: String,
  status: String
}, { collection: 'appointments' });

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

const userSchema = new mongoose.Schema({
  clinicId: { type: String, required: true },
  username: { type: String, required: true },
  password: { type: String, required: true }
});

const Patient = mongoose.model('Patient', patientSchema);
const User = mongoose.model('User', userSchema);
const Appointment = mongoose.model('Appointment', appointmentSchema);

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

// Get patients (by clinicId)
app.get('/api/patients', async (req, res) => {
  try {
    const { clinicId } = req.query;
    console.log('Fetching patients for clinicId:', clinicId);
    if (!clinicId) return res.status(400).json({ message: 'Clinic ID required' });

    // Get both patients and appointments
    const [patients, appointments] = await Promise.all([
      Patient.find({ clinicId }),
      Appointment.find({})  // Get all appointments first to debug
    ]);

    console.log('Found patients:', patients.length);
    console.log('Found appointments:', appointments.length);
    console.log('Sample appointment:', appointments[0]);

    // Combine both results, avoiding duplicates by phone number
    const phoneMap = new Map();
    
    // Add patients first
    patients.forEach(p => phoneMap.set(p.phone, p));
    
    // Add appointments
    appointments.forEach(a => {
      // Check if this appointment matches our clinicId
      if (a.clinicId === clinicId || !a.clinicId) {
        phoneMap.set(a.phone, {
          clinicId: clinicId,
          name: a.name,
          phone: a.phone,
          service: a.service,
          date: a.date,
          time: a.time,
          status: a.status || 'Pending'
        });
      }
    });

    // Convert map back to array
    const combined = Array.from(phoneMap.values());
    console.log('Total combined records:', combined.length);
    res.json(combined);
  } catch (err) {
    console.error('Error fetching patients/appointments:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add patient
app.post('/api/patients', async (req, res) => {
  try {
    const patient = new Patient(req.body);
    await patient.save();
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
