import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Download, Plus, Printer, Save, Trash2, X } from 'lucide-react';
import seedShapesData from '../data/aisc/shapes_w.json';
import aiscData from '../data/aisc/code_factors.json';
import simplifyStructLogo from '../assets/simplifystruct-logo.png';
import { consumeOpenProjectDocumentRequest, getActiveProject, getProjectDocuments, getSessionMode, overwriteProjectDocument, saveNewProjectDocument, type ProjectDocument } from '../utils/projectDocuments';
import { readReportHeaderDefaults, saveReportHeaderDefaults, type ReportHeaderInfo } from '../utils/reportHeaderDefaults';

type SupportType = 'None' | 'Pinned' | 'Roller' | 'Fixed';
type LoadType = 'Point' | 'Line' | 'Area';
type LoadDirection = 'Down' | 'Up';
type DegreeOfFreedom = 'Free' | 'Fixed' | 'Spring';
type LoadCase = 'D' | 'L' | 'S' | 'W';
type DesignMethod = 'LRFD' | 'ASD';
type DisplayKey = 'loading' | 'moment' | 'shear' | 'deflection';
type BeamPanel = 'Design options' | 'Nodes' | 'Loading' | 'Combinations' | 'Deflection criteria' | 'Output options';
type MemberType = '~' | 'Beam' | 'Girder' | 'Joist' | 'Lintel' | 'Other';
type MaterialType = '~' | 'Hot Rolled Steel' | 'Cold Formed Steel' | 'Built-up Steel' | 'Other';
type DesignRule = '~' | 'Typical' | 'Conservative' | 'Custom';
type SwayOption = '~' | 'No' | 'Yes';
type SeismicDesignRule = '~' | 'None' | 'AISC Seismic' | 'Project Specific';
type ReportHeaderSaveScope = 'document' | 'default';

interface SteelShape {
  EDI_Std_Nomenclature?: string;
  AISC_Manual_Label?: string;
  Type?: string;
  W?: number;
  A: number;
  d?: number;
  bf?: number;
  tw?: number;
  tf?: number;
  t?: number;
  Ix?: number;
  Zx: number;
  Sx?: number;
  rx?: number;
  Iy?: number;
  Zy?: number;
  Sy?: number;
  ry?: number;
  J?: number;
  Cw?: number;
}



const optionalDisplay = (value: string | number | null | undefined, suffix = '') => {
  if (value === null || value === undefined || value === '') return '~';
  return `${value}${suffix}`;
};

const optionalNumberInputValue = (value: number | null) => value ?? '';

