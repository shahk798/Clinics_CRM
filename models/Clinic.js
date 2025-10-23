const mongoose = require('mongoose');

const clinicSchema = new mongoose.Schema({
  clinicId: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  password: { type: String, required: true },
  name: { type: String } // Optional: clinic name for dashboard
});

module.exports = mongoose.model('Clinic', clinicSchema);
