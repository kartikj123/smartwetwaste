import * as dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { sql } from "drizzle-orm";
import { db } from "./src/db/index.ts";
import { 
  SystemStatus, 
  BinStatus, 
  ActuatorStatus, 
  SensorReading, 
  Alert, 
  ProcessLog, 
  SystemStage 
} from "./src/types";
import { 
  seedDatabase, 
  getDashboardData, 
  updateActuatorStatusInDb, 
  updateBinAndSensorDb, 
  resetSystemDb, 
  insertAlertDb, 
  resolveAlertDb, 
  insertProcessLogDb, 
  getAnalyticsDb, 
  incrementDailyAnalyticsDb,
  getDatabaseTableCounts
} from "./src/db/helpers.ts";

// Setup global server variables
const app = express();
app.use(express.json());

const PORT = 3000;

// Initialize state
let sessionUser: { email: string; role: 'Admin' | 'Operator'; name: string } | null = null;

let systemStatus: SystemStatus = {
  online: true,
  esp32Connected: true,
  stage: "Ready",
  isProcessing: false,
  paused: false
};

let binsStatus: BinStatus[] = [
  { id: "dustbin1", name: "Dustbin 1 (Large Waste)", type: "large", level: 25, capacity: 25, distance: 30, status: "Normal" },
  { id: "dustbin2", name: "Dustbin 2 (Fine Waste)", type: "fine", level: 41, capacity: 41, distance: 24, status: "Normal" },
  { id: "liquidTank", name: "Liquid Collection Tank", type: "liquid", level: 18, capacity: 18, distance: 41, status: "Normal" }
];

let sensorReadings: SensorReading[] = [
  { sensorId: "ultrasonic1", name: "Ultrasonic Sensor 1 (Dustbin 1)", distance: 30, fillPercentage: 25, lastUpdated: new Date().toISOString() },
  { sensorId: "ultrasonic2", name: "Ultrasonic Sensor 2 (Dustbin 2)", distance: 24, fillPercentage: 41, lastUpdated: new Date().toISOString() },
  { sensorId: "ultrasonic3", name: "Ultrasonic Sensor 3 (Liquid Tank)", distance: 41, fillPercentage: 18, lastUpdated: new Date().toISOString() }
];

let actuatorStatus: ActuatorStatus = {
  servo1: "CLOSED",
  servo2: "CLOSED",
  servo3: "CLOSED",
  servo4: "CLOSED",
  pump1: false,
  pump2: false,
  lcdMessage: "SYSTEM READY - ONLINE",
  buzzer: false
};

let alerts: Alert[] = [
  { id: "alert_1", title: "Container 2 is FULL!", description: "Telemetry records show Fine Solid Waste Container 2 has exceeded its threshold level.", severity: "critical", timestamp: new Date(Date.now() - 600000).toISOString(), resolved: false }
];

let processLogs: ProcessLog[] = [
  { id: 1, created_at: new Date(Date.now() - 7200000).toISOString(), process_stage: "Completed", description: "Processed 4.2kg wet waste safely. (Cycle Auto Start by System Scheduler)" },
  { id: 2, created_at: new Date(Date.now() - 3600000).toISOString(), process_stage: "Checking Dustbins", description: "All sensor distances verified inside tolerance boundaries. (System Diagnostic Check by System Admin)" }
];

// Historical Analytics for Recharts
let analyticsData = {
  daily: [
    { date: "Mon", large: 12, fine: 15, liquid: 22, cycles: 5 },
    { date: "Tue", large: 19, fine: 11, liquid: 28, cycles: 6 },
    { date: "Wed", large: 15, fine: 18, liquid: 32, cycles: 7 },
    { date: "Thu", large: 22, fine: 21, liquid: 24, cycles: 8 },
    { date: "Fri", large: 30, fine: 28, liquid: 45, cycles: 12 },
    { date: "Sat", large: 8, fine: 12, liquid: 15, cycles: 4 },
    { date: "Sun", large: 14, fine: 10, liquid: 20, cycles: 5 }
  ],
  weekly: [
    { week: "Week 21", large: 92, fine: 85, liquid: 140, cycles: 42 },
    { week: "Week 22", large: 110, fine: 102, liquid: 165, cycles: 48 },
    { week: "Week 23", large: 135, fine: 118, liquid: 190, cycles: 55 },
    { week: "Week 24", large: 150, fine: 132, liquid: 210, cycles: 62 }
  ],
  monthly: [
    { month: "Jan", large: 450, fine: 390, liquid: 680, cycles: 180 },
    { month: "Feb", large: 490, fine: 410, liquid: 720, cycles: 195 },
    { month: "Mar", large: 520, fine: 480, liquid: 810, cycles: 215 },
    { month: "Apr", large: 580, fine: 510, liquid: 890, cycles: 240 },
    { month: "May", large: 610, fine: 540, liquid: 940, cycles: 260 },
    { month: "Jun", large: 650, fine: 590, liquid: 1020, cycles: 290 }
  ]
};

// Real-time clients for streaming updates
let sseClients: any[] = [];

function broadcastState() {
  const payload = {
    systemStatus,
    binsStatus,
    sensorReadings,
    actuatorStatus,
    alerts,
    processLogs
  };
  const message = `data: ${JSON.stringify(payload)}\n\n`;
  sseClients.forEach(client => {
    try {
      client.write(message);
    } catch (e) {
      console.error("Error broadcasting to SSE client:", e);
    }
  });
}

