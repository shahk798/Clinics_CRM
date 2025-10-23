const express = require('express');
const router = express.Router();
const Clinic = require('../models/Clinic');

// Get clinic config by clinicId
router.get('/config/:clinicId', async (req, res) => {
  try {
    const clinic = await Clinic.findOne({ clinicId: req.params.clinicId });
    if (!clinic) return res.status(404).json({ message: "Clinic not found" });

    res.json({
      clinicId: clinic.clinicId,
      username: clinic.username,
      name: clinic.name || ""
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
