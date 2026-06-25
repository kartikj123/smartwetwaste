import { useState } from "react";
import { Database, FileCode, Check, Copy } from "lucide-react";

export default function SqlExporter() {
  const [copied, setCopied] = useState(false);

  const supabaseSql = `-- ==========================================
-- SMART WET WASTE SEGREGATION & LIQUID SEPARATION
-- DATABASE SCHEMAS FOR SUPABASE POSTGRESQL
-- ==========================================

-- 1. UTILITY: Enable Realtime publications
alter publication supabase_realtime add table dustbin_status;
alter publication supabase_realtime add table tank_status;
alter publication supabase_realtime add table sensor_readings;
alter publication supabase_realtime add table actuator_status;
alter publication supabase_realtime add table alerts;
alter publication supabase_realtime add table system_status;

-- 2. TABLE: users
create table users (
  id uuid default gen_random_uuid() primary key,
  email text unique not null,
  full_name text,
  role text default 'Operator' check (role in ('Admin', 'Operator')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. TABLE: system_status
create table system_status (
  id uuid default gen_random_uuid() primary key,
  online boolean default true,
  esp32_connected boolean default true,
  current_stage text default 'Ready',
  is_processing boolean default false,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Insert initial machine row
insert into system_status (online, esp32_connected, current_stage, is_processing) 
values (true, true, 'Ready', false);

-- 4. TABLE: dustbin_status
create table dustbin_status (
  id serial primary key,
  bin_name text not null,
  bin_type text not null check (bin_type in ('large', 'fine')),
  fill_percentage integer default 0,
  capacity_liters integer default 100,
  sensor_distance_cm numrange,
  status text default 'Normal' check (status in ('Normal', 'Warning', 'Full')),
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

insert into dustbin_status (bin_name, bin_type, fill_percentage, capacity_liters, status) values 
('Dustbin 1 (Large Waste)', 'large', 25, 100, 'Normal'),
('Dustbin 2 (Fine Waste)', 'fine', 41, 100, 'Normal');

-- 5. TABLE: tank_status
create table tank_status (
  id uuid default gen_random_uuid() primary key,
  tank_name text not null,
  fill_percentage integer default 0,
  capacity_liters integer default 150,
  status text default 'Normal',
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

insert into tank_status (tank_name, fill_percentage, capacity_liters, status) values 
('Liquid Collection Tank', 18, 150, 'Normal');

-- 6. TABLE: sensor_readings
create table sensor_readings (
  id uuid default gen_random_uuid() primary key,
  sensor_id text not null unique,
  sensor_name text not null,
  distance_cm numeric not null,
  fill_percentage integer not null,
  last_updated timestamp with time zone default timezone('utc'::text, now()) not null
);

insert into sensor_readings (sensor_id, sensor_name, distance_cm, fill_percentage) values 
('ultrasonic1', 'Ultrasonic Sensor 1 (Dustbin 1)', 30.0, 25),
('ultrasonic2', 'Ultrasonic Sensor 2 (Dustbin 2)', 24.0, 41),
('ultrasonic3', 'Ultrasonic Sensor 3 (Liquid Tank)', 41.0, 18);

-- 7. TABLE: actuator_status
create table actuator_status (
  id uuid default gen_random_uuid() primary key,
  servo_1_angle text default 'CLOSED',
  servo_2_angle text default 'CLOSED',
  servo_3_angle text default 'CLOSED',
  servo_4_angle text default 'CLOSED',
  pump_1_active boolean default false,
  pump_2_active boolean default false,
  lcd_message text default 'SYSTEM ONLINE',
  buzzer_active boolean default false,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

insert into actuator_status (servo_1_angle, servo_2_angle, servo_3_angle, servo_4_angle, pump_1_active, pump_2_active, lcd_message) 
values ('CLOSED', 'CLOSED', 'CLOSED', 'CLOSED', false, false, 'SYSTEM READY - ONLINE');

-- 8. TABLE: alerts
create table alerts (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  severity text default 'info' check (severity in ('critical', 'warning', 'info')),
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null,
  resolved boolean default false
);

-- 9. TABLE: process_logs
create table process_logs (
  id uuid default gen_random_uuid() primary key,
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null,
  stage text not null,
  action text not null,
  operator_name text,
  details text
);

-- 10. TABLE: analytics
create table analytics (
  id serial primary key,
  date_label text not null,
  large_waste_kg numeric default 0,
  fine_waste_kg numeric default 0,
  liquid_extracted_liters numeric default 0,
  cycles_run integer default 0
);

-- Seed past week values
insert into analytics (date_label, large_waste_kg, fine_waste_kg, liquid_extracted_liters, cycles_run) values
('Mon', 12.0, 15.0, 22.0, 5),
('Tue', 19.0, 11.0, 28.0, 6),
('Wed', 15.0, 18.0, 32.0, 7),
('Thu', 22.0, 21.0, 24.0, 8),
('Fri', 30.0, 28.0, 45.0, 12),
('Sat', 8.0, 12.0, 15.0, 4),
('Sun', 14.0, 10.0, 20.0, 5);
`;

  const copyCode = () => {
    navigator.clipboard.writeText(supabaseSql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div id="sql-schema-panel" className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
            <Database className="w-5 h-5" />
          </span>
          <div>
            <h3 className="text-sm font-extrabold text-white">Supabase PostgreSQL Schema Setup</h3>
            <p className="text-[11px] text-gray-500">Configure your local Supabase SQL editor using these tables</p>
          </div>
        </div>
        
        <button
          id="copy-sql-btn"
          onClick={copyCode}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#161b22] text-gray-300 hover:bg-gray-800 hover:text-white border border-gray-700/50 transition-all cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copied Setup Script</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy SQL Script</span>
            </>
          )}
        </button>
      </div>

      <div className="relative">
        <pre className="p-5 font-mono text-[11px] bg-black/50 overflow-x-auto text-emerald-400/80 rounded-xl leading-relaxed border border-gray-800 h-[340px] shadow-inner">
          <code>{supabaseSql}</code>
        </pre>
        {/* Border overlay gradient */}
        <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#13151a] to-transparent pointer-events-none rounded-b-xl" />
      </div>
      
      <div className="bg-[#161b22] border border-gray-700/40 p-3.5 rounded-lg text-xs text-gray-400 leading-normal flex items-start gap-2.5">
        <span className="text-emerald-400">💡</span>
        <p>
          <strong>Relational Schema Design:</strong> The code creates tables representing your containers 
          and readings. Crucially, the <code>alter publication</code> steps enable high-speed bidirectional operations using the 
          <strong>Supabase Real-time Engine Client API</strong>.
        </p>
      </div>
    </div>
  );
}