// Machine Operation Stages Sequence:
const STAGES_FLOW: SystemStage[] = [
  'Ready',
  'Checking Dustbins',
  'Water Injection',
  'Waste Agitation',
  'Large Waste Separation',
  'Fine Waste Separation',
  'Liquid Separation',
  'Completed'
];

let stageTimer: NodeJS.Timeout | null = null;
let currentStageIndex = 0;

// Internal Simulation Processing Logic
async function advanceStage() {
  if (!systemStatus.isProcessing || systemStatus.paused) return;

  currentStageIndex++;
  if (currentStageIndex >= STAGES_FLOW.length) {
    // Finished processing cycle! Add analytical record and log.
    systemStatus.isProcessing = false;
    systemStatus.stage = 'Completed';
    actuatorStatus.pump1 = false;
    actuatorStatus.pump2 = false;
    actuatorStatus.servo1 = "CLOSED";
    actuatorStatus.servo2 = "CLOSED";
    actuatorStatus.servo3 = "CLOSED";
    actuatorStatus.servo4 = "CLOSED";
    actuatorStatus.buzzer = true; // Ring to indicate completion
    setTimeout(() => { actuatorStatus.buzzer = false; }, 1500);
    actuatorStatus.lcdMessage = "CYCLE COMPLETE. READY.";

    // Append to process logs
    const largeW = Math.round(2 + Math.random() * 4);
    const fineW = Math.round(1 + Math.random() * 3);
    const liquidW = Math.round(3 + Math.random() * 5);
    
    const cycleLog: ProcessLog = {
      id: Math.floor(Math.random() * 1000000),
      created_at: new Date().toISOString(),
      process_stage: "Completed",
      description: `Safely segregated: Large: ${largeW}kg, Fine: ${fineW}kg, Liquid: ${liquidW}L. Operator: ${sessionUser ? sessionUser.name : "System Auto"}`
    };
    processLogs.unshift(cycleLog);

    // Simulate level accumulation in dustbins
    binsStatus[0].level = Math.min(100, binsStatus[0].level + largeW * 4);
    binsStatus[0].capacity = binsStatus[0].level;
    binsStatus[0].distance = Math.max(5, Math.round(40 - (binsStatus[0].level * 35 / 100)));
    binsStatus[0].status = binsStatus[0].level > 80 ? 'Full' : (binsStatus[0].level > 50 ? 'Warning' : 'Normal');

    binsStatus[1].level = Math.min(100, binsStatus[1].level + fineW * 5);
    binsStatus[1].capacity = binsStatus[1].level;
    binsStatus[1].distance = Math.max(5, Math.round(40 - (binsStatus[1].level * 35 / 100)));
    binsStatus[1].status = binsStatus[1].level > 80 ? 'Full' : (binsStatus[1].level > 50 ? 'Warning' : 'Normal');

    binsStatus[2].level = Math.min(100, binsStatus[2].level + liquidW * 6);
    binsStatus[2].capacity = binsStatus[2].level;
    binsStatus[2].distance = Math.max(5, Math.round(50 - (binsStatus[2].level * 45 / 100)));
    binsStatus[2].status = binsStatus[2].level > 80 ? 'Full' : (binsStatus[2].level > 50 ? 'Warning' : 'Normal');

    // Sync ultrasonic readings
    sensorReadings[0].distance = binsStatus[0].distance;
    sensorReadings[0].fillPercentage = binsStatus[0].level;
    sensorReadings[0].lastUpdated = new Date().toISOString();

    sensorReadings[1].distance = binsStatus[1].distance;
    sensorReadings[1].fillPercentage = binsStatus[1].level;
    sensorReadings[1].lastUpdated = new Date().toISOString();

    sensorReadings[2].distance = binsStatus[2].distance;
    sensorReadings[2].fillPercentage = binsStatus[2].level;
    sensorReadings[2].lastUpdated = new Date().toISOString();

    try {
      await insertProcessLogDb(cycleLog);
      await incrementDailyAnalyticsDb(largeW, fineW, liquidW);
      await updateActuatorStatusInDb(actuatorStatus);
      await updateBinAndSensorDb("dustbin1", "ultrasonic1", binsStatus[0].distance, binsStatus[0].level, binsStatus[0].status);
      await updateBinAndSensorDb("dustbin2", "ultrasonic2", binsStatus[1].distance, binsStatus[1].level, binsStatus[1].status);
      await updateBinAndSensorDb("liquidTank", "ultrasonic3", binsStatus[2].distance, binsStatus[2].level, binsStatus[2].status);
    } catch (e) {
      console.error("Failed to persist cycle results to database", e);
    }

    // Check custom capacity warnings to append in Alerts list
    for (const bin of binsStatus) {
      if (bin.level >= 80) {
        const fullAlert: Alert = {
          id: "alert_full_" + Date.now() + "_" + Math.floor(Math.random()*100),
          title: `${bin.name} is FULL!`,
          description: `Telemetry records container reached ${bin.level}% capacity (${bin.distance}cm). Manual discharge recommended.`,
          severity: "critical",
          timestamp: new Date().toISOString(),
          resolved: false
        };
        alerts.unshift(fullAlert);
        try {
          await insertAlertDb(fullAlert);
        } catch (e) {
          console.error("Failed to insert alert into database", e);
        }
      }
    }

    broadcastState();
    currentStageIndex = 0;
    return;
  }

  const nextStage = STAGES_FLOW[currentStageIndex];
  systemStatus.stage = nextStage;

  // Simulate hardware state based on treatment step
  switch (nextStage) {
    case 'Checking Dustbins':
      actuatorStatus.lcdMessage = "CHK BINS CAP/FILL...";
      actuatorStatus.servo1 = "CLOSED";
      actuatorStatus.servo2 = "CLOSED";
      actuatorStatus.servo3 = "CLOSED";
      actuatorStatus.servo4 = "CLOSED";
      actuatorStatus.pump1 = false;
      actuatorStatus.pump2 = false;
      break;

    case 'Water Injection':
      actuatorStatus.lcdMessage = "PUMP 1 ACTIVE: INJECT H2O";
      actuatorStatus.pump1 = true;
      actuatorStatus.pump2 = false;
      break;

    case 'Waste Agitation':
      actuatorStatus.lcdMessage = "AGITATION MOTOR ON";
      actuatorStatus.pump1 = false;
      actuatorStatus.servo1 = 90; // Spin blade
      actuatorStatus.servo2 = 90; // Secondary shredder
      break;

    case 'Large Waste Separation':
      actuatorStatus.lcdMessage = "GATE 1 OPEN: LARGE SEPARATE";
      actuatorStatus.servo1 = "CLOSED";
      actuatorStatus.servo3 = "OPEN"; // Open gate to Dustbin 1
      break;

    case 'Fine Waste Separation':
      actuatorStatus.lcdMessage = "GATE 2 OPEN: FINE SEPARATE";
      actuatorStatus.servo3 = "CLOSED";
      actuatorStatus.servo2 = 90; // Secondary shredder
      actuatorStatus.servo4 = "OPEN"; // Open gate to Dustbin 2
      break;

    case 'Liquid Separation':
      actuatorStatus.lcdMessage = "PUMP 2 ACTIVE: EXTR. LIQUID";
      actuatorStatus.servo4 = "CLOSED";
      actuatorStatus.pump2 = true;
      break;
    
    default:
      actuatorStatus.lcdMessage = `RUNNING: ${nextStage.toUpperCase()}`;
  }

  const progLog: ProcessLog = {
    id: Math.floor(Math.random() * 1000000),
    created_at: new Date().toISOString(),
    process_stage: nextStage,
    description: `${nextStage} sequence initialized. Actuators adjusted properly. (Stage Progression by ESP32 Controller)`
  };
  processLogs.unshift(progLog);

  try {
    await insertProcessLogDb(progLog);
    await updateActuatorStatusInDb(actuatorStatus);
  } catch (e) {
    console.error("Failed to persist stage progression to database", e);
  }

  broadcastState();
  // Schedule next stage advancement in 6 seconds for animation timing
  stageTimer = setTimeout(advanceStage, 6000);
}

