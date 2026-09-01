import React, { useState, useMemo, useEffect } from 'react';
import {
  PackageCheck,
  CheckCircle2,
  XCircle,
  Plus,
  AlertTriangle,
  Calendar,
  Scale,
  Percent,
  Pencil,
  X,
  Trash2,
  Factory,
  FileText,
  Leaf,
  Check,
  RotateCcw,
  Receipt,
  Boxes,
  Info,
} from 'lucide-react';
import { AutocompleteSelect, SelectOption } from '@/components/ui/AutocompleteSelect';
import {
  calculateDefectResult,
  ReceivingRecord,
  RMItem,
  Supplier,
  DefectRule,
} from '@/services/DefectMatrixService';
import { motion, AnimatePresence } from 'motion/react';

interface RMReceivingDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  suppliers?: Supplier[];
  rmItems?: RMItem[];
  defectMatrix?: Record<string, DefectRule[]>;
  onSubmitBatch: (records: ReceivingRecord[]) => void;
  onSubmitSingle?: (record: ReceivingRecord) => void;
}

export const RMReceivingDrawer: React.FC<RMReceivingDrawerProps> = ({
  isOpen,
  onClose,
  suppliers = [],
  rmItems = [],
  defectMatrix = {},
  onSubmitBatch,
  onSubmitSingle,
}) => {
  // Master Form State (Persisted across items in the same bill)
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [billNo, setBillNo] = useState<string>('');
  const [receiveDate, setReceiveDate] = useState<string>(
    () => new Date().toISOString().split('T')[0] || ''
  );

  // Detail Form State (Reset on item add)
  const [selectedRmId, setSelectedRmId] = useState<string>('');
  const [receiveQty, setReceiveQty] = useState<string>('');
  const [defectQty, setDefectQty] = useState<string>('');
  const [unitPrice, setUnitPrice] = useState<string>('');
  const [remark, setRemark] = useState<string>('');

  // Editing state for an item in the pending draft
  const [editingPendingId, setEditingPendingId] = useState<string | null>(null);

  // Pending Items State (Batch Receiving for current bill)
  const [pendingItems, setPendingItems] = useState<ReceivingRecord[]>([]);

  // Close confirmation if draft items exist
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);

  // Keyboard shortcut: ESC to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleRequestClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, pendingItems.length]);

  // Filtered RMs based on selected Supplier
  const availableRMs = useMemo(() => {
    const items = rmItems || [];
    if (!selectedSupplierId) return items;
    return items.filter(
      (item) =>
        item.supplierId === selectedSupplierId ||
        (item.supplierIds && item.supplierIds.includes(selectedSupplierId))
    );
  }, [selectedSupplierId, rmItems]);

  // Autocomplete Select Options
  const supplierOptions: SelectOption[] = useMemo(
    () =>
      (suppliers || []).map((s) => ({
        value: s.id,
        label: s.name,
        badge: s.code,
      })),
    [suppliers]
  );

  const rmOptions: SelectOption[] = useMemo(
    () =>
      availableRMs.map((rm) => ({
        value: rm.id,
        label: rm.name,
        subtitle: rm.categoryLabel || rm.category,
        badge: rm.category,
      })),
    [availableRMs]
  );

  // Selected RM Object
  const selectedRM = useMemo<RMItem | undefined>(() => {
    return (rmItems || []).find((item) => item.id === selectedRmId);
  }, [selectedRmId, rmItems]);

  // Live Auto-Calculate Defect Matrix Result
  const numReceiveQty = parseFloat(receiveQty) || 0;
  const numDefectQty = selectedRM?.category === 'Type 3' ? 0 : parseFloat(defectQty) || 0;
  const numUnitPrice = parseFloat(unitPrice) || 0;

  const hasMatrixRules = useMemo(() => {
    if (!selectedRM) return true;
    if (selectedRM.category === 'Type 3') return true;
    const rules = (defectMatrix || {})[selectedRM.category];
    return rules && rules.length > 0;
  }, [selectedRM, defectMatrix]);

  const evaluationResult = useMemo(() => {
    if (!selectedRM || numReceiveQty <= 0) {
      return {
        sampleQty: 0,
        acceptMaxDefectQty: 0,
        defectPercent: 0,
        isPass: true,
      };
    }
    return calculateDefectResult(selectedRM.category, numReceiveQty, numDefectQty, defectMatrix || {});
  }, [selectedRM, numReceiveQty, numDefectQty, defectMatrix]);

  // Reset detail item form only
  const resetItemForm = () => {
    setSelectedRmId('');
    setReceiveQty('');
    setDefectQty('');
    setUnitPrice('');
    setRemark('');
    setEditingPendingId(null);
  };

  // Reset entire drawer state
  const resetAll = () => {
    setSelectedSupplierId('');
    setBillNo('');
    setReceiveDate(new Date().toISOString().split('T')[0] || '');
    resetItemForm();
    setPendingItems([]);
    setShowExitConfirm(false);
  };

  const handleRequestClose = () => {
    if (pendingItems.length > 0) {
      setShowExitConfirm(true);
    } else {
      resetAll();
      onClose();
    }
  };

  const handleConfirmExit = () => {
    resetAll();
    onClose();
  };

  // Add or Update item in pending list
  const handleAddPendingItem = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedSupplierId) {
      alert('กรุณาเลือกผู้ส่งมอบ (Supplier)');
      return;
    }
    if (!billNo.trim()) {
      alert('กรุณากรอกเลขที่บิล (Bill No)');
      return;
    }
    if (!receiveDate) {
      alert('กรุณาเลือกวันที่รับเข้า');
      return;
    }
    if (!selectedRmId) {
      alert('กรุณาเลือกวัตถุดิบ (RM)');
      return;
    }
    if (numReceiveQty <= 0) {
      alert('กรุณาระบุจำนวนรับเข้า (kg) ให้ถูกต้อง');
      return;
    }

    if (!hasMatrixRules) {
      alert('ไม่สามารถบันทึกได้ เนื่องจากไม่มีเกณฑ์การสุ่มตรวจ (QC Matrix) สำหรับหมวดหมู่วัตถุดิบนี้');
      return;
    }

    const supplierObj = (suppliers || []).find((s) => s.id === selectedSupplierId);
    if (!supplierObj || !selectedRM) return;

    if (editingPendingId) {
      // Update existing item in pendingItems
      setPendingItems((prev) =>
        prev.map((item) => {
          if (item.id === editingPendingId) {
            return {
              ...item,
              rmId: selectedRM.id,
              rmName: selectedRM.name,
              rmCategory: selectedRM.category,
              receiveQty: numReceiveQty,
              sampleQty: evaluationResult.sampleQty,
              defectQty: numDefectQty,
              defectPercent: evaluationResult.defectPercent,
              isPass: evaluationResult.isPass,
              unitPrice: unitPrice.trim() ? numUnitPrice : undefined,
              remark: remark.trim(),
            };
          }
          return item;
        })
      );
      setEditingPendingId(null);
    } else {
      // Add new item
      const newRecord: ReceivingRecord = {
        id: `REC-${Date.now().toString().slice(-8)}-${Math.floor(Math.random() * 1000)}`,
        billNo: billNo.trim(),
        receiveDate,
        supplierId: supplierObj.id,
        supplierName: supplierObj.name,
        rmId: selectedRM.id,
        rmName: selectedRM.name,
        rmCategory: selectedRM.category,
        receiveQty: numReceiveQty,
        sampleQty: evaluationResult.sampleQty,
        defectQty: numDefectQty,
        defectPercent: evaluationResult.defectPercent,
        isPass: evaluationResult.isPass,
        unitPrice: unitPrice.trim() ? numUnitPrice : undefined,
        remark: remark.trim(),
        createdAt: new Date().toISOString(),
        hasIssueLog: false,
      };
      setPendingItems((prev) => [...prev, newRecord]);
    }

    // Reset item inputs
    setSelectedRmId('');
    setReceiveQty('');
    setDefectQty('');
    setUnitPrice('');
    setRemark('');
  };

  const handleEditPendingItem = (item: ReceivingRecord) => {
    setEditingPendingId(item.id);
    setSelectedRmId(item.rmId);
    setReceiveQty(String(item.receiveQty));
    setDefectQty(String(item.defectQty));
    setUnitPrice(item.unitPrice !== undefined ? String(item.unitPrice) : '');
    setRemark(item.remark || '');
  };

  const handleRemovePendingItem = (id: string) => {
    if (editingPendingId === id) {
      resetItemForm();
    }
    setPendingItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSubmitBill = () => {
    if (pendingItems.length === 0) return;

    if (onSubmitBatch) {
      onSubmitBatch(pendingItems);
    } else if (onSubmitSingle) {
      pendingItems.forEach((item) => onSubmitSingle(item));
    }

    resetAll();
    onClose();
  };

  // Pending bill totals calculation
  const pendingSummary = useMemo(() => {
    const totalQty = pendingItems.reduce((sum, item) => sum + item.receiveQty, 0);
    const totalAmount = pendingItems.reduce(
      (sum, item) => sum + (item.unitPrice ? item.receiveQty * item.unitPrice : 0),
      0
    );
    const passCount = pendingItems.filter((i) => i.isPass).length;
    const failCount = pendingItems.filter((i) => !i.isPass).length;
    return { totalQty, totalAmount, passCount, failCount };
  }, [pendingItems]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs cursor-pointer"
            onClick={handleRequestClose}
          />

          {/* Slide-over Drawer Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-[680px] bg-white h-full shadow-2xl flex flex-col z-10 border-l border-slate-200"
          >
            {/* Drawer Header */}
            <div className="px-5 py-4 bg-white border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-2xs">
                  <PackageCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 leading-tight">
                    สร้างใบบันทึกรับเข้าวัตถุดิบ
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    กรอกข้อมูลผู้ส่งมอบและเพิ่มรายการวัตถุดิบเพื่อตรวจรับตามเกณฑ์ QC
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleRequestClose}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
                title="ปิด (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Drawer Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4 bg-slate-50/40">
              {/* SECTION 1: MASTER INFO CARD */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider">
                    <Receipt className="w-4 h-4 text-emerald-600" />
                    <span>1. ข้อมูลหลักของบิล (Master Header)</span>
                  </div>
                  <span className="text-[11px] text-slate-400">ใช้ร่วมกันทุกรายการในบิลนี้</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Supplier */}
                  <div className="sm:col-span-1">
                    <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                      <Factory className="w-3.5 h-3.5 text-slate-400" />
                      ผู้ส่งมอบ <span className="text-rose-500">*</span>
                    </label>
                    <AutocompleteSelect
                      options={supplierOptions}
                      value={selectedSupplierId}
                      onChange={(val) => {
                        setSelectedSupplierId(val);
                        setSelectedRmId('');
                      }}
                      placeholder="เลือกผู้ส่งมอบ"
                      searchPlaceholder="ค้นหารหัส/ชื่อ..."
                      required
                    />
                  </div>

                  {/* Bill No */}
                  <div className="sm:col-span-1">
                    <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5 text-slate-400" />
                      เลขที่บิล <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={billNo}
                      onChange={(e) => setBillNo(e.target.value)}
                      placeholder="เช่น BILL-2026-001"
                      required
                      className="w-full h-[38px] px-3 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all placeholder:text-slate-400"
                    />
                  </div>

                  {/* Receive Date */}
                  <div className="sm:col-span-1">
                    <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      วันที่รับเข้า <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={receiveDate}
                      onChange={(e) => setReceiveDate(e.target.value)}
                      required
                      className="w-full h-[38px] px-3 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: ADD / EDIT LINE ITEM FORM */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider">
                    <Boxes className="w-4 h-4 text-emerald-600" />
                    <span>
                      2. {editingPendingId ? 'แก้ไขรายการวัตถุดิบ' : 'เพิ่มรายการวัตถุดิบ (Add Item)'}
                    </span>
                  </div>

                  {editingPendingId && (
                    <button
                      type="button"
                      onClick={resetItemForm}
                      className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>ยกเลิกแก้ไข</span>
                    </button>
                  )}
                </div>

                <form onSubmit={handleAddPendingItem} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                    {/* RM Select (sm:col-span-12) */}
                    <div className="sm:col-span-12 relative">
                      <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                        <Leaf className="w-3.5 h-3.5 text-emerald-600" />
                        วัตถุดิบ (RM) <span className="text-rose-500">*</span>
                      </label>
                      <AutocompleteSelect
                        options={rmOptions}
                        value={selectedRmId}
                        onChange={setSelectedRmId}
                        disabled={!selectedSupplierId}
                        placeholder={
                          selectedSupplierId ? '-- เลือกวัตถุดิบ --' : 'กรุณาเลือกผู้ส่งมอบก่อน'
                        }
                        searchPlaceholder="พิมพ์ชื่อวัตถุดิบ..."
                        required
                      />

                      {!hasMatrixRules && selectedRM && (
                        <div className="mt-1.5 p-2 rounded-lg bg-amber-50 border border-amber-200 shadow-xs flex items-center gap-2 text-xs text-amber-800">
                          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                          <span>ยังไม่มีเกณฑ์ QC Matrix สำหรับหมวดหมู่นี้</span>
                        </div>
                      )}
                    </div>

                    {/* Receive Qty (sm:col-span-4) */}
                    <div className="sm:col-span-4">
                      <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                        <Scale className="w-3.5 h-3.5 text-slate-400" />
                        รับเข้า (kg) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={receiveQty}
                        onChange={(e) => setReceiveQty(e.target.value)}
                        placeholder="เช่น 200"
                        required
                        className="w-full h-[38px] px-3 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all placeholder:text-slate-400 text-right font-mono"
                      />
                    </div>

                    {/* Defect Qty (sm:col-span-4) */}
                    <div className="sm:col-span-4">
                      <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                        <Percent className="w-3.5 h-3.5 text-rose-500" />
                        Defect (kg) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={selectedRM?.category === 'Type 3' ? 0 : defectQty}
                        onChange={(e) => setDefectQty(e.target.value)}
                        placeholder="เช่น 1.5"
                        required={selectedRM?.category !== 'Type 3'}
                        disabled={selectedRM?.category === 'Type 3'}
                        className={`w-full h-[38px] px-3 border rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all text-right font-mono ${
                          selectedRM?.category === 'Type 3'
                            ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                            : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
                        }`}
                      />
                    </div>

                    {/* Unit Price (sm:col-span-4) */}
                    <div className="sm:col-span-4">
                      <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                        <span className="text-slate-400 font-bold text-xs">฿</span>
                        ราคา/หน่วย (บาท)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={unitPrice}
                        onChange={(e) => setUnitPrice(e.target.value)}
                        placeholder="ไม่บังคับ"
                        className="w-full h-[38px] px-3 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all placeholder:text-slate-400 text-right font-mono"
                      />
                    </div>

                    {/* Remark (sm:col-span-8) */}
                    <div className="sm:col-span-8">
                      <input
                        type="text"
                        value={remark}
                        onChange={(e) => setRemark(e.target.value)}
                        placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)..."
                        className="w-full h-[38px] px-3 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all placeholder:text-slate-400"
                      />
                    </div>

                    {/* Add Item Button (sm:col-span-4) */}
                    <div className="sm:col-span-4">
                      <button
                        type="submit"
                        disabled={
                          !hasMatrixRules ||
                          !selectedSupplierId ||
                          !billNo.trim() ||
                          !receiveQty ||
                          !selectedRmId
                        }
                        className="w-full h-[38px] px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-98 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-semibold text-xs rounded-lg shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {editingPendingId ? (
                          <>
                            <Check className="w-4 h-4 stroke-[2.5]" />
                            <span>อัปเดตรายการ</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-4 h-4 stroke-[2.5]" />
                            <span>+ เพิ่มรายการลงบิล</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Live QC Matrix Strip Preview */}
                  <AnimatePresence mode="wait">
                    {selectedRM && numReceiveQty > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: -2 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.15 }}
                        className="pt-1"
                      >
                        {selectedRM.category === 'Type 3' ? (
                          <div className="px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span className="font-semibold text-emerald-950">
                                PASS (บรรจุภัณฑ์ Type 3 ได้รับการยกเว้นการสุ่มตรวจ)
                              </span>
                            </div>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                              Auto Approved
                            </span>
                          </div>
                        ) : evaluationResult.isPass ? (
                          <div className="px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span className="font-bold text-emerald-950">
                                PASS — ผ่านเกณฑ์สุ่มตรวจ
                              </span>
                              <span className="text-emerald-800 text-[11px]">
                                (สุ่มตรวจ {evaluationResult.sampleQty} kg, พบของเสีย {numDefectQty} kg)
                              </span>
                            </div>
                            <div className="flex items-center gap-2 font-mono text-[11px]">
                              <span className="px-2 py-0.5 rounded-full font-semibold bg-emerald-200 text-emerald-900">
                                Defect: {evaluationResult.defectPercent}%
                              </span>
                              <span className="text-emerald-700 font-sans text-[11px]">
                                เกณฑ์ยอมรับ: ≤ {evaluationResult.acceptMaxDefectQty} kg
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="px-3 py-2 rounded-lg bg-rose-50 border border-rose-300 flex flex-wrap items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-1.5">
                              <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                              <span className="font-bold text-rose-950">
                                FAIL — ไม่ผ่านเกณฑ์สุ่มตรวจ!
                              </span>
                              <span className="text-rose-800 text-[11px]">
                                (พบของเสีย {numDefectQty} kg เกินเกณฑ์ยอมรับ {evaluationResult.acceptMaxDefectQty} kg)
                              </span>
                            </div>
                            <div className="flex items-center gap-2 font-mono text-[11px]">
                              <span className="px-2 py-0.5 rounded-full font-bold bg-rose-200 text-rose-900">
                                Defect: {evaluationResult.defectPercent}%
                              </span>
                              <span className="text-rose-700 font-sans text-[11px]">
                                เกณฑ์ยอมรับสูงสุด: ≤ {evaluationResult.acceptMaxDefectQty} kg
                              </span>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </form>
              </div>

              {/* SECTION 3: CURRENT BILL DRAFT LINE-ITEMS */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      3. รายการในบิลปัจจุบัน ({pendingItems.length} รายการ)
                    </h3>
                  </div>

                  {pendingItems.length > 0 && (
                    <div className="text-xs flex items-center gap-2">
                      {pendingSummary.passCount > 0 && (
                        <span className="text-emerald-700 font-medium">
                          ✓ ผ่าน {pendingSummary.passCount}
                        </span>
                      )}
                      {pendingSummary.failCount > 0 && (
                        <span className="text-rose-600 font-bold">
                          ✕ ไม่ผ่าน {pendingSummary.failCount}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {pendingItems.length === 0 ? (
                  /* Compact Empty State */
                  <div className="py-6 px-4 border border-dashed border-slate-200 rounded-lg bg-slate-50/50 flex flex-col items-center justify-center gap-1.5 text-center">
                    <div className="p-2 rounded-full bg-slate-100 text-slate-400">
                      <PackageCheck className="w-4 h-4" />
                    </div>
                    <p className="text-xs font-medium text-slate-600">ยังไม่มีรายการในบิลนี้</p>
                    <p className="text-[11px] text-slate-400">
                      กรอกข้อมูลวัตถุดิบด้านบนแล้วกดปุ่ม <strong className="text-emerald-600 font-semibold">+ เพิ่มรายการลงบิล</strong>
                    </p>
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-2xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-[11px] uppercase tracking-wider">
                            <th className="py-2.5 px-3 w-8 text-center">#</th>
                            <th className="py-2.5 px-3">วัตถุดิบ</th>
                            <th className="py-2.5 px-3 text-right">รับเข้า</th>
                            <th className="py-2.5 px-3 text-right">สุ่มตรวจ</th>
                            <th className="py-2.5 px-3 text-right">Defect</th>
                            <th className="py-2.5 px-3 text-right">ราคา</th>
                            <th className="py-2.5 px-3 text-right">รวมเงิน</th>
                            <th className="py-2.5 px-3 text-center">QC</th>
                            <th className="py-2.5 px-3 text-center w-16">จัดการ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {pendingItems.map((item, idx) => (
                            <tr
                              key={item.id}
                              className={`hover:bg-slate-50/80 transition-colors ${
                                editingPendingId === item.id ? 'bg-emerald-50/40' : ''
                              }`}
                            >
                              <td className="py-2 px-3 text-center font-mono text-slate-400 text-xs">
                                {idx + 1}
                              </td>
                              <td className="py-2 px-3">
                                <div>
                                  <span className="font-semibold text-slate-900">{item.rmName}</span>
                                  <div className="flex items-center gap-1 mt-0.5">
                                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200 font-medium">
                                      {item.rmCategory}
                                    </span>
                                    {item.remark && (
                                      <span className="text-[10px] text-slate-400 truncate max-w-[120px]" title={item.remark}>
                                        • {item.remark}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="py-2 px-3 text-right font-medium text-slate-900 font-mono">
                                {item.receiveQty.toLocaleString()} kg
                              </td>
                              <td className="py-2 px-3 text-right text-slate-600 font-mono">
                                {item.sampleQty} kg
                              </td>
                              <td className="py-2 px-3 text-right font-mono">
                                <span className={item.defectQty > 0 ? 'text-rose-600 font-semibold' : 'text-slate-600'}>
                                  {item.defectQty} ({item.defectPercent}%)
                                </span>
                              </td>
                              <td className="py-2 px-3 text-right text-slate-600 font-mono">
                                {item.unitPrice !== undefined ? `${item.unitPrice.toLocaleString()} ฿` : '-'}
                              </td>
                              <td className="py-2 px-3 text-right font-semibold text-emerald-700 font-mono">
                                {item.unitPrice !== undefined
                                  ? `${(item.receiveQty * item.unitPrice).toLocaleString()} ฿`
                                  : '-'}
                              </td>
                              <td className="py-2 px-3 text-center">
                                {item.isPass ? (
                                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    PASS
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-semibold">
                                    <XCircle className="w-3 h-3 text-rose-600" />
                                    FAIL
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleEditPendingItem(item)}
                                    className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
                                    title="แก้ไขรายการนี้"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemovePendingItem(item.id)}
                                    className="p-1 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                    title="ลบรายการนี้"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Sticky Drawer Footer */}
            <div className="p-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg shrink-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <span className="px-2 py-1 bg-slate-100 rounded-md font-semibold text-slate-800">
                  รวม <strong className="text-emerald-700 font-bold">{pendingItems.length}</strong> รายการ
                </span>
                <span className="px-2 py-1 bg-slate-100 rounded-md font-medium text-slate-800">
                  น้ำหนักรวม: <strong className="font-mono font-bold">{pendingSummary.totalQty.toLocaleString()} kg</strong>
                </span>
                {pendingSummary.totalAmount > 0 && (
                  <span className="px-2 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md font-medium">
                    มูลค่ารวม: <strong className="font-mono font-bold">{pendingSummary.totalAmount.toLocaleString()} ฿</strong>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={handleRequestClose}
                  className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleSubmitBill}
                  disabled={pendingItems.length === 0}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-98 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <PackageCheck className="w-4 h-4" />
                  <span>บันทึกบิลนี้ ({pendingItems.length})</span>
                </button>
              </div>
            </div>

            {/* Discard Changes Prompt Modal if user clicks close while having pending items */}
            {showExitConfirm && (
              <div className="absolute inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl border border-slate-200 p-5 max-w-sm w-full space-y-3 text-center">
                  <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
                    <Info className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">ละทิ้งข้อมูลที่ยังไม่บันทึก?</h4>
                  <p className="text-xs text-slate-500">
                    คุณมีรายการที่เพิ่มไว้ <strong className="text-slate-800">{pendingItems.length} รายการ</strong> หากปิดหน้านี้ ข้อมูลฉบับร่างจะหายไป
                  </p>
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowExitConfirm(false)}
                      className="flex-1 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                    >
                      แก้ไขต่อ
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmExit}
                      className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                    >
                      ละทิ้งและปิด
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
