export interface Supplier {
  id: string;
  code: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface RMItem {
  id: string;
  code: string;
  name: string;
  category: string;
  categoryLabel: string;
  supplierId: string;
  supplierName: string;
  supplierIds?: string[];
  unit: string;
}

export interface DefectRule {
  minQty: number;
  maxQty: number;
  sampleQty: number;
  acceptMaxDefectQty: number;
  acceptMaxDefectPercent: number;
}

export interface EvaluationResult {
  sampleQty: number;
  acceptMaxDefectQty: number;
  defectPercent: number;
  isPass: boolean;
  ruleMatched?: DefectRule;
}

export interface ReceivingAttachmentItem {
  id: string;
  name?: string;
  url: string;
  driveViewUrl?: string;
  downloadUrl?: string;
  mimeType?: string;
  uploadedAt?: string;
  sizeBytes?: number;
}

export interface ReceivingRecord {
  id: string;
  billNo: string;
  receiveDate: string;
  supplierId: string;
  supplierName: string;
  rmId: string;
  rmName: string;
  rmCategory: string;
  receiveQty: number;
  sampleQty: number;
  defectQty: number;
  defectPercent: number;
  isPass: boolean;
  unitPrice?: number;
  remark?: string;
  createdAt: string;
  hasIssueLog?: boolean;
  postProductionDefectQty?: number;
  postProductionRemark?: string;
  postProductionDate?: string;
  attachments?: (string | ReceivingAttachmentItem)[];
}

export function normalizeAttachmentItem(item: string | ReceivingAttachmentItem): ReceivingAttachmentItem {
  if (typeof item === 'string') {
    const str = item.trim();
    let fileId = '';
    const dMatch = str.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (dMatch && dMatch[1]) {
      fileId = dMatch[1];
    } else {
      const idMatch = str.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (idMatch && idMatch[1]) {
        fileId = idMatch[1];
      }
    }

    if (fileId) {
      return {
        id: fileId,
        name: `RM-Attachment-${fileId.slice(0, 6)}.jpg`,
        url: `https://lh3.googleusercontent.com/d/${fileId}`,
        driveViewUrl: `https://drive.google.com/file/d/${fileId}/view?usp=drivesdk`,
        uploadedAt: new Date().toISOString(),
      };
    }

    return {
      id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: 'รูปภาพแนบ',
      url: str,
      driveViewUrl: str.startsWith('http') ? str : undefined,
      uploadedAt: new Date().toISOString(),
    };
  }

  if (typeof item === 'object' && item !== null) {
    const driveUrl = item.driveViewUrl || (typeof item.url === 'string' && item.url.startsWith('http') ? item.url : '');
    let fileId = item.id || '';
    if (!fileId || fileId.startsWith('att-')) {
      const dMatch = driveUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (dMatch && dMatch[1]) {
        fileId = dMatch[1];
      } else {
        const idMatch = driveUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (idMatch && idMatch[1]) {
          fileId = idMatch[1];
        }
      }
    }

    return {
      id: fileId || item.id || `att-${Date.now()}`,
      name: item.name || (fileId ? `RM-Attachment-${fileId.slice(0, 6)}.jpg` : 'รูปภาพแนบ'),
      url: item.url || (fileId ? `https://lh3.googleusercontent.com/d/${fileId}` : ''),
      driveViewUrl: item.driveViewUrl || (fileId ? `https://drive.google.com/file/d/${fileId}/view?usp=drivesdk` : undefined),
      uploadedAt: item.uploadedAt || new Date().toISOString(),
      sizeBytes: item.sizeBytes,
    };
  }

  return item;
}

export interface DefectCategoryItem {
  id: string;
  name: string;
  description?: string;
  isActive?: boolean;
}

export const DEFECT_CATEGORIES = [
  'สิ่งแปลกปลอม / สิ่งปนเปื้อน (Foreign Matters / Pests)',
  'คุณภาพเสื่อมสภาพ / สดไม่ได้มาตรฐาน (Degradation / Freshness)',
  'ขนาด / สเปกไม่ได้มาตรฐาน (Non-conformance / Off-Spec)',
  'บรรจุภัณฑ์และการขนส่ง (Packaging & Transport Issues)',
  'อื่น ๆ (Others)',
] as const;

export type DefectCategory = (typeof DEFECT_CATEGORIES)[number];

export interface IssueLogRecord {
  id: string;
  receivingRecordId?: string;
  supplierId: string;
  supplierName: string;
  rmId: string;
  rmName: string;
  billNo: string;
  issueDate: string;
  problemQty: number;
  defectCategory: DefectCategory | string;
  problemsFound: string;
  correctiveAction: string;
  status: 'Open' | 'In Progress' | 'Resolved';
  createdAt: string;
}

export function formatPhoneNumber(phone?: string | number): string {
  if (!phone && phone !== 0) return '-';
  let str = String(phone).trim();
  if (!str) return '-';
  if (/^[1-9]/.test(str)) {
    str = '0' + str;
  }
  return str;
}

// 1. Mock Suppliers Data
export const MOCK_SUPPLIERS: Supplier[] = [];

// 2. Mock RM List (Empty by default — all data fetched from GAS Google Sheet)
export const MOCK_RM_ITEMS: RMItem[] = [];

// 3. Defect Matrix Rules (SD-PC-03 R01)

/**
 * Calculates Sample Qty and evaluates Pass/Fail based on Category and Receive Qty.
 */
export function calculateDefectResult(
  category: string,
  receiveQty: number,
  defectQty: number = 0,
  customMatrix: Record<string, DefectRule[]>
): EvaluationResult {
  // Type 3 is auto-pass without sampling
  if (category === 'Type 3') {
    return {
      sampleQty: 0,
      acceptMaxDefectQty: 0,
      defectPercent: 0,
      isPass: true,
    };
  }

  if (!receiveQty || receiveQty <= 0) {
    return {
      sampleQty: 0,
      acceptMaxDefectQty: 0,
      defectPercent: 0,
      isPass: true,
    };
  }

  const matrix = customMatrix || {};
  const rules = matrix[category] || [];
  
  // Find rule where receiveQty falls within minQty and maxQty
  let matchedRule = rules.find(
    (rule) => receiveQty >= rule.minQty && receiveQty <= rule.maxQty
  );

  // Fallback matching if receiveQty is between defined matrix ranges
  if (!matchedRule && rules.length > 0) {
    const firstRule = rules[0];
    const lastRule = rules[rules.length - 1];
    if (firstRule && receiveQty < firstRule.minQty) {
      matchedRule = firstRule;
    } else if (lastRule && receiveQty > lastRule.maxQty) {
      matchedRule = lastRule;
    } else {
      // Find closest lower bracket
      for (let i = 0; i < rules.length - 1; i++) {
        const curr = rules[i];
        const next = rules[i + 1];
        if (curr && next && receiveQty > curr.maxQty && receiveQty < next.minQty) {
          matchedRule = curr;
          break;
        }
      }
      if (!matchedRule) {
        matchedRule = lastRule;
      }
    }
  }

  const sampleQty = matchedRule ? matchedRule.sampleQty : 2;
  const acceptMaxDefectQty = matchedRule ? matchedRule.acceptMaxDefectQty : 0;

  // Calculate % Defect = (Defect Qty / Sample Qty) * 100
  const defectPercent = sampleQty > 0 ? (defectQty / sampleQty) * 100 : 0;
  
  // Evaluate PASS if Defect Qty <= acceptMaxDefectQty
  const isPass = defectQty <= acceptMaxDefectQty;

  return {
    sampleQty,
    acceptMaxDefectQty,
    defectPercent: Number(defectPercent.toFixed(2)),
    isPass,
    ruleMatched: matchedRule,
  };
}

// 4. Extended Mock Historical Analytics Data
export const MOCK_ANALYTICS_RECEIVING_RECORDS: ReceivingRecord[] = [
  // July 2026
  {
    id: 'REC-202607-01',
    billNo: 'BILL-2026-0701',
    receiveDate: '2026-07-28',
    supplierId: 'sup-05',
    supplierName: 'สามารถ จงจำ',
    rmId: 'rm-01',
    rmName: 'ใบตอง',
    rmCategory: 'Type 2',
    receiveQty: 200,
    sampleQty: 6,
    defectQty: 1.5,
    defectPercent: 25,
    isPass: false,
    unitPrice: 20,
    remark: 'พบสิ่งแปลกปลอมและขี้หนู',
    createdAt: '2026-07-28T09:00:00Z',
    hasIssueLog: true,
  },
  {
    id: 'REC-202607-02',
    billNo: 'BILL-2026-0702',
    receiveDate: '2026-07-25',
    supplierId: 'sup-05',
    supplierName: 'สามารถ จงจำ',
    rmId: 'rm-01',
    rmName: 'ใบตอง',
    rmCategory: 'Type 2',
    receiveQty: 180,
    sampleQty: 6,
    defectQty: 1.2,
    defectPercent: 20,
    isPass: false,
    unitPrice: 22,
    remark: 'พบแมลงและใบช้ำเกินเกณฑ์',
    createdAt: '2026-07-25T10:15:00Z',
    hasIssueLog: true,
  },
  {
    id: 'REC-202607-03',
    billNo: 'BILL-2026-0703',
    receiveDate: '2026-07-22',
    supplierId: 'sup-06',
    supplierName: 'บริษัท กอเงินออร์แกนิคฟาร์ม จำกัด',
    rmId: 'rm-02',
    rmName: 'ข่า',
    rmCategory: 'Type 1',
    receiveQty: 250,
    sampleQty: 20,
    defectQty: 1.0,
    defectPercent: 5,
    isPass: true,
    unitPrice: 35,
    remark: 'คุณภาพสมบูรณ์',
    createdAt: '2026-07-22T08:30:00Z',
  },
  {
    id: 'REC-202607-04',
    billNo: 'BILL-2026-0704',
    receiveDate: '2026-07-18',
    supplierId: 'sup-08',
    supplierName: 'อนุพงษ์ ด้วงพลู',
    rmId: 'rm-03',
    rmName: 'เนื้อมะพร้าวอ่อน',
    rmCategory: 'Type 1',
    receiveQty: 200,
    sampleQty: 20,
    defectQty: 2.0,
    defectPercent: 10,
    isPass: true,
    unitPrice: 40,
    remark: 'เนื้อมะพร้าวนุ่ม ตรงตาม Spec',
    createdAt: '2026-07-18T11:00:00Z',
  },
  {
    id: 'REC-202607-05',
    billNo: 'BILL-2026-0705',
    receiveDate: '2026-07-14',
    supplierId: 'sup-15',
    supplierName: 'วัลยา ปัททุม',
    rmId: 'rm-04',
    rmName: 'ใบมะกรูด',
    rmCategory: 'Type 2',
    receiveQty: 20,
    sampleQty: 4,
    defectQty: 0.8,
    defectPercent: 20,
    isPass: true,
    unitPrice: 50,
    remark: 'ใบสด ไม่มีแมลง',
    createdAt: '2026-07-14T09:45:00Z',
  },
  {
    id: 'REC-202607-06',
    billNo: 'BILL-2026-0706',
    receiveDate: '2026-07-10',
    supplierId: 'sup-42',
    supplierName: 'สมชาย ประมงไทย',
    rmId: 'rm-05',
    rmName: 'ปลาทู',
    rmCategory: 'Type 4',
    receiveQty: 300,
    sampleQty: 13,
    defectQty: 1.5,
    defectPercent: 11.54,
    isPass: true,
    unitPrice: 65,
    remark: 'ปลาสด นวดเย็นเรียบร้อย',
    createdAt: '2026-07-10T07:15:00Z',
  },
  // June 2026
  {
    id: 'REC-202606-01',
    billNo: 'BILL-2026-0601',
    receiveDate: '2026-06-29',
    supplierId: 'sup-05',
    supplierName: 'สามารถ จงจำ',
    rmId: 'rm-01',
    rmName: 'ใบตอง',
    rmCategory: 'Type 2',
    receiveQty: 220,
    sampleQty: 6,
    defectQty: 1.8,
    defectPercent: 30,
    isPass: false,
    unitPrice: 19,
    remark: 'พบคราบดินและขี้หนู',
    createdAt: '2026-06-29T10:00:00Z',
    hasIssueLog: true,
  },
  {
    id: 'REC-202606-02',
    billNo: 'BILL-2026-0602',
    receiveDate: '2026-06-20',
    supplierId: 'sup-06',
    supplierName: 'บริษัท กอเงินออร์แกนิคฟาร์ม จำกัด',
    rmId: 'rm-02',
    rmName: 'ข่า',
    rmCategory: 'Type 1',
    receiveQty: 180,
    sampleQty: 20,
    defectQty: 1.5,
    defectPercent: 7.5,
    isPass: true,
    unitPrice: 33,
    remark: 'ผ่านเกณฑ์มาตรฐาน',
    createdAt: '2026-06-20T09:30:00Z',
  },
  {
    id: 'REC-202606-03',
    billNo: 'BILL-2026-0603',
    receiveDate: '2026-06-15',
    supplierId: 'sup-08',
    supplierName: 'อนุพงษ์ ด้วงพลู',
    rmId: 'rm-03',
    rmName: 'เนื้อมะพร้าวอ่อน',
    rmCategory: 'Type 1',
    receiveQty: 150,
    sampleQty: 5,
    defectQty: 1.5,
    defectPercent: 30,
    isPass: false,
    unitPrice: 42,
    remark: 'พบเนื้อมะพร้าวแก่เกินไป 1.5 kg',
    createdAt: '2026-06-15T11:20:00Z',
    hasIssueLog: true,
  },
  // May 2026
  {
    id: 'REC-202605-01',
    billNo: 'BILL-2026-0501',
    receiveDate: '2026-05-24',
    supplierId: 'sup-15',
    supplierName: 'วัลยา ปัททุม',
    rmId: 'rm-04',
    rmName: 'ใบมะกรูด',
    rmCategory: 'Type 2',
    receiveQty: 18,
    sampleQty: 4,
    defectQty: 0.5,
    defectPercent: 12.5,
    isPass: true,
    unitPrice: 45,
    remark: 'ใบสดสวยงาม',
    createdAt: '2026-05-24T08:40:00Z',
  },
  {
    id: 'REC-202605-02',
    billNo: 'BILL-2026-0502',
    receiveDate: '2026-05-18',
    supplierId: 'sup-42',
    supplierName: 'สมชาย ประมงไทย',
    rmId: 'rm-05',
    rmName: 'ปลาทู',
    rmCategory: 'Type 4',
    receiveQty: 250,
    sampleQty: 13,
    defectQty: 3.0,
    defectPercent: 23.08,
    isPass: false,
    unitPrice: 62,
    remark: 'ปลาทูมีกลิ่นอับ น้ำแข็งละลายหมด',
    createdAt: '2026-05-18T07:50:00Z',
    hasIssueLog: true,
  },
  // April 2026
  {
    id: 'REC-202604-01',
    billNo: 'BILL-2026-0401',
    receiveDate: '2026-04-12',
    supplierId: 'sup-06',
    supplierName: 'บริษัท กอเงินออร์แกนิคฟาร์ม จำกัด',
    rmId: 'rm-02',
    rmName: 'ข่า',
    rmCategory: 'Type 1',
    receiveQty: 200,
    sampleQty: 20,
    defectQty: 1.0,
    defectPercent: 5,
    isPass: true,
    unitPrice: 38,
    remark: 'สินค้าได้ Spec ดีเยี่ยม',
    createdAt: '2026-04-12T09:10:00Z',
  },
];

// 5. Mock Analytics Issue Logs
export const MOCK_ANALYTICS_ISSUE_LOGS: IssueLogRecord[] = [
  {
    id: 'ISS-000101',
    receivingRecordId: 'REC-202607-01',
    supplierId: 'sup-05',
    supplierName: 'สามารถ จงจำ',
    rmId: 'rm-01',
    rmName: 'ใบตอง',
    billNo: 'BILL-2026-0701',
    issueDate: '2026-07-28',
    problemQty: 1.5,
    defectCategory: 'สิ่งแปลกปลอม / สิ่งปนเปื้อน (Foreign Matters / Pests)',
    problemsFound: 'ใบตองพบขี้หนูและรอยกัดเจาะของแมลง เกินเกณฑ์ยอมรับ (1.5 kg / สุ่ม 6 kg)',
    correctiveAction: 'แจ้งหักบิล และกำชับสวนเรื่องความสะอาดของมัดใบตอง',
    status: 'Open',
    createdAt: '2026-07-28T09:15:00Z',
  },
  {
    id: 'ISS-000102',
    receivingRecordId: 'REC-202607-02',
    supplierId: 'sup-05',
    supplierName: 'สามารถ จงจำ',
    rmId: 'rm-01',
    rmName: 'ใบตอง',
    billNo: 'BILL-2026-0702',
    issueDate: '2026-07-25',
    problemQty: 1.2,
    defectCategory: 'สิ่งแปลกปลอม / สิ่งปนเปื้อน (Foreign Matters / Pests)',
    problemsFound: 'พบแมลงคิ้วและพบคราบดินติดมัดใบตอง',
    correctiveAction: 'แจ้งตีคืนมัดสินค้าที่ไม่ผ่านเกณฑ์',
    status: 'In Progress',
    createdAt: '2026-07-25T10:30:00Z',
  },
  {
    id: 'ISS-000103',
    receivingRecordId: 'REC-202606-03',
    supplierId: 'sup-08',
    supplierName: 'อนุพงษ์ ด้วงพลู',
    rmId: 'rm-03',
    rmName: 'เนื้อมะพร้าวอ่อน',
    billNo: 'BILL-2026-0603',
    issueDate: '2026-06-15',
    problemQty: 1.5,
    defectCategory: 'คุณภาพเสื่อมสภาพ / สดไม่ได้มาตรฐาน (Degradation / Freshness)',
    problemsFound: 'พบเนื้อมะพร้าวแก่เกินไป แข็งกระด้างไม่สามารถนำมาแปรรูปได้',
    correctiveAction: 'ส่งคืนสินค้า lot นี้และขอเปลี่ยนสินค้าใหม่',
    status: 'Resolved',
    createdAt: '2026-06-15T11:45:00Z',
  },
  {
    id: 'ISS-000104',
    receivingRecordId: 'REC-202605-02',
    supplierId: 'sup-42',
    supplierName: 'สมชาย ประมงไทย',
    rmId: 'rm-05',
    rmName: 'ปลาทู',
    billNo: 'BILL-2026-0502',
    issueDate: '2026-05-18',
    problemQty: 3.0,
    defectCategory: 'บรรจุภัณฑ์และการขนส่ง (Packaging & Transport Issues)',
    problemsFound: 'น้ำแข็งในถังแช่ละลายหมด ทำให้ปลาทูอุณหภูมิสูงเกิน Spec',
    correctiveAction: 'ปฏิเสธการรับเข้า ตีคืนทั้งล็อต',
    status: 'Resolved',
    createdAt: '2026-05-18T08:15:00Z',
  },
  {
    id: 'ISS-000105',
    supplierId: 'sup-06',
    supplierName: 'บริษัท กอเงินออร์แกนิคฟาร์ม จำกัด',
    rmId: 'rm-02',
    rmName: 'ข่า',
    billNo: 'BILL-2026-0410',
    issueDate: '2026-04-10',
    problemQty: 2.0,
    defectCategory: 'ขนาด / สเปกไม่ได้มาตรฐาน (Non-conformance / Off-Spec)',
    problemsFound: 'ข่ามีขนาดเล็กกว่า Specification (เล็กกว่า 3 cm)',
    correctiveAction: 'คัดแยกใช้งานเฉพาะส่วนที่ได้ขนาด และแจ้งเตือนฟาร์ม',
    status: 'Resolved',
    createdAt: '2026-04-10T14:00:00Z',
  },
];

// 5. Utility: Export Data Array to CSV File
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function exportToCSV(filename: string, rows: Record<string, any>[]) {
  const firstRow = rows && rows.length ? rows[0] : null;
  if (!firstRow) {
    alert('ไม่มีข้อมูลสำหรับดาวน์โหลด');
    return;
  }

  const separator = ',';
  const keys = Object.keys(firstRow);

  const csvContent =
    '\uFEFF' + // UTF-8 BOM for Excel Thai language rendering
    keys.join(separator) +
    '\n' +
    rows
      .map((row) => {
        return keys
          .map((k) => {
            let cell = row[k] === null || row[k] === undefined ? '' : row[k];
            cell = cell instanceof Date ? cell.toLocaleString() : cell.toString();
            cell = cell.replace(/"/g, '""');
            if (cell.search(/("|,|\n)/g) >= 0) {
              cell = `"${cell}"`;
            }
            return cell;
          })
          .join(separator);
      })
      .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
