import React, { useState, useMemo } from 'react';
import { 
  X, CheckCircle2, XCircle, Search, CircleDollarSign, 
  Scale, TrendingUp, AlertTriangle, AlertCircle, Medal, 
  PieChart as PieChartIcon, PackageOpen, Download 
} from 'lucide-react';
import { motion } from 'motion/react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { TablePagination } from '@/components/ui/TablePagination';
import { AutocompleteSelect, SelectOption } from '@/components/ui/AutocompleteSelect';
import {
  ReceivingRecord,
  IssueLogRecord,
  exportToCSV,
  Supplier,
  RMItem
} from '@/services/DefectMatrixService';

interface PurchasingAnalyticsDashboardProps {
  receivingRecords: ReceivingRecord[];
  issueLogs: IssueLogRecord[];
  suppliers?: Supplier[];
  rmItems?: RMItem[];
}


export const PurchasingAnalyticsDashboard: React.FC<PurchasingAnalyticsDashboardProps> = ({
  receivingRecords,
  issueLogs,
  suppliers = [],
  rmItems = [],
}) => {

  // -------------------------------------------------------------
  // Date Range Filter States & Presets
  // -------------------------------------------------------------
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [activeDatePreset, setActiveDatePreset] = useState<'ALL' | 'THIS_MONTH' | 'LAST_3_MONTHS' | 'THIS_YEAR'>('ALL');
  const [trendGranularity, setTrendGranularity] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY'>('WEEKLY');


  // Table Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'ALL' | 'PASS' | 'FAIL'>('ALL');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');
  const [selectedRmFilter, setSelectedRmFilter] = useState<string>('ALL');

  // Filter base records by Date Range to determine available dropdown options
  const dateFilteredRecords = useMemo(() => {
    return receivingRecords.filter((rec) => {
      if (startDate && rec.receiveDate < startDate) return false;
      if (endDate && rec.receiveDate > endDate) return false;
      return true;
    });
  }, [receivingRecords, startDate, endDate]);

  const supplierFilterOptions: SelectOption[] = useMemo(() => {
    const activeSupplierIds = new Set(dateFilteredRecords.map((r) => r.supplierId));
    return [
      { value: 'ALL', label: 'Supplier ทั้งหมด' },
      ...suppliers
        .filter((s) => activeSupplierIds.has(s.id))
        .map((s) => ({
          value: s.id,
          label: s.name,
          badge: s.code,
        })),
    ];
  }, [suppliers, dateFilteredRecords]);

  const categoryFilterOptions: SelectOption[] = useMemo(() => {
    const defaultCats = [{ value: 'ALL', label: 'ทุกหมวดหมู่ RM' }];
    const uniqueCats = new Map<string, string>();
    const activeCategories = new Set(dateFilteredRecords.map((r) => r.rmCategory).filter(Boolean));
    
    (rmItems || []).forEach(rm => {
      if (rm.category && activeCategories.has(rm.category)) {
        uniqueCats.set(rm.category, rm.categoryLabel || rm.category);
      }
    });
    
    const dynamicOptions = Array.from(uniqueCats.entries()).map(([val, lbl]) => ({
      value: val,
      label: lbl,
    }));
    
    return [...defaultCats, ...dynamicOptions];
  }, [rmItems, dateFilteredRecords]);

  const rmFilterOptions: SelectOption[] = useMemo(() => {
    const activeRmIds = new Set(dateFilteredRecords.map((r) => r.rmId));
    return [
      { value: 'ALL', label: 'วัตถุดิบทั้งหมด' },
      ...rmItems
        .filter((rm) => activeRmIds.has(rm.id))
        .map((rm) => ({
          value: rm.id,
          label: rm.name,
          badge: rm.category,
        })),
    ];
  }, [rmItems, dateFilteredRecords]);

  const statusFilterOptions: SelectOption[] = [
    { value: 'ALL', label: 'ทุกผลตรวจ' },
    { value: 'PASS', label: 'PASS เท่านั้น' },
    { value: 'FAIL', label: 'FAIL เท่านั้น' },
  ];

  const handleDatePresetChange = (preset: 'ALL' | 'THIS_MONTH' | 'LAST_3_MONTHS' | 'THIS_YEAR') => {
    setActiveDatePreset(preset);
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0] || '';

    if (preset === 'ALL') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'THIS_MONTH') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0] || '';
      setStartDate(firstDay);
      setEndDate(todayStr);
    } else if (preset === 'LAST_3_MONTHS') {
      const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, 1).toISOString().split('T')[0] || '';
      setStartDate(threeMonthsAgo);
      setEndDate(todayStr);
    } else if (preset === 'THIS_YEAR') {
      const firstDayYear = `${today.getFullYear()}-01-01`;
      setStartDate(firstDayYear);
      setEndDate(todayStr);
    }
  };

  const isAnyFilterActive = useMemo(() => {
    return Boolean(
      startDate ||
      endDate ||
      selectedSupplierFilter !== 'ALL' ||
      selectedRmFilter !== 'ALL' ||
      selectedCategoryFilter !== 'ALL' ||
      selectedStatusFilter !== 'ALL'
    );
  }, [startDate, endDate, selectedSupplierFilter, selectedRmFilter, selectedCategoryFilter, selectedStatusFilter]);

  const handleResetFilters = () => {
    setStartDate('');
    setEndDate('');
    setActiveDatePreset('ALL');
    setSelectedSupplierFilter('ALL');
    setSelectedRmFilter('ALL');
    setSelectedCategoryFilter('ALL');
    setSelectedStatusFilter('ALL');
  };

  // Filtered master records by Date Range & Dropdown Filters
  const globalFilteredReceivingRecords = useMemo(() => {
    return receivingRecords.filter((rec) => {
      if (startDate && rec.receiveDate < startDate) return false;
      if (endDate && rec.receiveDate > endDate) return false;
      if (selectedSupplierFilter !== 'ALL' && rec.supplierId !== selectedSupplierFilter) return false;
      if (selectedRmFilter !== 'ALL' && rec.rmId !== selectedRmFilter) return false;
      if (selectedCategoryFilter !== 'ALL' && rec.rmCategory !== selectedCategoryFilter) return false;
      if (selectedStatusFilter === 'PASS' && !rec.isPass) return false;
      if (selectedStatusFilter === 'FAIL' && rec.isPass) return false;
      return true;
    });
  }, [receivingRecords, startDate, endDate, selectedSupplierFilter, selectedRmFilter, selectedCategoryFilter, selectedStatusFilter]);

  const globalFilteredIssueLogs = useMemo(() => {
    return issueLogs.filter((issue) => {
      if (startDate && issue.issueDate < startDate) return false;
      if (endDate && issue.issueDate > endDate) return false;
      if (selectedSupplierFilter !== 'ALL' && issue.supplierId !== selectedSupplierFilter) return false;
      if (selectedRmFilter !== 'ALL' && issue.rmId !== selectedRmFilter) return false;
      return true;
    });
  }, [issueLogs, startDate, endDate, selectedSupplierFilter, selectedRmFilter]);

  // -------------------------------------------------------------
  // 1. KPI Calculations (Filtered by Global Filters)
  // -------------------------------------------------------------
  const totalVolumeKg = useMemo(
    () => globalFilteredReceivingRecords.reduce((sum, r) => sum + r.receiveQty, 0),
    [globalFilteredReceivingRecords]
  );
  
  const totalSpend = useMemo(
    () => globalFilteredReceivingRecords.reduce((sum, r) => sum + (r.unitPrice ? r.receiveQty * r.unitPrice : 0), 0),
    [globalFilteredReceivingRecords]
  );

  const totalBills = globalFilteredReceivingRecords.length;

  const passCount = useMemo(
    () => globalFilteredReceivingRecords.filter((r) => r.isPass).length,
    [globalFilteredReceivingRecords]
  );
  const failCount = useMemo(
    () => globalFilteredReceivingRecords.filter((r) => !r.isPass).length,
    [globalFilteredReceivingRecords]
  );

  const overallPassRate = useMemo(
    () => (totalBills > 0 ? ((passCount / totalBills) * 100).toFixed(1) : '100'),
    [totalBills, passCount]
  );

  const totalPostProdDefectKg = useMemo(
    () => globalFilteredReceivingRecords.reduce((sum, r) => sum + (r.postProductionDefectQty || 0), 0),
    [globalFilteredReceivingRecords]
  );

  const activeIssuesCount = useMemo(
    () => globalFilteredIssueLogs.filter((i) => i.status !== 'Resolved').length,
    [globalFilteredIssueLogs]
  );

  // -------------------------------------------------------------
  // 2. Data Preparation for Charts (Filtered by Date Range)
  // -------------------------------------------------------------

  // Helper: Get ISO Week Number
  const getISOWeek = (date: Date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  };

  // Helper: Format date string based on granularity
  const getTimeLabel = (dateStr: string, granularity: 'DAILY' | 'WEEKLY' | 'MONTHLY'): string => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    
    if (granularity === 'DAILY') {
      const p = dateStr.split('-');
      if (p.length !== 3) return dateStr;
      const day = p[2] ?? '0';
      const month = p[1] ?? '0';
      return `${parseInt(day, 10)}/${parseInt(month, 10)}`; // DD/MM
    } else if (granularity === 'WEEKLY') {
      const wk = getISOWeek(d);
      const yr = (d.getFullYear() + 543).toString().slice(-2);
      return `W${wk} '${yr}`;
    } else {
      const thaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
      const month = thaiMonths[d.getMonth()];
      const yr = (d.getFullYear() + 543).toString().slice(-2);
      return `${month} '${yr}`;
    }
  };

  // A. Quality Trend Data (Dynamic from Date-filtered records & Granularity)
  const trendData = useMemo(() => {
    if (globalFilteredReceivingRecords.length === 0) return [];

    const timeMap: Record<
      string,
      { label: string; totalBills: number; passBills: number; totalKg: number; postProdKg: number; totalSpend: number; sortKey: number }
    > = {};

    globalFilteredReceivingRecords.forEach((rec) => {
      const d = new Date(rec.receiveDate);
      if (isNaN(d.getTime())) return;
      
      let sortKey = 0;
      if (trendGranularity === 'DAILY') {
        sortKey = d.getTime();
      } else if (trendGranularity === 'WEEKLY') {
        sortKey = d.getFullYear() * 100 + getISOWeek(d);
      } else {
        sortKey = d.getFullYear() * 100 + d.getMonth();
      }

      const label = getTimeLabel(rec.receiveDate, trendGranularity) || 'ไม่ระบุ';

      if (!timeMap[label]) {
        timeMap[label] = { label, totalBills: 0, passBills: 0, totalKg: 0, postProdKg: 0, totalSpend: 0, sortKey };
      }
      const entry = timeMap[label]!;
      entry.totalBills += 1;
      if (rec.isPass) entry.passBills += 1;
      entry.totalKg += rec.receiveQty || 0;
      entry.postProdKg += rec.postProductionDefectQty || 0;
      entry.totalSpend += rec.unitPrice ? rec.receiveQty * rec.unitPrice : 0;
    });

    return Object.values(timeMap)
      .sort((a, b) => a.sortKey - b.sortKey)
      .map((m) => {
        const passRate = m.totalBills > 0 ? Number(((m.passBills / m.totalBills) * 100).toFixed(1)) : 0;
        const defectRate = Number((100 - passRate).toFixed(1));
        const postProdDefectRate = m.totalKg > 0 ? Number(((m.postProdKg / m.totalKg) * 100).toFixed(2)) : 0;
        return {
          label: m.label,
          passRate,
          defectRate,
          postProdDefectRate,
          totalKg: m.totalKg,
          totalSpend: m.totalSpend,
        };
      });
  }, [globalFilteredReceivingRecords, trendGranularity]);

  // B. Supplier Defect Ranking Data (Only include suppliers with fail bills)
  const supplierRankingData = useMemo(() => {
    if (globalFilteredReceivingRecords.length === 0) return [];

    const supplierMap: Record<
      string,
      { name: string; totalBills: number; failBills: number; totalDefectKg: number; postProdKg: number }
    > = {};

    globalFilteredReceivingRecords.forEach((rec) => {
      if (!supplierMap[rec.supplierId]) {
        supplierMap[rec.supplierId] = {
          name: rec.supplierName || rec.supplierId,
          totalBills: 0,
          failBills: 0,
          totalDefectKg: 0,
          postProdKg: 0,
        };
      }
      const supEntry = supplierMap[rec.supplierId]!;
      supEntry.totalBills += 1;
      supEntry.totalDefectKg += rec.defectQty || 0;
      supEntry.postProdKg += rec.postProductionDefectQty || 0;
      if (!rec.isPass) {
        supEntry.failBills += 1;
      }
    });

    return Object.values(supplierMap)
      .filter((item) => item.totalBills > 0 && item.failBills > 0)
      .map((item) => ({
        supplier: item.name.length > 15 ? item.name.substring(0, 14) + '...' : item.name,
        fullName: item.name,
        failCount: item.failBills,
        totalBills: item.totalBills,
        defectKg: Number(item.totalDefectKg.toFixed(1)),
        postProdKg: Number(item.postProdKg.toFixed(1)),
        failRate: item.totalBills > 0 ? Number(((item.failBills / item.totalBills) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.failRate - a.failRate || b.failCount - a.failCount);
  }, [globalFilteredReceivingRecords]);

  // C. RM Category Breakdown Data (Only include categories with > 0 defect kg)
  const categoryBreakdownData = useMemo(() => {
    if (globalFilteredReceivingRecords.length === 0) return [];

    const catMap: Record<string, { name: string; defectKg: number; color: string }> = {};
    const fallbackColors = ['#ef4444', '#f59e0b', '#8b5cf6', '#06b6d4', '#10b981', '#3b82f6', '#ec4899'];
    let colorIdx = 0;

    (rmItems || []).forEach(rm => {
      if (rm.category && !catMap[rm.category]) {
        catMap[rm.category] = {
           name: rm.categoryLabel || rm.category,
           defectKg: 0,
           color: fallbackColors[colorIdx % fallbackColors.length] || '#000000'
        };
        colorIdx++;
      }
    });

    globalFilteredReceivingRecords.forEach((r) => {
      if (!catMap[r.rmCategory]) {
        catMap[r.rmCategory] = {
           name: r.rmCategory,
           defectKg: 0,
           color: fallbackColors[colorIdx % fallbackColors.length] || '#000000'
        };
        colorIdx++;
      }
      catMap[r.rmCategory]!.defectKg += r.defectQty || 0;
      catMap[r.rmCategory]!.defectKg += r.postProductionDefectQty || 0;
    });

    return Object.values(catMap)
      .map((data) => ({
        name: data.name,
        value: Number(data.defectKg.toFixed(1)),
        color: data.color
      }))
      .filter((item) => item.value > 0);
  }, [globalFilteredReceivingRecords, rmItems]);

  // Top Defect RM Items (New Bar Chart)
  const topDefectRmsData = useMemo(() => {
    if (globalFilteredReceivingRecords.length === 0) return [];
    
    const rmMap: Record<string, { name: string; failCount: number; postProdKg: number }> = {};
    
    globalFilteredReceivingRecords.forEach((r) => {
      if (!rmMap[r.rmId]) {
        rmMap[r.rmId] = { name: r.rmName, failCount: 0, postProdKg: 0 };
      }
      if (!r.isPass) {
        rmMap[r.rmId]!.failCount += 1;
      }
      if (r.postProductionDefectQty) {
        rmMap[r.rmId]!.postProdKg += r.postProductionDefectQty;
      }
    });
    
    return Object.values(rmMap)
      .filter(rm => rm.failCount > 0 || rm.postProdKg > 0)
      .sort((a, b) => b.failCount - a.failCount || b.postProdKg - a.postProdKg)
      .slice(0, 10);
  }, [globalFilteredReceivingRecords]);

  // D. Average Price Summary (RM × Supplier)
  const averagePriceSummaryData = useMemo(() => {
    if (globalFilteredReceivingRecords.length === 0) return [];
    
    // key: rmName_supplierName
    const priceMap: Record<string, { rmName: string; rmCategory: string; supplierName: string; totalQty: number; totalSpend: number; minPrice: number; maxPrice: number; buyCount: number }> = {};
    
    globalFilteredReceivingRecords.forEach(r => {
      if (r.unitPrice !== undefined) {
        const key = `${r.rmName}_${r.supplierName}`;
        if (!priceMap[key]) {
          priceMap[key] = {
            rmName: r.rmName,
            rmCategory: r.rmCategory,
            supplierName: r.supplierName,
            totalQty: 0,
            totalSpend: 0,
            minPrice: r.unitPrice,
            maxPrice: r.unitPrice,
            buyCount: 0
          };
        }
        const entry = priceMap[key];
        entry.totalQty += r.receiveQty;
        entry.totalSpend += (r.receiveQty * r.unitPrice);
        entry.buyCount += 1;
        if (r.unitPrice < entry.minPrice) entry.minPrice = r.unitPrice;
        if (r.unitPrice > entry.maxPrice) entry.maxPrice = r.unitPrice;
      }
    });

    return Object.values(priceMap).map(item => ({
      ...item,
      avgPrice: item.totalQty > 0 ? item.totalSpend / item.totalQty : 0
    })).sort((a, b) => b.totalSpend - a.totalSpend);
  }, [globalFilteredReceivingRecords]);

  // E. Supplier Price Comparison Data (for BarChart) — Top 8 RMs by total spend
  const supplierPriceComparisonData = useMemo(() => {
    // 1. Group averagePriceSummaryData by rmName, summing totalSpend across suppliers
    const rmSpendMap: Record<string, { rmName: string; totalSpend: number; supplierCount: number }> = {};
    const suppliersSet = new Set<string>();

    averagePriceSummaryData.forEach(item => {
      if (!rmSpendMap[item.rmName]) {
        rmSpendMap[item.rmName] = { rmName: item.rmName, totalSpend: 0, supplierCount: 0 };
      }
      rmSpendMap[item.rmName]!.totalSpend += item.totalSpend;
      rmSpendMap[item.rmName]!.supplierCount += 1;
      suppliersSet.add(item.supplierName);
    });

    // 2. Sort by total spend descending, take top 8
    const totalRmCount = Object.keys(rmSpendMap).length;
    const top8RmNames = Object.values(rmSpendMap)
      .sort((a, b) => b.totalSpend - a.totalSpend)
      .slice(0, 8)
      .map(r => r.rmName);

    // 3. Build chart data only for top 8 RMs
    const rmGroups: Record<string, Record<string, unknown>> = {};
    averagePriceSummaryData.forEach(item => {
      if (!top8RmNames.includes(item.rmName)) return;
      if (!rmGroups[item.rmName]) {
        rmGroups[item.rmName] = { rmName: item.rmName };
      }
      rmGroups[item.rmName]![item.supplierName] = Number(item.avgPrice.toFixed(2));
    });

    // 4. Only include suppliers that appear in the top 8 set
    const activeSuppliers = new Set<string>();
    Object.values(rmGroups).forEach(group => {
      Object.keys(group).forEach(key => {
        if (key !== 'rmName') activeSuppliers.add(key);
      });
    });

    return {
      data: Object.values(rmGroups).sort((a, b) => String(a.rmName).localeCompare(String(b.rmName))),
      suppliers: Array.from(activeSuppliers),
      totalRmCount,
    };
  }, [averagePriceSummaryData]);

  // -------------------------------------------------------------
  // 3. Filtered Data Table & Export
  // -------------------------------------------------------------
  const filteredRecords = useMemo(() => {
    const q = (searchQuery || '').toLowerCase();
    return (globalFilteredReceivingRecords || []).filter((rec) => {
      if (!rec) return false;
      const matchSearch =
        String(rec.billNo || '').toLowerCase().includes(q) ||
        String(rec.supplierName || '').toLowerCase().includes(q) ||
        String(rec.rmName || '').toLowerCase().includes(q);
      
      // Additional filters like Supplier, Status, RM, Category are already applied in globalFilteredReceivingRecords

      return matchSearch;
    });
  }, [globalFilteredReceivingRecords, searchQuery]);

  // Table Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedSupplierFilter, selectedCategoryFilter, selectedStatusFilter, activeDatePreset]);

  const totalPages = Math.ceil(filteredRecords.length / pageSize);
  const paginatedAnalyticsRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

  const handleExportCSV = () => {
    const exportData = filteredRecords.map((r) => ({
      'Bill No': r.billNo,
      'Receive Date': r.receiveDate ? r.receiveDate.split('T')[0] : '',
      'Supplier': r.supplierName,
      'RM Name': r.rmName,
      'Category': r.rmCategory,
      'Receive Qty (kg)': r.receiveQty,
      'Unit Price (THB)': r.unitPrice || '',
      'Total Value (THB)': r.unitPrice ? (r.receiveQty * r.unitPrice) : '',
      'Sample Qty (kg)': r.sampleQty,
      'Defect Qty (kg)': r.defectQty,
      'Defect Percent (%)': r.defectPercent,
      'Inspection Result': r.isPass ? 'PASS' : 'FAIL',
      'Remark': r.remark || '',
    }));

    exportToCSV(`Purchasing_QC_Analytics_${new Date().toISOString().split('T')[0]}`, exportData);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.03 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 500, damping: 25 } }
  };

  return (
    <div className="h-full flex-1 overflow-y-auto overflow-x-hidden space-y-6 pr-1 custom-scrollbar pb-16">
      {/* ------------------------------------------------------------- */}
      {/* UNIFIED ANALYTICS FILTER & TIME RANGE TOOLBAR CARD */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-4">
        {/* Header: Title & Presets */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-slate-800">
            <Search className="w-4 h-4 text-slate-500" />
            <span>ค้นหาและตัวกรองข้อมูล (Data Filters)</span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Quick Presets */}
            <div className="inline-flex items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200/80 text-xs font-medium">
              <button
                type="button"
                onClick={() => handleDatePresetChange('ALL')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  activeDatePreset === 'ALL'
                    ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ทั้งหมด
              </button>
              <button
                type="button"
                onClick={() => handleDatePresetChange('THIS_MONTH')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  activeDatePreset === 'THIS_MONTH'
                    ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                เดือนนี้
              </button>
              <button
                type="button"
                onClick={() => handleDatePresetChange('LAST_3_MONTHS')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  activeDatePreset === 'LAST_3_MONTHS'
                    ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                3 เดือนล่าสุด
              </button>
              <button
                type="button"
                onClick={() => handleDatePresetChange('THIS_YEAR')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  activeDatePreset === 'THIS_YEAR'
                    ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ปีนี้
              </button>
            </div>

            {/* Reset Filters (if active) */}
            {isAnyFilterActive && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center justify-center gap-1.5 h-[32px] px-3 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/60 text-xs font-medium transition-all cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>ล้างตัวกรอง</span>
              </button>
            )}
          </div>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
          {/* Custom Date Pickers (Takes 2 cols on lg) */}
          <div className="lg:col-span-2">
            <label className="block text-[13px] font-medium text-slate-700 mb-1.5">
              ช่วงเวลาข้อมูล (Date Range)
            </label>
            <div className="flex items-center gap-2 bg-slate-50/50 p-1 rounded-xl border border-slate-200 text-sm h-[38px] w-full">
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setActiveDatePreset('ALL');
                }}
                className="flex-1 h-[30px] px-2 bg-white border border-slate-200 rounded-lg font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 w-full min-w-0"
              />
              <span className="text-slate-400 text-[13px] font-medium shrink-0">ถึง</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setActiveDatePreset('ALL');
                }}
                className="flex-1 h-[30px] px-2 bg-white border border-slate-200 rounded-lg font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 w-full min-w-0"
              />
            </div>
          </div>

          {/* Supplier Filter */}
          <div>
            <label className="block text-[13px] font-medium text-slate-700 mb-1.5">
              ผู้ส่งมอบ (Supplier)
            </label>
            <AutocompleteSelect
              options={supplierFilterOptions}
              value={selectedSupplierFilter}
              onChange={(val) => setSelectedSupplierFilter(val || 'ALL')}
              placeholder="Supplier ทั้งหมด"
              searchPlaceholder="พิมพ์ชื่อ Supplier..."
            />
          </div>

          {/* RM Filter */}
          <div>
            <label className="block text-[13px] font-medium text-slate-700 mb-1.5">
              วัตถุดิบ (RM)
            </label>
            <AutocompleteSelect
              options={rmFilterOptions}
              value={selectedRmFilter}
              onChange={(val) => setSelectedRmFilter(val || 'ALL')}
              placeholder="วัตถุดิบทั้งหมด"
              searchPlaceholder="พิมพ์ชื่อวัตถุดิบ..."
            />
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-[13px] font-medium text-slate-700 mb-1.5">
              หมวดหมู่ RM (Category)
            </label>
            <AutocompleteSelect
              options={categoryFilterOptions}
              value={selectedCategoryFilter}
              onChange={(val) => setSelectedCategoryFilter(val || 'ALL')}
              placeholder="ทุกหมวดหมู่ RM"
            />
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[13px] font-medium text-slate-700 mb-1.5">
              ผลการตรวจ (Status)
            </label>
            <AutocompleteSelect
              options={statusFilterOptions}
              value={selectedStatusFilter}
              onChange={(val) => setSelectedStatusFilter((val as 'ALL' | 'PASS' | 'FAIL') || 'ALL')}
              placeholder="ทุกผลตรวจ"
            />
          </div>
        </div>
      </div>

      {/* 1. Top Executive KPI Cards */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5"
      >
        {/* Total Spend */}
        <motion.div variants={itemVariants} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[13px] font-medium text-slate-500">
              มูลค่าการซื้อรวม (Total Spend)
            </p>
            <h3 className="text-2xl font-semibold text-slate-900 mt-1">
              {totalSpend.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}{' '}
              <span className="text-sm text-slate-500 font-normal">บาท</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1">
              เฉพาะรายการที่ระบุราคา
            </p>
          </div>
          <div className="p-3 rounded-xl bg-sky-50 text-sky-600 border border-sky-100/50">
            <CircleDollarSign className="w-6 h-6" />
          </div>
        </motion.div>

        {/* Total Volume */}
        <motion.div variants={itemVariants} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[13px] font-medium text-slate-500">
              ปริมาณรับเข้ารวม (Total Volume)
            </p>
            <h3 className="text-2xl font-semibold text-slate-900 mt-1">
              {totalVolumeKg.toLocaleString()}{' '}
              <span className="text-sm text-slate-500 font-normal">kg</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1.5">
              จาก <strong className="text-slate-700">{totalBills}</strong> บิลรับเข้าวัตถุดิบ
            </p>
          </div>
          <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100/50">
            <Scale className="w-6 h-6" />
          </div>
        </motion.div>

        {/* Overall Pass Rate */}
        <motion.div variants={itemVariants} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[13px] font-medium text-slate-500">
              อัตราผ่านการสุ่มตรวจ (Pass Rate)
            </p>
            <h3
              className={`text-2xl font-semibold mt-1 ${
                Number(overallPassRate) >= 90 ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {overallPassRate}%
            </h3>
            <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1">
              <span>ผ่าน {passCount} บิล</span> •{' '}
              <span className="text-rose-600 font-medium">ตก {failCount} บิล</span>
            </p>
          </div>
          <div
            className={`p-3 rounded-xl border ${
              Number(overallPassRate) >= 90
                ? 'bg-emerald-50 text-emerald-600 border-emerald-100/50'
                : 'bg-rose-50 text-rose-600 border-rose-100/50'
            }`}
          >
            <TrendingUp className="w-6 h-6" />
          </div>
        </motion.div>

        {/* Post-Production Defect Volume */}
        <motion.div variants={itemVariants} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[13px] font-medium text-slate-500">
              ปัญหาหลังการผลิต (Post-Prod Defect)
            </p>
            <h3 className="text-2xl font-semibold text-rose-600 mt-1">
              {totalPostProdDefectKg.toLocaleString()}{' '}
              <span className="text-sm text-rose-400 font-normal">kg</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1.5">
              จากวัตถุดิบทั้งหมดรวมถึง Type 3
            </p>
          </div>
          <div className="p-3 rounded-xl bg-rose-50 text-rose-600 border border-rose-100/50">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </motion.div>

        {/* Active QC Issues */}
        <motion.div variants={itemVariants} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[13px] font-medium text-slate-500">
              ปัญหาคุณภาพเปิดอยู่ (Active Issues)
            </p>
            <h3 className="text-2xl font-semibold text-amber-600 mt-1">
              {activeIssuesCount} <span className="text-sm text-amber-500 font-normal">รายการ</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1.5">
              ต้องติดตามการดำเนินการแก้ไข
            </p>
          </div>
          <div className="p-3 rounded-xl bg-amber-50 text-amber-600 border border-amber-100/50">
            <AlertCircle className="w-6 h-6" />
          </div>
        </motion.div>
      </motion.div>


      {/* 3. Recharts Section (Grid 2 Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Quality Pass Trend (Toggleable) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-slate-500" />
                1. แนวโน้มเปอร์เซ็นต์การตรวจผ่านคุณภาพ (Quality Pass Rate Trend)
              </h3>
              <p className="text-[13px] text-slate-500 mt-1">
                เปรียบเทียบ % PASS และ % FAIL
              </p>
            </div>
            {/* Granularity Toggle */}
            <div className="flex items-center bg-slate-100/80 p-1 rounded-xl border border-slate-200/60 text-xs font-medium self-start sm:self-auto">
              <button
                onClick={() => setTrendGranularity('DAILY')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  trendGranularity === 'DAILY'
                    ? 'bg-white text-emerald-700 shadow-2xs border border-slate-200/50'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                }`}
              >
                รายวัน
              </button>
              <button
                onClick={() => setTrendGranularity('WEEKLY')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  trendGranularity === 'WEEKLY'
                    ? 'bg-white text-emerald-700 shadow-2xs border border-slate-200/50'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                }`}
              >
                รายสัปดาห์
              </button>
              <button
                onClick={() => setTrendGranularity('MONTHLY')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  trendGranularity === 'MONTHLY'
                    ? 'bg-white text-emerald-700 shadow-2xs border border-slate-200/50'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                }`}
              >
                รายเดือน
              </button>
            </div>
          </div>

          {trendData.length === 0 ? (
            <div className="h-64 w-full flex flex-col items-center justify-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200 p-6 text-center mt-auto mb-auto">
              <TrendingUp className="w-8 h-8 mb-2 text-slate-400" />
              <p className="text-sm font-normal text-slate-600">ยังไม่มีข้อมูลแนวโน้มคุณภาพ</p>
              <p className="text-sm text-slate-400 mt-0.5 max-w-xs">
                ระบบจะพล็อตกราฟแนวโน้มอัตโนมัติเมื่อเริ่มบันทึกประวัติการตรวจรับเข้าวัตถุดิบ
              </p>
            </div>
          ) : (
            <div className="h-64 w-full mt-auto">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorPass" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#059669" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#059669" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorFail" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#e11d48" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#e11d48" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(value: any) => [`${value}%`, '']}
                    contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', color: '#fff', border: 'none' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Area type="monotone" dataKey="passRate" name="% PASS (ตรวจผ่าน)" stroke="#059669" strokeWidth={3} fillOpacity={1} fill="url(#colorPass)" />
                  <Area type="monotone" dataKey="postProdDefectRate" name="% ปัญหาหลังผลิต" stroke="#e11d48" strokeWidth={2} fillOpacity={1} fill="url(#colorFail)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Chart 2: Supplier Defect Ranking (Bar Chart) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <Medal className="w-5 h-5 text-slate-500" />
                2. จัดอันดับผู้ส่งมอบที่มีปัญหาคุณภาพสูงสุด (Supplier Defect Ranking)
              </h3>
              <p className="text-[13px] text-slate-500 mt-1">
                เรียงตามเปอร์เซ็นต์อัตราการสุ่มตรวจไม่ผ่าน (Fail Rate %)
              </p>
            </div>
          </div>

          {supplierRankingData.length === 0 ? (
            <div className="h-64 w-full flex flex-col items-center justify-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200 p-6 text-center">
              <Medal className="w-8 h-8 mb-2 text-slate-400" />
              <p className="text-sm font-normal text-slate-600">ยังไม่มีข้อมูลจัดอันดับ Supplier ไม่ผ่านเกณฑ์</p>
              <p className="text-sm text-slate-400 mt-0.5 max-w-xs">
                ระบบจะจัดอันดับผู้ส่งมอบที่มีบิลตรวจไม่ผ่าน (FAIL) โดยอัตโนมัติเมื่อพบของเสีย
              </p>
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={supplierRankingData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="supplier" tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                  <Tooltip
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(value: any, _name: any, item: any) => [
                      `${value}% (จาก ${item?.payload?.totalBills || 0} บิล / เสีย ${item?.payload?.defectKg || 0} kg)`,
                      item?.payload?.fullName || '',
                    ]}
                    contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', color: '#fff', border: 'none' }}
                  />
                  <Bar dataKey="failRate" name="อัตราการไม่ผ่าน (Fail Rate %)" fill="#e11d48" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Chart 3: RM Category Breakdown (Donut Pie Chart) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <PieChartIcon className="w-5 h-5 text-slate-500" />
                3. สัดส่วนน้ำหนักของเสียตามหมวดหมู่ (Defect Vol by RM Category)
              </h3>
              <p className="text-[13px] text-slate-500 mt-1">
                แบ่งตามประเภทวัตถุดิบ (Category)
              </p>
            </div>
          </div>

          {categoryBreakdownData.length === 0 ? (
            <div className="h-64 w-full flex flex-col items-center justify-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200 p-6 text-center">
              <PieChartIcon className="w-8 h-8 mb-2 text-slate-400" />
              <p className="text-sm font-normal text-slate-600">ยังไม่มีสัดส่วนน้ำหนักของเสีย</p>
              <p className="text-sm text-slate-400 mt-0.5 max-w-xs">
                ไม่พบน้ำหนักของเสียแยกตามหมวดหมู่ในช่วงเวลาที่เลือก
              </p>
            </div>
          ) : (
            <div className="h-64 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryBreakdownData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value} kg`}
                  >
                    {categoryBreakdownData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(value: any) => [`${value} kg`, 'น้ำหนักของเสีย']}
                    contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', color: '#fff', border: 'none' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Chart 4: Top Defect RM Items (Bar Chart) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <PackageOpen className="w-5 h-5 text-slate-500" />
                4. วัตถุดิบที่มีของเสียสูงสุด (Top Defect RM Items)
              </h3>
              <p className="text-[13px] text-slate-500 mt-1">
                จัดอันดับจากบิลที่ตกเกณฑ์ และปัญหาหลังการผลิต
              </p>
            </div>
          </div>

          {topDefectRmsData.length === 0 ? (
            <div className="h-64 w-full flex flex-col items-center justify-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200 p-6 text-center">
              <PackageOpen className="w-8 h-8 mb-2 text-slate-400" />
              <p className="text-sm font-normal text-slate-600">ยังไม่มีข้อมูลวัตถุดิบที่มีของเสีย</p>
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topDefectRmsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', color: '#fff', border: 'none' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar dataKey="failCount" name="จำนวนบิลที่ไม่ผ่าน (FAIL)" fill="#d97706" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="postProdKg" name="หลังการผลิต (kg)" fill="#e11d48" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Chart 5: Supplier Price Comparison (Bar Chart) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <CircleDollarSign className="w-5 h-5 text-slate-500" />
                5. เปรียบเทียบราคาต่อหน่วยเฉลี่ยตาม Supplier (Supplier Price Comparison)
              </h3>
              <p className="text-[13px] text-slate-500 mt-1">
                เปรียบเทียบราคาซื้อเฉลี่ยของวัตถุดิบชนิดเดียวกันจากผู้ส่งมอบแต่ละราย (บาท/kg)
              </p>
            </div>
            {supplierPriceComparisonData.totalRmCount > 0 && (
              <span className="text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 whitespace-nowrap">
                แสดง Top {Math.min(8, supplierPriceComparisonData.totalRmCount)} / {supplierPriceComparisonData.totalRmCount} วัตถุดิบ
              </span>
            )}
          </div>

          {supplierPriceComparisonData.data.length === 0 ? (
            <div className="h-64 w-full flex flex-col items-center justify-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200 p-6 text-center">
              <CircleDollarSign className="w-8 h-8 mb-2 text-slate-400" />
              <p className="text-sm font-normal text-slate-600">ยังไม่มีข้อมูลเปรียบเทียบราคา</p>
              <p className="text-sm text-slate-400 mt-0.5 max-w-xs">
                เฉพาะรายการที่มีการระบุราคาต่อหน่วยเท่านั้นที่จะถูกนำมาแสดง
              </p>
            </div>
          ) : (
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={supplierPriceComparisonData.data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="rmName" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(value: any, name: any) => [`${value} ฿/kg`, name]}
                    contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', color: '#fff', border: 'none' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  {supplierPriceComparisonData.suppliers.map((supplier, idx) => {
                    const colors = ['#0284C7', '#0369A1', '#0ea5e9', '#38bdf8', '#7dd3fc', '#bae6fd'];
                    return <Bar key={supplier} dataKey={supplier} name={supplier} fill={colors[idx % colors.length]} radius={[6, 6, 0, 0]} />;
                  })}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* 4. Average Price Summary Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              4. ตารางสรุปราคาเฉลี่ยต่อ RM × Supplier
            </h3>
            <p className="text-[13px] text-slate-500 mt-1">
              แสดงเฉพาะรายการที่มีการระบุราคา
            </p>
          </div>
        </div>
        <div className="overflow-x-auto max-h-[400px] overflow-y-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[13px] font-semibold text-slate-500 sticky top-0 z-10 shadow-2xs">
                <th className="py-3.5 px-4">วัตถุดิบ (RM)</th>
                <th className="py-3.5 px-4">Supplier</th>
                <th className="py-3.5 px-4 text-right">ราคาเฉลี่ย (฿/kg)</th>
                <th className="py-3.5 px-4 text-right">จำนวนครั้งที่ซื้อ</th>
                <th className="py-3.5 px-4 text-right">ปริมาณรวม (kg)</th>
                <th className="py-3.5 px-4 text-right">มูลค่ารวม (บาท)</th>
                <th className="py-3.5 px-4 text-right">ช่วงราคา (ต่ำสุด-สูงสุด)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm font-normal text-slate-800">
              {averagePriceSummaryData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    ไม่พบข้อมูลประวัติราคา
                  </td>
                </tr>
              ) : (
                averagePriceSummaryData.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-normal text-slate-900">{r.rmName}</td>
                    <td className="py-3 px-4 font-normal text-slate-800">{r.supplierName}</td>
                    <td className="py-3 px-4 text-right font-normal text-sky-700">{r.avgPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="py-3 px-4 text-right text-slate-600 font-normal">{r.buyCount}</td>
                    <td className="py-3 px-4 text-right text-slate-600 font-normal">{r.totalQty.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right font-normal text-emerald-700">{r.totalSpend.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right font-normal text-slate-500">
                      {r.minPrice.toLocaleString()} - {r.maxPrice.toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Advanced Data Table & Export */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Controls & Export Header */}
        <div className="p-6 border-b border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              5. ตารางสรุปประวัติ QC & การประเมินผลผู้ส่งมอบ ({filteredRecords.length} รายการ)
            </h3>
            <p className="text-[13px] text-slate-500 mt-1">
              สามารถกรองข้อมูลเพื่อส่งออกเป็นรายงาน CSV สำหรับการประชุมประเมินประจำเดือน
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Search */}
            <div className="relative flex-1 md:w-56">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหา Bill No, Supplier, RM..."
                className="w-full h-9 pl-9 pr-3.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-normal text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Export CSV Button */}
            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-normal text-sm rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Export to CSV</span>
            </button>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[13px] font-semibold text-slate-500 sticky top-0 z-10 shadow-2xs">
                <th className="py-3.5 px-4">วันที่รับ</th>
                <th className="py-3.5 px-4">Bill No</th>
                <th className="py-3.5 px-4">Supplier (ผู้ส่งมอบ)</th>
                <th className="py-3.5 px-4">วัตถุดิบ (RM)</th>
                <th className="py-3.5 px-4 text-right">รับเข้า (kg)</th>
                <th className="py-3.5 px-4 text-right">ราคา/หน่วย (บาท)</th>
                <th className="py-3.5 px-4 text-right">มูลค่ารวม (บาท)</th>
                <th className="py-3.5 px-4 text-right">สุ่มตรวจ (kg)</th>
                <th className="py-3.5 px-4 text-right">Defect (kg)</th>
                <th className="py-3.5 px-4 text-right">% Defect</th>
                <th className="py-3.5 px-4 text-center">ผลตรวจ</th>
                <th className="py-3.5 px-4 text-right">หลังการผลิต (kg)</th>
                <th className="py-3.5 px-4">หมายเหตุ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm font-normal text-slate-800">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-10 text-center text-slate-400">
                    ไม่พบข้อมูลประวัติ QC ตามเงื่อนไขที่เลือก
                  </td>
                </tr>
              ) : (
                paginatedAnalyticsRecords.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-600">{r.receiveDate ? r.receiveDate.split('T')[0] : '-'}</td>
                    <td className="py-3 px-4 font-mono font-normal text-slate-900">{r.billNo}</td>
                    <td className="py-3 px-4 font-normal text-slate-800">{r.supplierName}</td>
                    <td className="py-3 px-4">
                      <span className="font-normal text-slate-900">{r.rmName}</span>{' '}
                      <span className="text-sm bg-slate-100 text-slate-500 font-normal px-1.5 py-0.5 rounded">
                        {r.rmCategory}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-normal">{r.receiveQty.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right font-normal text-sky-700">{r.unitPrice !== undefined ? r.unitPrice.toLocaleString() : '-'}</td>
                    <td className="py-3 px-4 text-right font-normal text-emerald-700">{r.unitPrice !== undefined ? (r.receiveQty * r.unitPrice).toLocaleString() : '-'}</td>
                    <td className="py-3 px-4 text-right text-blue-700 font-normal">{r.sampleQty}</td>
                    <td className="py-3 px-4 text-right text-rose-700 font-normal">{r.defectQty}</td>
                    <td className="py-3 px-4 text-right font-normal">{r.defectPercent}%</td>
                    <td className="py-3 px-4 text-center">
                      {r.isPass ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-sm font-normal">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          PASS
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 text-sm font-normal">
                          <XCircle className="w-3.5 h-3.5 text-rose-600" />
                          FAIL
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right text-rose-700 font-normal">
                      {r.postProductionDefectQty !== undefined ? r.postProductionDefectQty : '-'}
                    </td>
                    <td className="py-3 px-4 text-slate-500 max-w-xs truncate">{r.remark || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Pagination */}
        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredRecords.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          itemUnitLabel="รายการประวัติ"
        />
      </div>
    </div>
  );
};
