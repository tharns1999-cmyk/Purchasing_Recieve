import React, { useState, useMemo } from 'react';
import {
  AlertOctagon,
  Search,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ShieldAlert,
  X,
  Eye,
  Trash2,
  Building2,
  Layers,
  FileText,
  Calendar,
} from 'lucide-react';
import { TablePagination } from '@/components/ui/TablePagination';
import { AutocompleteSelect, SelectOption } from '@/components/ui/AutocompleteSelect';
import {
  Supplier,
  RMItem,
  IssueLogRecord,
  DefectCategoryItem,
  DEFECT_CATEGORIES,
} from '@/services/DefectMatrixService';

export interface PrefillIssueData {
  receivingRecordId?: string;
  supplierId: string;
  supplierName: string;
  rmId: string;
  rmName: string;
  billNo: string;
  issueDate: string;
  problemQty: number;
}

interface IssueLogModuleProps {
  issueLogRecords: IssueLogRecord[];
  onAddIssueLogRecord: (record: IssueLogRecord) => void;
  onUpdateIssueLogStatus: (id: string, newStatus: 'Open' | 'In Progress' | 'Resolved') => void;
  onUpdateIssueLogRecord?: (updatedRecord: IssueLogRecord) => void;
  onDeleteIssueLogRecord?: (id: string) => void;
  isModalOpen: boolean;
  onCloseModal: () => void;
  onOpenManualModal?: () => void;
  prefillData: PrefillIssueData | null;
  suppliers?: Supplier[];
  rmItems?: RMItem[];
  defectCategories?: DefectCategoryItem[];
  onlyModal?: boolean;
}

