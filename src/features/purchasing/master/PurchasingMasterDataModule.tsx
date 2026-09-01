import React, { useState, useMemo } from 'react';
import {
  Building2,
  Layers,
  Sliders,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  X,
  Search,
  Phone,
  Mail,
  MapPin,
  User,
  Tag,
  Package,
  Combine,
  Sparkles,
  AlertTriangle,
  Save,
} from 'lucide-react';
import { TablePagination } from '@/components/ui/TablePagination';
import { AutocompleteSelect, SelectOption } from '@/components/ui/AutocompleteSelect';
import { MultiAutocompleteSelect } from '@/components/ui/MultiAutocompleteSelect';
import {
  Supplier,
  RMItem,
  DefectRule,
  DefectCategoryItem,
  ReceivingRecord,
  IssueLogRecord,
  formatPhoneNumber,
} from '@/services/DefectMatrixService';

interface PurchasingMasterDataModuleProps {
  suppliers: Supplier[];
  onAddSupplier: (supplier: Supplier) => void;
  onUpdateSupplier: (supplier: Supplier) => void;
  onDeleteSupplier: (id: string) => void;

  rmItems: RMItem[];
  onAddRMItem: (rm: RMItem) => void;
  onUpdateRMItem: (rm: RMItem) => void;
  onDeleteRMItem: (id: string) => void;

  receivingRecords?: ReceivingRecord[];
  issueLogs?: IssueLogRecord[];
  onMergeRMItems?: (targetRM: RMItem, mergedRmIds: string[]) => void;

  defectMatrix: Record<string, DefectRule[]>;
  onUpdateDefectMatrix: (matrix: Record<string, DefectRule[]>) => void;

  defectCategories?: DefectCategoryItem[];
  onSaveDefectCategory?: (category: DefectCategoryItem) => void;
  onDeleteDefectCategory?: (id: string) => void;
}