// REST endpoints declaration

// Auth Simulators
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  
  const targetEmail = email ? email.trim().toLowerCase() : "";
  const targetPass = password ? password.trim() : "";

  if (
    (targetEmail === "admin@smartwaste.city" || targetEmail === "admin") && 
    (targetPass === "admin123" || targetPass === "admin")
  ) {
    sessionUser = { email: "admin@smartwaste.city", role: "Admin", name: "System Admin" };
    return res.json({ status: "success", user: sessionUser, token: "admin-token-jwt-sim" });
  } else {
    return res.status(401).json({ error: "Access denied. Only the single Admin account can access the control panel." });
  }
});

app.post("/api/auth/signup", (req, res) => {
  return res.status(403).json({ error: "Access denied. Self-registration is disabled." });
});

app.post("/api/auth/logout", (req, res) => {
  sessionUser = null;
  res.json({ status: "success" });
});

app.get("/api/auth/me", (req, res) => {
  res.json({ user: sessionUser });
});

// SYSTEM CONTROL ACTIONS

// Start Segregation
app.post("/api/system/start", async (req, res) => {
  if (systemStatus.isProcessing) {
    return res.status(400).json({ error: "System is already running a treatment process." });
  }
  
  systemStatus.isProcessing = true;
  systemStatus.paused = false;
  currentStageIndex = 0;
  
  const startLog: ProcessLog = {
    id: Math.floor(Math.random() * 1000000),
    created_at: new Date().toISOString(),
    process_stage: "Ready",
    description: `Wet waste separation run triggered from Web Control Center UI. (Manual Cycle Start by ${sessionUser ? sessionUser.name : "Admin"})`
  };
  processLogs.unshift(startLog);

  try {
    await insertProcessLogDb(startLog);
    // Sync command and status to machine_control table for ESP32 & Web app
    await db.execute(sql`
      UPDATE "machine_control" 
      SET "command" = 'START', "status" = 'RUNNING', "updated_at" = NOW() 
      WHERE "id" = 1
    `);
  } catch (e) {
    console.error("Failed to insert start log or update machine_control in database", e);
  }

  // Cancel any trailing timer
  if (stageTimer) clearTimeout(stageTimer);
  
  // Begin the loop
  advanceStage();

  broadcastState();

  res.json({ status: "success", systemStatus, actuatorStatus });
});

