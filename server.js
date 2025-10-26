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

// Schemas
const appointmentSchema = new mongoose.Schema({
  clinicId: { type: String, required: false }, // Make optional since WhatsApp bot might not set it
  name: String,
  phone: String,
  service: String,
  date: String,
  time: String,
  status: { type: String, default: 'Pending' }
}, { 
  collection: 'appointments',
  timestamps: true,
  strict: false // Allow additional fields from WhatsApp bot
});

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
    console.log('Fetching appointments for clinicId:', clinicId);
    if (!clinicId) return res.status(400).json({ message: 'Clinic ID required' });

    // Get appointments only (we're not using patients collection anymore)
    const appointments = await Appointment.find({
      $or: [
        { clinic_name: clinicId },
        { clinic_name: { $exists: false } }
      ]
    }).lean();

    console.log('Found appointments:', appointments.length);
    if (appointments.length > 0) {
      console.log('Sample appointment:', appointments[0]);
    }

    // Convert appointments to frontend format
    const formattedAppointments = appointments.map(a => ({
      _id: a._id,
      clinicId: a.clinic_name || clinicId,
      name: a.patient_name || '',
      phone: a.phone || '',
      email: a.email || '',
      service: a.service || '',
      price: a.price || 0,
      date: a.appointment_date || '',
      time: a.appointment_time || '',
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
    
    // Also save to Appointment collection with WhatsApp bot field names
    const appointmentData = {
      clinic_name: req.body.clinicId,
      patient_name: req.body.name,
      phone: req.body.phone,
      service: req.body.service,
      appointment_date: req.body.date,
      appointment_time: req.body.time,
      status: req.body.status || 'Pending'
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

    // Update appointment with correct field names
    const updateData = {
      clinic_name: req.body.clinicId,
      patient_name: req.body.name,
      phone: req.body.phone,
      email: req.body.email,
      service: req.body.service,
      price: req.body.price,
      appointment_date: req.body.date,
      appointment_time: req.body.time,
      status: req.body.status
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
    const appointments = await Appointment.find({});
    console.log('All appointments in DB:', appointments);
    res.json({
      count: appointments.length,
      appointments: appointments
    });
  } catch (err) {
    console.error('Error fetching appointments:', err);
    res.status(500).json({ error: err.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
