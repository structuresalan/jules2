import React from 'react';

interface WindElevationSVGProps {
  h: number; // Mean Roof Height
  L: number; // Length parallel to wind
  roofPitch?: number; // degrees
}

export const WindElevationSVG: React.FC<WindElevationSVGProps> = ({ h, L, roofPitch = 0 }) => {
  const safeH = Math.max(h, 10);
  const safeL = Math.max(L, 10);

  const padX = Math.max(safeL * 0.18, 10);
  const padY = Math.max(safeH * 0.24, 8);
  const viewBoxW = safeL + padX * 2;
  const viewBoxH = safeH + padY * 2.35;

  const x0 = padX;
  const y0 = padY + safeH;

  const pitchRad = (roofPitch * Math.PI) / 180;
  const roofRise = Math.max(0, (safeL / 2) * Math.tan(pitchRad));
  const yRoofEdge = padY + roofRise;
  const yPeak = padY;
  const diagramScale = Math.max(viewBoxW, viewBoxH);
  const fontSize = Math.max(4.5, diagramScale * 0.035);
  const dimFontSize = Math.max(3.8, diagramScale * 0.028);
  const strokeW = Math.max(0.45, diagramScale * 0.0055);
  const mag = Math.max(safeH, safeL) * 0.13;

  const drawDistributedLoad = (
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    magnitude: number,
    direction: 'right' | 'left' | 'up' | 'down',
    color: string,
    label: string,
    labelPos: 'start' | 'center' | 'end',
  ) => {
    const isVertical = Math.abs(startX - endX) < 0.001;
    const length = isVertical ? Math.abs(endY - startY) : Math.abs(endX - startX);
    const arrowCount = Math.max(4, Math.min(9, Math.floor(length / (Math.max(safeH, safeL) * 0.11))));
    const step = length / Math.max(arrowCount - 1, 1);

    let rectX = startX;
    let rectY = startY;
    let rectW = 0;
    let rectH = 0;

    if (direction === 'right') {
      rectX = startX - magnitude;
      rectY = Math.min(startY, endY);
      rectW = magnitude;
      rectH = length;
    } else if (direction === 'left') {
      rectX = startX;
      rectY = Math.min(startY, endY);
      rectW = magnitude;
      rectH = length;
    } else if (direction === 'up') {
      rectX = Math.min(startX, endX);
      rectY = startY - magnitude;
      rectW = length;
      rectH = magnitude;
    } else {
      rectX = Math.min(startX, endX);
      rectY = startY;
      rectW = length;
      rectH = magnitude;
    }

    const arrows = Array.from({ length: arrowCount }, (_, index) => {
      let ax1 = 0;
      let ay1 = 0;
      let ax2 = 0;
      let ay2 = 0;

      if (isVertical) {
        ay1 = Math.min(startY, endY) + index * step;
        ay2 = ay1;
        if (direction === 'right') {
          ax1 = startX - magnitude;
          ax2 = startX;
        } else {
          ax1 = startX + magnitude;
          ax2 = startX;
        }
      } else {
        ax1 = Math.min(startX, endX) + index * step;
        ax2 = ax1;
        if (direction === 'up') {
          ay1 = startY - magnitude;
          ay2 = startY;
        } else {
          ay1 = startY + magnitude;
          ay2 = startY;
        }
      }

      return <line key={index} x1={ax1} y1={ay1} x2={ax2} y2={ay2} stroke={color} strokeWidth={strokeW} markerEnd="url(#elevationArrow)" />;
    });

    const lx = isVertical
      ? (direction === 'right' ? startX - magnitude - padX * 0.12 : startX + magnitude + padX * 0.12)
      : (labelPos === 'center' ? (startX + endX) / 2 : (labelPos === 'start' ? startX : endX));

    const ly = isVertical
      ? (labelPos === 'center' ? (startY + endY) / 2 : (labelPos === 'start' ? startY : endY))
      : (direction === 'up' ? startY - magnitude - padY * 0.14 : startY + magnitude + padY * 0.14);

    return (
      <g>
        <rect x={rectX} y={rectY} width={rectW} height={rectH} fill={color} fillOpacity="0.10" stroke={color} strokeWidth={strokeW * 0.45} strokeDasharray="2,2" />
        <line x1={startX} y1={startY} x2={endX} y2={endY} stroke={color} strokeWidth={strokeW} />
        {arrows}
        <text x={lx} y={ly} fontSize={fontSize} fill="#1e293b" dominantBaseline="middle" textAnchor="middle" fontWeight="700">
          {label}
        </text>
      </g>
    );
  };

  return (
    <div className="w-full overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-gray-900">Elevation View - Wind Pressures</div>
          <div className="text-xs text-gray-500">Wall and roof pressure directions scaled to fit this panel.</div>
        </div>
        <div className="rounded bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">h={h.toFixed(1)} ft</div>
      </div>

      <svg viewBox={`0 0 ${viewBoxW} ${viewBoxH}`} className="h-[360px] w-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <marker id="elevationArrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#2563eb" />
          </marker>
        </defs>

        <line x1={0} y1={y0} x2={viewBoxW} y2={y0} stroke="#94a3b8" strokeWidth={strokeW * 1.8} strokeLinecap="round" />

        {roofPitch > 0 ? (
          <path d={`M ${x0} ${y0} L ${x0} ${yRoofEdge} L ${x0 + safeL / 2} ${yPeak} L ${x0 + safeL} ${yRoofEdge} L ${x0 + safeL} ${y0} Z`} fill="#f8fafc" stroke="#475569" strokeWidth={strokeW} />
        ) : (
          <rect x={x0} y={padY} width={safeL} height={safeH} fill="#f8fafc" stroke="#475569" strokeWidth={strokeW} />
        )}

        {drawDistributedLoad(x0, y0, x0, padY, mag, 'right', '#2563eb', 'windward', 'center')}
        {drawDistributedLoad(x0 + safeL, y0, x0 + safeL, padY, mag * 0.65, 'right', '#2563eb', 'leeward', 'center')}
        {drawDistributedLoad(x0, padY, x0 + safeL, padY, mag * 0.72, 'up', '#7c3aed', 'roof uplift', 'center')}

        <g stroke="#cbd5e1" strokeWidth={strokeW * 0.6}>
          <line x1={x0 + safeL + padX * 0.26} y1={y0} x2={x0 + safeL + padX * 0.26} y2={padY} />
          <line x1={x0 + safeL + padX * 0.18} y1={y0} x2={x0 + safeL + padX * 0.34} y2={y0} />
          <line x1={x0 + safeL + padX * 0.18} y1={padY} x2={x0 + safeL + padX * 0.34} y2={padY} />
          <text x={x0 + safeL + padX * 0.38} y={y0 - safeH / 2} fontSize={dimFontSize} fill="#64748b" dominantBaseline="middle" stroke="none">h</text>

          <line x1={x0} y1={y0 + padY * 0.28} x2={x0 + safeL} y2={y0 + padY * 0.28} />
          <line x1={x0} y1={y0 + padY * 0.20} x2={x0} y2={y0 + padY * 0.36} />
          <line x1={x0 + safeL} y1={y0 + padY * 0.20} x2={x0 + safeL} y2={y0 + padY * 0.36} />
          <text x={x0 + safeL / 2} y={y0 + padY * 0.48} fontSize={dimFontSize} fill="#64748b" textAnchor="middle" stroke="none">L = {L.toFixed(1)} ft</text>
        </g>

        <g transform={`translate(${x0 - padX * 0.64}, ${y0 - safeH / 2})`}>
          <line x1="0" y1="0" x2={mag * 0.72} y2="0" stroke="#0f172a" strokeWidth={strokeW * 1.3} markerEnd="url(#elevationArrow)" />
          <text x={mag * 0.36} y={-padY * 0.20} fontSize={fontSize} fill="#0f172a" textAnchor="middle" fontWeight="800">WIND</text>
        </g>
      </svg>
    </div>
  );
};