// Stop / Emergency Stop
app.post("/api/system/stop", async (req, res) => {
  systemStatus.isProcessing = false;
  systemStatus.stage = "Ready";
  
  if (stageTimer) {
    clearTimeout(stageTimer);
    stageTimer = null;
  }

  // Deactivate all actuators immediately
  actuatorStatus.pump1 = false;
  actuatorStatus.pump2 = false;
  actuatorStatus.servo1 = "CLOSED";
  actuatorStatus.servo2 = "CLOSED";
  actuatorStatus.servo3 = "CLOSED";
  actuatorStatus.servo4 = "CLOSED";
  actuatorStatus.buzzer = false;
  actuatorStatus.lcdMessage = "EMERGENCY STOP ENGAGED";

  const stopLog: ProcessLog = {
    id: Math.floor(Math.random() * 1000000),
    created_at: new Date().toISOString(),
    process_stage: "Ready",
    description: `Emergency bypass triggered. All actuator lines shut down safely. (Emergency Stop triggered by ${sessionUser ? sessionUser.name : "Admin Code"})`
  };
  processLogs.unshift(stopLog);

  try {
    await insertProcessLogDb(stopLog);
    await updateActuatorStatusInDb(actuatorStatus);
    // Sync command and status to machine_control table for ESP32 & Web app
    await db.execute(sql`
      UPDATE "machine_control" 
      SET "command" = 'STOP', "status" = 'STOPPED', "updated_at" = NOW() 
      WHERE "id" = 1
    `);
  } catch (e) {
    console.error("Failed to stop system or update machine_control in database", e);
  }

  broadcastState();

  res.json({ status: "success", systemStatus, actuatorStatus });
});

// Reset System (Admin action to flush virtual dustbin levels etc.)
app.post("/api/system/reset", async (req, res) => {
  if (stageTimer) {
    clearTimeout(stageTimer);
    stageTimer = null;
  }

  systemStatus = {
    online: true,
    esp32Connected: true,
    stage: "Ready",
    isProcessing: false,
    paused: false
  };

  binsStatus = [
    { id: "dustbin1", name: "Dustbin 1 (Large Waste)", type: "large", level: 0, capacity: 0, distance: 40, status: "Normal" },
    { id: "dustbin2", name: "Dustbin 2 (Fine Waste)", type: "fine", level: 0, capacity: 0, distance: 40, status: "Normal" },
    { id: "liquidTank", name: "Liquid Collection Tank", type: "liquid", level: 0, capacity: 0, distance: 50, status: "Normal" }
  ];

  sensorReadings = [
    { sensorId: "ultrasonic1", name: "Ultrasonic Sensor 1 (Dustbin 1)", distance: 40, fillPercentage: 0, lastUpdated: new Date().toISOString() },
    { sensorId: "ultrasonic2", name: "Ultrasonic Sensor 2 (Dustbin 2)", distance: 40, fillPercentage: 0, lastUpdated: new Date().toISOString() },
    { sensorId: "ultrasonic3", name: "Ultrasonic Sensor 3 (Liquid Tank)", distance: 50, fillPercentage: 0, lastUpdated: new Date().toISOString() }
  ];

  actuatorStatus = {
    servo1: "CLOSED",
    servo2: "CLOSED",
    servo3: "CLOSED",
    servo4: "CLOSED",
    pump1: false,
    pump2: false,
    lcdMessage: "SYSTEM RESET - READY",
    buzzer: false
  };

  const resetLog: ProcessLog = {
    id: Math.floor(Math.random() * 1000000),
    created_at: new Date().toISOString(),
    process_stage: "Ready",
    description: `All dustbin counters flushed. Actuators zeroed out. (System Flush / Reset by ${sessionUser ? sessionUser.name : "Admin"})`
  };
  processLogs.unshift(resetLog);

  // Resolve all warnings
  alerts = alerts.map(alt => ({ ...alt, resolved: true }));

  try {
    await insertProcessLogDb(resetLog);
    await resetSystemDb();

    // Reset Supabase custom tables as well
    await db.execute(sql`
      UPDATE "system_status" 
      SET "esp32_status" = 'online', "current_stage" = 'Ready', "lcd_message" = 'SYSTEM RESET - READY', "buzzer_status" = false, "updated_at" = NOW() 
      WHERE "id" = 1
    `);
    await db.execute(sql`
      UPDATE "dustbins" 
      SET "fill_percentage" = 0, "status" = 'Normal', "updated_at" = NOW() 
      WHERE "id" IN (1, 2)
    `);
    await db.execute(sql`
      UPDATE "liquid_tank" 
      SET "fill_percentage" = 0, "status" = 'Normal', "updated_at" = NOW() 
      WHERE "id" = 1
    `);
    await db.execute(sql`
      UPDATE "servo_status" 
      SET "angle" = 0, "status" = 'Standby', "updated_at" = NOW() 
      WHERE "id" IN (1, 2, 3, 4)
    `);
    await db.execute(sql`
      UPDATE "pump_status" 
      SET "status" = 'OFF', "updated_at" = NOW() 
      WHERE "id" IN (1, 2)
    `);
    await db.execute(sql`
      UPDATE "machine_control" 
      SET "command" = 'RESET', "status" = 'IDLE', "updated_at" = NOW() 
      WHERE "id" = 1
    `);
    await db.execute(sql`
      INSERT INTO "process_logs" ("process_stage", "description", "created_at") 
      VALUES ('Ready', 'All custom IoT tables flushed to standby parameters.', NOW())
    `);
  } catch (e) {
    console.error("Failed to reset system in database", e);
  }

  broadcastState();

  res.json({ status: "success", systemStatus, binsStatus, sensorReadings, actuatorStatus, alerts });
});

