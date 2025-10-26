// Client-side script for dashboard UI
document.addEventListener('DOMContentLoaded', () => {
  const apiBase = 'https://clinics-crm.onrender.com'; // backend (Render)
  const clinicId = localStorage.getItem('clinicId');
  if (!clinicId) return window.location.href = 'login.html';

  // Elements
  const patientTableBody = document.querySelector('#patientTable tbody');
  const totalPatientsEl = document.getElementById('totalPatients');
  const totalRevenueEl = document.getElementById('totalRevenue');
  const addPatientBtn = document.getElementById('addPatientBtn');
  const patientModal = document.getElementById('patientModal');
  const profileModal = document.getElementById('profileModal');
  const patientForm = document.getElementById('patientForm');
  const modalTitle = document.getElementById('modalTitle');
  const closeModal = document.getElementById('closeModal');
  const closeProfile = document.getElementById('closeProfile');
  const reportBtn = document.getElementById('reportBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const searchInput = document.getElementById('searchInput');

  let patients = [];
  let editingId = null;

  // Fetch patients
  async function fetchPatients() {
    try {
      const res = await fetch(`${apiBase}/api/patients?clinicId=${encodeURIComponent(clinicId)}`);
      if (!res.ok) throw new Error('Failed to load patients');
      patients = await res.json();
      renderPatients(patients);
    } catch (err) {
      console.error(err);
      alert('Error loading patients');
    }
  }

  function renderPatients(list) {
    patientTableBody.innerHTML = '';
    let revenue = 0;
    list.forEach(p => {
      revenue += Number(p.price || 0);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(p.name)}</td>
        <td>${escapeHtml(p.phone)}</td>
        <td>${escapeHtml(p.email)}</td>
        <td>${escapeHtml(p.service)}</td>
        <td>₹${p.price || 0}</td>
        <td>${p.date || ''}</td>
        <td>${p.time || ''}</td>
        <td>${p.status || ''}</td>
        <td>
          <button class="btn-small" data-action="view" data-id="${p._id}">View</button>
          <button class="btn-small" data-action="edit" data-id="${p._id}">Edit</button>
          <button class="btn-small btn-danger" data-action="delete" data-id="${p._id}">Delete</button>
        </td>
      `;
      patientTableBody.appendChild(tr);
    });
    totalPatientsEl.innerText = list.length;
    totalRevenueEl.innerText = revenue;
  }

  // Escape helper
  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>\"]+/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s]));
  }

  // Open modal
  addPatientBtn.addEventListener('click', () => {
    editingId = null;
    modalTitle.innerText = 'Add Patient';
    patientForm.reset();
    patientModal.style.display = 'block';
  });

  closeModal.addEventListener('click', () => patientModal.style.display = 'none');
  closeProfile.addEventListener('click', () => profileModal.style.display = 'none');

  // Save patient (add or edit)
  patientForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      clinicId,
      name: document.getElementById('pName').value.trim(),
      phone: document.getElementById('pPhone').value.trim(),
      email: document.getElementById('pEmail').value.trim(),
      service: document.getElementById('pService').value.trim(),
      price: Number(document.getElementById('pPrice').value) || 0,
      date: document.getElementById('pDate').value,
      time: document.getElementById('pTime').value,
      status: document.getElementById('pStatus').value
    };

    try {
      if (editingId) {
        const res = await fetch(`${apiBase}/api/patients/${editingId}`, {
          method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Update failed');
      } else {
        const res = await fetch(`${apiBase}/api/patients`, {
          method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Save failed');
      }
      patientModal.style.display = 'none';
      await fetchPatients();
    } catch (err) {
      console.error(err);
      alert('Failed to save patient');
    }
  });

  // Table actions (view/edit/delete)
  patientTableBody.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    const patient = patients.find(p => p._id === id);
    if (action === 'view') {
      document.getElementById('profileDetails').innerHTML = `
        <p><strong>Name:</strong> ${escapeHtml(patient.name)}</p>
        <p><strong>Phone:</strong> ${escapeHtml(patient.phone)}</p>
        <p><strong>Email:</strong> ${escapeHtml(patient.email)}</p>
        <p><strong>Service:</strong> ${escapeHtml(patient.service)}</p>
        <p><strong>Price:</strong> ₹${patient.price}</p>
        <p><strong>Date:</strong> ${patient.date}</p>
        <p><strong>Time:</strong> ${patient.time}</p>
        <p><strong>Status:</strong> ${patient.status}</p>
      `;
      profileModal.style.display = 'block';
    } else if (action === 'edit') {
      editingId = id;
      modalTitle.innerText = 'Edit Patient';
      document.getElementById('pName').value = patient.name || '';
      document.getElementById('pPhone').value = patient.phone || '';
      document.getElementById('pEmail').value = patient.email || '';
      document.getElementById('pService').value = patient.service || '';
      document.getElementById('pPrice').value = patient.price || 0;
      document.getElementById('pDate').value = patient.date || '';
      document.getElementById('pTime').value = patient.time || '';
      document.getElementById('pStatus').value = patient.status || 'Pending';
      patientModal.style.display = 'block';
    } else if (action === 'delete') {
      if (!confirm('Delete this patient?')) return;
      try {
        const res = await fetch(`${apiBase}/api/patients/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Delete failed');
        await fetchPatients();
      } catch (err) {
        console.error(err);
        alert('Failed to delete');
      }
    }
  });

  // Generate PDF report
  reportBtn.addEventListener('click', () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const columns = ['Name','Phone','Email','Service','Price','Date','Time','Status'];
    const rows = patients.map(p => [p.name, p.phone, p.email, p.service, p.price, p.date, p.time, p.status]);
    doc.text('Patients Report', 14, 16);
    doc.autoTable({ head: [columns], body: rows, startY: 20 });
    doc.save(`patients_report_${clinicId}.pdf`);
  });

  // Logout
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('loggedIn');
    localStorage.removeItem('clinicId');
    localStorage.removeItem('username');
    window.location.href = 'index.html';
  });

  // Search
  searchInput.addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    const filtered = patients.filter(p => (p.name||'').toLowerCase().includes(q) || (p.phone||'').toLowerCase().includes(q) || (p.email||'').toLowerCase().includes(q));
    renderPatients(filtered);
  });

  // Close modals when clicking outside
  window.addEventListener('click', (e) => {
    if (e.target === patientModal) patientModal.style.display = 'none';
    if (e.target === profileModal) profileModal.style.display = 'none';
  });

  // Initial load
  fetchPatients();
});
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const { handleMessage } = require('./chatLogic');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ------------------ MongoDB Connection ------------------ //
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// ------------------ Models ------------------ //
const patientSchema = new mongoose.Schema({
  clinicId: String,
  name: String,
  phone: String,
  email: String,
  service: String,
  price: String,
  date: String,
  time: String,
  status: String
}, { timestamps: true });

