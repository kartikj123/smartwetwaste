import { db } from "./index.ts";
import { eq, desc, sql } from "drizzle-orm";
import { 
  users, 
  binsStatus, 
  sensorReadings, 
  actuatorStatus, 
  alerts, 
  processLogs, 
  analyticsDaily, 
  analyticsWeekly, 
  analyticsMonthly 
} from "./schema.ts";
import { BinStatus, SensorReading, ActuatorStatus as ActuatorType, Alert, ProcessLog } from "../types.ts";

// Robust query layer error wrapper
async function queryWrapper<T>(queryFn: () => Promise<T>, errorMessage: string): Promise<T> {
  try {
    return await queryFn();
  } catch (error) {
    console.error(`Database Error: ${errorMessage}`, error);
    throw new Error(`${errorMessage}. Please try again later.`, { cause: error });
  }
}

// 1. Database Seeding Function
export async function seedDatabase() {
  await queryWrapper(async () => {
    // Seed Bins Status
    const binsCount = await db.select().from(binsStatus);
    if (binsCount.length === 0) {
      console.log("Seeding initial bins_status data...");
      await db.insert(binsStatus).values([
        { id: "dustbin1", name: "Dustbin 1 (Large Waste)", type: "large", level: 25, capacity: 25, distance: 30, status: "Normal" },
        { id: "dustbin2", name: "Dustbin 2 (Fine Waste)", type: "fine", level: 41, capacity: 41, distance: 24, status: "Normal" },
        { id: "liquidTank", name: "Liquid Collection Tank", type: "liquid", level: 18, capacity: 18, distance: 41, status: "Normal" }
      ]);
    }

    // Seed Sensor Readings
    const sensorsCount = await db.select().from(sensorReadings);
    if (sensorsCount.length === 0) {
      console.log("Seeding initial sensor_readings data...");
      await db.insert(sensorReadings).values([
        { sensorId: "ultrasonic1", name: "Ultrasonic Sensor 1 (Dustbin 1)", distance: 30, fillPercentage: 25 },
        { sensorId: "ultrasonic2", name: "Ultrasonic Sensor 2 (Dustbin 2)", distance: 24, fillPercentage: 41 },
        { sensorId: "ultrasonic3", name: "Ultrasonic Sensor 3 (Liquid Tank)", distance: 41, fillPercentage: 18 }
      ]);
    }

    // Seed Actuator Status
    const actuatorCount = await db.select().from(actuatorStatus);
    if (actuatorCount.length === 0) {
      console.log("Seeding initial actuator_status data...");
      await db.insert(actuatorStatus).values([
        { 
          id: "current", 
          servo1: "CLOSED", 
          servo2: "CLOSED", 
          servo3: "CLOSED", 
          servo4: "CLOSED", 
          pump1: false, 
          pump2: false, 
          lcdMessage: "SYSTEM READY - ONLINE", 
          buzzer: false 
        }
      ]);
    }

    // Seed Alerts
    const alertsCount = await db.select().from(alerts);
    if (alertsCount.length === 0) {
      console.log("Seeding initial alerts data...");
      await db.insert(alerts).values([
        { 
          id: "alert_1", 
          title: "Container 2 is FULL!", 
          description: "Telemetry records show Fine Solid Waste Container 2 has exceeded its threshold level.", 
          severity: "critical", 
          timestamp: new Date(), 
          resolved: false 
        }
      ]);
    }

    // Seed Process Logs
    const logsCount = await db.select().from(processLogs);
    if (logsCount.length === 0) {
      console.log("Seeding initial process_logs data...");
      await db.insert(processLogs).values([
        { 
          processStage: "Completed", 
          description: "Processed 4.2kg wet waste safely. (Cycle Auto Start by System Scheduler)",
          createdAt: new Date(Date.now() - 7200000)
        },
        { 
          processStage: "Checking Dustbins", 
          description: "All sensor distances verified inside tolerance boundaries. (System Diagnostic Check by System Admin)",
          createdAt: new Date(Date.now() - 3600000)
        }
      ]);
    }

    // Seed Analytics Daily
    const dailyCount = await db.select().from(analyticsDaily);
    if (dailyCount.length === 0) {
      console.log("Seeding initial analytics_daily data...");
      await db.insert(analyticsDaily).values([
        { date: "Mon", large: 12, fine: 15, liquid: 22, cycles: 5 },
        { date: "Tue", large: 19, fine: 11, liquid: 28, cycles: 6 },
        { date: "Wed", large: 15, fine: 18, liquid: 32, cycles: 7 },
        { date: "Thu", large: 22, fine: 21, liquid: 24, cycles: 8 },
        { date: "Fri", large: 30, fine: 28, liquid: 45, cycles: 12 },
        { date: "Sat", large: 8, fine: 12, liquid: 15, cycles: 4 },
        { date: "Sun", large: 14, fine: 10, liquid: 20, cycles: 5 }
      ]);
    }

    // Seed Analytics Weekly
    const weeklyCount = await db.select().from(analyticsWeekly);
    if (weeklyCount.length === 0) {
      console.log("Seeding initial analytics_weekly data...");
      await db.insert(analyticsWeekly).values([
        { week: "Week 21", large: 92, fine: 85, liquid: 140, cycles: 42 },
        { week: "Week 22", large: 110, fine: 102, liquid: 165, cycles: 48 },
        { week: "Week 23", large: 135, fine: 118, liquid: 190, cycles: 55 },
        { week: "Week 24", large: 150, fine: 132, liquid: 210, cycles: 62 }
      ]);
    }

    // Seed Analytics Monthly
    const monthlyCount = await db.select().from(analyticsMonthly);
    if (monthlyCount.length === 0) {
      console.log("Seeding initial analytics_monthly data...");
      await db.insert(analyticsMonthly).values([
        { month: "Jan", large: 450, fine: 390, liquid: 680, cycles: 180 },
        { month: "Feb", large: 490, fine: 410, liquid: 720, cycles: 195 },
        { month: "Mar", large: 520, fine: 480, liquid: 810, cycles: 215 },
        { month: "Apr", large: 580, fine: 510, liquid: 890, cycles: 240 },
        { month: "May", large: 610, fine: 540, liquid: 940, cycles: 260 },
        { month: "Jun", large: 650, fine: 590, liquid: 1020, cycles: 290 }
      ]);
    }
    
    console.log("Database seeded successfully.");
  }, "Failed to seed database");
}