// Manual Actuator Controls (Pumps/Servos) - Admin only
app.post("/api/system/manual-actuator", async (req, res) => {
  const { actuator, val } = req.body;
  if (!sessionUser || sessionUser.role !== 'Admin') {
    return res.status(403).json({ error: "Unauthorized access: admin role required." });
  }

  // Update specified actuator key
  if (actuator in actuatorStatus) {
    (actuatorStatus as any)[actuator] = val;
    actuatorStatus.lcdMessage = `MANUAL STATE: ${actuator.toUpperCase()} => ${val}`;
    
    const logItem: ProcessLog = {
      id: Math.floor(Math.random() * 1000000),
      created_at: new Date().toISOString(),
      process_stage: systemStatus.stage,
      description: `Dispatched manual toggle command to ${actuator} with status value: ${val}. (Manual Override Toggle by ${sessionUser.name})`
    };
    processLogs.unshift(logItem);

    try {
      await insertProcessLogDb(logItem);
      await updateActuatorStatusInDb(actuatorStatus);
    } catch (e) {
      console.error("Failed to save manual actuator override in database", e);
    }
  }

  broadcastState();

  res.json({ status: "success", actuatorStatus });
});

// ESP32 Telemetry Update API for Physical ESP32
app.post("/api/sensors/update", async (req, res) => {
  const { ultrasonic1, ultrasonic2, ultrasonic3, esp32Name } = req.body;
  
  systemStatus.esp32Connected = true;
  systemStatus.online = true;

  if (ultrasonic1 !== undefined) {
    const rawDist = Number(ultrasonic1);
    // Supposing bin depth is 40cm max 
    const fillPercent = Math.max(0, Math.min(100, Math.round(((40 - rawDist) / 40) * 100)));
    binsStatus[0].distance = rawDist;
    binsStatus[0].level = fillPercent;
    binsStatus[0].capacity = fillPercent;
    binsStatus[0].status = fillPercent > 80 ? 'Full' : (fillPercent > 50 ? 'Warning' : 'Normal');

    sensorReadings[0].distance = rawDist;
    sensorReadings[0].fillPercentage = fillPercent;
    sensorReadings[0].lastUpdated = new Date().toISOString();
  }

  if (ultrasonic2 !== undefined) {
    const rawDist = Number(ultrasonic2);
    const fillPercent = Math.max(0, Math.min(100, Math.round(((40 - rawDist) / 40) * 100)));
    binsStatus[1].distance = rawDist;
    binsStatus[1].level = fillPercent;
    binsStatus[1].capacity = fillPercent;
    binsStatus[1].status = fillPercent > 80 ? 'Full' : (fillPercent > 50 ? 'Warning' : 'Normal');

    sensorReadings[1].distance = rawDist;
    sensorReadings[1].fillPercentage = fillPercent;
    sensorReadings[1].lastUpdated = new Date().toISOString();
  }

  if (ultrasonic3 !== undefined) {
    const rawDist = Number(ultrasonic3);
    const fillPercent = Math.max(0, Math.min(100, Math.round(((50 - rawDist) / 50) * 100)));
    binsStatus[2].distance = rawDist;
    binsStatus[2].level = fillPercent;
    binsStatus[2].capacity = fillPercent;
    binsStatus[2].status = fillPercent > 80 ? 'Full' : (fillPercent > 50 ? 'Warning' : 'Normal');

    sensorReadings[2].distance = rawDist;
    sensorReadings[2].fillPercentage = fillPercent;
    sensorReadings[2].lastUpdated = new Date().toISOString();
  }

  try {
    await updateBinAndSensorDb("dustbin1", "ultrasonic1", binsStatus[0].distance, binsStatus[0].level, binsStatus[0].status);
    await updateBinAndSensorDb("dustbin2", "ultrasonic2", binsStatus[1].distance, binsStatus[1].level, binsStatus[1].status);
    await updateBinAndSensorDb("liquidTank", "ultrasonic3", binsStatus[2].distance, binsStatus[2].level, binsStatus[2].status);
  } catch (e) {
    console.error("Failed to save telemetry updates in database", e);
  }

  // Generate critical triggers if needed
  for (const bin of binsStatus) {
    if (bin.level >= 80) {
      const isAlreadyLogged = alerts.some(al => al.title.includes(bin.name) && !al.resolved);
      if (!isAlreadyLogged) {
        const alertItem = {
          id: "alert_iot_" + Date.now(),
          title: `IoT Alert: ${bin.name} Critical`,
          description: `Direct physical telemetry reading shows level has entered restricted full zones.`,
          severity: "critical" as const,
          timestamp: new Date().toISOString(),
          resolved: false
        };
        alerts.unshift(alertItem);
        try {
          await insertAlertDb(alertItem);
        } catch (e) {
          console.error("Failed to save telemetry alert in database", e);
        }
      }
    }
  }

  broadcastState();

  // Send physical actuation commands back to ESP32 as response!
  res.json({
    status: "success",
    actuators: {
      servo1: actuatorStatus.servo1 === "OPEN" ? 180 : (actuatorStatus.servo1 === "CLOSED" ? 0 : Number(actuatorStatus.servo1) || 0),
      servo2: actuatorStatus.servo2 === "OPEN" ? 180 : (actuatorStatus.servo2 === "CLOSED" ? 0 : Number(actuatorStatus.servo2) || 0),
      servo3: actuatorStatus.servo3 === "OPEN" ? 180 : (actuatorStatus.servo3 === "CLOSED" ? 0 : Number(actuatorStatus.servo3) || 0),
      servo4: actuatorStatus.servo4 === "OPEN" ? 180 : (actuatorStatus.servo4 === "CLOSED" ? 0 : Number(actuatorStatus.servo4) || 0),
      pump1: actuatorStatus.pump1 ? 1 : 0,
      pump2: actuatorStatus.pump2 ? 1 : 0,
      lcd: actuatorStatus.lcdMessage,
      buzzer: actuatorStatus.buzzer ? 1 : 0
    }
  });
});

