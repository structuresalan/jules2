export interface ReportHeaderInfo {
  project: string;
  jobRef: string;
  sectionName: string;
  sheetNumber: string;
  calcBy: string;
  checkedBy: string;
  approvedBy: string;
  date: string;
}

const REPORT_HEADER_DEFAULTS_KEY = 'simplifystruct.reportHeaderDefaults.v1';

export const getBlankReportHeader = (): ReportHeaderInfo => ({
  project: '',
  jobRef: '',
  sectionName: '',
  sheetNumber: '1',
  calcBy: '',
  checkedBy: '',
  approvedBy: '',
  date: new Date().toISOString().slice(0, 10),
});

export const readReportHeaderDefaults = (): Partial<ReportHeaderInfo> => {
  if (typeof window === 'undefined') return {};

  try {
    const raw = window.localStorage.getItem(REPORT_HEADER_DEFAULTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<ReportHeaderInfo>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

export const saveReportHeaderDefaults = (header: ReportHeaderInfo) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(REPORT_HEADER_DEFAULTS_KEY, JSON.stringify(header));
};
