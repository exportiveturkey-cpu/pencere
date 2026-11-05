import React, { useMemo, useState } from 'react';
import { Unit, ProfileSystem, Language, ProfileBarConfig } from '../types';
import { calculateProjectOptimization, SystemOptimization, CutPieceDetail, OptimizedBar } from '../services/optimizationService';
import { t } from '../translations';
import { Printer, Filter, Scissors, Settings2, Info, ChevronRight, Check } from 'lucide-react';

interface WorkshopSawReportProps {
  units: Unit[];
  systems: ProfileSystem[];
  lang: Language;
  projectName?: string;
  customBarLengthMm?: number;
  profileBarLengths?: Record<string, number | ProfileBarConfig>;
}

export const WorkshopSawReport: React.FC<WorkshopSawReportProps> = ({
  units,
  systems,
  lang,
  projectName = 'Alumetric Projesi',
  customBarLengthMm,
  profileBarLengths
}) => {
  const [selectedProfileKey, setSelectedProfileKey] = useState<string>('all');
  const [operatorName, setOperatorName] = useState<string>('Volkan KARA');
  const [sawKerfMm, setSawKerfMm] = useState<number>(5.0);
  const [trimCutMm, setTrimCutMm] = useState<number>(0.0);
  const [isPrintMode, setIsPrintMode] = useState<boolean>(false);

  const optimization = useMemo(
    () => calculateProjectOptimization(units, systems, customBarLengthMm, profileBarLengths),
    [units, systems, customBarLengthMm, profileBarLengths]
  );

  const currentDate = useMemo(() => {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  }, []);

  const currentTime = useMemo(() => {
    const d = new Date();
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${mins}`;
  }, []);

  const displayedProfiles = useMemo(() => {
    if (selectedProfileKey === 'all') return optimization;
    return optimization.filter(o => `${o.systemId}-${o.profileCode}` === selectedProfileKey);
  }, [optimization, selectedProfileKey]);

  if (!units || units.length === 0 || optimization.length === 0) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-10 text-center text-slate-400">
        <Scissors size={40} className="mx-auto mb-3 text-slate-500 opacity-60" />
        <p className="font-semibold text-white">Henüz optimize edilecek kesim verisi bulunmuyor.</p>
        <p className="text-xs text-slate-400 mt-1">Projeye poz ekleyip profil seçimi yaptığınızda atölye kesim planı otomatik üretilir.</p>
      </div>
    );
  }

  // Format angle string e.g. "V - V", "I - V", "V - I", "I - I"
  const formatCutSymbol = (left: number, right: number) => {
    const lSym = left === 45 ? 'V' : 'I';
    const rSym = right === 45 ? 'V' : 'I';
    return `${lSym} - ${rSym}`;
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* On-screen Controls & Toolbar (Hidden during Print) */}
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 shadow-inner">
            <Scissors size={20} />
          </div>
          <div>
            <h2 className="text-base font-black text-white flex items-center gap-2">
              Atölye Manuel Testere Kesim Planı
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Endüstri Standardı
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Manuel çift kafa ve tek kafa açı ayarlı testere operatörleri için birebir kesim şeması ve fire tablosu.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Profile Filter */}
          <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-300">
            <Filter size={14} className="text-slate-400" />
            <select
              value={selectedProfileKey}
              onChange={(e) => setSelectedProfileKey(e.target.value)}
              className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-slate-900 text-white">Tüm Profiller ({optimization.length})</option>
              {optimization.map(opt => (
                <option key={`${opt.systemId}-${opt.profileCode}`} value={`${opt.systemId}-${opt.profileCode}`} className="bg-slate-900 text-white">
                  {opt.profileCode} - {opt.profileLabel} ({opt.totalBars} Boy)
                </option>
              ))}
            </select>
          </div>

          {/* Responsible Person Input */}
          <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-300">
            <span className="text-slate-400 font-bold">Sorumlu:</span>
            <input
              type="text"
              value={operatorName}
              onChange={(e) => setOperatorName(e.target.value)}
              placeholder="Operatör / Mühendis"
              className="bg-transparent text-white font-medium focus:outline-none w-28"
            />
          </div>

          {/* Print Button */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold rounded-xl text-xs shadow-lg shadow-blue-500/20 transition-all border border-blue-400/30"
          >
            <Printer size={16} />
            Yazdır / PDF Kaydet
          </button>
        </div>
      </div>

      {/* Pages Container - Styled cleanly for screen and optimized for standard A4 printing */}
      <div className="space-y-8 print:space-y-0 print:m-0 print:p-0">
        {displayedProfiles.map((opt, pageIdx) => {
          const totalProfileCuts = opt.allCutPieces || opt.bars.flatMap(b => b.cutPieces || []);
          
          // Calculate total waste in mm
          const totalStockLengthMm = opt.bars.reduce((sum, b) => sum + b.barLength, 0);
          const totalCutLengthMm = opt.bars.reduce((sum, b) => sum + b.cuts.reduce((s, c) => s + c, 0), 0);
          const totalWasteMm = Math.max(0, totalStockLengthMm - totalCutLengthMm);
          const wastePercent = totalStockLengthMm > 0 ? (totalWasteMm / totalStockLengthMm) * 100 : 0;

          // Deduce profile height/width estimate for specs box
          const isFrame = opt.profileLabel.toLowerCase().includes('kasa') || opt.profileLabel.toLowerCase().includes('frame');
          const isSash = opt.profileLabel.toLowerCase().includes('kanat') || opt.profileLabel.toLowerCase().includes('sash');
          const isBead = opt.profileLabel.toLowerCase().includes('çıta') || opt.profileLabel.toLowerCase().includes('bead');
          const profileHeightMm = isFrame ? 55.0 : (isSash ? 75.0 : (isBead ? 22.0 : 42.5));

          // Group cut list for the summary table (like in the standard workshop report)
          const sortedPieces = [...totalProfileCuts].sort((a, b) => {
            if (a.length !== b.length) return a.length - b.length;
            return a.unitName.localeCompare(b.unitName);
          });

          return (
            <div
              key={`${opt.systemId}-${opt.profileCode}-${pageIdx}`}
              className="bg-white text-black p-6 sm:p-8 rounded-2xl shadow-xl font-mono text-[13px] border border-slate-300 print:border-none print:shadow-none print:rounded-none print:p-4 print:page-break-after-always print:m-0"
              style={{ minHeight: '297mm' }}
            >
              {/* 1. Header Section */}
              <div className="border-b-2 border-black pb-3 mb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-black uppercase">
                      Kesim Optimizasyonu
                    </h1>
                    <div className="mt-1 text-xs">
                      <span className="font-bold">Sorumlu Kişi:</span> {operatorName || 'Volkan KARA'}
                    </div>
                  </div>

                  <div className="text-right text-xs space-y-0.5">
                    <div><span className="font-bold">Sayfa</span> : {pageIdx + 1} / {displayedProfiles.length}</div>
                    <div><span className="font-bold">Tarih</span> : {currentDate}</div>
                    <div><span className="font-bold">Saat</span> : {currentTime}</div>
                    <div className="truncate max-w-[280px]">
                      <span className="font-bold">Proje Adı</span> : {projectName}
                    </div>
                    <div className="text-[10px] text-gray-600">
                      <span className="font-bold">Sistem</span> : {opt.systemName}
                    </div>
                  </div>
                </div>

                <div className="mt-3 text-[11px] italic text-gray-800 border-t border-gray-300 pt-1.5">
                  Kesim ve açı bilgisi Çıktı Dosyası olmadan testere ayarlarına uygun.
                </div>
              </div>

              {/* 2. Middle Section: Cuts Table (Left) + Profile Specs Box (Right) */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-6 pb-4 border-b border-gray-300">
                {/* Left: Cuts Summary Table */}
                <div className="md:col-span-7">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-black text-[11px]">
                        <th className="py-1 pr-2 font-bold w-12">Adet</th>
                        <th className="py-1 px-2 font-bold text-right">Kes.Uznlğu</th>
                        <th className="py-1 px-2 font-bold text-right">Uzunluk</th>
                        <th className="py-1 px-3 font-bold text-center">Kesim</th>
                        <th className="py-1 pl-2 font-bold">Ünite Num.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {sortedPieces.map((piece, pIdx) => (
                        <tr key={piece.id || pIdx} className="hover:bg-gray-50">
                          <td className="py-1 pr-2">1 x</td>
                          <td className="py-1 px-2 text-right font-bold">
                            {piece.length.toFixed(1).replace('.', ',')}
                          </td>
                          <td className="py-1 px-2 text-right text-gray-700">
                            {piece.length.toFixed(1).replace('.', ',')}
                          </td>
                          <td className="py-1 px-3 text-center font-bold tracking-wider">
                            {formatCutSymbol(piece.angleLeft, piece.angleRight)}
                          </td>
                          <td className="py-1 pl-2 font-semibold">
                            {piece.unitName}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Right: Profile Specifications Box */}
                <div className="md:col-span-5 bg-gray-50 p-3 rounded border border-gray-300 text-xs space-y-1 self-start">
                  <div className="flex justify-between">
                    <span className="font-bold">Numara:</span>
                    <span className="font-semibold">{opt.profileCode}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-bold">Renk:</span>
                    <span className="truncate max-w-[160px]">{opt.profileColor || 'RAL 7016 Antrasit'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-bold">Adı:</span>
                    <span className="font-semibold truncate max-w-[160px]">{opt.profileLabel}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-bold">Başl./Bitş ölçüsü</span>
                    <span>= {trimCutMm.toFixed(1).replace('.', ',')} mm</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-bold">Testere ağzı</span>
                    <span>= {sawKerfMm.toFixed(1).replace('.', ',')} mm</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-bold">Artan Uzunluk</span>
                    <span>= Yok</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-bold">Profil Uzunluğu</span>
                    <span>= {opt.barLength.toFixed(1).replace('.', ',')} mm</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-bold">Profil Yüksekliği</span>
                    <span>= {profileHeightMm.toFixed(1).replace('.', ',')} mm</span>
                  </div>
                </div>
              </div>

              {/* 3. Graphical Saw Bar Diagram Section */}
              <div className="space-y-4 mb-6">
                {opt.bars.map((bar, barIdx) => {
                  const pieces = bar.cutPieces || [];
                  const barLen = bar.barLength;
                  const remaining = Math.max(0, bar.remaining);

                  return (
                    <div key={`bar-${barIdx}`} className="flex items-center gap-2 sm:gap-3 py-1 avoid-break">
                      {/* Left: Bar index and cross-section icon with feed arrow */}
                      <div className="flex items-center gap-1.5 w-16 sm:w-20 shrink-0 text-xs font-bold text-gray-800">
                        <span>{barIdx + 1})</span>
                        <span>1x</span>
                        <div className="flex items-center gap-0.5 ml-1">
                          {/* Profile cross section shape symbol */}
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-800">
                            <rect x="3" y="3" width="18" height="18" rx="1" />
                            <path d="M7 3v18M17 3v18" strokeDasharray="2 2" />
                          </svg>
                          <span className="text-[10px]">⇨</span>
                        </div>
                      </div>

                      {/* Middle & Right: SVG Bar Diagram with 45°/90° cut chamfers and piece tags */}
                      <div className="flex-1 overflow-x-auto">
                        <SawBarSvg
                          bar={bar}
                          barIndex={barIdx}
                          sawKerf={sawKerfMm}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 4. Footer Summary */}
              <div className="border-t-2 border-black pt-3 mt-6 flex flex-wrap justify-between items-center text-xs font-bold">
                <div className="flex items-center gap-6">
                  <span>{opt.totalBars} Boy</span>
                  <span>
                    Kesim firesi (kalan boylar dahil): {totalWasteMm} mm = {wastePercent.toFixed(1).replace('.', ',')} %
                  </span>
                </div>

                <div className="text-right text-[11px] text-gray-600 font-normal">
                  Alumetric Engineering Suite • Atölye Kesim Tablosu
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// SVG component rendering the manual saw cut bar with 45/90 degree chamfers
interface SawBarSvgProps {
  bar: OptimizedBar;
  barIndex: number;
  sawKerf: number;
}

const SawBarSvg: React.FC<SawBarSvgProps> = ({ bar, barIndex, sawKerf }) => {
  const barLen = bar.barLength;
  const cuts = bar.cutPieces && bar.cutPieces.length > 0 
    ? bar.cutPieces 
    : bar.cuts.map((len, idx) => ({
        id: `c-${idx}`,
        length: len,
        label: 'Kesim',
        unitName: `P${idx + 1}`,
        angleLeft: 45,
        angleRight: 45,
        pieceNumber: idx + 1
      } as CutPieceDetail));

  // Diagram geometry parameters
  const svgWidth = 840;
  const svgHeight = 72;
  const barTopY = 22;
  const barBottomY = 46;
  const barHeight = barBottomY - barTopY; // 24px
  const bevelOffset = 7; // Horizontal pixel shift for 45° angle cut

  // Scale: pixels per mm along the bar
  const scale = svgWidth / barLen;

  let currentMm = 0;

  return (
    <div className="w-full overflow-hidden">
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full h-auto max-h-[72px] text-black font-mono select-none"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Outer full-stock bounding bar background (very subtle gray) */}
        <rect
          x={0}
          y={barTopY}
          width={svgWidth}
          height={barHeight}
          fill="#fbfbfb"
          stroke="#444"
          strokeWidth="1.2"
        />

        {/* Render each cut piece */}
        {cuts.map((piece, pIdx) => {
          const pieceStartMm = currentMm;
          const pieceEndMm = currentMm + piece.length;
          currentMm = pieceEndMm + sawKerf;

          const startX = pieceStartMm * scale;
          const endX = pieceEndMm * scale;
          const pieceWidth = Math.max(2, endX - startX);
          const midX = startX + pieceWidth / 2;

          // Compute 45° vs 90° points
          const leftIs45 = piece.angleLeft === 45;
          const rightIs45 = piece.angleRight === 45;

          // Points for polygon chamfer
          // Top-left, top-right, bottom-right, bottom-left
          const pTopLeftX = leftIs45 ? startX + bevelOffset : startX;
          const pBottomLeftX = startX;
          const pTopRightX = rightIs45 ? endX - bevelOffset : endX;
          const pBottomRightX = endX;

          const polyPoints = `${pTopLeftX},${barTopY} ${pTopRightX},${barTopY} ${pBottomRightX},${barBottomY} ${pBottomLeftX},${barBottomY}`;

          return (
            <g key={piece.id || pIdx}>
              {/* Profile piece body with solid outline */}
              <polygon
                points={polyPoints}
                fill="#ffffff"
                stroke="#000000"
                strokeWidth="1.5"
              />

              {/* Tag Above: e.g. "P2 4090 (5)" */}
              <text
                x={midX}
                y={barTopY - 6}
                textAnchor="middle"
                fontSize="11"
                fontWeight="bold"
                fill="#000000"
              >
                {piece.unitName} {Math.round(piece.length)} ({piece.pieceNumber || pIdx + 1})
              </text>

              {/* Left Cut Line & Angle Below */}
              {leftIs45 ? (
                <>
                  <line
                    x1={startX + bevelOffset}
                    y1={barTopY}
                    x2={startX}
                    y2={barBottomY}
                    stroke="#000000"
                    strokeWidth="1.5"
                  />
                  <text
                    x={startX + 3}
                    y={barBottomY + 14}
                    textAnchor="middle"
                    fontSize="9.5"
                    fill="#333333"
                    fontWeight="600"
                  >
                    45
                  </text>
                </>
              ) : (
                <>
                  <line
                    x1={startX}
                    y1={barTopY}
                    x2={startX}
                    y2={barBottomY}
                    stroke="#000000"
                    strokeWidth="1.5"
                  />
                  <text
                    x={startX}
                    y={barBottomY + 14}
                    textAnchor="middle"
                    fontSize="9.5"
                    fill="#333333"
                    fontWeight="600"
                  >
                    90
                  </text>
                </>
              )}

              {/* Right Cut Line & Angle Below */}
              {rightIs45 ? (
                <>
                  <line
                    x1={endX - bevelOffset}
                    y1={barTopY}
                    x2={endX}
                    y2={barBottomY}
                    stroke="#000000"
                    strokeWidth="1.5"
                  />
                  <text
                    x={endX - 3}
                    y={barBottomY + 14}
                    textAnchor="middle"
                    fontSize="9.5"
                    fill="#333333"
                    fontWeight="600"
                  >
                    45
                  </text>
                </>
              ) : (
                <>
                  <line
                    x1={endX}
                    y1={barTopY}
                    x2={endX}
                    y2={barBottomY}
                    stroke="#000000"
                    strokeWidth="1.5"
                  />
                  <text
                    x={endX}
                    y={barBottomY + 14}
                    textAnchor="middle"
                    fontSize="9.5"
                    fill="#333333"
                    fontWeight="600"
                  >
                    90
                  </text>
                </>
              )}
            </g>
          );
        })}

        {/* Offcut / Scrap remaining part on the right */}
        {bar.remaining > 0 && (
          <g>
            <rect
              x={Math.min(svgWidth - 2, currentMm * scale)}
              y={barTopY}
              width={Math.max(0, svgWidth - currentMm * scale)}
              height={barHeight}
              fill="#f3f4f6"
              stroke="#666666"
              strokeDasharray="3 3"
              strokeWidth="1"
            />
            {/* Scrap length label centered in remaining area or right-aligned */}
            <text
              x={Math.min(svgWidth - 10, currentMm * scale + (svgWidth - currentMm * scale) / 2)}
              y={barTopY - 6}
              textAnchor="middle"
              fontSize="11"
              fill="#555555"
              fontWeight="bold"
            >
              {Math.round(bar.remaining)}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
};
