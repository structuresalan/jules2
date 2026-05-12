import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  MousePointer2, Hand, ZoomIn, Maximize2, Crosshair,
  ArrowUpRight, Cloud, Type, Square, MessageSquare, StickyNote,
  PenLine, Highlighter, Eraser, Ruler, Minus, TrendingUp, Hexagon,
  Link, Camera, FileText,
  Layers, LayoutGrid, Magnet,
  Undo2, Redo2, MoreHorizontal,
  ChevronRight, ChevronDown, Plus, X,
  Eye, EyeOff, Trash2, Upload,
  Filter, RefreshCw, ChevronLeft,
  Image, Tag,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type Tool =
  | 'select' | 'pan' | 'zoom' | 'fit' | 'zoom-area'
  | 'arrow' | 'cloud' | 'text' | 'box' | 'callout'
  | 'dimension' | 'distance' | 'angle' | 'area'
  | 'note' | 'photo' | 'file' | 'link'
  | 'highlighter' | 'pen' | 'eraser' | 'color'
  | 'layers' | 'scale' | 'grid' | 'snap'
  | 'undo' | 'redo' | 'more';

type MarkupType =
  | 'arrow' | 'cloud' | 'text' | 'box' | 'callout'
  | 'pen' | 'highlighter' | 'dimension' | 'distance' | 'image';

type Priority = 'high' | 'medium' | 'low';
type MarkupStatus = 'field-verify' | 'monitor' | 'complete' | 'open';
type HandlePos = 'tl' | 'tr' | 'bl' | 'br';

interface Pt { x: number; y: number }

interface Markup {
  id: string;
  type: MarkupType;
  number: number;
  points: Pt[];
  text: string;
  color: string;
  strokeWidth: number;
  fontSize: number;
  opacity: number;
  priority: Priority;
  status: MarkupStatus;
  layerId: string;
  createdAt: string;
  imageData?: string;
}

interface Layer { id: string; name: string; visible: boolean }
interface BoardItem { id: string; name: string; parentId: string | null }

type ActivePanel =
  | 'color' | 'photo' | 'file' | 'note' | 'scale'
  | 'report' | 'export' | 'photo-library' | 'link' | null;

// ─── Helpers ─────────────────────────────────────────────────────────────────

let _ctr = 100;
const genId = () => `m_${++_ctr}`;

function s2c(sx: number, sy: number, pan: Pt, zoom: number): Pt {
  return { x: (sx - pan.x) / zoom, y: (sy - pan.y) / zoom };
}

function mkBounds(m: Markup) {
  if (!m.points.length) return { x: 0, y: 0, w: 0, h: 0 };
  const xs = m.points.map(p => p.x), ys = m.points.map(p => p.y);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x || 1, h: Math.max(...ys) - y || 1 };
}

function cloudPath(x: number, y: number, w: number, h: number): string {
  const bW = Math.max(w, 20), bH = Math.max(h, 20);
  const nX = Math.max(3, Math.round(bW / 28)), nY = Math.max(2, Math.round(bH / 28));
  const rx = bW / nX / 2, ry = bH / nY / 2;
  let d = `M ${x} ${y}`;
  for (let i = 0; i < nX; i++) d += ` a ${rx} ${rx} 0 0 1 ${bW / nX} 0`;
  for (let i = 0; i < nY; i++) d += ` a ${ry} ${ry} 0 0 1 0 ${bH / nY}`;
  for (let i = 0; i < nX; i++) d += ` a ${rx} ${rx} 0 0 1 ${-bW / nX} 0`;
  for (let i = 0; i < nY; i++) d += ` a ${ry} ${ry} 0 0 1 0 ${-bH / nY}`;
  return d + ' Z';
}

// ─── Constants ───────────────────────────────────────────────────────────────

const COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#000000','#ffffff'];

const STATUS_CFG: Record<MarkupStatus, { label: string; cls: string }> = {
  'field-verify': { label: 'Field Verify', cls: 'bg-red-500/20 text-red-400 border border-red-500/30' },
  'monitor':      { label: 'Monitor',      cls: 'bg-amber-500/20 text-amber-400 border border-amber-500/30' },
  'complete':     { label: 'Complete',     cls: 'bg-green-500/20 text-green-400 border border-green-500/30' },
  'open':         { label: 'Open',         cls: 'bg-slate-500/20 text-slate-400 border border-slate-500/30' },
};

const PRI_CFG: Record<Priority, { label: string; dot: string }> = {
  high:   { label: 'High',   dot: 'bg-red-500' },
  medium: { label: 'Medium', dot: 'bg-amber-500' },
  low:    { label: 'Low',    dot: 'bg-slate-400' },
};

const HANDLE_CURSORS: Record<HandlePos, string> = {
  tl: 'nw-resize', tr: 'ne-resize', bl: 'sw-resize', br: 'se-resize',
};

const TEXT_EDITABLE: MarkupType[] = ['text', 'callout', 'box', 'cloud'];
const RESIZABLE_TYPES: MarkupType[] = ['arrow','cloud','text','box','callout','dimension','distance','image'];

const DEFAULT_LAYERS: Layer[] = [
  { id: 'l1', name: 'Markups',    visible: true },
  { id: 'l2', name: 'Dimensions', visible: true },
  { id: 'l3', name: 'Notes',      visible: true },
  { id: 'l4', name: 'Photos',     visible: true },
  { id: 'l5', name: 'Reference',  visible: true },
];

const BOARD_TREE: BoardItem[] = [
  { id: 'cat1', name: '01 - General',         parentId: null },
  { id: 'cat2', name: '02 - Architectural',   parentId: null },
  { id: 'cat3', name: '03 - Structural',      parentId: null },
  { id: 'b1',   name: 'Level 2 Framing Plan', parentId: 'cat3' },
  { id: 'b2',   name: 'Roof Framing Plan',    parentId: 'cat3' },
  { id: 'b3',   name: 'South Elevation',      parentId: 'cat3' },
  { id: 'b4',   name: 'East Elevation',       parentId: 'cat3' },
  { id: 'b5',   name: 'Typical Sections',     parentId: 'cat3' },
  { id: 'cat4', name: '04 - MEP',             parentId: null },
  { id: 'cat5', name: '05 - Site',            parentId: null },
  { id: 'cat6', name: '06 - Inspections',     parentId: null },
  { id: 'cat7', name: 'Photos & Documents',   parentId: null },
  { id: 'b6',   name: 'Site Photo Set',       parentId: 'cat7' },
];

const SEED: Markup[] = [
  { id: 's1', type: 'cloud', number: 1, points: [{ x: 560, y: 100 }, { x: 760, y: 180 }], text: 'B12 - Corrosion at seat connection, field verify section loss.', color: '#ef4444', strokeWidth: 2, fontSize: 14, opacity: 1, priority: 'high',   status: 'field-verify', layerId: 'l1', createdAt: '2025-05-12T00:00:00Z' },
  { id: 's2', type: 'cloud', number: 2, points: [{ x: 600, y: 210 }, { x: 800, y: 290 }], text: 'B18 - Paint peeling and rust scale, check bottom flange.',      color: '#3b82f6', strokeWidth: 2, fontSize: 14, opacity: 1, priority: 'medium', status: 'field-verify', layerId: 'l1', createdAt: '2025-05-12T00:00:00Z' },
  { id: 's3', type: 'cloud', number: 3, points: [{ x: 560, y: 360 }, { x: 760, y: 440 }], text: 'B31 - Section loss at midspan, verify remaining thickness.',     color: '#22c55e', strokeWidth: 2, fontSize: 14, opacity: 1, priority: 'high',   status: 'field-verify', layerId: 'l1', createdAt: '2025-05-12T00:00:00Z' },
];

const TOOL_NAMES: Partial<Record<Tool, string>> = {
  select: 'Select', pan: 'Pan', zoom: 'Zoom', fit: 'Fit', 'zoom-area': 'Zoom Area',
  arrow: 'Arrow', cloud: 'Cloud', text: 'Text', box: 'Box', callout: 'Callout',
  dimension: 'Dimension', distance: 'Distance', angle: 'Angle', area: 'Area',
  note: 'Note', photo: 'Photo', file: 'File', link: 'Link',
  highlighter: 'Highlighter', pen: 'Pen', eraser: 'Eraser', color: 'Color',
  layers: 'Layers', scale: 'Scale', grid: 'Grid', snap: 'Snap',
  undo: 'Undo', redo: 'Redo', more: 'More',
};

// ─── Toolbar button ───────────────────────────────────────────────────────────

function TB({ tid, active, onClick, icon, label, toggle }: {
  tid: string; active?: boolean; onClick: () => void;
  icon: React.ReactNode; label: string; toggle?: boolean;
}) {
  return (
    <button data-testid={tid} onClick={onClick} title={label}
      className={`flex flex-col items-center gap-0.5 px-1.5 py-1 rounded text-[10px] transition-colors min-w-[40px] ${
        active || toggle ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'
      }`}>
      {icon}
      <span className="leading-none">{label}</span>
    </button>
  );
}
function Sep() { return <div className="w-px h-9 bg-slate-700 mx-0.5 self-center shrink-0" />; }