// 2. Fetch Dashboard data
export async function getDashboardData() {
  return await queryWrapper(async () => {
    const bins = await db.select().from(binsStatus).orderBy(binsStatus.id);
    const sensors = await db.select().from(sensorReadings).orderBy(sensorReadings.sensorId);
    const actuator = await db.select().from(actuatorStatus).where(eq(actuatorStatus.id, "current"));
    const activeAlerts = await db.select().from(alerts).orderBy(desc(alerts.timestamp));
    const logs = await db.select().from(processLogs).orderBy(desc(processLogs.id)).limit(30);

    return {
      bins: bins.map(b => ({
        id: b.id as 'dustbin1' | 'dustbin2' | 'liquidTank',
        name: b.name,
        type: b.type as 'large' | 'fine' | 'liquid',
        level: b.level,
        capacity: b.capacity,
        distance: b.distance,
        status: b.status as 'Normal' | 'Warning' | 'Full'
      })),
      sensors: sensors.map(s => ({
        sensorId: s.sensorId as 'ultrasonic1' | 'ultrasonic2' | 'ultrasonic3',
        name: s.name,
        distance: s.distance,
        fillPercentage: s.fillPercentage,
        lastUpdated: s.lastUpdated?.toISOString() || new Date().toISOString()
      })),
      actuator: actuator[0] ? {
        servo1: isNaN(Number(actuator[0].servo1)) ? actuator[0].servo1 as any : Number(actuator[0].servo1),
        servo2: isNaN(Number(actuator[0].servo2)) ? actuator[0].servo2 as any : Number(actuator[0].servo2),
        servo3: isNaN(Number(actuator[0].servo3)) ? actuator[0].servo3 as any : Number(actuator[0].servo3),
        servo4: isNaN(Number(actuator[0].servo4)) ? actuator[0].servo4 as any : Number(actuator[0].servo4),
        pump1: actuator[0].pump1,
        pump2: actuator[0].pump2,
        lcdMessage: actuator[0].lcdMessage,
        buzzer: actuator[0].buzzer
      } : {
        servo1: "CLOSED" as const,
        servo2: "CLOSED" as const,
        servo3: "CLOSED" as const,
        servo4: "CLOSED" as const,
        pump1: false,
        pump2: false,
        lcdMessage: "SYSTEM READY",
        buzzer: false
      },
      alerts: activeAlerts.map(a => ({
        id: a.id,
        title: a.title,
        description: a.description,
        severity: a.severity as 'critical' | 'warning' | 'info',
        timestamp: a.timestamp.toISOString(),
        resolved: a.resolved
      })),
      logs: logs.map(l => ({
        id: l.id,
        created_at: l.createdAt?.toISOString() || new Date().toISOString(),
        process_stage: l.processStage,
        description: l.description
      }))
    };
  }, "Failed to retrieve dashboard data");
}

