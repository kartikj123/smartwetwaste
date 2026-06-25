import React, { useState, useEffect } from "react";
import { supabase, isSupabaseConfigured } from "./lib/supabase";
import { motion, AnimatePresence } from "motion/react";
import { 
  Activity, 
  Cpu, 
  Trash2, 
  Droplet, 
  RotateCw, 
  Wind, 
  Database, 
  FileText, 
  Settings, 
  Play, 
  RotateCcw, 
  AlertTriangle,
  RefreshCw,
  Info,
  Layers,
  Sparkles,
  Menu,
  X,
  Bell,
  CheckCircle2,
  HelpCircle,
  Clock,
  ArrowRight,
  Shield,
  Sliders,
  ChevronRight,
  Zap
} from "lucide-react";

// Interfaces matching the exact database columns we queried from Supabase
export interface SystemStatusRow {
  id: number;
  esp32_status: string;
  current_stage: string;
  lcd_message: string;
  buzzer_status: boolean;
  updated_at: string;
}

export interface DustbinRow {
  id: number;
  dustbin_name: string;
  waste_type: string;
  fill_percentage: number;
  status: string;
  capacity: number;
  updated_at: string;
}

export interface LiquidTankRow {
  id: number;
  fill_percentage: number;
  status: string;
  capacity: number;
  updated_at: string;
}

export interface ServoStatusRow {
  id: number;
  servo_name: string;
  angle: number;
  status: string;
  updated_at: string;
}

export interface PumpStatusRow {
  id: number;
  pump_name: string;
  status: string;
  updated_at: string;
}

export interface ProcessLogRow {
  id: number;
  process_stage: string;
  description: string;
  created_at: string;
}

