import { pgTable, text, integer, boolean, timestamp, serial } from "drizzle-orm/pg-core";

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  uid: text("uid").notNull().unique(), // Firebase Auth UID
  email: text("email").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("Operator"), // 'Admin' | 'Operator'
  createdAt: timestamp("created_at").defaultNow(),
});

// Bins status table
export const binsStatus = pgTable("bins_status", {
  id: text("id").primaryKey(), // 'dustbin1' | 'dustbin2' | 'liquidTank'
  name: text("name").notNull(),
  type: text("type").notNull(), // 'large' | 'fine' | 'liquid'
  level: integer("level").notNull(),
  capacity: integer("capacity").notNull(),
  distance: integer("distance").notNull(),
  status: text("status").notNull(), // 'Normal' | 'Warning' | 'Full'
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Sensor readings table
export const sensorReadings = pgTable("sensor_readings", {
  sensorId: text("sensor_id").primaryKey(), // 'ultrasonic1' | 'ultrasonic2' | 'ultrasonic3'
  name: text("name").notNull(),
  distance: integer("distance").notNull(),
  fillPercentage: integer("fill_percentage").notNull(),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

// Actuator status table
export const actuatorStatus = pgTable("actuator_status", {
  id: text("id").primaryKey(), // 'current'
  servo1: text("servo1").notNull(), // 'CENTER' | 'OPEN' | 'CLOSED' or stringified number
  servo2: text("servo2").notNull(),
  servo3: text("servo3").notNull(),
  servo4: text("servo4").notNull(),
  pump1: boolean("pump1").notNull().default(false),
  pump2: boolean("pump2").notNull().default(false),
  lcdMessage: text("lcd_message").notNull().default("SYSTEM READY"),
  buzzer: boolean("buzzer").notNull().default(false),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Alerts table
export const alerts = pgTable("alerts", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  severity: text("severity").notNull(), // 'critical' | 'warning' | 'info'
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  resolved: boolean("resolved").notNull().default(false),
});

// Process logs table
export const processLogs = pgTable("process_logs", {
  id: text("id").primaryKey(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  stage: text("stage").notNull(),
  action: text("action").notNull(),
  operator: text("operator").notNull(),
  details: text("details").notNull(),
});

// Analytics Daily table
export const analyticsDaily = pgTable("analytics_daily", {
  date: text("date").primaryKey(), // e.g. "Mon", "Tue"
  large: integer("large").notNull().default(0),
  fine: integer("fine").notNull().default(0),
  liquid: integer("liquid").notNull().default(0),
  cycles: integer("cycles").notNull().default(0),
});

// Analytics Weekly table
export const analyticsWeekly = pgTable("analytics_weekly", {
  week: text("week").primaryKey(), // e.g. "Week 21"
  large: integer("large").notNull().default(0),
  fine: integer("fine").notNull().default(0),
  liquid: integer("liquid").notNull().default(0),
  cycles: integer("cycles").notNull().default(0),
});

// Analytics Monthly table
export const analyticsMonthly = pgTable("analytics_monthly", {
  month: text("month").primaryKey(), // e.g. "Jan", "Feb"
  large: integer("large").notNull().default(0),
  fine: integer("fine").notNull().default(0),
  liquid: integer("liquid").notNull().default(0),
  cycles: integer("cycles").notNull().default(0),
});
