const express = require('express');
const router = express.Router();
const Clinic = require('../models/Clinic');

// Login
router.post('/login', async (req, res) => {
  try {
    const { clinicId, username, password } = req.body;
    const clinic = await Clinic.findOne({ clinicId, username, password });

    if (clinic) {
      res.json({ clinicId: clinic.clinicId, name: clinic.name });
    } else {
      res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Signup
router.post('/signup', async (req, res) => {
  try {
    const { clinic_name, username, clinicId, email, password } = req.body;

    // Check if clinic already exists
    const existingClinic = await Clinic.findOne({
      $or: [
        { clinicId },
        { email },
        { username }
      ]
    });

    if (existingClinic) {
      return res.status(400).json({ 
        message: 'A clinic with this ID, email, or username already exists' 
      });
    }

    // Create new clinic
    const clinic = new Clinic({
      name: clinic_name,
      clinicId,
      username,
      email,
      password
    });

    await clinic.save();
    res.status(201).json({ message: 'Clinic registered successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
