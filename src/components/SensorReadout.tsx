import { Radio, RefreshCw, Layers } from "lucide-react";
import { SensorReading } from "../types";

interface SensorReadoutProps {
  sensors: SensorReading[];
}

export default function SensorReadout({ sensors }: SensorReadoutProps) {
  return (
    <div id="sensor-readout-card" className="bg-[#1c222d] rounded-2xl p-6 border border-gray-700/50 flex flex-col justify-between shadow-[0_4px_25px_rgba(0,0,0,0.3)]">
      <div>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg">
              <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
            </span>
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-white">Sensor Monitoring</h3>
          </div>
          <span className="text-[10px] uppercase font-mono font-bold text-gray-400 flex items-center gap-1.5">
            <RefreshCw className="w-3 h-3 text-emerald-500 animate-spin" />
            Live polling: 5s
          </span>
        </div>

        <p className="text-[11px] text-gray-400 leading-normal mb-4">
          Ultrasonic telemetry modules compute fill ratios based on acoustic echo delay times from raw residues inside collection containers.
        </p>

        {/* Sensory tables / metrics list */}
        <div className="space-y-3">
          {sensors.map((sensor) => {
            const timeStr = new Date(sensor.lastUpdated).toLocaleTimeString();
            return (
              <div 
                key={sensor.sensorId} 
                id={`sensor-row-${sensor.sensorId}`}
                className="p-3 bg-[#161b22]/75 border border-gray-700/30 rounded-xl flex items-center justify-between transition-all hover:bg-gray-800/40"
              >
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-white truncate">{sensor.name}</h4>
                  <p className="text-[10px] text-gray-400 mt-0.5">Last sync: {timeStr}</p>
                </div>

                <div className="flex items-center gap-4 text-right">
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase block font-medium">Distance</span>
                    <strong className="text-xs font-bold text-white font-mono">{sensor.distance} cm</strong>
                  </div>
                  <div className="min-w-[50px]">
                    <span className="text-[10px] text-gray-500 uppercase block font-medium">Fill Ratio</span>
                    <strong className={`text-xs font-bold font-mono ${
                      sensor.fillPercentage > 80 ? 'text-red-500' : (sensor.fillPercentage > 50 ? 'text-amber-400' : 'text-emerald-400')
                    }`}>{sensor.fillPercentage}%</strong>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="pt-4 mt-4 border-t border-gray-700/50 flex items-center justify-between text-[11px] text-gray-500 font-mono">
        <span className="flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5" />
          Hardware Connection Port:
        </span>
        <span className="text-gray-300 font-bold uppercase">ESP32 pin 12/14/15</span>
      </div>
    </div>
  );
}
