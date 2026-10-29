import React, { useState } from 'react';
import { FormDocument, Division, FormType } from '../types/index.ts';
import { formatRupiah } from '../utils/pdfGenerator.ts';
import { 
  PieChart, 
  BarChart3, 
  TrendingUp, 
  ShieldCheck, 
  Layers, 
  DollarSign, 
  CheckCircle,
  Clock,
  AlertTriangle
} from 'lucide-react';

interface DashboardChartsProps {
  forms: FormDocument[];
  onFilterDivision?: (division: Division) => void;
  onFilterFormType?: (formType: FormType) => void;
  onFilterStatus?: (status: string) => void;
}

export const DashboardCharts: React.FC<DashboardChartsProps> = ({
  forms,
  onFilterDivision,
  onFilterFormType,
  onFilterStatus,
}) => {
  const [activeTab, setActiveTab] = useState<'division' | 'formType' | 'pipeline'>('division');

  const totalValue = forms.reduce((sum, f) => sum + (f.totalAmount || 0), 0) || 1;
  const totalCount = forms.length || 1;

  // 1. Division Data Breakdown
  const divisionList: Division[] = ['Project', 'Operation', 'Services', 'General', 'Finance'];
  const divisionColors: Record<Division, { bg: string; fill: string; text: string; bar: string }> = {
    Operation: { bg: 'bg-blue-50', fill: '#3b82f6', text: 'text-blue-700', bar: 'bg-blue-600' },
    Finance: { bg: 'bg-emerald-50', fill: '#10b981', text: 'text-emerald-700', bar: 'bg-emerald-600' },
    Services: { bg: 'bg-purple-50', fill: '#8b5cf6', text: 'text-purple-700', bar: 'bg-purple-600' },
    Project: { bg: 'bg-amber-50', fill: '#f59e0b', text: 'text-amber-700', bar: 'bg-amber-600' },
    General: { bg: 'bg-slate-100', fill: '#64748b', text: 'text-slate-700', bar: 'bg-slate-600' },
  };

  const divisionStats = divisionList.map(div => {
    const matching = forms.filter(f => f.division === div);
    const amount = matching.reduce((sum, f) => sum + (f.totalAmount || 0), 0);
    const pct = Math.round((amount / totalValue) * 100);
    return {
      division: div,
      count: matching.length,
      amount,
      pct,
      ...divisionColors[div],
    };
  }).sort((a, b) => b.amount - a.amount);

  // 2. Form Type Data Breakdown (FPU, PFB, FPPB)
  const formTypes: { type: FormType; label: string; desc: string; color: string; fill: string }[] = [
    { type: 'FPU', label: 'FPU (Permohonan Uang)', desc: 'Kas Bon & Uang Muka', color: 'bg-blue-600', fill: '#2563eb' },
    { type: 'PFB', label: 'PFB (Faktur Biaya)', desc: 'BBM, Tol, & Port Freight', color: 'bg-indigo-600', fill: '#4f46e5' },
    { type: 'FPPB', label: 'FPPB (Pembelian Barang)', desc: 'Aset & Perlengkapan Gudang', color: 'bg-emerald-600', fill: '#059669' },
  ];

  const formTypeStats = formTypes.map(ft => {
    const matching = forms.filter(f => f.formType === ft.type);
    const amount = matching.reduce((sum, f) => sum + (f.totalAmount || 0), 0);
    const count = matching.length;
    const countPct = Math.round((count / totalCount) * 100);
    const amountPct = Math.round((amount / totalValue) * 100);
    return {
      ...ft,
      count,
      countPct,
      amount,
      amountPct,
    };
  });

  // Calculate SVG Donut Arcs for Form Types
  let accumulatedAngle = 0;
  const donutSlices = formTypeStats.map(stat => {
    const fraction = stat.amount / totalValue;
    const startAngle = accumulatedAngle;
    const endAngle = accumulatedAngle + fraction * 360;
    accumulatedAngle = endAngle;

    // Convert polar to cartesian (radius 40, center 50, 50)
    const polarToCartesian = (cx: number, cy: number, r: number, angleDeg: number) => {
      const rad = ((angleDeg - 90) * Math.PI) / 180.0;
      return {
        x: cx + r * Math.cos(rad),
        y: cy + r * Math.sin(rad),
      };
    };

    const start = polarToCartesian(50, 50, 40, endAngle);
    const end = polarToCartesian(50, 50, 40, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

    const d = [
      'M', start.x, start.y,
      'A', 40, 40, 0, largeArcFlag, 0, end.x, end.y,
    ].join(' ');

    return {
      ...stat,
      path: d,
      dashLength: fraction * 251.2, // 2 * PI * 40 ≈ 251.2
    };
  });

  // 3. Approval Pipeline Stages
  const pipelineStages = [
    { key: 'CSO', label: 'Menunggu CSO', role: 'CSO', filter: 'Pending Approval', color: 'border-blue-400 bg-blue-50/70 text-blue-900', count: forms.filter(f => f.currentAssigneeRole === 'CSO' && f.status === 'Pending Approval').length },
    { key: 'COO', label: 'Menunggu COO', role: 'COO', filter: 'Approved by CSO', color: 'border-indigo-400 bg-indigo-50/70 text-indigo-900', count: forms.filter(f => f.currentAssigneeRole === 'COO' && f.status === 'Approved by CSO').length },
    { key: 'CFO', label: 'Menunggu CFO', role: 'CFO', filter: 'Approved by COO', color: 'border-purple-400 bg-purple-50/70 text-purple-900', count: forms.filter(f => f.currentAssigneeRole === 'CFO' && f.status === 'Approved by COO').length },
    { key: 'CEO', label: 'Menunggu CEO', role: 'CEO', filter: 'Approved by CFO', color: 'border-amber-400 bg-amber-50/70 text-amber-900', count: forms.filter(f => f.currentAssigneeRole === 'CEO' && f.status === 'Approved by CFO').length },
    { key: 'APPROVED', label: 'Disetujui Penuh', role: 'Done', filter: 'Fully Approved', color: 'border-emerald-400 bg-emerald-50/70 text-emerald-900', count: forms.filter(f => f.status === 'Fully Approved').length },
    { key: 'REJECTED', label: 'Ditolak / Revisi', role: 'Revisi', filter: 'Rejected', color: 'border-red-400 bg-red-50/70 text-red-900', count: forms.filter(f => f.status === 'Rejected').length },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
      {/* Header and Chart Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
              Visual Analytics & Alokasi Anggaran CLX
            </h3>
            <p className="text-[11px] text-slate-400">
              Grafik interaktif distribusi pengeluaran, komposisi formulir, dan tahapan persetujuan
            </p>
          </div>
        </div>

        {/* View Mode Pills */}
        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg text-xs font-bold text-slate-600">
          <button
            onClick={() => setActiveTab('division')}
            className={`px-3 py-1 rounded-md transition flex items-center space-x-1 ${
              activeTab === 'division'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Per Divisi</span>
          </button>

          <button
            onClick={() => setActiveTab('formType')}
            className={`px-3 py-1 rounded-md transition flex items-center space-x-1 ${
              activeTab === 'formType'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'hover:text-slate-900'
            }`}
          >
            <PieChart className="w-3.5 h-3.5" />
            <span>Jenis Form</span>
          </button>

          <button
            onClick={() => setActiveTab('pipeline')}
            className={`px-3 py-1 rounded-md transition flex items-center space-x-1 ${
              activeTab === 'pipeline'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Tahapan Approval</span>
          </button>
        </div>
      </div>

      {/* 1. Alokasi Per Divisi View */}
      {activeTab === 'division' && (
        <div className="space-y-3 pt-1">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex justify-between">
            <span>Alokasi Finansial Berdasarkan Divisi</span>
            <span>Total: {formatRupiah(totalValue)}</span>
          </div>

          <div className="space-y-3">
            {divisionStats.map(stat => (
              <div
                key={stat.division}
                onClick={() => onFilterDivision && onFilterDivision(stat.division)}
                className="group cursor-pointer p-2.5 rounded-lg border border-slate-100 hover:border-slate-300 hover:bg-slate-50 transition"
              >
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <div className="flex items-center space-x-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${stat.bar}`}></span>
                    <span className="font-bold text-slate-800">{stat.division}</span>
                    <span className="text-[11px] text-slate-400">({stat.count} Formulir)</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-bold text-slate-900">
                      {formatRupiah(stat.amount)}
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                      {stat.pct}%
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`${stat.bar} h-2.5 rounded-full transition-all duration-500 group-hover:opacity-90`}
                    style={{ width: `${Math.max(stat.pct, 3)}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Komposisi Jenis Form (Donut Chart + Legend) */}
      {activeTab === 'formType' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center pt-2">
          {/* Interactive SVG Radial / Donut Ring */}
          <div className="flex flex-col items-center justify-center relative">
            <svg viewBox="0 0 100 100" className="w-48 h-48 -rotate-90">
              {/* Background circle track */}
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="#f1f5f9"
                strokeWidth="12"
              />
              {/* Colored Segments */}
              {donutSlices.map((slice, idx) => {
                const circumference = 251.2;
                const offset = circumference * (1 - (donutSlices.slice(0, idx).reduce((acc, s) => acc + s.amount, 0) / totalValue));
                return (
                  <circle
                    key={slice.type}
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke={slice.fill}
                    strokeWidth="12"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    className="transition-all duration-700 hover:opacity-85 cursor-pointer"
                    onClick={() => onFilterFormType && onFilterFormType(slice.type)}
                  />
                );
              })}
            </svg>

            {/* Centered Total Display */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
              <span className="text-[10px] uppercase font-bold text-slate-400">Total Formulir</span>
              <span className="text-xl font-black text-slate-900">{totalCount}</span>
              <span className="text-[9px] font-bold text-blue-600">Dokumen</span>
            </div>
          </div>

          {/* Form Breakdown Legend */}
          <div className="space-y-3">
            {formTypeStats.map(stat => (
              <div
                key={stat.type}
                onClick={() => onFilterFormType && onFilterFormType(stat.type)}
                className="cursor-pointer p-3 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/30 transition flex items-center justify-between"
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-3.5 h-3.5 rounded-md ${stat.color} shrink-0`}></div>
                  <div>
                    <div className="text-xs font-black text-slate-900">{stat.label}</div>
                    <div className="text-[11px] text-slate-400">{stat.desc}</div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs font-mono font-bold text-slate-900">
                    {formatRupiah(stat.amount)}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {stat.count} Dokumen ({stat.amountPct}%)
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Pipeline Persetujuan View */}
      {activeTab === 'pipeline' && (
        <div className="space-y-3 pt-1">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Matriks Status & Distribusi Antrean Dokumen
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {pipelineStages.map(stage => (
              <div
                key={stage.key}
                onClick={() => onFilterStatus && onFilterStatus(stage.filter)}
                className={`p-3 rounded-xl border ${stage.color} cursor-pointer transition hover:scale-[1.02] shadow-xs flex flex-col justify-between`}
              >
                <div className="text-[10px] font-bold uppercase tracking-tight flex items-center justify-between">
                  <span>{stage.role}</span>
                  {stage.key === 'APPROVED' ? (
                    <CheckCircle className="w-3 h-3 text-emerald-600" />
                  ) : stage.key === 'REJECTED' ? (
                    <AlertTriangle className="w-3 h-3 text-red-500" />
                  ) : (
                    <Clock className="w-3 h-3 text-blue-600" />
                  )}
                </div>

                <div className="my-2">
                  <div className="text-2xl font-black">{stage.count}</div>
                  <div className="text-[11px] font-semibold truncate mt-0.5">{stage.label}</div>
                </div>

                <div className="text-[9px] text-slate-500">
                  Klik untuk filter
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
