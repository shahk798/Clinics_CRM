const express = require('express');
const Clinic = require('../models/Clinic');

// Admin password
const ADMIN_PASSWORD = 'Lum005';

// Simple token generation (in production, use JWT)
function generateToken() {
  return Buffer.from(`admin:${Date.now()}`).toString('base64');
}

// Export a function that takes Patient model
module.exports = function(Patient) {
  const router = express.Router();

  // Admin login
  router.post('/login', async (req, res) => {
  try {
    const { password } = req.body;

    if (password === ADMIN_PASSWORD) {
      const token = generateToken();
      res.json({ 
        message: 'Admin login successful',
        token 
      });
    } else {
      res.status(401).json({ message: 'Invalid admin password' });
    }
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Middleware to verify admin token (simple version)
function verifyAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  // In production, verify JWT token properly
  // For now, just check if token exists
  next();
}

// Get all clinics
router.get('/clinics', verifyAdmin, async (req, res) => {
  try {
    const clinics = await Clinic.find({}).select('-password').sort({ createdAt: -1 });
    res.json(clinics);
  } catch (err) {
    console.error('Error fetching clinics:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all patients across all clinics
router.get('/all-patients', verifyAdmin, async (req, res) => {
  try {
    const patients = await Patient.find({}).sort({ date: -1 });
    res.json(patients);
  } catch (err) {
    console.error('Error fetching patients:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get statistics
router.get('/stats', verifyAdmin, async (req, res) => {
  try {
    const totalClinics = await Clinic.countDocuments();
    const totalPatients = await Patient.countDocuments();
    
    // Get today's appointments
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todayAppointments = await Patient.countDocuments({
      date: {
        $gte: today.toISOString().split('T')[0],
        $lt: tomorrow.toISOString().split('T')[0]
      }
    });

    // Calculate total revenue
    const patients = await Patient.find({});
    const totalRevenue = patients.reduce((sum, p) => sum + (p.price || 0), 0);

    res.json({
      totalClinics,
      totalPatients,
      todayAppointments,
      totalRevenue
    });
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get specific clinic details
router.get('/clinic/:clinicId', verifyAdmin, async (req, res) => {
  try {
    const { clinicId } = req.params;
    const clinic = await Clinic.findOne({ clinicId }).select('-password');
    const patients = await Patient.find({ clinicId });

    if (!clinic) {
      return res.status(404).json({ message: 'Clinic not found' });
    }

    const revenue = patients.reduce((sum, p) => sum + (p.price || 0), 0);

    res.json({
      clinic,
      patients,
      stats: {
        totalPatients: patients.length,
        revenue,
        completed: patients.filter(p => p.status === 'Complete').length,
        pending: patients.filter(p => p.status === 'Pending').length,
        cancelled: patients.filter(p => p.status === 'Cancelled').length
      }
    });
  } catch (err) {
    console.error('Error fetching clinic details:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

  return router;
};