export const IssueLogModule: React.FC<IssueLogModuleProps> = ({
  issueLogRecords,
  onAddIssueLogRecord,
  onUpdateIssueLogStatus,
  onUpdateIssueLogRecord,
  onDeleteIssueLogRecord,
  isModalOpen,
  onCloseModal,
  onOpenManualModal,
  prefillData,
  suppliers = [],
  rmItems = [],
  defectCategories = [],
  onlyModal = false,
}) => {
  const getTodayDateString = (): string => {
    return new Date().toISOString().split('T')[0] || '';
  };

  // View/Edit Detail Modal State
  const [selectedDetailRecord, setSelectedDetailRecord] = useState<IssueLogRecord | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);

  // Delete Confirmation State
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Edit fields for Detail Modal
  const [editDefectCategory, setEditDefectCategory] = useState<string>(DEFECT_CATEGORIES[0]);
  const [editProblemsFound, setEditProblemsFound] = useState<string>('');
  const [editCorrectiveAction, setEditCorrectiveAction] = useState<string>('');
  const [editProblemQty, setEditProblemQty] = useState<number>(0);
  const [editStatus, setEditStatus] = useState<'Open' | 'In Progress' | 'Resolved'>('Open');

  // Open Detail Modal in Editable Mode
  const handleOpenDetailModal = (rec: IssueLogRecord) => {
    setSelectedDetailRecord(rec);
    setEditDefectCategory(rec.defectCategory || DEFECT_CATEGORIES[0]);
    setEditProblemsFound(rec.problemsFound || '');
    setEditCorrectiveAction(rec.correctiveAction || '');
    setEditProblemQty(rec.problemQty || 0);
    setEditStatus(rec.status || 'Open');
    setIsDetailModalOpen(true);
  };

  // Save Edits from Detail Modal
  const handleSaveEditDetail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDetailRecord) return;

    const updatedRecord: IssueLogRecord = {
      ...selectedDetailRecord,
      defectCategory: editDefectCategory,
      problemsFound: editProblemsFound.trim(),
      correctiveAction: editCorrectiveAction.trim(),
      problemQty: Number(editProblemQty) || 0,
      status: editStatus,
    };

    if (onUpdateIssueLogRecord) {
      onUpdateIssueLogRecord(updatedRecord);
    } else {
      onUpdateIssueLogStatus(updatedRecord.id, editStatus);
    }

    setSelectedDetailRecord(updatedRecord);
    setIsDetailModalOpen(false);
  };

  // Modal Form State
  const [modalSupplierId, setModalSupplierId] = useState<string>('');
  const [modalRmId, setModalRmId] = useState<string>('');
  const [modalBillNo, setModalBillNo] = useState<string>('');
  const [modalIssueDate, setModalIssueDate] = useState<string>(getTodayDateString());
  const [modalProblemQty, setModalProblemQty] = useState<string>('');
  const [modalDefectCategory, setModalDefectCategory] = useState<string>(DEFECT_CATEGORIES[0]);
  const [modalProblemsFound, setModalProblemsFound] = useState<string>('');
  const [modalCorrectiveAction, setModalCorrectiveAction] = useState<string>('');
  const [modalStatus, setModalStatus] = useState<'Open' | 'In Progress' | 'Resolved'>('Open');

  // Table Filter State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Open' | 'In Progress' | 'Resolved'>('ALL');

  // React to prefillData or opening modal
  React.useEffect(() => {
    if (isModalOpen) {
      if (prefillData) {
        setModalSupplierId(prefillData.supplierId);
        setModalRmId(prefillData.rmId);
        setModalBillNo(prefillData.billNo);
        setModalIssueDate(prefillData.issueDate);
        setModalProblemQty(prefillData.problemQty.toString());
        setModalDefectCategory(DEFECT_CATEGORIES[0]);
        setModalProblemsFound('');
        setModalCorrectiveAction('แจ้งหักบิล / ประสานงานผู้ส่งมอบ');
        setModalStatus('Open');
      } else {
        // Reset to default blank modal
        setModalSupplierId('');
        setModalRmId('');
        setModalBillNo('');
        setModalIssueDate(getTodayDateString());
        setModalProblemQty('');
        setModalDefectCategory(DEFECT_CATEGORIES[0]);
        setModalProblemsFound('');
        setModalCorrectiveAction('');
        setModalStatus('Open');
      }
    }
  }, [isModalOpen, prefillData]);

  const availableRMsForSupplier = useMemo(() => {
    if (!modalSupplierId) return [];
    return (rmItems || []).filter((rm) => rm.supplierId === modalSupplierId || (rm.supplierIds && rm.supplierIds.includes(modalSupplierId)));
  }, [modalSupplierId, rmItems]);

  const supplierSelectOptions: SelectOption[] = useMemo(
    () =>
      (suppliers || []).map((s) => ({
        value: s.id,
        label: s.name,
        badge: s.code,
      })),
    [suppliers]
  );

  const rmSelectOptions: SelectOption[] = useMemo(
    () =>
      availableRMsForSupplier.map((r) => ({
        value: r.id,
        label: r.name,
        subtitle: r.categoryLabel,
        badge: r.category,
      })),
    [availableRMsForSupplier]
  );

  const defectCategorySelectOptions: SelectOption[] = useMemo(() => {
    if (defectCategories && defectCategories.length > 0) {
      const activeCats = defectCategories.filter((c) => c.isActive !== false);
      return activeCats.map((cat) => ({
        value: cat.name,
        label: cat.name,
        subtitle: cat.description || undefined,
      }));
    }
    return DEFECT_CATEGORIES.map((cat) => ({
      value: cat,
      label: cat,
    }));
  }, [defectCategories]);

  // Form Submit Handler
  const handleSaveIssueLog = (e?: React.FormEvent | React.MouseEvent) => {
    try {
      if (e) e.preventDefault();

      if (!modalSupplierId || !modalRmId || !modalBillNo || !modalProblemsFound) {
        alert('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
        return;
      }

      const supplierObj = suppliers.find((s) => s.id === modalSupplierId);
      const rmObj = rmItems.find((r) => r.id === modalRmId);

      if (!supplierObj || !rmObj) {
        alert('เกิดข้อผิดพลาด: ไม่พบข้อมูล Supplier หรือ RM ในระบบ');
        return;
      }

      // Close modal first so UI is responsive even if save fails
      onCloseModal();

      const newRecord: IssueLogRecord = {
        id: `ISS-${Date.now().toString().slice(-6)}`,
        receivingRecordId: prefillData?.receivingRecordId,
        supplierId: supplierObj.id,
        supplierName: supplierObj.name,
        rmId: rmObj.id,
        rmName: rmObj.name,
        billNo: String(modalBillNo || '').trim(),
        issueDate: modalIssueDate,
        problemQty: parseFloat(String(modalProblemQty)) || 0,
        defectCategory: modalDefectCategory,
        problemsFound: String(modalProblemsFound || '').trim(),
        correctiveAction: String(modalCorrectiveAction || '').trim(),
        status: modalStatus,
        createdAt: new Date().toISOString(),
      };

      onAddIssueLogRecord(newRecord);
    } catch (err: unknown) {
      const e = err as Error;
      alert(`Error saving Issue Log: ${e.message}`);
      console.error(err);
    }
  };

  // Filtered Table Records
  const filteredRecords = useMemo(() => {
    const q = (searchQuery || '').toLowerCase();
    return (issueLogRecords || []).filter((rec) => {
      if (!rec) return false;
      const matchSearch =
        String(rec.billNo || '').toLowerCase().includes(q) ||
        String(rec.supplierName || '').toLowerCase().includes(q) ||
        String(rec.rmName || '').toLowerCase().includes(q) ||
        String(rec.problemsFound || '').toLowerCase().includes(q);

      const matchStatus = statusFilter === 'ALL' || rec.status === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [issueLogRecords, searchQuery, statusFilter]);

  // Table Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  const totalPages = Math.ceil(filteredRecords.length / pageSize);
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

  if (onlyModal && !isModalOpen) return null;

  return (
    <div className={onlyModal ? '' : 'h-full flex-1 flex flex-col min-h-0 space-y-3'}>
      {!onlyModal && (
        <>
          {/* Top Header Card: Stat Badges + Add Issue Button */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-3 sm:px-4 sm:py-3 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shrink-0">
            {/* Stat Badges */}
            <div className="flex items-center gap-3 overflow-x-auto custom-scrollbar">
              <div className="flex items-center gap-2.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/70 shrink-0">
                <AlertOctagon className="w-4 h-4 text-slate-500" />
                <span className="text-xs text-slate-600 font-medium">ปัญหาทั้งหมด</span>
                <span className="px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-800 text-xs font-mono font-semibold">
                  {issueLogRecords.length}
                </span>
              </div>

              <div className="flex items-center gap-2.5 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200/80 shrink-0">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span className="text-xs text-rose-800 font-medium">รอดำเนินการ</span>
                <span className="px-2 py-0.5 rounded-full bg-rose-200/80 text-rose-900 text-xs font-mono font-bold">
                  {issueLogRecords.filter(r => r.status === 'Open' || r.status === 'In Progress').length}
                </span>
              </div>

              <div className="flex items-center gap-2.5 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200/80 shrink-0">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="text-xs text-emerald-800 font-medium">แก้ไขเรียบร้อย</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-200/80 text-emerald-900 text-xs font-mono font-bold">
                  {issueLogRecords.filter(r => r.status === 'Resolved').length}
                </span>
              </div>
            </div>

            {/* Action Button */}
            <button
              type="button"
              onClick={() => {
                if (onOpenManualModal) {
                  onOpenManualModal();
                }
              }}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-medium text-xs rounded-xl shadow-xs transition-all cursor-pointer whitespace-nowrap"
            >
              <span className="text-xs">➕</span>
              <span>บันทึกเคสปัญหาใหม่</span>
            </button>
          </div>

          {/* Main Issue Log Table Card */}
          <div className="flex-1 flex flex-col min-h-0 bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
            {/* Table Controls Header */}
            <div className="p-3 sm:px-4 sm:py-3 border-b border-slate-100 bg-white flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
                  <AlertOctagon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    รายการติดตามปัญหาคุณภาพ (QC Issue Log)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    บันทึกและติดตามเคสข้อร้องเรียนคุณภาพวัตถุดิบ
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                {/* Search */}
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ค้นหา Bill No, Supplier, ปัญหา..."
                    className="w-full h-9 pl-9 pr-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all placeholder:text-slate-400"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Status Filter */}
                <div className="flex items-center bg-slate-100/80 p-1 rounded-xl border border-slate-200/60 overflow-x-auto custom-scrollbar text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setStatusFilter('ALL')}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${statusFilter === 'ALL'
                        ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                      }`}
                  >
                    ทั้งหมด ({issueLogRecords.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('Open')}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${statusFilter === 'Open'
                        ? 'bg-rose-600 text-white shadow-2xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                      }`}
                  >
                    รอดำเนินการ
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('In Progress')}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${statusFilter === 'In Progress'
                        ? 'bg-amber-600 text-white shadow-2xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                      }`}
                  >
                    กำลังแก้ไข
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('Resolved')}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${statusFilter === 'Resolved'
                        ? 'bg-emerald-600 text-white shadow-2xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                      }`}
                  >
                    แก้ไขแล้ว
                  </button>
                </div>
              </div>
            </div>

            {/* Table Content with Scrollbar */}
            <div className="flex-1 overflow-x-auto overflow-y-auto min-h-0 custom-scrollbar relative">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 shadow-2xs">
                  <tr className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                    <th className="py-3 px-4 w-28">วันที่พบ</th>
                    <th className="py-3 px-4 w-32">Bill No</th>
                    <th className="py-3 px-4">Supplier</th>
                    <th className="py-3 px-4">วัตถุดิบ (RM)</th>
                    <th className="py-3 px-4 text-right">ปริมาณมีปัญหา</th>
                    <th className="py-3 px-4">รายละเอียดปัญหา</th>
                    <th className="py-3 px-4">มาตรการแก้ไข</th>
                    <th className="py-3 px-4 text-center w-32">สถานะ</th>
                    <th className="py-3 px-4 text-center w-20">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm font-normal text-slate-800">
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500 opacity-40" />
                        <p className="font-normal text-slate-500">ไม่พบเคสปัญหาคุณภาพวัตถุดิบ</p>
                        <p className="text-sm mt-0.5">ระบบยังไม่มีประวัติ QC Issue Log ในขณะนี้</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedRecords.map((rec) => (
                      <tr
                        key={rec.id}
                        onClick={() => handleOpenDetailModal(rec)}
                        className="hover:bg-slate-100/80 transition-colors cursor-pointer"
                      >
                        <td className="py-3 px-4 whitespace-nowrap text-slate-600 font-mono">
                          {rec.issueDate ? rec.issueDate.split('T')[0] : '-'}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap font-normal text-slate-900 font-mono">
                          {rec.billNo}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap font-normal text-slate-800">
                          {rec.supplierName}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap font-normal text-slate-900">
                          {rec.rmName}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-right font-normal text-rose-700">
                          {rec.problemQty.toLocaleString()} kg
                        </td>
                        <td className="py-3 px-4 max-w-xs">
                          <span className="inline-block text-sm font-normal px-2 py-0.5 rounded bg-rose-100 text-rose-800 mb-1 border border-rose-200">
                            {rec.defectCategory || DEFECT_CATEGORIES[0]}
                          </span>
                          <p className="text-slate-800 font-normal line-clamp-2">
                            {rec.problemsFound}
                          </p>
                        </td>
                        <td className="py-3 px-4 max-w-xs text-slate-600">
                          <p className="line-clamp-2">{rec.correctiveAction || '-'}</p>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={rec.status}
                            onChange={(e) =>
                              onUpdateIssueLogStatus(
                                rec.id,
                                e.target.value as 'Open' | 'In Progress' | 'Resolved'
                              )
                            }
                            className={`text-sm font-normal px-2.5 py-1 rounded-full border focus:outline-none cursor-pointer ${rec.status === 'Open'
                                ? 'bg-rose-100 text-rose-800 border-rose-300'
                                : rec.status === 'In Progress'
                                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                                  : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              }`}
                          >
                            <option value="Open">🔴 Open (รอดำเนินการ)</option>
                            <option value="In Progress">🟡 In Progress (กำลังแก้ไข)</option>
                            <option value="Resolved">🟢 Resolved (แก้ไขแล้ว)</option>
                          </select>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-2">
                            {confirmDeleteId === rec.id ? (
                              <div className="flex items-center gap-1.5 animate-in fade-in slide-in-from-right-2 duration-200">
                                <span className="text-sm font-normal text-rose-600 mr-1">แน่ใจหรือไม่?</span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (onDeleteIssueLogRecord) {
                                      onDeleteIssueLogRecord(rec.id);
                                    }
                                    setConfirmDeleteId(null);
                                  }}
                                  className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-sm font-normal shadow-sm transition-colors"
                                >
                                  ยืนยันลบ
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmDeleteId(null);
                                  }}
                                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md text-sm font-normal transition-colors"
                                >
                                  ยกเลิก
                                </button>
                              </div>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenDetailModal(rec);
                                  }}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-sm font-normal transition-all shadow-2xs cursor-pointer"
                                  title="ดูและแก้ไขรายละเอียดเคส"
                                >
                                  <Eye className="w-3.5 h-3.5 text-rose-600" />
                                  ดู/แก้ไขข้อมูล
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmDeleteId(rec.id);
                                  }}
                                  className={
                                    "inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors " +
                                    "text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                  }
                                  title="ลบข้อมูล"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Pagination Anchored to Bottom */}
            <div className="mt-auto shrink-0 border-t border-slate-200/80">
              <TablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredRecords.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
                itemUnitLabel="รายการปัญหา"
              />
            </div>
          </div>
        </>
      )}

      {/* Modal Dialog for Issue Log Creation (Auto Trigger & Manual Input) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] border border-slate-200/80 w-full max-w-2xl max-h-[calc(100vh-2rem)] sm:max-h-[90vh] flex flex-col my-auto overflow-hidden transform transition-all relative">
            {/* Modal Header */}
            <div className="flex-none bg-gradient-to-r from-slate-950 via-rose-950 to-slate-900 px-5 py-4 sm:px-7 sm:py-5 text-white flex items-center justify-between rounded-t-2xl sm:rounded-t-3xl border-b border-rose-900/40">
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 rounded-2xl bg-rose-500/20 text-rose-300 border border-rose-500/30 shadow-inner">
                  <AlertTriangle className="w-5 h-5 text-rose-400" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-normal tracking-tight text-white flex items-center gap-2">
                    {prefillData ? 'บันทึก QC Issue Log (Auto-Trigger จากผล FAIL)' : 'สร้าง QC Issue Log ใหม่'}
                  </h3>
                  <p className="text-sm text-rose-200/90 font-normal mt-0.5">
                    บันทึกประวัติปัญหาคุณภาพวัตถุดิบและมาตรการแก้ไข
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onCloseModal}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSaveIssueLog} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-7 space-y-4 sm:space-y-5 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/80 p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs relative z-30">
                  {/* Supplier */}
                  <div>
                    <label className="block text-sm font-normal text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                      Supplier (ผู้ส่งมอบ) <span className="text-rose-500">*</span>
                    </label>
                    {prefillData ? (
                      <input
                        type="text"
                        readOnly
                        value={prefillData.supplierName}
                        className="w-full h-11 px-3.5 bg-slate-200/70 border border-slate-300 rounded-xl text-sm font-normal text-slate-900 cursor-not-allowed shadow-2xs"
                      />
                    ) : (
                      <AutocompleteSelect
                        options={supplierSelectOptions}
                        value={modalSupplierId}
                        onChange={(val) => {
                          setModalSupplierId(val);
                          setModalRmId('');
                        }}
                        placeholder="-- ค้นหาผู้ส่งมอบ --"
                        searchPlaceholder="พิมพ์รหัส หรือ ชื่อ Supplier..."
                        required
                      />
                    )}
                  </div>

                  {/* RM */}
                  <div>
                    <label className="block text-sm font-normal text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-sky-600" />
                      วัตถุดิบ (RM) <span className="text-rose-500">*</span>
                    </label>
                    {prefillData ? (
                      <input
                        type="text"
                        readOnly
                        value={prefillData.rmName}
                        className="w-full h-11 px-3.5 bg-slate-200/70 border border-slate-300 rounded-xl text-sm font-normal text-slate-900 cursor-not-allowed shadow-2xs"
                      />
                    ) : (
                      <AutocompleteSelect
                        options={rmSelectOptions}
                        value={modalRmId}
                        onChange={setModalRmId}
                        disabled={!modalSupplierId}
                        placeholder={modalSupplierId ? '-- ค้นหาวัตถุดิบ --' : 'กรุณาเลือก Supplier ก่อน'}
                        searchPlaceholder="พิมพ์ชื่อวัตถุดิบ เพื่อค้นหา..."
                        required
                      />
                    )}
                  </div>

                  {/* Bill No */}
                  <div>
                    <label className="block text-sm font-normal text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-slate-500" />
                      เลขที่บิล (Bill No) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={modalBillNo}
                      onChange={(e) => setModalBillNo(e.target.value)}
                      required
                      readOnly={Boolean(prefillData)}
                      placeholder="เช่น BILL-2026-001"
                      className={`w-full h-11 px-3.5 border rounded-xl text-sm font-mono font-normal transition-all shadow-2xs ${prefillData
                          ? 'bg-slate-200/70 border-slate-300 text-slate-900 cursor-not-allowed'
                          : 'bg-white border-slate-300 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500'
                        }`}
                    />
                  </div>

                  {/* Issue Date */}
                  <div>
                    <label className="block text-sm font-normal text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      วันที่พบปัญหา (Date) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={modalIssueDate}
                      onChange={(e) => setModalIssueDate(e.target.value)}
                      required
                      className="w-full h-11 px-3 bg-white border border-slate-300 rounded-xl text-sm font-normal text-slate-900 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 shadow-2xs transition-all"
                    />
                  </div>

                  {/* Problem Qty */}
                  <div>
                    <label className="block text-sm font-normal text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                      ปริมาณสินค้า (KG)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={modalProblemQty}
                      onChange={(e) => setModalProblemQty(e.target.value)}
                      placeholder="เช่น 1.5"
                      className="w-full h-11 px-3 bg-white border border-slate-300 rounded-xl text-sm font-normal text-rose-700 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 shadow-2xs transition-all"
                    />
                  </div>

                  {/* Defect Category Dropdown */}
                  <div className="relative z-20">
                    <label className="block text-sm font-normal text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
                      หมวดหมู่ปัญหา (Category) <span className="text-rose-500">*</span>
                    </label>
                    <AutocompleteSelect
                      options={defectCategorySelectOptions}
                      value={modalDefectCategory}
                      onChange={setModalDefectCategory}
                      placeholder="-- เลือกหมวดหมู่ --"
                      required
                    />
                  </div>
                </div>

                {/* 2. Problem Details Textarea */}
                <div>
                  <label className="block text-sm font-normal text-slate-800 uppercase tracking-wide mb-1.5">
                    รายละเอียดปัญหาที่พบ (Problem Details) <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={modalProblemsFound}
                    onChange={(e) => setModalProblemsFound(e.target.value)}
                    placeholder="ระบุรายละเอียดเชิงลึกของปัญหาที่พบ เช่น ใบตองพบขี้หนูและรอยแมลงกัดเจาะเกิน 1.5 kg"
                    required
                    className="w-full p-3.5 bg-white border border-slate-300 rounded-2xl text-sm font-normal text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 shadow-2xs transition-all placeholder:text-slate-400 leading-relaxed"
                  />
                </div>

                {/* Status */}
                <div>
                  <label className="block text-sm font-normal text-slate-800 uppercase tracking-wide mb-1.5">
                    สถานะการดำเนินการ (Status)
                  </label>
                  <select
                    value={modalStatus}
                    onChange={(e) =>
                      setModalStatus(e.target.value as 'Open' | 'In Progress' | 'Resolved')
                    }
                    className="w-full h-11 px-4 bg-white border border-slate-300 rounded-xl text-sm font-normal text-slate-900 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 shadow-2xs cursor-pointer transition-all"
                  >
                    <option value="Open">🔴 Open (รอดำเนินการ)</option>
                    <option value="In Progress">🟡 In Progress (กำลังแก้ไข)</option>
                    <option value="Resolved">🟢 Resolved (แก้ไขเรียบร้อย)</option>
                  </select>
                </div>

                {/* Corrective Action Status */}
                <div>
                  <label className="block text-sm font-normal text-slate-800 uppercase tracking-wide mb-1.5">
                    สถานะการดำเนินการแก้ไข (Corrective Action Status)
                  </label>
                  <textarea
                    rows={2}
                    value={modalCorrectiveAction}
                    onChange={(e) => setModalCorrectiveAction(e.target.value)}
                    placeholder="เช่น แจ้งหักบิล, ตีคืนสินค้าทั้ง Lot, กำชับสวนเรื่องความสะอาด"
                    className="w-full p-3.5 bg-white border border-slate-300 rounded-2xl text-sm font-normal text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 shadow-2xs transition-all placeholder:text-slate-400 leading-relaxed"
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex-none px-5 py-3.5 sm:px-7 sm:py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3 rounded-b-2xl sm:rounded-b-3xl">
                <button
                  type="button"
                  onClick={onCloseModal}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-normal text-sm rounded-xl transition-all cursor-pointer active:scale-95"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-normal text-sm rounded-xl shadow-lg shadow-rose-600/25 transition-all cursor-pointer flex items-center gap-2 active:scale-95"
                >
                  💾 บันทึก QC Issue Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View & Edit Case Details Modal */}
      {isDetailModalOpen && selectedDetailRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[calc(100vh-2rem)] sm:max-h-[90vh] flex flex-col my-auto overflow-hidden transform transition-all relative">
            <form onSubmit={handleSaveEditDetail} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              {/* Modal Header */}
              <div className="flex-none bg-gradient-to-r from-slate-900 via-rose-950 to-slate-900 px-5 py-4 sm:px-6 sm:py-4 text-white flex items-center justify-between rounded-t-2xl sm:rounded-t-3xl border-b border-rose-900/40">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    <AlertOctagon className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base sm:text-lg font-normal">
                        รายละเอียด & แก้ไขเคสปัญหา ({selectedDetailRecord.id})
                      </h3>
                      <span
                        className={`text-sm font-normal px-2 py-0.5 rounded-full border ${editStatus === 'Open'
                            ? 'bg-rose-500/20 text-rose-300 border-rose-400/40'
                            : editStatus === 'In Progress'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                              : 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                          }`}
                      >
                        {editStatus}
                      </span>
                    </div>
                    <p className="text-sm text-slate-300 mt-0.5 font-mono">
                      Bill No: {selectedDetailRecord.billNo} | วันที่บันทึก: {selectedDetailRecord.issueDate?.split('T')[0]}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDetailModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Content - Editable Form */}
              <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar">
                {/* Info Grid 1: Readonly Reference Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-sm font-normal text-slate-400 uppercase tracking-wider block mb-1">
                      Supplier (ผู้ส่งมอบ)
                    </span>
                    <p className="text-base font-normal text-slate-900 flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-emerald-600" />
                      {selectedDetailRecord.supplierName}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm font-normal text-slate-400 uppercase tracking-wider block mb-1">
                      วัตถุดิบ (RM Name)
                    </span>
                    <p className="text-base font-normal text-slate-900 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-sky-600" />
                      {selectedDetailRecord.rmName}
                    </p>
                  </div>
                </div>

                {/* Field 1: Defect Category (Dropdown) */}
                <div className="relative z-30">
                  <label className="block text-sm font-normal text-slate-700 uppercase mb-1">
                    หมวดหมู่ปัญหาคุณภาพ (Defect Category) <span className="text-rose-500">*</span>
                  </label>
                  <AutocompleteSelect
                    options={defectCategorySelectOptions}
                    value={editDefectCategory}
                    onChange={setEditDefectCategory}
                    placeholder="-- เลือกหมวดหมู่ปัญหาคุณภาพ --"
                    required
                  />
                </div>

                {/* Field 2: Problem Details (Textarea) */}
                <div>
                  <label className="block text-sm font-normal text-slate-700 uppercase mb-1">
                    รายละเอียดปัญหาที่พบ (Problem Details) <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={editProblemsFound}
                    onChange={(e) => setEditProblemsFound(e.target.value)}
                    required
                    placeholder="ระบุรายละเอียดปัญหา เช่น พบแมลงและสิ่งแปลกปลอมเกินเกณฑ์สุ่มตรวจ"
                    className="w-full p-3 bg-white border border-slate-300 rounded-xl text-sm font-normal text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                  />
                </div>

                {/* Field 3: Problem Quantity */}
                <div>
                  <label className="block text-sm font-normal text-slate-700 uppercase mb-1">
                    ปริมาณมีปัญหา (Problem Qty - kg) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editProblemQty}
                    onChange={(e) => setEditProblemQty(parseFloat(e.target.value) || 0)}
                    required
                    className="w-full h-10 px-3 bg-white border border-slate-300 rounded-xl text-sm font-normal text-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                  />
                </div>

                {/* Field 4: Corrective Action Status */}
                <div>
                  <label className="block text-sm font-normal text-slate-700 uppercase mb-1">
                    มาตรการและการดำเนินการแก้ไข (Corrective Action Status)
                  </label>
                  <textarea
                    rows={2}
                    value={editCorrectiveAction}
                    onChange={(e) => setEditCorrectiveAction(e.target.value)}
                    placeholder="เช่น แจ้งหักบิลสินค้า, ตีคืนสินค้า Lot นี้, กำชับสวนเรื่องความสะอาด"
                    className="w-full p-3 bg-white border border-slate-300 rounded-xl text-sm font-normal text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                  />
                </div>

                {/* Field 5: Case Status */}
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                  <label className="text-sm font-normal text-slate-700 uppercase">
                    สถานะการติดตามเคส (Case Status)
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as 'Open' | 'In Progress' | 'Resolved')}
                    className="text-sm font-normal px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                  >
                    <option value="Open">🔴 Open (รอดำเนินการ)</option>
                    <option value="In Progress">🟡 In Progress (กำลังแก้ไข)</option>
                    <option value="Resolved">🟢 Resolved (แก้ไขแล้ว)</option>
                  </select>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex-none bg-slate-50 px-5 py-3.5 sm:px-6 sm:py-4 border-t border-slate-200 flex items-center justify-end gap-3 rounded-b-2xl sm:rounded-b-3xl">
                <button
                  type="button"
                  onClick={() => setIsDetailModalOpen(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-normal text-sm rounded-xl transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-normal text-sm rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                >
                  💾 บันทึกการแก้ไข
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