// Alerts Create API
app.post("/api/alerts/create", async (req, res) => {
  const { title, description, severity } = req.body;
  const newAlt: Alert = {
    id: "alert_custom_" + Date.now(),
    title: title || "Manual Notice",
    description: description || "System administrative warning filed manually.",
    severity: severity || "info",
    timestamp: new Date().toISOString(),
    resolved: false
  };
  alerts.unshift(newAlt);
  try {
    await insertAlertDb(newAlt);
  } catch (e) {
    console.error("Failed to insert alert into database", e);
  }
  broadcastState();
  res.json({ status: "success", alert: newAlt });
});

// Resolve Alerts
app.post("/api/alerts/resolve", async (req, res) => {
  const { id } = req.body;
  alerts = alerts.map(al => al.id === id ? { ...al, resolved: true } : al);
  try {
    await resolveAlertDb(id);
  } catch (e) {
    console.error("Failed to resolve alert in database", e);
  }
  broadcastState();
  res.json({ status: "success", alerts });
});

// GET DASHBOARD CONSOLIDATED DATA
app.get("/api/dashboard", async (req, res) => {
  try {
    const dbDashboard = await getDashboardData();
    // Sync memory variables
    binsStatus = dbDashboard.bins;
    sensorReadings = dbDashboard.sensors;
    actuatorStatus = dbDashboard.actuator;
    alerts = dbDashboard.alerts;
    processLogs = dbDashboard.logs;
  } catch (e) {
    console.error("Failed to fetch fresh dashboard data from database, using memory cache", e);
  }
  res.json({
    systemStatus,
    binsStatus,
    sensorReadings,
    actuatorStatus,
    alerts,
    processLogs
  });
});

// Simple API status/alive endpoint
app.get("/api/status", (req, res) => {
  res.json({
    online: systemStatus.online,
    esp32Connected: systemStatus.esp32Connected,
    timestamp: new Date().toISOString()
  });
});

// Supabase Status Endpoint
app.get("/api/supabase/status", (req, res) => {
  const getPostgresUrl = () => {
    const urls = [process.env.DATABASE_URL, process.env.SUPABASE_DB_URL];
    for (const url of urls) {
      if (url && (url.startsWith("postgres://") || url.startsWith("postgresql://"))) {
        return url;
      }
    }
    return undefined;
  };
  
  const supabaseUrl = getPostgresUrl();
  const isConfigured = Boolean(supabaseUrl);
  const isUsingSupabase = isConfigured && (supabaseUrl.includes("supabase") || supabaseUrl.includes("postgres."));
  
  res.json({
    configured: isConfigured,
    usingSupabase: isUsingSupabase,
    dbType: isUsingSupabase ? "Supabase PostgreSQL" : (isConfigured ? "Custom PostgreSQL" : "Cloud SQL (Pre-configured)"),
    connectionHost: supabaseUrl ? (supabaseUrl.split("@")[1] || "").split("/")[0] : "Local/Cloud SQL"
  });
});

