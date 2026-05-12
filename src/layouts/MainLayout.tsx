import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Home, Frame, Layers, Wind, Database, Settings, LogOut, Menu, FolderOpen, FileText, ArrowLeft, Network } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { DisclaimerModal } from '../components/DisclaimerModal';
import simplifyStructLogo from '../assets/simplifystruct-logo.png';
import { useWebsiteStyleSettings } from '../utils/websiteStyle';

interface ProjectSummary {
  label: string;
  projectNumber: string;
  client: string;
  status: string;
  mode: 'project' | 'quick' | 'none';
}

const getProjectSummary = (): ProjectSummary => {
  try {
    const rawProjects = window.localStorage.getItem('struccalc.projects.v3');
    const activeProjectId = window.localStorage.getItem('struccalc.activeProject.v3');
    const mode = window.localStorage.getItem('struccalc.sessionMode.v3');

    if (mode === 'quick') {
      return {
        label: 'Quick Calculations',
        projectNumber: '',
        client: '',
        status: 'Temporary workspace',
        mode: 'quick',
      };
    }

    if (!rawProjects || !activeProjectId) {
      return {
        label: 'No project selected',
        projectNumber: '',
        client: '',
        status: 'Open Projects to begin',
        mode: 'none',
      };
    }

    const projects = JSON.parse(rawProjects) as Array<{
      id: string;
      name: string;
      projectNumber?: string;
      client?: string;
      status?: string;
    }>;
    const activeProject = projects.find((project) => project.id === activeProjectId);

    if (!activeProject) {
      return {
        label: 'No project selected',
        projectNumber: '',
        client: '',
        status: 'Open Projects to begin',
        mode: 'none',
      };
    }

    return {
      label: activeProject.name,
      projectNumber: activeProject.projectNumber || '',
      client: activeProject.client || '',
      status: activeProject.status || 'Active',
      mode: 'project',
    };
  } catch {
    return {
      label: 'No project selected',
      projectNumber: '',
      client: '',
      status: 'Open Projects to begin',
      mode: 'none',
    };
  }
};

