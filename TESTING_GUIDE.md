# Local Testing Guide - Clinics CRM

## Prerequisites
- Node.js installed
- MongoDB Atlas account (cloud database) - **Already configured!**

## Setup Instructions

### 1. MongoDB Setup
✅ **Already Done!** Your MongoDB Atlas connection is configured:
- Database: `Shai_Studio_DB`
- Cluster: `WhatsAppCRMCluster`

### 2. Environment Variables
✅ **Already Done!** The `.env` files are configured with your MongoDB Atlas connection.

### 3. Install Dependencies
```bash
cd Clinics_CRM
npm install
```

### 4. Start the Server
```bash
npm start
```
The server should start on http://localhost:5000

## Testing New Features

### 1. Test Signup Page
1. Open browser and go to: http://localhost:5000/frontend/signup.html
2. Fill in the form with:
   - Dr. Name: e.g., "Dr. John Smith"
   - Clinic Name: e.g., "Smile Dental Clinic"
   - Contact Number: e.g., "1234567890" (optional)
   - WhatsApp Business Number: e.g., "9876543210"
   - Email: e.g., "clinic@example.com"
   - Username: e.g., "drjohn"
   - Password: e.g., "password123"
   - Confirm Password: "password123"
3. Click "Sign Up"
4. Note the generated Clinic ID shown in the alert

### 2. Test Login
1. Go to: http://localhost:5000/frontend/login.html
2. Enter:
   - Clinic ID: (the one generated during signup)
   - Username: (your username)
   - Password: (your password)
3. Click "Login"

### 3. Test Dashboard & Reports
1. After login, you'll see the dashboard
2. Add some patients with price and status
3. Test the three report buttons:
   - **Summary Report** - Downloads Excel with statistics
   - **Patient List** - Downloads Excel with patient info
   - **Full Report** - Downloads Excel with multiple sheets

### 4. Test Appointment Status & Price
1. When adding a patient, enter:
   - Price: e.g., "5000"
   - Status: Select from "Pending", "Complete", or "Cancelled"
2. Verify the summary cards update correctly
3. Check revenue calculations

## Database Schema

### Clinic Collection
```javascript
{
  clinicId: String (unique, auto-generated),
  dr_name: String,
  clinic_name: String,
  contact_number: String (optional),
  whatsapp_business_number: String,
  email: String (unique),
  username: String (unique),
  password: String,
  createdAt: Date,
  updatedAt: Date
}
```

### Patient/Appointment Collection
```javascript
{
  clinicId: String,
  name: String,
  phone: String,
  email: String,
  service: String,
  price: Number,
  date: String,
  time: String,
  status: String (enum: 'pending', 'complete', 'cancel')
}
```

## Troubleshooting

### MongoDB Connection Error
- Check your internet connection (using cloud MongoDB Atlas)
- Verify the MONGO_URI in .env file is correct
- Ensure your IP address is whitelisted in MongoDB Atlas

### Port Already in Use
- Change PORT in .env file to another port (e.g., 5001)
- Or stop the process using port 5000

### Signup Not Working
- Check browser console for errors
- Verify MongoDB connection in server logs
- Check server logs in terminal

### Excel Reports Not Downloading
- Ensure SheetJS library is loaded (check browser console)
- Check for JavaScript errors
- Try refreshing the page

## View Database Contents

### Using MongoDB Atlas Web Interface:
1. Go to https://cloud.mongodb.com
2. Login to your account
3. Navigate to your cluster
4. Click "Browse Collections"
5. View `clinics` and `patients` collections

### Or using MongoDB Compass (Desktop App):
1. Download MongoDB Compass
2. Connect using the connection string from .env
3. Browse the `Shai_Studio_DB` database
