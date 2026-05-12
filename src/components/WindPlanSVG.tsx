import React from 'react';

interface WindPlanSVGProps {
  bldgL: number; // Length (X-dimension typically)
  bldgB: number; // Width (Y-dimension typically)
}

export const WindPlanSVG: React.FC<WindPlanSVGProps> = ({ bldgL, bldgB }) => {
  const safeL = Math.max(bldgL, 10);
  const safeB = Math.max(bldgB, 10);

  const drawW = safeL;
  const drawH = safeB;
  const pad = Math.max(drawW, drawH) * 0.22;
  const viewBoxW = drawW + pad * 2;
  const viewBoxH = drawH + pad * 2;

  const x0 = pad;
  const y0 = pad;
  const arrowSize = pad * 0.52;
  const strokeW = Math.max(viewBoxW, viewBoxH) * 0.005;
  const fontSize = Math.max(5, Math.max(viewBoxW, viewBoxH) * 0.032);

  return (
    <div className="w-full overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-gray-900">Plan View - Wind Cases</div>
          <div className="text-xs text-gray-500">Building footprint and wind directions scaled to fit this panel.</div>
        </div>
        <div className="rounded bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
          {bldgL.toFixed(0)} ft × {bldgB.toFixed(0)} ft
        </div>
      </div>

      <svg viewBox={`0 0 ${viewBoxW} ${viewBoxH}`} className="h-[360px] w-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <marker id="windArrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#0f172a" />
          </marker>
        </defs>

        <rect
          x={x0}
          y={y0}
          width={drawW}
          height={drawH}
          fill="#f1f5f9"
          stroke="#475569"
          strokeWidth={strokeW * 2}
          rx={Math.min(drawW, drawH) * 0.015}
        />
        <text x={x0 + drawW / 2} y={y0 + drawH / 2} fontSize={fontSize * 1.15} fill="#94a3b8" dominantBaseline="middle" textAnchor="middle" fontWeight="bold">
          PLAN
        </text>

        <g stroke="#cbd5e1" strokeWidth={strokeW}>
          <line x1={x0} y1={y0 - pad * 0.24} x2={x0 + drawW} y2={y0 - pad * 0.24} />
          <line x1={x0} y1={y0 - pad * 0.16} x2={x0} y2={y0 - pad * 0.32} />
          <line x1={x0 + drawW} y1={y0 - pad * 0.16} x2={x0 + drawW} y2={y0 - pad * 0.32} />
          <text x={x0 + drawW / 2} y={y0 - pad * 0.38} fontSize={fontSize} fill="#64748b" textAnchor="middle" stroke="none">L = {bldgL.toFixed(1)}'</text>

          <line x1={x0 + drawW + pad * 0.24} y1={y0} x2={x0 + drawW + pad * 0.24} y2={y0 + drawH} />
          <line x1={x0 + drawW + pad * 0.16} y1={y0} x2={x0 + drawW + pad * 0.32} y2={y0} />
          <line x1={x0 + drawW + pad * 0.16} y1={y0 + drawH} x2={x0 + drawW + pad * 0.32} y2={y0 + drawH} />
          <text x={x0 + drawW + pad * 0.38} y={y0 + drawH / 2} fontSize={fontSize} fill="#64748b" dominantBaseline="middle" stroke="none">B = {bldgB.toFixed(1)}'</text>
        </g>

        <g transform={`translate(${x0 - arrowSize - pad * 0.08}, ${y0 + drawH / 2})`}>
          <line x1="0" y1="0" x2={arrowSize} y2="0" stroke="#0f172a" strokeWidth={strokeW * 1.8} markerEnd="url(#windArrow)" />
          <text x={arrowSize / 2} y={-pad * 0.12} fontSize={fontSize * 0.9} fill="#0f172a" textAnchor="middle" fontWeight="bold">WIND X</text>
        </g>

        <g transform={`translate(${x0 + drawW / 2}, ${y0 + drawH + arrowSize + pad * 0.06})`}>
          <line x1="0" y1="0" x2="0" y2={-arrowSize} stroke="#0f172a" strokeWidth={strokeW * 1.8} markerEnd="url(#windArrow)" />
          <text x={pad * 0.32} y={-arrowSize / 2} fontSize={fontSize * 0.9} fill="#0f172a" dominantBaseline="middle" fontWeight="bold">WIND Y</text>
        </g>
      </svg>
    </div>
  );
};
