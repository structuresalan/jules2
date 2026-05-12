import React, { useMemo, useState } from 'react';
import { Calculator, Clock3, FileText, FolderOpen, LogOut, Pencil, Plus, Save, Search, Trash2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import simplifyStructLogo from '../assets/simplifystruct-logo.png';
import { useAuth } from '../hooks/useAuth';

type ProjectStatus = 'Active' | 'On Hold' | 'Closed' | 'Archived';
type ProjectCalculationType = 'Mixed' | 'Steel' | 'Concrete' | 'Loads';

interface ProjectRecord {
  id: string;
  name: string;
  projectNumber: string;
  client: string;
  location: string;
  description: string;
  status: ProjectStatus;
  calculationType: ProjectCalculationType;
  createdAt: string;
  updatedAt: string;
  predictedEndDate?: string;
}

const STORAGE_KEY = 'struccalc.projects.v3';
const ACTIVE_PROJECT_KEY = 'struccalc.activeProject.v3';
const SESSION_MODE_KEY = 'struccalc.sessionMode.v3';

const makeProjectId = () => `project_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const readProjects = (): ProjectRecord[] => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ProjectRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveProjects = (projects: ProjectRecord[]) => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
};

const formatDateTime = (isoDate: string) => {
  if (!isoDate) return '-';

  try {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(isoDate));
  } catch {
    return isoDate;
  }
};

export const ProjectHome: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [projects, setProjects] = useState<ProjectRecord[]>(readProjects);
  const [selectedMode, setSelectedMode] = useState<'new' | 'existing'>('new');
  const [searchText, setSearchText] = useState('');

  const [projectName, setProjectName] = useState('');
  const [projectNumber, setProjectNumber] = useState('');
  const [client, setClient] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [calculationType, setCalculationType] = useState<ProjectCalculationType>('Mixed');
  const [predictedEndDate, setPredictedEndDate] = useState('');
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editProjectNumber, setEditProjectNumber] = useState('');
  const [editStatus, setEditStatus] = useState<ProjectStatus>('Active');
  const [editPredictedEndDate, setEditPredictedEndDate] = useState('');

  const filteredProjects = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) return projects;

    return projects.filter((project) => {
      const searchableText = [
        project.name,
        project.projectNumber,
        project.client,
        project.location,
        project.status,
        project.calculationType,
      ].join(' ').toLowerCase();

      return searchableText.includes(query);
    });
  }, [projects, searchText]);

  const storeProjects = (nextProjects: ProjectRecord[]) => {
    setProjects(nextProjects);
    saveProjects(nextProjects);
  };

  const openProject = (project: ProjectRecord) => {
    const updatedProject = { ...project, updatedAt: new Date().toISOString() };
    const nextProjects = projects.map((item) => (item.id === project.id ? updatedProject : item));
    storeProjects(nextProjects);
    window.localStorage.setItem(ACTIVE_PROJECT_KEY, updatedProject.id);
    window.localStorage.setItem(SESSION_MODE_KEY, 'project');
    navigate('/dashboard');
  };

  const deleteProject = (projectId: string) => {
    const nextProjects = projects.filter((project) => project.id !== projectId);
    storeProjects(nextProjects);

    if (window.localStorage.getItem(ACTIVE_PROJECT_KEY) === projectId) {
      window.localStorage.removeItem(ACTIVE_PROJECT_KEY);
    }
  };

  const createProject = (event: React.FormEvent) => {
    event.preventDefault();
    if (!projectName.trim()) return;

    const now = new Date().toISOString();
    const project: ProjectRecord = {
      id: makeProjectId(),
      name: projectName.trim(),
      projectNumber: projectNumber.trim() || `P-${new Date().getFullYear()}-${String(projects.length + 1).padStart(3, '0')}`,
      client: client.trim(),
      location: location.trim(),
      description: description.trim(),
      status: 'Active',
      calculationType,
      createdAt: now,
      updatedAt: now,
      predictedEndDate: predictedEndDate || '',
    };

    storeProjects([project, ...projects]);
    window.localStorage.setItem(ACTIVE_PROJECT_KEY, project.id);
    window.localStorage.setItem(SESSION_MODE_KEY, 'project');
    navigate('/dashboard');
  };

  const startEditProject = (project: ProjectRecord) => {
    setEditingProjectId(project.id);
    setEditProjectNumber(project.projectNumber);
    setEditStatus(project.status);
    setEditPredictedEndDate(project.predictedEndDate || '');
  };

  const cancelEditProject = () => {
    setEditingProjectId(null);
    setEditProjectNumber('');
    setEditStatus('Active');
    setEditPredictedEndDate('');
  };

  const saveProjectEdit = (projectId: string) => {
    const nextProjects = projects.map((project) => {
      if (project.id !== projectId) return project;

      return {
        ...project,
        projectNumber: editProjectNumber.trim() || project.projectNumber,
        status: editStatus,
        predictedEndDate: editStatus === 'Active' ? editPredictedEndDate : '',
        updatedAt: new Date().toISOString(),
      };
    });

    storeProjects(nextProjects);
    cancelEditProject();
  };

  const startQuickCalculations = () => {
    window.localStorage.removeItem(ACTIVE_PROJECT_KEY);
    window.localStorage.setItem(SESSION_MODE_KEY, 'quick');
    navigate('/dashboard');
  };

  const handleSignOut = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-8 text-gray-900">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-4 border-b border-gray-200 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-4">
              <img src={simplifyStructLogo} alt="SimplifyStruct logo" className="h-12 w-auto rounded-md bg-white object-contain" />
              <div>
                <h1 className="text-3xl font-bold tracking-tight">SimplifyStruct Projects</h1>
                <p className="text-sm text-gray-500">Create a project, open saved work, or run a quick calculation.</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="text-right text-xs text-gray-500">
              <div className="font-semibold text-gray-700">{user?.email}</div>
              <div>Signed in</div>
            </div>
            <button
              onClick={startQuickCalculations}
              className="inline-flex w-fit items-center gap-2 rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"
            >
              <Calculator size={18} />
              Quick Calculations
            </button>
            <button
              onClick={handleSignOut}
              className="inline-flex w-fit items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              <LogOut size={18} />
              Sign Out
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <button
            onClick={() => setSelectedMode('new')}
            className={`rounded-xl border p-5 text-left shadow-sm transition ${selectedMode === 'new' ? 'border-blue-500 bg-white ring-2 ring-blue-100' : 'border-gray-200 bg-white hover:border-gray-300'}`}
          >
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Plus size={22} />
            </div>
            <h2 className="text-lg font-semibold">New Project</h2>
            <p className="mt-2 text-sm text-gray-500">Create a saved project that will appear in Existing Projects next time you open the site.</p>
          </button>

          <button
            onClick={() => setSelectedMode('existing')}
            className={`rounded-xl border p-5 text-left shadow-sm transition ${selectedMode === 'existing' ? 'border-blue-500 bg-white ring-2 ring-blue-100' : 'border-gray-200 bg-white hover:border-gray-300'}`}
          >
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-gray-100 text-gray-700">
              <FolderOpen size={22} />
            </div>
            <h2 className="text-lg font-semibold">Existing Project</h2>
            <p className="mt-2 text-sm text-gray-500">Open a saved project from a details-style project list.</p>
          </button>
        </div>

        <main className="mt-6">
          {selectedMode === 'new' && (
            <form onSubmit={createProject} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-6 flex items-start gap-3">
                <FileText className="mt-1 text-blue-600" size={22} />
                <div>
                  <h2 className="text-xl font-semibold">Create a new project</h2>
                  <p className="mt-1 text-sm text-gray-500">Enter basic details now. You can refine the project later.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="text-sm font-medium text-gray-700">
                  Project name
                  <input
                    value={projectName}
                    onChange={(event) => setProjectName(event.target.value)}
                    className="mt-1 w-full rounded-md border border-gray-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    placeholder="Example: Office Building Framing"
                    required
                  />
                </label>

                <label className="text-sm font-medium text-gray-700">
                  Project number
                  <input
                    value={projectNumber}
                    onChange={(event) => setProjectNumber(event.target.value)}
                    className="mt-1 w-full rounded-md border border-gray-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    placeholder="Auto-filled if left blank"
                  />
                </label>

                <label className="text-sm font-medium text-gray-700">
                  Predicted end date
                  <input
                    type="date"
                    value={predictedEndDate}
                    onChange={(event) => setPredictedEndDate(event.target.value)}
                    className="mt-1 w-full rounded-md border border-gray-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </label>

                <label className="text-sm font-medium text-gray-700">
                  Client
                  <input
                    value={client}
                    onChange={(event) => setClient(event.target.value)}
                    className="mt-1 w-full rounded-md border border-gray-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    placeholder="Client name"
                  />
                </label>

                <label className="text-sm font-medium text-gray-700">
                  Location
                  <input
                    value={location}
                    onChange={(event) => setLocation(event.target.value)}
                    className="mt-1 w-full rounded-md border border-gray-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    placeholder="City, State"
                  />
                </label>

                <label className="text-sm font-medium text-gray-700">
                  Calculation focus
                  <select
                    value={calculationType}
                    onChange={(event) => setCalculationType(event.target.value as ProjectCalculationType)}
                    className="mt-1 w-full rounded-md border border-gray-300 bg-white p-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    <option>Mixed</option>
                    <option>Steel</option>
                    <option>Concrete</option>
                    <option>Loads</option>
                  </select>
                </label>

                <label className="text-sm font-medium text-gray-700 md:col-span-2">
                  Notes / description
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    className="mt-1 min-h-24 w-full rounded-md border border-gray-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    placeholder="Optional project notes"
                  />
                </label>
              </div>

              <div className="mt-6 flex justify-end border-t border-gray-100 pt-5">
                <button
                  type="submit"
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!projectName.trim()}
                >
                  Save Project & Open
                </button>
              </div>
            </form>
          )}

          {selectedMode === 'existing' && (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-gray-200 p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Existing projects</h2>
                  <p className="mt-1 text-sm text-gray-500">Details view, similar to a file explorer list.</p>
                </div>

                <label className="relative w-full md:w-80">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                    className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    placeholder="Search projects..."
                  />
                </label>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-[980px] w-full border-collapse text-sm">
                  <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="border-b border-gray-200 px-4 py-3">Name</th>
                      <th className="border-b border-gray-200 px-4 py-3">Project No.</th>
                      <th className="border-b border-gray-200 px-4 py-3">Client</th>
                      <th className="border-b border-gray-200 px-4 py-3">Location</th>
                      <th className="border-b border-gray-200 px-4 py-3">Type</th>
                      <th className="border-b border-gray-200 px-4 py-3">Status</th>
                      <th className="border-b border-gray-200 px-4 py-3">Predicted End</th>
                      <th className="border-b border-gray-200 px-4 py-3">Created</th>
                      <th className="border-b border-gray-200 px-4 py-3">Last Modified</th>
                      <th className="border-b border-gray-200 px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProjects.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-4 py-10 text-center text-gray-500">
                          {projects.length === 0 ? 'No saved projects yet. Create a new project to see it here.' : 'No projects match your search.'}
                        </td>
                      </tr>
                    ) : (
                      filteredProjects.map((project) => (
                        <tr key={project.id} className="hover:bg-blue-50/50">
                          <td className="border-b border-gray-100 px-4 py-3">
                            <div className="font-semibold text-gray-900">{project.name}</div>
                            {project.description && <div className="mt-1 max-w-xs truncate text-xs text-gray-500">{project.description}</div>}
                          </td>
                          <td className="border-b border-gray-100 px-4 py-3 font-mono text-xs text-gray-700">
                            {editingProjectId === project.id ? (
                              <input
                                value={editProjectNumber}
                                onChange={(event) => setEditProjectNumber(event.target.value)}
                                className="w-28 rounded border border-gray-300 px-2 py-1 text-xs"
                              />
                            ) : (
                              project.projectNumber
                            )}
                          </td>
                          <td className="border-b border-gray-100 px-4 py-3 text-gray-700">{project.client || '-'}</td>
                          <td className="border-b border-gray-100 px-4 py-3 text-gray-700">{project.location || '-'}</td>
                          <td className="border-b border-gray-100 px-4 py-3 text-gray-700">{project.calculationType}</td>
                          <td className="border-b border-gray-100 px-4 py-3">
                            {editingProjectId === project.id ? (
                              <select
                                value={editStatus}
                                onChange={(event) => setEditStatus(event.target.value as ProjectStatus)}
                                className="rounded border border-gray-300 bg-white px-2 py-1 text-xs"
                              >
                                <option>Active</option>
                                <option>On Hold</option>
                                <option>Closed</option>
                                <option>Archived</option>
                              </select>
                            ) : (
                              <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                                project.status === 'Active'
                                  ? 'bg-green-50 text-green-700'
                                  : project.status === 'Closed'
                                    ? 'bg-gray-100 text-gray-700'
                                    : project.status === 'On Hold'
                                      ? 'bg-amber-50 text-amber-700'
                                      : 'bg-slate-100 text-slate-600'
                              }`}>
                                {project.status}
                              </span>
                            )}
                          </td>
                          <td className="border-b border-gray-100 px-4 py-3 text-xs text-gray-600">
                            {editingProjectId === project.id ? (
                              <input
                                type="date"
                                value={editPredictedEndDate}
                                onChange={(event) => setEditPredictedEndDate(event.target.value)}
                                disabled={editStatus !== 'Active'}
                                className="rounded border border-gray-300 px-2 py-1 text-xs disabled:bg-gray-100 disabled:text-gray-400"
                              />
                            ) : (
                              project.status === 'Active' && project.predictedEndDate ? project.predictedEndDate : '-'
                            )}
                          </td>
                          <td className="border-b border-gray-100 px-4 py-3 text-xs text-gray-600">{formatDateTime(project.createdAt)}</td>
                          <td className="border-b border-gray-100 px-4 py-3 text-xs text-gray-600">
                            <div className="flex items-center gap-1">
                              <Clock3 size={13} className="text-gray-400" />
                              {formatDateTime(project.updatedAt)}
                            </div>
                          </td>
                          <td className="border-b border-gray-100 px-4 py-3">
                            <div className="flex justify-end gap-2">
                              {editingProjectId === project.id ? (
                                <>
                                  <button
                                    onClick={() => saveProjectEdit(project.id)}
                                    className="rounded border border-green-200 bg-green-50 p-1.5 text-green-700 hover:bg-green-100"
                                    title="Save project changes"
                                  >
                                    <Save size={15} />
                                  </button>
                                  <button
                                    onClick={cancelEditProject}
                                    className="rounded border border-gray-200 bg-white p-1.5 text-gray-500 hover:bg-gray-50"
                                    title="Cancel editing"
                                  >
                                    <X size={15} />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => openProject(project)}
                                    className="rounded border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                                  >
                                    Open
                                  </button>
                                  <button
                                    onClick={() => startEditProject(project)}
                                    className="rounded border border-gray-200 bg-white p-1.5 text-gray-600 hover:bg-gray-50"
                                    title="Edit project"
                                  >
                                    <Pencil size={15} />
                                  </button>
                                  <button
                                    onClick={() => deleteProject(project.id)}
                                    className="rounded border border-gray-200 bg-white p-1.5 text-gray-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                                    title="Delete project"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-4 py-3 text-sm text-gray-500">
                <span>{filteredProjects.length} project{filteredProjects.length === 1 ? '' : 's'} shown</span>
                <button onClick={() => setSelectedMode('new')} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
                  New Project
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
