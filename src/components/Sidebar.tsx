import { 
  LayoutDashboard, 
  Settings, 
  Activity, 
  BellRing, 
  BarChart3, 
  LogOut,
  Leaf
} from "lucide-react";

interface SidebarProps {
  currentTab: string;
  setTab: (tab: string) => void;
  currentUser: { email: string; role: 'Admin' | 'Operator'; name: string } | null;
  onLogout: () => void;
}

export default function Sidebar({ currentTab, setTab, currentUser, onLogout }: SidebarProps) {
  const navItems = [
    { id: 'dashboard', label: 'IoT Dashboard', icon: LayoutDashboard },
    { id: 'analytics', label: 'Waste Analytics', icon: BarChart3 },
    { id: 'alerts', label: 'Alert Central', icon: BellRing },
    { id: 'settings', label: 'System Settings', icon: Settings }
  ];

  return (
    <aside id="system-sidebar" className="w-[72px] sm:w-[240px] bg-[#161b22] flex flex-col min-h-screen border-r border-gray-700/50 p-2 sm:p-4 shrink-0 transition-all duration-300">
      {/* Brand Header */}
      <div className="flex items-center justify-center sm:justify-start gap-3 py-3 sm:py-4 border-b border-gray-750">
        <div className="bg-emerald-500/10 p-2 rounded-xl border border-emerald-500/20 shrink-0">
          <Leaf className="w-5 h-5 text-emerald-400" />
        </div>
        <div className="hidden sm:block min-w-0">
          <h1 className="text-xs font-black tracking-wider text-emerald-500 uppercase truncate">WetWaste Pro</h1>
          <p className="text-[9px] uppercase font-bold tracking-widest text-gray-400">IoT Control Center</p>
        </div>
      </div>

      {/* Operator Credentials Card */}
      {currentUser && (
        <div className="flex justify-center sm:justify-start mx-0 sm:mx-1 my-4 bg-emerald-950/20 border border-emerald-800/30 rounded-xl p-2 sm:p-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative shrink-0">
              <div className="w-9 h-9 rounded-full bg-emerald-900/30 border border-emerald-500/50 flex items-center justify-center text-xs font-bold text-emerald-400 uppercase">
                {currentUser.name.substring(0, 2)}
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border border-[#161b22] rounded-full"></span>
            </div>
            <div className="hidden sm:block min-w-0 flex-1">
              <h4 className="text-xs font-semibold text-gray-200 truncate">{currentUser.name}</h4>
              <span className="inline-block px-1.5 py-0.5 text-[8px] font-extrabold tracking-widest rounded mt-1 uppercase bg-emerald-500 text-gray-900">
                {currentUser.role}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Stack */}
      <nav id="sidebar-nav-list" className="flex flex-col gap-1.5 mt-2 sm:mt-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              id={`nav-btn-${item.id}`}
              onClick={() => setTab(item.id)}
              className={`flex items-center justify-center sm:justify-start gap-2 sm:gap-3 p-3 sm:px-3 sm:py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer select-none ${
                isActive 
                  ? 'bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/30' 
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50 border border-transparent'
              }`}
              title={item.label}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-emerald-400' : 'text-gray-400'}`} />
              <span className="hidden sm:inline truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Disconnect trigger */}
      <div className="mt-auto pt-4 border-t border-gray-750">
        <button
          id="logout-button-id"
          onClick={onLogout}
          className="w-full flex items-center justify-center sm:justify-start gap-3 p-3 sm:px-3 sm:py-2.5 rounded-xl text-xs font-semibold text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer select-none"
          title="Disconnect Portal"
        >
          <LogOut className="w-4 h-4 text-red-400 shrink-0" />
          <span className="hidden sm:inline truncate">Disconnect Portal</span>
        </button>
      </div>
    </aside>
  );
}
