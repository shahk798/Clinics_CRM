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

// Debug endpoint to check appointments collection
app.get('/api/debug/appointments', async (req, res) => {
  try {
    // List all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Available collections:', collections.map(c => c.name));
    
    // Get model info
    const modelInfo = {
      modelName: Appointment.modelName,
      collectionName: Appointment.collection.collectionName,
      database: mongoose.connection.name,
      schemaFields: Object.keys(Appointment.schema.paths)
    };
    console.log('Appointment model info:', modelInfo);
    
    // Try direct MongoDB query
    const directResults = await mongoose.connection.db.collection('appointments').find({}).toArray();
    console.log('Direct MongoDB query results:', directResults.length);
    
    // Get all appointments through Mongoose
    const appointments = await Appointment.find({}).lean();
    console.log('Mongoose query results:', appointments.length);
    
    res.json({
      modelInfo,
      collections: collections.map(c => c.name),
      directCount: directResults.length,
      mongooseCount: appointments.length,
      appointments: appointments
    });
  } catch (err) {
    console.error('Error in debug endpoint:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get patients (by clinicId)
app.get('/api/patients', async (req, res) => {
  try {
    const { clinicId } = req.query;
    console.log('Fetching appointments for clinicId:', clinicId);
    if (!clinicId) return res.status(400).json({ message: 'Clinic ID required' });

    // Get all appointments to debug
    const allAppointments = await Appointment.find({}).lean();
    console.log('All appointments in DB:', allAppointments);

    // Now get filtered appointments
    const appointments = await Appointment.find({
      $or: [
        { clinicId },
        { clinic_name: clinicId },
        { clinic_name: { $exists: false } },
        { clinic_name: null },
        { clinic_name: '' }
      ]
    }).lean();

    // Format appointments for frontend
    const formattedAppointments = appointments.map(a => ({
      _id: a._id,
      clinic_name: a.clinic_name || a.clinicId || clinicId,
      patient_name: a.patient_name || a.name || '',
      phone: a.phone || '',
      email: a.email || '',
      service: a.service || '',
      price: a.price || 0,
      appointment_date: a.appointment_date || a.date || '',
      appointment_time: a.appointment_time || a.time || '',
      status: a.status || 'Pending',
      source: a.source || 'whatsapp'
    }));

    // Sort by date/time (newest first)
    formattedAppointments.sort((a, b) => {
      const ta = new Date((a.appointment_date || '') + ' ' + (a.appointment_time || '00:00'));
      const tb = new Date((b.appointment_date || '') + ' ' + (b.appointment_time || '00:00'));
      return tb - ta;
    });

    console.log('Sending formatted appointments:', formattedAppointments.length);
    res.json(formattedAppointments);
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

    // Store in appointments collection with consistent field names
    try {
      const appt = new Appointment({
        clinic_name: req.body.clinicId,
        patient_name: req.body.patient_name,
        phone: req.body.phone,
        email: req.body.email,
        service: req.body.service,
        price: req.body.price,
        appointment_date: req.body.appointment_date,
        appointment_time: req.body.appointment_time,
        status: req.body.status || 'Pending',
        source: 'dashboard'
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
