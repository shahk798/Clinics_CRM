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
app.use(express.static(path.join(__dirname, 'public')));
app.use('/frontend', express.static(path.join(__dirname, 'frontend')));

// Redirect root to login page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/login.html'));
});

// Expose a small clinic config endpoint used by the frontend
app.get('/api/clinic-config', (req, res) => {
  return res.json({ clinicId: process.env.CLINIC_ID || '' });
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

// Import Models
const Clinic = require('./models/Clinic');

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

const Patient = mongoose.model('Patient', patientSchema);

// Admin routes - loaded after Patient model is defined
const adminRoutes = require('./routes/admin');
app.use('/api/admin', adminRoutes);

// Auto-create clinic from .env if it doesn't exist (defined here but only called after DB connect)
async function createClinic() {
  const { CLINIC_ID, USERNAME, PASSWORD } = process.env;
  if (!CLINIC_ID || !USERNAME || !PASSWORD) return;

  try {
    const existing = await Clinic.findOne({ clinicId: CLINIC_ID });
    if (!existing) {
      const clinic = new Clinic({ 
        clinicId: CLINIC_ID, 
        username: USERNAME, 
        password: PASSWORD,
        dr_name: 'Admin',
        clinic_name: 'Default Clinic',
        email: 'admin@clinic.com',
        whatsapp_business_number: '0000000000'
      });
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

// Auth signup
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { 
      dr_name, 
      clinic_name, 
      contact_number, 
      whatsapp_business_number, 
      email, 
      username, 
      clinicId, 
      password 
    } = req.body;

    // Check if clinic already exists
    const existingClinic = await Clinic.findOne({ 
      $or: [{ username }, { clinicId }, { email }] 
    });

    if (existingClinic) {
      return res.status(400).json({ 
        message: 'A clinic with this username, email, or ID already exists' 
      });
    }

    // Create new clinic
    const newClinic = new Clinic({
      clinicId,
      dr_name,
      clinic_name,
      contact_number,
      whatsapp_business_number,
      email,
      username,
      password
    });

    await newClinic.save();

    res.status(201).json({ 
      message: 'Clinic registered successfully',
      clinicId: newClinic.clinicId 
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// Auth login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { clinicId, username, password } = req.body;
    const clinic = await Clinic.findOne({ clinicId, username, password });
    if (clinic) {
      res.json({ 
        clinicId: clinic.clinicId,
        name: clinic.clinic_name,
        dr_name: clinic.dr_name,
        email: clinic.email
      });
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
    if (!clinicId) return res.status(400).json({ message: 'Clinic ID required' });

    const patients = await Patient.find({ clinicId });
    res.json(patients);
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
