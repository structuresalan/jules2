export type ProjectDocumentModule = 'Steel' | 'Concrete' | 'Loads' | 'Variables' | 'General';
export type ProjectDocumentStatus = 'Active' | 'Draft' | 'Archived';

export interface ProjectDocument {
  id: string;
  projectId: string;
  name: string;
  type: string;
  module: ProjectDocumentModule;
  status: ProjectDocumentStatus;
  createdAt: string;
  updatedAt: string;
  sourcePath: string;
  inputs: Record<string, unknown>;
  summary: Record<string, string | number | boolean>;
  reportHtml: string;
}

export interface SavedProjectSummary {
  id: string;
  name: string;
  projectNumber?: string;
}

const PROJECTS_STORAGE_KEY = 'struccalc.projects.v3';
const ACTIVE_PROJECT_KEY = 'struccalc.activeProject.v3';
const SESSION_MODE_KEY = 'struccalc.sessionMode.v3';
const DOCUMENTS_STORAGE_KEY = 'struccalc.projectDocuments.v1';
const OPEN_DOCUMENT_STORAGE_KEY = 'struccalc.openDocument.v1';

const makeDocumentId = () => `doc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const safeParse = <T,>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

export const getSavedProjects = (): SavedProjectSummary[] => {
  if (typeof window === 'undefined') return [];
  const projects = safeParse<Array<{ id: string; name: string; projectNumber?: string }>>(
    window.localStorage.getItem(PROJECTS_STORAGE_KEY),
    [],
  );

  return projects.map((project) => ({
    id: project.id,
    name: project.name,
    projectNumber: project.projectNumber,
  }));
};

export const getActiveProjectId = () => {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(ACTIVE_PROJECT_KEY) ?? '';
};

export const getSessionMode = () => {
  if (typeof window === 'undefined') return 'project';
  return window.localStorage.getItem(SESSION_MODE_KEY) ?? 'project';
};

export const getActiveProject = () => {
  const activeProjectId = getActiveProjectId();
  if (!activeProjectId) return null;

  return getSavedProjects().find((project) => project.id === activeProjectId) ?? null;
};

export const getAllProjectDocuments = (): ProjectDocument[] => {
  if (typeof window === 'undefined') return [];
  return safeParse<ProjectDocument[]>(window.localStorage.getItem(DOCUMENTS_STORAGE_KEY), []);
};

export const writeAllProjectDocuments = (documents: ProjectDocument[]) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DOCUMENTS_STORAGE_KEY, JSON.stringify(documents));
};

export const getProjectDocuments = (projectId: string) => {
  return getAllProjectDocuments()
    .filter((document) => document.projectId === projectId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
};

export const getDocumentById = (documentId: string) => {
  return getAllProjectDocuments().find((document) => document.id === documentId) ?? null;
};

const normalizeDocumentName = (name: string) => name.trim().replace(/\s+/g, ' ') || 'Untitled Document';

const stripTrailingCopyNumber = (name: string) => name.replace(/\s+\(\d+\)$/u, '').trim();

export const getUniqueProjectDocumentName = (
  projectId: string,
  requestedName: string,
  excludeDocumentId = '',
) => {
  const baseName = stripTrailingCopyNumber(normalizeDocumentName(requestedName));
  const documents = getAllProjectDocuments().filter(
    (document) => document.projectId === projectId && document.id !== excludeDocumentId,
  );
  const usedNames = new Set(documents.map((document) => document.name.trim().toLowerCase()));

  if (!usedNames.has(baseName.toLowerCase())) return baseName;

  let index = 1;
  let candidate = `${baseName} (${index})`;

  while (usedNames.has(candidate.toLowerCase())) {
    index += 1;
    candidate = `${baseName} (${index})`;
  }

  return candidate;
};

export const saveNewProjectDocument = (
  document: Omit<ProjectDocument, 'id' | 'createdAt' | 'updatedAt'>,
) => {
  const now = new Date().toISOString();
  const uniqueName = getUniqueProjectDocumentName(document.projectId, document.name);
  const newDocument: ProjectDocument = {
    ...document,
    name: uniqueName,
    id: makeDocumentId(),
    createdAt: now,
    updatedAt: now,
  };

  writeAllProjectDocuments([newDocument, ...getAllProjectDocuments()]);
  return newDocument;
};

export const overwriteProjectDocument = (
  documentId: string,
  patch: Omit<ProjectDocument, 'id' | 'createdAt' | 'updatedAt' | 'projectId'>,
) => {
  const documents = getAllProjectDocuments();
  const existingDocument = documents.find((document) => document.id === documentId);

  if (!existingDocument) return null;

  const updatedDocument: ProjectDocument = {
    ...existingDocument,
    ...patch,
    name: getUniqueProjectDocumentName(existingDocument.projectId, patch.name, documentId),
    updatedAt: new Date().toISOString(),
  };

  writeAllProjectDocuments(documents.map((document) => (document.id === documentId ? updatedDocument : document)));
  return updatedDocument;
};

export const renameProjectDocument = (documentId: string, name: string) => {
  const documents = getAllProjectDocuments();
  const existingDocument = documents.find((document) => document.id === documentId);
  if (!existingDocument) return;

  const uniqueName = getUniqueProjectDocumentName(existingDocument.projectId, name, documentId);

  writeAllProjectDocuments(
    documents.map((document) =>
      document.id === documentId ? { ...document, name: uniqueName, updatedAt: new Date().toISOString() } : document,
    ),
  );
};

export const deleteProjectDocument = (documentId: string) => {
  writeAllProjectDocuments(getAllProjectDocuments().filter((document) => document.id !== documentId));
};

export const duplicateProjectDocument = (documentId: string) => {
  const document = getDocumentById(documentId);
  if (!document) return null;

  return saveNewProjectDocument({
    ...document,
    name: `${document.name} Copy`,
  });
};

export const formatDocumentDate = (isoDate: string) => {
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

export const printProjectDocumentPdf = (document: ProjectDocument) => {
  const printWindow = window.open('', '_blank', 'noopener,noreferrer');

  if (!printWindow) {
    window.print();
    return;
  }

  printWindow.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${document.name}</title>
  <style>
    @page { size: letter; margin: 0.35in; }
    body { font-family: Arial, Helvetica, sans-serif; margin: 0; color: #111827; background: white; }
    .document-meta { margin-bottom: 18px; padding: 12px; border: 1px solid #111827; background: #f9fafb; }
    .document-meta h1 { margin: 0 0 8px; font-size: 22px; }
    .document-meta-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; font-size: 11px; }
    .print-hint { margin-top: 10px; font-size: 10px; color: #4b5563; }
    @media print {
      .no-print { display: none !important; }
      body { margin: 0; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="padding:12px; border-bottom:1px solid #d1d5db; margin-bottom:16px;">
    <button onclick="window.print()" style="padding:8px 12px; font-weight:700;">Print / Save as PDF</button>
    <span style="margin-left:8px; font-size:12px; color:#4b5563;">Choose “Save as PDF” in the print dialog.</span>
  </div>
  <div class="document-meta">
    <h1>${document.name}</h1>
    <div class="document-meta-grid">
      <div><strong>Type:</strong> ${document.type}</div>
      <div><strong>Module:</strong> ${document.module}</div>
      <div><strong>Saved:</strong> ${formatDocumentDate(document.updatedAt)}</div>
    </div>
  </div>
  ${document.reportHtml}
</body>
</html>`);

  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 250);
};


export const requestOpenProjectDocument = (documentId: string) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(OPEN_DOCUMENT_STORAGE_KEY, documentId);
};

export const consumeOpenProjectDocumentRequest = () => {
  if (typeof window === 'undefined') return null;

  const documentId = window.localStorage.getItem(OPEN_DOCUMENT_STORAGE_KEY);
  if (!documentId) return null;

  window.localStorage.removeItem(OPEN_DOCUMENT_STORAGE_KEY);
  return getDocumentById(documentId);
};
