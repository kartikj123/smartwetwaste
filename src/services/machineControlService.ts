import { supabase } from "../lib/supabase";
import { MachineCommand, MachineStatus, MachineControl } from "../types";

export async function getMachineStatus(activeMode: "backend" | "supabase_direct" | "local_simulation"): Promise<MachineControl> {
  if (activeMode === "backend") {
    try {
      const res = await fetch("/api/supabase/iot-data");
      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error(`Invalid content-type: ${contentType}`);
      }
      const json = await res.json();
      if (json.success && json.data.machine_control?.[0]) {
        return json.data.machine_control[0] as MachineControl;
      }
    } catch (e: any) {
      console.warn("Failed to retrieve machine control status via backend API, using fallback:", e.message);
    }
    // Return mock default if table doesn't exist yet or endpoint failed
    return { id: 1, command: "IDLE", status: "IDLE", updated_at: new Date().toISOString() };
  } else if (activeMode === "supabase_direct" && supabase) {
    const { data, error } = await supabase
      .from("machine_control")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    
    if (error) {
      console.error("Supabase direct query failed:", error);
      throw error;
    }
    if (data) {
      return data as MachineControl;
    }
    // Seeding fallback
    const defaultState: MachineControl = { id: 1, command: "IDLE", status: "IDLE", updated_at: new Date().toISOString() };
    return defaultState;
  } else {
    // Local simulation
    const stored = localStorage.getItem("sim_machine_control");
    if (stored) {
      return JSON.parse(stored);
    }
    const defaultState: MachineControl = { id: 1, command: "IDLE", status: "IDLE", updated_at: new Date().toISOString() };
    localStorage.setItem("sim_machine_control", JSON.stringify(defaultState));
    return defaultState;
  }
}

export async function sendCommand(
  activeMode: "backend" | "supabase_direct" | "local_simulation",
  command: MachineCommand
): Promise<void> {
  if (activeMode === "backend") {
    const res = await fetch("/api/supabase/update-iot-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        table: "machine_control",
        id: 1,
        payload: { command }
      })
    });
    if (!res.ok) {
      throw new Error(`Server returned HTTP ${res.status} when sending command.`);
    }
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      throw new Error("Invalid response content-type received from server.");
    }
    const json = await res.json();
    if (!json.success) throw new Error(json.error || "Failed to update command.");
  } else if (activeMode === "supabase_direct" && supabase) {
    const { error } = await supabase
      .from("machine_control")
      .update({ command, updated_at: new Date().toISOString() })
      .eq("id", 1);
    if (error) throw error;
  } else {
    // Local simulation
    const current = await getMachineStatus(activeMode);
    current.command = command;
    current.updated_at = new Date().toISOString();
    
    // Handle status transition logic automatically for local demonstration sandbox
    if (command === "START") {
      current.status = "RUNNING";
    } else if (command === "STOP") {
      current.status = "STOPPED";
    } else if (command === "RESET") {
      current.status = "IDLE";
    }

    localStorage.setItem("sim_machine_control", JSON.stringify(current));
    
    // Dispatch window custom event to notify React components instantly
    window.dispatchEvent(new CustomEvent("sim_machine_control_updated", { detail: current }));
  }
}

export async function sendStartCommand(activeMode: "backend" | "supabase_direct" | "local_simulation"): Promise<void> {
  return sendCommand(activeMode, "START");
}

export async function sendStopCommand(activeMode: "backend" | "supabase_direct" | "local_simulation"): Promise<void> {
  return sendCommand(activeMode, "STOP");
}

export async function sendResetCommand(activeMode: "backend" | "supabase_direct" | "local_simulation"): Promise<void> {
  return sendCommand(activeMode, "RESET");
}

export function subscribeMachineStatus(
  activeMode: "backend" | "supabase_direct" | "local_simulation",
  onUpdate: (data: MachineControl) => void
): () => void {
  if (activeMode === "supabase_direct" && supabase) {
    const channel = supabase
      .channel("machine_control_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "machine_control", filter: "id=eq.1" },
        (payload) => {
          if (payload.new) {
            onUpdate(payload.new as MachineControl);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  } else if (activeMode === "local_simulation") {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<MachineControl>;
      onUpdate(customEvent.detail);
    };
    window.addEventListener("sim_machine_control_updated", handler);
    return () => {
      window.removeEventListener("sim_machine_control_updated", handler);
    };
  } else {
    // For backend or regular interval updates
    const interval = setInterval(async () => {
      try {
        const status = await getMachineStatus(activeMode);
        onUpdate(status);
      } catch (err) {
        console.error("Polling error in machine control subscription:", err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }
}
