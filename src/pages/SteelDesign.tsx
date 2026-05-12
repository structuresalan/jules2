import React, { useMemo, useState } from 'react';
import { Frame, Download } from 'lucide-react';
import { usePDF } from 'react-to-pdf';
import wShapesData from '../data/aisc/shapes_w.json';
import aiscData from '../data/aisc/code_factors.json';
import { IBC_TO_AISC_MAP } from '../data/ibc_mapping';
import { VariableInput } from '../components/VariableInput';
import { BeamModeler2D } from '../components/BeamModeler2D';

const shapes = wShapesData as Record<string, { A: number; Zx: number }>;
const shapeNames = Object.keys(shapes);

type SteelTab = 'Beam' | 'Column' | 'Composite Beam' | 'Single Angle' | 'Base Plate' | 'Anchorage';

export const SteelDesign: React.FC = () => {
  const { toPDF, targetRef } = usePDF({ filename: 'steel-design-report.pdf' });

  const [ibcYear, setIbcYear] = useState('IBC 2018');
  const [aiscYear, setAiscYear] = useState(IBC_TO_AISC_MAP['IBC 2018']);
  const [isOverridden, setIsOverridden] = useState(false);
  const [activeTab, setActiveTab] = useState<SteelTab>('Beam');

  const [method, setMethod] = useState('LRFD');
  const [section, setSection] = useState(shapeNames[1]);
  const [fy, setFy] = useState(50);
  const [pu, setPu] = useState(100);
  const [mu, setMu] = useState(150);

  const props = useMemo(() => shapes[section], [section]);
  const factors = (aiscData as Record<string, typeof aiscData['AISC 360-16']>)[aiscYear] || aiscData['AISC 360-16'];

  const phi_t = method === 'LRFD' ? factors.phi_t : factors.omega_t;
  const phi_b = method === 'LRFD' ? factors.phi_b : factors.omega_b;
  const Pn = fy * props.A;
  const Mn = (fy * props.Zx) / 12;
  const designTension = method === 'LRFD' ? phi_t * Pn : Pn / phi_t;
  const designMoment = method === 'LRFD' ? phi_b * Mn : Mn / phi_b;
  const interaction = pu / designTension >= 0.2 ? pu / designTension + (8 / 9) * (mu / designMoment) : pu / (2 * designTension) + mu / designMoment;
  const isOk = interaction <= 1;

  const tabs: SteelTab[] = ['Beam', 'Column', 'Composite Beam', 'Single Angle', 'Base Plate', 'Anchorage'];

  const renderPlaceholder = (name: string) => (
    <div className="bg-white border border-gray-200 rounded-lg p-8">
      <h2 className="text-xl font-semibold text-gray-900 mb-2">{name}</h2>
      <p className="text-gray-600">Section kept in place so you can fill in your design logic without losing workflow structure.</p>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-3"><Frame className="text-blue-600" />Steel Design</h1>
          <p className="mt-2 text-gray-500">Beam modeler added while preserving all steel module sections.</p>
        </div>
        <div className="flex items-center gap-4 bg-white p-2 rounded-lg border border-gray-200 shadow-sm w-full lg:w-auto">
          <div className="flex items-center gap-3 pr-4 border-r border-gray-200">
            <select value={ibcYear} onChange={(e) => { const y = e.target.value; setIbcYear(y); setAiscYear(IBC_TO_AISC_MAP[y] || 'AISC 360-16'); setIsOverridden(false); }} className="text-sm border rounded px-2 py-1">
              {Object.keys(IBC_TO_AISC_MAP).map((year) => <option key={year}>{year}</option>)}
            </select>
            <select value={aiscYear} onChange={(e) => { setAiscYear(e.target.value); setIsOverridden(e.target.value !== IBC_TO_AISC_MAP[ibcYear]); }} className="text-sm border rounded px-2 py-1">
              <option>AISC 360-22</option><option>AISC 360-16</option><option>AISC 360-10</option><option>AISC 360-05</option>
            </select>
            {isOverridden && <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded">OVERRIDE</span>}
          </div>
          <button onClick={() => toPDF()} className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 text-sm font-medium"><Download size={16} />Export</button>
        </div>
      </div>

      <div className="border-b border-gray-200 overflow-x-auto">
        <nav className="-mb-px flex space-x-8 min-w-max">
          {tabs.map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`py-3 px-1 border-b-2 text-sm font-medium ${activeTab === tab ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'}`}>
              {tab}
            </button>
          ))}
        </nav>
      </div>

      <div ref={targetRef}>
        {activeTab === 'Beam' && <BeamModeler2D aiscYear={aiscYear} />}

        {activeTab === 'Column' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-4">
              <h2 className="text-lg font-semibold">Column Quick Check</h2>
              <select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full border rounded p-2"><option>LRFD</option><option>ASD</option></select>
              <select value={section} onChange={(e) => setSection(e.target.value)} className="w-full border rounded p-2">{shapeNames.map((name) => <option key={name}>{name}</option>)}</select>
              <VariableInput label="Fy" value={fy} onChange={setFy} unit="ksi" />
              <VariableInput label="Pu" value={pu} onChange={setPu} unit="kips" />
              <VariableInput label="Mu" value={mu} onChange={setMu} unit="kip-ft" />
            </div>
            <div className="lg:col-span-2 bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-4">
              <h2 className="text-lg font-semibold">Column Interaction (Simplified)</h2>
              <div className={`p-4 rounded border ${isOk ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <div className="text-sm">Interaction ratio</div>
                <div className="text-3xl font-bold">{interaction.toFixed(3)} {isOk ? 'PASS' : 'FAIL'}</div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-gray-50 border rounded p-3">Tension Capacity: <b>{designTension.toFixed(1)} kips</b></div>
                <div className="bg-gray-50 border rounded p-3">Moment Capacity: <b>{designMoment.toFixed(1)} kip-ft</b></div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Composite Beam' && renderPlaceholder('Composite Beam')}
        {activeTab === 'Single Angle' && renderPlaceholder('Single Angle')}
        {activeTab === 'Base Plate' && renderPlaceholder('Base Plate')}
        {activeTab === 'Anchorage' && renderPlaceholder('Anchorage')}
      </div>
    </div>
  );
};