// 3. Update Actuators in DB
export async function updateActuatorStatusInDb(status: Partial<ActuatorType>) {
  return await queryWrapper(async () => {
    const updatePayload: any = {};
    if (status.servo1 !== undefined) updatePayload.servo1 = String(status.servo1);
    if (status.servo2 !== undefined) updatePayload.servo2 = String(status.servo2);
    if (status.servo3 !== undefined) updatePayload.servo3 = String(status.servo3);
    if (status.servo4 !== undefined) updatePayload.servo4 = String(status.servo4);
    if (status.pump1 !== undefined) updatePayload.pump1 = status.pump1;
    if (status.pump2 !== undefined) updatePayload.pump2 = status.pump2;
    if (status.lcdMessage !== undefined) updatePayload.lcdMessage = status.lcdMessage;
    if (status.buzzer !== undefined) updatePayload.buzzer = status.buzzer;
    updatePayload.updatedAt = new Date();

    await db.update(actuatorStatus)
      .set(updatePayload)
      .where(eq(actuatorStatus.id, "current"));
  }, "Failed to update actuator status");
}

// 4. Update Bin and Sensor Reading in DB
export async function updateBinAndSensorDb(binId: string, sensorId: string, distance: number, level: number, status: string) {
  return await queryWrapper(async () => {
    const now = new Date();
    await db.update(binsStatus)
      .set({ distance, level, capacity: level, status, updatedAt: now })
      .where(eq(binsStatus.id, binId));

    await db.update(sensorReadings)
      .set({ distance, fillPercentage: level, lastUpdated: now })
      .where(eq(sensorReadings.sensorId, sensorId));
  }, "Failed to update bin and sensor reading");
}

// 5. Reset all counters and clear history
export async function resetSystemDb() {
  return await queryWrapper(async () => {
    const now = new Date();
    // Flush bins
    await db.update(binsStatus)
      .set({ level: 0, capacity: 0, distance: 40, status: "Normal", updatedAt: now })
      .where(eq(binsStatus.id, "dustbin1"));
    await db.update(binsStatus)
      .set({ level: 0, capacity: 0, distance: 40, status: "Normal", updatedAt: now })
      .where(eq(binsStatus.id, "dustbin2"));
    await db.update(binsStatus)
      .set({ level: 0, capacity: 0, distance: 50, status: "Normal", updatedAt: now })
      .where(eq(binsStatus.id, "liquidTank"));

    // Flush sensors
    await db.update(sensorReadings)
      .set({ distance: 40, fillPercentage: 0, lastUpdated: now })
      .where(eq(sensorReadings.sensorId, "ultrasonic1"));
    await db.update(sensorReadings)
      .set({ distance: 40, fillPercentage: 0, lastUpdated: now })
      .where(eq(sensorReadings.sensorId, "ultrasonic2"));
    await db.update(sensorReadings)
      .set({ distance: 50, fillPercentage: 0, lastUpdated: now })
      .where(eq(sensorReadings.sensorId, "ultrasonic3"));

    // Reset actuators
    await db.update(actuatorStatus)
      .set({
        servo1: "CLOSED",
        servo2: "CLOSED",
        servo3: "CLOSED",
        servo4: "CLOSED",
        pump1: false,
        pump2: false,
        lcdMessage: "SYSTEM RESET - READY",
        buzzer: false,
        updatedAt: now
      })
      .where(eq(actuatorStatus.id, "current"));

    // Resolve all alerts
    await db.update(alerts)
      .set({ resolved: true });
  }, "Failed to reset system database");
}

// 6. Insert alert
export async function insertAlertDb(alert: Alert) {
  return await queryWrapper(async () => {
    await db.insert(alerts).values({
      id: alert.id,
      title: alert.title,
      description: alert.description,
      severity: alert.severity,
      timestamp: new Date(alert.timestamp),
      resolved: alert.resolved
    });
  }, "Failed to record system alert");
}

// 7. Resolve an alert
export async function resolveAlertDb(id: string) {
  return await queryWrapper(async () => {
    await db.update(alerts)
      .set({ resolved: true })
      .where(eq(alerts.id, id));
  }, "Failed to resolve alert");
}

