import React, { useEffect, useMemo, useState } from 'react';
import {
  Copy,
  ExternalLink,
  FileText,
  Map,
  Pencil,
  Printer,
  Search,
  Trash2,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import {
  deleteProjectDocument,
  duplicateProjectDocument,
  formatDocumentDate,
  getActiveProject,
  getProjectDocuments,
  renameProjectDocument,
  requestOpenProjectDocument,
  type ProjectDocument,
} from '../utils/projectDocuments';
import { useWebsiteStyleSettings } from '../utils/websiteStyle';

const beamPrintStyles = `
@media screen {
  .beam-print-report {
    display: none;
  }
}

@media print {
  body * {
    visibility: hidden !important;
  }

  .beam-print-report,
  .beam-print-report * {
    visibility: visible !important;
  }

  .beam-print-report {
    display: block !important;
    position: absolute !important;
    inset: 0 !important;
    width: 100% !important;
    background: white !important;
    color: black !important;
  }
}
`;

export const Documents: React.FC = () => {
  const navigate = useNavigate();
  const { isDesktopStyle } = useWebsiteStyleSettings();
  const activeProject = getActiveProject();

  const [documents, setDocuments] = useState<ProjectDocument[]>(() =>
    activeProject ? getProjectDocuments(activeProject.id) : [],
  );
  const [searchText, setSearchText] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [printDocument, setPrintDocument] = useState<ProjectDocument | null>(null);

  const refreshDocuments = () => {
    if (!activeProject) {
      setDocuments([]);
      return;
    }

    setDocuments(getProjectDocuments(activeProject.id));
  };

  useEffect(() => {
    refreshDocuments();
  }, [activeProject?.id]);

  useEffect(() => {
    if (!printDocument) return;

    const timeout = window.setTimeout(() => {
      window.print();
    }, 80);

    const afterPrint = () => setPrintDocument(null);
    window.addEventListener('afterprint', afterPrint);

    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener('afterprint', afterPrint);
    };
  }, [printDocument]);

  const filteredDocuments = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) return documents;

    return documents.filter((document) =>
      [
        document.name,
        document.type,
        document.module,
        document.status,
        document.sourcePath,
      ]
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }, [documents, searchText]);

  const startRename = (document: ProjectDocument) => {
    setRenamingId(document.id);
    setRenameValue(document.name);
  };

  const saveRename = () => {
    if (!renamingId || !renameValue.trim()) return;

    renameProjectDocument(renamingId, renameValue.trim());
    setRenamingId(null);
    setRenameValue('');
    refreshDocuments();
  };

  const handleOpen = (document: ProjectDocument) => {
    requestOpenProjectDocument(document.id);

    if (document.module === 'Steel') {
      navigate('/steel');
      return;
    }

    navigate(document.sourcePath || '/dashboard');
  };

  const handleDelete = (documentId: string) => {
    deleteProjectDocument(documentId);
    refreshDocuments();
  };

  const handleDuplicate = (documentId: string) => {
    duplicateProjectDocument(documentId);
    refreshDocuments();
  };

  if (!activeProject) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        <h1 className="text-xl font-bold">No active project</h1>
        <p className="mt-2 text-sm">Go back to Projects and open a project before viewing documents.</p>
        <Link to="/" className="mt-4 inline-flex rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white">
          Open Projects
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <style>{beamPrintStyles}</style>
      {printDocument && (
        <div className="beam-print-report" dangerouslySetInnerHTML={{ __html: printDocument.reportHtml }} />
      )}

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className={`flex items-center gap-3 text-3xl font-bold tracking-tight ${isDesktopStyle ? 'text-white' : 'text-gray-900'}`}>
            <FileText className="text-blue-600" />
            Documents
          </h1>
          <p className={`mt-2 ${isDesktopStyle ? 'text-slate-300' : 'text-gray-500'}`}>
            Saved calculation reports, print outputs, and exports for <span className={isDesktopStyle ? 'font-semibold text-white' : 'font-semibold text-gray-800'}>{activeProject.name}</span>.
          </p>
        </div>

        <div className="flex flex-col gap-2 md:flex-row">
          <label className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              className="w-full rounded-xl border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              placeholder="Search documents..."
            />
          </label>
          <Link
            to="/visual-workspace"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
          >
            <Map size={16} />
            Open Visual Workspace
          </Link>
        </div>
      </div>

      <div className={`rounded-3xl border p-4 ${isDesktopStyle ? 'ss-glass text-slate-200' : 'border-blue-100 bg-blue-50 text-blue-900'}`}>
        <div className="flex items-start gap-3">
          <Map className="mt-0.5 text-blue-600" size={18} />
          <div>
            <div className="font-bold">Visual Map moved to Visual Workspace</div>
            <p className="mt-1 text-sm opacity-80">
              Plans, site photos, PDF annotation tools, measurements, markers, nodes, schedules, and cost links now live in Visual Workspace. Documents is only for saved reports and calculation outputs.
            </p>
          </div>
        </div>
      </div>

      <section className={`overflow-hidden rounded-3xl border ${isDesktopStyle ? 'ss-glass-strong' : 'border-gray-200 bg-white shadow-sm'}`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className={isDesktopStyle ? 'bg-slate-900 text-slate-300' : 'bg-gray-50 text-gray-500'}>
              <tr>
                <th className="px-4 py-3 text-left">Document</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Module</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocuments.length === 0 && (
                <tr>
                  <td colSpan={6} className={`px-4 py-10 text-center ${isDesktopStyle ? 'text-slate-400' : 'text-gray-500'}`}>
                    No documents found. Save a calculation output from one of the calculation modules.
                  </td>
                </tr>
              )}

              {filteredDocuments.map((document) => (
                <tr key={document.id} className={isDesktopStyle ? 'border-t border-white/10 hover:bg-white/5' : 'border-t border-gray-100 hover:bg-blue-50/50'}>
                  <td className="px-4 py-3">
                    {renamingId === document.id ? (
                      <div className="flex gap-2">
                        <input
                          value={renameValue}
                          onChange={(event) => setRenameValue(event.target.value)}
                          className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                        />
                        <button onClick={saveRename} className="rounded bg-blue-600 px-2 py-1 text-xs font-semibold text-white">
                          Save
                        </button>
                      </div>
                    ) : (
                      <div className={isDesktopStyle ? 'font-semibold text-white' : 'font-semibold text-gray-900'}>{document.name}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">{document.type}</td>
                  <td className="px-4 py-3">{document.module}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-green-50 px-2 py-1 text-xs font-semibold text-green-700">{document.status}</span>
                  </td>
                  <td className="px-4 py-3 text-xs opacity-75">{formatDocumentDate(document.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-2">
                      <button onClick={() => handleOpen(document)} className="inline-flex items-center gap-1 rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100">
                        <ExternalLink size={13} />
                        Open
                      </button>
                      <button onClick={() => setPrintDocument(document)} className="inline-flex items-center gap-1 rounded border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                        <Printer size={13} />
                        Print
                      </button>
                      <button onClick={() => startRename(document)} className="inline-flex items-center gap-1 rounded border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                        <Pencil size={13} />
                        Rename
                      </button>
                      <button onClick={() => handleDuplicate(document.id)} className="inline-flex items-center gap-1 rounded border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                        <Copy size={13} />
                        Duplicate
                      </button>
                      <button onClick={() => handleDelete(document.id)} className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-100">
                        <Trash2 size={13} />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
