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
  console.warn('⚠️  MONGO_URI is not set. Database features will be disabled. To enable, set MONGO_URI in your .env');
} else {
  console.log('Connecting to MongoDB...');
  mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  .then(async () => {
    console.log("✅ MongoDB Connected");
    
    // List all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Available collections:', collections.map(c => c.name));
    
    // Check appointment collection exists
    const hasAppointments = collections.some(c => c.name === 'appointments');
    console.log('Found appointments collection:', hasAppointments);
    
    // Get the actual collection name used by the model
    const Appointment = require('./models/Appointment');
    console.log('Appointment model collection name:', Appointment.collection.collectionName);
    
    // Count documents in appointments collection
    const appointmentsCount = await Appointment.countDocuments();
    console.log(`Found ${appointmentsCount} documents in appointments collection`);
    
    if (appointmentsCount > 0) {
      const sampleAppointment = await Appointment.findOne();
      console.log('Sample appointment:', sampleAppointment);
    }
    
    // Auto-create clinic from .env if it doesn't exist
    await createClinic();
  })
  .catch(err => console.error("❌ MongoDB Connection Error:", err));
}

// Import models
const Appointment = require('./models/Appointment');
console.log('Loaded Appointment model with collection:', Appointment.collection.collectionName);

const userSchema = new mongoose.Schema({
  clinicId: { type: String, required: true },
  username: { type: String, required: true },
  password: { type: String, required: true }
});

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

// Get patients (by clinicId)
app.get('/api/patients', async (req, res) => {
  try {
    const { clinicId } = req.query;
    console.log('Fetching appointments for clinicId:', clinicId);
    if (!clinicId) return res.status(400).json({ message: 'Clinic ID required' });

    // First get all appointments to debug
    const allAppointments = await Appointment.find({}).lean();
    console.log('All appointments in DB:', allAppointments);

    // Now get filtered appointments
    const appointments = await Appointment.find({
      $or: [
        { clinic_name: clinicId },
        { clinic_name: { $exists: false } },
        { clinic_name: null },
        { clinic_name: '' }
      ]
    }).lean();

    console.log('Found appointments:', appointments.length);
    if (appointments.length > 0) {
      console.log('Sample appointment:', appointments[0]);
    }

    // Keep original field names from appointments collection
    const formattedAppointments = appointments.map(a => ({
      _id: a._id,
      clinic_name: a.clinic_name || clinicId,
      patient_name: a.patient_name || '',
      phone: a.phone || '',
      email: a.email || '',
      service: a.service || '',
      price: a.price || 0,
      appointment_date: a.appointment_date || '',
      appointment_time: a.appointment_time || '',
      status: a.status || 'Pending',
      source: a.source || 'whatsapp'
    }));

    console.log('Formatted appointments:', formattedAppointments.length);
    if (formattedAppointments.length > 0) {
      console.log('Sample formatted appointment:', formattedAppointments[0]);
    }
    
    res.json(formattedAppointments);
  } catch (err) {
    console.error('Error fetching patients/appointments:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add patient
app.post('/api/patients', async (req, res) => {
  try {
    console.log('Received patient data:', req.body);
    
    // Save to Patient collection
    const patient = new Patient(req.body);
    await patient.save();
    
    // Save to Appointment collection with consistent field names
    const appointmentData = {
      clinic_name: req.body.clinic_name,
      patient_name: req.body.patient_name,
      phone: req.body.phone,
      email: req.body.email,
      service: req.body.service,
      price: req.body.price,
      appointment_date: req.body.appointment_date,
      appointment_time: req.body.appointment_time,
      status: req.body.status || 'Pending',
      source: req.body.source || 'dashboard'
    };
    
    console.log('Saving to appointments:', appointmentData);
    const appointment = new Appointment(appointmentData);
    await appointment.save();
    
    console.log('Saved to both collections successfully');
    res.json(patient);
  } catch (err) {
    console.error('Error saving patient/appointment:', err);
    res.status(500).json({ message: 'Failed to add patient' });
  }
});

// Update patient (in appointments collection)
app.put('/api/patients/:id', async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Update appointment with consistent field names
    const updateData = {
      clinic_name: req.body.clinic_name,
      patient_name: req.body.patient_name,
      phone: req.body.phone,
      email: req.body.email,
      service: req.body.service,
      price: req.body.price,
      appointment_date: req.body.appointment_date,
      appointment_time: req.body.appointment_time,
      status: req.body.status,
      source: req.body.source || 'dashboard'
    };

    const updated = await Appointment.findByIdAndUpdate(
      req.params.id, 
      updateData,
      { new: true }
    );

    console.log('Updated appointment:', updated);
    res.json(updated);
  } catch (err) {
    console.error('Error updating appointment:', err);
    res.status(500).json({ message: 'Failed to update appointment' });
  }
});

// Delete patient (from appointments collection)
app.delete('/api/patients/:id', async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Delete from Appointments collection
    await Appointment.findByIdAndDelete(req.params.id);

    console.log('Deleted appointment:', req.params.id);
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    console.error('Error deleting appointment:', err);
    res.status(500).json({ message: 'Failed to delete appointment' });
  }
});

// Debug endpoint to check appointments collection
app.get('/api/debug/appointments', async (req, res) => {
  try {
    // List all collections first
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Available collections:', collections.map(c => c.name));
    
    // Get model info
    const modelInfo = {
      modelName: Appointment.modelName,
      collectionName: Appointment.collection.collectionName,
      database: Appointment.db.name,
      schemaFields: Object.keys(Appointment.schema.paths)
    };
    console.log('Appointment model info:', modelInfo);
    
    // Try direct MongoDB query first
    const db = mongoose.connection.db;
    const directResults = await db.collection('appointments').find({}).toArray();
    console.log('Direct MongoDB query results:', directResults.length);
    
    // Get all appointments through Mongoose
    const appointments = await Appointment.find({}).lean();
    console.log('Mongoose query results:', appointments.length);
    
    // Get schema info
    const schemaInfo = Object.keys(Appointment.schema.paths).map(path => ({
      field: path,
      type: Appointment.schema.paths[path].instance
    }));
    
    res.json({
      modelInfo,
      collections: collections.map(c => c.name),
      schema: schemaInfo,
      directCount: directResults.length,
      mongooseCount: appointments.length,
      appointments: appointments
    });
  } catch (err) {
    console.error('Error in debug endpoint:', err);
    res.status(500).json({ error: err.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