// 8. Insert process log
export async function insertProcessLogDb(log: ProcessLog) {
  return await queryWrapper(async () => {
    await db.insert(processLogs).values({
      processStage: log.process_stage,
      description: log.description,
      createdAt: log.created_at ? new Date(log.created_at) : new Date()
    });
  }, "Failed to append process log");
}

// 9. Fetch Analytics
export async function getAnalyticsDb() {
  return await queryWrapper(async () => {
    const daily = await db.select().from(analyticsDaily);
    const weekly = await db.select().from(analyticsWeekly);
    const monthly = await db.select().from(analyticsMonthly);

    // Summing stats
    let totalLarge = 0;
    let totalFine = 0;
    let totalLiquid = 0;
    let totalCycles = 0;

    daily.forEach(d => {
      totalLarge += d.large;
      totalFine += d.fine;
      totalLiquid += d.liquid;
      totalCycles += d.cycles;
    });

    return {
      daily: daily.map(d => ({ date: d.date, large: d.large, fine: d.fine, liquid: d.liquid, cycles: d.cycles })),
      weekly: weekly.map(w => ({ week: w.week, large: w.large, fine: w.fine, liquid: w.liquid, cycles: w.cycles })),
      monthly: monthly.map(m => ({ month: m.month, large: m.large, fine: m.fine, liquid: m.liquid, cycles: m.cycles })),
      summary: {
        totalCleanedKg: totalLarge + totalFine,
        savedVolumeL: totalLiquid,
        operationalHours: Math.round(totalCycles * 1.25),
        totalSuccessCycles: totalCycles
      }
    };
  }, "Failed to retrieve analytical charts");
}

// 10. Update Daily Analytics (increment values)
export async function incrementDailyAnalyticsDb(largeW: number, fineW: number, liquidW: number) {
  return await queryWrapper(async () => {
    // Current day representation (Mon-Sun mapping to current weekday)
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const todayStr = days[new Date().getDay()];

    const currentRecord = await db.select().from(analyticsDaily).where(eq(analyticsDaily.date, todayStr));
    if (currentRecord[0]) {
      await db.update(analyticsDaily)
        .set({
          large: currentRecord[0].large + largeW,
          fine: currentRecord[0].fine + fineW,
          liquid: currentRecord[0].liquid + liquidW,
          cycles: currentRecord[0].cycles + 1
        })
        .where(eq(analyticsDaily.date, todayStr));
    }
  }, "Failed to update analytical counters");
}

// 11. Retrieve Row Counts for all 10 standard tables to display in frontend
export async function getDatabaseTableCounts() {
  return await queryWrapper(async () => {
    // Standard tables counts using select counts
    const usersCount = await db.select({ count: sql<number>`count(*)` }).from(users);
    const binsCount = await db.select({ count: sql<number>`count(*)` }).from(binsStatus);
    const sensorsCount = await db.select({ count: sql<number>`count(*)` }).from(sensorReadings);
    const actuatorCount = await db.select({ count: sql<number>`count(*)` }).from(actuatorStatus);
    const alertsCount = await db.select({ count: sql<number>`count(*)` }).from(alerts);
    const logsCount = await db.select({ count: sql<number>`count(*)` }).from(processLogs);
    const analyticsCount = await db.select({ count: sql<number>`count(*)` }).from(analyticsDaily);

    // Dynamic checks for the supplementary custom tables in Supabase public schema
    const customTables = ["dustbins", "liquid_tank", "servo_status", "pump_status", "ultrasonic_readings", "system_status", "analytics"];
    const customCounts: Record<string, number> = {};

    for (const tbl of customTables) {
      try {
        const queryRes = await db.execute(sql.raw(`SELECT count(*) FROM "${tbl}"`));
        customCounts[tbl] = Number(queryRes.rows[0]?.count ?? 0);
      } catch (err) {
        customCounts[tbl] = 0; // fallback if table not yet populated or accessible
      }
    }

    return {
      users: Number(usersCount[0]?.count || 0),
      bins_status: Number(binsCount[0]?.count || 0),
      sensor_readings: Number(sensorsCount[0]?.count || 0),
      actuator_status: Number(actuatorCount[0]?.count || 0),
      alerts: Number(alertsCount[0]?.count || 0),
      process_logs: Number(logsCount[0]?.count || 0),
      analytics_daily: Number(analyticsCount[0]?.count || 0),
      ...customCounts
    };
  }, "Failed to retrieve database table counts");
}
