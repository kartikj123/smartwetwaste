import { Database, TrendingUp, AlertTriangle } from "lucide-react";
import { BinStatus } from "../types";

interface LiveBinsProps {
  bins: BinStatus[];
}

export default function LiveBinCard({ bins }: LiveBinsProps) {
  return (
    <div id="live-bin-grid" className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {bins.map((bin) => {
        // Color rule determination based on level
        let colorClass = "stroke-emerald-400";
        let textClass = "text-emerald-400";
        let bgClass = "bg-emerald-500/10";
        let borderAccent = "border-emerald-500/20";

        if (bin.level > 50 && bin.level <= 80) {
          colorClass = "stroke-amber-400";
          textClass = "text-amber-400";
          bgClass = "bg-amber-400/10";
          borderAccent = "border-amber-400/20";
        } else if (bin.level > 80) {
          colorClass = "stroke-red-500";
          textClass = "text-red-500";
          bgClass = "bg-red-500/10";
          borderAccent = "border-red-500/20";
        }

        // SVG Circular Parameters
        const radius = 55;
        const circumference = 2 * Math.PI * radius;
        const strokeDashoffset = circumference - (bin.level / 100) * circumference;

        return (
          <div 
            key={bin.id} 
            id={`bin-panel-${bin.id}`}
            className="bg-[#1c222d] rounded-2xl p-6 relative overflow-hidden border border-gray-700/50 transition-all duration-300 hover:border-gray-600/50 hover:shadow-[0_4px_25px_rgba(0,0,0,0.35)]"
          >
            {/* Top Indicator */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <span className={`text-[10px] uppercase font-mono tracking-widest ${textClass}`}>
                  {bin.type === 'liquid' ? 'Collection Tank' : 'Solid Dustbin'}
                </span>
                <h3 className="text-sm font-bold text-white mt-1">{bin.name}</h3>
              </div>
              <span className={`px-2.5 py-0.5 rounded text-[9px] font-extrabold tracking-widest uppercase ${bgClass} ${textClass} border ${borderAccent}`}>
                {bin.status}
              </span>
            </div>

            {/* Circular Progress Gauge and Metrics Row */}
            <div className="flex items-center justify-around gap-4 my-2">
              {/* Circular SVG Progress */}
              <div className="relative w-32 h-32 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90">
                  {/* Track Circle */}
                  <circle
                    cx="64"
                    cy="64"
                    r={radius}
                    className="stroke-white/[0.04]"
                    strokeWidth="10"
                    fill="transparent"
                  />
                  {/* Dynamic Glowing Filled Circle */}
                  <circle
                    cx="64"
                    cy="64"
                    r={radius}
                    className={`transition-all duration-1000 ease-out ${colorClass}`}
                    strokeWidth="10"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    fill="transparent"
                  />
                </svg>
                {/* Center Stats Display */}
                <div className="absolute text-center">
                  <span className="text-2xl font-extrabold tracking-tight text-white">
                    {bin.level}%
                  </span>
                  <p className="text-[9px] uppercase font-bold tracking-widest text-gray-500">
                    VOLUME
                  </p>
                </div>
              </div>

              {/* Status details list */}
              <div className="space-y-3.5 flex-1 max-w-[120px]">
                <div className="bg-[#161b22]/70 border border-gray-700/30 p-2 rounded-lg">
                  <p className="text-[9px] uppercase font-medium text-gray-550">Fill Capacity</p>
                  <p className="text-xs font-bold text-white font-mono mt-0.5">{bin.capacity}%</p>
                </div>

                <div className="bg-[#161b22]/70 border border-gray-700/30 p-2 rounded-lg">
                  <p className="text-[9px] uppercase font-medium text-gray-550">Distance Reading</p>
                  <p className="text-xs font-bold text-white font-mono mt-0.5">{bin.distance} cm</p>
                </div>
              </div>
            </div>

            {/* Progress Bar styled Bottom Track */}
            <div className="mt-4 pt-4 border-t border-gray-700/50 flex items-center justify-between text-[11px] text-gray-400 font-medium">
              <span className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-gray-500" />
                Ultrasonic Telemetry
              </span>
              <span className="font-mono text-gray-300">
                Limit: {bin.type === 'liquid' ? '50cm' : '40cm'}
              </span>
            </div>

            {/* Background absolute subtle color glow */}
            <div className={`absolute -right-12 -bottom-12 w-28 h-28 rounded-full blur-[70px] opacity-15 pointer-events-none ${
              bin.level > 80 ? 'bg-red-500' : (bin.level > 50 ? 'bg-amber-400' : 'bg-emerald-500')
            }`} />
          </div>
        );
      })}
    </div>
  );
}
