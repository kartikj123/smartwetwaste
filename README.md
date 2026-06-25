# SMART WET WASTE SEGREGATION AND LIQUID SEPARATION SYSTEM
### IoT-Enabled Industrial Wet Waste Treatment Platform — ESP32 Control Center

---

## 📌 Executive Summary
This application is a production-ready, full-stack monitoring and control dashboard designed to manage an IoT-controlled wet waste segregation and liquid separation machine. Mixed wet organic garbage is mechanically processed and segregated sequentially into three silos:
1. **Large Solid Waste** (sorted to **Dustbin 1**)
2. **Fine Solid Waste** (sorted to **Dustbin 2**)
3. **Liquid Waste** (concentrated in the **Collection Tank**)

The interface utilizes **Glassmorphic styling** (Green, White, and Dark Gray), dynamic conveyor state animations, reactive gauges, and dual-role access control profiles (**Admin** and **Operator**) to govern sorting speeds, gate angles, and manual hydraulic overrides.

---

## 🛠️ Tech Stack & Architecture
- **Frontend Framework**: React 18, Vite, Tailwind CSS, Lucide React
- **Animations**: Framer Motion (sequential conveyor materials motion)
- **Data Visualizations**: Recharts Area & Bar Charts (kg/L metrics)
- **Backend API**: Node.js & Express.js
- **Database Support**: Supabase (PostgreSQL with real-time replication)
- **Target Deployment**: Vercel (Client SPA) & Render (API Web service)

---

## 🔌 Hardware Configuration (ESP32)
The hardware configuration avoids flaky, high-maintenance moisture probes, relying instead on clean volumetric calculations computed from acoustic intervals.

### Active Machine Actuators:
- **ESP32 Core Micro-controller**
- **3 Ultrasonic Sensors (HC-SR04)**:
  - **Sensor 1** (Dustbin 1 range)
  - **Sensor 2** (Dustbin 2 range)
  - **Sensor 3** (Liquid Tank range)
- **4 Micro-Servo Motors (SG90/MG996R)**:
  - **Servo 1**: Agitation Core Angle
  - **Servo 2**: Secondary Shredder Blade
  - **Servo 3**: Gate 1 (Large solids discharge)
  - **Servo 4**: Gate 2 (Fine solids sort)
- **2 Slurry Fluid Pumps (12V Submersible)**:
  - **Pump 1**: Water Injection (softens solids in the slurry chamber)
  - **Pump 2**: Liquid Separation (vacuum extraction into collection reservoir)
- **I2C Status LCD Display (16x2)**
- **Piezo Warning Buzzer**

---

## 🚀 Installation & Local Launch Guide

### 1. Pre-requisites
- Ensure **Node.js** (v18 or higher) and **npm** are installed in your system.

### 2. Extract and Populate Environment Settings
Examine `.env.example` and prepare your local environment file:
```bash
# Rename to .env inside your workspace root
GEMINI_API_KEY="your-api-key-here"
APP_URL="http://localhost:3000"
```

### 3. Install Dependencies
Execute the standard package manager to fetch core layouts and charting components:
```bash
npm install
```

### 4. Direct Back-End and Front-End Dev Startup
To initialize the combined Express server and modern hot-reloading Vite assets in dev mode:
```bash
npm run dev
```
Navigate to `http://localhost:3000` to interact with the simulated slurry system.

---

## 🗄️ Database Table Setup (Supabase)
Run the SQL queries stored under the **ESP32 & Database** tab directly in your Supabase SQL editor to scaffold the required tables:
- `users`: Operator authorization profiles.
- `system_status`: Active conveyor stages and ESP32 heartbeat indicators.
- `dustbin_status`: Volume metrics for solid silos.
- `tank_status`: Volume metrics for fluid reservoirs.
- `sensor_readings`: Raw CM ultrasonic distance arrays.
- `actuator_status`: Real-time angles for servos and statuses of relays.
- `alerts`: Warn indicators and fault resolutions.
- `process_logs`: Audit trail tracking operations.
- `analytics`: Historical logging of daily, weekly, and monthly outputs.

---

## 🤖 ESP32 Firmware Installation Guide
1. Launch your **Arduino IDE**.
2. Navigate to **Library Manager** and download:
   - `ArduinoJson` (v6.x)
   - `ESP32Servo`
   - `LiquidCrystal_I2C`
3. Copy the C++ program found inside the **ESP32 & Database** tab of the application.
4. Modify `ssid`, `password`, and the server URL string `serverApiUrl` with your active networks.
5. Compile and flash the code to your ESP32 board over a USB serial connection.

---

## 🌍 Production Cloud Deployment Guide

### Client Frontend (Vercel)
1. Link your project repository to your **Vercel** workspace.
2. In deployment parameters, configure:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. Declare custom environment coordinates.

### Server API Backend (Render)
1. Link the backend server to **Render** as a **Web Service**.
2. Configure configuration settings:
   - **Runtime**: `Node`
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
3. In your client's API fetch functions, point the connection endpoints to your live Render service URL.