export default function App() {
  // DB State from Supabase
  const [systemStatus, setSystemStatus] = useState<SystemStatusRow | null>(null);
  const [dustbins, setDustbins] = useState<DustbinRow[]>([]);
  const [liquidTank, setLiquidTank] = useState<LiquidTankRow | null>(null);
  const [servos, setServos] = useState<ServoStatusRow[]>([]);
  const [pumps, setPumps] = useState<PumpStatusRow[]>([]);
  const [logs, setLogs] = useState<ProcessLogRow[]>([]);

  // UI Navigation & Dialog States
  const [activeTab, setActiveTab] = useState<"home" | "process" | "logs" | "about">("home");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [isNotifOpen, setIsNotifOpen] = useState<boolean>(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  // Quick Manual simulator state overrides for easy direct writeback to database
  const [simStage, setSimStage] = useState<string>("Checking Dustbins");
  const [simEspStatus, setSimEspStatus] = useState<string>("online");
  const [simLcdMsg, setSimLcdMsg] = useState<string>("SYSTEM READY");
  const [simBuzzer, setSimBuzzer] = useState<boolean>(false);
  const [simBin1Val, setSimBin1Val] = useState<number>(15);
  const [simBin2Val, setSimBin2Val] = useState<number>(32);
  const [simTankVal, setSimTankVal] = useState<number>(22);
  const [simServoAngles, setSimServoAngles] = useState<Record<number, number>>({ 1: 90, 2: 0, 3: 90, 4: 0 });
  const [simPumpStates, setSimPumpStates] = useState<Record<number, string>>({ 1: "OFF", 2: "OFF" });
  const [customLogText, setCustomLogText] = useState<string>("");

  const possibleStages = [
    "Checking Dustbins",
    "Water Injection",
    "Waste Agitation",
    "Large Waste Separation",
    "Fine Waste Separation",
    "Liquid Separation",
    "Completed"
  ];

  // Helper to show toasts
  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Fetch all live database state directly from Supabase (unified server-side route for speed & safety)
  const fetchAllIotData = async (silent: boolean = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/supabase/iot-data");
      const payload = await res.json().catch(() => null);
      
      if (!res.ok) {
        throw new Error(payload?.error || `Backend returned error status ${res.status}`);
      }
      
      if (payload && payload.success && payload.data) {
        const d = payload.data;
        setSystemStatus(d.system_status[0] || null);
        setDustbins(d.dustbins || []);
        setLiquidTank(d.liquid_tank[0] || null);
        setServos(d.servo_status || []);
        setPumps(d.pump_status || []);
        setLogs(d.process_logs || []);

        // Synchronize simulator state inputs to the fetched data on load
        if (d.system_status[0]) {
          setSimStage(d.system_status[0].current_stage);
          setSimEspStatus(d.system_status[0].esp32_status);
          setSimLcdMsg(d.system_status[0].lcd_message);
          setSimBuzzer(d.system_status[0].buzzer_status);
        }
        if (d.dustbins[0]) setSimBin1Val(d.dustbins[0].fill_percentage);
        if (d.dustbins[1]) setSimBin2Val(d.dustbins[1].fill_percentage);
        if (d.liquid_tank[0]) setSimTankVal(d.liquid_tank[0].fill_percentage);
        
        const angles: Record<number, number> = {};
        d.servo_status.forEach((s: ServoStatusRow) => {
          angles[s.id] = s.angle;
        });
        setSimServoAngles(prev => ({ ...prev, ...angles }));

        const pStates: Record<number, string> = {};
        d.pump_status.forEach((p: PumpStatusRow) => {
          pStates[p.id] = p.status;
        });
        setSimPumpStates(prev => ({ ...prev, ...pStates }));

        setError(null);
      } else {
        throw new Error(payload?.error || "Invalid response payload from backend service.");
      }
    } catch (err: any) {
      console.error("Fetch IoT Data Error:", err);
      setError(err.message || "Failed to establish an API connection with the database schema.");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Write individual state updates back to Supabase securely via bypass routes
  const handleUpdateDatabaseValue = async (table: string, id: number | null, payload: any, successMsg: string) => {
    try {
      const res = await fetch("/api/supabase/update-iot-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table, id, payload })
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        showToast(successMsg, "success");
        // Refetch immediately to sync local state
        fetchAllIotData(true);
      } else {
        throw new Error(data?.error || "Backend database write transaction rejected.");
      }
    } catch (err: any) {
      showToast(`Database Write Blocked: ${err.message}`, "error");
    }
  };

  // Setup client-side real-time subscription for instant UI updates on database changes
  useEffect(() => {
    fetchAllIotData();

    if (!isSupabaseConfigured || !supabase) {
      console.warn("Client-side direct Supabase keys missing. Falling back to poll fetch.");
      const interval = setInterval(() => fetchAllIotData(true), 4000);
      return () => clearInterval(interval);
    }

    console.log("Setting up Supabase Realtime channel for instant database sync...");
    const channel = supabase
      .channel("supabase-realtime-iot-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public" },
        (payload) => {
          console.log("⚡ Supabase Postgres Realtime event received:", payload);
          fetchAllIotData(true);
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          showToast("Instant Supabase real-time sync active!", "info");
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Quick Action: Run full automated demonstration cycle simulating the process step-by-step
  const handleRunFullSequenceDemo = async () => {
    try {
      showToast("Triggering automated wet waste segregation demonstration loop...", "info");
      setIsSidebarOpen(false);

      const sequence = [
        { stage: "Checking Dustbins", msg: "CHECKING BIN LVLS", log: "Ultrasonic sensors scanned bin volume levels. System check parameters normal." },
        { stage: "Water Injection", msg: "INJECTING FLUIDS", log: "Water pump activated. Water injected into slurry tank to dissolve organic solids." },
        { stage: "Waste Agitation", msg: "AGITATING WET... ", log: "Agitation agitator motor activated. Softening wet materials and food waste residues." },
        { stage: "Large Waste Separation", msg: "SEPARATING LRG WG", log: "Servo 1 opened to 90 degrees. Discharging non-dissolvable large plastics." },
        { stage: "Fine Waste Separation", msg: "SEPARATING FINE", log: "Servo 2 rotated. Segregating fine compostable solid fibers to active bio-digester." },
        { stage: "Liquid Separation", msg: "PUMPING BIO-LIQD", log: "Pump 2 vacuum extraction enabled. Funneling organic biostimulant nutrients into liquid storage." },
        { stage: "Completed", msg: "SEGREGATION DONE", log: "Wet waste separation process completed. Hardware resetting to standby listening state." }
      ];

      for (let i = 0; i < sequence.length; i++) {
        const step = sequence[i];

        // 1. Update system status
        await fetch("/api/supabase/update-iot-data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            table: "system_status",
            id: 1,
            payload: {
              esp32_status: "online",
              current_stage: step.stage,
              lcd_message: step.msg,
              buzzer_status: step.stage === "Completed"
            }
          })
        });

        // 2. Append process log
        await fetch("/api/supabase/update-iot-data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            table: "process_logs",
            id: null,
            payload: {
              process_stage: step.stage,
              description: step.log
            }
          })
        });

        // 3. Dynamic actuator simulations to reflect realistic physical state
        if (step.stage === "Water Injection") {
          await fetch("/api/supabase/update-iot-data", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ table: "pump_status", id: 1, payload: { status: "ON" } })
          });
        } else if (step.stage === "Waste Agitation") {
          await fetch("/api/supabase/update-iot-data", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ table: "pump_status", id: 1, payload: { status: "OFF" } })
          });
        } else if (step.stage === "Large Waste Separation") {
          await fetch("/api/supabase/update-iot-data", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ table: "servo_status", id: 1, payload: { angle: 90, status: "Open" } })
          });
          await fetch("/api/supabase/update-iot-data", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ table: "dustbins", id: 1, payload: { fill_percentage: Math.min(100, simBin1Val + 15), status: "Normal" } })
          });
        } else if (step.stage === "Fine Waste Separation") {
          await fetch("/api/supabase/update-iot-data", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ table: "servo_status", id: 1, payload: { angle: 0, status: "Closed" } })
          });
          await fetch("/api/supabase/update-iot-data", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ table: "servo_status", id: 2, payload: { angle: 90, status: "Open" } })
          });
          await fetch("/api/supabase/update-iot-data", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ table: "dustbins", id: 2, payload: { fill_percentage: Math.min(100, simBin2Val + 22), status: "Warning" } })
          });
        } else if (step.stage === "Liquid Separation") {
          await fetch("/api/supabase/update-iot-data", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ table: "servo_status", id: 2, payload: { angle: 0, status: "Closed" } })
          });
          await fetch("/api/supabase/update-iot-data", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ table: "pump_status", id: 2, payload: { status: "ON" } })
          });
          await fetch("/api/supabase/update-iot-data", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ table: "liquid_tank", id: 1, payload: { fill_percentage: Math.min(100, simTankVal + 18), status: "Normal" } })
          });
        } else if (step.stage === "Completed") {
          await fetch("/api/supabase/update-iot-data", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ table: "pump_status", id: 2, payload: { status: "OFF" } })
          });
        }

        // Wait 3.5 seconds per step to allow viewing the realtime layout transitions
        await new Promise(resolve => setTimeout(resolve, 3500));
      }

      showToast("Automated sequence demonstration complete!", "success");
      fetchAllIotData(true);
    } catch (e: any) {
      showToast(`Error running demo sequence: ${e.message}`, "error");
    }
  };

  // Reset database back to default standby configuration
  const handleResetDatabaseDefaults = async () => {
    if (!window.confirm("Are you sure you want to reset all Supabase tables to default standby specs?")) return;
    try {
      setLoading(true);
      const res = await fetch("/api/system/reset", { method: "POST" });
      if (res.ok) {
        showToast("Supabase IoT registers initialized to default parameters!", "success");
        fetchAllIotData();
      } else {
        throw new Error("Reset endpoint failed.");
      }
    } catch (err: any) {
      showToast(`Reset Failed: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  // Handle direct custom manual simulation submissions
  const handleWriteSimSettings = async (type: string, payload: any) => {
    let tableName = "";
    let targetId: number | null = 1;
    let label = "";

    switch (type) {
      case "system":
        tableName = "system_status";
        label = "System node properties updated";
        break;
      case "bin1":
        tableName = "dustbins";
        targetId = 1;
        label = "Dustbin 1 level synchronized";
        break;
      case "bin2":
        tableName = "dustbins";
        targetId = 2;
        label = "Dustbin 2 level synchronized";
        break;
      case "tank":
        tableName = "liquid_tank";
        label = "Liquid tank storage updated";
        break;
      case "servo1":
        tableName = "servo_status";
        targetId = 1;
        label = "Servo 1 flap angle modified";
        break;
      case "servo2":
        tableName = "servo_status";
        targetId = 2;
        label = "Servo 2 solid gate angle modified";
        break;
      case "servo3":
        tableName = "servo_status";
        targetId = 3;
        label = "Servo 3 slurry valve angle modified";
        break;
      case "servo4":
        tableName = "servo_status";
        targetId = 4;
        label = "Servo 4 bypass angle modified";
        break;
      case "pump1":
        tableName = "pump_status";
        targetId = 1;
        label = "Pump 1 state written";
        break;
      case "pump2":
        tableName = "pump_status";
        targetId = 2;
        label = "Pump 2 state written";
        break;
    }

    if (tableName) {
      await handleUpdateDatabaseValue(tableName, targetId, payload, label);
    }
  };

  const handlePostCustomLog = async () => {
    if (!customLogText.trim()) return;
    await handleUpdateDatabaseValue(
      "process_logs",
      null,
      {
        process_stage: systemStatus?.current_stage || "Manual Override",
        description: customLogText.trim()
      },
      "Custom process log injected!"
    );
    setCustomLogText("");
  };

  // Helper: Map level value to status tags & styles
  const getLevelConfig = (percentage: number) => {
    if (percentage <= 50) {
      return { text: "text-emerald-400 shadow-emerald-500/15", stroke: "#10b981", bg: "bg-emerald-500/10 border-emerald-500/25", label: "Normal" };
    } else if (percentage <= 80) {
      return { text: "text-amber-400 shadow-amber-500/15", stroke: "#f59e0b", bg: "bg-amber-500/10 border-amber-500/25", label: "Warning" };
    } else {
      return { text: "text-rose-500 shadow-rose-500/15", stroke: "#ef4444", bg: "bg-rose-500/10 border-rose-500/25", label: "Full" };
    }
  };

  // Helper: Format dynamic string time
  const formatTime = (isoString: string) => {
    if (!isoString) return "00:00 AM";
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (_) {
      return "00:00 AM";
    }
  };

  // Notifications logic (dynamic alerts based on live Supabase parameters)
  const getActiveNotifications = () => {
    const list = [];
    if (systemStatus?.esp32_status === "offline") {
      list.push({ id: "esp", text: "ESP32 Controller Node is currently offline or unreachable.", type: "danger" });
    }
    dustbins.forEach(bin => {
      if (bin.fill_percentage > 80) {
        list.push({ id: `bin-${bin.id}`, text: `HIGH CAPACITY ALERT: ${bin.dustbin_name} is currently ${bin.fill_percentage}% full! Clean empty required.`, type: "warning" });
      }
    });
    if (liquidTank && liquidTank.fill_percentage > 80) {
      list.push({ id: "tank", text: `HIGH VOLUME WARNING: Bio-Liquid Tank is currently ${liquidTank.fill_percentage}% full!`, type: "warning" });
    }
    if (systemStatus?.buzzer_status) {
      list.push({ id: "buzzer", text: "Local Hardware Alarm buzzer is currently active and pulsing.", type: "alarm" });
    }
    if (pumps.some(p => p.status === "ON")) {
      list.push({ id: "pump", text: "Active vacuum pump fluid extraction loop currently drawing current.", type: "info" });
    }
    return list;
  };

  const notifications = getActiveNotifications();

  // Helper to resolve stage flow matching (handling standard variations)
  const getStageStatus = (stageName: string, activeStage: string) => {
    const sequence = [
      ["checking dustbins", "waste input"],
      ["water injection"],
      ["waste agitation"],
      ["large waste separation"],
      ["fine waste separation"],
      ["liquid separation"],
      ["completed"]
    ];

    const currentNormalized = (activeStage || "Checking Dustbins").toLowerCase();
    const stageNormalized = stageName.toLowerCase();

    let activeIdx = sequence.findIndex(arr => arr.includes(currentNormalized));
    let stageIdx = sequence.findIndex(arr => arr.includes(stageNormalized));

    if (activeIdx === -1) activeIdx = 0; // Default fallback

    return {
      isActive: activeIdx === stageIdx,
      isCompleted: stageIdx < activeIdx,
      isPending: stageIdx > activeIdx
    };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-[#040c06] to-[#011406] text-gray-100 font-sans selection:bg-emerald-500 selection:text-black pb-24 md:pb-12">
      
      {/* GLOBAL BACKGROUND GLOW EFFECTS */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-teal-500/5 rounded-full blur-[120px] pointer-events-none"></div>

      {/* --- TOP HEADER BAR --- */}
      <header className="sticky top-0 z-40 bg-black/60 backdrop-blur-md border-b border-emerald-500/10 shadow-[0_4px_30px_rgba(0,0,0,0.8)]">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          
          {/* Hamburger (Left) */}
          <button 
            id="hamburger-menu-btn"
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-emerald-500/10 text-emerald-400 transition-all cursor-pointer border border-transparent hover:border-emerald-500/20"
          >
            <Menu className="w-6 h-6" />
          </button>

          {/* Project Name (Center) */}
          <div className="flex flex-col items-center text-center">
            <span className="text-[10px] uppercase tracking-widest text-emerald-400 font-extrabold flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
              IoT Real-Time Node
            </span>
            <h2 className="text-sm font-black text-white tracking-tight">
              SMART SEGREGATOR
            </h2>
          </div>

          {/* Notification Icon (Right) */}
          <div className="relative">
            <button 
              id="notification-bell-btn"
              onClick={() => setIsNotifOpen(!isNotifOpen)}
              className="p-2 rounded-lg hover:bg-emerald-500/10 text-emerald-400 transition-all cursor-pointer relative border border-transparent hover:border-emerald-500/20"
            >
              <Bell className="w-5 h-5" />
              {notifications.length > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-black animate-pulse"></span>
              )}
            </button>

            {/* Notification Pane Overlay */}
            <AnimatePresence>
              {isNotifOpen && (
                <motion.div 
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 15 }}
                  className="absolute right-0 mt-3 w-80 bg-[#09100a] border border-emerald-500/20 rounded-2xl p-4 shadow-[0_10px_30px_rgba(0,0,0,0.9)] z-50 text-left space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-emerald-500/10 pb-2">
                    <span className="text-xs font-black uppercase text-emerald-400 tracking-wider">Active Alerts</span>
                    <button onClick={() => setIsNotifOpen(false)} className="text-gray-400 hover:text-white">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                    {notifications.length === 0 ? (
                      <p className="text-xs text-gray-500 py-4 text-center">No active hardware system failures detected. All telemetry registers report within nominal operational ranges.</p>
                    ) : (
                      notifications.map((notif) => (
                        <div 
                          key={notif.id} 
                          className={`p-2.5 rounded-xl text-[11px] border leading-normal flex gap-2 ${
                            notif.type === "danger" || notif.type === "alarm"
                              ? "bg-rose-500/10 border-rose-500/20 text-rose-300"
                              : notif.type === "warning"
                              ? "bg-amber-500/10 border-amber-500/20 text-amber-300"
                              : "bg-blue-500/10 border-blue-500/20 text-blue-300"
                          }`}
                        >
                          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                          <span>{notif.text}</span>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>
      </header>

      {/* Toast Alert Pane */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: -40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-50 max-w-sm w-full px-4"
          >
            <div className={`p-3.5 rounded-xl border shadow-2xl flex items-center gap-3 ${
              toast.type === "success" 
                ? "bg-[#051c0d]/90 border-emerald-500/30 text-emerald-300" 
                : toast.type === "error"
                ? "bg-[#25070a]/90 border-rose-500/30 text-rose-300"
                : "bg-[#0b1322]/90 border-blue-500/30 text-blue-300"
            }`}>
              <Zap className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-xs font-semibold leading-relaxed">{toast.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- SIDEBAR HAMBURGER DRAWER (Simulator & Manual Configuration console) --- */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-black z-45"
            ></motion.div>

            {/* Panel */}
            <motion.div 
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25 }}
              className="fixed inset-y-0 left-0 w-80 max-w-full bg-[#070b08] border-r border-emerald-500/10 shadow-[5px_0_30px_rgba(0,0,0,0.9)] z-50 flex flex-col justify-between"
            >
              <div className="p-6 overflow-y-auto space-y-6 flex-1">
                
                <div className="flex items-center justify-between border-b border-emerald-500/10 pb-4">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <Sliders className="w-5 h-5" />
                    <span className="text-sm font-black uppercase tracking-wider">ESP32 Simulator</span>
                  </div>
                  <button 
                    onClick={() => setIsSidebarOpen(false)}
                    className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-emerald-500/10"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <p className="text-xs text-gray-400 leading-relaxed">
                  Use this direct client controller to simulate micro-controller signals or update Supabase records live without hardware hardware.
                </p>

                {/* Automation Quick Controls */}
                <div className="bg-[#0e1610] p-4 rounded-xl border border-emerald-500/10 space-y-3">
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-emerald-400">Sequence Loop Demo</h4>
                  <button
                    onClick={handleRunFullSequenceDemo}
                    className="w-full py-2.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-500/10"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Run 7-Stage Sequence
                  </button>
                  <button
                    onClick={handleResetDatabaseDefaults}
                    className="w-full py-2 px-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 border border-gray-700 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Initialize Standby Specs
                  </button>
                </div>

                {/* Slider and Input Controls */}
                <div className="space-y-4">
                  <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">Manual Overrides</span>
                  
                  {/* System properties */}
                  <div className="space-y-2 bg-[#0e1610] p-3 rounded-xl border border-gray-900">
                    <label className="block text-[10px] text-emerald-400 font-bold uppercase">Current Stage</label>
                    <select 
                      value={simStage} 
                      onChange={(e) => {
                        setSimStage(e.target.value);
                        handleWriteSimSettings("system", { esp32_status: simEspStatus, current_stage: e.target.value, lcd_message: simLcdMsg, buzzer_status: simBuzzer });
                      }}
                      className="w-full bg-[#050705] border border-emerald-500/20 text-xs text-gray-100 p-2 rounded-lg font-semibold focus:outline-none focus:border-emerald-500"
                    >
                      {possibleStages.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>

                    <label className="block text-[10px] text-emerald-400 font-bold uppercase mt-2">ESP32 Online Status</label>
                    <div className="flex gap-2">
                      {["online", "offline"].map(st => (
                        <button
                          key={st}
                          onClick={() => {
                            setSimEspStatus(st);
                            handleWriteSimSettings("system", { esp32_status: st, current_stage: simStage, lcd_message: simLcdMsg, buzzer_status: simBuzzer });
                          }}
                          className={`flex-1 py-1 text-[10px] font-bold uppercase rounded border transition-all ${
                            simEspStatus === st 
                              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" 
                              : "bg-black text-gray-500 border-gray-800"
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>

                    <label className="block text-[10px] text-emerald-400 font-bold uppercase mt-2">LCD Text</label>
                    <input 
                      type="text" 
                      value={simLcdMsg}
                      onChange={(e) => setSimLcdMsg(e.target.value)}
                      onBlur={() => handleWriteSimSettings("system", { esp32_status: simEspStatus, current_stage: simStage, lcd_message: simLcdMsg, buzzer_status: simBuzzer })}
                      className="w-full bg-[#050705] border border-emerald-500/20 text-xs font-mono text-emerald-300 p-2 rounded-lg focus:outline-none focus:border-emerald-500"
                    />

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-900">
                      <span className="text-[10px] text-emerald-400 font-bold uppercase">Buzzer Enabled</span>
                      <input 
                        type="checkbox"
                        checked={simBuzzer}
                        onChange={(e) => {
                          setSimBuzzer(e.target.checked);
                          handleWriteSimSettings("system", { esp32_status: simEspStatus, current_stage: simStage, lcd_message: simLcdMsg, buzzer_status: e.target.checked });
                        }}
                        className="w-4 h-4 text-emerald-500 bg-black border-emerald-500/20 rounded focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Bin fill levels */}
                  <div className="space-y-3 bg-[#0e1610] p-3 rounded-xl border border-gray-900">
                    <h5 className="text-[10px] text-emerald-400 font-bold uppercase border-b border-gray-900 pb-1">Container Capacities</h5>
                    
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span>Dustbin 1 (Large)</span>
                        <span className="font-mono font-bold text-emerald-400">{simBin1Val}%</span>
                      </div>
                      <input 
                        type="range" min="0" max="100" value={simBin1Val}
                        onChange={(e) => setSimBin1Val(Number(e.target.value))}
                        onMouseUp={() => handleWriteSimSettings("bin1", { fill_percentage: simBin1Val, status: simBin1Val > 80 ? "Full" : simBin1Val > 50 ? "Warning" : "Normal" })}
                        onTouchEnd={() => handleWriteSimSettings("bin1", { fill_percentage: simBin1Val, status: simBin1Val > 80 ? "Full" : simBin1Val > 50 ? "Warning" : "Normal" })}
                        className="w-full accent-emerald-500 bg-black h-1 rounded"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span>Dustbin 2 (Fine)</span>
                        <span className="font-mono font-bold text-emerald-400">{simBin2Val}%</span>
                      </div>
                      <input 
                        type="range" min="0" max="100" value={simBin2Val}
                        onChange={(e) => setSimBin2Val(Number(e.target.value))}
                        onMouseUp={() => handleWriteSimSettings("bin2", { fill_percentage: simBin2Val, status: simBin2Val > 80 ? "Full" : simBin2Val > 50 ? "Warning" : "Normal" })}
                        onTouchEnd={() => handleWriteSimSettings("bin2", { fill_percentage: simBin2Val, status: simBin2Val > 80 ? "Full" : simBin2Val > 50 ? "Warning" : "Normal" })}
                        className="w-full accent-emerald-500 bg-black h-1 rounded"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span>Liquid Tank</span>
                        <span className="font-mono font-bold text-emerald-400">{simTankVal}%</span>
                      </div>
                      <input 
                        type="range" min="0" max="100" value={simTankVal}
                        onChange={(e) => setSimTankVal(Number(e.target.value))}
                        onMouseUp={() => handleWriteSimSettings("tank", { fill_percentage: simTankVal, status: simTankVal > 80 ? "Full" : simTankVal > 50 ? "Warning" : "Normal" })}
                        onTouchEnd={() => handleWriteSimSettings("tank", { fill_percentage: simTankVal, status: simTankVal > 80 ? "Full" : simTankVal > 50 ? "Warning" : "Normal" })}
                        className="w-full accent-emerald-500 bg-black h-1 rounded"
                      />
                    </div>
                  </div>

                  {/* Servos and pumps */}
                  <div className="space-y-2 bg-[#0e1610] p-3 rounded-xl border border-gray-900 text-xs">
                    <h5 className="text-[10px] text-emerald-400 font-bold uppercase border-b border-gray-900 pb-1">Physical Actuators</h5>
                    
                    {/* Servo 1 & 2 angles */}
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div>
                        <span>Servo 1 Angle</span>
                        <input 
                          type="number" min="0" max="180" value={simServoAngles[1] ?? 90}
                          onChange={(e) => {
                            const val = Math.max(0, Math.min(180, Number(e.target.value)));
                            setSimServoAngles(p => ({ ...p, 1: val }));
                          }}
                          onBlur={() => handleWriteSimSettings("servo1", { angle: simServoAngles[1], status: simServoAngles[1] > 45 ? "Open" : "Closed" })}
                          className="w-full bg-black border border-emerald-500/20 p-1 rounded font-mono text-emerald-400"
                        />
                      </div>
                      <div>
                        <span>Servo 2 Angle</span>
                        <input 
                          type="number" min="0" max="180" value={simServoAngles[2] ?? 0}
                          onChange={(e) => {
                            const val = Math.max(0, Math.min(180, Number(e.target.value)));
                            setSimServoAngles(p => ({ ...p, 2: val }));
                          }}
                          onBlur={() => handleWriteSimSettings("servo2", { angle: simServoAngles[2], status: simServoAngles[2] > 45 ? "Open" : "Closed" })}
                          className="w-full bg-black border border-emerald-500/20 p-1 rounded font-mono text-emerald-400"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Custom Log Injector */}
                  <div className="bg-[#0e1610] p-3 rounded-xl border border-gray-900 space-y-2">
                    <label className="block text-[10px] text-emerald-400 font-bold uppercase">Append Activity Log</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Mechanical gate jammed..." 
                      value={customLogText}
                      onChange={(e) => setCustomLogText(e.target.value)}
                      className="w-full bg-[#050705] border border-emerald-500/20 text-xs p-2 rounded focus:outline-none focus:border-emerald-500 placeholder-gray-600"
                    />
                    <button
                      onClick={handlePostCustomLog}
                      className="w-full py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[10px] font-bold uppercase rounded border border-emerald-500/20"
                    >
                      Inject Activity Row
                    </button>
                  </div>

                </div>

              </div>
              <div className="p-6 border-t border-emerald-500/10 bg-black text-center text-[10px] text-gray-500">
                <span>Smart Wet Waste Segregation v2.1.0</span>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* --- HERO / INTRO TITLE BLOCK --- */}
      <div className="max-w-7xl mx-auto px-4 pt-6 text-center md:text-left">
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-block px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[10px] text-emerald-400 uppercase font-black tracking-widest mb-3 mx-auto"
        >
          <span className="pulse-led inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2"></span>
          Direct Live Supabase Integration
        </motion.div>

        <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight uppercase text-white leading-tight">
          SMART WET WASTE <br className="sm:hidden" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400 drop-shadow-[0_0_12px_rgba(52,211,153,0.3)]">
            SEGREGATION & LIQUID SEPARATION
          </span>
        </h1>
        <p className="text-xs text-gray-400 font-medium tracking-wide uppercase mt-1">
          Mechanical Segregator, Automated Fluid Agitator & Solenoid Vacuum Discharge Control Center
        </p>
      </div>

      {/* --- MAIN PAGE VIEW CONTENT --- */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        
        {/* Loading Indicator */}
        {loading && (
          <div className="py-24 flex flex-col items-center justify-center">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border-4 border-emerald-500/10"></div>
              <div className="absolute inset-0 rounded-full border-4 border-emerald-400 border-t-transparent animate-spin"></div>
            </div>
            <p className="mt-4 text-xs font-mono text-emerald-400 animate-pulse uppercase tracking-widest">
              Connecting directly to Supabase schemas...
            </p>
          </div>
        )}

        {/* Database Error Banner */}
        {error && !loading && (
          <div className="bg-rose-500/10 border border-rose-500/25 rounded-2xl p-6 text-center max-w-2xl mx-auto space-y-4 my-8">
            <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto" />
            <h3 className="text-sm font-black text-white uppercase tracking-wider">Database Connection Blocked</h3>
            <p className="text-xs text-gray-400 leading-normal font-mono max-h-32 overflow-y-auto">
              {error}
            </p>
            <div className="pt-2 flex justify-center gap-3">
              <button
                onClick={() => fetchAllIotData(false)}
                className="px-4 py-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30 text-xs font-bold uppercase transition-all"
              >
                Retry Request
              </button>
              <button
                onClick={handleResetDatabaseDefaults}
                className="px-4 py-2 rounded-xl bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700 text-xs font-bold uppercase transition-all"
              >
                Re-Seed Schema Tables
              </button>
            </div>
          </div>
        )}

        {!loading && !error && (
          <AnimatePresence mode="wait">
            
            {/* ======================================= */}
            {/* VIEW: HOME DASHBOARD                     */}
            {/* ======================================= */}
            {activeTab === "home" && (
              <motion.div 
                key="home"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6"
              >
                
                {/* --- SECTION 1: SYSTEM STATUS CARD --- */}
                <div className="bg-black/40 backdrop-blur-xl border border-emerald-500/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                  
                  {/* Neon Glow Rings Behind */}
                  <div className="absolute top-1/2 right-1/4 w-40 h-40 bg-emerald-500/5 rounded-full blur-[40px] pointer-events-none"></div>

                  {/* Left Metric Status Info */}
                  <div className="md:col-span-2 space-y-4 text-left">
                    
                    <div className="flex items-center justify-between pb-3 border-b border-emerald-500/10">
                      <div className="flex items-center gap-2">
                        <Cpu className="w-5 h-5 text-emerald-400 animate-pulse" />
                        <h2 className="text-xs font-black text-white uppercase tracking-widest">
                          ESP32 IOT CPU NODE TELEMETRY
                        </h2>
                      </div>
                      <span className="text-[10px] font-mono text-gray-500">Node id: {systemStatus?.id || 1}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      
                      {/* ESP32 Status badge */}
                      <div className="bg-[#060c07] p-3.5 rounded-2xl border border-emerald-500/5">
                        <span className="block text-[9px] text-gray-400 uppercase tracking-wider font-extrabold">ESP32 Status</span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`w-2.5 h-2.5 rounded-full ${systemStatus?.esp32_status === "online" ? "bg-emerald-500 animate-ping" : "bg-rose-500"}`}></span>
                          <span className="text-sm font-black uppercase text-white font-mono tracking-wider">
                            {systemStatus?.esp32_status || "offline"}
                          </span>
                        </div>
                      </div>

                      {/* Current Stage badge */}
                      <div className="bg-[#060c07] p-3.5 rounded-2xl border border-emerald-500/5">
                        <span className="block text-[9px] text-gray-400 uppercase tracking-wider font-extrabold">Current Stage</span>
                        <span className="block text-sm font-black uppercase text-emerald-400 mt-1 truncate font-mono tracking-wide drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]">
                          {systemStatus?.current_stage || "Standby Ready"}
                        </span>
                      </div>

                    </div>

                    {/* LCD Dot Matrix Screen Readout */}
                    <div className="space-y-1.5">
                      <span className="block text-[9px] text-gray-400 uppercase tracking-widest font-black">Local 16x2 I2C Character LCD Output</span>
                      <div className="relative bg-[#020502] border border-emerald-500/20 rounded-2xl p-4 font-mono shadow-[inset_0_2px_15px_rgba(0,0,0,0.9)] overflow-hidden">
                        <div className="flex justify-between items-center text-[8px] text-emerald-500/40 font-bold uppercase tracking-widest pb-1 border-b border-emerald-500/5">
                          <span>Physical LCD Panel</span>
                          <span className="pulse-led">● LINK UP</span>
                        </div>
                        <div className="py-2.5 text-center">
                          <span className="text-lg font-black text-emerald-400 tracking-widest uppercase drop-shadow-[0_0_10px_rgba(52,211,153,0.6)]">
                            {systemStatus?.lcd_message || "SYSTEM ACTIVE"}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-[8px] text-gray-600 border-t border-emerald-500/5 pt-1 mt-1">
                          <span>Buzzer Mode: {systemStatus?.buzzer_status ? "ACTIVE ALARM" : "NOMINAL"}</span>
                          <span>TX/RX Pulse: OK</span>
                        </div>
                      </div>
                    </div>

                    {/* Last Sync stamp */}
                    <div className="flex items-center justify-between text-[10px] text-gray-500 font-mono">
                      <span>Last Updated: {systemStatus?.updated_at ? new Date(systemStatus.updated_at).toLocaleTimeString() : "No Signal"}</span>
                      <button 
                        onClick={() => fetchAllIotData(false)}
                        className="text-emerald-500 hover:text-emerald-400 transition-all flex items-center gap-1"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Force Sync
                      </button>
                    </div>

                  </div>

                  {/* Right: Premium 3D cylindrical waste bin / segregator representation */}
                  <div className="bg-[#050b06] rounded-3xl p-4 border border-emerald-500/15 flex flex-col items-center justify-center space-y-3 relative overflow-hidden h-72">
                    <span className="text-[10px] uppercase tracking-widest text-emerald-400 font-black">Active Segregator 3D</span>
                    
                    {/* Visual Cylindrical Container representing the waste separator */}
                    <div className="relative w-24 h-48 bg-emerald-950/20 rounded-t-3xl rounded-b-3xl border border-emerald-500/20 overflow-hidden flex flex-col justify-end shadow-2xl">
                      
                      {/* Grid overlay to give it a robotic screen look */}
                      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500/5 to-transparent pointer-events-none"></div>
                      
                      {/* Lid/Cap Flap */}
                      <div className="absolute top-0 left-0 right-0 h-4 bg-emerald-500/20 border-b border-emerald-500/30 flex items-center justify-center">
                        <div className="w-8 h-1 bg-emerald-400 rounded"></div>
                      </div>

                      {/* Floating Waste Particles Animation */}
                      <div className="absolute inset-0 overflow-hidden">
                        {[1, 2, 3, 4, 5].map((item) => (
                          <motion.div 
                            key={item}
                            className="absolute w-2.5 h-2.5 rounded-full bg-emerald-400/30 border border-emerald-400/40"
                            animate={{
                              y: [160, -20],
                              x: [10, 40, 10, 30][item % 4],
                              scale: [1, 1.3, 0.8, 1],
                              opacity: [0, 0.8, 0.4, 0]
                            }}
                            transition={{
                              duration: [4, 5, 3.5, 4.5, 6][item - 1],
                              repeat: Infinity,
                              ease: "linear",
                              delay: item * 0.8
                            }}
                          />
                        ))}
                      </div>

                      {/* Internal filling volume indicator */}
                      {(() => {
                        // Calculate aggregate fill level for visual illustration
                        const bin1 = dustbins[0]?.fill_percentage || 0;
                        const bin2 = dustbins[1]?.fill_percentage || 0;
                        const tank = liquidTank?.fill_percentage || 0;
                        const avgFill = Math.min(100, Math.max(10, Math.round((bin1 + bin2 + tank) / 3)));
                        const colors = getLevelConfig(avgFill);

                        return (
                          <motion.div 
                            className="w-full bg-gradient-to-t from-emerald-500/40 to-teal-500/20 border-t border-emerald-400/60 relative"
                            animate={{ height: `${avgFill * 0.9 + 10}%` }}
                            transition={{ duration: 0.8 }}
                          >
                            {/* Water rippling overlay */}
                            <div className="absolute top-0 left-0 right-0 h-1.5 bg-emerald-400/50 animate-pulse"></div>
                            
                            {/* Centered level readout */}
                            <div className="absolute inset-0 flex items-center justify-center font-mono text-[10px] font-bold text-emerald-300">
                              LEVEL: {avgFill}%
                            </div>
                          </motion.div>
                        );
                      })()}

                    </div>

                    <div className="text-center">
                      <span className="text-[9px] font-mono text-gray-500 uppercase tracking-widest block">Liquid-Slurry Chamber</span>
                      <span className="text-[10px] font-black text-white uppercase mt-0.5 inline-block">Agitator Motor OFF</span>
                    </div>

                  </div>

                </div>

                {/* --- SECTION 2: BIN MONITORING --- */}
                <div className="space-y-3">
                  <h3 className="text-xs font-black text-emerald-400 uppercase tracking-widest text-left">
                    Section 2: Ultrasonic Container Fill Levels
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    
                    {/* DUSTBIN 1 */}
                    {dustbins.slice(0, 1).map((bin) => {
                      const fill = Math.min(100, Math.max(0, bin.fill_percentage));
                      const config = getLevelConfig(fill);
                      
                      const r = 40;
                      const c = 2 * Math.PI * r;
                      const offset = c - (fill / 100) * c;

                      return (
                        <div key={bin.id} className="bg-black/40 backdrop-blur-xl border border-emerald-500/10 rounded-3xl p-5 flex flex-col items-center justify-between space-y-4">
                          <div className="text-center w-full pb-2 border-b border-emerald-500/5">
                            <h4 className="text-[11px] font-black text-white uppercase tracking-wider">{bin.dustbin_name}</h4>
                            <span className="text-[9px] font-mono text-emerald-400 uppercase tracking-widest block mt-0.5">Large Solid Waste</span>
                          </div>

                          {/* SVG Radial progress ring */}
                          <div className="relative w-28 h-28">
                            <svg className="w-full h-full transform -rotate-90">
                              <circle cx="56" cy="56" r={r} className="stroke-gray-800" strokeWidth="6" fill="transparent" />
                              <circle 
                                cx="56" cy="56" r={r} 
                                stroke={config.stroke} strokeWidth="6" fill="transparent" 
                                strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
                                className="transition-all duration-1000 ease-out"
                              />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                              <span className={`text-xl font-black font-mono ${config.text}`}>{fill}%</span>
                              <span className="text-[8px] text-gray-500 uppercase tracking-widest">of {bin.capacity || 50}L Max</span>
                            </div>
                          </div>

                          <div className="w-full text-center space-y-1.5">
                            <div className="flex justify-between items-center text-[10px] bg-emerald-950/10 px-3 py-1 rounded-xl border border-emerald-500/5">
                              <span className="text-gray-500">Telemetry:</span>
                              <span className="font-mono text-gray-300">Ultrasonic SR04</span>
                            </div>
                            <span className={`inline-block w-full text-center py-1 rounded-xl text-[10px] font-bold uppercase border tracking-wider ${config.bg}`}>
                              Status: {config.label}
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {/* DUSTBIN 2 */}
                    {dustbins.slice(1, 2).map((bin) => {
                      const fill = Math.min(100, Math.max(0, bin.fill_percentage));
                      const config = getLevelConfig(fill);
                      
                      const r = 40;
                      const c = 2 * Math.PI * r;
                      const offset = c - (fill / 100) * c;

                      return (
                        <div key={bin.id} className="bg-black/40 backdrop-blur-xl border border-emerald-500/10 rounded-3xl p-5 flex flex-col items-center justify-between space-y-4">
                          <div className="text-center w-full pb-2 border-b border-emerald-500/5">
                            <h4 className="text-[11px] font-black text-white uppercase tracking-wider">{bin.dustbin_name}</h4>
                            <span className="text-[9px] font-mono text-emerald-400 uppercase tracking-widest block mt-0.5">Fine Organic Solids</span>
                          </div>

                          {/* SVG Radial progress ring */}
                          <div className="relative w-28 h-28">
                            <svg className="w-full h-full transform -rotate-90">
                              <circle cx="56" cy="56" r={r} className="stroke-gray-800" strokeWidth="6" fill="transparent" />
                              <circle 
                                cx="56" cy="56" r={r} 
                                stroke={config.stroke} strokeWidth="6" fill="transparent" 
                                strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
                                className="transition-all duration-1000 ease-out"
                              />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                              <span className={`text-xl font-black font-mono ${config.text}`}>{fill}%</span>
                              <span className="text-[8px] text-gray-500 uppercase tracking-widest">of {bin.capacity || 50}L Max</span>
                            </div>
                          </div>

                          <div className="w-full text-center space-y-1.5">
                            <div className="flex justify-between items-center text-[10px] bg-emerald-950/10 px-3 py-1 rounded-xl border border-emerald-500/5">
                              <span className="text-gray-500">Telemetry:</span>
                              <span className="font-mono text-gray-300">Ultrasonic SR04</span>
                            </div>
                            <span className={`inline-block w-full text-center py-1 rounded-xl text-[10px] font-bold uppercase border tracking-wider ${config.bg}`}>
                              Status: {config.label}
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {/* LIQUID TANK */}
                    {liquidTank ? (() => {
                      const fill = Math.min(100, Math.max(0, liquidTank.fill_percentage));
                      const config = getLevelConfig(fill);
                      
                      const r = 40;
                      const c = 2 * Math.PI * r;
                      const offset = c - (fill / 100) * c;

                      return (
                        <div className="bg-black/40 backdrop-blur-xl border border-emerald-500/10 rounded-3xl p-5 flex flex-col items-center justify-between space-y-4">
                          <div className="text-center w-full pb-2 border-b border-emerald-500/5">
                            <h4 className="text-[11px] font-black text-white uppercase tracking-wider">Separated Liquid Tank</h4>
                            <span className="text-[9px] font-mono text-emerald-400 uppercase tracking-widest block mt-0.5">Liquid Compost Waste</span>
                          </div>

                          {/* SVG Radial progress ring */}
                          <div className="relative w-28 h-28">
                            <svg className="w-full h-full transform -rotate-90">
                              <circle cx="56" cy="56" r={r} className="stroke-gray-800" strokeWidth="6" fill="transparent" />
                              <circle 
                                cx="56" cy="56" r={r} 
                                stroke={config.stroke} strokeWidth="6" fill="transparent" 
                                strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
                                className="transition-all duration-1000 ease-out"
                              />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                              <span className={`text-xl font-black font-mono ${config.text}`}>{fill}%</span>
                              <span className="text-[8px] text-gray-500 uppercase tracking-widest">of {liquidTank.capacity || 100}L Max</span>
                            </div>
                          </div>

                          <div className="w-full text-center space-y-1.5">
                            <div className="flex justify-between items-center text-[10px] bg-emerald-950/10 px-3 py-1 rounded-xl border border-emerald-500/5">
                              <span className="text-gray-500">Telemetry:</span>
                              <span className="font-mono text-gray-300">Ultrasonic SR04</span>
                            </div>
                            <span className={`inline-block w-full text-center py-1 rounded-xl text-[10px] font-bold uppercase border tracking-wider ${config.bg}`}>
                              Status: {config.label}
                            </span>
                          </div>
                        </div>
                      );
                    })() : (
                      <div className="bg-black/40 border border-emerald-500/10 rounded-3xl p-5 flex items-center justify-center text-center h-56 text-gray-500 text-xs">
                        No Liquid Tank record found in the database.
                      </div>
                    )}

                  </div>
                </div>

                {/* --- SECTION 4: PUMP STATUS --- */}
                <div className="space-y-3">
                  <h3 className="text-xs font-black text-emerald-400 uppercase tracking-widest text-left">
                    Section 4: Pump Relay Channel Status
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {pumps.map((pump) => {
                      const isOn = pump.status === "ON";
                      return (
                        <div 
                          key={pump.id} 
                          className="bg-black/40 backdrop-blur-xl border border-emerald-500/10 rounded-2xl p-4 flex items-center justify-between gap-4 text-left transition-all hover:border-emerald-500/20"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`p-2.5 rounded-xl border transition-all ${
                              isOn 
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.3)]" 
                                : "bg-gray-800/20 border-gray-800 text-gray-600"
                            }`}>
                              <Wind className={`w-4 h-4 ${isOn ? "animate-spin" : ""}`} />
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-[11px] font-black text-white uppercase tracking-wide truncate">{pump.pump_name}</h4>
                              <p className="text-[9px] text-gray-500">Fluid separation control relay</p>
                            </div>
                          </div>

                          {/* Glow Toggle button - acts as a quick interactive override to write to database */}
                          <button
                            onClick={() => {
                              const newStatus = isOn ? "OFF" : "ON";
                              const localStates = { ...simPumpStates, [pump.id]: newStatus };
                              setSimPumpStates(localStates);
                              handleWriteSimSettings(`pump${pump.id}`, { status: newStatus });
                            }}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black font-mono border uppercase tracking-widest transition-all cursor-pointer flex items-center gap-2 ${
                              isOn
                                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                                : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${isOn ? "bg-emerald-400 animate-ping" : "bg-rose-500"}`}></span>
                            {pump.status}
                          </button>

                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* --- SECTION 5: LIVE ACTIVITY LOGS --- */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-black text-emerald-400 uppercase tracking-widest text-left">
                      Section 5: Live Activity Logs
                    </h3>
                    <button 
                      onClick={() => setActiveTab("logs")}
                      className="text-[10px] font-black text-emerald-400 hover:text-emerald-300 uppercase tracking-widest flex items-center gap-1"
                    >
                      View All Logs <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="bg-black/40 backdrop-blur-xl border border-emerald-500/10 rounded-3xl p-4 overflow-hidden">
                    <div className="max-h-56 overflow-y-auto space-y-2 text-left divide-y divide-emerald-500/5">
                      {logs.slice(0, 5).map((log, index) => (
                        <div key={log.id || index} className="pt-2.5 first:pt-0 flex items-start gap-3 text-xs">
                          <span className="font-mono text-emerald-500 font-bold bg-emerald-500/5 px-2 py-0.5 rounded text-[10px] shrink-0 mt-0.5">
                            {formatTime(log.created_at)}
                          </span>
                          <div className="space-y-0.5 min-w-0 flex-1">
                            <span className="text-[10px] uppercase font-black tracking-wider text-emerald-400 block font-mono">
                              {log.process_stage}
                            </span>
                            <p className="text-gray-300 leading-normal text-[11px] font-medium">{log.description}</p>
                          </div>
                        </div>
                      ))}
                      {logs.length === 0 && (
                        <p className="text-xs text-gray-500 py-6 text-center">No telemetry logs found in process_logs database.</p>
                      )}
                    </div>
                  </div>
                </div>

              </motion.div>
            )}

            {/* ======================================= */}
            {/* VIEW: PROCESS FLOW                       */}
            {/* ======================================= */}
            {activeTab === "process" && (
              <motion.div 
                key="process"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6 text-left"
              >
                <div className="bg-black/40 border border-emerald-500/10 rounded-3xl p-6 space-y-4">
                  <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                    <Activity className="w-5 h-5 text-emerald-400 animate-pulse" />
                    Wet Waste Treatment & Segregation Flow
                  </h3>
                  <p className="text-xs text-gray-400 leading-relaxed max-w-3xl">
                    Follow the physical organic waste separation pipeline. High-pressure water, centrifugal agitation, and precise Deflector Servo flaps sort materials instantly. Highlighting below marks the actual active phase currently driven by the database.
                  </p>
                </div>

                {/* Animated Pipeline stepper */}
                <div className="bg-black/40 border border-emerald-500/10 rounded-3xl p-6 relative overflow-hidden">
                  
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-[30px] pointer-events-none"></div>

                  <div className="space-y-6 relative z-10">
                    {[
                      { step: "Checking Dustbins", title: "1. Waste Input & Ultrasonic Check", desc: "Sensors check initial container depths to prevent overflows. Slurry cargo hopper prepares to unload." },
                      { step: "Water Injection", title: "2. Clean Water Injection", desc: "12V water pump injects exact pressurized liquid to loosen organic wet materials." },
                      { step: "Waste Agitation", desc: "Mechanical agitating motor crushes and softens wet materials into a slurry mixture.", title: "3. Centrifugal Slurry Agitation" },
                      { step: "Large Waste Separation", desc: "MG996R Servo 1 deflects non-soluble solid waste plastic materials into Dustbin 1.", title: "4. Large Trash Sifting Gate" },
                      { step: "Fine Waste Separation", desc: "Servo 2 opens. Fine compostable biological fibers are channeled to the bio-composter bin.", title: "5. Fine Compost Sieve flap" },
                      { step: "Liquid Separation", desc: "Pump 2 vacuum sucks clean nutrient-rich organic bio-fertilizer directly to the bio-liquid storage tank.", title: "6. Fluid Bio-Fertilizer Extract" },
                      { step: "Completed", desc: "Cycle complete. All containers logged and ESP32 resets to nominal scanning mode.", title: "7. Separation Completed" }
                    ].map((phase, idx) => {
                      const status = getStageStatus(phase.step, systemStatus?.current_stage || "Checking Dustbins");
                      
                      return (
                        <div key={idx} className="flex gap-4 items-start relative">
                          
                          {/* Connector lines */}
                          {idx < 6 && (
                            <div className={`absolute left-4 top-9 bottom-[-1.5rem] w-0.5 ${
                              status.isCompleted ? "bg-emerald-500" : "bg-gray-800"
                            }`}></div>
                          )}

                          {/* Glowing node indicator */}
                          <div className={`w-8.5 h-8.5 rounded-full flex items-center justify-center border font-mono text-[10px] font-black shrink-0 relative transition-all ${
                            status.isActive 
                              ? "bg-emerald-500/20 border-emerald-400 text-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.4)]" 
                              : status.isCompleted
                              ? "bg-emerald-900/30 border-emerald-500 text-emerald-300"
                              : "bg-black border-gray-800 text-gray-500"
                          }`}>
                            {status.isCompleted ? "✓" : idx + 1}
                            {status.isActive && (
                              <span className="absolute -inset-1 rounded-full border border-emerald-500/30 animate-ping"></span>
                            )}
                          </div>

                          <div className={`p-4 rounded-2xl border transition-all flex-1 ${
                            status.isActive 
                              ? "bg-emerald-500/5 border-emerald-500/20 text-white" 
                              : "bg-black/20 border-transparent text-gray-400"
                          }`}>
                            <h4 className={`text-xs font-black uppercase tracking-wider ${status.isActive ? "text-emerald-400" : "text-white/85"}`}>
                              {phase.title}
                            </h4>
                            <p className="text-[11px] leading-relaxed mt-1">{phase.desc}</p>
                            
                            {status.isActive && (
                              <div className="mt-3 inline-flex items-center gap-1.5 text-[9px] bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 text-emerald-400 font-bold uppercase font-mono tracking-wider animate-pulse">
                                <span>● CURRENT SYSTEM STATE</span>
                              </div>
                            )}
                          </div>

                        </div>
                      );
                    })}
                  </div>

                </div>
              </motion.div>
            )}

            {/* ======================================= */}
            {/* VIEW: LOGS STREAM                        */}
            {/* ======================================= */}
            {activeTab === "logs" && (
              <motion.div 
                key="logs"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6 text-left"
              >
                
                {/* Search / Filter header */}
                <div className="bg-black/40 border border-emerald-500/10 rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                      <FileText className="w-5 h-5 text-emerald-400" />
                      Historical Process logs
                    </h3>
                    <p className="text-[11px] text-gray-500 mt-0.5">Comprehensive real-time system audit logs compiled from Supabase.</p>
                  </div>

                  <div className="flex gap-2">
                    <button 
                      onClick={() => fetchAllIotData(false)}
                      className="p-2 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 rounded-xl text-emerald-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Sync Now
                    </button>
                    <button 
                      onClick={async () => {
                        if (window.confirm("Delete log history?")) {
                          await handleUpdateDatabaseValue("process_logs", null, { process_stage: "Ready", description: "Audit trail cleared." }, "Trail Cleared");
                        }
                      }}
                      className="p-2 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 rounded-xl text-rose-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      Clear Logs
                    </button>
                  </div>
                </div>

                {/* Custom manual log inject row */}
                <div className="bg-black/40 border border-emerald-500/10 rounded-3xl p-5 space-y-3">
                  <span className="block text-[10px] uppercase tracking-widest font-black text-emerald-400">Add Manual System Activity Row</span>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="e.g. Slurry filter membrane successfully flushed."
                      value={customLogText}
                      onChange={(e) => setCustomLogText(e.target.value)}
                      className="flex-1 bg-black border border-emerald-500/20 text-xs p-3 rounded-xl focus:outline-none focus:border-emerald-500 text-gray-100 placeholder-gray-600 font-medium"
                    />
                    <button 
                      onClick={handlePostCustomLog}
                      className="px-5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all cursor-pointer shadow-md"
                    >
                      Submit
                    </button>
                  </div>
                </div>

                {/* Main scrollable logs list */}
                <div className="bg-black/40 border border-emerald-500/10 rounded-3xl p-6">
                  <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1 text-xs divide-y divide-emerald-500/5">
                    {logs.map((log, idx) => (
                      <div key={log.id || idx} className="pt-4 first:pt-0 flex flex-col sm:flex-row sm:items-start gap-3">
                        <div className="flex items-center gap-2 sm:flex-col sm:items-start shrink-0">
                          <span className="font-mono text-emerald-400 font-bold bg-emerald-500/5 border border-emerald-500/10 px-2 py-0.5 rounded text-[10px]">
                            {formatTime(log.created_at)}
                          </span>
                          <span className="text-[9px] text-gray-500 font-mono font-semibold">
                            {log.created_at ? new Date(log.created_at).toLocaleDateString() : ""}
                          </span>
                        </div>

                        <div className="space-y-1 min-w-0 flex-1">
                          <span className="inline-block px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-[9px] uppercase font-black font-mono tracking-wider">
                            {log.process_stage}
                          </span>
                          <p className="text-gray-300 leading-normal text-xs font-semibold">{log.description}</p>
                        </div>
                      </div>
                    ))}

                    {logs.length === 0 && (
                      <div className="py-12 text-center text-gray-500 space-y-2">
                        <FileText className="w-10 h-10 text-gray-700 mx-auto" />
                        <p>No activity logs found in the database. Please run the automatic sequence demo to auto-generate logs.</p>
                      </div>
                    )}
                  </div>
                </div>

              </motion.div>
            )}

            {/* ======================================= */}
            {/* VIEW: ABOUT / SPECIFICATIONS             */}
            {/* ======================================= */}
            {activeTab === "about" && (
              <motion.div 
                key="about"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6 text-left"
              >
                
                {/* Project description card */}
                <div className="bg-black/40 border border-emerald-500/10 rounded-3xl p-6 space-y-4">
                  <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                    <Info className="w-5 h-5 text-emerald-400" />
                    PROJECT DESCRIPTION
                  </h3>
                  <div className="text-xs text-gray-300 leading-relaxed space-y-3">
                    <p>
                      The <strong>Smart Wet Waste Segregation & Liquid Separation System</strong> is a high-tech environmental engineering solution designed to tackle municipal wet garbage processing bottlenecks. Organic food residues are heavily loaded with liquids that cause severe fermentation, foul odours, and landfill leachate. 
                    </p>
                    <p>
                      This system automates the treatment of wet cargo waste. By introducing controlled high-pressure liquid, agitating the mixture into a loose slurry, sieving out non-degradable solid debris, and suctioning nutrient-rich bio-fertilizer liquids, it completes complex organic waste sorting in seconds. 
                    </p>
                  </div>
                </div>

                {/* Components Checklist */}
                <div className="space-y-3">
                  <h3 className="text-xs font-black text-emerald-400 uppercase tracking-widest">
                    SYSTEM HARDWARE BILL-OF-MATERIALS (BOM)
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { title: "ESP32 micro-controller", desc: "Central wireless node managing ultrasonic scans, servo PWM signals, and relay outputs, synced with Supabase Realtime via REST APIs." },
                      { title: "Ultrasonic Sensors (HC-SR04)", desc: "Dual ultrasonic sensors mounted inside the bins to continuously measure waste height and prevent overflows." },
                      { title: "MG996R High-Torque Servos", desc: "Metallic gear servo motors that turn deflectors and sliding chutes to route solid waste segments into respective bins." },
                      { title: "12V Water Pumps", desc: "Solenoid pumps injected water to dissolve solid slurry, and vacuum extracted bio-liquid nutrients into the storage container." },
                      { title: "16x2 I2C Local LCD display", desc: "Local hardware debugger block offering real-time status messages to physical technicians on the field." },
                      { title: "Active Piezo Buzzer", desc: "Sonic hazard warning indicator pulsing instantly if bins are full or emergency blockages occur." }
                    ].map((comp, index) => (
                      <div key={index} className="bg-black/40 border border-emerald-500/10 rounded-2xl p-4 flex gap-3 items-start">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-xs font-black text-white uppercase tracking-wider">{comp.title}</h4>
                          <p className="text-[11px] text-gray-400 leading-relaxed mt-0.5">{comp.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Scientific Working Principle */}
                <div className="bg-black/40 border border-emerald-500/10 rounded-3xl p-6 space-y-4">
                  <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                    <Shield className="w-5 h-5 text-emerald-400" />
                    WORKING PRINCIPLE
                  </h3>

                  <div className="space-y-4 text-xs text-gray-300 leading-relaxed">
                    <div className="border-l-2 border-emerald-500 pl-4 space-y-1">
                      <h4 className="text-xs font-black text-white uppercase">1. Feeding & Initial Scans</h4>
                      <p>Ultrasonic sensors scan the fill levels of all garbage container slots before dumping. If any bin is above 85%, the buzzer alarms and halts action.</p>
                    </div>

                    <div className="border-l-2 border-emerald-500 pl-4 space-y-1">
                      <h4 className="text-xs font-black text-white uppercase">2. Fluidic Slurry Preparation</h4>
                      <p> Pressurized water breaks down organic compounds. Central blades mix and liquefy compostables, softening solids and dissolving soluble material.</p>
                    </div>

                    <div className="border-l-2 border-emerald-500 pl-4 space-y-1">
                      <h4 className="text-xs font-black text-white uppercase">3. Mechanical Sieving & Sorting</h4>
                      <p>MG996R Servos rotate, positioning the sorting deflectors. Sifted large solids drop to Dustbin 1. Fine biological sludge filters directly into Dustbin 2.</p>
                    </div>

                    <div className="border-l-2 border-emerald-500 pl-4 space-y-1">
                      <h4 className="text-xs font-black text-white uppercase">4. Bio-Liquid Nutrient Extraction</h4>
                      <p>Vacuum suction draws soluble nutrient fluid from the filter screen, routing pure liquid bio-compost to the separate storage tank.</p>
                    </div>
                  </div>
                </div>

              </motion.div>
            )}

          </AnimatePresence>
        )}

      </main>

      {/* --- MOBILE-FRIENDLY BOTTOM NAVIGATION BAR --- */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#060b07]/80 backdrop-blur-md border-t border-emerald-500/15 py-2.5 z-40">
        <div className="max-w-md mx-auto px-6 flex justify-between items-center">
          {[
            { id: "home", label: "Home", icon: Cpu },
            { id: "process", label: "Process", icon: Activity },
            { id: "logs", label: "Logs", icon: FileText },
            { id: "about", label: "About", icon: HelpCircle }
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`flex flex-col items-center gap-1 cursor-pointer transition-all ${
                  isActive ? "text-emerald-400" : "text-gray-500 hover:text-gray-300"
                }`}
              >
                <div className={`p-1.5 rounded-xl transition-all ${isActive ? "bg-emerald-500/10 text-emerald-400" : ""}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[9px] font-black uppercase tracking-widest">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

    </div>
  );
}
