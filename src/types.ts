export type Role = 'Admin' | 'Operator';

export interface User {
  id: string;
  email: string;
  role: Role;
  name: string;
}

export type SystemStage =
  | 'Ready'
  | 'Checking Dustbins'
  | 'Water Injection'
  | 'Waste Agitation'
  | 'Large Waste Separation'
  | 'Fine Waste Separation'
  | 'Liquid Separation'
  | 'Completed';

export interface SystemStatus {
  online: boolean;
  esp32Connected: boolean;
  stage: SystemStage;
  isProcessing: boolean;
  paused: boolean;
}

export interface BinStatus {
  id: 'dustbin1' | 'dustbin2' | 'liquidTank';
  name: string;
  type: 'large' | 'fine' | 'liquid';
  level: number;       // 0 to 100%
  capacity: number;    // e.g. current volume in Liters or occupancy percentage
  distance: number;    // raw ultrasonic reading in cm
  status: 'Normal' | 'Warning' | 'Full';
}

export interface ActuatorStatus {
  servo1: 'CENTER' | 'OPEN' | 'CLOSED' | number;
  servo2: 'CENTER' | 'OPEN' | 'CLOSED' | number;
  servo3: 'CENTER' | 'OPEN' | 'CLOSED' | number;
  servo4: 'CENTER' | 'OPEN' | 'CLOSED' | number;
  pump1: boolean;
  pump2: boolean;
  lcdMessage: string;
  buzzer: boolean;
}

export interface SensorReading {
  sensorId: 'ultrasonic1' | 'ultrasonic2' | 'ultrasonic3';
  name: string;
  distance: number; // cm
  fillPercentage: number;
  lastUpdated: string;
}

export interface Alert {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
  timestamp: string;
  resolved: boolean;
}

export interface ProcessLog {
  id: string;
  timestamp: string;
  stage: SystemStage;
  action: string;
  operator: string;
  details: string;
}

export interface WasteMetrics {
  large: number; // kg
  fine: number;  // kg
  liquid: number; // Liters
}

export interface AnalyticsData {
  daily: { date: string; large: number; fine: number; liquid: number; cycles: number }[];
  weekly: { week: string; large: number; fine: number; liquid: number; cycles: number }[];
  monthly: { month: string; large: number; fine: number; liquid: number; cycles: number }[];
}
