const express = require('express');
const router = express.Router();
const Clinic = require('../models/Clinic');

// Signup
router.post('/signup', async (req, res) => {
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

    // Check if clinic with same email or username already exists
    const existingClinic = await Clinic.findOne({ 
      $or: [{ email }, { username }, { clinicId }] 
    });

    if (existingClinic) {
      return res.status(400).json({ 
        message: 'Clinic with this email, username, or ID already exists' 
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
      password // Note: In production, hash this password using bcrypt
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

// Login
router.post('/login', async (req, res) => {
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

module.exports = router;