// Live Database Tables Info Endpoint
app.get("/api/supabase/tables-info", async (req, res) => {
  try {
    const tableCounts = await getDatabaseTableCounts();
    res.json({ success: true, tableCounts });
  } catch (error: any) {
    console.error("[API] Failed to fetch table info from database", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET complete IoT state from Supabase tables
app.get("/api/supabase/iot-data", async (req, res) => {
  try {
    const systemRes = await db.execute(sql`SELECT * FROM "system_status" ORDER BY id ASC`);
    const dustbinsRes = await db.execute(sql`SELECT * FROM "dustbins" ORDER BY id ASC`);
    const liquidTankRes = await db.execute(sql`SELECT * FROM "liquid_tank" ORDER BY id ASC`);
    const servosRes = await db.execute(sql`SELECT * FROM "servo_status" ORDER BY id ASC`);
    const pumpsRes = await db.execute(sql`SELECT * FROM "pump_status" ORDER BY id ASC`);
    const logsRes = await db.execute(sql`SELECT * FROM "process_logs" ORDER BY id DESC LIMIT 50`);

    let machineRes = { rows: [] as any[] };
    try {
      machineRes = await db.execute(sql`SELECT * FROM "machine_control" WHERE "id" = 1`);
      if (machineRes.rows.length === 0) {
        await db.execute(sql`INSERT INTO "machine_control" ("id", "command", "status", "updated_at") VALUES (1, 'IDLE', 'IDLE', NOW()) ON CONFLICT (id) DO NOTHING`);
        machineRes = await db.execute(sql`SELECT * FROM "machine_control" WHERE "id" = 1`);
      }
    } catch (e) {
      console.warn("[API] machine_control table may not exist yet, using default fallback values", e);
      machineRes = { rows: [{ id: 1, command: "IDLE", status: "IDLE" }] };
    }

    res.json({
      success: true,
      data: {
        system_status: systemRes.rows,
        dustbins: dustbinsRes.rows,
        liquid_tank: liquidTankRes.rows,
        servo_status: servosRes.rows,
        pump_status: pumpsRes.rows,
        process_logs: logsRes.rows,
        machine_control: machineRes.rows
      }
    });
  } catch (error: any) {
    console.error("[API] Failed to fetch Supabase IoT data", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST update or insert data into Supabase tables
app.post("/api/supabase/update-iot-data", async (req, res) => {
  const { table, id, payload } = req.body;
  
  if (!table || !payload) {
    return res.status(400).json({ success: false, error: "Missing table name or payload" });
  }

  try {
    if (table === "system_status") {
      const { esp32_status, current_stage, lcd_message, buzzer_status } = payload;
      await db.execute(sql`
        UPDATE "system_status" 
        SET "esp32_status" = ${esp32_status}, "current_stage" = ${current_stage}, "lcd_message" = ${lcd_message}, "buzzer_status" = ${buzzer_status ?? false}, "updated_at" = NOW() 
        WHERE "id" = ${id || 1}
      `);
    } else if (table === "dustbins") {
      const { fill_percentage, status } = payload;
      await db.execute(sql`
        UPDATE "dustbins" 
        SET "fill_percentage" = ${fill_percentage}, "status" = ${status}, "updated_at" = NOW() 
        WHERE "id" = ${id}
      `);
    } else if (table === "liquid_tank") {
      const { fill_percentage, status } = payload;
      await db.execute(sql`
        UPDATE "liquid_tank" 
        SET "fill_percentage" = ${fill_percentage}, "status" = ${status}, "updated_at" = NOW() 
        WHERE "id" = ${id || 1}
      `);
    } else if (table === "servo_status") {
      const { angle, status } = payload;
      await db.execute(sql`
        UPDATE "servo_status" 
        SET "angle" = ${angle}, "status" = ${status}, "updated_at" = NOW() 
        WHERE "id" = ${id}
      `);
    } else if (table === "pump_status") {
      const { status } = payload;
      await db.execute(sql`
        UPDATE "pump_status" 
        SET "status" = ${status}, "updated_at" = NOW() 
        WHERE "id" = ${id}
      `);
    } else if (table === "process_logs") {
      const { process_stage, description } = payload;
      await db.execute(sql`
        INSERT INTO "process_logs" ("process_stage", "description", "created_at") 
        VALUES (${process_stage}, ${description}, NOW())
      `);
    } else if (table === "machine_control") {
      const { command, status } = payload;
      if (command !== undefined && status !== undefined) {
        await db.execute(sql`
          UPDATE "machine_control" 
          SET "command" = ${command}, "status" = ${status}, "updated_at" = NOW() 
          WHERE "id" = ${id || 1}
        `);
      } else if (command !== undefined) {
        let targetStatus = "IDLE";
        if (command === "START") targetStatus = "RUNNING";
        else if (command === "STOP") targetStatus = "STOPPED";
        else if (command === "RESET") targetStatus = "IDLE";

        await db.execute(sql`
          UPDATE "machine_control" 
          SET "command" = ${command}, "status" = ${targetStatus}, "updated_at" = NOW() 
          WHERE "id" = ${id || 1}
        `);

        // Trigger local simulation process adjustments to align with database updates
        if (command === "START" && !systemStatus.isProcessing) {
          systemStatus.isProcessing = true;
          systemStatus.paused = false;
          currentStageIndex = 0;
          
          const startLog: ProcessLog = {
            id: Math.floor(Math.random() * 1000000),
            created_at: new Date().toISOString(),
            process_stage: "Ready",
            description: `Separation treatment run triggered via IoT database channel command (START).`
          };
          processLogs.unshift(startLog);
          try {
            await insertProcessLogDb(startLog);
          } catch (e) {
            console.error("Failed to insert start log", e);
          }
          if (stageTimer) clearTimeout(stageTimer);
          advanceStage();
          broadcastState();
        } else if (command === "STOP") {
          systemStatus.isProcessing = false;
          systemStatus.stage = "Ready";
          if (stageTimer) {
            clearTimeout(stageTimer);
            stageTimer = null;
          }
          actuatorStatus.pump1 = false;
          actuatorStatus.pump2 = false;
          actuatorStatus.servo1 = "CLOSED";
          actuatorStatus.servo2 = "CLOSED";
          actuatorStatus.servo3 = "CLOSED";
          actuatorStatus.servo4 = "CLOSED";
          actuatorStatus.buzzer = false;
          actuatorStatus.lcdMessage = "EMERGENCY STOP ENGAGED";

          const stopLog: ProcessLog = {
            id: Math.floor(Math.random() * 1000000),
            created_at: new Date().toISOString(),
            process_stage: "Ready",
            description: `Process execution halted via IoT database channel command (STOP). All actuators zeroed.`
          };
          processLogs.unshift(stopLog);
          try {
            await insertProcessLogDb(stopLog);
            await updateActuatorStatusInDb(actuatorStatus);
          } catch (e) {
            console.error("Failed to insert stop logs", e);
          }
          broadcastState();
        } else if (command === "RESET") {
          if (stageTimer) {
            clearTimeout(stageTimer);
            stageTimer = null;
          }
          systemStatus = {
            online: true,
            esp32Connected: true,
            stage: "Ready",
            isProcessing: false,
            paused: false
          };
          binsStatus = [
            { id: "dustbin1", name: "Dustbin 1 (Large Waste)", type: "large", level: 0, capacity: 0, distance: 40, status: "Normal" },
            { id: "dustbin2", name: "Dustbin 2 (Fine Waste)", type: "fine", level: 0, capacity: 0, distance: 40, status: "Normal" },
            { id: "liquidTank", name: "Liquid Collection Tank", type: "liquid", level: 0, capacity: 0, distance: 50, status: "Normal" }
          ];
          sensorReadings = [
            { sensorId: "ultrasonic1", name: "Ultrasonic Sensor 1 (Dustbin 1)", distance: 40, fillPercentage: 0, lastUpdated: new Date().toISOString() },
            { sensorId: "ultrasonic2", name: "Ultrasonic Sensor 2 (Dustbin 2)", distance: 40, fillPercentage: 0, lastUpdated: new Date().toISOString() },
            { sensorId: "ultrasonic3", name: "Ultrasonic Sensor 3 (Liquid Tank)", distance: 50, fillPercentage: 0, lastUpdated: new Date().toISOString() }
          ];
          actuatorStatus = {
            servo1: "CLOSED",
            servo2: "CLOSED",
            servo3: "CLOSED",
            servo4: "CLOSED",
            pump1: false,
            pump2: false,
            lcdMessage: "SYSTEM RESET - READY",
            buzzer: false
          };
          const resetLog: ProcessLog = {
            id: Math.floor(Math.random() * 1000000),
            created_at: new Date().toISOString(),
            process_stage: "Ready",
            description: `All dustbin counters flushed. Actuators zeroed out. (System Flush / Reset by Database reset command)`
          };
          processLogs.unshift(resetLog);
          alerts = alerts.map(alt => ({ ...alt, resolved: true }));
          try {
            await insertProcessLogDb(resetLog);
            await resetSystemDb();
            await db.execute(sql`
              UPDATE "system_status" 
              SET "esp32_status" = 'online', "current_stage" = 'Ready', "lcd_message" = 'SYSTEM RESET - READY', "buzzer_status" = false, "updated_at" = NOW() 
              WHERE "id" = 1
            `);
            await db.execute(sql`
              UPDATE "dustbins" 
              SET "fill_percentage" = 0, "status" = 'Normal', "updated_at" = NOW() 
              WHERE "id" IN (1, 2)
            `);
            await db.execute(sql`
              UPDATE "liquid_tank" 
              SET "fill_percentage" = 0, "status" = 'Normal', "updated_at" = NOW() 
              WHERE "id" = 1
            `);
            await db.execute(sql`
              UPDATE "servo_status" 
              SET "angle" = 0, "status" = 'Standby', "updated_at" = NOW() 
              WHERE "id" IN (1, 2, 3, 4)
            `);
            await db.execute(sql`
              UPDATE "pump_status" 
              SET "status" = 'OFF', "updated_at" = NOW() 
              WHERE "id" IN (1, 2)
            `);
            await db.execute(sql`
              INSERT INTO "process_logs" ("process_stage", "description", "created_at") 
              VALUES ('Ready', 'All custom IoT tables flushed to standby parameters.', NOW())
            `);
          } catch (e) {
            console.error("Failed to reset db", e);
          }
          broadcastState();
        }
      } else if (status !== undefined) {
        await db.execute(sql`
          UPDATE "machine_control" 
          SET "status" = ${status}, "updated_at" = NOW() 
          WHERE "id" = ${id || 1}
        `);
      }
    } else {
      return res.status(400).json({ success: false, error: `Unsupported table: ${table}` });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error(`[API] Failed to update table ${table}`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});


// Real-time Event Streaming (SSE)
app.get("/api/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");

  // Send initial data
  const initialPayload = {
    systemStatus,
    binsStatus,
    sensorReadings,
    actuatorStatus,
    alerts,
    processLogs
  };
  res.write(`data: ${JSON.stringify(initialPayload)}\n\n`);

  sseClients.push(res);

  // Keep connection alive with heartbeat ping every 15s
  const heartbeat = setInterval(() => {
    res.write(": ping\n\n");
  }, 15000);

  req.on("close", () => {
    clearInterval(heartbeat);
    sseClients = sseClients.filter(c => c !== res);
  });
});

// ANALYTICS ENDPOINT
app.get("/api/analytics", async (req, res) => {
  console.log("[API] /api/analytics requested");
  try {
    const dbAnalytics = await getAnalyticsDb();
    console.log("[API] Successfully fetched analytics from DB");
    return res.json({
      analyticsData: {
        daily: dbAnalytics.daily,
        weekly: dbAnalytics.weekly,
        monthly: dbAnalytics.monthly
      },
      summary: dbAnalytics.summary
    });
  } catch (e) {
    console.error("[API] Failed to fetch analytics from database, falling back to memory cache", e);
    return res.json({
      analyticsData,
      summary: {
        totalCleanedKg: 342,
        savedVolumeL: 820,
        operationalHours: 194,
        totalSuccessCycles: 154
      }
    });
  }
});

// Serve frontend assets & Vite connection
async function startServer() {
  // Initialize and seed database
  try {
    await seedDatabase();
    console.log("Database initialized and seeded successfully.");
    
    // Sync memory variables from database
    const dbData = await getDashboardData();
    binsStatus = dbData.bins;
    sensorReadings = dbData.sensors;
    actuatorStatus = dbData.actuator as any;
    alerts = dbData.alerts;
    processLogs = dbData.logs as any;
    console.log("Memory state synchronized with Cloud SQL database.");
  } catch (err) {
    console.error("Failed to initialize database connection. Falling back to memory storage.", err);
  }

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Smart waste segregation server online on http://0.0.0.0:${PORT}`);
  });
}

startServer();
