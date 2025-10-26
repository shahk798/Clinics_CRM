const mongoose = require('mongoose');
require('dotenv').config();

// Define schemas
const appointmentSchema = new mongoose.Schema({
  clinicId: String,
  name: String,
  phone: String,
  service: String,
  date: String,
  time: String,
  status: String
}, { 
  collection: 'appointments',
  strict: false // Allow extra fields
});

const patientSchema = new mongoose.Schema({
  clinicId: String,
  name: String,
  phone: String,
  email: String,
  service: String,
  price: Number,
  date: String,
  time: String,
  status: String
}, { strict: false });

// Create models
const Appointment = mongoose.model('Appointment', appointmentSchema);
const Patient = mongoose.model('Patient', patientSchema);

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('❌ MONGO_URI not found in .env');
    process.exit(1);
  }

  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB\n');

    // Get all collections info
    const db = mongoose.connection.db;
    const cols = await db.listCollections().toArray();
    console.log('📁 Database Collections:');
    for (const c of cols) {
      const count = await db.collection(c.name).countDocuments();
      console.log(` - ${c.name}: ${count} documents`);
    }
    console.log('');

    // Check appointments
    console.log('🔍 Checking appointments collection...');
    const appointments = await Appointment.find({});
    console.log(`Found ${appointments.length} appointments`);
    
    if (appointments.length > 0) {
      // Group by status
      const statusCounts = {};
      appointments.forEach(a => {
        statusCounts[a.status || 'No Status'] = (statusCounts[a.status || 'No Status'] || 0) + 1;
      });
      console.log('Appointments by status:', statusCounts);

      // Show latest appointment
      const latest = appointments[appointments.length - 1];
      console.log('\nMost recent appointment:');
      console.log(JSON.stringify(latest, null, 2));
    }

    // Check patients
    console.log('\n🔍 Checking patients collection...');
    const patients = await Patient.find({});
    console.log(`Found ${patients.length} patients`);
    
    if (patients.length > 0) {
      // Group by clinic
      const clinicCounts = {};
      patients.forEach(p => {
        clinicCounts[p.clinicId || 'No Clinic'] = (clinicCounts[p.clinicId || 'No Clinic'] || 0) + 1;
      });
      console.log('Patients by clinic:', clinicCounts);

      // Show latest patient
      const latest = patients[patients.length - 1];
      console.log('\nMost recent patient:');
      console.log(JSON.stringify(latest, null, 2));
    }

    // Check for matches
    if (appointments.length > 0 && patients.length > 0) {
      console.log('\n🔄 Cross-referencing records...');
      const matchingPhones = appointments.filter(a => 
        patients.some(p => p.phone === a.phone)
      );
      console.log(`Found ${matchingPhones.length} appointments with matching patient records`);
    }

    await mongoose.disconnect();
    console.log('\n👋 Database connection closed');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message || err);
    process.exit(2);
  }
}

main();
