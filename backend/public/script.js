document.addEventListener("DOMContentLoaded", async () => {
  // ------------------ CONFIG ------------------ //
  const BASE_URL = "https://clinics-crm.onrender.com"; // ✅ backend URL

  // ------------------ LOGIN LOGIC ------------------ //
  const loginForm = document.getElementById("loginForm");
  const clinicIdInput = document.getElementById("clinicId");
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const errorMessage = document.getElementById("error-message");

  // Pre-fill clinic ID and username from backend
  try {
    const res = await fetch(`${BASE_URL}/api/env`);
    if (res.ok) {
      const data = await res.json();
      if (data.CLINIC_ID) clinicIdInput.value = data.CLINIC_ID;
      if (data.USERNAME) usernameInput.value = data.USERNAME;
    }
  } catch (err) {
    console.error("Failed to fetch clinic info:", err);
  }

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const clinicId = clinicIdInput.value.trim();
      const username = usernameInput.value.trim();
      const password = passwordInput.value.trim();

      try {
        const res = await fetch(`${BASE_URL}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clinicId, username, password }),
        });

        const data = await res.json();

        if (res.ok) {
          localStorage.setItem("loggedIn", "true");
          localStorage.setItem("clinicId", data.clinicId);
          localStorage.setItem("username", username);
          window.location.href = "dashboard.html";
        } else {
          errorMessage.innerText = data.message || "Login failed";
        }
      } catch (err) {
        errorMessage.innerText = "Server connection error";
        console.error(err);
      }
    });

    document.getElementById("resetPassword").addEventListener("click", () => {
      alert("Password reset link will be sent to your registered email.");
    });
    return;
  }

  // ------------------ DASHBOARD LOGIC ------------------ //
  if (!localStorage.getItem("loggedIn")) {
    window.location.href = "login.html";
    return;
  }

  const logoutBtn = document.getElementById("logoutBtn");
  const addPatientBtn = document.getElementById("addPatientBtn");
  const modal = document.getElementById("patientModal");
  const form = document.getElementById("patientForm");
  const tableBody = document.querySelector("#patientTable tbody");
  const closeModal = document.getElementById("closeModal");
  const searchInput = document.getElementById("searchInput");
  const profileModal = document.getElementById("profileModal");
  const profileDetails = document.getElementById("profileDetails");
  const closeProfile = document.getElementById("closeProfile");

  const totalPatientsCard = document.getElementById("totalPatients");
  const completedAppointmentsCard = document.getElementById("completedAppointments");
  const pendingAppointmentsCard = document.getElementById("pendingAppointments");
  const cancelledAppointmentsCard = document.getElementById("cancelledAppointments");
  const totalRevenueCard = document.getElementById("totalRevenue");

  const clinicId = localStorage.getItem("clinicId");
  let patients = [];
  let editIndex = null;

  // Fetch patients from backend
  async function fetchPatients() {
    try {
      const res = await fetch(`${BASE_URL}/api/patients?clinicId=${clinicId}`);
      patients = await res.json();
      renderPatients();
    } catch (err) {
      console.error("Error fetching patients", err);
    }
  }

  // Render patients table and summary
  function renderPatients(filteredData = patients) {
    tableBody.innerHTML = "";

    const totalPatients = filteredData.length;
    const completed = filteredData.filter(p => p.status === "Complete").length;
    const pending = filteredData.filter(p => p.status === "Pending").length;
    const cancelled = filteredData.filter(p => p.status === "Cancelled").length;
    const revenue = filteredData.reduce((sum, p) => p.status === "Complete" ? sum + Number(p.price) : sum, 0);

    totalPatientsCard.innerText = totalPatients;
    completedAppointmentsCard.innerText = completed;
    pendingAppointmentsCard.innerText = pending;
    cancelledAppointmentsCard.innerText = cancelled;
    totalRevenueCard.innerText = revenue;

    filteredData.forEach((p, index) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${p.name}</td>
        <td>${p.phone}</td>
        <td>${p.email}</td>
        <td>${p.service}</td>
        <td>₹${p.price}</td>
        <td>${p.date}</td>
        <td>${p.time}</td>
        <td class="status ${p.status}">${p.status}</td>
        <td>
          <div class="action-buttons">
            <button class="viewBtn" data-index="${index}">View</button>
            <button class="editBtn" data-index="${index}">Edit</button>
            <button class="deleteBtn" data-index="${index}">Delete</button>
          </div>
        </td>
      `;
      tableBody.appendChild(row);
    });
  }

  await fetchPatients();

  // Add patient modal
  addPatientBtn.addEventListener("click", () => {
    modal.style.display = "flex";
    form.reset();
    editIndex = null;
    document.getElementById("modalTitle").innerText = "Add Patient";
  });

  closeModal.addEventListener("click", () => (modal.style.display = "none"));

  // Save patient
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const patient = {
      name: document.getElementById("pName").value,
      phone: document.getElementById("pPhone").value,
      email: document.getElementById("pEmail").value,
      service: document.getElementById("pService").value,
      price: document.getElementById("pPrice").value,
      date: document.getElementById("pDate").value,
      time: document.getElementById("pDay").value,
      status: document.getElementById("pStatus").value,
      clinicId: clinicId
    };

    try {
      let response;
      if (editIndex !== null) {
        response = await fetch(`${BASE_URL}/api/patients/${patients[editIndex]._id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patient)
        });
      } else {
        response = await fetch(`${BASE_URL}/api/patients`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patient)
        });
      }

      const data = await response.json();
      
      if (response.ok) {
        modal.style.display = "none";
        await fetchPatients();
        // Reset edit index after successful save
        editIndex = null;
      } else {
        alert(data.message || "Failed to save patient data");
      }
    } catch (err) {
      console.error("Error saving patient", err);
      alert("Error saving patient. Please try again.");
    }
  });

  // Edit / Delete / View
  tableBody.addEventListener("click", async (e) => {
    const index = parseInt(e.target.dataset.index);
    
    if (isNaN(index) || !patients[index]) {
      console.error('Invalid patient index');
      return;
    }

    if (e.target.classList.contains("editBtn")) {
      editIndex = index;
      const p = patients[index];
      modal.style.display = "flex";
      document.getElementById("modalTitle").innerText = "Edit Patient";
      document.getElementById("pName").value = p.name || '';
      document.getElementById("pPhone").value = p.phone || '';
      document.getElementById("pEmail").value = p.email || '';
      document.getElementById("pService").value = p.service || '';
      document.getElementById("pPrice").value = p.price || '';
      document.getElementById("pDate").value = p.date || '';
      document.getElementById("pDay").value = p.time || '';
      document.getElementById("pStatus").value = p.status || 'Pending';
    }

    if (e.target.classList.contains("deleteBtn")) {
      if (confirm("Are you sure you want to delete this patient?")) {
        try {
          const response = await fetch(`${BASE_URL}/api/patients/${patients[index]._id}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" }
          });

          if (response.ok) {
            await fetchPatients();
          } else {
            const data = await response.json();
            alert(data.message || "Failed to delete patient");
          }
        } catch (err) {
          console.error("Error deleting patient:", err);
          alert("Error deleting patient. Please try again.");
        }
      }
    }

    if (e.target.classList.contains("viewBtn")) {
      const p = patients[index];
      profileDetails.innerHTML = `
        <p><strong>Name:</strong> ${p.name}</p>
        <p><strong>Phone:</strong> ${p.phone}</p>
        <p><strong>Email:</strong> ${p.email}</p>
        <p><strong>Service:</strong> ${p.service}</p>
        <p><strong>Price:</strong> ₹${p.price}</p>
        <p><strong>Date:</strong> ${p.date}</p>
        <p><strong>Time:</strong> ${p.time}</p>
        <p><strong>Status:</strong> ${p.status}</p>
      `;
      profileModal.style.display = "flex";
    }
  });

  closeProfile.addEventListener("click", () => (profileModal.style.display = "none"));

  // Search
  searchInput.addEventListener("input", () => {
    const value = searchInput.value.toLowerCase();
    const filtered = patients.filter(
      p => p.name.toLowerCase().includes(value) ||
           p.phone.includes(value) ||
           p.email.toLowerCase().includes(value)
    );
    renderPatients(filtered);
  });

  // Logout
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("loggedIn");
    localStorage.removeItem("clinicId");
    localStorage.removeItem("username");
    window.location.href = "login.html";
  });

  // Generate Summary Report (Excel)
  document.getElementById("summaryReportBtn").addEventListener("click", () => {
    const totalPatients = patients.length;
    const completed = patients.filter(p => p.status === "Complete").length;
    const pending = patients.filter(p => p.status === "Pending").length;
    const cancelled = patients.filter(p => p.status === "Cancelled").length;
    const totalRevenue = patients.reduce((sum, p) => p.status === "Complete" ? sum + Number(p.price) : sum, 0);
    const pendingRevenue = patients.reduce((sum, p) => p.status === "Pending" ? sum + Number(p.price) : sum, 0);

    // Create summary data
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

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(summaryData);

    // Set column widths
    ws['!cols'] = [{ wch: 30 }, { wch: 20 }];

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Summary');

    // Save file
    XLSX.writeFile(wb, `clinic_${clinicId}_summary_${new Date().toISOString().split('T')[0]}.xlsx`);
  });

  // Generate Patient List Report (Excel)
  document.getElementById("patientListBtn").addEventListener("click", () => {
    // Create patient list data
    const patientListData = [
      ['Patient Information List'],
      ['Generated On:', new Date().toLocaleString()],
      ['Clinic ID:', clinicId],
      [''],
      ['Name', 'Phone', 'Email', 'Service', 'Price', 'Date', 'Time', 'Status']
    ];

    patients.forEach(p => {
      patientListData.push([
        p.name,
        p.phone,
        p.email,
        p.service,
        p.price,
        p.date,
        p.time,
        p.status
      ]);
    });

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(patientListData);

    // Set column widths
    ws['!cols'] = [
      { wch: 20 }, // Name
      { wch: 15 }, // Phone
      { wch: 25 }, // Email
      { wch: 20 }, // Service
      { wch: 10 }, // Price
      { wch: 12 }, // Date
      { wch: 10 }, // Time
      { wch: 12 }  // Status
    ];

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Patient List');

    // Save file
    XLSX.writeFile(wb, `clinic_${clinicId}_patients_${new Date().toISOString().split('T')[0]}.xlsx`);
  });

  // Generate Full Report (Excel) - with multiple sheets
  document.getElementById("reportBtn").addEventListener("click", () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Summary
    const totalPatients = patients.length;
    const completed = patients.filter(p => p.status === "Complete").length;
    const pending = patients.filter(p => p.status === "Pending").length;
    const cancelled = patients.filter(p => p.status === "Cancelled").length;
    const totalRevenue = patients.reduce((sum, p) => p.status === "Complete" ? sum + Number(p.price) : sum, 0);
    const pendingRevenue = patients.reduce((sum, p) => p.status === "Pending" ? sum + Number(p.price) : sum, 0);

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

    // Sheet 2: All Patients
    const allPatientsData = [
      ['Name', 'Phone', 'Email', 'Service', 'Price', 'Date', 'Time', 'Status']
    ];

    patients.forEach(p => {
      allPatientsData.push([
        p.name,
        p.phone,
        p.email,
        p.service,
        p.price,
        p.date,
        p.time,
        p.status
      ]);
    });

    const wsAllPatients = XLSX.utils.aoa_to_sheet(allPatientsData);
    wsAllPatients['!cols'] = [
      { wch: 20 }, { wch: 15 }, { wch: 25 }, { wch: 20 },
      { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 12 }
    ];
    XLSX.utils.book_append_sheet(wb, wsAllPatients, 'All Patients');

    // Sheet 3: Completed Appointments
    const completedData = [
      ['Completed Appointments'],
      ['Name', 'Phone', 'Email', 'Service', 'Price', 'Date', 'Time']
    ];

    patients.filter(p => p.status === "Complete").forEach(p => {
      completedData.push([p.name, p.phone, p.email, p.service, p.price, p.date, p.time]);
    });

    const wsCompleted = XLSX.utils.aoa_to_sheet(completedData);
    wsCompleted['!cols'] = [
      { wch: 20 }, { wch: 15 }, { wch: 25 }, { wch: 20 },
      { wch: 10 }, { wch: 12 }, { wch: 10 }
    ];
    XLSX.utils.book_append_sheet(wb, wsCompleted, 'Completed');

    // Sheet 4: Pending Appointments
    const pendingData = [
      ['Pending Appointments'],
      ['Name', 'Phone', 'Email', 'Service', 'Price', 'Date', 'Time']
    ];

    patients.filter(p => p.status === "Pending").forEach(p => {
      pendingData.push([p.name, p.phone, p.email, p.service, p.price, p.date, p.time]);
    });

    const wsPending = XLSX.utils.aoa_to_sheet(pendingData);
    wsPending['!cols'] = [
      { wch: 20 }, { wch: 15 }, { wch: 25 }, { wch: 20 },
      { wch: 10 }, { wch: 12 }, { wch: 10 }
    ];
    XLSX.utils.book_append_sheet(wb, wsPending, 'Pending');

    // Sheet 5: Cancelled Appointments
    const cancelledData = [
      ['Cancelled Appointments'],
      ['Name', 'Phone', 'Email', 'Service', 'Price', 'Date', 'Time']
    ];

    patients.filter(p => p.status === "Cancelled").forEach(p => {
      cancelledData.push([p.name, p.phone, p.email, p.service, p.price, p.date, p.time]);
    });

    const wsCancelled = XLSX.utils.aoa_to_sheet(cancelledData);
    wsCancelled['!cols'] = [
      { wch: 20 }, { wch: 15 }, { wch: 25 }, { wch: 20 },
      { wch: 10 }, { wch: 12 }, { wch: 10 }
    ];
    XLSX.utils.book_append_sheet(wb, wsCancelled, 'Cancelled');

    // Save file
    XLSX.writeFile(wb, `clinic_${clinicId}_full_report_${new Date().toISOString().split('T')[0]}.xlsx`);
  });
});
