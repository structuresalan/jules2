import React, { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type ProjectStatus = 'Active' | 'On Hold' | 'Archived';
export type ProjectCalculationType = 'Mixed' | 'Steel' | 'Concrete' | 'Loads';
export type ProjectSessionMode = 'project' | 'quick';

export interface ProjectRecord {
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
}

export interface NewProjectInput {
  name: string;
  projectNumber?: string;
  client?: string;
  location?: string;
  description?: string;
  calculationType?: ProjectCalculationType;
}

interface ProjectsContextType {
  projects: ProjectRecord[];
  activeProject: ProjectRecord | null;
  sessionMode: ProjectSessionMode;
  createProject: (input: NewProjectInput) => ProjectRecord;
  openProject: (projectId: string) => void;
  deleteProject: (projectId: string) => void;
  updateProject: (projectId: string, patch: Partial<Omit<ProjectRecord, 'id' | 'createdAt'>>) => void;
  startQuickCalculation: () => void;
  clearActiveProject: () => void;
}

const PROJECTS_STORAGE_KEY = 'struccalc.projects.v1';
const ACTIVE_PROJECT_STORAGE_KEY = 'struccalc.activeProjectId.v1';
const SESSION_MODE_STORAGE_KEY = 'struccalc.sessionMode.v1';

const makeProjectId = () => `project_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const readProjectsFromStorage = (): ProjectRecord[] => {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(PROJECTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ProjectRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('Unable to read saved projects', error);
    return [];
  }
};

const readStringFromStorage = (key: string, fallback: string) => {
  if (typeof window === 'undefined') return fallback;
  return window.localStorage.getItem(key) ?? fallback;
};

const writeStringToStorage = (key: string, value: string) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, value);
};

const writeProjectsToStorage = (projects: ProjectRecord[]) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
};

const ProjectsContext = createContext<ProjectsContextType | undefined>(undefined);

export const ProjectsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [projects, setProjects] = useState<ProjectRecord[]>(readProjectsFromStorage);
  const [activeProjectId, setActiveProjectId] = useState(() => readStringFromStorage(ACTIVE_PROJECT_STORAGE_KEY, ''));
  const [sessionMode, setSessionMode] = useState<ProjectSessionMode>(() => {
    const stored = readStringFromStorage(SESSION_MODE_STORAGE_KEY, 'project');
    return stored === 'quick' ? 'quick' : 'project';
  });

  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId) ?? null,
    [projects, activeProjectId],
  );

  const saveProjects = (nextProjects: ProjectRecord[]) => {
    setProjects(nextProjects);
    writeProjectsToStorage(nextProjects);
  };

  const setActiveProject = (projectId: string) => {
    setActiveProjectId(projectId);
    setSessionMode('project');
    writeStringToStorage(ACTIVE_PROJECT_STORAGE_KEY, projectId);
    writeStringToStorage(SESSION_MODE_STORAGE_KEY, 'project');
  };

  const createProject = (input: NewProjectInput) => {
    const now = new Date().toISOString();
    const project: ProjectRecord = {
      id: makeProjectId(),
      name: input.name.trim(),
      projectNumber: input.projectNumber?.trim() || `P-${new Date().getFullYear()}-${String(projects.length + 1).padStart(3, '0')}`,
      client: input.client?.trim() || '',
      location: input.location?.trim() || '',
      description: input.description?.trim() || '',
      calculationType: input.calculationType ?? 'Mixed',
      status: 'Active',
      createdAt: now,
      updatedAt: now,
    };

    const nextProjects = [project, ...projects];
    saveProjects(nextProjects);
    setActiveProject(project.id);
    return project;
  };

  const openProject = (projectId: string) => {
    const now = new Date().toISOString();
    const nextProjects = projects.map((project) =>
      project.id === projectId ? { ...project, updatedAt: now } : project,
    );

    saveProjects(nextProjects);
    setActiveProject(projectId);
  };

  const updateProject = (projectId: string, patch: Partial<Omit<ProjectRecord, 'id' | 'createdAt'>>) => {
    const now = new Date().toISOString();
    const nextProjects = projects.map((project) =>
      project.id === projectId ? { ...project, ...patch, updatedAt: now } : project,
    );

    saveProjects(nextProjects);
  };

  const deleteProject = (projectId: string) => {
    const nextProjects = projects.filter((project) => project.id !== projectId);
    saveProjects(nextProjects);

    if (activeProjectId === projectId) {
      setActiveProjectId('');
      writeStringToStorage(ACTIVE_PROJECT_STORAGE_KEY, '');
    }
  };

  const startQuickCalculation = () => {
    setSessionMode('quick');
    setActiveProjectId('');
    writeStringToStorage(SESSION_MODE_STORAGE_KEY, 'quick');
    writeStringToStorage(ACTIVE_PROJECT_STORAGE_KEY, '');
  };

  const clearActiveProject = () => {
    setActiveProjectId('');
    setSessionMode('project');
    writeStringToStorage(ACTIVE_PROJECT_STORAGE_KEY, '');
    writeStringToStorage(SESSION_MODE_STORAGE_KEY, 'project');
  };

  return (
    <ProjectsContext.Provider
      value={{
        projects,
        activeProject,
        sessionMode,
        createProject,
        openProject,
        deleteProject,
        updateProject,
        startQuickCalculation,
        clearActiveProject,
      }}
    >
      {children}
    </ProjectsContext.Provider>
  );
};

export const useProjects = () => {
  const context = useContext(ProjectsContext);
  if (!context) {
    throw new Error('useProjects must be used within a ProjectsProvider');
  }
  return context;
};
