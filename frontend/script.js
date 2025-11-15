// Client-side script for dashboard UI
document.addEventListener('DOMContentLoaded', () => {
  const apiBase = 'http://localhost:5000'; // local backend
  const clinicId = localStorage.getItem('clinicId');
  if (!clinicId) return window.location.href = '/frontend/login.html';

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
  const summaryReportBtn = document.getElementById('summaryReportBtn');
  const patientListBtn = document.getElementById('patientListBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const searchInput = document.getElementById('searchInput');

  let patients = [];
  let editingId = null;

  // Fetch patients
  async function fetchPatients() {
    try {
      console.log('Fetching appointments for clinicId:', clinicId);
      console.log('API URL:', `${apiBase}/api/patients?clinicId=${encodeURIComponent(clinicId)}`);

      // Fetch filtered appointments for this clinic
      const res = await fetch(`${apiBase}/api/patients?clinicId=${encodeURIComponent(clinicId)}`);
      if (!res.ok) {
        const error = await res.text();
        console.error('Server error:', error);
        throw new Error('Failed to load appointments');
      }
      
      const data = await res.json();
      console.log('Received appointments:', data);
      
      if (!Array.isArray(data)) {
        console.error('Expected array of appointments but got:', typeof data);
        throw new Error('Invalid data format received');
      }
      
      patients = data;
      console.log('Processing appointments:', patients.length);
      if (patients.length > 0) {
        console.log('Sample appointment:', patients[0]);
      }
      
      renderPatients(patients);
    } catch (err) {
      console.error('Error in fetchPatients:', err);
      patientTableBody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: red;">Error loading appointments: ${err.message}</td></tr>`;
      alert('Error loading appointments. Check browser console for details.');
    }
  }

  function renderPatients(list) {
    console.log('Rendering appointments:', list);
    patientTableBody.innerHTML = '';
    let revenue = 0;
    let completed = 0;
    let pending = 0;
    let cancelled = 0;

    if (!Array.isArray(list)) {
      console.error('Expected array but got:', list);
      return;
    }

    list.forEach(p => {
      console.log('Processing appointment:', p);
      revenue += Number(p.price || 0);

      // Count by status
      if (p.status === 'Complete') completed++;
      else if (p.status === 'Pending') pending++;
      else if (p.status === 'Cancelled') cancelled++;

      const displayName = p.name || p.patient_name || '';
      const displayDate = p.date || p.appointment_date || '';
      const displayTime = p.time || p.appointment_time || '';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(displayName)}</td>
        <td>${escapeHtml(p.phone || '')}</td>
        <td>${escapeHtml(p.email || '')}</td>
        <td>${escapeHtml(p.service || '')}</td>
        <td>₹${p.price || 0}</td>
        <td>${displayDate}</td>
        <td>${displayTime}</td>
        <td>${p.status || 'Pending'}</td>
        <td>
          <button class="btn-small" data-action="view" data-id="${p._id}">View</button>
          <button class="btn-small" data-action="edit" data-id="${p._id}">Edit</button>
          <button class="btn-small btn-danger" data-action="delete" data-id="${p._id}">Delete</button>
        </td>
      `;
      patientTableBody.appendChild(tr);
    });

    // Update summary cards
    totalPatientsEl.innerText = list.length;
    document.getElementById('completedAppointments').innerText = completed;
    document.getElementById('pendingAppointments').innerText = pending;
    document.getElementById('cancelledAppointments').innerText = cancelled;
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
    patientModal.style.display = 'flex';
  });

  closeModal.addEventListener('click', () => patientModal.style.display = 'none');
  closeProfile.addEventListener('click', () => profileModal.style.display = 'none');

  // Save patient (add or edit)
  patientForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      clinicId: clinicId,
      name: document.getElementById('pName').value.trim(),
      phone: document.getElementById('pPhone').value.trim().replace(/\D/g, ''),
      email: document.getElementById('pEmail').value.trim(),
      service: document.getElementById('pService').value.trim(),
      price: Number(document.getElementById('pPrice').value) || 0,
      date: document.getElementById('pDate').value,
      time: document.getElementById('pTime').value,
      status: document.getElementById('pStatus').value
    };
    console.log('Submitting appointment data:', payload);

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
      const displayName = patient.name || patient.patient_name || '';
      const displayDate = patient.date || patient.appointment_date || '';
      const displayTime = patient.time || patient.appointment_time || '';
      document.getElementById('profileDetails').innerHTML = `
        <p><strong>Name:</strong> ${escapeHtml(displayName)}</p>
        <p><strong>Phone:</strong> ${escapeHtml(patient.phone)}</p>
        <p><strong>Email:</strong> ${escapeHtml(patient.email)}</p>
        <p><strong>Service:</strong> ${escapeHtml(patient.service)}</p>
        <p><strong>Price:</strong> ₹${patient.price || 0}</p>
        <p><strong>Date:</strong> ${displayDate}</p>
        <p><strong>Time:</strong> ${displayTime}</p>
        <p><strong>Status:</strong> ${patient.status || 'Pending'}</p>
        <p><strong>Source:</strong> ${patient.source || 'N/A'}</p>
      `;
      profileModal.style.display = 'block';
    } else if (action === 'edit') {
      editingId = id;
      modalTitle.innerText = 'Edit Patient';
      // support both field names
      document.getElementById('pName').value = patient.name || patient.patient_name || '';
      document.getElementById('pPhone').value = patient.phone || '';
      document.getElementById('pEmail').value = patient.email || '';
      document.getElementById('pService').value = patient.service || '';
      document.getElementById('pPrice').value = patient.price || 0;
      document.getElementById('pDate').value = patient.date || patient.appointment_date || '';
      document.getElementById('pTime').value = patient.time || patient.appointment_time || '';
      document.getElementById('pStatus').value = patient.status || 'Pending';
      patientModal.style.display = 'flex';
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

  // Generate Summary Report (Excel)
  summaryReportBtn.addEventListener('click', () => {
    const totalPatients = patients.length;
    const completed = patients.filter(p => p.status === "Complete").length;
    const pending = patients.filter(p => p.status === "Pending").length;
    const cancelled = patients.filter(p => p.status === "Cancelled").length;
    const totalRevenue = patients.reduce((sum, p) => p.status === "Complete" ? sum + Number(p.price || 0) : sum, 0);
    const pendingRevenue = patients.reduce((sum, p) => p.status === "Pending" ? sum + Number(p.price || 0) : sum, 0);

    const summaryData = [
      ['Clinic Summary Report', ''],
      ['Generated On:', new Date().toLocaleString()],
      ['Clinic ID:', clinicId],
      ['', ''],
      ['Metric', 'Value'],
      ['Total Patients', totalPatients],
      ['Completed Appointments', completed],
      ['Pending Appointments', pending],
      ['Cancelled Appointments', cancelled],
      ['Total Revenue (Completed)', `₹${totalRevenue}`],
      ['Potential Revenue (Pending)', `₹${pendingRevenue}`],
      ['Total Potential Revenue', `₹${totalRevenue + pendingRevenue}`]
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(summaryData);
    ws['!cols'] = [{ wch: 30 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Summary');
    XLSX.writeFile(wb, `clinic_${clinicId}_summary_${new Date().toISOString().split('T')[0]}.xlsx`);
  });

  // Generate Patient List Report (Excel)
  patientListBtn.addEventListener('click', () => {
    const patientListData = [
      ['Patient Information List'],
      ['Generated On:', new Date().toLocaleString()],
      ['Clinic ID:', clinicId],
      [''],
      ['Name', 'Phone', 'Email', 'Service', 'Price', 'Date', 'Time', 'Status']
    ];

    patients.forEach(p => {
      patientListData.push([
        p.name || p.patient_name,
        p.phone,
        p.email,
        p.service,
        p.price || 0,
        p.date || p.appointment_date,
        p.time || p.appointment_time,
        p.status
      ]);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(patientListData);
    ws['!cols'] = [
      { wch: 20 }, { wch: 15 }, { wch: 25 }, { wch: 20 },
      { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 12 }
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Patient List');
    XLSX.writeFile(wb, `clinic_${clinicId}_patients_${new Date().toISOString().split('T')[0]}.xlsx`);
  });

  // Generate Full Report (Excel)
  reportBtn.addEventListener('click', () => {
    const wb = XLSX.utils.book_new();

    // Summary Sheet
    const totalPatients = patients.length;
    const completed = patients.filter(p => p.status === "Complete").length;
    const pending = patients.filter(p => p.status === "Pending").length;
    const cancelled = patients.filter(p => p.status === "Cancelled").length;
    const totalRevenue = patients.reduce((sum, p) => p.status === "Complete" ? sum + Number(p.price || 0) : sum, 0);
    const pendingRevenue = patients.reduce((sum, p) => p.status === "Pending" ? sum + Number(p.price || 0) : sum, 0);

    const summaryData = [
      ['Clinic Full Report', ''],
      ['Generated On:', new Date().toLocaleString()],
      ['Clinic ID:', clinicId],
      ['', ''],
      ['Metric', 'Value'],
      ['Total Patients', totalPatients],
      ['Completed Appointments', completed],
      ['Pending Appointments', pending],
      ['Cancelled Appointments', cancelled],
      ['Total Revenue (Completed)', `₹${totalRevenue}`],
      ['Potential Revenue (Pending)', `₹${pendingRevenue}`],
      ['Total Potential Revenue', `₹${totalRevenue + pendingRevenue}`]
    ];

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    wsSummary['!cols'] = [{ wch: 30 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

    // All Patients Sheet
    const allPatientsData = [
      ['Name', 'Phone', 'Email', 'Service', 'Price', 'Date', 'Time', 'Status']
    ];
    patients.forEach(p => {
      allPatientsData.push([
        p.name || p.patient_name,
        p.phone,
        p.email,
        p.service,
        p.price || 0,
        p.date || p.appointment_date,
        p.time || p.appointment_time,
        p.status
      ]);
    });

    const wsAllPatients = XLSX.utils.aoa_to_sheet(allPatientsData);
    wsAllPatients['!cols'] = [
      { wch: 20 }, { wch: 15 }, { wch: 25 }, { wch: 20 },
      { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 12 }
    ];
    XLSX.utils.book_append_sheet(wb, wsAllPatients, 'All Patients');

    // Completed Sheet
    const completedData = [
      ['Completed Appointments'],
      ['Name', 'Phone', 'Email', 'Service', 'Price', 'Date', 'Time']
    ];
    patients.filter(p => p.status === "Complete").forEach(p => {
      completedData.push([
        p.name || p.patient_name, p.phone, p.email, p.service,
        p.price || 0, p.date || p.appointment_date, p.time || p.appointment_time
      ]);
    });

    const wsCompleted = XLSX.utils.aoa_to_sheet(completedData);
    wsCompleted['!cols'] = [
      { wch: 20 }, { wch: 15 }, { wch: 25 }, { wch: 20 },
      { wch: 10 }, { wch: 12 }, { wch: 10 }
    ];
    XLSX.utils.book_append_sheet(wb, wsCompleted, 'Completed');

    // Pending Sheet
    const pendingData = [
      ['Pending Appointments'],
      ['Name', 'Phone', 'Email', 'Service', 'Price', 'Date', 'Time']
    ];
    patients.filter(p => p.status === "Pending").forEach(p => {
      pendingData.push([
        p.name || p.patient_name, p.phone, p.email, p.service,
        p.price || 0, p.date || p.appointment_date, p.time || p.appointment_time
      ]);
    });

    const wsPending = XLSX.utils.aoa_to_sheet(pendingData);
    wsPending['!cols'] = [
      { wch: 20 }, { wch: 15 }, { wch: 25 }, { wch: 20 },
      { wch: 10 }, { wch: 12 }, { wch: 10 }
    ];
    XLSX.utils.book_append_sheet(wb, wsPending, 'Pending');

    // Cancelled Sheet
    const cancelledData = [
      ['Cancelled Appointments'],
      ['Name', 'Phone', 'Email', 'Service', 'Price', 'Date', 'Time']
    ];
    patients.filter(p => p.status === "Cancelled").forEach(p => {
      cancelledData.push([
        p.name || p.patient_name, p.phone, p.email, p.service,
        p.price || 0, p.date || p.appointment_date, p.time || p.appointment_time
      ]);
    });

    const wsCancelled = XLSX.utils.aoa_to_sheet(cancelledData);
    wsCancelled['!cols'] = [
      { wch: 20 }, { wch: 15 }, { wch: 25 }, { wch: 20 },
      { wch: 10 }, { wch: 12 }, { wch: 10 }
    ];
    XLSX.utils.book_append_sheet(wb, wsCancelled, 'Cancelled');

    XLSX.writeFile(wb, `clinic_${clinicId}_full_report_${new Date().toISOString().split('T')[0]}.xlsx`);
  });

  // Logout
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('loggedIn');
    localStorage.removeItem('clinicId');
    localStorage.removeItem('username');
    window.location.href = '/frontend/login.html';
  });

  // Search
  searchInput.addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    const filtered = patients.filter(p => {
      const name = (p.name || p.patient_name || '').toLowerCase();
      return name.includes(q) || (p.phone||'').toLowerCase().includes(q) || (p.email||'').toLowerCase().includes(q);
    });
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
