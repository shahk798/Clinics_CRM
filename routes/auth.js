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

module.exports = router;
