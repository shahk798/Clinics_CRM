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

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log("✅ MongoDB Connected"))
.catch(err => console.error("❌ MongoDB Connection Error:", err));

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

const userSchema = new mongoose.Schema({
  clinicId: { type: String, required: true },
  username: { type: String, required: true },
  password: { type: String, required: true }
});

const Patient = mongoose.model('Patient', patientSchema);
const User = mongoose.model('User', userSchema);

// Auto-create clinic from .env if it doesn't exist
async function createClinic() {
  const { CLINIC_ID, USERNAME, PASSWORD } = process.env;
  if (!CLINIC_ID || !USERNAME || !PASSWORD) return;

  const existing = await User.findOne({ clinicId: CLINIC_ID });
  if (!existing) {
    const clinic = new User({ clinicId: CLINIC_ID, username: USERNAME, password: PASSWORD });
    await clinic.save();
    console.log(`✅ Clinic created: ${CLINIC_ID}`);
  } else {
    console.log(`ℹ️ Clinic already exists: ${CLINIC_ID}`);
  }
}
createClinic();

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
