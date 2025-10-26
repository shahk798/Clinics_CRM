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