// ─── Main component ───────────────────────────────────────────────────────────

export function VisualWorkspace() {
  const containerRef  = useRef<HTMLDivElement>(null);
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Viewport (ref + state pair so event handlers always see latest value)
  const [pan,  setPanState]  = useState<Pt>({ x: 0, y: 0 });
  const [zoom, setZoomState] = useState(1);
  const panRef  = useRef<Pt>({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const setPan  = useCallback((p: Pt)  => { panRef.current  = p; setPanState(p);  }, []);
  const setZoom = useCallback((z: number) => { zoomRef.current = z; setZoomState(z); }, []);
  const [canvasSize, setCanvasSize] = useState({ w: 900, h: 600 });

  // Background image
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [bgSize,  setBgSize]  = useState({ w: 1200, h: 900 });

  // Active tool (ref + state)
  const [tool, setToolState] = useState<Tool>('select');
  const toolRef = useRef<Tool>('select');
  const setTool = useCallback((t: Tool) => { toolRef.current = t; setToolState(t); }, []);

  // Colour (ref + state so drawing handlers see latest)
  const [color, setColor] = useState('#ef4444');
  const colorRef = useRef('#ef4444');
  useEffect(() => { colorRef.current = color; }, [color]);

  // View toggles
  const [showGrid,     setShowGrid]     = useState(false);
  const [snapEnabled,  setSnapEnabled]  = useState(false);
  const [showLayers,   setShowLayers]   = useState(true);
  const [showInspector,setShowInspector]= useState(true);
  const [activePanel,  setActivePanel]  = useState<ActivePanel>(null);
  const [scaleSet,     setScaleSet]     = useState(false);

  // Boards
  const [activeBoardId, setActiveBoardId] = useState('b1');
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['cat3', 'cat7']));

  // Layers
  const [layers, setLayers] = useState<Layer[]>(DEFAULT_LAYERS);

  // Markups
  const [boardMarkups, setBoardMarkups] = useState<Record<string, Markup[]>>({ b1: SEED });
  const [selectedId,   setSelectedId]   = useState<string | null>(null);
  const [counter,      setCounter]      = useState(SEED.length + 1);

  // In-place text editing
  const [editingId,   setEditingId]   = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  // History
  const hist = useRef<{ snaps: Record<string, Markup[]>[]; idx: number }>({
    snaps: [{ b1: SEED }], idx: 0,
  });
  const [, setHistIdx] = useState(0);

  // Drawing refs
  const isDrawing       = useRef(false);
  const drawStart       = useRef<Pt | null>(null);
  const drawCurrent     = useRef<Pt | null>(null);
  const penPts          = useRef<Pt[]>([]);
  const isPanning       = useRef(false);
  const panStart        = useRef<Pt | null>(null);
  const panOrigin       = useRef<Pt | null>(null);
  const moveOrigin      = useRef<Pt | null>(null);
  const moveMarkupPts   = useRef<Pt[] | null>(null);

  // Resize refs
  const resizingHandle  = useRef<HandlePos | null>(null);
  const resizeStartPt   = useRef<Pt | null>(null);
  const resizeOriginPts = useRef<Pt[] | null>(null);

  const [preview, setPreview] = useState<{ type: string; start: Pt; cur: Pt; pts?: Pt[] } | null>(null);

  const markups       = boardMarkups[activeBoardId] ?? [];
  const selectedMarkup = markups.find(m => m.id === selectedId) ?? null;

  // ── Resize observer ───────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      setCanvasSize({ w: width, h: height });
    });
    ro.observe(el);
    setCanvasSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // ── History ───────────────────────────────────────────────────────────────
  const pushHistory = useCallback((snap: Record<string, Markup[]>) => {
    hist.current.snaps = [...hist.current.snaps.slice(0, hist.current.idx + 1), snap];
    hist.current.idx   = hist.current.snaps.length - 1;
    setHistIdx(hist.current.idx);
  }, []);

  const updateMarkups = useCallback((boardId: string, fn: (prev: Markup[]) => Markup[]) => {
    setBoardMarkups(prev => {
      const next = { ...prev, [boardId]: fn(prev[boardId] ?? []) };
      pushHistory(next);
      return next;
    });
  }, [pushHistory]);

  const undo = useCallback(() => {
    if (hist.current.idx <= 0) return;
    hist.current.idx--;
    setBoardMarkups(hist.current.snaps[hist.current.idx]);
    setHistIdx(hist.current.idx);
    setSelectedId(null);
  }, []);

  const redo = useCallback(() => {
    if (hist.current.idx >= hist.current.snaps.length - 1) return;
    hist.current.idx++;
    setBoardMarkups(hist.current.snaps[hist.current.idx]);
    setHistIdx(hist.current.idx);
  }, []);

  // ── Snapping ──────────────────────────────────────────────────────────────
  const snap = useCallback((pt: Pt): Pt => {
    if (!snapEnabled) return pt;
    const g = 20;
    return { x: Math.round(pt.x / g) * g, y: Math.round(pt.y / g) * g };
  }, [snapEnabled]);

  // ── Canvas point helpers ──────────────────────────────────────────────────
  const toPt = useCallback((e: React.PointerEvent | React.MouseEvent): Pt => {
    const rect = containerRef.current!.getBoundingClientRect();
    return snap(s2c(e.clientX - rect.left, e.clientY - rect.top, panRef.current, zoomRef.current));
  }, [snap]);

  const fitView = useCallback(() => { setPan({ x: 0, y: 0 }); setZoom(1); }, [setPan, setZoom]);

  const zoomAt = useCallback((sx: number, sy: number, factor: number) => {
    const nz = Math.min(Math.max(zoomRef.current * factor, 0.05), 10);
    setPan({
      x: sx - (sx - panRef.current.x) * (nz / zoomRef.current),
      y: sy - (sy - panRef.current.y) * (nz / zoomRef.current),
    });
    setZoom(nz);
  }, [setPan, setZoom]);

  // ── File upload (background) ──────────────────────────────────────────────
  const handleBgFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = e => {
      const src = e.target?.result as string;
      const img = new window.Image();
      img.onload = () => { setBgImage(src); setBgSize({ w: img.naturalWidth, h: img.naturalHeight }); };
      img.src = src;
    };
    reader.readAsDataURL(file);
  }, []);

  // ── Photo → place on canvas ───────────────────────────────────────────────
  const placeImageOnCanvas = useCallback((src: string) => {
    const img = new window.Image();
    img.onload = () => {
      const aspect = img.naturalWidth / img.naturalHeight;
      const w = 300, h = w / aspect;
      const cx = (canvasSize.w / 2  - panRef.current.x) / zoomRef.current;
      const cy = (canvasSize.h / 2  - panRef.current.y) / zoomRef.current;
      const m: Markup = {
        id: genId(), type: 'image', number: counter,
        points: [{ x: cx - w / 2, y: cy - h / 2 }, { x: cx + w / 2, y: cy + h / 2 }],
        text: '', color: '#ffffff', strokeWidth: 1, fontSize: 14, opacity: 1,
        priority: 'low', status: 'open', layerId: 'l4',
        createdAt: new Date().toISOString(),
        imageData: src,
      };
      updateMarkups(activeBoardId, prev => [...prev, m]);
      setCounter(c => c + 1);
      setSelectedId(m.id);
    };
    img.src = src;
    setActivePanel(null);
  }, [activeBoardId, canvasSize, counter, updateMarkups]);

  // ── Hit test ─────────────────────────────────────────────────────────────
  const hitTest = useCallback((pt: Pt, list: Markup[]): Markup | null => {
    const pad = 10 / zoomRef.current;
    return [...list].reverse().find(m => {
      const b = mkBounds(m);
      return pt.x >= b.x - pad && pt.x <= b.x + b.w + pad &&
             pt.y >= b.y - pad && pt.y <= b.y + b.h + pad;
    }) ?? null;
  }, []);

  // ── In-place text editing ─────────────────────────────────────────────────
  const commitEdit = useCallback(() => {
    if (!editingId) return;
    const bid = activeBoardId;
    setBoardMarkups(prev => {
      const next = {
        ...prev,
        [bid]: (prev[bid] ?? []).map(m => m.id === editingId ? { ...m, text: editingText } : m),
      };
      pushHistory(next);
      return next;
    });
    setEditingId(null);
  }, [editingId, editingText, activeBoardId, pushHistory]);

  const onDoubleClick = useCallback((e: React.MouseEvent) => {
    if (toolRef.current !== 'select') return;
    const pt = toPt(e);
    const hit = hitTest(pt, markups);
    if (hit && TEXT_EDITABLE.includes(hit.type)) {
      moveOrigin.current      = null;
      moveMarkupPts.current   = null;
      setEditingId(hit.id);
      setEditingText(hit.text);
      setSelectedId(hit.id);
    }
  }, [toPt, hitTest, markups]);

  // ── Pointer down ─────────────────────────────────────────────────────────
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    // Commit any open text edit on new pointer down
    if (editingId) { commitEdit(); return; }

    const t = toolRef.current;

    // Middle mouse = pan
    if (e.button === 1) {
      e.preventDefault();
      isPanning.current = true;
      panStart.current  = { x: e.clientX, y: e.clientY };
      panOrigin.current = { ...panRef.current };
      return;
    }
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    // Check if clicking a resize handle
    const handleAttr = (e.target as SVGElement).getAttribute?.('data-handle') as HandlePos | null;
    if (handleAttr && t === 'select' && selectedId) {
      resizingHandle.current  = handleAttr;
      resizeStartPt.current   = toPt(e);
      const sel = markups.find(m => m.id === selectedId);
      resizeOriginPts.current = sel ? sel.points.map(p => ({ ...p })) : null;
      return;
    }

    if (t === 'pan') {
      isPanning.current = true;
      panStart.current  = { x: e.clientX, y: e.clientY };
      panOrigin.current = { ...panRef.current };
      return;
    }

    const rect = containerRef.current!.getBoundingClientRect();
    const sx   = e.clientX - rect.left, sy = e.clientY - rect.top;

    if (t === 'zoom')      { zoomAt(sx, sy, 1.4); return; }
    if (t === 'fit')       { fitView(); return; }

    const pt = toPt(e);

    if (t === 'select') {
      const hit = hitTest(pt, markups);
      if (hit) {
        setSelectedId(hit.id);
        moveOrigin.current    = pt;
        moveMarkupPts.current = hit.points.map(p => ({ ...p }));
      } else {
        setSelectedId(null);
      }
      return;
    }

    if (t === 'eraser') {
      const hit = hitTest(pt, markups);
      if (hit) { updateMarkups(activeBoardId, prev => prev.filter(m => m.id !== hit.id)); setSelectedId(null); }
      return;
    }

    // Panel-open tools
    if (t === 'note')  { setActivePanel('note');  setTool('select'); return; }
    if (t === 'photo') { setActivePanel('photo'); return; }
    if (t === 'file')  { setActivePanel('file');  return; }
    if (t === 'link')  { setActivePanel('link');  return; }
    if (t === 'color') { setActivePanel('color'); return; }
    if (t === 'scale') { setActivePanel('scale'); return; }

    // Drawing tools
    if (t === 'distance' && !scaleSet) return;

    if (t === 'pen' || t === 'highlighter') {
      isDrawing.current = true;
      penPts.current    = [pt];
      setPreview({ type: t, start: pt, cur: pt, pts: [pt] });
      return;
    }

    if (['arrow','cloud','text','box','callout','dimension','distance','angle','area','zoom-area'].includes(t)) {
      isDrawing.current  = true;
      drawStart.current  = pt;
      drawCurrent.current = pt;
      setPreview({ type: t, start: pt, cur: pt });
    }
  }, [editingId, commitEdit, tool, selectedId, markups, activeBoardId, toPt, hitTest,
      updateMarkups, zoomAt, fitView, scaleSet, setTool]);

  // ── Pointer move ──────────────────────────────────────────────────────────
  const onPointerMove = useCallback((e: React.PointerEvent) => {
    // Pan
    if (isPanning.current && panStart.current && panOrigin.current) {
      setPan({ x: panOrigin.current.x + e.clientX - panStart.current.x, y: panOrigin.current.y + e.clientY - panStart.current.y });
      return;
    }

    const pt = toPt(e);

    // Resize
    if (resizingHandle.current && resizeOriginPts.current && selectedId) {
      const pts = resizeOriginPts.current;
      const xs  = pts.map(p => p.x), ys = pts.map(p => p.y);
      let minX = Math.min(...xs), minY = Math.min(...ys);
      let maxX = Math.max(...xs), maxY = Math.max(...ys);
      const h  = resizingHandle.current;
      if (h === 'tl') { minX = Math.min(pt.x, maxX - 5); minY = Math.min(pt.y, maxY - 5); }
      if (h === 'tr') { maxX = Math.max(pt.x, minX + 5); minY = Math.min(pt.y, maxY - 5); }
      if (h === 'bl') { minX = Math.min(pt.x, maxX - 5); maxY = Math.max(pt.y, minY + 5); }
      if (h === 'br') { maxX = Math.max(pt.x, minX + 5); maxY = Math.max(pt.y, minY + 5); }
      setBoardMarkups(prev => ({
        ...prev,
        [activeBoardId]: (prev[activeBoardId] ?? []).map(m => {
          if (m.id !== selectedId) return m;
          if (m.type === 'pen' || m.type === 'highlighter') {
            const sw = maxX > minX ? (maxX - minX) / Math.max(maxX - minX, 1) : 1;
            const sh = maxY > minY ? (maxY - minY) / Math.max(maxY - minY, 1) : 1;
            return { ...m, points: pts.map(p => ({ x: minX + (p.x - minX) * sw, y: minY + (p.y - minY) * sh })) };
          }
          return { ...m, points: [{ x: minX, y: minY }, { x: maxX, y: maxY }] };
        }),
      }));
      return;
    }

    // Move selected
    const t = toolRef.current;
    if (t === 'select' && moveOrigin.current && moveMarkupPts.current && selectedId) {
      const dx = pt.x - moveOrigin.current.x, dy = pt.y - moveOrigin.current.y;
      setBoardMarkups(prev => ({
        ...prev,
        [activeBoardId]: (prev[activeBoardId] ?? []).map(m =>
          m.id === selectedId
            ? { ...m, points: moveMarkupPts.current!.map(p => ({ x: p.x + dx, y: p.y + dy })) }
            : m
        ),
      }));
      return;
    }

    if (!isDrawing.current) return;

    if (t === 'pen' || t === 'highlighter') {
      penPts.current = [...penPts.current, pt];
      setPreview(prev => prev ? { ...prev, cur: pt, pts: penPts.current } : null);
    } else {
      drawCurrent.current = pt;
      setPreview(prev => prev ? { ...prev, cur: pt } : null);
    }
  }, [toPt, selectedId, activeBoardId, setPan]);

  // ── Pointer up ────────────────────────────────────────────────────────────
  const onPointerUp = useCallback((_e: React.PointerEvent) => {
    if (isPanning.current) {
      isPanning.current = false; panStart.current = null; panOrigin.current = null;
      return;
    }

    // Commit resize
    if (resizingHandle.current) {
      pushHistory({ ...boardMarkups });
      resizingHandle.current = null; resizeStartPt.current = null; resizeOriginPts.current = null;
      return;
    }

    const t = toolRef.current;

    // Commit move
    if (t === 'select' && moveOrigin.current) {
      pushHistory({ ...boardMarkups });
      moveOrigin.current = null; moveMarkupPts.current = null;
      return;
    }

    if (!isDrawing.current) return;
    isDrawing.current = false;
    setPreview(null);

    const col = colorRef.current;

    if (t === 'pen' || t === 'highlighter') {
      const pts = penPts.current;
      penPts.current = [];
      if (pts.length < 2) return;
      const m: Markup = {
        id: genId(), type: t, number: counter, points: pts,
        text: '', color: col, strokeWidth: t === 'highlighter' ? 14 : 2, fontSize: 14, opacity: 1,
        priority: 'medium', status: 'open', layerId: 'l1',
        createdAt: new Date().toISOString(),
      };
      updateMarkups(activeBoardId, prev => [...prev, m]);
      setCounter(c => c + 1); setSelectedId(m.id);
      return;
    }

    const start = drawStart.current, cur = drawCurrent.current;
    drawStart.current = null; drawCurrent.current = null;
    if (!start || !cur) return;
    if (Math.abs(cur.x - start.x) < 4 && Math.abs(cur.y - start.y) < 4) return;

    if (t === 'zoom-area') {
      const rect   = containerRef.current!.getBoundingClientRect();
      const dx = Math.abs(cur.x - start.x), dy = Math.abs(cur.y - start.y);
      const cX = ((start.x + cur.x) / 2) * zoomRef.current + panRef.current.x;
      const cY = ((start.y + cur.y) / 2) * zoomRef.current + panRef.current.y;
      const nz = Math.min(zoomRef.current * Math.min(rect.width / (dx * zoomRef.current + 1), rect.height / (dy * zoomRef.current + 1)) * 0.85, 10);
      setPan({ x: rect.width / 2 - cX * (nz / zoomRef.current), y: rect.height / 2 - cY * (nz / zoomRef.current) });
      setZoom(nz);
      return;
    }

    const typeMap: Partial<Record<Tool, MarkupType>> = {
      arrow: 'arrow', cloud: 'cloud', text: 'text', box: 'box',
      callout: 'callout', dimension: 'dimension', distance: 'distance',
    };
    const mtype = typeMap[t];
    if (!mtype) return;

    const defaultText = t === 'text' ? 'TEXT NOTE' : t === 'callout' ? 'Label' : '';
    const m: Markup = {
      id: genId(), type: mtype, number: counter,
      points: [start, cur], text: defaultText, color: col,
      strokeWidth: 2, fontSize: 14, opacity: 1, priority: 'medium', status: 'open', layerId: 'l1',
      createdAt: new Date().toISOString(),
    };
    updateMarkups(activeBoardId, prev => [...prev, m]);
    setCounter(c => c + 1); setSelectedId(m.id);

    // Auto-open text editor for text/callout/note markups
    if (mtype === 'text' || mtype === 'callout') {
      setEditingId(m.id);
      setEditingText(defaultText);
    }
  }, [counter, activeBoardId, updateMarkups, pushHistory, boardMarkups, setPan, setZoom]);

  // ── Wheel zoom ────────────────────────────────────────────────────────────
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const rect = containerRef.current!.getBoundingClientRect();
    zoomAt(e.clientX - rect.left, e.clientY - rect.top, e.deltaY < 0 ? 1.12 : 1 / 1.12);
  }, [zoomAt]);

  // ── Keyboard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Escape') {
        setTool('select'); setSelectedId(null); setActivePanel(null);
        isDrawing.current = false; setPreview(null);
        if (editingId) commitEdit();
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && !editingId) {
        updateMarkups(activeBoardId, prev => prev.filter(m => m.id !== selectedId));
        setSelectedId(null);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); undo(); }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [selectedId, editingId, activeBoardId, updateMarkups, undo, redo, setTool, commitEdit]);

  // ── Tool activation ───────────────────────────────────────────────────────
  const activateTool = useCallback((t: Tool) => {
    setTool(t);
    if (!['color','photo','file','note','link','scale'].includes(t)) setActivePanel(null);
    if (t === 'color')  setActivePanel('color');
    if (t === 'photo')  setActivePanel('photo');
    if (t === 'file')   setActivePanel('file');
    if (t === 'note')   setActivePanel('note');
    if (t === 'link')   setActivePanel('link');
    if (t === 'scale')  setActivePanel('scale');
    if (t === 'undo')   { undo(); setTool('select'); }
    if (t === 'redo')   { redo(); setTool('select'); }
    if (t === 'fit')    { fitView(); setTool('select'); }
    if (t === 'layers') setShowLayers(v => !v);
    if (t === 'grid')   setShowGrid(v => !v);
    if (t === 'snap')   setSnapEnabled(v => !v);
  }, [setTool, undo, redo, fitView]);

  // ── Render markup ─────────────────────────────────────────────────────────
  const renderMarkup = (m: Markup) => {
    const layer = layers.find(l => l.id === m.layerId);
    if (layer && !layer.visible) return null;
    const isSel  = m.id === selectedId;
    const stroke = isSel ? '#3b82f6' : m.color;
    const sw     = m.strokeWidth / zoom;
    const b      = mkBounds(m);
    const bx = b.x, by = b.y, bw = Math.max(b.w, 1), bh = Math.max(b.h, 1);
    const hitPad = 10 / zoom;

    const hitRect = (
      <rect key={`hit-${m.id}`} data-testid={`annotation-hit-${m.number}`}
        x={bx - hitPad} y={by - hitPad} width={bw + hitPad * 2} height={bh + hitPad * 2}
        fill="transparent" stroke="none" style={{ cursor: 'pointer' }}
        onClick={() => { if (toolRef.current === 'select') setSelectedId(m.id); }}
      />
    );

    const tp = { 'data-testid': `annotation-${m.number}`, 'data-tool-type': m.type };
    let shape: React.ReactNode = null;

    if (m.type === 'box') {
      shape = <rect {...tp} key={m.id} x={bx} y={by} width={bw} height={bh} fill="none" stroke={stroke} strokeWidth={sw} />;

    } else if (m.type === 'arrow') {
      const mid = `ah-${m.id}`, ms = 8 / zoom;
      shape = (
        <g key={m.id} {...tp}>
          <defs>
            <marker id={mid} markerWidth={ms * 3} markerHeight={ms * 3} refX={ms * 2.5} refY={ms * 1.5} orient="auto" markerUnits="userSpaceOnUse">
              <polygon points={`0 0,${ms * 3} ${ms * 1.5},0 ${ms * 3}`} fill={stroke} />
            </marker>
          </defs>
          <line x1={m.points[0].x} y1={m.points[0].y} x2={m.points[1].x} y2={m.points[1].y} stroke={stroke} strokeWidth={sw} markerEnd={`url(#${mid})`} />
        </g>
      );

    } else if (m.type === 'cloud') {
      shape = <path {...tp} key={m.id} d={cloudPath(bx, by, bw, bh)} fill="none" stroke={stroke} strokeWidth={sw} />;

    } else if (m.type === 'text') {
      shape = (
        <text {...tp} key={m.id} x={m.points[0].x} y={m.points[0].y}
          fill={stroke} fontSize={m.fontSize / zoom} fontFamily="sans-serif" fontWeight="600"
          dominantBaseline="hanging">
          {m.text}
        </text>
      );

    } else if (m.type === 'callout') {
      const cx = bx + bw / 2, cy = by + bh / 2;
      shape = (
        <g key={m.id} {...tp}>
          <line x1={m.points[0].x} y1={m.points[0].y} x2={cx} y2={cy} stroke={stroke} strokeWidth={sw} />
          <rect x={bx} y={by} width={bw} height={bh} rx={2 / zoom} fill="white" fillOpacity={0.92} stroke={stroke} strokeWidth={sw} />
          <text x={bx + 5 / zoom} y={by + bh / 2} fill="#1e293b" fontSize={m.fontSize / zoom} fontFamily="sans-serif" dominantBaseline="middle">{m.text}</text>
        </g>
      );

    } else if (m.type === 'pen' || m.type === 'highlighter') {
      const pts = m.points.map(p => `${p.x},${p.y}`).join(' ');
      shape = <polyline {...tp} key={m.id} points={pts} fill="none" stroke={stroke} strokeWidth={sw}
        strokeLinecap="round" strokeLinejoin="round" opacity={m.type === 'highlighter' ? 0.35 : 1} />;

    } else if (m.type === 'dimension' || m.type === 'distance') {
      const p1 = m.points[0], p2 = m.points[1];
      const ddx = p2.x - p1.x, ddy = p2.y - p1.y;
      const len = Math.sqrt(ddx * ddx + ddy * ddy);
      const off = 8 / zoom;
      const nx = len > 0 ? -ddy / len * off : 0, ny = len > 0 ? ddx / len * off : 0;
      const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
      const ang = Math.atan2(ddy, ddx) * 180 / Math.PI;
      shape = (
        <g key={m.id} {...tp}>
          <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={stroke} strokeWidth={sw} />
          <line x1={p1.x - nx} y1={p1.y - ny} x2={p1.x + nx} y2={p1.y + ny} stroke={stroke} strokeWidth={sw} />
          <line x1={p2.x - nx} y1={p2.y - ny} x2={p2.x + nx} y2={p2.y + ny} stroke={stroke} strokeWidth={sw} />
          <text x={mx} y={my - off} fill={stroke} fontSize={9 / zoom} fontFamily="sans-serif" textAnchor="middle"
            transform={`rotate(${ang > 90 || ang < -90 ? ang + 180 : ang},${mx},${my - off})`}>
            {`${Math.round(len * 10) / 10}"`}
          </text>
        </g>
      );

    } else if (m.type === 'image' && m.imageData) {
      shape = (
        <g key={m.id} {...tp}>
          <image href={m.imageData} x={bx} y={by} width={bw} height={bh} preserveAspectRatio="xMidYMid meet" />
          {isSel && <rect x={bx} y={by} width={bw} height={bh} fill="none" stroke="#3b82f6" strokeWidth={1.5 / zoom} />}
        </g>
      );
    }

    return shape ? <g key={m.id} opacity={m.opacity ?? 1}>{shape}{hitRect}</g> : null;
  };

  // ── Render preview ────────────────────────────────────────────────────────
  const renderPreview = () => {
    if (!preview) return null;
    const { type, start, cur, pts } = preview;
    const sw   = 2 / zoom;
    const dash = `${5 / zoom}`;
    const x = Math.min(start.x, cur.x), y = Math.min(start.y, cur.y);
    const w = Math.abs(cur.x - start.x), h = Math.abs(cur.y - start.y);

    if (type === 'pen' || type === 'highlighter') {
      if (!pts || pts.length < 2) return null;
      return <polyline points={pts.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke={color}
        strokeWidth={(type === 'highlighter' ? 14 : 2) / zoom} strokeLinecap="round" strokeLinejoin="round"
        opacity={type === 'highlighter' ? 0.35 : 0.7} />;
    }
    if (type === 'box' || type === 'zoom-area' || type === 'area' || type === 'angle')
      return <rect x={x} y={y} width={w} height={h} fill={type === 'zoom-area' ? 'rgba(59,130,246,0.08)' : 'none'} stroke={color} strokeWidth={sw} strokeDasharray={dash} />;
    if (type === 'cloud')
      return <path d={cloudPath(x, y, w, h)} fill="none" stroke={color} strokeWidth={sw} strokeDasharray={dash} />;
    if (type === 'arrow') {
      const ms = 10 / zoom;
      return (
        <g>
          <defs>
            <marker id="pah" markerWidth={ms * 3} markerHeight={ms * 3} refX={ms * 2.5} refY={ms * 1.5} orient="auto" markerUnits="userSpaceOnUse">
              <polygon points={`0 0,${ms * 3} ${ms * 1.5},0 ${ms * 3}`} fill={color} />
            </marker>
          </defs>
          <line x1={start.x} y1={start.y} x2={cur.x} y2={cur.y} stroke={color} strokeWidth={sw} markerEnd="url(#pah)" />
        </g>
      );
    }
    if (type === 'text')
      return <rect x={x} y={y} width={w} height={h} fill="rgba(59,130,246,0.08)" stroke={color} strokeWidth={sw} strokeDasharray={dash} />;
    if (type === 'callout')
      return (
        <g>
          <line x1={start.x} y1={start.y} x2={x + w / 2} y2={y + h / 2} stroke={color} strokeWidth={sw} strokeDasharray={dash} />
          <rect x={x} y={y} width={w} height={h} fill="white" fillOpacity={0.7} stroke={color} strokeWidth={sw} strokeDasharray={dash} />
        </g>
      );
    if (type === 'dimension' || type === 'distance') {
      const ddx = cur.x - start.x, ddy = cur.y - start.y;
      const len = Math.sqrt(ddx * ddx + ddy * ddy), off = 8 / zoom;
      const nx = len > 0 ? -ddy / len * off : 0, ny = len > 0 ? ddx / len * off : 0;
      return (
        <g>
          <line x1={start.x} y1={start.y} x2={cur.x} y2={cur.y} stroke={color} strokeWidth={sw} />
          <line x1={start.x - nx} y1={start.y - ny} x2={start.x + nx} y2={start.y + ny} stroke={color} strokeWidth={sw} />
          <line x1={cur.x - nx} y1={cur.y - ny} x2={cur.x + nx} y2={cur.y + ny} stroke={color} strokeWidth={sw} />
        </g>
      );
    }
    return null;
  };

  // ── Grid ──────────────────────────────────────────────────────────────────
  const renderGrid = () => {
    if (!showGrid) return null;
    const g = 50, cw = canvasSize.w, ch = canvasSize.h;
    const x0 = Math.floor(-pan.x / zoom / g) * g, y0 = Math.floor(-pan.y / zoom / g) * g;
    const lines: React.ReactNode[] = [];
    for (let x = x0; x < x0 + cw / zoom + g; x += g)
      lines.push(<line key={`gx${x}`} x1={x} y1={y0} x2={x} y2={y0 + ch / zoom + g} stroke="rgba(148,163,184,0.12)" strokeWidth={1 / zoom} />);
    for (let y = y0; y < y0 + ch / zoom + g; y += g)
      lines.push(<line key={`gy${y}`} x1={x0} y1={y} x2={x0 + cw / zoom + g} y2={y} stroke="rgba(148,163,184,0.12)" strokeWidth={1 / zoom} />);
    return <g>{lines}</g>;
  };

  // ── Selection + resize handles ────────────────────────────────────────────
  const renderHandles = () => {
    if (!selectedMarkup) return null;
    const b   = mkBounds(selectedMarkup);
    const pad = 8 / zoom, hw = 5 / zoom;
    const corners: { pos: HandlePos; x: number; y: number }[] = [
      { pos: 'tl', x: b.x - pad,       y: b.y - pad },
      { pos: 'tr', x: b.x + b.w + pad, y: b.y - pad },
      { pos: 'bl', x: b.x - pad,       y: b.y + b.h + pad },
      { pos: 'br', x: b.x + b.w + pad, y: b.y + b.h + pad },
    ];
    const canResize = RESIZABLE_TYPES.includes(selectedMarkup.type);
    return (
      <g>
        <rect x={b.x - pad} y={b.y - pad} width={b.w + pad * 2} height={b.h + pad * 2}
          fill="none" stroke="#3b82f6" strokeWidth={1.5 / zoom} strokeDasharray={`${4 / zoom}`} />
        {canResize && corners.map(({ pos, x, y }) => (
          <rect key={pos} data-handle={pos}
            x={x - hw} y={y - hw} width={hw * 2} height={hw * 2}
            fill="#3b82f6" stroke="white" strokeWidth={1 / zoom}
            style={{ cursor: HANDLE_CURSORS[pos], pointerEvents: 'all' }}
          />
        ))}
      </g>
    );
  };

  // ── Floating in-place text editor ─────────────────────────────────────────
  const renderTextEditor = () => {
    if (!editingId) return null;
    const m = markups.find(x => x.id === editingId);
    if (!m) return null;
    const b  = mkBounds(m);
    const sl = b.x * zoom + pan.x;
    const st = b.y * zoom + pan.y;
    const sw = Math.max(b.w * zoom, 140);
    const sh = Math.max(b.h * zoom, 32);
    return (
      <div className="absolute z-20" style={{ left: sl, top: st, width: sw, minHeight: sh }}>
        <textarea
          autoFocus
          value={editingText}
          onChange={e => setEditingText(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={e => {
            if (e.key === 'Escape') { setEditingId(null); }
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit(); }
          }}
          className="w-full bg-white border-2 border-blue-500 rounded px-2 py-1 text-slate-900 focus:outline-none resize-none"
          style={{ fontSize: Math.max((m.fontSize || 14) * zoom, 12), minHeight: sh, height: sh }}
        />
      </div>
    );
  };

  // ── Cursor ────────────────────────────────────────────────────────────────
  const cursor = isPanning.current ? 'grabbing' : ({
    select: 'default', pan: 'grab', zoom: 'zoom-in', 'zoom-area': 'crosshair',
    eraser: 'cell', text: 'crosshair',
  } as Record<string, string>)[tool] ?? 'crosshair';

  const inspectorTitle = selectedMarkup
    ? `${selectedMarkup.type.charAt(0).toUpperCase() + selectedMarkup.type.slice(1)} N${selectedMarkup.number}`
    : null;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-200 overflow-hidden select-none">

      {/* ── Header tabs ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 bg-slate-950 border-b border-slate-800 shrink-0 h-9">
        <div className="flex">
          {(['Workspace','Review','Report','Export'] as const).map(tab => (
            <button key={tab} aria-label={tab}
              onClick={() => {
                if (tab === 'Report') setActivePanel('report');
                else if (tab === 'Export') setActivePanel('export');
                else setActivePanel(null);
              }}
              className={`px-4 h-9 text-xs font-medium border-b-2 transition-colors ${
                tab === 'Workspace' && !activePanel ? 'border-blue-500 text-white' : 'border-transparent text-slate-400 hover:text-white'
              }`}>{tab}</button>
          ))}
        </div>
        <span className="text-xs text-slate-500">Project: 1234 – Riverside Office Building</span>
      </div>

      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-0 px-1 py-1 bg-slate-800 border-b border-slate-700 overflow-x-auto shrink-0">
        <TB tid="tool-select"    active={tool==='select'}    onClick={()=>activateTool('select')}    icon={<MousePointer2 size={15}/>} label="Select"/>
        <TB tid="tool-pan"       active={tool==='pan'}       onClick={()=>activateTool('pan')}       icon={<Hand size={15}/>}          label="Pan"/>
        <TB tid="tool-zoom"      active={tool==='zoom'}      onClick={()=>activateTool('zoom')}      icon={<ZoomIn size={15}/>}        label="Zoom"/>
        <TB tid="tool-fit"                                   onClick={()=>activateTool('fit')}       icon={<Maximize2 size={15}/>}     label="Fit"/>
        <TB tid="tool-zoom-area" active={tool==='zoom-area'} onClick={()=>activateTool('zoom-area')} icon={<Crosshair size={15}/>}     label="Zoom Area"/>
        <Sep/>
        <TB tid="tool-arrow"     active={tool==='arrow'}     onClick={()=>activateTool('arrow')}     icon={<ArrowUpRight size={15}/>}  label="Arrow"/>
        <TB tid="tool-cloud"     active={tool==='cloud'}     onClick={()=>activateTool('cloud')}     icon={<Cloud size={15}/>}         label="Cloud"/>
        <TB tid="tool-text"      active={tool==='text'}      onClick={()=>activateTool('text')}      icon={<Type size={15}/>}          label="Text"/>
        <TB tid="tool-box"       active={tool==='box'}       onClick={()=>activateTool('box')}       icon={<Square size={15}/>}        label="Box"/>
        <TB tid="tool-callout"   active={tool==='callout'}   onClick={()=>activateTool('callout')}   icon={<MessageSquare size={15}/>} label="Callout"/>
        <Sep/>
        <TB tid="tool-dimension" active={tool==='dimension'} onClick={()=>activateTool('dimension')} icon={<Ruler size={15}/>}         label="Dimension"/>
        <TB tid="tool-distance"  active={tool==='distance'}  onClick={()=>activateTool('distance')}  icon={<Minus size={15}/>}         label="Distance"/>
        <TB tid="tool-angle"     active={tool==='angle'}     onClick={()=>activateTool('angle')}     icon={<TrendingUp size={15}/>}    label="Angle"/>
        <TB tid="tool-area"      active={tool==='area'}      onClick={()=>activateTool('area')}      icon={<Hexagon size={15}/>}       label="Area"/>
        <Sep/>
        <TB tid="tool-note"        active={activePanel==='note'}  onClick={()=>activateTool('note')}        icon={<StickyNote size={15}/>}    label="Note"/>
        <TB tid="tool-photo"       active={activePanel==='photo'} onClick={()=>activateTool('photo')}       icon={<Camera size={15}/>}        label="Photo"/>
        <TB tid="tool-file"        active={activePanel==='file'}  onClick={()=>activateTool('file')}        icon={<FileText size={15}/>}      label="File"/>
        <TB tid="tool-link"        active={activePanel==='link'}  onClick={()=>activateTool('link')}        icon={<Link size={15}/>}           label="Link"/>
        <Sep/>
        <TB tid="tool-highlighter" active={tool==='highlighter'}  onClick={()=>activateTool('highlighter')} icon={<Highlighter size={15}/>}   label="Highlighter"/>
        <TB tid="tool-pen"         active={tool==='pen'}          onClick={()=>activateTool('pen')}         icon={<PenLine size={15}/>}       label="Pen"/>
        <TB tid="tool-eraser"      active={tool==='eraser'}       onClick={()=>activateTool('eraser')}      icon={<Eraser size={15}/>}        label="Eraser"/>
        <Sep/>
        <TB tid="tool-color" active={activePanel==='color'} onClick={()=>activateTool('color')}
          icon={<div className="w-4 h-4 rounded-full border-2 border-slate-400 shrink-0" style={{background:color}}/>} label="Color"/>
        <Sep/>
        <TB tid="tool-layers" toggle={showLayers}            onClick={()=>activateTool('layers')} icon={<Layers size={15}/>}     label="Layers"/>
        <TB tid="tool-scale"  active={activePanel==='scale'} onClick={()=>activateTool('scale')}  icon={<Ruler size={15}/>}      label="Scale"/>
        <TB tid="tool-grid"   toggle={showGrid}              onClick={()=>activateTool('grid')}   icon={<LayoutGrid size={15}/>} label="Grid"/>
        <TB tid="tool-snap"   toggle={snapEnabled}           onClick={()=>activateTool('snap')}   icon={<Magnet size={15}/>}     label="Snap"/>
        <Sep/>
        <TB tid="tool-undo" onClick={()=>activateTool('undo')} icon={<Undo2 size={15}/>}          label="Undo"/>
        <TB tid="tool-redo" onClick={()=>activateTool('redo')} icon={<Redo2 size={15}/>}          label="Redo"/>
        <Sep/>
        <TB tid="tool-more" onClick={()=>activateTool('more')} icon={<MoreHorizontal size={15}/>} label="More"/>

        <span data-testid="status-message" data-active-tool={TOOL_NAMES[tool] ?? tool}
          className="ml-auto shrink-0 pr-2 text-[10px] text-slate-400">
          {TOOL_NAMES[tool]} · {Math.round(zoom * 100)}%
          {editingId && ' · Editing — Enter to confirm, Esc to cancel'}
        </span>
      </div>

      {/* ── Main area ────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left panel ─────────────────────────────────────────────────── */}
        <div className="w-52 shrink-0 flex flex-col bg-slate-800 border-r border-slate-700 overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Boards</span>
              <button aria-label="Add board" className="text-slate-400 hover:text-white"><Plus size={13}/></button>
            </div>
            <div className="py-1 text-xs">
              {BOARD_TREE.filter(b => b.parentId === null).map(cat => {
                const children = BOARD_TREE.filter(b => b.parentId === cat.id);
                const isOpen = expanded.has(cat.id);
                return (
                  <div key={cat.id}>
                    <button aria-label={cat.name}
                      onClick={() => setExpanded(prev => { const s = new Set(prev); s.has(cat.id) ? s.delete(cat.id) : s.add(cat.id); return s; })}
                      className="flex items-center gap-1.5 w-full px-3 py-1.5 text-slate-300 hover:bg-slate-700 hover:text-white">
                      {isOpen ? <ChevronDown size={11}/> : <ChevronRight size={11}/>}
                      <span className="font-medium truncate">{cat.name}</span>
                    </button>
                    {isOpen && children.map(child => (
                      <button key={child.id} aria-label={child.name} onClick={() => setActiveBoardId(child.id)}
                        className={`flex items-center w-full pl-7 pr-3 py-1 transition-colors ${
                          activeBoardId === child.id ? 'bg-blue-600/20 text-blue-300 border-l-2 border-blue-500' : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                        }`}>
                        <span className="truncate">{child.name}</span>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>

          {showLayers && (
            <div className="border-t border-slate-700 shrink-0">
              <div className="px-3 py-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Layers</span>
              </div>
              {layers.map(l => (
                <div key={l.id} className="flex items-center gap-2 px-3 py-1 text-xs text-slate-300 hover:bg-slate-700">
                  <button onClick={() => setLayers(prev => prev.map(x => x.id === l.id ? { ...x, visible: !x.visible } : x))} className="text-slate-400 hover:text-white">
                    {l.visible ? <Eye size={11}/> : <EyeOff size={11}/>}
                  </button>
                  <span className="flex-1 truncate">{l.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Canvas + schedule ───────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div ref={containerRef} data-testid="plan-canvas"
            className="flex-1 overflow-hidden relative"
            style={{ cursor, background: '#1e293b' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={() => { isDrawing.current = false; isPanning.current = false; setPreview(null); }}
            onDoubleClick={onDoubleClick}
            onWheel={onWheel}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleBgFile(f); }}
          >
            <svg width={canvasSize.w} height={canvasSize.h} className="absolute inset-0" overflow="visible">
              <g data-testid="plan-transform"
                data-plan-pan-x={String(pan.x)} data-plan-pan-y={String(pan.y)} data-plan-zoom={String(zoom)}
                transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
                {renderGrid()}
                {bgImage
                  ? <image href={bgImage} x={0} y={0} width={bgSize.w} height={bgSize.h}/>
                  : <rect x={0} y={0} width={1200} height={900} fill="#334155" rx={4}/>
                }
                {markups.map(m => renderMarkup(m))}
                {renderPreview()}
                {renderHandles()}
              </g>
            </svg>

            {!bgImage && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center text-slate-500">
                  <Upload size={28} className="mx-auto mb-2 opacity-30"/>
                  <p className="text-sm">Drop an image here or click Upload in the toolbar</p>
                  <p className="text-xs mt-1 opacity-50">JPG · PNG</p>
                </div>
              </div>
            )}

            {/* In-place text editor overlay */}
            {renderTextEditor()}

            <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
              onChange={e => e.target.files?.[0] && handleBgFile(e.target.files[0])}/>
            <input ref={photoInputRef} type="file" accept="image/*" className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (!f) return;
                const reader = new FileReader();
                reader.onload = ev => { if (ev.target?.result) placeImageOnCanvas(ev.target.result as string); };
                reader.readAsDataURL(f);
              }}/>
          </div>

          {/* Markup schedule */}
          <div className="h-44 shrink-0 border-t border-slate-700 bg-slate-800 overflow-auto">
            <div className="flex items-center justify-between px-4 py-1.5 border-b border-slate-700 sticky top-0 bg-slate-800 z-10">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Markup Schedule <span className="normal-case font-normal text-slate-500 ml-1">({markups.length})</span>
              </span>
              <div className="flex gap-2">
                <button aria-label="Reset active board"
                  onClick={() => { updateMarkups(activeBoardId, () => activeBoardId === 'b1' ? SEED : []); setSelectedId(null); }}
                  className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1"><RefreshCw size={11}/> Reset</button>
                {selectedId && (
                  <button onClick={() => { updateMarkups(activeBoardId, p => p.filter(m => m.id !== selectedId)); setSelectedId(null); }}
                    className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1"><Trash2 size={11}/> Delete</button>
                )}
              </div>
            </div>
            {markups.length === 0
              ? <div className="px-4 py-6 text-xs text-slate-500 text-center">No markups yet. Draw on the canvas to start.</div>
              : (
                <table className="w-full text-xs">
                  <thead className="text-[10px] uppercase text-slate-500 border-b border-slate-700">
                    <tr>
                      <th className="px-4 py-1 text-left w-8">#</th>
                      <th className="px-2 py-1 text-left">Type</th>
                      <th className="px-2 py-1 text-left">Label</th>
                      <th className="px-2 py-1 text-left">Status</th>
                      <th className="px-2 py-1 text-left">Priority</th>
                      <th className="px-2 py-1 text-left">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {markups.map(m => (
                      <tr key={m.id} onClick={() => setSelectedId(m.id)}
                        className={`border-b border-slate-700/40 cursor-pointer transition-colors ${m.id === selectedId ? 'bg-blue-600/20' : 'hover:bg-slate-700/40'}`}>
                        <td className="px-4 py-1">
                          <span className="w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px] font-bold text-white" style={{background:m.color}}>{m.number}</span>
                        </td>
                        <td className="px-2 py-1 capitalize text-slate-300">{m.type}</td>
                        <td className="px-2 py-1 text-slate-300 max-w-[180px] truncate">{m.text || '—'}</td>
                        <td className="px-2 py-1"><span className={`px-1.5 py-0.5 rounded text-[10px] ${STATUS_CFG[m.status].cls}`}>{STATUS_CFG[m.status].label}</span></td>
                        <td className="px-2 py-1">
                          <div className="flex items-center gap-1">
                            <span className={`w-2 h-2 rounded-full ${PRI_CFG[m.priority].dot}`}/>
                            <span className="text-slate-400">{PRI_CFG[m.priority].label}</span>
                          </div>
                        </td>
                        <td className="px-2 py-1 text-slate-500">{new Date(m.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            }
          </div>
        </div>

        {/* ── Right panel ─────────────────────────────────────────────────── */}
        {showInspector && (
          <div className="w-60 shrink-0 flex flex-col bg-slate-800 border-l border-slate-700 overflow-hidden">
            <div className="border-b border-slate-700 shrink-0">
              <div className="flex items-center justify-between px-3 py-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Site Photos</span>
                <div className="flex gap-1">
                  <button aria-label="Filter linked photos" className="text-slate-400 hover:text-white p-0.5"><Filter size={11}/></button>
                  <button aria-label="Collapse photos panel" onClick={() => setShowInspector(false)} className="text-slate-400 hover:text-white p-0.5"><ChevronLeft size={11}/></button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1 px-2 pb-2">
                {[1,2,3,4,5].map(i => (
                  <div key={i} className="aspect-square rounded bg-slate-700 flex items-center justify-center overflow-hidden">
                    <Image size={14} className="text-slate-500"/>
                  </div>
                ))}
              </div>
              <div className="px-3 pb-2">
                <button aria-label="View all photos (5)" data-testid="view-all-photos"
                  onClick={() => setActivePanel('photo-library')}
                  className="text-[10px] text-blue-400 hover:text-blue-300 w-full text-left">
                  View all photos (5)
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-700 sticky top-0 bg-slate-800 z-10">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Inspector</span>
                {selectedMarkup && <button onClick={() => setSelectedId(null)} className="text-slate-500 hover:text-white"><X size={11}/></button>}
              </div>

              {!selectedMarkup ? (
                <div className="px-4 py-6 text-xs text-slate-500 text-center">
                  Select a markup to inspect.<br/>
                  <span className="opacity-60">Double-click text/cloud/box to edit inline.</span>
                </div>
              ) : (() => {
                const b = mkBounds(selectedMarkup);
                const upd = (patch: Partial<Markup>) =>
                  setBoardMarkups(prev => ({ ...prev, [activeBoardId]: (prev[activeBoardId]??[]).map(m => m.id===selectedId ? {...m,...patch} : m) }));
                return (
                <div className="p-3 space-y-3">
                  <p data-testid="inspector-title" className="text-sm font-semibold text-slate-100">{inspectorTitle}</p>

                  {/* Position & size readout */}
                  <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                    <div className="bg-slate-700/60 rounded px-2 py-1">
                      <span className="text-slate-500 block uppercase tracking-wide">X</span>
                      <span className="text-slate-200 font-mono">{Math.round(b.x)}</span>
                    </div>
                    <div className="bg-slate-700/60 rounded px-2 py-1">
                      <span className="text-slate-500 block uppercase tracking-wide">Y</span>
                      <span className="text-slate-200 font-mono">{Math.round(b.y)}</span>
                    </div>
                    <div className="bg-slate-700/60 rounded px-2 py-1">
                      <span className="text-slate-500 block uppercase tracking-wide">W</span>
                      <span className="text-slate-200 font-mono">{Math.round(b.w)}</span>
                    </div>
                    <div className="bg-slate-700/60 rounded px-2 py-1">
                      <span className="text-slate-500 block uppercase tracking-wide">H</span>
                      <span className="text-slate-200 font-mono">{Math.round(b.h)}</span>
                    </div>
                  </div>

                  {/* Label */}
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1 uppercase tracking-wide">Label</label>
                    <input value={selectedMarkup.text} onChange={e => upd({ text: e.target.value })}
                      className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                      placeholder="Add label…"/>
                  </div>

                  {/* Color */}
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1 uppercase tracking-wide">Color</label>
                    <div className="flex gap-1.5 flex-wrap items-center">
                      {COLORS.map(c => (
                        <button key={c} onClick={() => upd({ color: c })}
                          className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${selectedMarkup.color===c ? 'border-white scale-110' : 'border-transparent'}`}
                          style={{background:c}}/>
                      ))}
                      <input type="color" value={selectedMarkup.color} onChange={e => upd({ color: e.target.value })}
                        className="w-5 h-5 rounded cursor-pointer bg-transparent border-0 p-0" title="Custom color"/>
                    </div>
                  </div>

                  {/* Stroke width */}
                  <div>
                    <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                      <span className="uppercase tracking-wide">Stroke Width</span>
                      <span className="text-slate-300 font-mono">{selectedMarkup.strokeWidth}px</span>
                    </div>
                    <input type="range" min={1} max={12} step={0.5} value={selectedMarkup.strokeWidth}
                      onChange={e => upd({ strokeWidth: Number(e.target.value) })}
                      className="w-full accent-blue-500 h-1.5"/>
                  </div>

                  {/* Opacity */}
                  <div>
                    <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                      <span className="uppercase tracking-wide">Opacity</span>
                      <span className="text-slate-300 font-mono">{Math.round((selectedMarkup.opacity ?? 1) * 100)}%</span>
                    </div>
                    <input type="range" min={0.1} max={1} step={0.05} value={selectedMarkup.opacity ?? 1}
                      onChange={e => upd({ opacity: Number(e.target.value) })}
                      className="w-full accent-blue-500 h-1.5"/>
                  </div>

                  {/* Font size — text types only */}
                  {['text','callout','box','cloud'].includes(selectedMarkup.type) && (
                    <div>
                      <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                        <span className="uppercase tracking-wide">Font Size</span>
                        <span className="text-slate-300 font-mono">{selectedMarkup.fontSize}pt</span>
                      </div>
                      <input type="range" min={8} max={48} step={1} value={selectedMarkup.fontSize}
                        onChange={e => upd({ fontSize: Number(e.target.value) })}
                        className="w-full accent-blue-500 h-1.5"/>
                    </div>
                  )}

                  {/* Layer assignment */}
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1 uppercase tracking-wide">Layer</label>
                    <select value={selectedMarkup.layerId} onChange={e => upd({ layerId: e.target.value })}
                      className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none">
                      {layers.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </div>

                  {/* Status */}
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1 uppercase tracking-wide">Status</label>
                    <select value={selectedMarkup.status} onChange={e => upd({ status: e.target.value as MarkupStatus })}
                      className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none">
                      {Object.entries(STATUS_CFG).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>

                  {/* Priority */}
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1 uppercase tracking-wide">Priority</label>
                    <div className="flex gap-1">
                      {(['high','medium','low'] as Priority[]).map(p => (
                        <button key={p} onClick={() => upd({ priority: p })}
                          className={`flex-1 py-1 rounded text-[10px] capitalize border transition-colors ${selectedMarkup.priority===p ? 'border-blue-500 bg-blue-600/20 text-blue-300' : 'border-slate-600 text-slate-400 hover:border-slate-500'}`}
                        >{p}</button>
                      ))}
                    </div>
                  </div>

                  {/* Inline text edit */}
                  {TEXT_EDITABLE.includes(selectedMarkup.type) && (
                    <button onClick={() => { setEditingId(selectedMarkup.id); setEditingText(selectedMarkup.text); }}
                      className="w-full py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-xs text-slate-300 border border-slate-600">
                      ✏️ Edit text inline
                    </button>
                  )}

                  {/* Z-order */}
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1 uppercase tracking-wide">Order</label>
                    <div className="flex gap-1">
                      <button title="Bring to Front"
                        onClick={() => updateMarkups(activeBoardId, prev => { const rest = prev.filter(m => m.id !== selectedId); const sel = prev.find(m => m.id === selectedId)!; return [...rest, sel]; })}
                        className="flex-1 py-1 rounded text-[10px] border border-slate-600 text-slate-400 hover:border-slate-500 hover:text-white">▲ Front</button>
                      <button title="Send to Back"
                        onClick={() => updateMarkups(activeBoardId, prev => { const rest = prev.filter(m => m.id !== selectedId); const sel = prev.find(m => m.id === selectedId)!; return [sel, ...rest]; })}
                        className="flex-1 py-1 rounded text-[10px] border border-slate-600 text-slate-400 hover:border-slate-500 hover:text-white">▼ Back</button>
                    </div>
                  </div>

                  {/* Linked items */}
                  <div className="border-t border-slate-700 pt-2 space-y-1">
                    {([['Linked Photos', 3], ['Linked Documents', 2], ['Board Markups', 1], ['Linked Costs', 1]] as [string,number][]).map(([label, count]) => (
                      <button key={label} aria-label={`${label} ${count}`}
                        className="flex items-center justify-between w-full text-xs text-slate-400 hover:text-slate-200 py-0.5">
                        <span>{label}</span>
                        <span className="bg-slate-700 rounded px-1.5 py-0.5 text-[10px]">{count}</span>
                      </button>
                    ))}
                  </div>

                  <div className="border-t border-slate-700 pt-2 flex gap-2">
                    <button aria-label="Edit note" className="flex-1 text-[10px] py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-300">Edit note</button>
                    <button aria-label="Add Comment" className="flex-1 text-[10px] py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-300">Add Comment</button>
                  </div>

                  <button onClick={() => { updateMarkups(activeBoardId, p => p.filter(m => m.id !== selectedId)); setSelectedId(null); }}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded bg-red-900/30 border border-red-800/50 text-red-400 hover:bg-red-900/50 text-xs">
                    <Trash2 size={11}/> Delete
                  </button>
                </div>
                );
              })()}
            </div>
          </div>
        )}

        {!showInspector && (
          <button onClick={() => setShowInspector(true)}
            className="w-7 shrink-0 bg-slate-800 border-l border-slate-700 flex items-center justify-center text-slate-400 hover:text-white" title="Show Inspector">
            <ChevronLeft size={14} style={{ transform: 'rotate(180deg)' }}/>
          </button>
        )}
      </div>

      {/* ── Active panel overlay ─────────────────────────────────────────── */}
      {activePanel && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={e => { if (e.target === e.currentTarget) setActivePanel(null); }}>
          <div className="bg-slate-800 border border-slate-600 rounded-xl shadow-2xl w-96 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
              <h2 data-testid="active-panel-title" className="font-semibold text-slate-100">
                {activePanel === 'color'         && 'Choose markup color'}
                {activePanel === 'photo'         && 'Add or choose site photo'}
                {activePanel === 'file'          && 'Attach document'}
                {activePanel === 'note'          && 'Add note'}
                {activePanel === 'link'          && 'Link markup to document'}
                {activePanel === 'scale'         && 'Workspace settings'}
                {activePanel === 'report'        && 'Generate structural inspection report'}
                {activePanel === 'export'        && 'Export project deliverables'}
                {activePanel === 'photo-library' && <span data-testid="photo-library-title">Photo Library</span>}
              </h2>
              <button data-testid="close-active-panel" onClick={() => setActivePanel(null)} className="text-slate-400 hover:text-white"><X size={16}/></button>
            </div>

            <div className="p-5">
              {activePanel === 'color' && (
                <div>
                  <p className="text-xs text-slate-400 mb-3">Select the color for new markups.</p>
                  <div className="flex gap-3 flex-wrap">
                    {COLORS.map(c => (
                      <button key={c} onClick={() => { setColor(c); setActivePanel(null); }}
                        className={`w-9 h-9 rounded-full border-4 transition-transform hover:scale-110 ${color===c ? 'border-white scale-110' : 'border-transparent'}`}
                        style={{background:c}}/>
                    ))}
                  </div>
                  <div className="mt-4">
                    <label className="block text-xs text-slate-400 mb-1">Custom</label>
                    <input type="color" value={color} onChange={e => setColor(e.target.value)} className="h-9 w-full rounded cursor-pointer bg-slate-700 border border-slate-600"/>
                  </div>
                </div>
              )}

              {activePanel === 'photo' && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-400">Upload a photo to place on the canvas or add to the site photos panel.</p>
                  <button onClick={() => photoInputRef.current?.click()}
                    className="w-full py-2.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium flex items-center justify-center gap-2">
                    <Upload size={14}/> Upload &amp; Place on Canvas
                  </button>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-600"/></div>
                    <div className="relative flex justify-center text-[10px] uppercase text-slate-500"><span className="bg-slate-800 px-2">or choose existing</span></div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[1,2,3,4,5].map(i => (
                      <div key={i} className="aspect-square rounded bg-slate-700 flex items-center justify-center cursor-pointer hover:bg-slate-600 hover:ring-2 ring-blue-500">
                        <Image size={20} className="text-slate-500"/>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activePanel === 'file' && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-400">Attach a calculation or document to this markup.</p>
                  <button className="w-full py-2 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs">Browse documents</button>
                  <div className="space-y-1.5 mt-2">
                    {['Steel Design Report', 'Concrete Calc Sheet', 'Load Summary'].map(d => (
                      <div key={d} className="flex items-center gap-2 px-3 py-2 rounded bg-slate-700 hover:bg-slate-600 cursor-pointer text-xs text-slate-300">
                        <FileText size={13}/>{d}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activePanel === 'note' && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-400">Add a note to the active board or selected markup.</p>
                  <textarea rows={4} placeholder="Enter note…" className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 resize-none"/>
                  <button onClick={() => setActivePanel(null)} className="w-full py-2 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs">Save note</button>
                </div>
              )}

              {activePanel === 'link' && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-400">Link this markup to a project document or calculation.</p>
                  <div className="space-y-1.5">
                    {['Steel Beam B18 Design', 'Wind Load Summary', 'Foundation Report'].map(d => (
                      <div key={d} className="flex items-center gap-2 px-3 py-2 rounded bg-slate-700 hover:bg-slate-600 cursor-pointer text-xs text-slate-300">
                        <Tag size={13}/>{d}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activePanel === 'scale' && (
                <div className="space-y-4">
                  <p className="text-xs text-slate-400">Set drawing scale and workspace display options.</p>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Drawing Scale</label>
                    <select className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm text-slate-200 focus:outline-none">
                      {["1/8\" = 1'-0\"","1/4\" = 1'-0\"","1/2\" = 1'-0\"","3/4\" = 1'-0\"","1\" = 1'-0\""].map(s=><option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Grid spacing</label>
                    <input type="number" defaultValue={50} className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm text-slate-200 focus:outline-none"/>
                  </div>
                  <button onClick={() => { setScaleSet(true); setActivePanel(null); }}
                    className="w-full py-2 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs">Apply settings</button>
                </div>
              )}

              {activePanel === 'report' && (
                <div className="space-y-4">
                  <p className="text-xs text-slate-400">Generate a PDF structural inspection report from all markups and photos.</p>
                  <div className="space-y-2">
                    {['Cover page','Markup schedule','Photo log','Engineer summary'].map(s => (
                      <label key={s} className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                        <input type="checkbox" defaultChecked className="rounded"/> {s}
                      </label>
                    ))}
                  </div>
                  <button className="w-full py-2 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs">Generate PDF Report</button>
                </div>
              )}

              {activePanel === 'export' && (
                <div className="space-y-4">
                  <p className="text-xs text-slate-400">Export project deliverables in your preferred format.</p>
                  <div className="space-y-2">
                    {['PDF (annotated drawings)','CSV (markup schedule)','ZIP (all photos + PDF)'].map(f => (
                      <button key={f} className="w-full py-2 px-3 rounded bg-slate-700 hover:bg-slate-600 text-xs text-slate-300 text-left">{f}</button>
                    ))}
                  </div>
                </div>
              )}

              {activePanel === 'photo-library' && (
                <div className="space-y-3">
                  <p data-testid="photo-library-title" className="text-xs text-slate-400 font-semibold">All site photos (5)</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[1,2,3,4,5].map(i => (
                      <div key={i} className="rounded bg-slate-700 aspect-video flex items-center justify-center cursor-pointer hover:bg-slate-600 hover:ring-2 ring-blue-500">
                        <Image size={24} className="text-slate-500"/>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