export const PurchasingMasterDataModule: React.FC<PurchasingMasterDataModuleProps> = ({
  suppliers = [],
  onAddSupplier,
  onUpdateSupplier,
  onDeleteSupplier,
  rmItems = [],
  onAddRMItem,
  onUpdateRMItem,
  onDeleteRMItem,
  receivingRecords: _receivingRecords = [],
  issueLogs: _issueLogs = [],
  onMergeRMItems,
  defectMatrix = {},
  onUpdateDefectMatrix,
  defectCategories = [],
  onSaveDefectCategory,
  onDeleteDefectCategory,
}) => {
  // Sub-tab state
  const [activeSubTab, setActiveSubTab] = useState<'suppliers' | 'rms' | 'matrix' | 'defectCats'>('suppliers');

  // Search filter
  const [searchQuery, setSearchQuery] = useState<string>('');

  // --- DYNAMIC CATEGORIES ---
  const dynamicCategories = useMemo(() => {
    const cats: Record<string, string> = {
      'Type 1': 'พืชเกษตร ยกเว้นผักใบ (Type 1)',
      'Type 2': 'ผักใบ (Type 2)',
      'Type 3': 'สำเร็จรูป (Type 3)',
      'Type 4': 'ประมง (Type 4)',
    };
    (rmItems || []).forEach((rm) => {
      if (rm.category && rm.categoryLabel) {
        cats[rm.category] = rm.categoryLabel;
      }
    });
    return cats;
  }, [rmItems]);

  const categoryOptions: SelectOption[] = useMemo(() => {
    return Object.entries(dynamicCategories).map(([key, label]) => ({
      value: key,
      label: label,
    }));
  }, [dynamicCategories]);

  // Autocomplete Select Options for Suppliers
  const supplierSelectOptions: SelectOption[] = useMemo(
    () =>
      (suppliers || []).map((s) => ({
        value: s.id,
        label: s.name,
        subtitle: `รหัส: ${s.code || s.id} • ${s.contactPerson || s.phone || 'ไม่มีเบอร์'}`,
      })),
    [suppliers]
  );

  // Defect Category States
  const [isCatModalOpen, setIsCatModalOpen] = useState<boolean>(false);
  const [editingCat, setEditingCat] = useState<DefectCategoryItem | null>(null);
  const [catName, setCatName] = useState<string>('');
  const [catDesc, setCatDesc] = useState<string>('');
  const [catIsActive, setCatIsActive] = useState<boolean>(true);

  const filteredDefectCats = useMemo(() => {
    if (!searchQuery.trim()) return defectCategories;
    const q = searchQuery.toLowerCase();
    return defectCategories.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q)
    );
  }, [defectCategories, searchQuery]);

  const handleOpenAddCat = () => {
    setEditingCat(null);
    setCatName('');
    setCatDesc('');
    setCatIsActive(true);
    setIsCatModalOpen(true);
  };

  const handleOpenEditCat = (cat: DefectCategoryItem) => {
    setEditingCat(cat);
    setCatName(cat.name);
    setCatDesc(cat.description || '');
    setCatIsActive(cat.isActive !== false);
    setIsCatModalOpen(true);
  };

  const handleToggleCatActive = (cat: DefectCategoryItem) => {
    if (onSaveDefectCategory) {
      onSaveDefectCategory({
        ...cat,
        isActive: cat.isActive === false ? true : false,
      });
    }
  };

  const handleSaveCatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) {
      alert('กรุณาระบุชื่อหมวดหมู่ปัญหา');
      return;
    }
    const newCat: DefectCategoryItem = {
      id: editingCat ? editingCat.id : `DEF-${Date.now().toString().slice(-4)}`,
      name: catName.trim(),
      description: catDesc.trim(),
      isActive: catIsActive,
    };
    if (onSaveDefectCategory) {
      onSaveDefectCategory(newCat);
    }
    setIsCatModalOpen(false);
  };

  // Category Metadata for QC Matrix
  const categoryMeta: Record<string, { icon: string; shortTitle: string; subtext: string; themeColor: string }> = {
    'Type 1': {
      icon: '🌾',
      shortTitle: 'พืชเกษตร (Type 1)',
      subtext: 'ยกเว้นผักใบ เช่น ข่า, มะพร้าว ฯลฯ',
      themeColor: 'emerald',
    },
    'Type 2': {
      icon: '🥬',
      shortTitle: 'ผักใบ (Type 2)',
      subtext: 'สมุนไพรสด เช่น ใบตอง, ใบมะกรูด ฯลฯ',
      themeColor: 'lime',
    },
    'Type 3': {
      icon: '🍱',
      shortTitle: 'สำเร็จรูป (Type 3)',
      subtext: 'วัตถุดิบสำเร็จรูป / สินค้าแปรรูป',
      themeColor: 'amber',
    },
    'Type 4': {
      icon: '🐟',
      shortTitle: 'ประมง (Type 4)',
      subtext: 'อาหารทะเล เช่น ปลาทู, กุ้ง ฯลฯ',
      themeColor: 'cyan',
    },
  };

  // -----------------------------------------------------------------
  // 1. SUPPLIER MANAGEMENT MODALS & STATE
  // -----------------------------------------------------------------
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState<boolean>(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supCode, setSupCode] = useState<string>('');
  const [supName, setSupName] = useState<string>('');
  const [supPhone, setSupPhone] = useState<string>('');
  const [supEmail, setSupEmail] = useState<string>('');
  const [supAddress, setSupAddress] = useState<string>('');
  const [supContact, setSupContact] = useState<string>('');

  const handleOpenAddSupplier = () => {
    setEditingSupplier(null);
    const nextNum = (suppliers.length + 1).toString().padStart(2, '0');
    setSupCode(nextNum);
    setSupName('');
    setSupPhone('');
    setSupEmail('');
    setSupAddress('');
    setSupContact('');
    setIsSupplierModalOpen(true);
  };

  const handleOpenEditSupplier = (sup: Supplier) => {
    setEditingSupplier(sup);
    setSupCode(sup.code);
    setSupName(sup.name);
    setSupPhone(sup.phone || '');
    setSupEmail(sup.email || '');
    setSupAddress(sup.address || '');
    setSupContact(sup.contactPerson || '');
    setIsSupplierModalOpen(true);
  };

  const handleSaveSupplier = (e?: React.FormEvent | React.MouseEvent) => {
    try {
      if (e) {
        e.preventDefault();
      }
      const codeStr = String(supCode || '').trim();
      const nameStr = String(supName || '').trim();
      const contactStr = String(supContact || '').trim();
      const emailStr = String(supEmail || '').trim();
      const addressStr = String(supAddress || '').trim();

      if (!codeStr) {
        alert('กรุณากรอกรหัส Supplier');
        return;
      }
      if (!nameStr) {
        alert('กรุณากรอกชื่อผู้ส่งมอบ / ชื่อฟาร์ม');
        return;
      }

      const cleanPhone = formatPhoneNumber(supPhone);
      const phoneToSave = cleanPhone === '-' ? '' : cleanPhone;

      // Duplicate code check
      const isDuplicate = suppliers.some(
        (s) =>
          String(s.code || '').trim().toLowerCase() === codeStr.toLowerCase() &&
          (!editingSupplier || s.id !== editingSupplier.id)
      );
      if (isDuplicate) {
        alert('รหัส Supplier นี้มีในระบบแล้ว กรุณาระบุรหัสใหม่');
        return;
      }

      setIsSupplierModalOpen(false);

      if (editingSupplier) {
        onUpdateSupplier({
          ...editingSupplier,
          code: codeStr,
          name: nameStr,
          phone: phoneToSave,
          contactPerson: contactStr,
          email: emailStr,
          address: addressStr,
        });
      } else {
        const newSup: Supplier = {
          id: `sup-${Date.now().toString().slice(-4)}`,
          code: codeStr,
          name: nameStr,
          phone: phoneToSave,
          contactPerson: contactStr,
          email: emailStr,
          address: addressStr,
        };
        onAddSupplier(newSup);
      }
    } catch (err: unknown) {
      const e = err as Error;
      alert(`Error saving supplier: ${e.message}`);
      console.error(e);
    }
  };

  // -----------------------------------------------------------------
  // 2. RAW MATERIAL (RM) MANAGEMENT & SUPPLIER LINKING MODALS & STATE
  // -----------------------------------------------------------------
  const [isRmModalOpen, setIsRmModalOpen] = useState<boolean>(false);
  const [editingRm, setEditingRm] = useState<RMItem | null>(null);
  const [rmCode, setRmCode] = useState<string>('');
  const [rmName, setRmName] = useState<string>('');
  const [rmCategory, setRmCategory] = useState<string>('Type 1');
  const [rmUnit, setRmUnit] = useState<string>('kg');
  const [selectedLinkedSupplierIds, setSelectedLinkedSupplierIds] = useState<string[]>([]);

  const handleOpenAddRm = () => {
    setEditingRm(null);
    setRmCode(`RM-${(rmItems.length + 1).toString().padStart(3, '0')}`);
    setRmName('');
    setRmCategory('Type 1');
    setRmUnit('kg');
    setSelectedLinkedSupplierIds(suppliers && suppliers.length > 0 && suppliers[0]?.id ? [suppliers[0].id] : []);
    setIsRmModalOpen(true);
  };

  const handleOpenEditRm = (rm: RMItem) => {
    setEditingRm(rm);
    setRmCode(rm.code);
    setRmName(rm.name);
    setRmCategory(rm.category);
    setRmUnit(rm.unit);

    const linkedIds =
      rm.supplierIds && rm.supplierIds.length > 0
        ? rm.supplierIds
        : rm.supplierId
          ? [rm.supplierId]
          : [];
    setSelectedLinkedSupplierIds(linkedIds);
    setIsRmModalOpen(true);
  };

  const handleSaveRm = (e?: React.FormEvent | React.MouseEvent) => {
    try {
      if (e) e.preventDefault();
      const codeStr = String(rmCode || '').trim();
      const nameStr = String(rmName || '').trim();
      const unitStr = String(rmUnit || '').trim();

      if (!nameStr) {
        alert('กรุณากรอกชื่อวัตถุดิบ');
        return;
      }

      // Duplicate RM code check
      const isDuplicate = rmItems.some(
        (rm) =>
          String(rm.code || '').trim().toLowerCase() === codeStr.toLowerCase() &&
          (!editingRm || rm.id !== editingRm.id)
      );
      if (isDuplicate) {
        alert('รหัส RM นี้มีในระบบแล้ว กรุณาระบุรหัสใหม่');
        return;
      }

      setIsRmModalOpen(false);

      const primarySup = suppliers.find((s) => selectedLinkedSupplierIds.includes(s.id)) || suppliers[0];

      if (editingRm) {
        onUpdateRMItem({
          ...editingRm,
          code: codeStr,
          name: nameStr,
          category: rmCategory,
          categoryLabel: dynamicCategories[rmCategory] || rmCategory,
          supplierId: primarySup ? primarySup.id : '',
          supplierName: primarySup ? primarySup.name : 'หลาย Supplier',
          supplierIds: selectedLinkedSupplierIds,
          unit: unitStr,
        });
      } else {
        const newRm: RMItem = {
          id: `rm-${Date.now().toString().slice(-4)}`,
          code: codeStr,
          name: nameStr,
          category: rmCategory,
          categoryLabel: dynamicCategories[rmCategory] || rmCategory,
          supplierId: primarySup ? primarySup.id : '',
          supplierName: primarySup ? primarySup.name : 'หลาย Supplier',
          supplierIds: selectedLinkedSupplierIds,
          unit: unitStr,
        };
        onAddRMItem(newRm);
      }
    } catch (err: unknown) {
      const e = err as Error;
      alert(`Error saving RM Item: ${e.message}`);
      console.error(e);
    }
  };

  // -----------------------------------------------------------------
  // 2.1 RM MERGE / DEDUPLICATION TOOL STATE & LOGIC
  // -----------------------------------------------------------------
  const [isMergeModalOpen, setIsMergeModalOpen] = useState<boolean>(false);
  const [selectedMergeRmIds, setSelectedMergeRmIds] = useState<string[]>([]);
  const [targetRmId, setTargetRmId] = useState<string>('');

  // Auto detect groups of RMs with matching names
  const duplicateRmGroups = useMemo(() => {
    const nameMap: Record<string, RMItem[]> = {};
    (rmItems || []).forEach((rm) => {
      const cleanName = (rm.name || '').trim().toLowerCase();
      if (!cleanName) return;
      if (!nameMap[cleanName]) nameMap[cleanName] = [];
      nameMap[cleanName]!.push(rm);
    });

    return Object.entries(nameMap)
      .filter(([, group]) => group.length > 1)
      .map(([nameKey, group]) => ({
        nameKey,
        rmName: group[0]?.name || nameKey,
        items: group,
      }));
  }, [rmItems]);

  const handleOpenMergeModal = (presetItems?: RMItem[]) => {
    if (presetItems && presetItems.length > 0) {
      const ids = presetItems.map((i) => i.id);
      setSelectedMergeRmIds(ids);
      setTargetRmId(presetItems[0]?.id || '');
    } else {
      setSelectedMergeRmIds([]);
      setTargetRmId('');
    }
    setIsMergeModalOpen(true);
  };

  const handleToggleMergeRmId = (id: string) => {
    setSelectedMergeRmIds((prev) => {
      const next = prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id];
      if (next.length > 0 && (!targetRmId || !next.includes(targetRmId))) {
        setTargetRmId(next[0] || '');
      }
      return next;
    });
  };

  const handleExecuteMerge = () => {
    if (selectedMergeRmIds.length < 2) {
      alert('กรุณาเลือกวัตถุดิบอย่างน้อย 2 รายการเพื่อทำการรวมข้อมูล');
      return;
    }
    if (!targetRmId || !selectedMergeRmIds.includes(targetRmId)) {
      alert('กรุณาเลือกวัตถุดิบรายการหลัก (Master Target RM) ที่ต้องการคงไว้');
      return;
    }

    const targetItem = rmItems.find((r) => r.id === targetRmId);
    if (!targetItem) {
      alert('ไม่พบข้อมูลวัตถุดิบรายการหลัก');
      return;
    }

    // Combine all supplierIds from selected items
    const allSupplierIds = new Set<string>();
    selectedMergeRmIds.forEach((id) => {
      const item = rmItems.find((r) => r.id === id);
      if (!item) return;
      if (item.supplierIds && item.supplierIds.length > 0) {
        item.supplierIds.forEach((sId) => allSupplierIds.add(sId));
      }
      if (item.supplierId) {
        allSupplierIds.add(item.supplierId);
      }
    });

    const combinedSupplierIds = Array.from(allSupplierIds);
    const primarySup = suppliers.find((s) => combinedSupplierIds.includes(s.id)) || suppliers[0];

    const updatedTargetRM: RMItem = {
      ...targetItem,
      supplierId: primarySup ? primarySup.id : targetItem.supplierId,
      supplierName: primarySup ? primarySup.name : targetItem.supplierName,
      supplierIds: combinedSupplierIds,
    };

    if (onMergeRMItems) {
      onMergeRMItems(updatedTargetRM, selectedMergeRmIds);
    } else {
      // Fallback
      onUpdateRMItem(updatedTargetRM);
      selectedMergeRmIds.forEach((id) => {
        if (id !== targetRmId) onDeleteRMItem(id);
      });
    }

    setIsMergeModalOpen(false);
    alert(`รวมวัตถุดิบเป็น "${updatedTargetRM.name}" (${updatedTargetRM.code}) เรียบร้อยแล้ว!`);
  };

  // -----------------------------------------------------------------
  // 3. QC MATRIX RULES MANAGEMENT
  // -----------------------------------------------------------------
  const [selectedMatrixCategory, setSelectedMatrixCategory] = useState<string>('Type 1');
  const [isRuleModalOpen, setIsRuleModalOpen] = useState<boolean>(false);
  const [editingRuleIndex, setEditingRuleIndex] = useState<number | null>(null);
  const [ruleMinQty, setRuleMinQty] = useState<number>(0);
  const [ruleMaxQty, setRuleMaxQty] = useState<number>(0);
  const [ruleSampleQty, setRuleSampleQty] = useState<number>(0);
  const [ruleAcceptDefectQty, setRuleAcceptDefectQty] = useState<number>(0);

  const handleOpenAddRule = () => {
    setEditingRuleIndex(null);
    const existingRules = defectMatrix[selectedMatrixCategory] || [];
    const lastRule = existingRules[existingRules.length - 1];
    const newMin = lastRule ? lastRule.maxQty + 1 : 1;
    setRuleMinQty(newMin);
    setRuleMaxQty(newMin + 100);
    setRuleSampleQty(5);
    setRuleAcceptDefectQty(1);
    setIsRuleModalOpen(true);
  };

  const handleOpenEditRule = (rule: DefectRule, index: number) => {
    setEditingRuleIndex(index);
    setRuleMinQty(rule.minQty);
    setRuleMaxQty(rule.maxQty);
    setRuleSampleQty(rule.sampleQty);
    setRuleAcceptDefectQty(rule.acceptMaxDefectQty);
    setIsRuleModalOpen(true);
  };

  const handleDeleteRule = (index: number) => {
    if (!window.confirm('ยืนยันลบเกณฑ์การสุ่มตรวจแถวนี้?')) return;
    const currentRules = [...(defectMatrix[selectedMatrixCategory] || [])];
    if (currentRules.length <= 1) {
      alert('ไม่สามารถลบเกณฑ์การสุ่มตรวจแถวสุดท้ายได้ (ต้องมีอย่างน้อย 1 กฎ)');
      return;
    }
    currentRules.splice(index, 1);
    onUpdateDefectMatrix({
      ...defectMatrix,
      [selectedMatrixCategory]: currentRules,
    });
  };

  const handleSaveRule = (e: React.FormEvent) => {
    e.preventDefault();
    const currentRules = [...(defectMatrix[selectedMatrixCategory] || [])];
    const pct = ruleSampleQty > 0 ? Number(((ruleAcceptDefectQty / ruleSampleQty) * 100).toFixed(2)) : 0;

    const newRule: DefectRule = {
      minQty: Number(ruleMinQty),
      maxQty: Number(ruleMaxQty),
      sampleQty: Number(ruleSampleQty),
      acceptMaxDefectQty: Number(ruleAcceptDefectQty),
      acceptMaxDefectPercent: pct,
    };

    if (editingRuleIndex !== null) {
      currentRules[editingRuleIndex] = newRule;
    } else {
      currentRules.push(newRule);
    }

    currentRules.sort((a, b) => a.minQty - b.minQty);

    onUpdateDefectMatrix({
      ...defectMatrix,
      [selectedMatrixCategory]: currentRules,
    });

    setIsRuleModalOpen(false);
  };

  // Filter lists
  const filteredSuppliers = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return (suppliers || []).filter(
      (s) =>
        String(s?.name || '').toLowerCase().includes(q) ||
        String(s?.code || '').toLowerCase().includes(q) ||
        String(s?.phone || '').includes(searchQuery) ||
        String(s?.contactPerson || '').toLowerCase().includes(q)
    );
  }, [suppliers, searchQuery]);

  const filteredRms = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return (rmItems || []).filter(
      (r) =>
        String(r?.name || '').toLowerCase().includes(q) ||
        String(r?.code || '').toLowerCase().includes(q) ||
        String(r?.categoryLabel || r?.category || '').toLowerCase().includes(q)
    );
  }, [rmItems, searchQuery]);

  const currentRulesList = useMemo(() => {
    return (defectMatrix && defectMatrix[selectedMatrixCategory]) || [];
  }, [defectMatrix, selectedMatrixCategory]);

  // Pagination States
  const [supPage, setSupPage] = useState<number>(1);
  const [supPageSize, setSupPageSize] = useState<number>(10);

  const [rmPage, setRmPage] = useState<number>(1);
  const [rmPageSize, setRmPageSize] = useState<number>(10);

  const [rulePage, setRulePage] = useState<number>(1);
  const [rulePageSize, setRulePageSize] = useState<number>(10);

  React.useEffect(() => {
    setSupPage(1);
    setRmPage(1);
  }, [searchQuery, activeSubTab]);

  React.useEffect(() => {
    setRulePage(1);
  }, [selectedMatrixCategory]);

  const paginatedSuppliers = React.useMemo(() => {
    const start = (supPage - 1) * supPageSize;
    return filteredSuppliers.slice(start, start + supPageSize);
  }, [filteredSuppliers, supPage, supPageSize]);

  const paginatedRms = React.useMemo(() => {
    const start = (rmPage - 1) * rmPageSize;
    return filteredRms.slice(start, start + rmPageSize);
  }, [filteredRms, rmPage, rmPageSize]);

  const paginatedRules = React.useMemo(() => {
    const start = (rulePage - 1) * rulePageSize;
    return currentRulesList.slice(start, start + rulePageSize);
  }, [currentRulesList, rulePage, rulePageSize]);

  // Category Badge Colors mapping for RM Table
  const getCategoryBadgeClass = (catKey: string) => {
    switch (catKey) {
      case 'Type 1':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'Type 2':
        return 'bg-lime-50 text-lime-800 border-lime-200';
      case 'Type 3':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'Type 4':
        return 'bg-cyan-50 text-cyan-800 border-cyan-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <div className="h-full flex-1 flex flex-col min-h-0 space-y-3">
      {/* ------------------------------------------------------------- */}
      {/* SUB-TAB NAVIGATION & ACTION TOOLBAR */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white p-2 sm:p-2.5 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 shrink-0">
        {/* Sub-tab pills */}
        <div className="flex items-center bg-slate-100/80 p-1.5 rounded-xl border border-slate-200/60 overflow-x-auto custom-scrollbar">
          <button
            type="button"
            onClick={() => setActiveSubTab('suppliers')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-xs font-medium whitespace-nowrap cursor-pointer ${activeSubTab === 'suppliers'
                ? 'bg-white text-emerald-800 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
          >
            <span className="text-sm">🏬</span>
            <span>ข้อมูล Supplier</span>
            <span className={`px-2 py-0.5 text-xs rounded-full font-mono ${activeSubTab === 'suppliers' ? 'bg-emerald-100 text-emerald-800 font-semibold' : 'bg-slate-200 text-slate-700'}`}>
              {suppliers.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('rms')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-xs font-medium whitespace-nowrap cursor-pointer ${activeSubTab === 'rms'
                ? 'bg-white text-sky-800 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
          >
            <span className="text-sm">🥬</span>
            <span>ทะเบียนวัตถุดิบ & ผูก Supplier</span>
            <span className={`px-2 py-0.5 text-xs rounded-full font-mono ${activeSubTab === 'rms' ? 'bg-sky-100 text-sky-800 font-semibold' : 'bg-slate-200 text-slate-700'}`}>
              {rmItems.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('matrix')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-xs font-medium whitespace-nowrap cursor-pointer ${activeSubTab === 'matrix'
                ? 'bg-white text-purple-800 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
          >
            <span className="text-sm">📐</span>
            <span>ตารางเกณฑ์ QC Matrix</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('defectCats')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-xs font-medium whitespace-nowrap cursor-pointer ${activeSubTab === 'defectCats'
                ? 'bg-white text-rose-800 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
          >
            <span className="text-sm">🏷️</span>
            <span>หมวดหมู่ปัญหา QC</span>
            <span className={`px-2 py-0.5 text-xs rounded-full font-mono ${activeSubTab === 'defectCats' ? 'bg-rose-100 text-rose-800 font-semibold' : 'bg-slate-200 text-slate-700'}`}>
              {defectCategories.length}
            </span>
          </button>
        </div>

        {/* Search & Main Action Button */}
        <div className="flex items-center gap-3">
          {activeSubTab !== 'matrix' && (
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  activeSubTab === 'suppliers'
                    ? 'ค้นหาชื่อ, รหัส, เบอร์โทร...'
                    : activeSubTab === 'rms'
                      ? 'ค้นชื่อ RM, รหัส, หมวดหมู่...'
                      : 'ค้นหมวดหมู่ปัญหา...'
                }
                className="w-full h-9.5 pl-9 pr-8 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all placeholder:text-slate-400"
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
          )}

          {activeSubTab === 'suppliers' && (
            <button
              type="button"
              onClick={handleOpenAddSupplier}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-medium text-sm rounded-xl shadow-xs hover:shadow-sm transition-all cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่ม Supplier ใหม่</span>
            </button>
          )}

          {activeSubTab === 'rms' && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleOpenMergeModal()}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-medium text-sm rounded-xl shadow-2xs transition-all cursor-pointer whitespace-nowrap"
                title="รวมรายการวัตถุดิบที่มีชื่อซ้ำกันให้เป็นรายการเดียว"
              >
                <Combine className="w-4 h-4 text-amber-700" />
                <span>รวมวัตถุดิบซ้ำ (Merge RMs)</span>
                {duplicateRmGroups.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 text-xs font-bold font-mono animate-pulse">
                    {duplicateRmGroups.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={handleOpenAddRm}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 active:scale-95 text-white font-medium text-sm rounded-xl shadow-xs hover:shadow-sm transition-all cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>เพิ่มวัตถุดิบ (RM) ใหม่</span>
              </button>
            </div>
          )}

          {activeSubTab === 'defectCats' && (
            <button
              type="button"
              onClick={handleOpenAddCat}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-medium text-sm rounded-xl shadow-xs hover:shadow-sm transition-all cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่มหมวดหมู่ปัญหา</span>
            </button>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 1. SUPPLIERS DIRECTORY SUB-TAB */}
      {/* ------------------------------------------------------------- */}
      {activeSubTab === 'suppliers' && (
        <div className="flex-1 flex flex-col min-h-0 bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="p-3 sm:px-4 sm:py-3 border-b border-slate-200/80 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-600" />
                รายชื่อผู้ส่งมอบวัตถุดิบ (Registered Suppliers)
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                ตารางแสดงข้อมูลผู้ส่งมอบ/ฟาร์ม รายชื่อผู้ติดต่อ เบอร์โทรศัพท์ และสถานที่จัดส่ง
              </p>
            </div>
            <div className="text-xs font-mono text-slate-500 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
              แสดงข้อมูล {filteredSuppliers.length} / {suppliers.length} ราย
            </div>
          </div>

          <div className="flex-1 overflow-x-auto overflow-y-auto min-h-0 custom-scrollbar relative">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 shadow-2xs">
                <tr className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                  <th className="py-3 px-4 w-28">รหัส Supplier</th>
                  <th className="py-3 px-4">ชื่อผู้ส่งมอบ / ฟาร์ม</th>
                  <th className="py-3 px-4">ผู้ติดต่อ</th>
                  <th className="py-3 px-4">เบอร์โทรศัพท์</th>
                  <th className="py-3 px-4">อีเมล</th>
                  <th className="py-3 px-4">ที่อยู่จัดส่ง</th>
                  <th className="py-3 px-4 text-center w-24">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80 text-sm font-normal text-slate-800">
                {filteredSuppliers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center">
                      <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                          <Building2 className="w-6 h-6" />
                        </div>
                        <h4 className="text-sm font-medium text-slate-800">ไม่พบข้อมูล Supplier</h4>
                        <p className="text-xs text-slate-500 mt-1 mb-4 text-center">
                          {searchQuery ? `ไม่พบข้อมูลที่ตรงกับคำค้นหา "${searchQuery}"` : 'ยังไม่มีผู้ส่งมอบในระบบ กดปุ่มด้านล่างเพื่อเพิ่มข้อมูลรายแรก'}
                        </p>
                        {!searchQuery && (
                          <button
                            type="button"
                            onClick={handleOpenAddSupplier}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                          >
                            <Plus className="w-4 h-4" />
                            เพิ่ม Supplier รายแรก
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedSuppliers.map((sup: Supplier) => (
                    <tr key={sup.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="py-3.5 px-4">
                        <span className="font-mono text-xs font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200/80 inline-block">
                          {sup.code}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-900">
                        {sup.name}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {sup.contactPerson ? (
                          <div className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{sup.contactPerson}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-xs">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {sup.phone ? (
                          <div className="flex items-center gap-1.5 font-mono text-slate-700 text-xs">
                            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{formatPhoneNumber(sup.phone)}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-xs">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {sup.email ? (
                          <div className="flex items-center gap-1.5 text-slate-600 text-xs">
                            <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[140px]" title={sup.email}>{sup.email}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-xs">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 text-xs">
                        {sup.address ? (
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[180px]" title={sup.address}>
                              {sup.address}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-xs">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditSupplier(sup)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer active:scale-95"
                            title="แก้ไขข้อมูล Supplier"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`ยืนยันลบ Supplier: ${sup.name}?`)) {
                                onDeleteSupplier(sup.id);
                              }
                            }}
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors cursor-pointer active:scale-95"
                            title="ลบ Supplier"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-auto shrink-0 border-t border-slate-200/80">
            <TablePagination
              currentPage={supPage}
              totalPages={Math.ceil(filteredSuppliers.length / supPageSize) || 1}
              totalItems={filteredSuppliers.length}
              pageSize={supPageSize}
              onPageChange={setSupPage}
              onPageSizeChange={setSupPageSize}
              itemUnitLabel="ผู้ส่งมอบ"
            />
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. RAW MATERIALS (RM) & SUPPLIER LINKING SUB-TAB */}
      {/* ------------------------------------------------------------- */}
      {activeSubTab === 'rms' && (
        <div className="flex-1 flex flex-col min-h-0 bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="p-3 sm:px-4 sm:py-3 border-b border-slate-200/80 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-sky-600" />
                ทะเบียนวัตถุดิบและการผูก Supplier (Raw Materials Directory)
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                ตารางวัตถุดิบ พร้อมการเชื่อมโยงผู้ส่งมอบที่จัดหาได้ (Multi-Supplier Linking)
              </p>
            </div>
            <div className="text-xs font-mono text-slate-500 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
              แสดงวัตถุดิบ {filteredRms.length} / {rmItems.length} รายการ
            </div>
          </div>

          <div className="flex-1 overflow-x-auto overflow-y-auto min-h-0 custom-scrollbar relative">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 shadow-2xs">
                <tr className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                  <th className="py-3 px-4 w-28">รหัส RM</th>
                  <th className="py-3 px-4">ชื่อวัตถุดิบ (Raw Material)</th>
                  <th className="py-3 px-4">หมวดหมู่สเปก QC (Category)</th>
                  <th className="py-3 px-4 w-24">หน่วยนับ</th>
                  <th className="py-3 px-4">Supplier ที่จัดหาได้ (Linked Suppliers)</th>
                  <th className="py-3 px-4 text-center w-24">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80 text-sm font-normal text-slate-800">
                {filteredRms.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center">
                      <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                          <Layers className="w-6 h-6" />
                        </div>
                        <h4 className="text-sm font-medium text-slate-800">ไม่พบข้อมูลวัตถุดิบ</h4>
                        <p className="text-xs text-slate-500 mt-1 mb-4 text-center">
                          {searchQuery ? `ไม่พบข้อมูลที่ตรงกับคำค้นหา "${searchQuery}"` : 'ยังไม่มีวัตถุดิบในระบบ กดปุ่มด้านล่างเพื่อเพิ่มวัตถุดิบรายการแรก'}
                        </p>
                        {!searchQuery && (
                          <button
                            type="button"
                            onClick={handleOpenAddRm}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-medium text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                          >
                            <Plus className="w-4 h-4" />
                            เพิ่มวัตถุดิบรายแรก
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedRms.map((rm: RMItem) => {
                    const linkedSupIds =
                      rm.supplierIds && rm.supplierIds.length > 0
                        ? rm.supplierIds
                        : rm.supplierId
                          ? [rm.supplierId]
                          : [];

                    const linkedSups = (suppliers || []).filter((s) => s && s.id && linkedSupIds.includes(s.id));

                    return (
                      <tr key={rm.id} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="py-3.5 px-4">
                          <span className="font-mono text-xs font-semibold text-sky-800 bg-sky-50 px-2.5 py-1 rounded-md border border-sky-200/80 inline-block">
                            {rm.code}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-900">
                          {rm.name}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-medium border ${getCategoryBadgeClass(rm.category)}`}>
                            {rm.categoryLabel || rm.category}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-block px-2 py-0.5 rounded-md text-xs font-mono font-medium bg-slate-100 text-slate-700 border border-slate-200">
                            {rm.unit}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {linkedSups.length === 0 ? (
                              <span className="text-xs text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 font-medium">
                                ⚠️ ยังไม่ได้ผูก Supplier
                              </span>
                            ) : (
                              linkedSups.map((s) => (
                                <span
                                  key={s.id}
                                  className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-slate-50 text-slate-800 border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-900 transition-colors"
                                >
                                  <Building2 className="w-3 h-3 text-emerald-600" />
                                  <span>{s.name}</span>
                                  <span className="font-mono text-[10px] text-slate-400">({s.code})</span>
                                </span>
                              ))
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEditRm(rm)}
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer active:scale-95"
                              title="แก้ไขข้อมูลวัตถุดิบ"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(`ยืนยันลบวัตถุดิบ: ${rm.name}?`)) {
                                  onDeleteRMItem(rm.id);
                                }
                              }}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors cursor-pointer active:scale-95"
                              title="ลบวัตถุดิบ"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-auto shrink-0 border-t border-slate-200/80">
            <TablePagination
              currentPage={rmPage}
              totalPages={Math.ceil(filteredRms.length / rmPageSize) || 1}
              totalItems={filteredRms.length}
              pageSize={rmPageSize}
              onPageChange={setRmPage}
              onPageSizeChange={setRmPageSize}
              itemUnitLabel="วัตถุดิบ"
            />
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 3. QC SAMPLING MATRIX RULES MANAGEMENT SUB-TAB */}
      {/* ------------------------------------------------------------- */}
      {activeSubTab === 'matrix' && (
        <div className="flex-1 flex flex-col min-h-0 space-y-3">
          {/* Dedicated Category Selector Cards Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 shrink-0">
            {Object.entries(dynamicCategories).map(([catKey, catLabel]) => {
              const isSelected = selectedMatrixCategory === catKey;
              const meta = categoryMeta[catKey] || {
                icon: <Package className="w-4 h-4 text-purple-600" />,
                shortTitle: `${catKey}`,
                subtext: catLabel,
                themeColor: 'purple',
              };
              const ruleCount = (defectMatrix[catKey] || []).length;

              return (
                <button
                  key={catKey}
                  type="button"
                  onClick={() => setSelectedMatrixCategory(catKey)}
                  className={`text-left p-3 rounded-xl transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between border ${isSelected
                      ? 'bg-white border-2 border-purple-600 shadow-sm ring-2 ring-purple-500/10 text-purple-950'
                      : 'bg-white/80 hover:bg-white border-slate-200/90 shadow-2xs hover:shadow-xs hover:border-slate-300 text-slate-700'
                    }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{meta.icon}</span>
                      <div>
                        <h4 className={`text-xs font-semibold leading-tight ${isSelected ? 'text-purple-950 font-bold' : 'text-slate-900'}`}>
                          {meta.shortTitle}
                        </h4>
                        <span className="text-[10px] font-mono text-slate-500 mt-0.5 block truncate max-w-[140px]">
                          Category: {catKey}
                        </span>
                      </div>
                    </div>
                    {isSelected && (
                      <span className="w-4 h-4 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px] shrink-0 shadow-2xs">
                        ✓
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-500 line-clamp-1 mb-2">
                    {meta.subtext}
                  </p>

                  <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-[11px]">
                    <span className="text-slate-500 font-medium">เกณฑ์สุ่มตรวจ</span>
                    <span className={`px-1.5 py-0.2 text-[10px] rounded-full font-mono font-medium ${isSelected ? 'bg-purple-100 text-purple-800 font-semibold' : 'bg-slate-100 text-slate-700'
                      }`}>
                      {ruleCount} กฎ
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* QC Sampling Rules Table */}
          <div className="flex-1 flex flex-col min-h-0 bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="p-3 sm:px-4 sm:py-3 border-b border-slate-100 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-slate-900">
                      ตารางเกณฑ์สุ่มตรวจ
                    </h4>
                    <span className="text-[11px] font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                      {selectedMatrixCategory}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {dynamicCategories[selectedMatrixCategory] || selectedMatrixCategory}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[11px] font-medium text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-100 hidden sm:inline-block">
                  {currentRulesList.length} รายการ
                </span>
                <button
                  type="button"
                  onClick={handleOpenAddRule}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-medium text-xs rounded-xl shadow-xs transition-all cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>เพิ่มเกณฑ์สุ่มตรวจ</span>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-x-auto overflow-y-auto min-h-0 custom-scrollbar relative">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 shadow-2xs">
                  <tr className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                    <th className="py-3 px-4 w-12 text-center">#</th>
                    <th className="py-3 px-4">รับเข้า (Receive Qty)</th>
                    <th className="py-3 px-4 text-right">สุ่มตรวจ (Sample)</th>
                    <th className="py-3 px-4 text-right">ยอมรับได้ (Max Defect)</th>
                    <th className="py-3 px-4 text-right">สัดส่วน (%)</th>
                    <th className="py-3 px-4 w-20 text-center">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/80 text-sm text-slate-700">
                  {currentRulesList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center">
                        <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                          <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 mb-3 border border-slate-100 shadow-sm">
                            <Sliders className="w-5 h-5" />
                          </div>
                          <h4 className="text-sm font-medium text-slate-700">ไม่มีข้อมูลเกณฑ์สุ่มตรวจ</h4>
                          <p className="text-xs text-slate-400 mt-1 mb-5 text-center px-4">
                            เพิ่มเกณฑ์กำหนดปริมาณสุ่มตรวจและจุดวิกฤตของเสีย (Max Defect)
                          </p>
                          <button
                            type="button"
                            onClick={handleOpenAddRule}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs rounded-xl shadow-xs border border-slate-200 transition-all cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5 text-purple-600" />
                            เพิ่มเกณฑ์แรก
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedRules.map((rule, idx) => {
                      const actualIdx = (rulePage - 1) * rulePageSize + idx;
                      return (
                        <tr key={actualIdx} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="py-3 px-4 text-center font-mono text-[11px] text-slate-400">
                            {actualIdx + 1}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-medium text-slate-800">{rule.minQty.toLocaleString()}</span>
                              <span className="text-slate-300">-</span>
                              <span className="font-mono font-medium text-slate-800">{rule.maxQty.toLocaleString()}</span>
                              <span className="text-xs text-slate-400">kg</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="font-mono font-semibold text-slate-900">{rule.sampleQty.toLocaleString()}</span>
                            <span className="text-[11px] text-slate-400 ml-1">kg</span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="font-mono font-semibold text-rose-600">{rule.acceptMaxDefectQty.toLocaleString()}</span>
                            <span className="text-[11px] text-rose-300 ml-1">kg</span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="inline-flex items-center justify-center min-w-[3rem] px-1.5 py-0.5 rounded-md bg-slate-50 text-slate-500 font-mono text-[11px] border border-slate-100">
                              {rule.acceptMaxDefectPercent}%
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={() => handleOpenEditRule(rule, actualIdx)}
                                className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors cursor-pointer"
                                title="แก้ไข"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteRule(actualIdx)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="ลบ"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-auto shrink-0 border-t border-slate-200/80">
              <TablePagination
                currentPage={rulePage}
                totalPages={Math.ceil(currentRulesList.length / rulePageSize) || 1}
                totalItems={currentRulesList.length}
                pageSize={rulePageSize}
                onPageChange={setRulePage}
                onPageSizeChange={setRulePageSize}
                itemUnitLabel="เกณฑ์สุ่มตรวจ"
              />
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 4. DEFECT CATEGORIES SUB-TAB */}
      {/* ------------------------------------------------------------- */}
      {activeSubTab === 'defectCats' && (
        <div className="flex-1 flex flex-col min-h-0 bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="p-3 sm:px-4 sm:py-3 border-b border-slate-200/80 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Tag className="w-4 h-4 text-rose-600" />
                หมวดหมู่ปัญหาคุณภาพ (QC Defect Categories Master Data)
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                กำหนดและจัดการหมวดหมู่ปัญหาคุณภาพ (ผูกกับ Google Sheet: DB_DefectCategories) เพื่อใช้ใน Dropdown เมนู QC Issue Log
              </p>
            </div>
            <div className="text-xs font-mono text-slate-500 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
              รวมทั้งหมด {filteredDefectCats.length} หมวดหมู่
            </div>
          </div>

          <div className="flex-1 overflow-x-auto overflow-y-auto min-h-0 custom-scrollbar relative">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 shadow-2xs">
                <tr className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4 w-28">รหัส</th>
                  <th className="py-3 px-4">ชื่อหมวดหมู่ปัญหา</th>
                  <th className="py-3 px-4">คำอธิบายรายละเอียด</th>
                  <th className="py-3 px-4 w-36 text-center">สถานะ</th>
                  <th className="py-3 px-4 w-24 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredDefectCats.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                      ไม่พบข้อมูลหมวดหมู่ปัญหา
                    </td>
                  </tr>
                ) : (
                  filteredDefectCats.map((cat, idx) => (
                    <tr key={cat.id || idx} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="py-3.5 px-4 text-center text-xs text-slate-400 font-mono">
                        {idx + 1}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs font-semibold text-rose-700">
                        {cat.id}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        {cat.name}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-600">
                        {cat.description || '-'}
                      </td>
                      <td className="py-3.5 px-3 text-center whitespace-nowrap min-w-[130px]">
                        <button
                          type="button"
                          onClick={() => handleToggleCatActive(cat)}
                          className={`inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border shadow-2xs transition-all cursor-pointer select-none whitespace-nowrap shrink-0 active:scale-95 ${cat.isActive !== false
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80 hover:bg-emerald-100 hover:border-emerald-300'
                              : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200 hover:text-slate-700'
                            }`}
                          title="คลิกเพื่อสลับสถานะ เปิด/ปิดใช้งาน"
                        >
                          <span className="relative flex h-2 w-2 shrink-0">
                            {cat.isActive !== false && (
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            )}
                            <span className={`relative inline-flex rounded-full h-2 w-2 ${cat.isActive !== false ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                          </span>
                          <span className="whitespace-nowrap font-medium">{cat.isActive !== false ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}</span>
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditCat(cat)}
                            className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors cursor-pointer"
                            title="แก้ไข"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {onDeleteDefectCategory && (
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`คุณต้องการลบหมวดหมู่ปัญหา "${cat.name}" หรือไม่?`)) {
                                  onDeleteDefectCategory(cat.id);
                                }
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="ลบ"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* DEFECT CATEGORY MODAL */}
      {/* ------------------------------------------------------------- */}
      {/* MODAL 0: ADD/EDIT QC DEFECT CATEGORY */}
      {/* ------------------------------------------------------------- */}
      {isCatModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xl max-w-md w-full overflow-visible transform transition-all relative my-auto">
            <div className="px-6 py-4.5 border-b border-slate-200/80 rounded-t-3xl flex items-center justify-between bg-gradient-to-r from-rose-50/80 via-slate-50 to-rose-50/50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center text-lg shadow-2xs">
                  🏷️
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingCat ? 'แก้ไขหมวดหมู่ปัญหา QC' : 'เพิ่มหมวดหมู่ปัญหา QC ใหม่'}
                  </h3>
                  <p className="text-xs text-slate-500">จัดการประเภท defect สำหรับบันทึกประวัติ</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCatModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-200/60 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-all flex items-center justify-center cursor-pointer active:scale-95"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCatSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  ชื่อหมวดหมู่ปัญหา <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  placeholder="เช่น สิ่งแปลกปลอม (Foreign Objects)"
                  className="w-full h-10 px-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  คำอธิบายรายละเอียด
                </label>
                <textarea
                  rows={3}
                  value={catDesc}
                  onChange={(e) => setCatDesc(e.target.value)}
                  placeholder="เช่น พบเศษหิน ไม้ แมลง หรือสิ่งแปลกปลอมในวัตถุดิบ..."
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  สถานะการใช้งานระบบ (Status)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {/* Active Option Card */}
                  <button
                    type="button"
                    onClick={() => setCatIsActive(true)}
                    className={`p-3 rounded-xl border-2 transition-all cursor-pointer text-left flex items-center gap-2.5 active:scale-95 ${catIsActive
                        ? 'bg-emerald-50/70 border-emerald-500 text-emerald-900 shadow-2xs ring-2 ring-emerald-500/20'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300'
                      }`}
                  >
                    <div className={`p-1.5 rounded-lg ${catIsActive ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold">เปิดใช้งาน</div>
                      <div className="text-[10px] opacity-75 mt-0.5">แสดงใน Dropdown</div>
                    </div>
                  </button>

                  {/* Inactive Option Card */}
                  <button
                    type="button"
                    onClick={() => setCatIsActive(false)}
                    className={`p-3 rounded-xl border-2 transition-all cursor-pointer text-left flex items-center gap-2.5 active:scale-95 ${!catIsActive
                        ? 'bg-rose-50/70 border-rose-500 text-rose-900 shadow-2xs ring-2 ring-rose-500/20'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300'
                      }`}
                  >
                    <div className={`p-1.5 rounded-lg ${!catIsActive ? 'bg-rose-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
                      <XCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold">ปิดใช้งาน</div>
                      <div className="text-[10px] opacity-75 mt-0.5">ซ่อนจาก Dropdown</div>
                    </div>
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCatModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs rounded-xl cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  บันทึกหมวดหมู่
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 1: ADD/EDIT SUPPLIER */}
      {/* ------------------------------------------------------------- */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-lg overflow-visible transform transition-all relative my-auto">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-emerald-50/80 via-slate-50 to-emerald-50/50 px-6 py-4.5 border-b border-slate-200/80 rounded-t-3xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-lg shadow-2xs">
                  🏬
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingSupplier ? 'แก้ไขข้อมูล Supplier' : 'เพิ่ม Supplier ใหม่'}
                  </h3>
                  <p className="text-xs text-slate-500">ระบุรายละเอียดข้อมูลผู้ส่งมอบและสถานที่ติดต่อ</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSupplierModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-200/60 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-all flex items-center justify-center cursor-pointer active:scale-95"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form Content */}
            <form onSubmit={handleSaveSupplier} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    รหัส Supplier <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={supCode}
                    onChange={(e) => setSupCode(e.target.value)}
                    placeholder="เช่น 05, 12, sup-01"
                    required
                    className="w-full h-10 px-3.5 bg-white border border-slate-300 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all placeholder:text-slate-400 placeholder:font-sans"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    ชื่อผู้ส่งมอบ / ชื่อฟาร์ม <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={supName}
                    onChange={(e) => setSupName(e.target.value)}
                    placeholder="ระบุชื่อ Supplier"
                    required
                    className="w-full h-10 px-3.5 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    ผู้ติดต่อ (Contact Person)
                  </label>
                  <input
                    type="text"
                    value={supContact}
                    onChange={(e) => setSupContact(e.target.value)}
                    placeholder="ชื่อผู้ประสานงาน"
                    className="w-full h-10 px-3.5 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all placeholder:text-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    เบอร์โทรศัพท์
                  </label>
                  <input
                    type="text"
                    value={supPhone}
                    onChange={(e) => setSupPhone(e.target.value)}
                    placeholder="เช่น 0812345678"
                    className="w-full h-10 px-3.5 bg-white border border-slate-300 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all placeholder:text-slate-400 placeholder:font-sans"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  อีเมล (Email)
                </label>
                <input
                  type="email"
                  value={supEmail}
                  onChange={(e) => setSupEmail(e.target.value)}
                  placeholder="เช่น supplier@example.com"
                  className="w-full h-10 px-3.5 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all placeholder:text-slate-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  ที่อยู่ (Address)
                </label>
                <textarea
                  value={supAddress}
                  onChange={(e) => setSupAddress(e.target.value)}
                  placeholder="ระบุที่อยู่หรือฟาร์มของ Supplier..."
                  rows={3}
                  className="w-full p-3 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all placeholder:text-slate-400 custom-scrollbar resize-none"
                />
              </div>

              {/* Modal Footer */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsSupplierModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-sm rounded-xl transition-all cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm rounded-xl shadow-sm transition-all cursor-pointer flex items-center gap-2"
                >
                  💾 บันทึก Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 2: ADD/EDIT RAW MATERIAL & SUPPLIER LINKING */}
      {/* ------------------------------------------------------------- */}
      {isRmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-lg overflow-visible transform transition-all relative my-auto">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-sky-50/80 via-slate-50 to-sky-50/50 px-6 py-4.5 border-b border-slate-200/80 rounded-t-3xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center text-lg shadow-2xs">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingRm ? 'แก้ไขข้อมูลวัตถุดิบ & การผูก Supplier' : 'เพิ่มวัตถุดิบ (RM) ใหม่'}
                  </h3>
                  <p className="text-xs text-slate-500">กำหนดหมวดหมู่สเปก QC หน่วยนับ และเชื่อมโยงผู้ส่งมอบ</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRmModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-200/60 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-all flex items-center justify-center cursor-pointer active:scale-95"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form Content */}
            <form onSubmit={handleSaveRm} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    รหัสวัตถุดิบ (RM Code) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={rmCode}
                    onChange={(e) => setRmCode(e.target.value)}
                    placeholder="เช่น RM-001"
                    required
                    className="w-full h-10 px-3.5 bg-white border border-slate-300 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-600 transition-all placeholder:text-slate-400 placeholder:font-sans"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    ชื่อวัตถุดิบ <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={rmName}
                    onChange={(e) => setRmName(e.target.value)}
                    placeholder="เช่น ใบตอง, ใบเตย, มะพร้าว"
                    required
                    className="w-full h-10 px-3.5 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-600 transition-all placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="relative z-30">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    หมวดหมู่สเปก QC <span className="text-rose-500">*</span>
                  </label>
                  <AutocompleteSelect
                    options={categoryOptions}
                    value={rmCategory}
                    onChange={(val) => setRmCategory(val)}
                    placeholder="-- เลือกหมวดหมู่สเปก --"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    หน่วยนับ (Unit) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={rmUnit}
                    onChange={(e) => setRmUnit(e.target.value)}
                    required
                    placeholder="เช่น kg, มัด, ตัว"
                    className="w-full h-10 px-3.5 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-600 transition-all placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* Multi-select Suppliers List */}
              <div className="relative z-20">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>เลือก Supplier ที่จัดหาสินค้านี้ได้</span>
                  <span className="text-[11px] font-normal text-slate-500">เลือกได้หลายราย</span>
                </label>
                <MultiAutocompleteSelect
                  options={supplierSelectOptions}
                  selectedValues={selectedLinkedSupplierIds}
                  onChange={setSelectedLinkedSupplierIds}
                  placeholder="-- ค้นหาและเลือก Supplier ที่จัดหาสินค้านี้ได้ --"
                  searchPlaceholder="พิมพ์รหัส หรือ ชื่อ Supplier..."
                />
              </div>

              {/* Modal Footer */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsRmModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-sm rounded-xl transition-all cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-medium text-sm rounded-xl shadow-sm transition-all cursor-pointer flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  <span>บันทึกวัตถุดิบ & ผูก Supplier</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: MERGE DUPLICATE RMS TOOL */}
      {/* ------------------------------------------------------------- */}
      {isMergeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-2xl overflow-hidden transform transition-all relative my-auto">
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-50 via-slate-50 to-amber-50 px-6 py-4.5 border-b border-amber-200/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shadow-2xs">
                  <Combine className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <span>เครื่องมือรวมวัตถุดิบซ้ำ (Merge Duplicate RMs)</span>
                    <Sparkles className="w-4 h-4 text-amber-600" />
                  </h3>
                  <p className="text-xs text-slate-500">
                    รวมรายการวัตถุดิบที่ซ้ำกันให้เหลือรายการเดียว พร้อมโอนย้าย Supplier และประวัติบิลย้อนหลังทั้งหมด
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMergeModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-200/60 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-all flex items-center justify-center cursor-pointer active:scale-95"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto custom-scrollbar">
              {/* Auto Detected Duplicate Groups Suggestion Box */}
              {duplicateRmGroups.length > 0 && (
                <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5 uppercase tracking-wider">
                      <Sparkles className="w-4 h-4 text-amber-600" />
                      ตรวจพบวัตถุดิบที่มีชื่อซ้ำกัน {duplicateRmGroups.length} กลุ่ม
                    </span>
                    <span className="text-[11px] text-amber-700">คลิกที่กลุ่มเพื่อเริ่มรวมข้อมูล</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {duplicateRmGroups.map((g) => (
                      <button
                        key={g.nameKey}
                        type="button"
                        onClick={() => handleOpenMergeModal(g.items)}
                        className="px-3 py-1.5 bg-white hover:bg-amber-100 text-amber-900 text-xs font-medium rounded-xl border border-amber-300 shadow-2xs transition-all flex items-center gap-2 cursor-pointer"
                      >
                        <span className="font-bold">{g.rmName}</span>
                        <span className="px-1.5 py-0.2 bg-amber-200 text-amber-900 rounded-full text-[10px] font-mono font-bold">
                          {g.items.length} รายการ
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 1: Select RMs to Merge */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  1. เลือกรายการวัตถุดิบที่ต้องการนำมารวมกัน (อย่างน้อย 2 รายการ)
                </label>
                <div className="border border-slate-200 rounded-2xl divide-y divide-slate-100 max-h-48 overflow-y-auto custom-scrollbar bg-slate-50/50">
                  {rmItems.map((rm) => {
                    const isChecked = selectedMergeRmIds.includes(rm.id);
                    const isTarget = targetRmId === rm.id;
                    const linkedSupIds = rm.supplierIds && rm.supplierIds.length > 0 ? rm.supplierIds : rm.supplierId ? [rm.supplierId] : [];
                    const linkedSups = (suppliers || []).filter((s) => linkedSupIds.includes(s.id));

                    return (
                      <div
                        key={rm.id}
                        onClick={() => handleToggleMergeRmId(rm.id)}
                        className={`p-3 flex items-center justify-between transition-colors cursor-pointer ${
                          isChecked ? 'bg-amber-50/60' : 'hover:bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-semibold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                                {rm.code}
                              </span>
                              <span className="text-sm font-semibold text-slate-900">{rm.name}</span>
                              <span className="text-xs text-slate-500">({rm.category})</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-1 mt-1">
                              {linkedSups.length === 0 ? (
                                <span className="text-[11px] text-slate-400 font-italic">ไม่มี Supplier</span>
                              ) : (
                                linkedSups.map((s) => (
                                  <span key={s.id} className="text-[11px] text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                                    {s.name}
                                  </span>
                                ))
                              )}
                            </div>
                          </div>
                        </div>

                        {isChecked && (
                          <div className="flex items-center gap-2">
                            {isTarget ? (
                              <span className="px-2.5 py-1 rounded-full bg-emerald-600 text-white text-xs font-bold shadow-2xs">
                                ★ Master Target
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTargetRmId(rm.id);
                                }}
                                className="px-2.5 py-1 rounded-full bg-slate-200 hover:bg-emerald-100 hover:text-emerald-900 text-slate-700 text-xs font-medium transition-all cursor-pointer"
                              >
                                เลือกเป็นรายการหลัก
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: Target Master RM Selection & Preview */}
              {selectedMergeRmIds.length >= 2 && (
                <div className="bg-slate-900 text-white rounded-2xl p-4.5 space-y-3 shadow-lg">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      สรุปผลการรวมข้อมูล (Merge Preview)
                    </span>
                    <span className="text-xs text-slate-400">
                      รายการที่เลือก: {selectedMergeRmIds.length} รายการ
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
                      <span className="text-slate-400 block mb-1">รายการหลักที่คงไว้ (Master RM)</span>
                      <div className="font-semibold text-emerald-300 text-sm">
                        {rmItems.find((r) => r.id === targetRmId)?.name} ({rmItems.find((r) => r.id === targetRmId)?.code})
                      </div>
                    </div>
                    <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
                      <span className="text-slate-400 block mb-1">รายการที่จะถูกลบออก</span>
                      <div className="font-semibold text-rose-300">
                        {selectedMergeRmIds
                          .filter((id) => id !== targetRmId)
                          .map((id) => rmItems.find((r) => r.id === id)?.code)
                          .join(', ')}
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 font-light flex items-center gap-1.5 pt-1">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>
                      Supplier ทั้งหมดจากทุกรายการที่เลือก จะถูกนำมารวมผูกกับรายการหลัก และบิลรับเข้า/ปัญหา QC ย้อนหลังจะถูกปรับให้อ้างอิงรายการหลักโดยอัตโนมัติ
                    </span>
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200/80 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsMergeModalOpen(false)}
                className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium text-sm rounded-xl transition-all cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={selectedMergeRmIds.length < 2 || !targetRmId}
                onClick={handleExecuteMerge}
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2"
              >
                <Combine className="w-4 h-4" />
                <span>ยืนยันการรวมวัตถุดิบ</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 3: ADD/EDIT QC SAMPLING RULE */}
      {/* ------------------------------------------------------------- */}
      {isRuleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-md overflow-visible transform transition-all relative my-auto">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-purple-50/80 via-slate-50 to-purple-50/50 px-6 py-4.5 border-b border-slate-200/80 rounded-t-3xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center text-lg shadow-2xs">
                  📐
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingRuleIndex !== null ? 'แก้ไขเกณฑ์สุ่มตรวจ' : 'เพิ่มเกณฑ์สุ่มตรวจใหม่'}
                  </h3>
                  <p className="text-xs text-slate-500">หมวดหมู่: {selectedMatrixCategory}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRuleModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-200/60 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-all flex items-center justify-center cursor-pointer active:scale-95"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form Content */}
            <form onSubmit={handleSaveRule} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    น้ำหนักต่ำสุด (Min kg) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={ruleMinQty}
                    onChange={(e) => setRuleMinQty(parseFloat(e.target.value) || 0)}
                    required
                    className="w-full h-10 px-3.5 bg-white border border-slate-300 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    น้ำหนักสูงสุด (Max kg) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={ruleMaxQty}
                    onChange={(e) => setRuleMaxQty(parseFloat(e.target.value) || 0)}
                    required
                    className="w-full h-10 px-3.5 bg-white border border-slate-300 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  ปริมาณสุ่มตรวจ (Sample Qty - kg) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={ruleSampleQty}
                  onChange={(e) => setRuleSampleQty(parseFloat(e.target.value) || 0)}
                  required
                  className="w-full h-10 px-3.5 bg-white border border-slate-300 rounded-xl text-sm font-mono font-semibold text-sky-700 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  ของเสียยอมรับได้สูงสุด (Max Defect - kg) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={ruleAcceptDefectQty}
                  onChange={(e) => setRuleAcceptDefectQty(parseFloat(e.target.value) || 0)}
                  required
                  className="w-full h-10 px-3.5 bg-white border border-slate-300 rounded-xl text-sm font-mono font-semibold text-rose-600 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 transition-all"
                />
                <p className="text-xs text-slate-500 mt-1 font-normal">
                  คิดเป็น{' '}
                  <span className="font-mono font-medium text-slate-800">
                    {ruleSampleQty > 0 ? ((ruleAcceptDefectQty / ruleSampleQty) * 100).toFixed(2) : 0}%
                  </span>{' '}
                  Defect ยินยอม
                </p>
              </div>

              {/* Modal Footer */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsRuleModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-sm rounded-xl transition-all cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-medium text-sm rounded-xl shadow-sm transition-all cursor-pointer flex items-center gap-2"
                >
                  💾 บันทึกเกณฑ์สุ่มตรวจ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
