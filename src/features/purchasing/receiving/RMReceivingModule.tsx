import React, { useState, useMemo } from 'react';
import {
  PackageCheck,
  CheckCircle2,
  XCircle,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  Calendar,
  Pencil,
  X,
  Trash2,
  Factory,
  Image as ImageIcon,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { TablePagination } from '@/components/ui/TablePagination';
import { RMReceivingDrawer } from './RMReceivingDrawer';
import { RMReceivingAttachmentModal } from './RMReceivingAttachmentModal';
import {
  calculateDefectResult,
  ReceivingRecord,
  ReceivingAttachmentItem,
  RMItem,
  Supplier,
  DefectRule,
} from '@/services/DefectMatrixService';

export type SortKey =
  | 'receiveDate'
  | 'billNo'
  | 'supplierName'
  | 'rmName'
  | 'receiveQty'
  | 'unitPrice'
  | 'totalAmount'
  | 'sampleQty'
  | 'defectQty'
  | 'defectPercent'
  | 'isPass'
  | 'postProductionDefectQty';

interface RMReceivingModuleProps {
  receivingRecords: ReceivingRecord[];
  onAddReceivingRecord: (record: ReceivingRecord) => void;
  onAddReceivingRecordsBatch?: (records: ReceivingRecord[]) => void;
  onUpdateReceivingRecord?: (record: ReceivingRecord) => void;
  onDeleteReceivingRecord?: (id: string) => void;
  onOpenIssueLogModal: (prefillData: {
    receivingRecordId: string;
    supplierId: string;
    supplierName: string;
    rmId: string;
    rmName: string;
    billNo: string;
    issueDate: string;
    problemQty: number;
  }) => void;
  suppliers?: Supplier[];
  rmItems?: RMItem[];
  defectMatrix?: Record<string, DefectRule[]>;
}

// Robust timestamp parser for string dates (ISO, YYYY-MM-DD, locale string, or fallback to createdAt)
const parseRecordTimestamp = (dateStr?: string, createdAtStr?: string): number => {
  if (dateStr) {
    const cleanDate = dateStr.includes('T') ? dateStr : `${dateStr.substring(0, 10)}T00:00:00`;
    const ts = new Date(cleanDate).getTime();
    if (!isNaN(ts)) return ts;
  }
  if (createdAtStr) {
    const ts = new Date(createdAtStr).getTime();
    if (!isNaN(ts)) return ts;
  }
  return 0;
};

export const RMReceivingModule: React.FC<RMReceivingModuleProps> = ({
  receivingRecords = [],
  onAddReceivingRecord,
  onAddReceivingRecordsBatch,
  onUpdateReceivingRecord,
  onDeleteReceivingRecord,
  onOpenIssueLogModal,
  suppliers = [],
  rmItems = [],
  defectMatrix = {},
}) => {
  // Slide-over Drawer State for New Bill Creation
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  // Table Filter & Sorting State (Default: receiveDate DESC)
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PASS' | 'FAIL'>('ALL');
  const [sortConfig, setSortConfig] = useState<{
    key: SortKey;
    direction: 'asc' | 'desc';
  }>({
    key: 'receiveDate',
    direction: 'desc',
  });

  // Table Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Edit Modal State (History records)
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [editingRecord, setEditingRecord] = useState<ReceivingRecord | null>(null);
  const [editBillNo, setEditBillNo] = useState<string>('');
  const [editReceiveDate, setEditReceiveDate] = useState<string>('');
  const [editReceiveQty, setEditReceiveQty] = useState<string>('');
  const [editDefectQty, setEditDefectQty] = useState<string>('');
  const [editUnitPrice, setEditUnitPrice] = useState<string>('');
  const [editRemark, setEditRemark] = useState<string>('');

  // Delete Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [recordToDelete, setRecordToDelete] = useState<ReceivingRecord | null>(null);

  // Post-Production Modal State
  const [isPostProdModalOpen, setIsPostProdModalOpen] = useState<boolean>(false);
  const [postProdRecord, setPostProdRecord] = useState<ReceivingRecord | null>(null);
  const [postProdDefectQty, setPostProdDefectQty] = useState<string>('');
  const [postProdRemark, setPostProdRemark] = useState<string>('');
  const [postProdDate, setPostProdDate] = useState<string>('');

  // Attachment Modal State
  const [isAttachmentModalOpen, setIsAttachmentModalOpen] = useState<boolean>(false);
  const [attachmentRecord, setAttachmentRecord] = useState<ReceivingRecord | null>(null);

  // Reset page to 1 when filters or sorting change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, sortConfig]);

  // Overall status counts
  const statusCounts = useMemo(() => {
    const list = receivingRecords || [];
    const pass = list.filter((r) => r.isPass).length;
    const fail = list.filter((r) => !r.isPass).length;
    return { all: list.length, pass, fail };
  }, [receivingRecords]);

  // Filtered & Sorted History Data
  const sortedHistory = useMemo(() => {
    const q = (searchQuery || '').toLowerCase().trim();
    const seenIds = new Set<string>();

    const filtered = (receivingRecords || []).filter((rec) => {
      if (!rec || !rec.id) return false;
      if (seenIds.has(rec.id)) return false;
      seenIds.add(rec.id);

      const matchSearch =
        !q ||
        String(rec.billNo || '').toLowerCase().includes(q) ||
        String(rec.supplierName || '').toLowerCase().includes(q) ||
        String(rec.rmName || '').toLowerCase().includes(q) ||
        String(rec.rmCategory || '').toLowerCase().includes(q);

      const matchStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'PASS' && rec.isPass) ||
        (statusFilter === 'FAIL' && !rec.isPass);

      return matchSearch && matchStatus;
    });

    // Sort with robust comparisons
    return filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortConfig.key) {
        case 'receiveDate': {
          const tsA = parseRecordTimestamp(a.receiveDate, a.createdAt);
          const tsB = parseRecordTimestamp(b.receiveDate, b.createdAt);
          comparison = tsA - tsB;
          break;
        }
        case 'billNo':
          comparison = String(a.billNo || '').localeCompare(String(b.billNo || ''), 'th', {
            numeric: true,
          });
          break;
        case 'supplierName':
          comparison = String(a.supplierName || '').localeCompare(
            String(b.supplierName || ''),
            'th'
          );
          break;
        case 'rmName':
          comparison = String(a.rmName || '').localeCompare(String(b.rmName || ''), 'th');
          break;
        case 'receiveQty':
          comparison = (a.receiveQty || 0) - (b.receiveQty || 0);
          break;
        case 'unitPrice':
          comparison = (a.unitPrice || 0) - (b.unitPrice || 0);
          break;
        case 'totalAmount': {
          const amountA = (a.receiveQty || 0) * (a.unitPrice || 0);
          const amountB = (b.receiveQty || 0) * (b.unitPrice || 0);
          comparison = amountA - amountB;
          break;
        }
        case 'sampleQty':
          comparison = (a.sampleQty || 0) - (b.sampleQty || 0);
          break;
        case 'defectQty':
          comparison = (a.defectQty || 0) - (b.defectQty || 0);
          break;
        case 'defectPercent':
          comparison = (a.defectPercent || 0) - (b.defectPercent || 0);
          break;
        case 'isPass':
          comparison = a.isPass === b.isPass ? 0 : a.isPass ? 1 : -1;
          break;
        case 'postProductionDefectQty':
          comparison = (a.postProductionDefectQty || 0) - (b.postProductionDefectQty || 0);
          break;
        default:
          comparison = 0;
      }

      // Tie breaker: newest timestamp first
      if (comparison === 0) {
        const tsA = parseRecordTimestamp(a.receiveDate, a.createdAt);
        const tsB = parseRecordTimestamp(b.receiveDate, b.createdAt);
        comparison = tsA - tsB;
      }

      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [receivingRecords, searchQuery, statusFilter, sortConfig]);

  // Paginated History
  const totalPages = Math.ceil(sortedHistory.length / pageSize) || 1;
  const paginatedHistory = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedHistory.slice(start, start + pageSize);
  }, [sortedHistory, currentPage, pageSize]);

  // Interactive Table Column Sort Toggle
  const handleSort = (key: SortKey) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return {
          key,
          direction: prev.direction === 'asc' ? 'desc' : 'asc',
        };
      }
      const defaultDesc = [
        'receiveDate',
        'receiveQty',
        'unitPrice',
        'totalAmount',
        'sampleQty',
        'defectQty',
        'defectPercent',
        'postProductionDefectQty',
      ].includes(key);
      return {
        key,
        direction: defaultDesc ? 'desc' : 'asc',
      };
    });
  };

  // Sort header helper component
  const renderSortHeader = (
    label: string,
    key: SortKey,
    align: 'left' | 'right' | 'center' = 'left'
  ) => {
    const isActive = sortConfig.key === key;
    return (
      <th
        onClick={() => handleSort(key)}
        className={`py-3 px-3 text-xs font-semibold select-none cursor-pointer transition-colors duration-150 group hover:bg-slate-200/70 ${
          isActive ? 'text-emerald-700 bg-emerald-50/50 font-bold' : 'text-slate-700'
        } ${
          align === 'right'
            ? 'text-right'
            : align === 'center'
            ? 'text-center'
            : 'text-left'
        }`}
      >
        <div
          className={`inline-flex items-center gap-1.5 ${
            align === 'right'
              ? 'justify-end'
              : align === 'center'
              ? 'justify-center'
              : 'justify-start'
          }`}
        >
          <span>{label}</span>
          <span
            className={`transition-colors inline-flex items-center ${
              isActive ? 'text-emerald-600' : 'text-slate-400 group-hover:text-slate-600'
            }`}
          >
            {isActive ? (
              sortConfig.direction === 'asc' ? (
                <ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" />
              ) : (
                <ArrowDown className="w-3.5 h-3.5 stroke-[2.5]" />
              )
            ) : (
              <ArrowUpDown className="w-3 h-3 opacity-40 group-hover:opacity-100" />
            )}
          </span>
        </div>
      </th>
    );
  };

  // Edit History Modal Handlers
  const handleOpenEdit = (record: ReceivingRecord) => {
    setEditingRecord(record);
    setEditBillNo(String(record.billNo || ''));
    const rawDate = String(record.receiveDate || '');
    const normalizedDate =
      (rawDate.includes('T') ? rawDate.split('T')[0] : rawDate.substring(0, 10)) || '';
    setEditReceiveDate(normalizedDate);
    setEditReceiveQty(String(record.receiveQty ?? ''));
    setEditDefectQty(String(record.defectQty ?? '0'));
    setEditUnitPrice(record.unitPrice !== undefined ? String(record.unitPrice) : '');
    setEditRemark(String(record.remark || ''));
    setIsEditModalOpen(true);
  };

  const handleCloseEdit = () => {
    setIsEditModalOpen(false);
    setEditingRecord(null);
  };

  const editEvaluationResult = useMemo(() => {
    if (!editingRecord || parseFloat(String(editReceiveQty)) <= 0) {
      return { sampleQty: 0, acceptMaxDefectQty: 0, defectPercent: 0, isPass: true };
    }
    return calculateDefectResult(
      editingRecord.rmCategory,
      parseFloat(String(editReceiveQty)) || 0,
      parseFloat(String(editDefectQty)) || 0,
      defectMatrix || {}
    );
  }, [editingRecord, editReceiveQty, editDefectQty, defectMatrix]);

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord || !onUpdateReceivingRecord) return;

    const billNoVal = String(editBillNo || '').trim();
    const receiveQtyVal = parseFloat(String(editReceiveQty)) || 0;
    const dateVal = String(editReceiveDate || '').trim();

    if (!billNoVal) {
      alert('กรุณากรอกเลขที่บิล');
      return;
    }
    if (!dateVal || !/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
      alert('กรุณาเลือกวันที่รับเข้าให้ถูกต้อง (รูปแบบ YYYY-MM-DD)');
      return;
    }
    if (receiveQtyVal <= 0) {
      alert('กรุณาระบุจำนวนรับเข้า (kg) ให้ถูกต้อง');
      return;
    }

    const updatedRecord: ReceivingRecord = {
      ...editingRecord,
      billNo: billNoVal,
      receiveDate: dateVal,
      receiveQty: receiveQtyVal,
      sampleQty: editEvaluationResult.sampleQty,
      defectQty: parseFloat(String(editDefectQty)) || 0,
      defectPercent: editEvaluationResult.defectPercent,
      isPass: editEvaluationResult.isPass,
      unitPrice: String(editUnitPrice || '').trim()
        ? parseFloat(String(editUnitPrice)) || 0
        : undefined,
      remark: String(editRemark || '').trim(),
    };

    onUpdateReceivingRecord(updatedRecord);
    handleCloseEdit();
  };

  // Delete Modal Handlers
  const confirmDelete = () => {
    if (recordToDelete && onDeleteReceivingRecord) {
      onDeleteReceivingRecord(recordToDelete.id);
      setRecordToDelete(null);
      setIsDeleteModalOpen(false);
    }
  };

  const handleOpenDelete = (record: ReceivingRecord) => {
    setRecordToDelete(record);
    setIsDeleteModalOpen(true);
  };

  // Post-Production Handlers
  const handleOpenPostProd = (record: ReceivingRecord) => {
    setPostProdRecord(record);
    setPostProdDefectQty(
      record.postProductionDefectQty !== undefined && record.postProductionDefectQty !== null
        ? String(record.postProductionDefectQty)
        : ''
    );
    setPostProdRemark(String(record.postProductionRemark || ''));

    const rawPostDate = String(record.postProductionDate || '');
    let normalizedDate = '';
    if (rawPostDate) {
      normalizedDate =
        (rawPostDate.includes('T') ? rawPostDate.split('T')[0] : rawPostDate.substring(0, 10)) ||
        '';
    }
    if (!normalizedDate || !/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
      const rawRecDate = String(record.receiveDate || '');
      if (rawRecDate) {
        normalizedDate =
          (rawRecDate.includes('T') ? rawRecDate.split('T')[0] : rawRecDate.substring(0, 10)) ||
          '';
      }
    }
    if (!normalizedDate || !/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
      normalizedDate = new Date().toISOString().split('T')[0] || '';
    }

    setPostProdDate(normalizedDate);
    setIsPostProdModalOpen(true);
  };

  const handleClosePostProd = () => {
    setIsPostProdModalOpen(false);
    setPostProdRecord(null);
  };

  const handleSavePostProd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!postProdRecord || !onUpdateReceivingRecord) return;

    const dateVal = String(postProdDate || '').trim();
    if (!dateVal || !/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
      alert('กรุณาเลือกวันที่บันทึกให้ถูกต้อง (รูปแบบ YYYY-MM-DD)');
      return;
    }

    const updatedRecord: ReceivingRecord = {
      ...postProdRecord,
      postProductionDefectQty: parseFloat(String(postProdDefectQty)) || 0,
      postProductionRemark: String(postProdRemark || '').trim(),
      postProductionDate: dateVal,
    };

    onUpdateReceivingRecord(updatedRecord);
    handleClosePostProd();
  };

  // Attachment Modal Handlers
  const handleOpenAttachments = (record: ReceivingRecord) => {
    setAttachmentRecord(record);
    setIsAttachmentModalOpen(true);
  };

  const handleCloseAttachments = () => {
    setIsAttachmentModalOpen(false);
    setAttachmentRecord(null);
  };

  const handleSaveAttachments = (
    recordId: string,
    newAttachments: ReceivingAttachmentItem[]
  ) => {
    const target = (receivingRecords || []).find((r) => r.id === recordId);
    if (target && onUpdateReceivingRecord) {
      const updated: ReceivingRecord = { ...target, attachments: newAttachments };
      onUpdateReceivingRecord(updated);
      setAttachmentRecord(updated);
    }
  };

  return (
    <div className="h-full flex-1 flex flex-col min-h-0">
      {/* =========================================================================
          MAIN PAGE: RECEIVING HISTORY & MANAGEMENT DASHBOARD
          ========================================================================= */}
      <div className="flex-1 flex flex-col min-h-0 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {/* Dashboard Action Header */}
        <div className="p-3.5 sm:p-4 border-b border-slate-200/80 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white shrink-0">
          {/* Left Title & Status Counts */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-2xs">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 leading-tight">
                  บันทึกรับเข้าวัตถุดิบ (RM Receiving)
                </h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                  {receivingRecords.length} รายการ
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                ประวัติการตรวจรับวัตถุดิบและผลประเมินตามเกณฑ์ QC Matrix
              </p>
            </div>
          </div>

          {/* Right Action Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Quick Search */}
            <div className="relative w-full sm:w-56 lg:w-64">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหา Bill No, Supplier, RM..."
                className="w-full h-9 pl-9 pr-8 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all placeholder:text-slate-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title="ล้างคำค้นหา"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Status Filter Segmented Control */}
            <div className="flex items-center p-0.5 bg-slate-100/90 rounded-lg border border-slate-200 text-xs font-medium self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1.5 rounded-md transition-all cursor-pointer whitespace-nowrap text-xs font-medium ${
                  statusFilter === 'ALL'
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ทั้งหมด ({statusCounts.all})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('PASS')}
                className={`px-3 py-1.5 rounded-md transition-all cursor-pointer whitespace-nowrap text-xs font-medium ${
                  statusFilter === 'PASS'
                    ? 'bg-emerald-600 text-white shadow-2xs font-semibold'
                    : 'text-emerald-700 hover:bg-white/60'
                }`}
              >
                PASS ({statusCounts.pass})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('FAIL')}
                className={`px-3 py-1.5 rounded-md transition-all cursor-pointer whitespace-nowrap text-xs font-medium ${
                  statusFilter === 'FAIL'
                    ? 'bg-rose-600 text-white shadow-2xs font-semibold'
                    : 'text-rose-700 hover:bg-white/60'
                }`}
              >
                FAIL ({statusCounts.fail})
              </button>
            </div>

            {/* Primary CTA: Open Bill Creation Slide-over Drawer */}
            <button
              type="button"
              onClick={() => setIsDrawerOpen(true)}
              className="h-9 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-semibold text-xs rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>+ บันทึกรับเข้าใหม่ (New RM Bill)</span>
            </button>
          </div>
        </div>

        {/* History Data Table */}
        <div className="flex-1 overflow-x-auto overflow-y-auto min-h-0 custom-scrollbar relative">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 shadow-2xs">
              <tr className="text-slate-700 uppercase text-[11px] tracking-wider font-semibold">
                {renderSortHeader('วันที่รับ', 'receiveDate')}
                {renderSortHeader('Bill No', 'billNo')}
                {renderSortHeader('Supplier', 'supplierName')}
                {renderSortHeader('วัตถุดิบ (RM)', 'rmName')}
                {renderSortHeader('รับเข้า', 'receiveQty', 'right')}
                {renderSortHeader('ราคา/หน่วย', 'unitPrice', 'right')}
                {renderSortHeader('มูลค่ารวม', 'totalAmount', 'right')}
                {renderSortHeader('สุ่มตรวจ', 'sampleQty', 'right')}
                {renderSortHeader('Defect', 'defectQty', 'right')}
                {renderSortHeader('% Defect', 'defectPercent', 'right')}
                {renderSortHeader('ผลประเมิน', 'isPass', 'center')}
                {renderSortHeader('หลังผลิต', 'postProductionDefectQty', 'center')}
                <th className="py-3 px-3 text-center w-28 text-slate-700 font-semibold">
                  จัดการ
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-normal text-slate-700 bg-white">
              {sortedHistory.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-16 text-center text-slate-400">
                    <Filter className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-semibold text-slate-700">ไม่พบข้อมูลการรับเข้าวัตถุดิบ</p>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      {searchQuery || statusFilter !== 'ALL'
                        ? 'ลองปรับเปลี่ยนคำค้นหาหรือตัวกรองสถานะ QC เพื่อดูรายการอื่น'
                        : 'กดปุ่ม "+ บันทึกรับเข้าใหม่" ด้านบนเพื่อเริ่มบันทึกบิลรับเข้าแรก'}
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedHistory.map((rec) => (
                  <tr
                    key={rec.id}
                    className="hover:bg-slate-50/90 transition-colors border-b border-slate-100 text-xs group"
                  >
                    {/* Date */}
                    <td className="py-3 px-3 whitespace-nowrap text-slate-600 font-mono">
                      {rec.receiveDate ? rec.receiveDate.split('T')[0] : '-'}
                    </td>

                    {/* Bill No */}
                    <td className="py-3 px-3 whitespace-nowrap font-semibold text-slate-900 font-mono">
                      {rec.billNo}
                    </td>

                    {/* Supplier */}
                    <td className="py-3 px-3 whitespace-nowrap text-slate-800 font-medium">
                      {rec.supplierName}
                    </td>

                    {/* RM Name & Category */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-900">{rec.rmName}</span>
                        <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                          {rec.rmCategory}
                        </span>
                      </div>
                    </td>

                    {/* Receive Qty */}
                    <td className="py-3 px-3 whitespace-nowrap text-right font-semibold text-slate-900 font-mono">
                      {rec.receiveQty.toLocaleString()} kg
                    </td>

                    {/* Unit Price */}
                    <td className="py-3 px-3 whitespace-nowrap text-right text-slate-600 font-mono">
                      {rec.unitPrice !== undefined ? `${rec.unitPrice.toLocaleString()} ฿` : '-'}
                    </td>

                    {/* Total Amount */}
                    <td className="py-3 px-3 whitespace-nowrap text-right font-bold text-emerald-700 font-mono">
                      {rec.unitPrice !== undefined
                        ? `${(rec.receiveQty * rec.unitPrice).toLocaleString()} ฿`
                        : '-'}
                    </td>

                    {/* Sample Qty */}
                    <td className="py-3 px-3 whitespace-nowrap text-right text-sky-700 font-mono">
                      {rec.sampleQty} kg
                    </td>

                    {/* Defect Qty */}
                    <td className="py-3 px-3 whitespace-nowrap text-right font-mono text-rose-600">
                      {rec.defectQty} kg
                    </td>

                    {/* Defect % */}
                    <td className="py-3 px-3 whitespace-nowrap text-right font-mono font-medium">
                      {rec.defectPercent}%
                    </td>

                    {/* QC Status */}
                    <td className="py-3 px-3 whitespace-nowrap text-center">
                      {rec.isPass ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          PASS
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold">
                          <XCircle className="w-3.5 h-3.5 text-rose-600" />
                          FAIL
                        </span>
                      )}
                    </td>

                    {/* Post-Production Defect */}
                    <td className="py-3 px-3 whitespace-nowrap text-center">
                      {rec.postProductionDefectQty !== undefined ? (
                        <span className="text-xs font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-100">
                          {rec.postProductionDefectQty} kg
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                          รอบันทึก
                        </span>
                      )}
                    </td>

                    {/* Actions Toolbar */}
                    <td className="py-3 px-3 whitespace-nowrap text-center">
                      <div className="flex items-center justify-end gap-1">
                        {/* Attachments */}
                        <button
                          type="button"
                          onClick={() => handleOpenAttachments(rec)}
                          className={`relative inline-flex items-center justify-center p-1.5 rounded-md transition-colors cursor-pointer ${
                            rec.attachments && rec.attachments.length > 0
                              ? 'bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200'
                              : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                          }`}
                          title={
                            rec.attachments && rec.attachments.length > 0
                              ? `จัดการรูปภาพแนบ (${rec.attachments.length} รูป)`
                              : 'แนบรูปภาพ / เอกสาร'
                          }
                        >
                          <ImageIcon className="w-3.5 h-3.5" />
                          {rec.attachments && rec.attachments.length > 0 && (
                            <span className="absolute -top-1 -right-1 min-w-[13px] h-[13px] px-0.5 rounded-full bg-sky-600 text-white text-[8px] font-bold flex items-center justify-center border border-white">
                              {rec.attachments.length}
                            </span>
                          )}
                        </button>

                        {/* Post-Production Defect */}
                        <button
                          type="button"
                          onClick={() => handleOpenPostProd(rec)}
                          className="inline-flex items-center justify-center p-1.5 rounded-md text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                          title="บันทึกของเสียหลังการผลิต"
                        >
                          <Factory className="w-3.5 h-3.5" />
                        </button>

                        {/* Edit History */}
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(rec)}
                          className="inline-flex items-center justify-center p-1.5 rounded-md text-slate-400 hover:text-sky-700 hover:bg-sky-50 transition-colors cursor-pointer"
                          title="แก้ไขรายการ"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete History */}
                        <button
                          type="button"
                          onClick={() => handleOpenDelete(rec)}
                          className="inline-flex items-center justify-center p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="ลบรายการ"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Issue Log Trigger for FAIL records */}
                        {!rec.isPass && (
                          !rec.hasIssueLog ? (
                            <button
                              type="button"
                              onClick={() =>
                                onOpenIssueLogModal({
                                  receivingRecordId: rec.id,
                                  supplierId: rec.supplierId,
                                  supplierName: rec.supplierName,
                                  rmId: rec.rmId,
                                  rmName: rec.rmName,
                                  billNo: rec.billNo,
                                  issueDate: rec.receiveDate,
                                  problemQty: rec.defectQty > 0 ? rec.defectQty : rec.receiveQty,
                                })
                              }
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-medium transition-all shadow-2xs cursor-pointer ml-1"
                              title="เปิดบันทึกปัญหาวัตถุดิบ (Issue Log)"
                            >
                              <AlertTriangle className="w-3 h-3" />
                              <span>Issue Log</span>
                            </button>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-medium ml-1"
                              title="มี Issue Log ในระบบแล้ว"
                            >
                              <CheckCircle2 className="w-3 h-3 text-amber-500" />
                              <span>มี Log</span>
                            </span>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Pagination Sticky / Anchored to Bottom */}
        <div className="mt-auto shrink-0">
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={sortedHistory.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            itemUnitLabel="รายการรับเข้า"
          />
        </div>
      </div>

      {/* =========================================================================
          SLIDE-OVER DRAWER: NEW RM BILL CREATION
          ========================================================================= */}
      <RMReceivingDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        suppliers={suppliers}
        rmItems={rmItems}
        defectMatrix={defectMatrix}
        onSubmitBatch={(records) => {
          if (onAddReceivingRecordsBatch) {
            onAddReceivingRecordsBatch(records);
          } else {
            records.forEach((r) => onAddReceivingRecord(r));
          }
        }}
        onSubmitSingle={onAddReceivingRecord}
      />

      {/* =========================================================================
          MODALS: EDIT RECORD MODAL
          ========================================================================= */}
      {isEditModalOpen && editingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={handleCloseEdit}
          />

          <div className="relative bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="bg-slate-50 border-b border-slate-200 px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-sky-100 flex items-center justify-center text-sky-600">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">แก้ไขข้อมูลรับเข้า</h3>
                  <p className="text-xs text-slate-500">แก้ไขรายการที่บันทึกไว้ในประวัติ</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseEdit}
                className="w-7 h-7 rounded-lg hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4">
              {/* Context Summary */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                <div>
                  <span className="block text-slate-400 font-medium">Supplier</span>
                  <span className="font-semibold text-slate-800 mt-0.5 block truncate">
                    {editingRecord.supplierName}
                  </span>
                </div>
                <div>
                  <span className="block text-slate-400 font-medium">วัตถุดิบ (RM)</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="font-semibold text-slate-900 truncate">
                      {editingRecord.rmName}
                    </span>
                    <span className="text-[10px] font-medium text-slate-500 bg-slate-200 px-1 py-0.2 rounded">
                      {editingRecord.rmCategory}
                    </span>
                  </div>
                </div>
              </div>

              <form id="editForm" onSubmit={handleSaveEdit} className="space-y-3.5" noValidate>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      เลขที่บิล (Bill No) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editBillNo}
                      onChange={(e) => setEditBillNo(e.target.value)}
                      className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      วันที่รับเข้า <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={editReceiveDate}
                      onChange={(e) => setEditReceiveDate(e.target.value)}
                      className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      รับเข้า (kg) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={editReceiveQty}
                      onChange={(e) => setEditReceiveQty(e.target.value)}
                      className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-right"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      ราคา/หน่วย
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editUnitPrice}
                      onChange={(e) => setEditUnitPrice(e.target.value)}
                      placeholder="ไม่บังคับ"
                      className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-right"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Defect (kg)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editDefectQty}
                      onChange={(e) => setEditDefectQty(e.target.value)}
                      className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-right"
                    />
                  </div>
                </div>

                {/* Live Recalculation */}
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                  <div className="flex gap-4">
                    <div>
                      <span className="text-slate-400 block font-medium">สุ่มตรวจ</span>
                      <span className="font-semibold text-sky-700">
                        {editEvaluationResult.sampleQty} kg
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-medium">% Defect</span>
                      <span
                        className={`font-semibold ${
                          editEvaluationResult.defectPercent > 0
                            ? 'text-rose-600'
                            : 'text-slate-700'
                        }`}
                      >
                        {editEvaluationResult.defectPercent}%
                      </span>
                    </div>
                  </div>
                  {editEvaluationResult.isPass ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> PASS (ผ่าน)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 text-xs font-medium">
                      <XCircle className="w-3.5 h-3.5 text-rose-600" /> FAIL (ไม่ผ่าน)
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    หมายเหตุ (Remark)
                  </label>
                  <textarea
                    value={editRemark}
                    onChange={(e) => setEditRemark(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 resize-none"
                    placeholder="บันทึกเพิ่มเติม..."
                  />
                </div>
              </form>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={handleCloseEdit}
                className="h-8.5 px-3.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 font-medium text-xs rounded-lg transition-all cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                form="editForm"
                className="h-8.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-lg shadow-xs transition-all cursor-pointer"
              >
                บันทึกการแก้ไข
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODALS: DELETE CONFIRMATION MODAL
          ========================================================================= */}
      {isDeleteModalOpen && recordToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => setIsDeleteModalOpen(false)}
          />
          <div className="relative bg-white rounded-xl w-full max-w-sm shadow-xl p-5 border border-slate-200 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">ยืนยันการลบรายการรับเข้า?</h3>
              <p className="text-xs text-slate-500 mt-1">
                คุณต้องการลบรายการ <strong className="text-slate-700">{recordToDelete.rmName}</strong> (บิล:{' '}
                {recordToDelete.billNo}) ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้
              </p>
            </div>
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="flex-1 h-9 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium text-xs rounded-lg transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="flex-1 h-9 bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs rounded-lg shadow-xs transition-all cursor-pointer"
              >
                ใช่, ลบรายการ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODALS: POST-PRODUCTION DEFECT MODAL
          ========================================================================= */}
      {isPostProdModalOpen && postProdRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={handleClosePostProd}
          />
          <div className="relative bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="bg-emerald-50 border-b border-emerald-200 px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">
                  <Factory className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-emerald-900">บันทึกหลังการผลิต</h3>
                  <p className="text-xs text-emerald-700">ระบุจำนวนของเสียจริงที่พบหลังการผลิต</p>
                </div>
              </div>
              <button
                onClick={handleClosePostProd}
                className="w-7 h-7 rounded-lg hover:bg-emerald-100 flex items-center justify-center text-emerald-700 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                <div>
                  <span className="text-slate-400 font-medium block">วัตถุดิบ</span>
                  <span className="font-semibold text-slate-800 mt-0.5 block truncate">
                    {postProdRecord.rmName}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block">จำนวนรับเข้า</span>
                  <span className="font-semibold text-slate-800 mt-0.5 block">
                    {postProdRecord.receiveQty.toLocaleString()} kg
                  </span>
                </div>
              </div>

              <form id="postProdForm" onSubmit={handleSavePostProd} className="space-y-3.5" noValidate>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                    วันที่บันทึก <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={postProdDate}
                    onChange={(e) => setPostProdDate(e.target.value)}
                    className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                    จำนวนของเสียจริงที่พบ (kg) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={postProdDefectQty}
                    onChange={(e) => setPostProdDefectQty(e.target.value)}
                    required
                    placeholder="เช่น 10.5"
                    className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-right"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    หมายเหตุหลังการผลิต
                  </label>
                  <textarea
                    value={postProdRemark}
                    onChange={(e) => setPostProdRemark(e.target.value)}
                    rows={2}
                    placeholder="ระบุสาเหตุหรือข้อสังเกตเพิ่มเติม..."
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 resize-none"
                  />
                </div>
              </form>
            </div>

            <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={handleClosePostProd}
                className="h-8.5 px-3.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 font-medium text-xs rounded-lg transition-all cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                form="postProdForm"
                className="h-8.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-lg shadow-xs transition-all cursor-pointer"
              >
                บันทึกหลังผลิต
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODALS: ATTACHMENT MODAL
          ========================================================================= */}
      <RMReceivingAttachmentModal
        record={attachmentRecord}
        isOpen={isAttachmentModalOpen}
        onClose={handleCloseAttachments}
        onSaveAttachments={handleSaveAttachments}
      />
    </div>
  );
};
