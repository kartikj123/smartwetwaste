import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Play, 
  Square, 
  RotateCcw, 
  Cpu, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  Loader2,
  ChevronDown
} from "lucide-react";
import { MachineControl, MachineStatus, MachineCommand } from "../types";
import { 
  getMachineStatus, 
  sendStartCommand, 
  sendStopCommand, 
  sendResetCommand, 
  subscribeMachineStatus 
} from "../services/machineControlService";

interface MachineControlCardProps {
  activeMode: "backend" | "supabase_direct" | "local_simulation" | "initializing";
}

export default function MachineControlCard({ activeMode }: MachineControlCardProps) {
  const [machineData, setMachineData] = useState<MachineControl>({
    id: 1,
    command: "IDLE",
    status: "IDLE"
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: "info" | "success" | "error" | "sending" } | null>(null);
  const [showSimulator, setShowSimulator] = useState<boolean>(false);

  // Fetch initial status
  useEffect(() => {
    if (activeMode === "initializing") return;

    let isMounted = true;
    const fetchStatus = async () => {
      try {
        const data = await getMachineStatus(activeMode);
        if (isMounted) {
          setMachineData(data);
        }
      } catch (err) {
        console.error("Failed to load initial machine status:", err);
      }
    };

    fetchStatus();

    // Subscribe to realtime updates
    const unsubscribe = subscribeMachineStatus(activeMode, (updated) => {
      if (!isMounted) return;
      setMachineData(updated);

      // Handle user feedback logic based on received status
      if (updated.status === "RUNNING") {
        setFeedbackMsg({ text: "Machine is running.", type: "info" });
      } else if (updated.status === "PROCESS_COMPLETE") {
        setFeedbackMsg({ text: "Segregation completed successfully.", type: "success" });
      } else if (updated.status === "ERROR") {
        setFeedbackMsg({ text: `Machine Alert: System error detected! (Status: ${updated.status})`, type: "error" });
      } else if (updated.status === "STOPPED") {
        setFeedbackMsg({ text: "Machine process was forcefully stopped.", type: "error" });
      } else if (updated.status === "IDLE") {
        setFeedbackMsg(null);
      } else if (
        ["WET_DETECTED", "DRY_DETECTED", "METAL_DETECTED", "BIN1_FULL", "BIN2_FULL", "LIQUID_FULL"].includes(updated.status)
      ) {
        setFeedbackMsg({ text: `Sensor Update: ${updated.status.replace("_", " ")}`, type: "info" });
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [activeMode]);

  // Clean feedback after 5 seconds if success/error
  useEffect(() => {
    if (feedbackMsg && (feedbackMsg.type === "success" || feedbackMsg.type === "error")) {
      const timer = setTimeout(() => {
        // Only reset if it's still the same message
        setFeedbackMsg(prev => {
          if (prev?.text === feedbackMsg.text) return null;
          return prev;
        });
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [feedbackMsg]);

  // Executing command wrapper
  const handleAction = async (commandType: "START" | "STOP" | "RESET") => {
    const mode = activeMode;
    if (mode === "initializing") return;
    setLoading(true);
    setFeedbackMsg({ text: "Sending command...", type: "sending" });

    try {
      if (commandType === "START") {
        await sendStartCommand(mode);
      } else if (commandType === "STOP") {
        await sendStopCommand(mode);
      } else if (commandType === "RESET") {
        await sendResetCommand(mode);
      }
    } catch (err: any) {
      setFeedbackMsg({ text: `Command failed: ${err.message || err}`, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  // Status Badge configurations
  const getStatusConfig = (status: MachineStatus) => {
    switch (status) {
      case "IDLE":
        return { text: "IDLE", bg: "bg-gray-500/10 border-gray-500/20 text-gray-400", indicator: "bg-gray-500" };
      case "RUNNING":
        return { text: "RUNNING", bg: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400", indicator: "bg-emerald-400" };
      case "PROCESS_COMPLETE":
        return { text: "PROCESS COMPLETE", bg: "bg-blue-500/10 border-blue-500/20 text-blue-400", indicator: "bg-blue-400" };
      case "BIN1_FULL":
        return { text: "BIN 1 (LARGE) FULL", bg: "bg-yellow-500/10 border-yellow-500/20 text-yellow-400", indicator: "bg-yellow-400 animate-pulse" };
      case "BIN2_FULL":
        return { text: "BIN 2 (FINE) FULL", bg: "bg-yellow-500/10 border-yellow-500/20 text-yellow-400", indicator: "bg-yellow-400 animate-pulse" };
      case "LIQUID_FULL":
        return { text: "LIQUID TANK FULL", bg: "bg-yellow-500/10 border-yellow-500/20 text-yellow-400", indicator: "bg-yellow-400 animate-pulse" };
      case "WET_DETECTED":
        return { text: "WET DETECTED", bg: "bg-orange-500/10 border-orange-500/20 text-orange-400", indicator: "bg-orange-400" };
      case "DRY_DETECTED":
        return { text: "DRY DETECTED", bg: "bg-orange-500/10 border-orange-500/20 text-orange-400", indicator: "bg-orange-400" };
      case "METAL_DETECTED":
        return { text: "METAL DETECTED", bg: "bg-orange-500/10 border-orange-500/20 text-orange-400", indicator: "bg-orange-400" };
      case "ERROR":
        return { text: "MACHINE ERROR", bg: "bg-rose-500/10 border-rose-500/20 text-rose-400", indicator: "bg-rose-400 animate-pulse" };
      case "STOPPED":
        return { text: "STOPPED", bg: "bg-rose-500/10 border-rose-500/20 text-rose-400", indicator: "bg-rose-400" };
      default:
        return { text: status || "UNKNOWN", bg: "bg-gray-500/10 border-gray-500/20 text-gray-400", indicator: "bg-gray-400" };
    }
  };

  const statusConfig = getStatusConfig(machineData.status);

  // Disable Logic
  const isStartDisabled = machineData.status === "RUNNING" || loading || activeMode === "initializing";
  const isStopDisabled = machineData.status === "IDLE" || loading || activeMode === "initializing";
  const isResetDisabled = loading || activeMode === "initializing";

  // Simulate ESP32 status updates directly to Supabase or simulation states (Developer override helper)
  const handleSimulateEspStatus = async (simulatedStatus: MachineStatus) => {
    try {
      if (activeMode === "local_simulation") {
        const current = { ...machineData, status: simulatedStatus, updated_at: new Date().toISOString() };
        setMachineData(current);
        localStorage.setItem("sim_machine_control", JSON.stringify(current));
        window.dispatchEvent(new CustomEvent("sim_machine_control_updated", { detail: current }));
      } else {
        // For backend or direct supabase, update the direct table
        const payload = { status: simulatedStatus };
        if (activeMode === "backend") {
          await fetch("/api/supabase/update-iot-data", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ table: "machine_control", id: 1, payload })
          });
        } else if (activeMode === "supabase_direct" && import.meta.env?.VITE_SUPABASE_URL) {
          const { supabase: directClient } = await import("../lib/supabase");
          if (directClient) {
            await directClient.from("machine_control").update(payload).eq("id", 1);
          }
        }
      }
    } catch (err: any) {
      console.error("Simulation failed:", err);
    }
  };

  return (
    <div 
      id="machine-control-card"
      className="relative overflow-hidden bg-emerald-950/5 border border-emerald-500/10 rounded-3xl p-6 sm:p-7 backdrop-blur-xl transition-all hover:border-emerald-500/20"
    >
      {/* Decorative light ring */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <span className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20">
            <Cpu className="w-5 h-5 animate-pulse" />
          </span>
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
              Machine Control
            </h3>
            <p className="text-[11px] text-gray-500 font-mono">ESP32 Controller & Segregation Loop Actuators</p>
          </div>
        </div>

        {/* Live Status Badge */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider font-mono">Live State:</span>
          <motion.div 
            key={machineData.status}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${statusConfig.bg}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.indicator}`} />
            {statusConfig.text}
          </motion.div>
        </div>
      </div>

      {/* Buttons Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Button 1: Start */}
        <button
          onClick={() => handleAction("START")}
          disabled={isStartDisabled}
          className={`relative group px-5 py-4 rounded-2xl flex flex-col items-center justify-center gap-2 border text-center transition-all ${
            isStartDisabled 
              ? "bg-gray-900/40 border-gray-800 text-gray-600 cursor-not-allowed"
              : "bg-emerald-500/5 hover:bg-emerald-500/15 border-emerald-500/20 text-emerald-400 hover:border-emerald-500/40 cursor-pointer shadow-lg active:scale-98"
          }`}
        >
          {loading && feedbackMsg?.type === "sending" ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Play className={`w-5 h-5 ${!isStartDisabled && "group-hover:scale-110 transition-transform"}`} />
          )}
          <span className="text-[11px] font-extrabold uppercase tracking-wider font-mono">Start Process</span>
          <span className="text-[9px] text-gray-500 font-mono">Command='START'</span>
        </button>

        {/* Button 2: Stop */}
        <button
          onClick={() => handleAction("STOP")}
          disabled={isStopDisabled}
          className={`relative group px-5 py-4 rounded-2xl flex flex-col items-center justify-center gap-2 border text-center transition-all ${
            isStopDisabled 
              ? "bg-gray-900/40 border-gray-800 text-gray-600 cursor-not-allowed"
              : "bg-rose-500/5 hover:bg-rose-500/15 border-rose-500/20 text-rose-400 hover:border-rose-500/40 cursor-pointer shadow-lg active:scale-98"
          }`}
        >
          {loading && feedbackMsg?.type === "sending" ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Square className={`w-5 h-5 ${!isStopDisabled && "group-hover:scale-110 transition-transform"}`} />
          )}
          <span className="text-[11px] font-extrabold uppercase tracking-wider font-mono">Stop Process</span>
          <span className="text-[9px] text-gray-500 font-mono">Command='STOP'</span>
        </button>

        {/* Button 3: Reset */}
        <button
          onClick={() => handleAction("RESET")}
          disabled={isResetDisabled}
          className={`relative group px-5 py-4 rounded-2xl flex flex-col items-center justify-center gap-2 border text-center transition-all ${
            isResetDisabled 
              ? "bg-gray-900/40 border-gray-800 text-gray-600 cursor-not-allowed"
              : "bg-blue-500/5 hover:bg-blue-500/15 border-blue-500/20 text-blue-400 hover:border-blue-500/40 cursor-pointer shadow-lg active:scale-98"
          }`}
        >
          {loading && feedbackMsg?.type === "sending" ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <RotateCcw className={`w-5 h-5 ${!isResetDisabled && "group-hover:rotate-45 transition-transform"}`} />
          )}
          <span className="text-[11px] font-extrabold uppercase tracking-wider font-mono">Reset Register</span>
          <span className="text-[9px] text-gray-500 font-mono">Command='RESET'</span>
        </button>
      </div>

      {/* Active feedback logs / User Alert bar */}
      <AnimatePresence mode="wait">
        {feedbackMsg && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`mt-4 px-4 py-3.5 rounded-xl text-xs flex items-center gap-3 border font-mono ${
              feedbackMsg.type === "success"
                ? "bg-emerald-950/30 border-emerald-500/20 text-emerald-400"
                : feedbackMsg.type === "error"
                ? "bg-rose-950/30 border-rose-500/20 text-rose-400"
                : feedbackMsg.type === "sending"
                ? "bg-blue-950/20 border-blue-500/20 text-blue-400 animate-pulse"
                : "bg-[#111915]/60 border-emerald-500/10 text-gray-300"
            }`}
          >
            {feedbackMsg.type === "success" && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
            {feedbackMsg.type === "error" && <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />}
            {feedbackMsg.type === "sending" && <Loader2 className="w-4 h-4 text-blue-400 shrink-0 animate-spin" />}
            {feedbackMsg.type === "info" && <Info className="w-4 h-4 text-emerald-400 shrink-0" />}
            
            <div className="flex-1">
              {feedbackMsg.text}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Developer Override Simulator - Extremely valuable for testing the ESP32 logic */}
      <div className="mt-5 border-t border-emerald-500/5 pt-3">
        <button
          onClick={() => setShowSimulator(!showSimulator)}
          className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-emerald-400 transition-colors uppercase font-black font-mono tracking-wider cursor-pointer"
        >
          <ChevronDown className={`w-3 h-3 transition-transform ${showSimulator ? "rotate-180" : ""}`} />
          {showSimulator ? "Hide ESP32 Emulator" : "Show ESP32 Status Emulator"}
        </button>

        <AnimatePresence>
          {showSimulator && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mt-3 p-4 bg-black/40 border border-emerald-500/10 rounded-2xl space-y-3"
            >
              <p className="text-[10px] text-gray-400 leading-normal font-mono">
                💡 <strong>ESP32 Simulation Engine:</strong> In actual production, only your physical hardware updates the database 
                status column. Toggle status codes below to preview how the Segregator Dashboard reacts to live sensor checks.
              </p>
              
              <div className="flex flex-wrap gap-2 pt-1">
                {(["IDLE", "RUNNING", "WET_DETECTED", "DRY_DETECTED", "METAL_DETECTED", "BIN1_FULL", "BIN2_FULL", "LIQUID_FULL", "PROCESS_COMPLETE", "ERROR", "STOPPED"] as MachineStatus[]).map((statusVal) => (
                  <button
                    key={statusVal}
                    onClick={() => handleSimulateEspStatus(statusVal)}
                    className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer font-mono border ${
                      machineData.status === statusVal
                        ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                        : "bg-[#0b0e0c] hover:bg-emerald-950/30 border-gray-800 text-gray-500 hover:text-gray-300"
                    }`}
                  >
                    {statusVal}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