const parseOptionalNumber = (value: string) => {
  if (value.trim() === '') return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatOptionalNumber = (value: number | null, decimals = 2, suffix = '') => {
  if (value === null) return '~';

  return `${value.toFixed(decimals)}${suffix}`;
};

interface BeamNode {
  id: string;
  x: number;
  z: number;
  support: SupportType;
  dofX: DegreeOfFreedom;
  dofZ: DegreeOfFreedom;
  dofRotation: DegreeOfFreedom;
  label: string;
  coordinateSystemName: string;
  coordinateSystemAngle: number;
  springX: number;
  springZ: number;
  springRotation: number;
}

interface BeamLoad {
  id: string;
  type: LoadType;
  loadCase: LoadCase;
  fromNodeId: string;
  toNodeId: string;
  magnitude: number;
  tributaryWidth: number;
  direction: LoadDirection;
}

interface PointLoadAnalysis {
  x: number;
  p: number;
  label: string;
}

interface DistributedLoadAnalysis {
  x1: number;
  x2: number;
  w: number;
  label: string;
}

const seedShapes = seedShapesData as Record<string, SteelShape>;
const seedShapeNames = Object.keys(seedShapes);
const AISC_SHAPES_CSV_URL = 'https://raw.githubusercontent.com/ambaker1/aisc-csv/main/v15.0/Shapes-US.csv';

const preferredShapeTypeOrder = ['W', 'M', 'S', 'HP', 'C', 'MC', 'WT', 'MT', 'ST', 'L', '2L', 'HSS', 'PIPE'];

const normalizeShapeName = (value: string) => value.replace(/\s+/g, '').toUpperCase();

const shapeSearchScore = (name: string, search: string) => {
  const normalizedName = normalizeShapeName(name);
  const normalizedSearch = normalizeShapeName(search);

  if (!normalizedSearch) return 0;
  if (normalizedName === normalizedSearch) return 1;
  if (normalizedName.startsWith(`${normalizedSearch}X`)) return 2;
  if (normalizedName.startsWith(normalizedSearch)) return 3;
  if (normalizedName.includes(normalizedSearch)) return 4;

  return 99;
};

const parseSteelNumber = (value: string | undefined) => {
  if (!value) return undefined;
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parseCsvLine = (line: string) => {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
};

const parseAiscShapesCsv = (csv: string): Record<string, SteelShape> => {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const [headerLine, ...dataLines] = lines;
  if (!headerLine) return {};

  const headers = parseCsvLine(headerLine);
  const shapes: Record<string, SteelShape> = {};

  dataLines.forEach((line) => {
    const cells = parseCsvLine(line);
    const row = headers.reduce<Record<string, string>>((accumulator, header, index) => {
      accumulator[header] = cells[index] ?? '';
      return accumulator;
    }, {});

    const label = row.AISC_Manual_Label || row.EDI_Std_Nomenclature;
    if (!label) return;

    const sx = parseSteelNumber(row.Sx);
    const zx = parseSteelNumber(row.Zx) ?? sx ?? parseSteelNumber(row.Sy) ?? 1;

    shapes[label] = {
      EDI_Std_Nomenclature: row.EDI_Std_Nomenclature,
      AISC_Manual_Label: label,
      Type: row.Type || 'Other',
      W: parseSteelNumber(row.W),
      A: parseSteelNumber(row.A) ?? 1,
      d: parseSteelNumber(row.d) ?? parseSteelNumber(row.Ht) ?? parseSteelNumber(row.OD),
      bf: parseSteelNumber(row.bf) ?? parseSteelNumber(row.B),
      tw: parseSteelNumber(row.tw),
      tf: parseSteelNumber(row.tf),
      t: parseSteelNumber(row.t) ?? parseSteelNumber(row.tnom) ?? parseSteelNumber(row.tdes),
      Ix: parseSteelNumber(row.Ix),
      Zx: zx,
      Sx: sx,
      rx: parseSteelNumber(row.rx),
      Iy: parseSteelNumber(row.Iy),
      Zy: parseSteelNumber(row.Zy),
      Sy: parseSteelNumber(row.Sy),
      ry: parseSteelNumber(row.ry),
      J: parseSteelNumber(row.J),
      Cw: parseSteelNumber(row.Cw),
    };
  });

  return shapes;
};

const designPanels: BeamPanel[] = ['Design options', 'Nodes', 'Loading', 'Combinations', 'Deflection criteria', 'Output options'];

const makeId = () => Math.random().toString(36).slice(2, 9);

const fieldLabel = (label: string, required = false) => (
  <span>
    {label}{' '}
    {required ? (
      <span className="font-bold text-red-600" title="Required">*</span>
    ) : (
      <span className="font-normal text-gray-400">(optional)</span>
    )}
  </span>
);


const degreesFromSupport = (support: SupportType): Pick<BeamNode, 'dofX' | 'dofZ' | 'dofRotation'> => {
  if (support === 'Fixed') return { dofX: 'Fixed', dofZ: 'Fixed', dofRotation: 'Fixed' };
  if (support === 'Pinned') return { dofX: 'Fixed', dofZ: 'Fixed', dofRotation: 'Free' };
  if (support === 'Roller') return { dofX: 'Free', dofZ: 'Fixed', dofRotation: 'Free' };
  return { dofX: 'Free', dofZ: 'Free', dofRotation: 'Free' };
};

const supportFromDegrees = (node: Pick<BeamNode, 'dofX' | 'dofZ' | 'dofRotation'>): SupportType => {
  if (node.dofX === 'Fixed' && node.dofZ === 'Fixed' && node.dofRotation === 'Fixed') return 'Fixed';
  if (node.dofX === 'Fixed' && node.dofZ === 'Fixed') return 'Pinned';
  if (node.dofZ === 'Fixed') return 'Roller';
  return 'None';
};

const createNode = (x: number, support: SupportType = 'None'): BeamNode => ({
  id: makeId(),
  x,
  z: 0,
  support,
  ...degreesFromSupport(support),
  label: '',
  coordinateSystemName: '',
  coordinateSystemAngle: 0,
  springX: 0,
  springZ: 0,
  springRotation: 0,
});

const supportLabel = (support: SupportType) => {
  if (support === 'Pinned') return 'Pin';
  if (support === 'Roller') return 'Roller';
  if (support === 'Fixed') return 'Fixed';
  return 'Free';
};

const loadUnit = (load: BeamLoad) => {
  if (load.type === 'Point') return 'k';
  if (load.type === 'Line') return 'k/ft';
  return 'psf';
};

const loadToLineMagnitude = (load: BeamLoad) => {
  if (load.type === 'Area') return (load.magnitude * load.tributaryWidth) / 1000;
  return load.magnitude;
};

const formatRatio = (value: number) => (Number.isFinite(value) ? value.toFixed(3) : '0.000');

const formatAxisValue = (value: number) => {
  if (!Number.isFinite(value)) return '0';
  const absValue = Math.abs(value);
  if (absValue >= 100) return value.toFixed(0);
  if (absValue >= 10) return value.toFixed(1);
  return value.toFixed(2);
};


interface BeamModeler2DProps {
  aiscYear?: string;
}

export const BeamModeler2D: React.FC<BeamModeler2DProps> = ({ aiscYear = 'AISC 360-16' }) => {
  const activeAiscYear = Object.prototype.hasOwnProperty.call(aiscData, aiscYear) ? aiscYear : 'AISC 360-16';
  const [method, setMethod] = useState<DesignMethod>('LRFD');
  const [memberType, setMemberType] = useState<MemberType>('~');
  const [materialType, setMaterialType] = useState<MaterialType>('~');
  const [designRule, setDesignRule] = useState<DesignRule>('~');
  const [internalSections, setInternalSections] = useState(97);
  const [ky, setKy] = useState(1);
  const [kz, setKz] = useState(1);
  const [lbyy, setLbyy] = useState(20);
  const [lbzz, setLbzz] = useState(20);
  const [lCompTop, setLCompTop] = useState<number | null>(null);
  const [lCompBottom, setLCompBottom] = useState<number | null>(null);
  const [lTorque, setLTorque] = useState<number | null>(null);
  const [ySway, setYSway] = useState<SwayOption>('~');
  const [zSway, setZSway] = useState<SwayOption>('~');
  const [seismicDesignRule, setSeismicDesignRule] = useState<SeismicDesignRule>('~');
  const [section, setSection] = useState(seedShapeNames[1] ?? seedShapeNames[0] ?? 'W12X26');
  const [shapeDatabase, setShapeDatabase] = useState<Record<string, SteelShape>>(seedShapes);
  const [shapeTypeFilter, setShapeTypeFilter] = useState('~');
  const [shapeSearch, setShapeSearch] = useState('');
  const [shapeDatabaseSource, setShapeDatabaseSource] = useState('Seed W-shape database');
  const [shapeDatabaseError, setShapeDatabaseError] = useState('');
  const [fy, setFy] = useState(50);
  const [unbracedLength, setUnbracedLength] = useState(20);
  const [deflectionLimit, setDeflectionLimit] = useState(360);
  const [totalDeflectionLimit, setTotalDeflectionLimit] = useState(240);
  const [includeModel, setIncludeModel] = useState(true);
  const [includeCalculations, setIncludeCalculations] = useState(true);
  const [includeResults, setIncludeResults] = useState(true);
  const [includeSelfWeight, setIncludeSelfWeight] = useState(true);
  const [showOutputPreview, setShowOutputPreview] = useState(false);
  const [reportProject, setReportProject] = useState('');
  const [reportJobRef, setReportJobRef] = useState('');
  const [reportSectionName, setReportSectionName] = useState('Steel Beam');
  const [reportSheetNumber, setReportSheetNumber] = useState('1');
  const [reportCalcBy, setReportCalcBy] = useState('');
  const [reportCheckedBy, setReportCheckedBy] = useState('');
  const [reportApprovedBy, setReportApprovedBy] = useState('');
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10));
  const [reportHeaderSaveScope, setReportHeaderSaveScope] = useState<ReportHeaderSaveScope>('document');
  const [showSaveOutputModal, setShowSaveOutputModal] = useState(false);
  const [saveMode, setSaveMode] = useState<'new' | 'overwrite'>('new');
  const [documentName, setDocumentName] = useState('Steel Beam Design');
  const [selectedDocumentId, setSelectedDocumentId] = useState('');
  const [projectDocuments, setProjectDocuments] = useState<ProjectDocument[]>([]);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveSucceeded, setSaveSucceeded] = useState(false);
  const [diagramHover, setDiagramHover] = useState<{
    mode: 'moment' | 'shear' | 'deflection';
    x: number;
    y: number;
    svgX: number;
    svgY: number;
  } | null>(null);

  const [activePanel, setActivePanel] = useState<BeamPanel>('Design options');
  const [displayOptions, setDisplayOptions] = useState<Record<DisplayKey, boolean>>({
    loading: true,
    moment: true,
    shear: false,
    deflection: false,
  });

  const [loadFactors, setLoadFactors] = useState<Record<LoadCase, number>>({
    D: 1.2,
    L: 1.6,
    S: 1.0,
    W: 1.0,
  });

  const [nodes, setNodes] = useState<BeamNode[]>([
    createNode(0, 'Pinned'),
    createNode(30, 'Roller'),
  ]);

  const [loads, setLoads] = useState<BeamLoad[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [editingDocumentId, setEditingDocumentId] = useState('');
  const [loadedDocumentName, setLoadedDocumentName] = useState('');

  const sortedNodes = useMemo(() => [...nodes].sort((a, b) => a.x - b.x), [nodes]);
  const shapeNames = useMemo(() => Object.keys(shapeDatabase).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })), [shapeDatabase]);
  const shapeTypeOptions = useMemo(() => {
    const availableTypes = Array.from(new Set(shapeNames.map((name) => shapeDatabase[name]?.Type || 'Other')));

    return ['~', 'All', ...preferredShapeTypeOrder.filter((type) => availableTypes.includes(type)), ...availableTypes.filter((type) => !preferredShapeTypeOrder.includes(type)).sort()];
  }, [shapeDatabase, shapeNames]);

  const normalizedShapeSearch = normalizeShapeName(shapeSearch.trim());
  const filteredShapeNames = useMemo(() => {
    return shapeNames
      .filter((name) => {
        const shape = shapeDatabase[name];
        const matchesType = shapeTypeFilter === '~' || shapeTypeFilter === 'All' || (shape?.Type || 'Other') === shapeTypeFilter;
        const matchesSearch = !normalizedShapeSearch || shapeSearchScore(name, normalizedShapeSearch) < 99;

        return matchesType && matchesSearch;
      })
      .sort((a, b) => {
        const scoreDifference = shapeSearchScore(a, normalizedShapeSearch) - shapeSearchScore(b, normalizedShapeSearch);
        if (scoreDifference !== 0) return scoreDifference;

        return a.localeCompare(b, undefined, { numeric: true });
      });
  }, [shapeDatabase, shapeNames, normalizedShapeSearch, shapeTypeFilter]);

  const exactShapeSearchMatch = useMemo(() => {
    if (!normalizedShapeSearch) return '';

    return filteredShapeNames.find((name) => normalizeShapeName(name) === normalizedShapeSearch) ?? '';
  }, [filteredShapeNames, normalizedShapeSearch]);

  const suggestedShapeNames = normalizedShapeSearch ? filteredShapeNames.slice(0, 8) : [];
  const sectionSelectOptions = filteredShapeNames.includes(section) ? filteredShapeNames : [section, ...filteredShapeNames];
  const selectedShape = shapeDatabase[section] ?? shapeDatabase[shapeNames[0]] ?? { A: 10, Zx: 50, Type: 'W', AISC_Manual_Label: section };
  const aiscFactors = (aiscData as Record<string, typeof aiscData['AISC 360-16']>)[activeAiscYear] ?? aiscData['AISC 360-16'];
  const sectionDepth = Math.max(selectedShape.d ?? Number(section.match(/\d+(?:\.\d+)?/)?.[0] ?? 12), 1);
  const estimatedSx = Math.max(selectedShape.Sx ?? selectedShape.Zx * 0.87, 0.1);
  const estimatedIx = Math.max(selectedShape.Ix ?? estimatedSx * (sectionDepth / 2), selectedShape.Zx, 0.1);
  const elasticModulus = 29000;
  const selfWeightKipPerFt = (selectedShape.A * 490) / 144 / 1000;

  const assumedNu = 0.3;
  const estimatedG = elasticModulus / (2 * (1 + assumedNu));
  const estimatedFu = Math.max(fy + 8, fy * 1.2);
  const flangeSlenderness = sectionDepth > 0 ? Math.max(sectionDepth / 2 / 0.36, 1) : 1;
  const webSlenderness = sectionDepth > 0 ? Math.max(sectionDepth / 0.355, 1) : 1;

  const getReportHeaderInfo = (): ReportHeaderInfo => ({
    project: reportProject,
    jobRef: reportJobRef,
    sectionName: reportSectionName,
    sheetNumber: reportSheetNumber,
    calcBy: reportCalcBy,
    checkedBy: reportCheckedBy,
    approvedBy: reportApprovedBy,
    date: reportDate,
  });

  const applyReportHeaderInfo = (header: Partial<ReportHeaderInfo>) => {
    if (typeof header.project === 'string') setReportProject(header.project);
    if (typeof header.jobRef === 'string') setReportJobRef(header.jobRef);
    if (typeof header.sectionName === 'string') setReportSectionName(header.sectionName);
    if (typeof header.sheetNumber === 'string') setReportSheetNumber(header.sheetNumber);
    if (typeof header.calcBy === 'string') setReportCalcBy(header.calcBy);
    if (typeof header.checkedBy === 'string') setReportCheckedBy(header.checkedBy);
    if (typeof header.approvedBy === 'string') setReportApprovedBy(header.approvedBy);
    if (typeof header.date === 'string') setReportDate(header.date);
  };

  useEffect(() => {
    const defaults = readReportHeaderDefaults();
    applyReportHeaderInfo({
      sectionName: 'Steel Beam',
      sheetNumber: '1',
      date: new Date().toISOString().slice(0, 10),
      ...defaults,
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadAiscShapeDatabase = async () => {
      try {
        const response = await fetch(AISC_SHAPES_CSV_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const csv = await response.text();
        const parsedShapes = parseAiscShapesCsv(csv);
        const parsedShapeCount = Object.keys(parsedShapes).length;

        if (parsedShapeCount < 100) {
          throw new Error('AISC CSV did not contain enough shapes.');
        }

        if (!cancelled) {
          setShapeDatabase(parsedShapes);
          setShapeDatabaseSource(`AISC Shapes Database v15.0 CSV (${parsedShapeCount.toLocaleString()} shapes)`);
          setShapeDatabaseError('');
        }
      } catch (error) {
        if (!cancelled) {
          setShapeDatabaseSource('Seed W-shape database');
          setShapeDatabaseError(error instanceof Error ? error.message : 'Unable to load AISC CSV database.');
        }
      }
    };

    loadAiscShapeDatabase();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!shapeDatabase[section] && shapeNames.length > 0) {
      setSection(shapeNames[0]);
    }
  }, [section, shapeDatabase, shapeNames]);

  useEffect(() => {
    const documentToOpen = consumeOpenProjectDocumentRequest();
    if (!documentToOpen || documentToOpen.type !== 'Steel Beam Design') return;

    const savedInputs = documentToOpen.inputs as {
      method?: DesignMethod;
      memberType?: MemberType;
      materialType?: MaterialType;
      designRule?: DesignRule;
      internalSections?: number;
      ky?: number;
      kz?: number;
      lbyy?: number;
      lbzz?: number;
      lCompTop?: number | null;
      lCompBottom?: number | null;
      lTorque?: number | null;
      ySway?: SwayOption;
      zSway?: SwayOption;
      seismicDesignRule?: SeismicDesignRule;
      shapeTypeFilter?: string;
      section?: string;
      fy?: number;
      unbracedLength?: number;
      deflectionLimit?: number;
      totalDeflectionLimit?: number;
      includeSelfWeight?: boolean;
      loadFactors?: Record<LoadCase, number>;
      nodes?: BeamNode[];
      loads?: BeamLoad[];
      reportHeader?: Partial<ReportHeaderInfo>;
    };

    if (savedInputs.method) setMethod(savedInputs.method);
    if (savedInputs.memberType) setMemberType(savedInputs.memberType);
    if (savedInputs.materialType) setMaterialType(savedInputs.materialType);
    if (savedInputs.designRule) setDesignRule(savedInputs.designRule);
    if (typeof savedInputs.internalSections === 'number') setInternalSections(savedInputs.internalSections);
    if (typeof savedInputs.ky === 'number') setKy(savedInputs.ky);
    if (typeof savedInputs.kz === 'number') setKz(savedInputs.kz);
    if (typeof savedInputs.lbyy === 'number') setLbyy(savedInputs.lbyy);
    if (typeof savedInputs.lbzz === 'number') setLbzz(savedInputs.lbzz);
    if (typeof savedInputs.lCompTop === 'number' || savedInputs.lCompTop === null) setLCompTop(savedInputs.lCompTop);
    if (typeof savedInputs.lCompBottom === 'number' || savedInputs.lCompBottom === null) setLCompBottom(savedInputs.lCompBottom);
    if (typeof savedInputs.lTorque === 'number' || savedInputs.lTorque === null) setLTorque(savedInputs.lTorque);
    if (savedInputs.ySway) setYSway(savedInputs.ySway);
    if (savedInputs.zSway) setZSway(savedInputs.zSway);
    if (savedInputs.seismicDesignRule) setSeismicDesignRule(savedInputs.seismicDesignRule);
    if (savedInputs.shapeTypeFilter) setShapeTypeFilter(savedInputs.shapeTypeFilter);
    if (savedInputs.section) setSection(savedInputs.section);
    if (typeof savedInputs.fy === 'number') setFy(savedInputs.fy);
    if (typeof savedInputs.unbracedLength === 'number') setUnbracedLength(savedInputs.unbracedLength);
    if (typeof savedInputs.deflectionLimit === 'number') setDeflectionLimit(savedInputs.deflectionLimit);
    if (typeof savedInputs.totalDeflectionLimit === 'number') setTotalDeflectionLimit(savedInputs.totalDeflectionLimit);
    if (typeof savedInputs.includeSelfWeight === 'boolean') setIncludeSelfWeight(savedInputs.includeSelfWeight);
    if (savedInputs.loadFactors) setLoadFactors(savedInputs.loadFactors);
    if (Array.isArray(savedInputs.nodes) && savedInputs.nodes.length >= 2) setNodes(savedInputs.nodes);
    if (Array.isArray(savedInputs.loads)) setLoads(savedInputs.loads);
    if (savedInputs.reportHeader) applyReportHeaderInfo(savedInputs.reportHeader);

    setReportHeaderSaveScope('document');
    setEditingDocumentId(documentToOpen.id);
    setLoadedDocumentName(documentToOpen.name);
    setDocumentName(documentToOpen.name);
    setSelectedDocumentId(documentToOpen.id);
    setSaveMode('overwrite');
    setSaveMessage(`Opened "${documentToOpen.name}" for editing. Save Output can overwrite this document when you are done.`);
  }, []);

  const addNode = () => {
    const lastX = sortedNodes.length ? sortedNodes[sortedNodes.length - 1].x : 0;
    const nextNode = createNode(lastX + 10, 'None');
    setNodes((prev) => [...prev, nextNode]);
    setSelectedNodeId(nextNode.id);
  };

  const updateNode = (id: string, patch: Partial<BeamNode>) => {
    setNodes((prev) =>
      prev.map((node) => {
        if (node.id !== id) return node;
        const next = { ...node, ...patch };
        if (patch.support) {
          return { ...next, ...degreesFromSupport(patch.support) };
        }
        if (patch.dofX || patch.dofZ || patch.dofRotation) {
          return { ...next, support: supportFromDegrees(next) };
        }
        return next;
      }),
    );
  };

  const updateNodeDegreeOfFreedom = (id: string, field: 'dofX' | 'dofZ' | 'dofRotation', value: DegreeOfFreedom) => {
    if (field === 'dofX') updateNode(id, { dofX: value });
    if (field === 'dofZ') updateNode(id, { dofZ: value });
    if (field === 'dofRotation') updateNode(id, { dofRotation: value });
  };

  const removeNode = (id: string) => {
    if (nodes.length <= 2) return;
    const replacementNodeId = nodes.find((node) => node.id !== id)?.id ?? id;
    setNodes((prev) => prev.filter((node) => node.id !== id));
    setLoads((prev) =>
      prev.map((load) => ({
        ...load,
        fromNodeId: load.fromNodeId === id ? replacementNodeId : load.fromNodeId,
        toNodeId: load.toNodeId === id ? replacementNodeId : load.toNodeId,
      })),
    );
    setSelectedNodeId((prev) => (prev === id ? replacementNodeId : prev));
  };

  const removeSelectedNode = () => {
    if (selectedNodeId) removeNode(selectedNodeId);
  };

  const addLoad = () => {
    if (!sortedNodes.length) return;
    const firstNode = sortedNodes[0];
    const lastNode = sortedNodes[sortedNodes.length - 1];
    setLoads((prev) => [
      ...prev,
      {
        id: makeId(),
        type: 'Point',
        loadCase: 'D',
        fromNodeId: firstNode.id,
        toNodeId: lastNode.id,
        magnitude: 5,
        tributaryWidth: 10,
        direction: 'Down',
      },
    ]);
  };

  const updateLoad = (id: string, patch: Partial<BeamLoad>) => {
    setLoads((prev) => prev.map((load) => (load.id === id ? { ...load, ...patch } : load)));
  };

  const removeLoad = (id: string) => setLoads((prev) => prev.filter((load) => load.id !== id));

  const updateLoadFactor = (loadCase: LoadCase, value: number) => {
    setLoadFactors((prev) => ({ ...prev, [loadCase]: value }));
  };

  const requiredFieldIssues = useMemo(() => {
    const issues: string[] = [];

    if (!method) issues.push('Select a design method.');
    if (!section || !shapeDatabase[section]) issues.push('Select a valid steel section.');
    if (!Number.isFinite(fy) || fy <= 0) issues.push('Enter Fy greater than 0 ksi.');
    if (!Number.isFinite(unbracedLength) || unbracedLength <= 0) issues.push('Enter unbraced length greater than 0 ft.');
    if (!Number.isFinite(internalSections) || internalSections < 3) issues.push('Enter at least 3 internal analysis sections.');
    if (sortedNodes.length < 2) issues.push('Add at least two nodes.');
    if (sortedNodes.length >= 2) {
      const beamStart = sortedNodes[0].x;
      const beamEnd = sortedNodes[sortedNodes.length - 1].x;
      if (!Number.isFinite(beamStart) || !Number.isFinite(beamEnd) || beamEnd <= beamStart) {
        issues.push('Node x-coordinates must create a positive beam length.');
      }
    }
    const supportCount = sortedNodes.filter((node) => node.support !== 'None').length;
    if (supportCount < 2) issues.push('Add at least two supports.');
    if (!Number.isFinite(deflectionLimit) || deflectionLimit <= 0) issues.push('Enter a live-load deflection limit greater than 0.');
    if (!Number.isFinite(totalDeflectionLimit) || totalDeflectionLimit <= 0) issues.push('Enter a total-load deflection limit greater than 0.');
    if (!Number.isFinite(ky) || ky <= 0) issues.push('Enter Ky-y greater than 0.');
    if (!Number.isFinite(kz) || kz <= 0) issues.push('Enter Kz-z greater than 0.');
    if (!Number.isFinite(lbyy) || lbyy <= 0) issues.push('Enter Lb y-y greater than 0 ft.');
    if (!Number.isFinite(lbzz) || lbzz <= 0) issues.push('Enter Lb z-z greater than 0 ft.');

    (Object.keys(loadFactors) as LoadCase[]).forEach((loadCase) => {
      const factor = loadFactors[loadCase];
      if (!Number.isFinite(factor)) issues.push(`Enter a valid ${loadCase} load factor.`);
    });

    return issues;
  }, [deflectionLimit, fy, internalSections, ky, kz, lbyy, lbzz, loadFactors, method, section, shapeDatabase, sortedNodes, totalDeflectionLimit, unbracedLength]);

  const canRunDesign = requiredFieldIssues.length === 0;

  const analysis = useMemo(() => {
    if (!canRunDesign) return null;
    if (sortedNodes.length < 2) return null;

    const beamStart = sortedNodes[0].x;
    const beamEnd = sortedNodes[sortedNodes.length - 1].x;
    const fullLength = beamEnd - beamStart;
    if (fullLength <= 0) return null;

    const restrainedNodes = sortedNodes.filter((node) => node.support !== 'None');
    const leftSupport = restrainedNodes[0] ?? sortedNodes[0];
    const rightSupport = restrainedNodes[restrainedNodes.length - 1] ?? sortedNodes[sortedNodes.length - 1];
    const reactionLength = rightSupport.x - leftSupport.x;
    if (reactionLength <= 0) return null;

    const pointLoads: PointLoadAnalysis[] = [];
    const distributedLoads: DistributedLoadAnalysis[] = [];

    if (includeSelfWeight) {
      const selfWeightFactor = loadFactors.D;
      distributedLoads.push({
        x1: beamStart,
        x2: beamEnd,
        w: selfWeightKipPerFt * selfWeightFactor,
        label: `Self weight D${selfWeightFactor !== 1 ? `×${selfWeightFactor.toFixed(2)}` : ''}`,
      });
    }

    loads.forEach((load) => {
      const fromNode = nodes.find((node) => node.id === load.fromNodeId);
      const toNode = nodes.find((node) => node.id === load.toNodeId) ?? fromNode;
      if (!fromNode || !toNode) return;

      const sign = load.direction === 'Down' ? 1 : -1;
      const factor = loadFactors[load.loadCase];
      const caseLabel = `${load.loadCase}${factor !== 1 ? `×${factor.toFixed(2)}` : ''}`;

      if (load.type === 'Point') {
        pointLoads.push({ x: fromNode.x, p: sign * load.magnitude * factor, label: caseLabel });
      } else {
        const x1 = Math.max(beamStart, Math.min(fromNode.x, toNode.x));
        const x2 = Math.min(beamEnd, Math.max(fromNode.x, toNode.x));
        const lineMagnitude = loadToLineMagnitude(load);
        if (x2 > x1) {
          distributedLoads.push({ x1, x2, w: sign * lineMagnitude * factor, label: caseLabel });
        }
      }
    });

    const totalPointLoad = pointLoads.reduce((sum, load) => sum + load.p, 0);
    const totalDistributedLoad = distributedLoads.reduce((sum, load) => sum + load.w * (load.x2 - load.x1), 0);
    const totalVerticalLoad = totalPointLoad + totalDistributedLoad;

    const momentAboutLeftSupport =
      pointLoads.reduce((sum, load) => sum + load.p * (load.x - leftSupport.x), 0) +
      distributedLoads.reduce((sum, load) => sum + load.w * (load.x2 - load.x1) * ((load.x1 + load.x2) / 2 - leftSupport.x), 0);

    const rb = momentAboutLeftSupport / reactionLength;
    const ra = totalVerticalLoad - rb;

    const sampleCount = 160;
    const xs = Array.from({ length: sampleCount + 1 }, (_, index) => beamStart + (fullLength * index) / sampleCount);

    const shear = xs.map((x) => {
      let value = 0;
      if (leftSupport.x <= x) value += ra;
      if (rightSupport.x <= x) value += rb;

      pointLoads.forEach((load) => {
        if (load.x <= x) value -= load.p;
      });

      distributedLoads.forEach((load) => {
        const coveredLength = Math.max(0, Math.min(x, load.x2) - load.x1);
        value -= load.w * coveredLength;
      });

      return value;
    });

    const moment: number[] = new Array(xs.length).fill(0);
    for (let index = 1; index < xs.length; index += 1) {
      const dx = xs[index] - xs[index - 1];
      moment[index] = moment[index - 1] + ((shear[index - 1] + shear[index]) / 2) * dx;
    }

    const maxShear = Math.max(...shear.map((value) => Math.abs(value)), 0);
    const maxMoment = Math.max(...moment.map((value) => Math.abs(value)), 0);
    const deflectionShape = moment.map((value) => (maxMoment > 0 ? value / maxMoment : 0));

    return {
      beamStart,
      beamEnd,
      fullLength,
      leftSupport,
      rightSupport,
      pointLoads,
      distributedLoads,
      xs,
      shear,
      moment,
      deflectionShape,
      ra,
      rb,
      maxShear,
      maxMoment,
      totalVerticalLoad,
    };
  }, [canRunDesign, sortedNodes, loads, nodes, loadFactors, includeSelfWeight, selfWeightKipPerFt]);

  const compressionSlendernessY = analysis ? (Math.max(ky, 0.01) * Math.max(lbyy, 0.01) * 12) / Math.max(Math.sqrt(estimatedIx / Math.max(selectedShape.A, 0.001)), 0.001) : 0;
  const compressionSlendernessZ = analysis ? (Math.max(kz, 0.01) * Math.max(lbzz, 0.01) * 12) / Math.max(Math.sqrt(estimatedIx / Math.max(selectedShape.A, 0.001)), 0.001) : 0;

  const nominalMoment = (fy * selectedShape.Zx) / 12;
  const designMoment = method === 'LRFD' ? aiscFactors.phi_b * nominalMoment : nominalMoment / aiscFactors.omega_b;
  const nominalShear = 0.6 * fy * selectedShape.A;
  const designShear = method === 'LRFD' ? aiscFactors.phi_b * nominalShear : nominalShear / aiscFactors.omega_b;
  const momentUtilization = analysis ? analysis.maxMoment / Math.max(designMoment, 0.001) : 0;
  const shearUtilization = analysis ? analysis.maxShear / Math.max(designShear, 0.001) : 0;
  const liveDeflectionLimit = analysis ? (analysis.fullLength * 12) / Math.max(deflectionLimit, 1) : 0;
  const totalServiceDeflectionLimit = analysis ? (analysis.fullLength * 12) / Math.max(totalDeflectionLimit, 1) : 0;
  const maximumDeflection = useMemo(() => {
    if (!analysis || analysis.xs.length < 2) return { value: 0, position: 0 };

    const startIn = analysis.beamStart * 12;
    const endIn = analysis.beamEnd * 12;
    const lengthIn = Math.max(endIn - startIn, 1);
    const curvature = analysis.moment.map((momentValue) => (momentValue * 12) / (elasticModulus * estimatedIx));
    const slope: number[] = new Array(analysis.xs.length).fill(0);
    const rawDeflection: number[] = new Array(analysis.xs.length).fill(0);

    for (let index = 1; index < analysis.xs.length; index += 1) {
      const dx = (analysis.xs[index] - analysis.xs[index - 1]) * 12;
      slope[index] = slope[index - 1] + ((curvature[index - 1] + curvature[index]) / 2) * dx;
      rawDeflection[index] = rawDeflection[index - 1] + ((slope[index - 1] + slope[index]) / 2) * dx;
    }

    let maxValue = 0;
    let maxPosition = analysis.beamStart;
    const endCorrection = rawDeflection[rawDeflection.length - 1];

    analysis.xs.forEach((x, index) => {
      const xIn = x * 12;
      const corrected = rawDeflection[index] - ((xIn - startIn) / lengthIn) * endCorrection;
      if (Math.abs(corrected) > Math.abs(maxValue)) {
        maxValue = corrected;
        maxPosition = x;
      }
    });

    return { value: Math.abs(maxValue), position: maxPosition };
  }, [analysis, elasticModulus, estimatedIx]);

  const deflectionUtilization = maximumDeflection.value / Math.max(totalServiceDeflectionLimit, 0.001);
  const controllingUtilization = Math.max(momentUtilization, shearUtilization, deflectionUtilization);
  const governingLimitState =
    controllingUtilization === deflectionUtilization
      ? 'Deflection'
      : controllingUtilization === momentUtilization
        ? 'Moment'
        : 'Shear';
  const isPassing = controllingUtilization <= 1;
  const reportElementLoads = [
    ...(includeSelfWeight ? [{ id: 'self-weight', element: 1, loadCase: 'Dead', loadType: 'Self weight', orientation: 'Global Z', description: `${selfWeightKipPerFt.toFixed(3)} kips/ft` }] : []),
    ...loads.map((load, index) => {
      const fromNode = nodes.find((node) => node.id === load.fromNodeId);
      const toNode = nodes.find((node) => node.id === load.toNodeId);
      const caseName = load.loadCase === 'D' ? 'Dead' : load.loadCase === 'L' ? 'Live' : load.loadCase === 'S' ? 'Snow' : 'Wind';
      const loadType = load.type === 'Point' ? 'Point load' : load.type === 'Line' ? 'UDL' : 'Area load';
      const location = load.type === 'Point'
        ? `${load.magnitude.toFixed(2)} ${loadUnit(load)} at ${(fromNode?.x ?? 0).toFixed(2)} ft`
        : `${load.magnitude.toFixed(2)} ${loadUnit(load)} from ${(fromNode?.x ?? 0).toFixed(2)} ft to ${(toNode?.x ?? 0).toFixed(2)} ft`;

      return {
        id: load.id,
        element: index + 1,
        loadCase: caseName,
        loadType,
        orientation: load.direction === 'Down' ? 'Global Z' : 'Global -Z',
        description: location,
      };
    }),
  ];

  const xToSvg = (x: number, width: number, start: number, length: number) => 80 + ((x - start) / Math.max(length, 1)) * (width - 160);

  const renderSupport = (node: BeamNode, x: number, y: number) => {
    if (node.support === 'None') {
      return <circle cx={x} cy={y} r="4" fill="#94a3b8" />;
    }

    if (node.support === 'Fixed') {
      return (
        <g>
          <rect x={x - 7} y={y - 32} width="14" height="32" fill="#dbeafe" stroke="#2563eb" strokeWidth="2" />
          {[0, 1, 2, 3].map((index) => (
            <line key={index} x1={x - 11} y1={y - 28 + index * 8} x2={x - 1} y2={y - 36 + index * 8} stroke="#2563eb" strokeWidth="1.5" />
          ))}
        </g>
      );
    }

    if (node.support === 'Pinned') {
      return (
        <g>
          <polygon points={`${x},${y - 2} ${x - 14},${y + 22} ${x + 14},${y + 22}`} fill="#dbeafe" stroke="#2563eb" strokeWidth="2" />
          <line x1={x - 18} y1={y + 24} x2={x + 18} y2={y + 24} stroke="#2563eb" strokeWidth="2" />
        </g>
      );
    }

    return (
      <g>
        <polygon points={`${x},${y - 2} ${x - 14},${y + 18} ${x + 14},${y + 18}`} fill="#dcfce7" stroke="#16a34a" strokeWidth="2" />
        <circle cx={x - 8} cy={y + 24} r="4" fill="#16a34a" />
        <circle cx={x + 8} cy={y + 24} r="4" fill="#16a34a" />
      </g>
    );
  };

  const renderDiagram = () => {
    const width = 940;
    const height = 260;
    const beamY = 150;
    const start = analysis?.beamStart ?? sortedNodes[0]?.x ?? 0;
    const end = analysis?.beamEnd ?? sortedNodes[sortedNodes.length - 1]?.x ?? 30;
    const length = Math.max(end - start, 1);

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[300px] w-full min-w-[760px]">
        <rect x="24" y="24" width={width - 48} height={height - 48} rx="14" fill="#f8fafc" stroke="#e2e8f0" />
        <line x1="60" y1={beamY} x2={width - 60} y2={beamY} stroke="#0f172a" strokeWidth="5" strokeLinecap="round" />
        <line x1="60" y1={beamY + 1} x2={width - 60} y2={beamY + 1} stroke="#bfdbfe" strokeWidth="2" strokeLinecap="round" />

        {sortedNodes.map((node) => {
          const x = xToSvg(node.x, width, start, length);
          return (
            <g key={node.id}>
              {renderSupport(node, x, beamY)}
              <line x1={x} y1={beamY - 12} x2={x} y2={beamY + 38} stroke="#cbd5e1" strokeDasharray="4,4" />
              <text x={x} y={beamY + 52} fontSize="12" textAnchor="middle" fill="#475569" fontFamily="monospace">
                x={node.x.toFixed(1)} ft
              </text>
              <text x={x} y={beamY + 68} fontSize="11" textAnchor="middle" fill="#64748b">
                {supportLabel(node.support)}
              </text>
            </g>
          );
        })}

        {displayOptions.loading && analysis?.distributedLoads.map((load, index) => {
          const x1 = xToSvg(load.x1, width, start, length);
          const x2 = xToSvg(load.x2, width, start, length);
          const isDown = load.w >= 0;
          const lineY = isDown ? 76 : 222;
          const arrowTipY = isDown ? beamY - 10 : beamY + 10;
          const labelY = isDown ? 56 : 242;
          const arrowCount = Math.max(3, Math.min(7, Math.round((x2 - x1) / 85)));
          const arrowXs = Array.from({ length: arrowCount }, (_, arrowIndex) => x1 + ((x2 - x1) * arrowIndex) / Math.max(arrowCount - 1, 1));

          return (
            <g key={`dist-${index}`}>
              <line x1={x1} y1={lineY} x2={x2} y2={lineY} stroke="#2563eb" strokeWidth="1.5" />
              {arrowXs.map((arrowX, arrowIndex) => (
                <g key={arrowIndex}>
                  <line x1={arrowX} y1={lineY} x2={arrowX} y2={arrowTipY} stroke="#2563eb" strokeWidth="1.75" />
                  <polygon
                    points={isDown
                      ? `${arrowX - 4},${arrowTipY - 8} ${arrowX + 4},${arrowTipY - 8} ${arrowX},${arrowTipY}`
                      : `${arrowX - 4},${arrowTipY + 8} ${arrowX + 4},${arrowTipY + 8} ${arrowX},${arrowTipY}`}
                    fill="#2563eb"
                  />
                </g>
              ))}
              <text x={(x1 + x2) / 2} y={labelY} fontSize="12" textAnchor="middle" fill="#1d4ed8" fontWeight="700">
                {Math.abs(load.w).toFixed(2)} k/ft {load.label}
              </text>
            </g>
          );
        })}

        {displayOptions.loading && analysis?.pointLoads.map((load, index) => {
          const x = xToSvg(load.x, width, start, length);
          const isDown = load.p >= 0;
          const y1 = isDown ? 64 : 214;
          const y2 = isDown ? beamY - 10 : beamY + 10;
          const labelY = isDown ? 48 : 236;
          return (
            <g key={`point-${index}`}>
              <line x1={x} y1={y1} x2={x} y2={y2} stroke="#dc2626" strokeWidth="2.5" />
              <polygon
                points={isDown
                  ? `${x - 5},${y2 - 10} ${x + 5},${y2 - 10} ${x},${y2}`
                  : `${x - 5},${y2 + 10} ${x + 5},${y2 + 10} ${x},${y2}`}
                fill="#dc2626"
              />
              <text x={x} y={labelY} fontSize="12" textAnchor="middle" fill="#b91c1c" fontWeight="700">
                {Math.abs(load.p).toFixed(2)} k {load.label}
              </text>
            </g>
          );
        })}

        {!displayOptions.loading && (
          <text x={width / 2} y="52" fontSize="12" textAnchor="middle" fill="#64748b">
            Enable “Loading” in the display options to show applied loads on the beam.
          </text>
        )}
      </svg>
    );
  };

  const renderResultDiagram = (mode: 'moment' | 'shear' | 'deflection') => {
    const width = 620;
    const height = 230;
    const start = analysis?.beamStart ?? sortedNodes[0]?.x ?? 0;
    const end = analysis?.beamEnd ?? sortedNodes[sortedNodes.length - 1]?.x ?? 30;
    const length = Math.max(end - start, 1);
    const leftPad = 74;
    const rightPad = 28;
    const topPad = 34;
    const bottomPad = 38;
    const plotTop = topPad;
    const plotBottom = height - bottomPad;
    const baselineY = (plotTop + plotBottom) / 2;
    const mapX = (x: number) => leftPad + ((x - start) / length) * (width - leftPad - rightPad);

    const momentPeak = Math.max(...(analysis?.moment.map((value) => Math.abs(value)) ?? [0]), 1);
    const shearPeak = Math.max(...(analysis?.shear.map((value) => Math.abs(value)) ?? [0]), 1);

    const config = mode === 'moment'
      ? {
          title: 'Moment diagram',
          color: '#16a34a',
          unit: 'kip-ft',
          peak: momentPeak,
          values: analysis?.moment ?? [],
          valueText: `${analysis?.maxMoment.toFixed(2) ?? '0.00'} kip-ft max`,
          yLabel: 'Moment (kip-ft)',
        }
      : mode === 'shear'
        ? {
            title: 'Shear diagram',
            color: '#f97316',
            unit: 'k',
            peak: shearPeak,
            values: analysis?.shear ?? [],
            valueText: `${analysis?.maxShear.toFixed(2) ?? '0.00'} k max`,
            yLabel: 'Shear (k)',
          }
        : {
            title: 'Deflection diagram',
            color: '#7c3aed',
            unit: 'in',
            peak: Math.max(maximumDeflection.value, 0.001),
            values: analysis?.deflectionShape.map((shape) => shape * maximumDeflection.value) ?? [],
            valueText: `${maximumDeflection.value.toFixed(3)} in max`,
            yLabel: 'Deflection (in)',
          };

    const yScale = mode === 'deflection'
      ? (value: number) => baselineY + (value / Math.max(config.peak, 0.001)) * 54
      : (value: number) => baselineY - (value / Math.max(config.peak, 0.001)) * 58;

    const points = analysis
      ? analysis.xs
          .map((x, index) => `${mapX(x)},${yScale(config.values[index] ?? 0)}`)
          .join(' ')
      : '';

    const xTicks = analysis ? [analysis.beamStart, analysis.beamStart + analysis.fullLength / 2, analysis.beamEnd] : [0, 0, 0];
    const yTicks = mode === 'deflection'
      ? [
          { value: 0, y: baselineY },
          { value: config.peak / 2, y: yScale(config.peak / 2) },
          { value: config.peak, y: yScale(config.peak) },
        ]
      : [
          { value: config.peak, y: yScale(config.peak) },
          { value: 0, y: baselineY },
          { value: -config.peak, y: yScale(-config.peak) },
        ];

    const activeHover = diagramHover?.mode === mode ? diagramHover : null;

    const handleDiagramMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
      if (!analysis || analysis.xs.length === 0) return;

      const svg = event.currentTarget;
      const rect = svg.getBoundingClientRect();
      const rawSvgX = ((event.clientX - rect.left) / rect.width) * width;
      const clampedSvgX = Math.max(leftPad, Math.min(width - rightPad, rawSvgX));
      const modelX = start + ((clampedSvgX - leftPad) / (width - leftPad - rightPad)) * length;

      let nearestIndex = 0;
      let nearestDistance = Number.POSITIVE_INFINITY;

      analysis.xs.forEach((x, index) => {
        const distance = Math.abs(x - modelX);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = index;
        }
      });

      const xValue = analysis.xs[nearestIndex] ?? modelX;
      const yValue = config.values[nearestIndex] ?? 0;

      setDiagramHover({
        mode,
        x: xValue,
        y: yValue,
        svgX: mapX(xValue),
        svgY: yScale(yValue),
      });
    };

    return (
      <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-gray-900">{config.title}</div>
          <div className="text-xs font-semibold" style={{ color: config.color }}>{config.valueText}</div>
        </div>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-[220px] w-full min-w-[320px] cursor-crosshair"
          onMouseMove={handleDiagramMouseMove}
          onMouseLeave={() => setDiagramHover((currentHover) => currentHover?.mode === mode ? null : currentHover)}
        >
          <rect x="1" y="1" width={width - 2} height={height - 2} rx="10" fill="#f8fafc" stroke="#e2e8f0" />
          <line x1={leftPad} y1={plotTop} x2={leftPad} y2={plotBottom} stroke="#9ca3af" />
          <line x1={leftPad} y1={baselineY} x2={width - rightPad} y2={baselineY} stroke="#cbd5e1" strokeDasharray="5,5" />

          {yTicks.map((tick) => (
            <g key={`${mode}-${tick.value}`}>
              <line x1={leftPad - 5} y1={tick.y} x2={width - rightPad} y2={tick.y} stroke="#e5e7eb" />
              <text x={leftPad - 9} y={tick.y + 4} fontSize="10" textAnchor="end" fill="#475569">
                {formatAxisValue(tick.value)}
              </text>
            </g>
          ))}

          {xTicks.map((tick) => {
            const x = mapX(tick);
            return (
              <g key={`${mode}-x-${tick}`}>
                <line x1={x} y1={baselineY - 4} x2={x} y2={plotBottom + 5} stroke="#e5e7eb" />
                <text x={x} y={height - 22} fontSize="10" textAnchor="middle" fill="#475569">
                  {formatAxisValue(tick)} ft
                </text>
              </g>
            );
          })}

          {points && <polyline points={points} fill="none" stroke={config.color} strokeWidth="3" />}

          {activeHover && (
            <g>
              <line x1={activeHover.svgX} y1={plotTop} x2={activeHover.svgX} y2={plotBottom} stroke="#334155" strokeDasharray="3,3" />
              <line x1={leftPad} y1={activeHover.svgY} x2={width - rightPad} y2={activeHover.svgY} stroke="#334155" strokeDasharray="3,3" />
              <circle cx={activeHover.svgX} cy={activeHover.svgY} r="4" fill={config.color} stroke="#ffffff" strokeWidth="2" />
              <g transform={`translate(${Math.min(activeHover.svgX + 10, width - 200)}, ${Math.max(activeHover.svgY - 38, 34)})`}>
                <rect width="188" height="32" rx="6" fill="#0f172a" opacity="0.92" />
                <text x="10" y="13" fontSize="10" fill="#cbd5e1">({activeHover.x.toFixed(2)} ft, {activeHover.y.toFixed(mode === 'deflection' ? 3 : 2)} {config.unit})</text>
                <text x="10" y="25" fontSize="9" fill="#94a3b8">x, y</text>
              </g>
            </g>
          )}

          <text x={leftPad} y="20" fontSize="11" fill="#64748b">{config.yLabel}</text>
          <text x={(leftPad + width - rightPad) / 2} y={height - 7} fontSize="11" textAnchor="middle" fill="#64748b">Position (ft)</text>
        </svg>
      </div>
    );
  };

  const renderBrowserDesignChecks = () => {
    const limitStateRows = [
      {
        label: 'Moment',
        check: 'Flexural Analysis (Strong Axis)',
        required: `${(analysis?.maxMoment ?? 0).toFixed(2)} kip-ft`,
        available: `${designMoment.toFixed(2)} kip-ft`,
        unity: formatRatio(momentUtilization),
        result: momentUtilization <= 1 ? 'Pass' : 'Fail',
      },
      {
        label: 'Shear',
        check: 'Shear Analysis',
        required: `${(analysis?.maxShear ?? 0).toFixed(2)} k`,
        available: `${designShear.toFixed(2)} k`,
        unity: formatRatio(shearUtilization),
        result: shearUtilization <= 1 ? 'Pass' : 'Fail',
      },
      {
        label: 'Deflection',
        check: 'Deflection Check',
        required: `${maximumDeflection.value.toFixed(3)} in`,
        available: `${totalServiceDeflectionLimit.toFixed(3)} in`,
        unity: formatRatio(deflectionUtilization),
        result: deflectionUtilization <= 1 ? 'Pass' : 'Fail',
      },
      {
        label: 'Governing',
        check: `${governingLimitState} controls`,
        required: '-',
        available: '-',
        unity: formatRatio(controllingUtilization),
        result: isPassing ? 'Pass' : 'Fail',
      },
    ];

    return (
      <div className="mt-6 rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
          <h3 className="text-base font-semibold text-gray-900">Detailed Design Checks</h3>
          <p className="mt-1 text-xs text-gray-500">
            Expanded calculation trail. The governing unity below matches the utilization summary above.
          </p>
        </div>

        <div className="space-y-5 p-4">
          <div>
            <h4 className="mb-2 text-sm font-semibold text-gray-800">Limit state summary</h4>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] border-collapse text-xs">
                <thead className="bg-gray-100 text-gray-600">
                  <tr>
                    <th className="border border-gray-200 px-2 py-2 text-left">Type</th>
                    <th className="border border-gray-200 px-2 py-2 text-left">Check</th>
                    <th className="border border-gray-200 px-2 py-2 text-right">Required</th>
                    <th className="border border-gray-200 px-2 py-2 text-right">Available</th>
                    <th className="border border-gray-200 px-2 py-2 text-right">Unity</th>
                    <th className="border border-gray-200 px-2 py-2 text-center">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {limitStateRows.map((row) => (
                    <tr key={row.label} className={row.label === 'Governing' ? 'bg-blue-50 font-semibold' : undefined}>
                      <td className="border border-gray-200 px-2 py-2">{row.label}</td>
                      <td className="border border-gray-200 px-2 py-2">{row.check}</td>
                      <td className="border border-gray-200 px-2 py-2 text-right">{row.required}</td>
                      <td className="border border-gray-200 px-2 py-2 text-right">{row.available}</td>
                      <td className="border border-gray-200 px-2 py-2 text-right">{row.unity}</td>
                      <td className={`border border-gray-200 px-2 py-2 text-center font-semibold ${row.result === 'Pass' ? 'text-green-700' : 'text-red-700'}`}>{row.result}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h4 className="mb-2 text-sm font-semibold text-gray-800">Calculation trail</h4>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              <div className={`rounded border p-3 text-xs ${governingLimitState === 'Moment' ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white'}`}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-semibold text-gray-900">Moment</span>
                  <span className="font-semibold">{formatRatio(momentUtilization)}</span>
                </div>
                <p>Mr,x = {(analysis?.maxMoment ?? 0).toFixed(2)} kip-ft</p>
                <p>Mn = Fy × Zx / 12 = {nominalMoment.toFixed(2)} kip-ft</p>
                <p>Available = {designMoment.toFixed(2)} kip-ft</p>
                <p className={momentUtilization <= 1 ? 'mt-2 font-semibold text-green-700' : 'mt-2 font-semibold text-red-700'}>
                  {momentUtilization <= 1 ? 'Pass' : 'Review required'}
                </p>
              </div>

              <div className={`rounded border p-3 text-xs ${governingLimitState === 'Shear' ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white'}`}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-semibold text-gray-900">Shear</span>
                  <span className="font-semibold">{formatRatio(shearUtilization)}</span>
                </div>
                <p>Vr,x = {(analysis?.maxShear ?? 0).toFixed(2)} k</p>
                <p>Vn = 0.6 × Fy × A = {nominalShear.toFixed(2)} k</p>
                <p>Available = {designShear.toFixed(2)} k</p>
                <p className={shearUtilization <= 1 ? 'mt-2 font-semibold text-green-700' : 'mt-2 font-semibold text-red-700'}>
                  {shearUtilization <= 1 ? 'Pass' : 'Review required'}
                </p>
              </div>

              <div className={`rounded border p-3 text-xs ${governingLimitState === 'Deflection' ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white'}`}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-semibold text-gray-900">Deflection</span>
                  <span className="font-semibold">{formatRatio(deflectionUtilization)}</span>
                </div>
                <p>δmax = {maximumDeflection.value.toFixed(3)} in</p>
                <p>Location = {maximumDeflection.position.toFixed(2)} ft</p>
                <p>δallow = L / {totalDeflectionLimit} = {totalServiceDeflectionLimit.toFixed(3)} in</p>
                <p className={deflectionUtilization <= 1 ? 'mt-2 font-semibold text-green-700' : 'mt-2 font-semibold text-red-700'}>
                  {deflectionUtilization <= 1 ? 'Pass' : 'Review required'}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            Some section properties are estimated from the currently available shape data. Final engineering output should be verified against the project specification and full section database.
          </div>
        </div>
      </div>
    );
  };

  const renderPanel = () => {
    if (activePanel === 'Design options') {
      return (
        <div className="space-y-4">
          <div className="rounded border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900">
            <div className="text-xs font-bold uppercase tracking-wide text-blue-700">Active steel standard</div>
            <div className="mt-1 font-semibold">{activeAiscYear}</div>
            <div className="mt-1 text-xs text-blue-700">Use the steel page selector in the top-right header to change the governing code edition.</div>
          </div>

          <div className="rounded border border-gray-200 bg-white p-3 text-xs text-gray-600">
            <span className="font-bold text-red-600">*</span> Required fields must be completed before diagrams, results, save, preview, or print will run.
            <span className="ml-2 text-gray-400">(optional)</span> fields are saved for reporting/workflow but do not block calculations.
          </div>

          <label className="flex items-center gap-2 rounded border border-gray-200 bg-white p-3 text-sm font-medium text-gray-700">
            <input type="checkbox" checked={includeSelfWeight} onChange={(event) => setIncludeSelfWeight(event.target.checked)} />
            Include member self weight <span className="font-normal text-gray-400">(optional)</span> as a dead load
          </label>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-900">Member setup</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="text-sm font-medium text-gray-700">
                {fieldLabel('Method', true)}
                <select value={method} onChange={(event) => setMethod(event.target.value as DesignMethod)} className="mt-1 w-full rounded border border-gray-300 bg-white p-2 text-sm">
                  <option>LRFD</option>
                  <option>ASD</option>
                </select>
              </label>
              <label className="text-sm font-medium text-gray-700">
                {fieldLabel('Member type')}
                <select value={memberType} onChange={(event) => setMemberType(event.target.value as MemberType)} className="mt-1 w-full rounded border border-gray-300 bg-white p-2 text-sm">
                  <option>~</option>
                  <option>Beam</option>
                  <option>Girder</option>
                  <option>Joist</option>
                  <option>Lintel</option>
                  <option>Other</option>
                </select>
              </label>
              <label className="text-sm font-medium text-gray-700">
                {fieldLabel('Material type')}
                <select value={materialType} onChange={(event) => setMaterialType(event.target.value as MaterialType)} className="mt-1 w-full rounded border border-gray-300 bg-white p-2 text-sm">
                  <option>~</option>
                  <option>Hot Rolled Steel</option>
                  <option>Cold Formed Steel</option>
                  <option>Built-up Steel</option>
                  <option>Other</option>
                </select>
              </label>
              <label className="text-sm font-medium text-gray-700">
                {fieldLabel('Design rule')}
                <select value={designRule} onChange={(event) => setDesignRule(event.target.value as DesignRule)} className="mt-1 w-full rounded border border-gray-300 bg-white p-2 text-sm">
                  <option>~</option>
                  <option>Typical</option>
                  <option>Conservative</option>
                  <option>Custom</option>
                </select>
              </label>
              <label className="text-sm font-medium text-gray-700">
                {fieldLabel('Shape family')}
                <select value={shapeTypeFilter} onChange={(event) => setShapeTypeFilter(event.target.value)} className="mt-1 w-full rounded border border-gray-300 bg-white p-2 text-sm">
                  {shapeTypeOptions.map((type) => <option key={type}>{type}</option>)}
                </select>
              </label>
              <label className="text-sm font-medium text-gray-700">
                {fieldLabel('Search section')}
                <input
                  value={shapeSearch}
                  onChange={(event) => setShapeSearch(event.target.value)}
                  className="mt-1 w-full rounded border border-gray-300 bg-white p-2 text-sm"
                  placeholder="Type section, e.g. W8X18"
                />
                {normalizedShapeSearch && (
                  <div className={`mt-1 text-xs ${exactShapeSearchMatch ? 'text-green-700' : 'text-amber-700'}`}>
                    {exactShapeSearchMatch
                      ? `Exact match available: ${exactShapeSearchMatch}`
                      : 'No exact match. Choose a suggested close match below.'}
                  </div>
                )}
              </label>
              <label className="text-sm font-medium text-gray-700">
                {fieldLabel('Selected section', true)}
                <select value={section} onChange={(event) => setSection(event.target.value)} className="mt-1 w-full rounded border border-gray-300 bg-white p-2 text-sm">
                  {sectionSelectOptions.map((name) => <option key={name}>{name}</option>)}
                </select>
              </label>
              {normalizedShapeSearch && (
                <div className="rounded border border-gray-200 bg-gray-50 p-2 text-xs text-gray-600 sm:col-span-3">
                  <div className="mb-2 font-semibold text-gray-800">Suggested sections</div>
                  {suggestedShapeNames.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {suggestedShapeNames.map((name) => (
                        <button
                          key={name}
                          type="button"
                          onClick={() => {
                            setSection(name);
                            setShapeSearch(name);
                          }}
                          className={`rounded border px-2 py-1 font-semibold ${
                            section === name
                              ? 'border-blue-300 bg-blue-100 text-blue-800'
                              : 'border-gray-200 bg-white text-gray-700 hover:border-blue-200 hover:bg-blue-50'
                          }`}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-amber-700">No close section names found. Try a broader search like W8, HSS6, or L4.</div>
                  )}
                </div>
              )}
              <div className="rounded border border-gray-200 bg-gray-50 p-2 text-xs text-gray-600 sm:col-span-3">
                <div><span className="font-semibold">Shape database:</span> {shapeDatabaseSource}</div>
                <div>
                  {normalizedShapeSearch
                    ? filteredShapeNames.length
                    : shapeTypeFilter === '~' || shapeTypeFilter === 'All'
                      ? shapeNames.length
                      : filteredShapeNames.length}{' '}
                  section{(normalizedShapeSearch ? filteredShapeNames.length : shapeTypeFilter === '~' || shapeTypeFilter === 'All' ? shapeNames.length : filteredShapeNames.length) === 1 ? '' : 's'} shown{shapeDatabaseError ? `; fallback reason: ${shapeDatabaseError}` : ''}.
                </div>
              </div>
              <label className="text-sm font-medium text-gray-700">{fieldLabel('Internal sections', true)}<input type="number" min={3} value={internalSections} onChange={(event) => setInternalSections(Number(event.target.value))} className="mt-1 w-full rounded border border-gray-300 p-2 text-sm" /></label>
              <label className="text-sm font-medium text-gray-700">{fieldLabel('Fy (ksi)', true)}<input type="number" value={fy} onChange={(event) => setFy(Number(event.target.value))} className="mt-1 w-full rounded border border-gray-300 p-2 text-sm" /></label>
              <label className="text-sm font-medium text-gray-700">{fieldLabel('Unbraced Lb (ft)', true)}<input type="number" value={unbracedLength} onChange={(event) => setUnbracedLength(Number(event.target.value))} className="mt-1 w-full rounded border border-gray-300 p-2 text-sm" /></label>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-900">Stability lengths and factors</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <label className="text-sm font-medium text-gray-700">{fieldLabel('Lb y-y (ft)', true)}<input type="number" value={lbyy} onChange={(event) => setLbyy(Number(event.target.value))} className="mt-1 w-full rounded border border-gray-300 p-2 text-sm" /></label>
              <label className="text-sm font-medium text-gray-700">{fieldLabel('Lb z-z (ft)', true)}<input type="number" value={lbzz} onChange={(event) => setLbzz(Number(event.target.value))} className="mt-1 w-full rounded border border-gray-300 p-2 text-sm" /></label>
              <label className="text-sm font-medium text-gray-700">{fieldLabel('Ky-y', true)}<input type="number" step="0.05" value={ky} onChange={(event) => setKy(Number(event.target.value))} className="mt-1 w-full rounded border border-gray-300 p-2 text-sm" /></label>
              <label className="text-sm font-medium text-gray-700">{fieldLabel('Kz-z', true)}<input type="number" step="0.05" value={kz} onChange={(event) => setKz(Number(event.target.value))} className="mt-1 w-full rounded border border-gray-300 p-2 text-sm" /></label>
              <label className="text-sm font-medium text-gray-700">{fieldLabel('Lcomp top (ft)')}<input type="number" placeholder="~" value={optionalNumberInputValue(lCompTop)} onChange={(event) => setLCompTop(parseOptionalNumber(event.target.value))} className="mt-1 w-full rounded border border-gray-300 p-2 text-sm" /></label>
              <label className="text-sm font-medium text-gray-700">{fieldLabel('Lcomp bottom (ft)')}<input type="number" placeholder="~" value={optionalNumberInputValue(lCompBottom)} onChange={(event) => setLCompBottom(parseOptionalNumber(event.target.value))} className="mt-1 w-full rounded border border-gray-300 p-2 text-sm" /></label>
              <label className="text-sm font-medium text-gray-700">{fieldLabel('Ltorque (ft)')}<input type="number" placeholder="~" value={optionalNumberInputValue(lTorque)} onChange={(event) => setLTorque(parseOptionalNumber(event.target.value))} className="mt-1 w-full rounded border border-gray-300 p-2 text-sm" /></label>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-900">Sway and seismic options</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="text-sm font-medium text-gray-700">
                {fieldLabel('y sway')}
                <select value={ySway} onChange={(event) => setYSway(event.target.value as SwayOption)} className="mt-1 w-full rounded border border-gray-300 bg-white p-2 text-sm">
                  <option>~</option>
                  <option>No</option>
                  <option>Yes</option>
                </select>
              </label>
              <label className="text-sm font-medium text-gray-700">
                {fieldLabel('z sway')}
                <select value={zSway} onChange={(event) => setZSway(event.target.value as SwayOption)} className="mt-1 w-full rounded border border-gray-300 bg-white p-2 text-sm">
                  <option>~</option>
                  <option>No</option>
                  <option>Yes</option>
                </select>
              </label>
              <label className="text-sm font-medium text-gray-700">
                {fieldLabel('Seismic design rule')}
                <select value={seismicDesignRule} onChange={(event) => setSeismicDesignRule(event.target.value as SeismicDesignRule)} className="mt-1 w-full rounded border border-gray-300 bg-white p-2 text-sm">
                  <option>~</option>
                  <option>None</option>
                  <option>AISC Seismic</option>
                  <option>Project Specific</option>
                </select>
              </label>
            </div>
          </div>
        </div>
      );
    }

    if (activePanel === 'Nodes') {
      const dofOptions: DegreeOfFreedom[] = ['Free', 'Fixed', 'Spring'];

      return (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 pb-3">
            <button onClick={addNode} className="inline-flex items-center gap-2 rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
              <Plus size={16} /> Add
            </button>
            <button
              onClick={removeSelectedNode}
              disabled={!selectedNodeId || nodes.length <= 2}
              className="inline-flex items-center gap-2 rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Trash2 size={15} /> Delete
            </button>
            <div className="ml-auto text-xs text-gray-500">Define beam nodes, restraint degrees of freedom, local coordinate settings, and optional spring stiffness.</div>
          </div>

          <div className="overflow-x-auto rounded border border-gray-300 bg-white">
            <table className="min-w-[1180px] w-full border-collapse text-sm">
              <thead className="bg-gray-50 text-xs font-semibold text-gray-700">
                <tr>
                  <th className="border border-gray-300 px-2 py-1" rowSpan={2}>Index</th>
                  <th className="border border-gray-300 px-2 py-1 text-center" colSpan={2}>Coordinates</th>
                  <th className="border border-gray-300 px-2 py-1 text-center" colSpan={3}>Degrees of Freedom</th>
                  <th className="border border-gray-300 px-2 py-1" rowSpan={2}>Label</th>
                  <th className="border border-gray-300 px-2 py-1 text-center" colSpan={2}>Coordinate System</th>
                  <th className="border border-gray-300 px-2 py-1 text-center" colSpan={3}>Spring Stiffness</th>
                  <th className="border border-gray-300 px-2 py-1" rowSpan={2}>Restraint Preset</th>
                </tr>
                <tr>
                  <th className="border border-gray-300 px-2 py-1">X (ft)</th>
                  <th className="border border-gray-300 px-2 py-1">Z (ft)</th>
                  <th className="border border-gray-300 px-2 py-1">X</th>
                  <th className="border border-gray-300 px-2 py-1">Z</th>
                  <th className="border border-gray-300 px-2 py-1">Rotational</th>
                  <th className="border border-gray-300 px-2 py-1">Name</th>
                  <th className="border border-gray-300 px-2 py-1">Angle (°)</th>
                  <th className="border border-gray-300 px-2 py-1">X (kips/ft)</th>
                  <th className="border border-gray-300 px-2 py-1">Z (kips/ft)</th>
                  <th className="border border-gray-300 px-2 py-1">Rot. (kip-ft/°)</th>
                </tr>
              </thead>
              <tbody>
                {sortedNodes.map((node, index) => {
                  const isSelected = selectedNodeId === node.id;
                  return (
                    <tr key={node.id} onClick={() => setSelectedNodeId(node.id)} className={`${isSelected ? 'bg-blue-50' : 'bg-white'} cursor-pointer hover:bg-blue-50/60`}>
                      <td className="border border-gray-300 px-2 py-1 text-center font-medium text-gray-700">{index + 1}</td>
                      <td className="border border-gray-300 p-0">
                        <input type="number" value={node.x} onChange={(event) => updateNode(node.id, { x: Number(event.target.value) })} className="h-8 w-full border-0 px-2 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
                      </td>
                      <td className="border border-gray-300 p-0">
                        <input type="number" value={node.z} onChange={(event) => updateNode(node.id, { z: Number(event.target.value) })} className="h-8 w-full border-0 px-2 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
                      </td>
                      {(['dofX', 'dofZ', 'dofRotation'] as Array<'dofX' | 'dofZ' | 'dofRotation'>).map((field) => (
                        <td key={field} className="border border-gray-300 p-0">
                          <select value={node[field]} onChange={(event) => updateNodeDegreeOfFreedom(node.id, field, event.target.value as DegreeOfFreedom)} className="h-8 w-full border-0 bg-transparent px-2 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-400">
                            {dofOptions.map((option) => <option key={option}>{option}</option>)}
                          </select>
                        </td>
                      ))}
                      <td className="border border-gray-300 p-0">
                        <input value={node.label} onChange={(event) => updateNode(node.id, { label: event.target.value })} placeholder={`N${index + 1}`} className="h-8 w-full border-0 px-2 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
                      </td>
                      <td className="border border-gray-300 p-0">
                        <input value={node.coordinateSystemName} onChange={(event) => updateNode(node.id, { coordinateSystemName: event.target.value })} className="h-8 w-full border-0 px-2 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
                      </td>
                      <td className="border border-gray-300 p-0">
                        <input type="number" value={node.coordinateSystemAngle} onChange={(event) => updateNode(node.id, { coordinateSystemAngle: Number(event.target.value) })} className="h-8 w-full border-0 px-2 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
                      </td>
                      <td className="border border-gray-300 p-0">
                        <input type="number" value={node.springX} onChange={(event) => updateNode(node.id, { springX: Number(event.target.value) })} disabled={node.dofX !== 'Spring'} className="h-8 w-full border-0 px-2 text-sm disabled:bg-gray-100 disabled:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
                      </td>
                      <td className="border border-gray-300 p-0">
                        <input type="number" value={node.springZ} onChange={(event) => updateNode(node.id, { springZ: Number(event.target.value) })} disabled={node.dofZ !== 'Spring'} className="h-8 w-full border-0 px-2 text-sm disabled:bg-gray-100 disabled:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
                      </td>
                      <td className="border border-gray-300 p-0">
                        <input type="number" value={node.springRotation} onChange={(event) => updateNode(node.id, { springRotation: Number(event.target.value) })} disabled={node.dofRotation !== 'Spring'} className="h-8 w-full border-0 px-2 text-sm disabled:bg-gray-100 disabled:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
                      </td>
                      <td className="border border-gray-300 p-0">
                        <select value={node.support} onChange={(event) => updateNode(node.id, { support: event.target.value as SupportType })} className="h-8 w-full border-0 bg-transparent px-2 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-400">
                          <option>None</option>
                          <option>Pinned</option>
                          <option>Roller</option>
                          <option>Fixed</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
                <tr>
                  <td className="border border-gray-300 px-2 py-1 text-center text-gray-400">*</td>
                  <td className="border border-gray-300 px-2 py-1 text-gray-400" colSpan={12}>Click Add to create another node.</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
            Use the restraint preset to quickly fill the degrees of freedom, or edit each degree of freedom directly for custom support behavior.
          </div>
        </div>
      );
    }

    if (activePanel === 'Loading') {
      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">Add point, line, or area loads to the selected beam points.</div>
            <button onClick={addLoad} className="inline-flex items-center gap-1 rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"><Plus size={14} /> Load</button>
          </div>
          {loads.length === 0 ? (
            <div className="rounded border border-dashed border-gray-300 p-5 text-center text-sm text-gray-500">No loads added yet.</div>
          ) : (
            <div className="space-y-2">
              {loads.map((load, index) => (
                <div key={load.id} className="rounded border border-gray-200 bg-white p-3 text-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="font-semibold text-gray-700">Load {index + 1}</div>
                    <button onClick={() => removeLoad(load.id)} className="rounded p-1 text-red-600 hover:bg-red-50"><Trash2 size={15} /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 lg:grid-cols-6">
                    <select value={load.type} onChange={(event) => updateLoad(load.id, { type: event.target.value as LoadType })} className="rounded border border-gray-300 bg-white p-2">
                      <option>Point</option>
                      <option>Line</option>
                      <option>Area</option>
                    </select>
                    <select value={load.loadCase} onChange={(event) => updateLoad(load.id, { loadCase: event.target.value as LoadCase })} className="rounded border border-gray-300 bg-white p-2">
                      <option value="D">Dead</option>
                      <option value="L">Live</option>
                      <option value="S">Snow</option>
                      <option value="W">Wind</option>
                    </select>
                    <select value={load.fromNodeId} onChange={(event) => updateLoad(load.id, { fromNodeId: event.target.value })} className="rounded border border-gray-300 bg-white p-2">
                      {sortedNodes.map((node) => <option key={node.id} value={node.id}>from {node.label || `N${sortedNodes.indexOf(node) + 1}`} x={node.x}</option>)}
                    </select>
                    <select value={load.toNodeId} onChange={(event) => updateLoad(load.id, { toNodeId: event.target.value })} disabled={load.type === 'Point'} className="rounded border border-gray-300 bg-white p-2 disabled:bg-gray-100 disabled:text-gray-400">
                      {sortedNodes.map((node) => <option key={node.id} value={node.id}>to {node.label || `N${sortedNodes.indexOf(node) + 1}`} x={node.x}</option>)}
                    </select>
                    <label className="relative">
                      <span className="pointer-events-none absolute right-2 top-2 text-xs text-gray-400">{loadUnit(load)}</span>
                      <input type="number" step="0.01" value={load.magnitude} onChange={(event) => updateLoad(load.id, { magnitude: Number(event.target.value) })} className="w-full rounded border border-gray-300 p-2 pr-12" />
                    </label>
                    <select value={load.direction} onChange={(event) => updateLoad(load.id, { direction: event.target.value as LoadDirection })} className="rounded border border-gray-300 bg-white p-2">
                      <option>Down</option>
                      <option>Up</option>
                    </select>
                  </div>
                  {load.type === 'Area' && (
                    <label className="mt-2 block text-xs font-medium text-gray-600">
                      Tributary width, ft
                      <input type="number" step="0.5" value={load.tributaryWidth} onChange={(event) => updateLoad(load.id, { tributaryWidth: Number(event.target.value) })} className="mt-1 w-full rounded border border-gray-300 p-2 text-sm" />
                    </label>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (activePanel === 'Combinations') {
      return (
        <div className="space-y-4">
          <div className="rounded border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">Load factors below are applied to the diagram and summary results.</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(['D', 'L', 'S', 'W'] as LoadCase[]).map((loadCase) => (
              <label key={loadCase} className="text-sm font-medium text-gray-700">
                {loadCase} factor
                <input type="number" step="0.05" value={loadFactors[loadCase]} onChange={(event) => updateLoadFactor(loadCase, Number(event.target.value))} className="mt-1 w-full rounded border border-gray-300 p-2 text-sm" />
              </label>
            ))}
          </div>
        </div>
      );
    }

    if (activePanel === 'Deflection criteria') {
      return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium text-gray-700">
            Live load limit, L/
            <input type="number" value={deflectionLimit} onChange={(event) => setDeflectionLimit(Number(event.target.value))} className="mt-1 w-full rounded border border-gray-300 p-2 text-sm" />
          </label>
          <label className="text-sm font-medium text-gray-700">
            Total load limit, L/
            <input type="number" value={totalDeflectionLimit} onChange={(event) => setTotalDeflectionLimit(Number(event.target.value))} className="mt-1 w-full rounded border border-gray-300 p-2 text-sm" />
          </label>
          <div className="rounded border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600 sm:col-span-2">
            Current span limit previews: live {liveDeflectionLimit.toFixed(3)} in, total {totalServiceDeflectionLimit.toFixed(3)} in.
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4 text-sm">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Report header</h3>
              <p className="mt-1 text-xs text-gray-500">These fields print at the top of the calculation output and are saved with project documents.</p>
            </div>
            <button
              type="button"
              onClick={() => applyReportHeaderInfo(readReportHeaderDefaults())}
              className="w-fit rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              Apply saved default
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="font-medium text-gray-700">Project<input value={reportProject} onChange={(event) => setReportProject(event.target.value)} className="mt-1 w-full rounded border border-gray-300 p-2 text-sm" placeholder="Project name" /></label>
            <label className="font-medium text-gray-700">Job Ref.<input value={reportJobRef} onChange={(event) => setReportJobRef(event.target.value)} className="mt-1 w-full rounded border border-gray-300 p-2 text-sm" placeholder="Job reference" /></label>
            <label className="font-medium text-gray-700">Section<input value={reportSectionName} onChange={(event) => setReportSectionName(event.target.value)} className="mt-1 w-full rounded border border-gray-300 p-2 text-sm" /></label>
            <label className="font-medium text-gray-700">Sheet no./rev.<input value={reportSheetNumber} onChange={(event) => setReportSheetNumber(event.target.value)} className="mt-1 w-full rounded border border-gray-300 p-2 text-sm" /></label>
            <label className="font-medium text-gray-700">Calc. by<input value={reportCalcBy} onChange={(event) => setReportCalcBy(event.target.value)} className="mt-1 w-full rounded border border-gray-300 p-2 text-sm" placeholder="Initials" /></label>
            <label className="font-medium text-gray-700">Checked by<input value={reportCheckedBy} onChange={(event) => setReportCheckedBy(event.target.value)} className="mt-1 w-full rounded border border-gray-300 p-2 text-sm" placeholder="Initials" /></label>
            <label className="font-medium text-gray-700">Approved by<input value={reportApprovedBy} onChange={(event) => setReportApprovedBy(event.target.value)} className="mt-1 w-full rounded border border-gray-300 p-2 text-sm" placeholder="Initials" /></label>
            <label className="font-medium text-gray-700">Date<input type="date" value={reportDate} onChange={(event) => setReportDate(event.target.value)} className="mt-1 w-full rounded border border-gray-300 p-2 text-sm" /></label>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
            <label className="flex items-start gap-2 rounded border border-gray-200 bg-gray-50 p-3">
              <input type="radio" name="reportHeaderSaveScope" checked={reportHeaderSaveScope === 'document'} onChange={() => setReportHeaderSaveScope('document')} />
              <span><span className="block font-semibold text-gray-800">Only this document</span><span className="text-xs text-gray-500">Save this header with the current saved output only.</span></span>
            </label>
            <label className="flex items-start gap-2 rounded border border-gray-200 bg-gray-50 p-3">
              <input type="radio" name="reportHeaderSaveScope" checked={reportHeaderSaveScope === 'default'} onChange={() => setReportHeaderSaveScope('default')} />
              <span><span className="block font-semibold text-gray-800">Keep for new documents</span><span className="text-xs text-gray-500">Save these fields as the default header for future outputs.</span></span>
            </label>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <label className="flex items-center gap-2 rounded border border-gray-200 bg-white p-3"><input type="checkbox" checked={includeModel} onChange={(event) => setIncludeModel(event.target.checked)} />Include beam model graphic</label>
          <label className="flex items-center gap-2 rounded border border-gray-200 bg-white p-3"><input type="checkbox" checked={includeCalculations} onChange={(event) => setIncludeCalculations(event.target.checked)} />Include calculation steps</label>
          <label className="flex items-center gap-2 rounded border border-gray-200 bg-white p-3"><input type="checkbox" checked={includeResults} onChange={(event) => setIncludeResults(event.target.checked)} />Include utilization summary</label>
        </div>
      </div>
    );
  };


  const renderReportBeamDiagram = (mode: 'geometry' | 'loading' | 'moment' | 'shear' | 'deflection') => {
    const width = 760;
    const height = 165;
    const beamY = 76;
    const start = analysis?.beamStart ?? sortedNodes[0]?.x ?? 0;
    const end = analysis?.beamEnd ?? sortedNodes[sortedNodes.length - 1]?.x ?? 30;
    const length = Math.max(end - start, 1);
    const mapX = (x: number) => 72 + ((x - start) / length) * (width - 132);
    const momentPeak = Math.max(...(analysis?.moment.map((value) => Math.abs(value)) ?? [0]), 1);
    const shearPeak = Math.max(...(analysis?.shear.map((value) => Math.abs(value)) ?? [0]), 1);
    const plotBaseY = 104;

    const reportConfig = mode === 'moment'
      ? { peak: momentPeak, unit: 'kip-ft', label: 'Moment (kip-ft)', values: analysis?.moment ?? [] }
      : mode === 'shear'
        ? { peak: shearPeak, unit: 'k', label: 'Shear (k)', values: analysis?.shear ?? [] }
        : { peak: Math.max(maximumDeflection.value, 0.001), unit: 'in', label: 'Deflection (in)', values: analysis?.deflectionShape.map((shape) => shape * maximumDeflection.value) ?? [] };

    const plotPoints = mode === 'moment' && analysis
      ? analysis.xs.map((x, index) => `${mapX(x)},${plotBaseY - (analysis.moment[index] / momentPeak) * 42}`).join(' ')
      : mode === 'shear' && analysis
        ? analysis.xs.map((x, index) => `${mapX(x)},${plotBaseY - (analysis.shear[index] / shearPeak) * 42}`).join(' ')
        : mode === 'deflection' && analysis
          ? analysis.xs.map((x, index) => `${mapX(x)},${plotBaseY + ((analysis.deflectionShape[index] * maximumDeflection.value) / Math.max(maximumDeflection.value, 0.001)) * 30}`).join(' ')
          : '';

    const showAxes = mode === 'moment' || mode === 'shear' || mode === 'deflection';

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="report-diagram">
        {showAxes && (
          <>
            <line x1="60" y1="30" x2="60" y2="135" stroke="#111827" />
            <line x1="60" y1={plotBaseY} x2={width - 45} y2={plotBaseY} stroke="#9ca3af" strokeDasharray="4,4" />
            <text x="62" y="22" fontSize="9" fill="#111827">{reportConfig.label}</text>
            <text x="55" y={mode === 'deflection' ? plotBaseY + 34 : plotBaseY - 38} fontSize="8" textAnchor="end">{formatAxisValue(reportConfig.peak)}</text>
            <text x="55" y={plotBaseY + 3} fontSize="8" textAnchor="end">0</text>
            {mode !== 'deflection' && <text x="55" y={plotBaseY + 45} fontSize="8" textAnchor="end">-{formatAxisValue(reportConfig.peak)}</text>}
            <text x="72" y="154" fontSize="8" fill="#4b5563">0 ft</text>
            <text x={width - 45} y="154" fontSize="8" textAnchor="end" fill="#4b5563">{analysis?.fullLength.toFixed(2) ?? '0.00'} ft</text>
          </>
        )}

        {!showAxes && <line x1="45" y1={beamY} x2={width - 45} y2={beamY} stroke="#111827" strokeWidth="2" />}
        {showAxes ? null : sortedNodes.map((node, index) => {
          const x = mapX(node.x);
          return (
            <g key={`report-node-${node.id}`}>
              <line x1={x} y1={beamY - 8} x2={x} y2={beamY + 12} stroke="#6b7280" strokeDasharray="3,3" />
              <text x={x} y={beamY - 14} fontSize="9" textAnchor="middle" fill="#4b5563">{index + 1}</text>
              {node.support === 'Fixed' ? (
                <rect x={x - 5} y={beamY - 20} width="10" height="20" fill="none" stroke="#111827" />
              ) : node.support === 'Pinned' ? (
                <polygon points={`${x},${beamY + 1} ${x - 10},${beamY + 18} ${x + 10},${beamY + 18}`} fill="none" stroke="#111827" />
              ) : node.support === 'Roller' ? (
                <g><polygon points={`${x},${beamY + 1} ${x - 10},${beamY + 15} ${x + 10},${beamY + 15}`} fill="none" stroke="#111827" /><circle cx={x - 5} cy={beamY + 20} r="3" fill="none" stroke="#111827" /><circle cx={x + 5} cy={beamY + 20} r="3" fill="none" stroke="#111827" /></g>
              ) : (
                <circle cx={x} cy={beamY} r="3" fill="#111827" />
              )}
            </g>
          );
        })}
        {mode === 'loading' && analysis?.distributedLoads.map((load, index) => {
          const x1 = mapX(load.x1);
          const x2 = mapX(load.x2);
          const isDown = load.w >= 0;
          const lineY = isDown ? 32 : 118;
          const arrowTipY = isDown ? beamY - 4 : beamY + 4;
          const count = Math.max(3, Math.min(6, Math.round((x2 - x1) / 85)));
          const arrowXs = Array.from({ length: count }, (_, arrowIndex) => x1 + ((x2 - x1) * arrowIndex) / Math.max(count - 1, 1));
          return (
            <g key={`report-dist-${index}`}>
              <line x1={x1} y1={lineY} x2={x2} y2={lineY} stroke="#111827" />
              {arrowXs.map((arrowX, arrowIndex) => (
                <g key={arrowIndex}>
                  <line x1={arrowX} y1={lineY} x2={arrowX} y2={arrowTipY} stroke="#111827" />
                  <polygon
                    points={isDown
                      ? `${arrowX - 3.5},${arrowTipY - 7} ${arrowX + 3.5},${arrowTipY - 7} ${arrowX},${arrowTipY}`
                      : `${arrowX - 3.5},${arrowTipY + 7} ${arrowX + 3.5},${arrowTipY + 7} ${arrowX},${arrowTipY}`}
                    fill="#111827"
                  />
                </g>
              ))}
              <text x={(x1 + x2) / 2} y={isDown ? 24 : 132} fontSize="9" textAnchor="middle">{Math.abs(load.w).toFixed(2)} k/ft</text>
            </g>
          );
        })}
        {mode === 'loading' && analysis?.pointLoads.map((load, index) => {
          const x = mapX(load.x);
          const isDown = load.p >= 0;
          const y1 = isDown ? 24 : 118;
          const y2 = isDown ? beamY - 4 : beamY + 4;
          return (
            <g key={`report-point-${index}`}>
              <line x1={x} y1={y1} x2={x} y2={y2} stroke="#111827" strokeWidth="1.5" />
              <polygon
                points={isDown
                  ? `${x - 3.5},${y2 - 7} ${x + 3.5},${y2 - 7} ${x},${y2}`
                  : `${x - 3.5},${y2 + 7} ${x + 3.5},${y2 + 7} ${x},${y2}`}
                fill="#111827"
              />
              <text x={x} y={isDown ? 16 : 132} fontSize="9" textAnchor="middle">{Math.abs(load.p).toFixed(2)} k</text>
            </g>
          );
        })}
        {plotPoints && <polyline points={plotPoints} fill="none" stroke="#111827" strokeWidth="2" />}
        {!showAxes && <text x="60" y="150" fontSize="9" fill="#4b5563">Length = {analysis?.fullLength.toFixed(2) ?? '0.00'} ft</text>}
      </svg>
    );
  };

  const renderPrintableReport = () => {
    const spanLength = analysis?.fullLength ?? 0;
    const internalSections = Math.max((analysis?.xs.length ?? 1) - 1, 0);
    const shearResult = shearUtilization <= 1 ? 'Pass' : 'Fail';
    const momentResult = momentUtilization <= 1 ? 'Pass' : 'Fail';
    const deflectionResult = deflectionUtilization <= 1 ? 'Pass' : 'Fail';
    const governingUnity = Math.max(momentUtilization, shearUtilization, deflectionUtilization);
    const governingCheck =
      governingUnity === deflectionUtilization
        ? 'Deflection'
        : governingUnity === momentUtilization
          ? 'Flexure'
          : 'Shear';
    const shearAvailableLabel = method === 'LRFD' ? 'φVn' : 'Vn / Ωv';
    const momentAvailableLabel = method === 'LRFD' ? 'φMn' : 'Mn / Ωb';
    const deflectionAllowable = totalServiceDeflectionLimit;
    const loadCaseNames: Record<LoadCase, string> = { D: 'Dead', L: 'Live', S: 'Snow', W: 'Wind' };

    const limitStateRows = [
      {
        label: 'Flexural Analysis (Strong Axis)',
        required: `${(analysis?.maxMoment ?? 0).toFixed(2)} kip-ft`,
        available: `${designMoment.toFixed(2)} kip-ft`,
        unity: formatRatio(momentUtilization),
        result: momentResult,
      },
      {
        label: 'Shear Analysis',
        required: `${(analysis?.maxShear ?? 0).toFixed(2)} k`,
        available: `${designShear.toFixed(2)} k`,
        unity: formatRatio(shearUtilization),
        result: shearResult,
      },
      {
        label: 'Deflection Check',
        required: `${maximumDeflection.value.toFixed(3)} in`,
        available: `${deflectionAllowable.toFixed(3)} in`,
        unity: formatRatio(deflectionUtilization),
        result: deflectionResult,
      },
      {
        label: 'Combined Utilization',
        required: '-',
        available: '-',
        unity: formatRatio(governingUnity),
        result: governingUnity <= 1 ? 'Pass' : 'Fail',
      },
    ];

    const flexureDetailRows = [
      ['Mr,x', `${(analysis?.maxMoment ?? 0).toFixed(2)} kip-ft`, 'Maximum absolute bending moment from the factored envelope'],
      ['Fy', `${fy.toFixed(0)} ksi`, 'Specified minimum yield stress'],
      ['Zx', `${selectedShape.Zx.toFixed(2)} in³`, 'Plastic section modulus about the strong axis'],
      ['Mn = Fy × Zx / 12', `${nominalMoment.toFixed(2)} kip-ft`, 'Nominal flexural strength'],
      [momentAvailableLabel, `${designMoment.toFixed(2)} kip-ft`, method === 'LRFD' ? `Design strength using φb = ${aiscFactors.phi_b.toFixed(2)}` : `Allowable strength using Ωb = ${aiscFactors.omega_b.toFixed(2)}`],
      ['Mr,x / available', formatRatio(momentUtilization), 'Flexural unity check'],
    ];

    const shearDetailRows = [
      ['Vr,x', `${(analysis?.maxShear ?? 0).toFixed(2)} k`, 'Maximum absolute shear from the factored envelope'],
      ['A', `${selectedShape.A.toFixed(2)} in²`, 'Gross area used by the simplified shear check'],
      ['Vn = 0.6 × Fy × A', `${nominalShear.toFixed(2)} k`, 'Nominal shear strength'],
      [shearAvailableLabel, `${designShear.toFixed(2)} k`, method === 'LRFD' ? `Design strength using φv = ${aiscFactors.phi_b.toFixed(2)}` : `Allowable strength using Ωv = ${aiscFactors.omega_b.toFixed(2)}`],
      ['Vr,x / available', formatRatio(shearUtilization), 'Shear unity check'],
    ];

    const deflectionDetailRows = [
      ['δmax', `${maximumDeflection.value.toFixed(3)} in`, `Maximum estimated deflection at x = ${maximumDeflection.position.toFixed(2)} ft`],
      ['L', `${spanLength.toFixed(2)} ft`, 'Member span length used for the selected deflection limit'],
      [`δallow = L / ${totalDeflectionLimit}`, `${deflectionAllowable.toFixed(3)} in`, 'Selected total-load deflection limit'],
      ['δmax / δallow', formatRatio(deflectionUtilization), 'Deflection unity check'],
    ];

    return (
      <div className="print-sheet">
        <div className="report-header-grid">
          <div className="report-brand">
            <img src={simplifyStructLogo} alt="SimplifyStruct logo" className="report-brand-image" />
            <div>
              <div className="report-brand-name">SimplifyStruct</div>
              <div className="report-muted">Detailed steel calculation output</div>
            </div>
          </div>
          <div className="report-cell"><span>Project</span><strong>{reportProject || ' '}</strong></div>
          <div className="report-cell"><span>Checked by</span><strong>{reportCheckedBy || ' '}</strong></div>
          <div className="report-cell"><span>Job Ref.</span><strong>{reportJobRef || ' '}</strong></div>
          <div className="report-cell"><span>Approved by</span><strong>{reportApprovedBy || ' '}</strong></div>
          <div className="report-cell"><span>Section</span><strong>{reportSectionName || ' '}</strong></div>
          <div className="report-cell"><span>Sheet no./rev.</span><strong>{reportSheetNumber || ' '}</strong></div>
          <div className="report-cell"><span>Calc. by</span><strong>{reportCalcBy || ' '}</strong></div>
          <div className="report-cell"><span>Date</span><strong>{reportDate || ' '}</strong></div>
        </div>

        <section className="report-section report-title-section">
          <div className="report-detail-title-grid">
            <div>
              <h1>DETAIL REPORT: STEEL BEAM ANALYSIS &amp; DESIGN</h1>
              <p>Member: M1 &nbsp; | &nbsp; Design Standard: {activeAiscYear} &nbsp; | &nbsp; Method: {method}</p>
            </div>
            <div className="report-unity-box">
              <span>Unity Check</span>
              <strong>{formatRatio(governingUnity)}</strong>
              <em>{governingCheck}</em>
            </div>
          </div>
        </section>

        <section className="report-section">
          <h2>Input Data</h2>
          <div className="report-info-grid">
            <div>
              <h3>Member Input</h3>
              <table className="report-table report-property-table">
                <tbody>
                  <tr><td>Shape</td><td>{section}</td><td>I Node</td><td>{analysis?.leftSupport.label || 'N1'}</td></tr>
                  <tr><td>Member Type</td><td>{optionalDisplay(memberType)}</td><td>J Node</td><td>{analysis?.rightSupport.label || 'N2'}</td></tr>
                  <tr><td>Length</td><td>{spanLength.toFixed(3)} ft</td><td>I Support</td><td>{analysis ? supportLabel(analysis.leftSupport.support) : '-'}</td></tr>
                  <tr><td>Material Type</td><td>{optionalDisplay(materialType)}</td><td>J Support</td><td>{analysis ? supportLabel(analysis.rightSupport.support) : '-'}</td></tr>
                  <tr><td>Design Rule</td><td>{optionalDisplay(designRule)}</td><td>Internal Sections</td><td>{internalSections}</td></tr>
                </tbody>
              </table>
            </div>
            <div>
              <h3>Analysis Summary</h3>
              <table className="report-table report-property-table">
                <tbody>
                  <tr><td>Load Combination</td><td>{method} design envelope</td></tr>
                  <tr><td>Total Factored Vertical Load</td><td>{analysis?.totalVerticalLoad.toFixed(2) ?? '0.00'} k</td></tr>
                  <tr><td>Reaction A</td><td>{analysis?.ra.toFixed(2) ?? '0.00'} k</td></tr>
                  <tr><td>Reaction B</td><td>{analysis?.rb.toFixed(2) ?? '0.00'} k</td></tr>
                  <tr><td>Self Weight</td><td>{includeSelfWeight ? `${selfWeightKipPerFt.toFixed(3)} k/ft included` : 'Not included'}</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <h2>Material Properties</h2>
          <table className="report-table report-property-table">
            <tbody>
              <tr><td>Material</td><td>Steel</td><td>Thermal Coeff.</td><td>N/A</td><td>Ry</td><td>N/A</td></tr>
              <tr><td>E</td><td>{elasticModulus.toLocaleString()} ksi</td><td>Density</td><td>0.490 k/ft³</td><td>Fu</td><td>{estimatedFu.toFixed(0)} ksi estimated</td></tr>
              <tr><td>G</td><td>{estimatedG.toFixed(0)} ksi</td><td>Fy</td><td>{fy.toFixed(0)} ksi</td><td>Rt</td><td>N/A</td></tr>
              <tr><td>Nu</td><td>{assumedNu.toFixed(2)}</td><td colSpan={4}>Material values should be verified against the project specification.</td></tr>
            </tbody>
          </table>

          <h2>Shape Properties</h2>
          <table className="report-table report-property-table">
            <tbody>
              <tr><td>d</td><td>{sectionDepth.toFixed(3)} in estimated</td><td>Ix</td><td>{estimatedIx.toFixed(2)} in⁴ estimated</td><td>A</td><td>{selectedShape.A.toFixed(3)} in²</td></tr>
              <tr><td>Sx</td><td>{estimatedSx.toFixed(3)} in³ estimated</td><td>Zx</td><td>{selectedShape.Zx.toFixed(3)} in³</td><td>Self weight</td><td>{selfWeightKipPerFt.toFixed(3)} k/ft</td></tr>
              <tr><td>λf</td><td>{flangeSlenderness.toFixed(2)} estimated</td><td>λw</td><td>{webSlenderness.toFixed(2)} estimated</td><td>KL/r y,z</td><td>{compressionSlendernessY.toFixed(1)} / {compressionSlendernessZ.toFixed(1)} est.</td></tr>
              <tr><td>bf, tf, tw, Iy</td><td colSpan={5}>Not available in the current section database. Reported design checks use available A and Zx values with estimated Ix/Sx for preliminary output.</td></tr>
            </tbody>
          </table>

          <h2>Design Properties</h2>
          <table className="report-table report-property-table">
            <tbody>
              <tr><td>Lb y-y</td><td>{lbyy.toFixed(2)} ft</td><td>Ky-y</td><td>{ky.toFixed(2)}</td><td>Max Defl Ratio</td><td>L/{totalDeflectionLimit}</td></tr>
              <tr><td>Lb z-z</td><td>{lbzz.toFixed(2)} ft</td><td>Kz-z</td><td>{kz.toFixed(2)}</td><td>Lcomp top</td><td>{formatOptionalNumber(lCompTop, 2, ' ft')}</td></tr>
              <tr><td>Lcomp bot</td><td>{formatOptionalNumber(lCompBottom, 2, ' ft')}</td><td>Ltorque</td><td>{formatOptionalNumber(lTorque, 2, ' ft')}</td><td>Function</td><td>{optionalDisplay(memberType)}</td></tr>
              <tr><td>Live Defl Ratio</td><td>L/{deflectionLimit}</td><td>y sway</td><td>{optionalDisplay(ySway)}</td><td>Max Defl Location</td><td>{maximumDeflection.position.toFixed(2)} ft</td></tr>
              <tr><td>z sway</td><td>{optionalDisplay(zSway)}</td><td>Seismic DR</td><td>{optionalDisplay(seismicDesignRule)}</td><td>Span</td><td>{spanLength.toFixed(2)} ft</td></tr>
            </tbody>
          </table>

          {includeModel && <div className="report-diagram-wrap">{renderReportBeamDiagram('geometry')}</div>}
        </section>

        <section className="report-section report-page-break">
          <h2>Loads and Analysis Diagrams</h2>
          <h3>Load Combination Factors</h3>
          <table className="report-table report-factor-table">
            <thead><tr><th>Load case</th><th>Case name</th><th>Factor</th></tr></thead>
            <tbody>
              {(Object.keys(loadFactors) as LoadCase[]).map((loadCase) => (
                <tr key={loadCase}><td>{loadCase}</td><td>{loadCaseNames[loadCase]}</td><td>{loadFactors[loadCase].toFixed(2)}</td></tr>
              ))}
            </tbody>
          </table>

          <h3>Element Loads</h3>
          <table className="report-table">
            <thead><tr><th>Element</th><th>Load case</th><th>Load Type</th><th>Orientation</th><th>Description</th></tr></thead>
            <tbody>
              {reportElementLoads.length === 0 ? <tr><td colSpan={5}>No element loads entered.</td></tr> : reportElementLoads.map((load) => (
                <tr key={load.id}><td>{load.element}</td><td>{load.loadCase}</td><td>{load.loadType}</td><td>{load.orientation}</td><td>{load.description}</td></tr>
              ))}
            </tbody>
          </table>

          {includeModel && <div className="report-diagram-wrap">{renderReportBeamDiagram('loading')}</div>}

          <h3>Diagrams</h3>
          <div className="report-diagram-grid report-diagram-grid-3">
            <div className="report-diagram-card"><h4>Deflection (in)</h4>{renderReportBeamDiagram('deflection')}</div>
            <div className="report-diagram-card"><h4>Shear Force (k)</h4>{renderReportBeamDiagram('shear')}</div>
            <div className="report-diagram-card"><h4>Moment (kip-ft)</h4>{renderReportBeamDiagram('moment')}</div>
          </div>

          {includeResults && (
            <>
              <h3>Envelope Results</h3>
              <div className="report-result-grid">
                <div><strong>{(analysis?.maxMoment ?? 0).toFixed(2)}</strong><span>Moment envelope (kip-ft)</span></div>
                <div><strong>{(analysis?.maxShear ?? 0).toFixed(2)}</strong><span>Shear envelope (k)</span></div>
                <div><strong>{maximumDeflection.value.toFixed(3)}</strong><span>Deflection envelope (in)</span></div>
              </div>
              <table className="report-table">
                <thead><tr><th>Member</th><th>Maximum Deflection Location</th><th>Local Deflection</th><th>Reaction A</th><th>Reaction B</th><th>Total Vertical Load</th></tr></thead>
                <tbody><tr><td>M1</td><td>{maximumDeflection.position.toFixed(2)} ft</td><td>{maximumDeflection.value.toFixed(3)} in</td><td>{analysis?.ra.toFixed(2) ?? '0.00'} k</td><td>{analysis?.rb.toFixed(2) ?? '0.00'} k</td><td>{analysis?.totalVerticalLoad.toFixed(2) ?? '0.00'} k</td></tr></tbody>
              </table>
            </>
          )}
        </section>

        {includeCalculations && (
          <section className="report-section report-page-break">
            <h2>{activeAiscYear}: {method} Code Check</h2>
            <table className="report-table report-check-table">
              <thead><tr><th>Limit State</th><th>Required</th><th>Available</th><th>Unity Check</th><th>Result</th></tr></thead>
              <tbody>
                {limitStateRows.map((row) => (
                  <tr key={row.label}>
                    <td>{row.label}</td>
                    <td>{row.required}</td>
                    <td>{row.available}</td>
                    <td>{row.unity}</td>
                    <td className={row.result === 'Pass' ? 'report-pass' : 'report-fail'}>{row.result}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h3>Flexural Analysis: Strong Axis</h3>
            <table className="report-table report-formula-table">
              <tbody>
                {flexureDetailRows.map(([symbol, value, description]) => (
                  <tr key={symbol}><td className="report-formula-symbol">{symbol}</td><td>{value}</td><td>{description}</td></tr>
                ))}
                <tr><td colSpan={3} className={momentUtilization <= 1 ? 'report-pass' : 'report-fail'}>{momentUtilization <= 1 ? 'PASS - Design flexural strength exceeds required flexural strength.' : 'FAIL - Required flexural strength exceeds design flexural strength.'}</td></tr>
              </tbody>
            </table>

            <h3>Shear Analysis</h3>
            <table className="report-table report-formula-table">
              <tbody>
                {shearDetailRows.map(([symbol, value, description]) => (
                  <tr key={symbol}><td className="report-formula-symbol">{symbol}</td><td>{value}</td><td>{description}</td></tr>
                ))}
                <tr><td colSpan={3} className={shearUtilization <= 1 ? 'report-pass' : 'report-fail'}>{shearUtilization <= 1 ? 'PASS - Design shear strength exceeds required shear strength.' : 'FAIL - Required shear strength exceeds design shear strength.'}</td></tr>
              </tbody>
            </table>

            <h3>Deflection Check</h3>
            <table className="report-table report-formula-table">
              <tbody>
                {deflectionDetailRows.map(([symbol, value, description]) => (
                  <tr key={symbol}><td className="report-formula-symbol">{symbol}</td><td>{value}</td><td>{description}</td></tr>
                ))}
                <tr><td colSpan={3} className={deflectionUtilization <= 1 ? 'report-pass' : 'report-fail'}>{deflectionUtilization <= 1 ? 'PASS - Design deflection is within the selected limit.' : 'FAIL - Design deflection exceeds the selected limit.'}</td></tr>
              </tbody>
            </table>

            <h3>Safety Factors</h3>
            <table className="report-table report-compact-table">
              <tbody>
                <tr><td>Flexure</td><td>{method === 'LRFD' ? `φb = ${aiscFactors.phi_b.toFixed(2)}` : `Ωb = ${aiscFactors.omega_b.toFixed(2)}`}</td></tr>
                <tr><td>Shear</td><td>{method === 'LRFD' ? `φv = ${aiscFactors.phi_b.toFixed(2)}` : `Ωv = ${aiscFactors.omega_b.toFixed(2)}`}</td></tr>
                <tr><td>Tension</td><td>{method === 'LRFD' ? `φt = ${aiscFactors.phi_t.toFixed(2)}` : `Ωt = ${aiscFactors.omega_t.toFixed(2)}`}</td></tr>
              </tbody>
            </table>

            <p className="report-muted">
              This detailed output is intended to make the calculation trail easier to review. Values based on missing geometric properties are identified as estimated and should be verified before construction use.
            </p>
          </section>
        )}
      </div>
    );
  };

  const refreshProjectDocuments = () => {
    const activeProject = getActiveProject();
    setProjectDocuments(activeProject ? getProjectDocuments(activeProject.id) : []);
  };

  const openSaveOutputModal = () => {
    if (!canRunDesign) {
      setSaveMessage('Complete the required steel beam fields before saving output.');
      setShowSaveOutputModal(true);
      return;
    }

    const activeProject = getActiveProject();

    refreshProjectDocuments();
    setSaveMessage('');
    setSaveSucceeded(false);

    if (!activeProject || getSessionMode() === 'quick') {
      setSaveMessage('Open or create a project before saving calculation output. Quick calculations can be printed, but they are not saved to project documents.');
    }

    if (editingDocumentId) {
      setSaveMode('overwrite');
      setSelectedDocumentId(editingDocumentId);
    }

    if (!documentName.trim()) {
      setDocumentName(`${section} Beam Design`);
    }

    setShowSaveOutputModal(true);
  };

  const buildDocumentPayload = () => {
    const wrapper = window.document.createElement('div');
    wrapper.innerHTML = '';
    const reportElement = window.document.querySelector('.beam-print-report .print-sheet');
    const reportHtml = reportElement ? reportElement.outerHTML : '<div>Report preview was not available.</div>';

    return {
      name: documentName.trim() || `${section} Beam Design`,
      type: 'Steel Beam Design',
      module: 'Steel' as const,
      status: 'Active' as const,
      sourcePath: '/steel',
      inputs: {
        method,
        memberType,
        materialType,
        designRule,
        internalSections,
        ky,
        kz,
        lbyy,
        lbzz,
        lCompTop,
        lCompBottom,
        lTorque,
        ySway,
        zSway,
        seismicDesignRule,
        shapeTypeFilter,
        section,
        fy,
        unbracedLength,
        deflectionLimit,
        totalDeflectionLimit,
        includeSelfWeight,
        loadFactors,
        nodes,
        loads,
        reportHeader: getReportHeaderInfo(),
      },
      summary: {
        designStandard: activeAiscYear,
        maxMoment: analysis?.maxMoment ?? 0,
        maxShear: analysis?.maxShear ?? 0,
        maxDeflection: maximumDeflection.value,
        controllingUtilization,
        passing: isPassing,
      },
      reportHtml,
    };
  };

  const handleSaveOutput = () => {
    const activeProject = getActiveProject();

    if (!activeProject || getSessionMode() === 'quick') {
      setSaveSucceeded(false);
      setSaveMessage('No active project is selected. Go to Projects, create/open a project, then save this output.');
      return;
    }

    const payload = buildDocumentPayload();

    if (reportHeaderSaveScope === 'default') {
      saveReportHeaderDefaults(getReportHeaderInfo());
    }

    if (saveMode === 'overwrite') {
      if (!selectedDocumentId) {
        setSaveSucceeded(false);
        setSaveMessage('Select an existing document to overwrite.');
        return;
      }

      const overwrittenDocument = overwriteProjectDocument(selectedDocumentId, payload);
      if (overwrittenDocument) {
        setEditingDocumentId(overwrittenDocument.id);
        setLoadedDocumentName(overwrittenDocument.name);
      }
      setSaveSucceeded(true);
      setSaveMessage(`Existing editable project document overwritten${reportHeaderSaveScope === 'default' ? ' and header saved as default' : ''}.`);
    } else {
      const savedDocument = saveNewProjectDocument({
        ...payload,
        projectId: activeProject.id,
      });
      setSelectedDocumentId(savedDocument.id);
      setEditingDocumentId(savedDocument.id);
      setLoadedDocumentName(savedDocument.name);
      setDocumentName(savedDocument.name);
      setSaveMode('overwrite');
      setSaveSucceeded(true);
      setSaveMessage(`Saved as a new editable project document${savedDocument.name !== payload.name ? ` named "${savedDocument.name}"` : ''}${reportHeaderSaveScope === 'default' ? ' and header saved as default' : ''}.`);
    }

    refreshProjectDocuments();
  };

  const printStyles = (
    <style>{`
      .beam-print-report { display: none !important; }
      .beam-screen-report .print-sheet { margin: 0 auto; max-width: 8.5in; }
      .print-sheet { background: white; color: #111827; font-family: Arial, Helvetica, sans-serif; font-size: 11px; line-height: 1.25; padding: 0.25in; }
      .report-header-grid { display: grid; grid-template-columns: 2.1fr 1.7fr 1.2fr; border: 1px solid #111827; }
      .report-brand { grid-row: span 4; display: flex; align-items: center; gap: 10px; padding: 10px; border-right: 1px solid #111827; }
      .report-logo { width: 34px; height: 28px; border: 2px solid #0369a1; color: #0369a1; display: flex; align-items: center; justify-content: center; font-weight: 800; }
  .report-brand-image { width: 64px; height: auto; object-fit: contain; }
      .report-brand-name { font-size: 18px; font-weight: 800; }
      .report-muted { color: #4b5563; font-size: 10px; }
      .report-cell { min-height: 34px; padding: 4px 6px; border-right: 1px solid #111827; border-bottom: 1px solid #111827; display: flex; flex-direction: column; gap: 4px; }
      .report-cell span { font-size: 9px; color: #374151; }
      .report-cell strong { min-height: 12px; font-size: 11px; }
      .report-section { border: 1px solid #111827; border-top: 0; padding: 16px 22px; break-inside: avoid; }
      .report-title-section { border-top: 1px solid #111827; margin-top: 8px; }
      .report-section h1 { margin: 0 0 8px; font-size: 15px; text-decoration: underline; }
      .report-section h2 { margin: 0 0 14px; font-size: 14px; text-decoration: underline; }
      .report-section h3 { margin: 14px 0 8px; font-size: 12px; }
      .report-detail-title-grid { display: grid; grid-template-columns: 1fr 130px; gap: 16px; align-items: center; }
      .report-unity-box { border: 1px solid #111827; padding: 8px; text-align: center; background: #f9fafb; }
      .report-unity-box span { display: block; font-size: 9px; color: #4b5563; text-transform: uppercase; }
      .report-unity-box strong { display: block; font-size: 22px; line-height: 1.1; }
      .report-unity-box em { display: block; font-size: 10px; color: #374151; font-style: normal; }
      .report-info-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
      .report-table { width: 100%; border-collapse: collapse; margin: 8px 0 10px; }
      .report-table th, .report-table td { border: 1px solid #111827; padding: 3px 5px; vertical-align: top; }
      .report-table th { font-weight: 700; background: #f3f4f6; }
      .report-property-table td:nth-child(odd) { width: 16%; font-weight: 700; color: #374151; background: #f9fafb; }
      .report-check-table td:nth-child(4), .report-check-table th:nth-child(4), .report-check-table td:nth-child(5), .report-check-table th:nth-child(5) { text-align: center; }
      .report-formula-table td { border-left: 0; border-right: 0; }
      .report-formula-symbol { width: 30%; font-family: Georgia, 'Times New Roman', serif; font-size: 12px; background: #f9fafb; }
      .report-factor-table { max-width: 560px; }
      .report-compact-table { max-width: 360px; }
      .report-diagram-wrap { margin: 8px 0 14px; text-align: center; }
      .report-diagram-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin: 8px 0 14px; }
      .report-diagram-grid-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .report-diagram-card { border: 1px solid #111827; padding: 8px; }
      .report-diagram-card h4 { margin: 0 0 6px; font-size: 11px; }
      .report-diagram { width: 100%; max-height: 170px; border: 0; }
      .report-result-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 10px 0; }
      .report-result-grid div { border: 1px solid #111827; padding: 8px; display: flex; flex-direction: column; gap: 5px; }
      .report-result-grid strong { font-size: 20px; }
      .report-two-col { display: grid; grid-template-columns: 1fr 160px; gap: 18px; align-items: start; }
      .report-section-sketch { width: 150px; height: 130px; }
      .report-pass { font-weight: 700; color: #166534; }
      .report-fail { font-weight: 700; color: #991b1b; }
      .report-page-break { break-before: page; }
      @media print {
        @page { size: letter; margin: 0.35in; }
        body * { visibility: hidden !important; }
        .beam-print-report, .beam-print-report * { visibility: visible !important; }
        .beam-print-report { display: block !important; position: absolute; left: 0; top: 0; width: 100%; }
        .print-sheet { padding: 0; font-size: 10.5px; }
        .report-section { break-inside: avoid; }
        .report-page-break { break-before: page; }
      }
    `}</style>
  );

  return (
    <div className="space-y-6">
      {printStyles}
      <div className="beam-print-report" style={{ display: 'none' }}>{renderPrintableReport()}</div>
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-blue-700 italic">Steel Beam Analysis & Design</h2>
            <p className="text-sm text-gray-500">2D beam workspace for supports, loads, envelopes, and section utilization.</p>
            {loadedDocumentName && (
              <div className="mt-2 inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                Editing saved document: {loadedDocumentName}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={openSaveOutputModal} disabled={!canRunDesign} className="inline-flex w-fit items-center gap-2 rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50">
              <Save size={16} /> Save Output
            </button>
            <button onClick={() => setShowOutputPreview((prev) => !prev)} disabled={!canRunDesign} className="inline-flex w-fit items-center gap-2 rounded border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50">
              <Download size={16} /> {showOutputPreview ? 'Hide output' : 'Preview output'}
            </button>
            <button onClick={() => window.print()} disabled={!canRunDesign} className="inline-flex w-fit items-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
              <Printer size={16} /> Print output
            </button>
          </div>
        </div>


        <div className="grid grid-cols-1 gap-0 xl:grid-cols-[minmax(0,1fr)_220px]">
          <div className="space-y-4 p-4">
            <div className="overflow-x-auto">{renderDiagram()}</div>
            {(displayOptions.moment || displayOptions.shear || displayOptions.deflection) && (
              <div className="min-h-[220px]">
                {canRunDesign && (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {displayOptions.moment && renderResultDiagram('moment')}
                    {displayOptions.shear && renderResultDiagram('shear')}
                    {displayOptions.deflection && renderResultDiagram('deflection')}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="border-t border-gray-200 bg-gray-50 p-4 xl:border-l xl:border-t-0">
            <div className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-500">Display options</div>
            <div className="space-y-2">
              {([
                ['loading', 'Loading'],
                ['moment', 'Moment'],
                ['shear', 'Shear'],
                ['deflection', 'Deflection'],
              ] as Array<[DisplayKey, string]>).map(([key, label]) => (
                <label key={key} className="flex items-center justify-between rounded border border-gray-200 bg-white px-3 py-2 text-sm">
                  <span>{label}</span>
                  <input type="checkbox" checked={displayOptions[key]} onChange={(event) => setDisplayOptions((prev) => ({ ...prev, [key]: event.target.checked }))} />
                </label>
              ))}
            </div>
            <div className="mt-4 rounded border border-gray-200 bg-white p-3 text-xs text-gray-600">
              <div className="font-semibold text-gray-900">Design span</div>
              <div>{analysis ? `${analysis.fullLength.toFixed(2)} ft` : 'Check geometry'}</div>
              <div className="mt-2 font-semibold text-gray-900">Primary supports</div>
              <div>{analysis ? `${supportLabel(analysis.leftSupport.support)} / ${supportLabel(analysis.rightSupport.support)}` : 'Check supports'}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto border-b border-gray-200 bg-gray-50">
          <div className="flex min-w-max gap-1 px-3 pt-3">
            {designPanels.map((panel) => (
              <button
                key={panel}
                onClick={() => setActivePanel(panel)}
                className={`rounded-t border px-3 py-2 text-xs font-semibold transition-colors ${activePanel === panel ? 'border-gray-200 border-b-white bg-white text-blue-700' : 'border-transparent text-gray-500 hover:bg-white hover:text-gray-800'}`}
              >
                {panel}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 p-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div>{renderPanel()}</div>

          <div className="space-y-4">
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="mb-3 text-sm font-semibold text-gray-900">Selected section</div>
              <div className="flex items-center gap-4">
                <svg viewBox="0 0 120 120" className="h-24 w-24 shrink-0 rounded border border-gray-200 bg-gray-50">
                  <rect x="24" y="16" width="72" height="14" rx="2" fill="#cbd5e1" stroke="#64748b" />
                  <rect x="52" y="30" width="16" height="60" fill="#cbd5e1" stroke="#64748b" />
                  <rect x="24" y="90" width="72" height="14" rx="2" fill="#cbd5e1" stroke="#64748b" />
                  <line x1="104" y1="16" x2="104" y2="104" stroke="#94a3b8" strokeDasharray="3,3" />
                  <line x1="24" y1="112" x2="96" y2="112" stroke="#94a3b8" strokeDasharray="3,3" />
                </svg>
                <div className="text-sm text-gray-700">
                  <div className="font-bold text-gray-900">{section}</div>
                  <div>Type = {selectedShape.Type || 'Other'}</div>
                  <div>Area = {selectedShape.A.toFixed(2)} in²</div>
                  <div>Zx = {selectedShape.Zx.toFixed(1)} in³</div>
                  <div>Fy = {fy.toFixed(0)} ksi</div>
                  <div>Method = {method}</div>
                </div>
              </div>
            </div>

            <div className={`rounded-lg border p-4 ${isPassing ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-semibold text-gray-900">Governing utilization</div>
                {isPassing ? <CheckCircle2 className="text-green-600" size={20} /> : <AlertCircle className="text-red-600" size={20} />}
              </div>
              <div className="text-3xl font-bold text-gray-900">{formatRatio(controllingUtilization)}</div>
              <div className={`mt-1 text-sm font-semibold ${isPassing ? 'text-green-700' : 'text-red-700'}`}>
                {isPassing ? 'PASS' : 'REVIEW REQUIRED'}
              </div>
              <div className="mt-2 text-xs text-gray-600">
                Governing check: <span className="font-semibold">{governingLimitState}</span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <div className={`rounded border px-2 py-1 ${governingLimitState === 'Moment' ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-gray-200 bg-white text-gray-600'}`}>
                  <div>Moment</div>
                  <strong>{formatRatio(momentUtilization)}</strong>
                </div>
                <div className={`rounded border px-2 py-1 ${governingLimitState === 'Shear' ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-gray-200 bg-white text-gray-600'}`}>
                  <div>Shear</div>
                  <strong>{formatRatio(shearUtilization)}</strong>
                </div>
                <div className={`rounded border px-2 py-1 ${governingLimitState === 'Deflection' ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-gray-200 bg-white text-gray-600'}`}>
                  <div>Defl.</div>
                  <strong>{formatRatio(deflectionUtilization)}</strong>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm">
              <div className="mb-3 font-semibold text-gray-900">Forces and reactions</div>
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2 rounded bg-gray-50 p-2">
                  <span>Moment</span>
                  <span className="text-right font-semibold">{analysis?.maxMoment.toFixed(2) ?? '0.00'} kip-ft</span>
                </div>
                <div className="grid grid-cols-2 gap-2 rounded bg-gray-50 p-2">
                  <span>Shear</span>
                  <span className="text-right font-semibold">{analysis?.maxShear.toFixed(2) ?? '0.00'} k</span>
                </div>
                <div className="grid grid-cols-2 gap-2 rounded bg-gray-50 p-2">
                  <span>RA</span>
                  <span className="text-right font-semibold">{analysis?.ra.toFixed(2) ?? '0.00'} k</span>
                </div>
                <div className="grid grid-cols-2 gap-2 rounded bg-gray-50 p-2">
                  <span>RB</span>
                  <span className="text-right font-semibold">{analysis?.rb.toFixed(2) ?? '0.00'} k</span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-500">
              Summary cards show only section, governing unity, and primary force/reaction values. Detailed checks are listed below.
            </div>
          </div>
        </div>
      </div>


      {renderBrowserDesignChecks()}

      {showSaveOutputModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-gray-900/50 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-gray-200 p-5">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Save calculation output</h3>
                <p className="mt-1 text-sm text-gray-500">Save the report and current editable inputs into the active project as a project document.</p>
              </div>
              <button onClick={() => setShowSaveOutputModal(false)} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-5 p-5">
              {saveMessage && (
                <div className={`rounded border px-3 py-2 text-sm ${saveMessage.includes('Saved') || saveMessage.includes('overwritten') ? 'border-green-200 bg-green-50 text-green-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                  {saveMessage}
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className={`cursor-pointer rounded-lg border p-4 ${saveMode === 'new' ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100' : 'border-gray-200 bg-white'}`}>
                  <div className="flex items-center gap-2">
                    <input type="radio" checked={saveMode === 'new'} onChange={() => setSaveMode('new')} />
                    <span className="font-semibold text-gray-900">Save as new document</span>
                  </div>
                  <p className="mt-2 text-sm text-gray-500">Create a new editable saved calculation in the active project.</p>
                </label>

                <label className={`cursor-pointer rounded-lg border p-4 ${saveMode === 'overwrite' ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100' : 'border-gray-200 bg-white'}`}>
                  <div className="flex items-center gap-2">
                    <input type="radio" checked={saveMode === 'overwrite'} onChange={() => setSaveMode('overwrite')} />
                    <span className="font-semibold text-gray-900">Overwrite existing document</span>
                  </div>
                  <p className="mt-2 text-sm text-gray-500">Replace an existing saved calculation with the current inputs and output.</p>
                </label>
              </div>

              {saveMode === 'new' ? (
                <label className="block text-sm font-medium text-gray-700">
                  Document name
                  <input
                    value={documentName}
                    onChange={(event) => setDocumentName(event.target.value)}
                    className="mt-1 w-full rounded-md border border-gray-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    placeholder="Example: W12x26 Beam Check - Grid B"
                  />
                </label>
              ) : (
                <label className="block text-sm font-medium text-gray-700">
                  Select document to overwrite
                  <select
                    value={selectedDocumentId}
                    onChange={(event) => setSelectedDocumentId(event.target.value)}
                    className="mt-1 w-full rounded-md border border-gray-300 bg-white p-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">Select an existing document...</option>
                    {projectDocuments.map((document) => (
                      <option key={document.id} value={document.id}>
                        {document.name} — {document.type}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <div className="rounded bg-gray-50 p-3 text-xs text-gray-600">
                Saved documents are stored in this browser for now. The document can be opened from the Documents page for editing later.
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-200 p-5">
              <button onClick={() => setShowSaveOutputModal(false)} className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                {saveSucceeded ? 'Close' : 'Cancel'}
              </button>
              <button onClick={handleSaveOutput} className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showOutputPreview && (
        <div className="beam-screen-report rounded-lg border border-gray-200 bg-gray-100 p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Printable output preview</h3>
              <p className="text-sm text-gray-500">This is the report layout that will be sent to print.</p>
            </div>
            <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
              <Printer size={16} /> Print output
            </button>
          </div>
          {renderPrintableReport()}
        </div>
      )}
    </div>
  );
};
