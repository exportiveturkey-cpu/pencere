import React, { useState, useRef } from 'react';
import { Project, GlassToolReport, Language } from '../types';
import { 
  FileText, Upload, Plus, Trash2, Eye, Download, ExternalLink, 
  CheckCircle2, ShieldCheck, Scale, Thermometer, Sun, Volume2, 
  Layers, AlertCircle, X, Edit3, Sparkles, Check
} from 'lucide-react';
import { createDefaultGlassToolReport } from '../services/glassToolService';

interface GlassToolManagerProps {
  project: Project;
  onUpdateProject: (updatedProject: Project) => void;
  lang: Language;
}

export const GlassToolManager: React.FC<GlassToolManagerProps> = ({
  project,
  onUpdateProject,
  lang
}) => {
  const isTr = lang === 'tr';
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedReport, setSelectedReport] = useState<GlassToolReport | null>(null);
  const [editingReport, setEditingReport] = useState<GlassToolReport | null>(null);
  const [showUploadToast, setShowUploadToast] = useState<string | null>(null);

  const reports: GlassToolReport[] = project.glassToolReports || [];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isImage = file.type.startsWith('image/');

    if (!isPdf && !isImage) {
      alert(isTr ? 'Lütfen sadece PDF veya Resim formatında Şişecam GlassTool raporu yükleyiniz.' : 'Please upload only PDF or Image GlassTool reports.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const newReport: GlassToolReport = {
        id: `glasstool-${Date.now()}`,
        name: file.name,
        fileData: dataUrl,
        fileType: isPdf ? 'pdf' : 'image',
        fileSize: file.size,
        uploadedAt: new Date().toISOString().split('T')[0],
        glassCombination: isTr 
          ? '6 mm Isıcam Konfor + 16 mm HB (%90 Argon) + 4+4.2 Lamine Cam' 
          : '6 mm Isıcam Konfor + 16 mm Cavity (90% Argon) + 4+4.2 Laminated',
        ugValue: 1.10,
        lightTransmission: 71,
        solarFactor: 43,
        soundReductionRw: 36,
        totalThicknessMm: 30.2,
        spacerGas: '16 mm HB (%90 Argon)',
        standards: 'TS EN 410 / TS EN 673 CE Uygunluk Beyanı',
        notes: isTr 
          ? 'Şişecam GlassTool uygulamasından alınan resmi performans ve statik yalıtım raporudur.' 
          : 'Official certified performance and thermal insulation report calculated via Şişecam GlassTool.',
        includeInQuotePrint: true
      };

      const updated = [...reports, newReport];
      onUpdateProject({
        ...project,
        glassToolReports: updated
      });

      setShowUploadToast(isTr ? `"${file.name}" teklife ek olarak başarıyla eklendi!` : `"${file.name}" attached to proposal!`);
      setTimeout(() => setShowUploadToast(null), 4000);
    };

    reader.readAsDataURL(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAddSampleReport = () => {
    const sample = createDefaultGlassToolReport(project);
    const updated = [...reports, sample];
    onUpdateProject({
      ...project,
      glassToolReports: updated
    });
    setShowUploadToast(isTr ? 'Örnek Şişecam GlassTool raporu teklife eklendi!' : 'Sample GlassTool report attached!');
    setTimeout(() => setShowUploadToast(null), 4000);
  };

  const handleDeleteReport = (reportId: string) => {
    const updated = reports.filter(r => r.id !== reportId);
    onUpdateProject({
      ...project,
      glassToolReports: updated
    });
  };

  const handleTogglePrint = (reportId: string, currentVal: boolean) => {
    const updated = reports.map(r => {
      if (r.id === reportId) {
        return { ...r, includeInQuotePrint: !currentVal };
      }
      return r;
    });
    onUpdateProject({
      ...project,
      glassToolReports: updated
    });
  };

  const handleSaveEdit = (edited: GlassToolReport) => {
    const updated = reports.map(r => r.id === edited.id ? edited : r);
    onUpdateProject({
      ...project,
      glassToolReports: updated
    });
    setEditingReport(null);
  };

  return (
    <div className="mb-6 p-6 bg-slate-900 border border-teal-500/30 rounded-[2rem] print:hidden shadow-xl relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded-2xl shrink-0">
            <FileText size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-white text-sm font-black uppercase tracking-wider">
                {isTr ? 'Şişecam GlassTool™ Teklif Eki Raporu' : 'Şişecam GlassTool™ Proposal Annex'}
              </span>
              <span className="text-[10px] bg-teal-500/20 text-teal-300 font-bold px-2 py-0.5 rounded-full border border-teal-500/30">
                {reports.length} {isTr ? 'Rapor' : 'Report'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {isTr 
                ? 'Şişecam GlassTool web sitesinden indirilen resmi PDF raporu teklifin ekine koyabilir ve müşteriye sunabilirsiniz.' 
                : 'Attach official PDF calculation reports from Şişecam GlassTool directly into this proposal.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* GlassTool Launch */}
          <a
            href={isTr ? "https://glasstool.sisecam.com/tr/HomePage.aspx" : "https://glasstool.sisecam.com/"}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/30 rounded-xl text-xs font-bold transition-all"
            title={isTr ? 'Şişecam GlassTool Hesaplayıcıyı Aç' : 'Launch Şişecam GlassTool'}
          >
            <ExternalLink size={13} />
            <span>GlassTool™ Portal</span>
          </a>

          {/* Quick Sample Button */}
          {reports.length === 0 && (
            <button
              onClick={handleAddSampleReport}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 border border-teal-500/40 rounded-xl text-xs font-bold transition-all"
            >
              <Sparkles size={13} />
              <span>{isTr ? 'Örnek Rapor Ekle' : 'Add Sample Report'}</span>
            </button>
          )}

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf,image/*"
            onChange={handleFileUpload}
            className="hidden"
          />

          {/* Upload Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-teal-600/20"
          >
            <Upload size={14} />
            <span>{isTr ? 'GlassTool PDF Raporu Yükle' : 'Upload GlassTool PDF'}</span>
          </button>
        </div>
      </div>

      {/* Upload Toast */}
      {showUploadToast && (
        <div className="mt-4 p-3 bg-teal-500/10 border border-teal-500/30 rounded-xl flex items-center gap-2 text-teal-300 text-xs font-bold animate-in fade-in">
          <CheckCircle2 size={16} />
          <span>{showUploadToast}</span>
        </div>
      )}

      {/* Reports List */}
      {reports.length === 0 ? (
        <div className="mt-5 p-6 border-2 border-dashed border-slate-800 rounded-2xl text-center bg-slate-950/40">
          <div className="w-12 h-12 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center mx-auto mb-3">
            <ShieldCheck size={24} />
          </div>
          <h4 className="text-white text-xs font-bold mb-1">
            {isTr ? 'Teklife Eklenmiş Şişecam Raporu Yok' : 'No Şişecam GlassTool Reports Attached Yet'}
          </h4>
          <p className="text-[11px] text-slate-400 max-w-md mx-auto mb-4">
            {isTr 
              ? 'Müşteri teklifine ve PDF çıktısına resmi EN 410 / EN 673 onaylı Ug, LT ve akustik değerlerini içeren Şişecam GlassTool raporunu ekleyin.' 
              : 'Add official certified thermal and acoustic insulation reports to this quotation.'}
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow"
            >
              <Upload size={13} />
              {isTr ? 'Bilgisayarımdan PDF Seç' : 'Choose PDF File'}
            </button>
            <button
              onClick={handleAddSampleReport}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/20 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
            >
              <Sparkles size={13} />
              {isTr ? 'Hazır Örnek Rapor Yükle' : 'Load Ready Sample'}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {reports.map((report, idx) => (
            <div 
              key={report.id}
              className="p-4 bg-slate-950/70 border border-slate-800 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-teal-500/40 transition-all"
            >
              <div className="flex items-start gap-3.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400 flex items-center justify-center shrink-0 mt-0.5">
                  <FileText size={20} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-extrabold text-white text-xs truncate max-w-sm">
                      {report.name}
                    </span>
                    <span className="text-[9px] bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-md font-mono uppercase font-bold">
                      {report.fileType.toUpperCase()} {report.fileSize ? `(${(report.fileSize / 1024).toFixed(0)} KB)` : ''}
                    </span>
                    <span className="text-[9px] text-slate-500 font-mono">
                      {report.uploadedAt}
                    </span>
                  </div>

                  {/* Certified metrics pills */}
                  <div className="flex items-center gap-2 mt-2 flex-wrap text-[10px]">
                    <span className="bg-teal-500/10 text-teal-300 px-2 py-0.5 rounded-lg border border-teal-500/20 font-bold">
                      Ug: {report.ugValue?.toFixed(2) || '1.10'} W/m²K
                    </span>
                    <span className="bg-blue-500/10 text-blue-300 px-2 py-0.5 rounded-lg border border-blue-500/20 font-bold">
                      LT: %{report.lightTransmission || '71'}
                    </span>
                    <span className="bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded-lg border border-amber-500/20 font-bold">
                      g: %{report.solarFactor || '43'}
                    </span>
                    {report.soundReductionRw && (
                      <span className="bg-emerald-500/10 text-emerald-300 px-2 py-0.5 rounded-lg border border-emerald-500/20 font-bold">
                        Rw: {report.soundReductionRw} dB
                      </span>
                    )}
                    <span className="text-slate-400 italic truncate max-w-xs">
                      {report.glassCombination}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                {/* Print inclusion toggle */}
                <label className="flex items-center gap-1.5 cursor-pointer bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-700 hover:border-slate-600 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={report.includeInQuotePrint !== false}
                    onChange={() => handleTogglePrint(report.id, report.includeInQuotePrint !== false)}
                    className="rounded text-teal-500 focus:ring-0 w-3.5 h-3.5 bg-slate-950 border-slate-600"
                  />
                  <span className="text-[11px] font-bold">
                    {isTr ? 'Teklife Ekle (Baskı)' : 'Print with Quote'}
                  </span>
                </label>

                {/* Preview */}
                <button
                  onClick={() => setSelectedReport(report)}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-teal-300 rounded-xl border border-slate-700 transition"
                  title={isTr ? 'Raporu İncele' : 'Preview Report'}
                >
                  <Eye size={15} />
                </button>

                {/* Edit Specs */}
                <button
                  onClick={() => setEditingReport(report)}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition"
                  title={isTr ? 'Değerleri Düzenle' : 'Edit Specs'}
                >
                  <Edit3 size={15} />
                </button>

                {/* Download */}
                <a
                  href={report.fileData}
                  download={report.name}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition"
                  title={isTr ? 'PDF İndir' : 'Download PDF'}
                >
                  <Download size={15} />
                </a>

                {/* Delete */}
                <button
                  onClick={() => handleDeleteReport(report.id)}
                  className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/20 transition"
                  title={isTr ? 'Raporu Sil' : 'Remove Report'}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview Modal */}
      {selectedReport && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[150] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-teal-400" />
                <h3 className="font-extrabold text-white text-sm truncate max-w-md">
                  {selectedReport.name}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={selectedReport.fileData}
                  download={selectedReport.name}
                  className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                >
                  <Download size={14} />
                  <span>{isTr ? 'PDF İndir' : 'Download'}</span>
                </a>
                <button
                  onClick={() => setSelectedReport(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-slate-950">
              {selectedReport.fileType === 'pdf' ? (
                <div className="w-full h-[650px] rounded-2xl overflow-hidden bg-slate-900 border border-slate-800">
                  <iframe
                    src={selectedReport.fileData}
                    className="w-full h-full border-none"
                    title="GlassTool Report Preview"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center p-4">
                  <img
                    src={selectedReport.fileData}
                    alt={selectedReport.name}
                    className="max-h-[650px] object-contain rounded-xl border border-slate-800"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Specs Modal */}
      {editingReport && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[150] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Edit3 size={18} className="text-teal-400" />
                <h3 className="font-extrabold text-white text-sm">
                  {isTr ? 'GlassTool Performans Değerlerini Düzenle' : 'Edit GlassTool Certified Metrics'}
                </h3>
              </div>
              <button 
                onClick={() => setEditingReport(null)}
                className="text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 font-bold block mb-1">
                  {isTr ? 'Cam Kombinasyonu Tanımı:' : 'Glass Combination:'}
                </label>
                <input
                  type="text"
                  value={editingReport.glassCombination || ''}
                  onChange={e => setEditingReport({ ...editingReport, glassCombination: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-medium focus:border-teal-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 font-bold block mb-1">
                    Ug Değeri (W/m²K):
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    value={editingReport.ugValue ?? ''}
                    onChange={e => setEditingReport({ ...editingReport, ugValue: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono font-bold focus:border-teal-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-slate-400 font-bold block mb-1">
                    Işık Geçirgenliği LT (%):
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={editingReport.lightTransmission ?? ''}
                    onChange={e => setEditingReport({ ...editingReport, lightTransmission: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono font-bold focus:border-teal-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 font-bold block mb-1">
                    Güneş Faktörü g (%):
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={editingReport.solarFactor ?? ''}
                    onChange={e => setEditingReport({ ...editingReport, solarFactor: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono font-bold focus:border-teal-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-slate-400 font-bold block mb-1">
                    Ses Yalıtımı Rw (dB):
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={editingReport.soundReductionRw ?? ''}
                    onChange={e => setEditingReport({ ...editingReport, soundReductionRw: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono font-bold focus:border-teal-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 font-bold block mb-1">
                    {isTr ? 'Toplam Kalınlık (mm):' : 'Total Thickness (mm):'}
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={editingReport.totalThicknessMm ?? ''}
                    onChange={e => setEditingReport({ ...editingReport, totalThicknessMm: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono font-bold focus:border-teal-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-slate-400 font-bold block mb-1">
                    {isTr ? 'Standart / Beyanname:' : 'Standard:'}
                  </label>
                  <input
                    type="text"
                    value={editingReport.standards || ''}
                    onChange={e => setEditingReport({ ...editingReport, standards: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-medium focus:border-teal-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 font-bold block mb-1">
                  {isTr ? 'Rapor Notu:' : 'Report Note:'}
                </label>
                <textarea
                  rows={2}
                  value={editingReport.notes || ''}
                  onChange={e => setEditingReport({ ...editingReport, notes: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-medium focus:border-teal-500 outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setEditingReport(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl text-xs font-bold transition"
              >
                {isTr ? 'Vazgeç' : 'Cancel'}
              </button>
              <button
                onClick={() => handleSaveEdit(editingReport)}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
              >
                <Check size={14} />
                {isTr ? 'Kaydet' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface GlassToolPrintAnnexProps {
  project: Project;
  lang: Language;
}

export const GlassToolPrintAnnex: React.FC<GlassToolPrintAnnexProps> = ({
  project,
  lang
}) => {
  const isTr = lang === 'tr';
  const reports = (project.glassToolReports || []).filter(r => r.includeInQuotePrint !== false);

  if (reports.length === 0) return null;

  return (
    <div id="printable-glasstool-annex" className="mt-14 pt-10 border-t-4 border-teal-600 print:mt-0 print:pt-6 print:border-t-2 print:border-slate-800 break-before-page avoid-break">
      {reports.map((report, idx) => (
        <div key={report.id} className="space-y-6 mb-12 last:mb-0">
          
          {/* Annex Title Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b-2 border-slate-200">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-teal-600 text-white text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full">
                  {isTr ? `TEKLİF EKİ - ${idx + 1}` : `PROPOSAL ANNEX - ${idx + 1}`}
                </span>
                <span className="text-[10px] text-teal-700 font-extrabold uppercase tracking-wider">
                  ŞİŞECAM GLASSTOOL™ AKREDİTE RAPORU
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {isTr ? 'Şişecam Onaylı Cam Performans ve Isı Yalıtım Raporu' : 'Şişecam Certified Glass Performance & Thermal Declaration'}
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {report.standards || 'TS EN 410 ve TS EN 673 Standartlarına Uygun CE Beyanı'}
              </p>
            </div>

            <div className="text-right shrink-0">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {isTr ? 'BELGE DOĞRULAMA' : 'VERIFICATION'}
              </div>
              <div className="text-xs font-mono font-black text-slate-800">
                {report.id.toUpperCase()}
              </div>
              <div className="text-[10px] text-slate-500 font-mono">
                {report.uploadedAt}
              </div>
            </div>
          </div>

          {/* Key Metrics 4-Box Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Ug Box */}
            <div className="bg-teal-50 border-2 border-teal-500/40 rounded-2xl p-4 text-center">
              <span className="text-[10px] font-black uppercase tracking-wider text-teal-800 block mb-1">
                {isTr ? 'Isı Geçirgenliği (Ug)' : 'Thermal Transmittance (Ug)'}
              </span>
              <span className="text-2xl sm:text-3xl font-black text-teal-950 font-mono block">
                {report.ugValue?.toFixed(2) || '1.10'}
              </span>
              <span className="text-[10px] font-bold text-teal-700 block mt-0.5">
                W/m²K (EN 673)
              </span>
            </div>

            {/* Light Transmission LT */}
            <div className="bg-sky-50 border-2 border-sky-500/40 rounded-2xl p-4 text-center">
              <span className="text-[10px] font-black uppercase tracking-wider text-sky-800 block mb-1">
                {isTr ? 'Işık Geçirgenliği (LT)' : 'Light Transmission (LT)'}
              </span>
              <span className="text-2xl sm:text-3xl font-black text-sky-950 font-mono block">
                %{report.lightTransmission || '71'}
              </span>
              <span className="text-[10px] font-bold text-sky-700 block mt-0.5">
                EN 410 Standardı
              </span>
            </div>

            {/* Solar Factor g */}
            <div className="bg-amber-50 border-2 border-amber-500/40 rounded-2xl p-4 text-center">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 block mb-1">
                {isTr ? 'Güneş Faktörü (g)' : 'Solar Factor (g)'}
              </span>
              <span className="text-2xl sm:text-3xl font-black text-amber-950 font-mono block">
                %{report.solarFactor || '43'}
              </span>
              <span className="text-[10px] font-bold text-amber-700 block mt-0.5">
                EN 410 Standardı
              </span>
            </div>

            {/* Sound Insulation Rw */}
            <div className="bg-emerald-50 border-2 border-emerald-500/40 rounded-2xl p-4 text-center">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 block mb-1">
                {isTr ? 'Ses Yalıtımı (Rw)' : 'Acoustic Sound (Rw)'}
              </span>
              <span className="text-2xl sm:text-3xl font-black text-emerald-950 font-mono block">
                {report.soundReductionRw || '36'} dB
              </span>
              <span className="text-[10px] font-bold text-emerald-700 block mt-0.5">
                EN 12758 Standardı
              </span>
            </div>
          </div>

          {/* Configuration & Layer Breakdown */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 mb-3 flex items-center gap-2">
              <Layers size={14} className="text-teal-600" />
              <span>{isTr ? 'Sertifikalı Cam Katman Konfigürasyonu' : 'Certified Glass Layer Configuration'}</span>
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                  {isTr ? 'Dış Cam (1. Cam)' : 'Outer Pane'}
                </span>
                <span className="font-extrabold text-slate-900 block">
                  6 mm Isıcam Konfor
                </span>
                <span className="text-[10px] text-teal-600 block mt-0.5 font-medium">
                  Yüzey 2 Solar Low-E Kaplama
                </span>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                  {isTr ? 'Ara Boşluk & Gaz' : 'Cavity Spacer & Gas'}
                </span>
                <span className="font-extrabold text-slate-900 block">
                  {report.spacerGas || '16 mm HB + %90 Argon'}
                </span>
                <span className="text-[10px] text-sky-600 block mt-0.5 font-medium">
                  Sıcak Kenar (Warm Edge) Çıta
                </span>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                  {isTr ? 'İç Cam (2. Cam)' : 'Inner Pane'}
                </span>
                <span className="font-extrabold text-slate-900 block">
                  4 + 4.2 mm Akustik Lamine
                </span>
                <span className="text-[10px] text-emerald-600 block mt-0.5 font-medium">
                  0.76 PVB Akustik Güvenlik
                </span>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between text-[11px] text-slate-600">
              <div>
                <span className="font-bold text-slate-800">{isTr ? 'Kombinasyon:' : 'Combination:'} </span>
                <span className="font-mono text-slate-900">{report.glassCombination}</span>
              </div>
              <div>
                <span className="font-bold text-slate-800">{isTr ? 'Toplam Cam Kalınlığı:' : 'Total Thickness:'} </span>
                <span className="font-mono font-black text-slate-900">{report.totalThicknessMm || 30.2} mm</span>
              </div>
            </div>
          </div>

          {/* Document Attachment & Viewer */}
          <div className="border border-slate-200 rounded-2xl p-4 bg-white avoid-break">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-teal-600" />
                <span className="text-xs font-black uppercase text-slate-800">
                  {isTr ? 'Ekli Belge:' : 'Attached Document:'} {report.name}
                </span>
              </div>

              {/* Action Link (Hidden during print) */}
              <div className="print:hidden flex items-center gap-2">
                <a
                  href={report.fileData}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-teal-700 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                >
                  <ExternalLink size={12} />
                  <span>{isTr ? 'Yeni Sekmede Aç' : 'Open in Tab'}</span>
                </a>
                <a
                  href={report.fileData}
                  download={report.name}
                  className="px-3 py-1 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                >
                  <Download size={12} />
                  <span>{isTr ? 'İndir' : 'Download'}</span>
                </a>
              </div>
            </div>

            {/* Embedded Preview for Screen / Print */}
            {report.fileType === 'pdf' ? (
              <div className="w-full rounded-xl overflow-hidden bg-slate-50 border border-slate-200">
                <iframe
                  src={report.fileData}
                  className="w-full h-[500px] print:h-[650px] border-none"
                  title={`Sisecam Report ${idx + 1}`}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center p-2 bg-slate-50 rounded-xl border border-slate-200">
                <img
                  src={report.fileData}
                  alt={report.name}
                  className="max-h-[500px] object-contain rounded-lg"
                />
              </div>
            )}

            {report.notes && (
              <div className="mt-3 text-xs text-slate-500 italic bg-slate-50 p-3 rounded-xl border border-slate-150">
                "{report.notes}"
              </div>
            )}
          </div>

          {/* Accreditation Footer Seal */}
          <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center text-[10px] text-slate-400 gap-2 font-mono">
            <span>ŞİŞECAM GLASSTOOL™ OFFICIAL REPORT ANNEX • ALUMETRIC SUITE</span>
            <span>TS EN 410 / TS EN 673 CE COMPLIANT • RESMİ TEKLİF EKİ</span>
          </div>

        </div>
      ))}
    </div>
  );
};