export const MainLayout: React.FC = () => {
  const { user, logout, mockLogout } = useAuth();
  const location = useLocation();
  const { isDesktopStyle, isDesktopGlass } = useWebsiteStyleSettings();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
  const [projectSummary, setProjectSummary] = React.useState(getProjectSummary);

  React.useEffect(() => {
    setProjectSummary(getProjectSummary());
  }, [location.pathname]);

  const isProjectHome = location.pathname === '/';
  const isVisualWorkspace = location.pathname === '/visual-workspace';

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Error signing out', error);
      mockLogout();
    }
  };

  if (isProjectHome) {
    return <Outlet />;
  }

  const navItems = [
    { to: '/dashboard', icon: <Home size={18} />, label: 'Dashboard', end: true },
    { to: '/steel', icon: <Frame size={18} />, label: 'Steel Design' },
    { to: '/concrete', icon: <Layers size={18} />, label: 'Concrete Design' },
    { to: '/loads', icon: <Wind size={18} />, label: 'Loads' },
    { to: '/documents', icon: <FileText size={18} />, label: 'Documents' },
    { to: '/visual-workspace', icon: <Network size={18} />, label: 'Visual Workspace' },
    { to: '/variables', icon: <Database size={18} />, label: 'Variables' },
  ];

  const shellClass = isDesktopStyle
    ? 'ss-shell flex h-screen text-slate-100 font-sans relative overflow-hidden'
    : 'flex h-screen bg-white text-gray-800 font-sans relative';

  const sidebarClass = isDesktopStyle
    ? `fixed md:static inset-y-0 left-0 transform ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } md:translate-x-0 transition duration-200 ease-in-out z-40 w-72 ss-glass border-r border-white/10 flex flex-col`
    : `fixed md:static inset-y-0 left-0 transform ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } md:translate-x-0 transition duration-200 ease-in-out z-40 w-72 bg-gray-50 border-r border-gray-200 flex flex-col`;

  return (
    <div className={shellClass}>
      <DisclaimerModal />
      {isDesktopGlass && (
        <>
          <span className="ss-orb left-20 top-10 h-72 w-72 bg-blue-500/20" />
          <span className="ss-orb right-16 top-24 h-80 w-80 bg-purple-500/20" />
          <span className="ss-orb bottom-10 left-1/2 h-72 w-72 bg-cyan-500/10" />
        </>
      )}

      <button
        className={`md:hidden fixed top-4 left-4 z-50 p-2 rounded-md shadow-sm border ${isDesktopStyle ? 'ss-glass text-white' : 'bg-white'}`}
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
      >
        <Menu size={20} />
      </button>

      <div className={sidebarClass}>
        <div className={`p-5 border-b ${isDesktopStyle ? 'border-white/10' : 'border-gray-200'}`}>
          <div className="flex items-center">
            <img src={simplifyStructLogo} alt="SimplifyStruct logo" className={`h-10 max-w-[190px] rounded-sm object-contain ${isDesktopStyle ? 'bg-white/90 p-1' : 'bg-white'}`} />
          </div>

          <NavLink
            to="/"
            end
            className={`mt-5 flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold ${
              isDesktopStyle ? 'border-white/10 bg-white/10 text-slate-100 hover:bg-white/15' : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
            }`}
          >
            <ArrowLeft size={16} />
            Projects Home
          </NavLink>

          <div className={`mt-4 rounded-2xl border p-4 shadow-sm ${isDesktopStyle ? 'ss-glass-strong' : 'border-gray-200 bg-white'}`}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className={`text-[10px] font-bold uppercase tracking-wide ${isDesktopStyle ? 'ss-text-muted' : 'text-gray-500'}`}>Current Workspace</div>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  projectSummary.mode === 'quick'
                    ? 'bg-amber-500/15 text-amber-300'
                    : projectSummary.mode === 'project'
                      ? 'bg-green-500/15 text-green-300'
                      : isDesktopStyle ? 'bg-white/10 text-slate-300' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {projectSummary.status}
              </span>
            </div>

            <div className={`text-lg font-bold leading-tight break-words ${isDesktopStyle ? 'ss-text-primary' : 'text-gray-950'}`}>
              {projectSummary.label}
            </div>

            {(projectSummary.projectNumber || projectSummary.client) && (
              <div className={`mt-3 space-y-1 text-xs ${isDesktopStyle ? 'ss-text-secondary' : 'text-gray-600'}`}>
                {projectSummary.projectNumber && (
                  <div>
                    <span className={isDesktopStyle ? 'font-semibold text-white' : 'font-semibold text-gray-800'}>No.</span> {projectSummary.projectNumber}
                  </div>
                )}
                {projectSummary.client && (
                  <div>
                    <span className={isDesktopStyle ? 'font-semibold text-white' : 'font-semibold text-gray-800'}>Client</span> {projectSummary.client}
                  </div>
                )}
              </div>
            )}

            <div className={`mt-3 text-xs ${isDesktopStyle ? 'ss-text-muted' : 'text-gray-500'}`}>
              Use Projects Home to switch projects, create new work, or start quick calculations.
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-5">
          <div className={`mb-2 px-3 text-[10px] font-bold uppercase tracking-wide ${isDesktopStyle ? 'ss-text-muted' : 'text-gray-400'}`}>
            Design Workspace
          </div>
          <div className="space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    isDesktopStyle
                      ? isActive ? 'ss-nav-active' : 'ss-nav-idle'
                      : isActive
                        ? 'bg-gray-200 text-gray-950 shadow-sm'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`
                }
              >
                {item.icon}
                {item.label}
              </NavLink>
            ))}
          </div>

          <div className={`mt-6 border-t pt-4 ${isDesktopStyle ? 'border-white/10' : 'border-gray-200'}`}>
            <div className={`mb-2 px-3 text-[10px] font-bold uppercase tracking-wide ${isDesktopStyle ? 'ss-text-muted' : 'text-gray-400'}`}>
              System
            </div>
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isDesktopStyle
                    ? isActive ? 'ss-nav-active' : 'ss-nav-idle'
                    : isActive
                      ? 'bg-gray-200 text-gray-950 shadow-sm'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              <Settings size={18} />
              Settings
            </NavLink>
          </div>
        </nav>

        <div className={`p-4 border-t flex flex-col gap-4 ${isDesktopStyle ? 'border-white/10' : 'border-gray-200'}`}>
          <div className={`flex items-center justify-between rounded-xl px-3 py-2 border ${isDesktopStyle ? 'border-white/10 bg-white/10' : 'bg-white border-gray-200'}`}>
            <span className={`text-sm font-medium truncate max-w-[180px] ${isDesktopStyle ? 'text-slate-100' : 'text-gray-700'}`}>
              {user?.email}
            </span>
            <button
              onClick={handleLogout}
              className={`p-1 rounded-md transition-colors ${isDesktopStyle ? 'text-slate-300 hover:bg-white/10 hover:text-white' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'}`}
              title="Log out"
            >
              <LogOut size={16} />
            </button>
          </div>

          <div className={`px-1 text-[10px] leading-tight ${isDesktopStyle ? 'text-slate-500' : 'text-gray-400'}`}>
            NOT FOR CONSTRUCTION. Engineer of Record must verify all calculations. By using this tool, you accept the Terms of Use and liability disclaimer.
          </div>
        </div>
      </div>

      <div className={`relative flex-1 overflow-auto ${isVisualWorkspace ? 'bg-slate-950' : isDesktopStyle ? 'bg-transparent' : 'bg-white'}`}>
        <main className={isVisualWorkspace ? 'h-full min-w-0 p-0 mt-0' : 'p-8 max-w-7xl mx-auto mt-10 md:mt-0'}>
          {!isVisualWorkspace && (
            <div className={`mb-6 rounded-3xl border px-5 py-4 ${isDesktopStyle ? 'ss-glass-strong' : 'border-gray-200 bg-gray-50'}`}>
              <div className={`text-[10px] font-bold uppercase tracking-wide ${isDesktopStyle ? 'ss-text-muted' : 'text-gray-500'}`}>
                Active Project
              </div>
              <div className="mt-1 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <h1 className={`text-2xl font-bold tracking-tight ${isDesktopStyle ? 'ss-text-primary' : 'text-gray-950'}`}>
                    {projectSummary.label}
                  </h1>
                  <p className={`mt-1 text-sm ${isDesktopStyle ? 'ss-text-secondary' : 'text-gray-500'}`}>
                    {projectSummary.mode === 'quick'
                      ? 'Temporary quick-calculation workspace'
                      : projectSummary.projectNumber || projectSummary.client
                        ? [projectSummary.projectNumber, projectSummary.client].filter(Boolean).join(' • ')
                        : 'Use Projects Home to select or create a project'}
                  </p>
                </div>

                <NavLink
                  to="/"
                  end
                  className={`inline-flex w-fit items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold ${
                    isDesktopStyle ? 'border-white/10 bg-white/10 text-white hover:bg-white/15' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <FolderOpen size={16} />
                  Switch Project
                </NavLink>
              </div>
            </div>
          )}

          <Outlet />
        </main>
      </div>
    </div>
  );
};
