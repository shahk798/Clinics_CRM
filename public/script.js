document.addEventListener("DOMContentLoaded", async () => {
  // ------------------ LOGIN LOGIC ------------------ //
  const loginForm = document.getElementById("loginForm");
  const clinicIdInput = document.getElementById("clinicId");
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const errorMessage = document.getElementById("error-message");

  const BASE_URL = "https://clinics-crm.onrender.com"; // backend URL on Render

  // Pre-fill clinic ID and username if API provides it
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

    return; // stop execution if on login page
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
  let editId = null; // store patient _id for editing

  // --- Patient form inputs ---
  const pName = document.getElementById("pName");
  const pPhone = document.getElementById("pPhone");
  const pEmail = document.getElementById("pEmail");
  const pService = document.getElementById("pService");
  const pPrice = document.getElementById("pPrice");
  const pDate = document.getElementById("pDate");
  const pTime = document.getElementById("pTime");
  const pStatus = document.getElementById("pStatus");

  // ------------------ FETCH PATIENTS ------------------ //
  async function fetchPatients() {
    try {
      const res = await fetch(`${BASE_URL}/api/patients?clinicId=${clinicId}`);
      patients = await res.json();
      renderPatients();
    } catch (err) {
      console.error("Error fetching patients", err);
    }
  }

  // ------------------ RENDER PATIENTS ------------------ //
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

    filteredData.forEach(p => {
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
            <button class="viewBtn" data-id="${p._id}">View</button>
            <button class="editBtn" data-id="${p._id}">Edit</button>
            <button class="deleteBtn" data-id="${p._id}">Delete</button>
          </div>
        </td>
      `;
      tableBody.appendChild(row);
    });
  }

  await fetchPatients();

  // ------------------ MODALS ------------------ //
  addPatientBtn.addEventListener("click", () => {
    modal.style.display = "flex";
    form.reset();
    editId = null;
    document.getElementById("modalTitle").innerText = "Add Patient";
  });

  closeModal.addEventListener("click", () => modal.style.display = "none");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const patient = {
      name: pName.value,
      phone: pPhone.value,
      email: pEmail.value,
      service: pService.value,
      price: pPrice.value,
      date: pDate.value,
      time: pTime.value,
      status: pStatus.value,
      clinicId: clinicId
    };

    try {
      if (editId) {
        await fetch(`${BASE_URL}/api/patients/${editId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patient)
        });
      } else {
        await fetch(`${BASE_URL}/api/patients`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patient)
        });
      }
      modal.style.display = "none";
      await fetchPatients();
    } catch (err) {
      console.error("Error saving patient", err);
    }
  });

  // ------------------ EDIT / DELETE / VIEW ------------------ //
  tableBody.addEventListener("click", (e) => {
    const id = e.target.dataset.id;
    if (!id) return;

    const patient = patients.find(p => p._id === id);

    if (e.target.classList.contains("editBtn")) {
      editId = id;
      modal.style.display = "flex";
      document.getElementById("modalTitle").innerText = "Edit Patient";

      pName.value = patient.name;
      pPhone.value = patient.phone;
      pEmail.value = patient.email;
      pService.value = patient.service;
      pPrice.value = patient.price;
      pDate.value = patient.date;
      pTime.value = patient.time;
      pStatus.value = patient.status;
    }

    if (e.target.classList.contains("deleteBtn")) {
      if (confirm("Delete this patient?")) {
        fetch(`${BASE_URL}/api/patients/${id}`, { method: "DELETE" })
          .then(() => fetchPatients());
      }
    }

    if (e.target.classList.contains("viewBtn")) {
      profileDetails.innerHTML = `
        <p><strong>Name:</strong> ${patient.name}</p>
        <p><strong>Phone:</strong> ${patient.phone}</p>
        <p><strong>Email:</strong> ${patient.email}</p>
        <p><strong>Service:</strong> ${patient.service}</p>
        <p><strong>Price:</strong> ₹${patient.price}</p>
        <p><strong>Date:</strong> ${patient.date}</p>
        <p><strong>Time:</strong> ${patient.time}</p>
        <p><strong>Status:</strong> ${patient.status}</p>
      `;
      profileModal.style.display = "flex";
    }
  });

  closeProfile.addEventListener("click", () => profileModal.style.display = "none");

  // ------------------ SEARCH ------------------ //
  searchInput.addEventListener("input", () => {
    const value = searchInput.value.toLowerCase();
    const filtered = patients.filter(
      p => p.name.toLowerCase().includes(value) ||
           p.phone.includes(value) ||
           p.email.toLowerCase().includes(value)
    );
    renderPatients(filtered);
  });

  // ------------------ LOGOUT ------------------ //
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("loggedIn");
    localStorage.removeItem("clinicId");
    localStorage.removeItem("username");
    window.location.href = "login.html";
  });

  // ------------------ GENERATE PDF ------------------ //
  document.getElementById("reportBtn").addEventListener("click", () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const tableData = patients.map(p => [
      p.name, p.phone, p.email, p.service, `₹${p.price}`, p.date, p.time, p.status
    ]);

    doc.autoTable({
      head: [['Name', 'Phone', 'Email', 'Service', 'Price', 'Date', 'Time', 'Status']],
      body: tableData
    });

    doc.save(`clinic_${clinicId}_report.pdf`);
  });
});