const Patient = mongoose.model('Patient', patientSchema);

// ------------------ Clinics Config ------------------ //
const clinics = {}; // can be extended for multiple clinics
if (process.env.CLINIC_IDS && process.env.CLINIC_NAMES && process.env.CLINIC_CONTACTS) {
  const ids = process.env.CLINIC_IDS.split(',');
  const names = process.env.CLINIC_NAMES.split(',');
  const contacts = process.env.CLINIC_CONTACTS.split(',');
  ids.forEach((id, idx) => {
    clinics[id] = { clinic_name: names[idx], contact: contacts[idx], clinic_id: id };
  });
}

// ------------------ Serve Frontend ------------------ //
app.use(express.static(path.join(__dirname, 'public'))); // login.html, dashboard.html, js, css

// ------------------ API ROUTES ------------------ //

// Login
app.post('/api/auth/login', (req, res) => {
  const { clinicId, username, password } = req.body;
  // Simple auth: check clinicId exists
  if (!clinics[clinicId]) return res.status(400).json({ message: 'Invalid clinic ID' });
  // For demo, accept any username/password (replace with real auth later)
  return res.json({ clinicId, username });
});

// Get environment info (pre-fill login)
app.get('/api/env', (req, res) => {
  res.json({
    CLINIC_ID: process.env.CLINIC_IDS?.split(',')[0] || '',
    USERNAME: process.env.DEFAULT_USERNAME || ''
  });
});

// Get patients for a clinic
app.get('/api/patients', async (req, res) => {
  const { clinicId } = req.query;
  if (!clinicId) return res.status(400).json([]);
  const patients = await Patient.find({ clinicId }).sort({ createdAt: -1 });
  res.json(patients);
});

// Add patient
app.post('/api/patients', async (req, res) => {
  try {
    const patient = new Patient(req.body);
    await patient.save();
    res.json(patient);
  } catch (err) {
    res.status(500).json({ message: 'Error saving patient' });
  }
});

// Edit patient
app.put('/api/patients/:id', async (req, res) => {
  try {
    const patient = await Patient.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(patient);
  } catch (err) {
    res.status(500).json({ message: 'Error updating patient' });
  }
});

// Delete patient
app.delete('/api/patients/:id', async (req, res) => {
  try {
    await Patient.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting patient' });
  }
});

// ------------------ Chatbot Webhook ------------------ //
app.post('/webhook', async (req, res) => {
  const body = req.body;
  if (body.object === 'whatsapp_business_account') {
    for (const entry of body.entry) {
      for (const change of entry.changes) {
        const value = change.value;
        const messages = value.messages;
        if (messages) {
          for (const message of messages) {
            const from = message.from;
            const msgBody = message.text?.body || '';
            const phoneNumberId = value.metadata.phone_number_id;
            const clinicConfig = clinics[phoneNumberId];
            if (!clinicConfig) continue;
            try {
              await handleMessage(clinicConfig, from, msgBody);
            } catch (err) {
              console.error('Error handling chatbot message:', err);
            }
          }
        }
      }
    }
  }
  res.sendStatus(200);
});

// ------------------ Catch-all for frontend routing ------------------ //
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// ------------------ Start Server ------------------ //
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
