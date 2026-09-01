import React, { useState, useEffect } from 'react';
import {
  PackageCheck,
  AlertTriangle,
  BarChart3,
  Sliders,
  Package,
  RotateCw,
  Pin,
  Settings,
  Inbox,
  BarChart3 as BarChartIcon,
} from 'lucide-react';
import { RMReceivingModule } from './receiving/RMReceivingModule';
import { IssueLogModule, PrefillIssueData } from './issuelog/IssueLogModule';
import { PurchasingAnalyticsDashboard } from './analytics/PurchasingAnalyticsDashboard';
import { PurchasingMasterDataModule } from './master/PurchasingMasterDataModule';
import {
  ReceivingRecord,
  IssueLogRecord,
  Supplier,
  RMItem,
  DefectRule,
  DefectCategoryItem,
} from '@/services/DefectMatrixService';
import { PurchasingGasService } from '@/services/PurchasingGasService';
import { motion, AnimatePresence } from 'motion/react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class PurchasingErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[PurchasingErrorBoundary] Caught exception:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-rose-50 border border-rose-200 rounded-2xl text-center space-y-4 my-8">
          <div className="inline-flex p-3 rounded-full bg-rose-100 text-rose-600">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-rose-900">เกิดข้อผิดพลาดในการแสดงผลระบบจัดซื้อ</h3>
          <p className="text-sm text-rose-700 max-w-lg mx-auto font-mono bg-white p-3 rounded-lg border border-rose-200 text-left overflow-x-auto">
            {this.state.error?.toString() || 'Unknown Error'}
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-medium transition-all inline-flex items-center gap-2"
            >
              <RotateCw className="w-4 h-4" />
              <span>โหลดหน้าเว็บใหม่</span>
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export const PurchasingPage: React.FC = () => {
  // Navigation Sidebar States
  const [activeTab, setActiveTab] = useState<'receiving' | 'issuelog' | 'analytics' | 'master'>(
    'receiving'
  );
  const [isSidebarPinned, setIsSidebarPinned] = useState<boolean>(false);
  const [isSidebarHovered, setIsSidebarHovered] = useState<boolean>(false);

  const isExpanded = isSidebarPinned || isSidebarHovered;
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [apiError, setApiError] = useState<string | null>(null);

  // Master Dynamic Data States
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [rmItems, setRmItems] = useState<RMItem[]>([]);
  const [defectMatrix, setDefectMatrix] = useState<Record<string, DefectRule[]>>({});
  const [defectCategories, setDefectCategories] = useState<DefectCategoryItem[]>([]);

  // Transaction States
  const [receivingRecords, setReceivingRecords] = useState<ReceivingRecord[]>([]);
  const [issueLogs, setIssueLogs] = useState<IssueLogRecord[]>([]);

  // Load Purchasing Data strictly from GAS API
  const fetchPurchasingData = async (force = false) => {
    if (force) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setApiError(null);

    try {
      const data = await PurchasingGasService.loadPurchasingData(force);
      setSuppliers(data.suppliers || []);
      setRmItems(data.rmItems || []);
      if (data.defectMatrix && Object.keys(data.defectMatrix).length > 0) {
        setDefectMatrix(data.defectMatrix);
      }
      setDefectCategories(data.defectCategories || []);
      setReceivingRecords(data.receivingRecords || []);
      setIssueLogs(data.issueLogs || []);
      setApiError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[PurchasingPage] ❌ Error loading data from GAS API:', err);
      setApiError(msg || 'ไม่สามารถเชื่อมต่อกับ Google Apps Script API ได้');
      // If error occurs, fallback to cached data in localStorage if any exists
      const cached = PurchasingGasService.loadFromLocalStorage();
      if (cached.suppliers.length > 0 || cached.receivingRecords.length > 0) {
        setSuppliers(cached.suppliers);
        setRmItems(cached.rmItems);
        setDefectMatrix(cached.defectMatrix);
        setDefectCategories(cached.defectCategories);
        setReceivingRecords(cached.receivingRecords);
        setIssueLogs(cached.issueLogs);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPurchasingData();
  }, []);

  const handleRefresh = async () => {
    await fetchPurchasingData(true);
  };

  const handleSaveDefectCategory = (category: DefectCategoryItem) => {
    setDefectCategories((prev) => {
      const exists = prev.some((c) => c.id === category.id);
      return exists ? prev.map((c) => (c.id === category.id ? category : c)) : [...prev, category];
    });
    PurchasingGasService.saveDefectCategory(category);
  };

  const handleDeleteDefectCategory = (id: string) => {
    setDefectCategories((prev) => prev.filter((c) => c.id !== id));
    PurchasingGasService.deleteDefectCategory(id);
  };

  // Auto Issue Log Modal State
  const [isIssueModalOpen, setIsIssueModalOpen] = useState<boolean>(false);
  const [prefillData, setPrefillData] = useState<PrefillIssueData | null>(null);

  // KPI Computations
  const openIssuesCount = issueLogs.filter((i) => i.status !== 'Resolved').length;

  // Handlers
  const handleAddReceivingRecord = (record: ReceivingRecord) => {
    setReceivingRecords((prev) => [record, ...prev]);
    PurchasingGasService.saveReceivingRecord(record);
  };

  const handleAddReceivingRecordsBatch = (records: ReceivingRecord[]) => {
    setReceivingRecords((prev) => [...records, ...prev]);
    PurchasingGasService.saveReceivingRecordsBatch(records);
  };

  const handleUpdateReceivingRecord = (updatedRecord: ReceivingRecord) => {
    setReceivingRecords((prev) =>
      prev.map((item) => (item.id === updatedRecord.id ? updatedRecord : item))
    );
    PurchasingGasService.saveReceivingRecord(updatedRecord);
  };

  const handleDeleteReceivingRecord = (id: string) => {
    setReceivingRecords((prev) => prev.filter((item) => item.id !== id));
    PurchasingGasService.deleteReceivingRecord(id);
  };

  const handleAddIssueLogRecord = (record: IssueLogRecord) => {
    setIssueLogs((prev) => [record, ...prev]);
    if (record.receivingRecordId) {
      setReceivingRecords((prev) =>
        prev.map((r) =>
          r.id === record.receivingRecordId ? { ...r, hasIssueLog: true } : r
        )
      );
    }
    PurchasingGasService.saveIssueLogRecord(record);
    setActiveTab('issuelog');
  };

  const handleUpdateIssueLogStatus = (
    id: string,
    newStatus: 'Open' | 'In Progress' | 'Resolved'
  ) => {
    setIssueLogs((prev) => {
      const updated = prev.map((item) => (item.id === id ? { ...item, status: newStatus } : item));
      const target = updated.find((i) => i.id === id);
      if (target) PurchasingGasService.saveIssueLogRecord(target);
      return updated;
    });
  };

  const handleUpdateIssueLogRecord = (updatedRecord: IssueLogRecord) => {
    setIssueLogs((prev) =>
      prev.map((item) => (item.id === updatedRecord.id ? updatedRecord : item))
    );
    PurchasingGasService.saveIssueLogRecord(updatedRecord);
  };

  const handleDeleteIssueLogRecord = (id: string) => {
    const issueToDelete = issueLogs.find((i) => i.id === id);
    if (issueToDelete && issueToDelete.receivingRecordId) {
      setReceivingRecords((prev) =>
        prev.map((r) =>
          r.id === issueToDelete.receivingRecordId ? { ...r, hasIssueLog: false } : r
        )
      );
    }
    setIssueLogs((prev) => prev.filter((item) => item.id !== id));
    PurchasingGasService.deleteIssueLogRecord(id);
  };

  const handleAddSupplier = (newSup: Supplier) => {
    setSuppliers((prev) => [...prev, newSup]);
    PurchasingGasService.saveSupplier(newSup);
  };

  const handleUpdateSupplier = (updatedSup: Supplier) => {
    setSuppliers((prev) => {
      const exists = prev.some((s) => s.id === updatedSup.id);
      if (exists) {
        return prev.map((s) => (s.id === updatedSup.id ? updatedSup : s));
      }
      return [...prev, updatedSup];
    });
    PurchasingGasService.saveSupplier(updatedSup);
  };

  const handleDeleteSupplier = (id: string) => {
    setSuppliers((prev) => prev.filter((s) => s.id !== id));
    PurchasingGasService.deleteSupplier(id);
  };

  const handleAddRMItem = (newRm: RMItem) => {
    setRmItems((prev) => [...prev, newRm]);
    PurchasingGasService.saveRMItem(newRm);
  };

  const handleUpdateRMItem = (updatedRm: RMItem) => {
    setRmItems((prev) => prev.map((r) => (r.id === updatedRm.id ? updatedRm : r)));
    PurchasingGasService.saveRMItem(updatedRm);
  };

  const handleDeleteRMItem = (id: string) => {
    setRmItems((prev) => prev.filter((r) => r.id !== id));
    PurchasingGasService.deleteRMItem(id);
  };

  const handleMergeRMItems = (targetRM: RMItem, mergedRmIds: string[]) => {
    // 1. Update RM items state
    setRmItems((prev) =>
      prev
        .filter((r) => !mergedRmIds.includes(r.id) || r.id === targetRM.id)
        .map((r) => (r.id === targetRM.id ? targetRM : r))
    );

    // 2. Update Receiving Records state
    const updatedReceivings = receivingRecords.map((r) =>
      mergedRmIds.includes(r.rmId)
        ? { ...r, rmId: targetRM.id, rmName: targetRM.name, rmCategory: targetRM.category }
        : r
    );
    setReceivingRecords(updatedReceivings);

    // 3. Update Issue Logs state
    const updatedIssues = issueLogs.map((i) =>
      mergedRmIds.includes(i.rmId)
        ? { ...i, rmId: targetRM.id, rmName: targetRM.name }
        : i
    );
    setIssueLogs(updatedIssues);

    // 4. Save to GAS / LocalStorage
    PurchasingGasService.mergeRMItems(targetRM, mergedRmIds, updatedReceivings, updatedIssues);
  };

  const handleUpdateDefectMatrix = (updatedMatrix: Record<string, DefectRule[]>) => {
    setDefectMatrix(updatedMatrix);
    PurchasingGasService.saveDefectMatrix(updatedMatrix);
  };

  const handleOpenIssueModal = (data: PrefillIssueData) => {
    setPrefillData(data);
    setIsIssueModalOpen(true);
  };

  const handleOpenManualIssueModal = () => {
    setPrefillData(null);
    setIsIssueModalOpen(true);
    setActiveTab('issuelog');
  };

  return (
    <div className="h-screen bg-slate-50 flex relative font-sans antialiased text-slate-800 overflow-hidden">
      {/* ------------------------------------------------------------- */}
      {/* HOVERABLE COLLAPSIBLE SIDEBAR NAVIGATION (Desktop) */}
      {/* ------------------------------------------------------------- */}
      <aside
        onMouseEnter={() => setIsSidebarHovered(true)}
        onMouseLeave={() => setIsSidebarHovered(false)}
        className={`hidden md:flex fixed left-0 top-0 bottom-0 z-40 bg-slate-900 text-white shadow-2xl transition-all duration-300 ease-in-out flex-col justify-between overflow-hidden border-r border-slate-800/80 ${
          isExpanded ? 'w-64' : 'w-16'
        }`}
      >
        {/* Sidebar Top Header & Brand */}
        <div>
          <div className={`h-16 flex items-center border-b border-slate-800/80 transition-all ${
            isExpanded ? 'px-4 justify-between' : 'justify-center'
          }`}>
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-emerald-400 text-white flex items-center justify-center shadow-md shrink-0 font-bold text-lg">
                <Package className="w-5 h-5 text-white" />
              </div>
              {isExpanded && (
                <div className="whitespace-nowrap transition-opacity duration-200">
                  <h1 className="text-sm font-semibold text-white tracking-wide">
                    Purchasing System
                  </h1>
                  <span className="text-[11px] font-medium text-emerald-400 block">
                    RM & QC Management
                  </span>
                </div>
              )}
            </div>

            {/* Pin Sidebar Toggle Button (Visible when expanded) */}
            {isExpanded && (
              <button
                type="button"
                onClick={() => setIsSidebarPinned(!isSidebarPinned)}
                className={`p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer ${
                  isSidebarPinned ? 'text-emerald-400 bg-slate-800/80' : ''
                }`}
                title={isSidebarPinned ? 'ปลดปักหมุด Sidebar' : 'ปักหมุดตรึง Sidebar'}
              >
                <Pin className={`w-4 h-4 ${isSidebarPinned ? 'text-emerald-400' : 'opacity-60'}`} />
              </button>
            )}
          </div>

          {/* Navigation Menu Links (Clean & Minimal with Emoji Focus) */}
          <nav className={`space-y-2 mt-2 transition-all ${isExpanded ? 'p-2.5' : 'p-2'}`}>
            {/* 1. RM Receiving */}
            <button
              type="button"
              onClick={() => setActiveTab('receiving')}
              className={`w-full flex items-center transition-all cursor-pointer relative group rounded-xl ${
                isExpanded ? 'gap-3 px-3 py-2.5 font-medium text-sm' : 'justify-center py-2'
              } ${
                activeTab === 'receiving'
                  ? 'text-white font-semibold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
              }`}
              title="บันทึกรับเข้าวัตถุดิบ (RM Receiving)"
            >
              {activeTab === 'receiving' && (
                <motion.div
                  layoutId="sidebarActiveTab"
                  className="absolute inset-0 bg-emerald-600 shadow-sm shadow-emerald-600/30 rounded-xl"
                  transition={{ type: "spring", stiffness: 550, damping: 30 }}
                />
              )}
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 relative z-10 transition-colors ${
                activeTab === 'receiving' ? 'bg-white/20 text-white' : 'bg-slate-800/90 text-slate-400 group-hover:bg-slate-700 group-hover:text-white'
              }`}>
                <Inbox className="w-5 h-5" />
              </div>
              {isExpanded && (
                <span className="whitespace-nowrap overflow-hidden transition-all duration-200 relative z-10">
                  รับเข้าวัตถุดิบ
                </span>
              )}
            </button>

            {/* 2. QC Issue Log */}
            <button
              type="button"
              onClick={() => setActiveTab('issuelog')}
              className={`w-full flex items-center transition-all cursor-pointer relative group rounded-xl ${
                isExpanded ? 'gap-3 px-3 py-2.5 font-medium text-sm' : 'justify-center py-2'
              } ${
                activeTab === 'issuelog'
                  ? 'text-white font-semibold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
              }`}
              title="ติดตามปัญหาคุณภาพ (QC Issue Log)"
            >
              {activeTab === 'issuelog' && (
                <motion.div
                  layoutId="sidebarActiveTab"
                  className="absolute inset-0 bg-rose-600 shadow-sm shadow-rose-600/30 rounded-xl"
                  transition={{ type: "spring", stiffness: 550, damping: 30 }}
                />
              )}
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 relative z-10 transition-colors ${
                activeTab === 'issuelog' ? 'bg-white/20 text-white' : 'bg-slate-800/90 text-slate-400 group-hover:bg-slate-700 group-hover:text-white'
              }`}>
                <AlertTriangle className="w-5 h-5" />
                {openIssuesCount > 0 && !isExpanded && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping" />
                )}
              </div>
              {isExpanded && (
                <div className="flex items-center justify-between w-full overflow-hidden transition-all duration-200 relative z-10">
                  <span className="whitespace-nowrap">ติดตามปัญหา QC</span>
                  {openIssuesCount > 0 && (
                    <span className="px-2 py-0.5 text-xs bg-rose-500 text-white font-bold rounded-full animate-pulse">
                      {openIssuesCount}
                    </span>
                  )}
                </div>
              )}
            </button>

            {/* 3. Analytics & Insights */}
            <button
              type="button"
              onClick={() => setActiveTab('analytics')}
              className={`w-full flex items-center transition-all cursor-pointer relative group rounded-xl ${
                isExpanded ? 'gap-3 px-3 py-2.5 font-medium text-sm' : 'justify-center py-2'
              } ${
                activeTab === 'analytics'
                  ? 'text-white font-semibold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
              }`}
              title="วิเคราะห์สรุปผลคุณภาพ (Analytics)"
            >
              {activeTab === 'analytics' && (
                <motion.div
                  layoutId="sidebarActiveTab"
                  className="absolute inset-0 bg-sky-600 shadow-sm shadow-sky-600/30 rounded-xl"
                  transition={{ type: "spring", stiffness: 550, damping: 30 }}
                />
              )}
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 relative z-10 transition-colors ${
                activeTab === 'analytics' ? 'bg-white/20 text-white' : 'bg-slate-800/90 text-slate-400 group-hover:bg-slate-700 group-hover:text-white'
              }`}>
                <BarChartIcon className="w-5 h-5" />
              </div>
              {isExpanded && (
                <span className="whitespace-nowrap overflow-hidden transition-all duration-200 relative z-10">
                  วิเคราะห์สรุปผล
                </span>
              )}
            </button>

            {/* 4. Master Data & QC Matrix */}
            <button
              type="button"
              onClick={() => setActiveTab('master')}
              className={`w-full flex items-center transition-all cursor-pointer relative group rounded-xl ${
                isExpanded ? 'gap-3 px-3 py-2.5 font-medium text-sm' : 'justify-center py-2'
              } ${
                activeTab === 'master'
                  ? 'text-white font-semibold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
              }`}
              title="ข้อมูลหลัก & QC Matrix"
            >
              {activeTab === 'master' && (
                <motion.div
                  layoutId="sidebarActiveTab"
                  className="absolute inset-0 bg-purple-600 shadow-sm shadow-purple-600/30 rounded-xl"
                  transition={{ type: "spring", stiffness: 550, damping: 30 }}
                />
              )}
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 relative z-10 transition-colors ${
                activeTab === 'master' ? 'bg-white/20 text-white' : 'bg-slate-800/90 text-slate-400 group-hover:bg-slate-700 group-hover:text-white'
              }`}>
                <Settings className="w-5 h-5" />
              </div>
              {isExpanded && (
                <span className="whitespace-nowrap overflow-hidden transition-all duration-200 relative z-10">
                  ข้อมูลหลัก & QC Matrix
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* Sidebar Bottom Footer: App Branding */}
        <div className={`transition-all border-t border-slate-800/80 ${isExpanded ? 'p-3' : 'p-2'}`}>
          <div className={`flex items-center text-slate-400 ${isExpanded ? 'gap-2.5 px-2' : 'justify-center'}`}>
            <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
            {isExpanded && (
              <div className="overflow-hidden">
                <p className="text-[11px] font-semibold text-slate-300 truncate">RM Purchasing & QC</p>
                <p className="text-[10px] text-slate-500 font-mono">v1.2.0 (GAS Cloud)</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ------------------------------------------------------------- */}
      {/* MAIN CONTENT WRAPPER WITH DYNAMIC PADDING */}
      {/* ------------------------------------------------------------- */}
      <div
        className={`flex-1 min-w-0 transition-all duration-300 ease-in-out flex flex-col h-screen overflow-hidden pb-16 md:pb-0 ${
          isExpanded ? 'md:pl-64' : 'md:pl-16'
        }`}
      >
        {/* Clean Glassmorphic Top Header */}
        <header className="bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 py-3 sticky top-0 z-50 shadow-2xs shrink-0">
          <div className="w-full flex items-center justify-between gap-3">
            {/* Breadcrumbs & Active Title with Icon */}
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className={`p-1.5 rounded-xl text-white shadow-2xs shrink-0 text-base ${
                activeTab === 'receiving'
                  ? 'bg-emerald-600'
                  : activeTab === 'issuelog'
                  ? 'bg-rose-600'
                  : activeTab === 'analytics'
                  ? 'bg-sky-600'
                  : 'bg-purple-600'
              }`}>
                {activeTab === 'receiving' && <Inbox className="w-4 h-4" />}
                {activeTab === 'issuelog' && <AlertTriangle className="w-4 h-4" />}
                {activeTab === 'analytics' && <BarChartIcon className="w-4 h-4" />}
                {activeTab === 'master' && <Settings className="w-4 h-4" />}
              </div>

              <div className="overflow-hidden">
                <h1 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                  {activeTab === 'receiving' && 'บันทึกรับเข้าวัตถุดิบ (RM Receiving)'}
                  {activeTab === 'issuelog' && 'ติดตามปัญหาคุณภาพ (QC Issue Log)'}
                  {activeTab === 'analytics' && 'วิเคราะห์สรุปผลคุณภาพ (Analytics)'}
                  {activeTab === 'master' && 'ข้อมูลหลัก & QC Matrix'}
                </h1>
              </div>
            </div>

            {/* Top Right Quick Actions */}
            <div className="flex items-center gap-2.5 shrink-0">
              {/* API Connection Indicator */}
              <div
                className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-medium ${
                  apiError
                    ? 'bg-rose-50 border-rose-200 text-rose-700'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                }`}
                title={PurchasingGasService.gasApiUrl || 'ไม่ได้กำหนด URL'}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    apiError ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'
                  }`}
                />
                <span>{apiError ? 'GAS API ขัดข้อง' : 'GAS API Online'}</span>
              </div>

              <button
                type="button"
                onClick={handleRefresh}
                disabled={isRefreshing || isLoading}
                aria-label="รีเฟรชข้อมูล"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                  isRefreshing || isLoading
                    ? 'bg-sky-50 text-sky-500 border-sky-200 cursor-not-allowed'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300 shadow-2xs'
                }`}
                title="โหลดข้อมูลล่าสุดจาก Google Apps Script"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isRefreshing || isLoading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">รีเฟรช</span>
              </button>
            </div>
          </div>
        </header>

        {/* Global Connection Error Alert Banner */}
        {apiError && (
          <div className="mx-2 sm:mx-4 mt-2.5 p-3 bg-rose-50/95 border border-rose-300/80 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-rose-800 shadow-xs shrink-0">
            <div className="flex items-start gap-2.5 overflow-hidden">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="overflow-hidden">
                <p className="font-bold text-rose-900 leading-tight">
                  ไม่สามารถเชื่อมต่อ Google Apps Script Web App API ได้
                </p>
                <p className="text-[11px] text-rose-700 mt-0.5 truncate">
                  สาเหตุ: {apiError}
                </p>
                <p className="text-[10px] text-rose-500 font-mono mt-0.5 truncate">
                  URL: {PurchasingGasService.gasApiUrl || '(ยังไม่ได้ระบุ VITE_GAS_API_URL ใน .env)'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => fetchPurchasingData(true)}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-semibold rounded-lg shrink-0 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs self-end sm:self-auto text-xs"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>ลองเชื่อมต่อใหม่</span>
            </button>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 p-2 sm:p-4 lg:p-4 w-full transition-all duration-300 flex flex-col min-h-0 overflow-hidden">
          <PurchasingErrorBoundary>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 20, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.98 }}
                transition={{ type: "spring", stiffness: 480, damping: 26, mass: 0.5 }}
                className="h-full flex-1 flex flex-col min-h-0"
              >
                {activeTab === 'receiving' && (
                  <RMReceivingModule
                    receivingRecords={receivingRecords}
                    onAddReceivingRecord={handleAddReceivingRecord}
                    onAddReceivingRecordsBatch={handleAddReceivingRecordsBatch}
                    onUpdateReceivingRecord={handleUpdateReceivingRecord}
                    onDeleteReceivingRecord={handleDeleteReceivingRecord}
                    onOpenIssueLogModal={handleOpenIssueModal}
                    suppliers={suppliers}
                    rmItems={rmItems}
                    defectMatrix={defectMatrix}
                  />
                )}

                {activeTab === 'issuelog' && (
                  <IssueLogModule
                    issueLogRecords={issueLogs}
                    suppliers={suppliers}
                    rmItems={rmItems}
                    defectCategories={defectCategories}
                    onAddIssueLogRecord={handleAddIssueLogRecord}
                    onUpdateIssueLogStatus={handleUpdateIssueLogStatus}
                    onUpdateIssueLogRecord={handleUpdateIssueLogRecord}
                    onDeleteIssueLogRecord={handleDeleteIssueLogRecord}
                    isModalOpen={isIssueModalOpen}
                    onCloseModal={() => setIsIssueModalOpen(false)}
                    onOpenManualModal={handleOpenManualIssueModal}
                    prefillData={prefillData}
                  />
                )}

                {activeTab === 'analytics' && (
                  <PurchasingAnalyticsDashboard
                    receivingRecords={receivingRecords}
                    issueLogs={issueLogs}
                    suppliers={suppliers}
                    rmItems={rmItems}
                  />
                )}

                {activeTab === 'master' && (
                  <PurchasingMasterDataModule
                    suppliers={suppliers}
                    onAddSupplier={handleAddSupplier}
                    onUpdateSupplier={handleUpdateSupplier}
                    onDeleteSupplier={handleDeleteSupplier}
                    rmItems={rmItems}
                    onAddRMItem={handleAddRMItem}
                    onUpdateRMItem={handleUpdateRMItem}
                    onDeleteRMItem={handleDeleteRMItem}
                    receivingRecords={receivingRecords}
                    issueLogs={issueLogs}
                    onMergeRMItems={handleMergeRMItems}
                    defectMatrix={defectMatrix}
                    onUpdateDefectMatrix={handleUpdateDefectMatrix}
                    defectCategories={defectCategories}
                    onSaveDefectCategory={handleSaveDefectCategory}
                    onDeleteDefectCategory={handleDeleteDefectCategory}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </PurchasingErrorBoundary>

          {/* Global Issue Log Modal Overlay (Renders on top of receiving tab when isIssueModalOpen is true) */}
          {isIssueModalOpen && activeTab !== 'issuelog' && (
            <IssueLogModule
              onlyModal={true}
              issueLogRecords={issueLogs}
              suppliers={suppliers}
              rmItems={rmItems}
              defectCategories={defectCategories}
              onAddIssueLogRecord={handleAddIssueLogRecord}
              onUpdateIssueLogStatus={handleUpdateIssueLogStatus}
              onUpdateIssueLogRecord={handleUpdateIssueLogRecord}
              onDeleteIssueLogRecord={handleDeleteIssueLogRecord}
              isModalOpen={isIssueModalOpen}
              onCloseModal={() => setIsIssueModalOpen(false)}
              onOpenManualModal={handleOpenManualIssueModal}
              prefillData={prefillData}
            />
          )}
        </main>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MOBILE BOTTOM NAVIGATION (Phones & Tablets) */}
      {/* ------------------------------------------------------------- */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg pb-safe flex items-center justify-around px-2 py-1">
        <button
          onClick={() => setActiveTab('receiving')}
          className={`flex flex-col items-center justify-center w-full py-1.5 px-1 space-y-1 transition-all relative z-10 ${
            activeTab === 'receiving' ? 'text-emerald-700 font-semibold' : 'text-slate-400 hover:text-slate-700'
          }`}
        >
          {activeTab === 'receiving' && (
            <motion.div
              layoutId="mobileActiveTab"
              className="absolute inset-x-2 top-0 bottom-0 bg-emerald-50 rounded-xl -z-10"
              transition={{ type: "spring", stiffness: 550, damping: 30 }}
            />
          )}
          <div className="p-1 rounded-lg">
            <PackageCheck className="w-5 h-5" />
          </div>
          <span className="text-[11px]">รับเข้า RM</span>
        </button>

        <button
          onClick={() => setActiveTab('issuelog')}
          className={`flex flex-col items-center justify-center w-full py-1.5 px-1 space-y-1 transition-all relative z-10 ${
            activeTab === 'issuelog' ? 'text-rose-700 font-semibold' : 'text-slate-400 hover:text-slate-700'
          }`}
        >
          {activeTab === 'issuelog' && (
            <motion.div
              layoutId="mobileActiveTab"
              className="absolute inset-x-2 top-0 bottom-0 bg-rose-50 rounded-xl -z-10"
              transition={{ type: "spring", stiffness: 550, damping: 30 }}
            />
          )}
          <div className="p-1 rounded-lg relative">
            <AlertTriangle className="w-5 h-5" />
            {openIssuesCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-rose-500 rounded-full border border-white" />
            )}
          </div>
          <span className="text-[11px]">ปัญหา QC</span>
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`flex flex-col items-center justify-center w-full py-1.5 px-1 space-y-1 transition-all relative z-10 ${
            activeTab === 'analytics' ? 'text-sky-700 font-semibold' : 'text-slate-400 hover:text-slate-700'
          }`}
        >
          {activeTab === 'analytics' && (
            <motion.div
              layoutId="mobileActiveTab"
              className="absolute inset-x-2 top-0 bottom-0 bg-sky-50 rounded-xl -z-10"
              transition={{ type: "spring", stiffness: 550, damping: 30 }}
            />
          )}
          <div className="p-1 rounded-lg">
            <BarChart3 className="w-5 h-5" />
          </div>
          <span className="text-[11px]">วิเคราะห์</span>
        </button>

        <button
          onClick={() => setActiveTab('master')}
          className={`flex flex-col items-center justify-center w-full py-1.5 px-1 space-y-1 transition-all relative z-10 ${
            activeTab === 'master' ? 'text-purple-700 font-semibold' : 'text-slate-400 hover:text-slate-700'
          }`}
        >
          {activeTab === 'master' && (
            <motion.div
              layoutId="mobileActiveTab"
              className="absolute inset-x-2 top-0 bottom-0 bg-purple-50 rounded-xl -z-10"
              transition={{ type: "spring", stiffness: 550, damping: 30 }}
            />
          )}
          <div className="p-1 rounded-lg">
            <Sliders className="w-5 h-5" />
          </div>
          <span className="text-[11px]">ข้อมูลหลัก</span>
        </button>
      </nav>
    </div>
  );
};
