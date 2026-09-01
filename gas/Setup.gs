function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  const sheetsToSetup = [
    { name: "Customers", headers: SCHEMA_HEADERS_MAP["Customers"] },
    { name: "Products", headers: SCHEMA_HEADERS_MAP["Products"] },
    { name: "Orders", headers: SCHEMA_HEADERS_MAP["Orders"] },
    { name: "OrderLines", headers: SCHEMA_HEADERS_MAP["OrderLines"] },
    { name: "WipPrepItems", headers: SCHEMA_HEADERS_MAP["WipPrepItems"] },
    { name: "Plans", headers: SCHEMA_HEADERS_MAP["Plans"] },
    { name: "Allocations", headers: SCHEMA_HEADERS_MAP["Allocations"] },
    { name: "BoardNotes", headers: SCHEMA_HEADERS_MAP["BoardNotes"] },
    { name: "ProductionActualEntries", headers: SCHEMA_HEADERS_MAP["ProductionActualEntries"] }
  ];

  sheetsToSetup.forEach(config => {
    let sheet = ss.getSheetByName(config.name);
    if (!sheet) {
      sheet = ss.insertSheet(config.name);
    }
    
    // Ensure header row is set and formatted
    if (sheet.getLastColumn() < config.headers.length || sheet.getLastRow() < 1) {
      const range = sheet.getRange(1, 1, 1, config.headers.length);
      range.setValues([config.headers]);
      range.setFontWeight("bold");
      range.setBackground("#f3f4f6");
      sheet.setFrozenRows(1);
    } else {
      // Repair header row 1 if missing or out of sync
      const currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      if (!currentHeaders || currentHeaders.filter(Boolean).length === 0) {
        const range = sheet.getRange(1, 1, 1, config.headers.length);
        range.setValues([config.headers]);
        range.setFontWeight("bold");
        range.setBackground("#f3f4f6");
        sheet.setFrozenRows(1);
      }
    }
  });

  // Remove default "Sheet1" or "เธเธตเธ•1" if present and we have other sheets
  const defaultSheet = ss.getSheetByName("Sheet1") || ss.getSheetByName("เธเธตเธ•1");
  if (defaultSheet && ss.getSheets().length > 1) {
    try {
      ss.deleteSheet(defaultSheet);
    } catch (e) {
      console.log("Could not delete default sheet:", e);
    }
  }

  try {
    const ui = SpreadsheetApp.getUi();
    ui.alert("✅ ตั้งค่าฐานข้อมูล 9 ชีต เรียบร้อยแล้ว!\n\nระบบพร้อมใช้งานผ่าน Web App");
  } catch (e) {
    console.log("✅ ตั้งค่าฐานข้อมูล 9 ชีต เรียบร้อยแล้ว! (รันผ่าน Editor)");
  }
}
/**
 * Purchasing System — Database Setup & Header Synchronization Script
 * Single-Spreadsheet / Multi-Spreadsheet Support for Purchasing System
 */

const PURCHASING_SHEET_NAMES = {
  SUPPLIERS: 'DB_Suppliers',
  RM_ITEMS: 'DB_RMItems',
  DEFECT_MATRIX: 'DB_DefectMatrix',
  RECEIVING_RECORDS: 'DB_ReceivingRecords',
  ISSUE_LOGS: 'DB_IssueLogs',
  DEFECT_CATEGORIES: 'DB_DefectCategories',
};

/**
 * Setup Purchasing Database Sheets and Headers
 */
function setupPurchasingDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. DB_Suppliers Sheet
  let supSheet = ss.getSheetByName(PURCHASING_SHEET_NAMES.SUPPLIERS);
  if (!supSheet) {
    supSheet = ss.insertSheet(PURCHASING_SHEET_NAMES.SUPPLIERS);
  }
  const supHeaders = ['id', 'code', 'name', 'phone', 'contactPerson', 'email', 'address', 'createdAt'];
  setupPurchasingSheetHeaders(supSheet, supHeaders, '#10b981');

  // 2. DB_RMItems Sheet
  let rmSheet = ss.getSheetByName(PURCHASING_SHEET_NAMES.RM_ITEMS);
  if (!rmSheet) {
    rmSheet = ss.insertSheet(PURCHASING_SHEET_NAMES.RM_ITEMS);
  }
  const rmHeaders = ['id', 'code', 'name', 'category', 'categoryLabel', 'unit', 'supplierId', 'supplierName', 'supplierIds'];
  setupPurchasingSheetHeaders(rmSheet, rmHeaders, '#0284c7');

  // 3. DB_DefectMatrix Sheet
  let matrixSheet = ss.getSheetByName(PURCHASING_SHEET_NAMES.DEFECT_MATRIX);
  if (!matrixSheet) {
    matrixSheet = ss.insertSheet(PURCHASING_SHEET_NAMES.DEFECT_MATRIX);
  }
  const matrixHeaders = ['category', 'minQty', 'maxQty', 'sampleQty', 'acceptMaxDefectQty', 'acceptMaxDefectPercent'];
  setupPurchasingSheetHeaders(matrixSheet, matrixHeaders, '#7c3aed');

  if (matrixSheet.getLastRow() <= 1) {
    const seedMatrix = [
      ['Type 1', 1, 50, 2, 0.5, 25],
      ['Type 1', 51, 150, 5, 1, 20],
      ['Type 1', 151, 500, 10, 2, 20],
      ['Type 1', 501, 10000, 20, 3, 15],
      ['Type 2', 1, 50, 3, 0.5, 16.67],
      ['Type 2', 51, 150, 8, 1, 12.5],
      ['Type 2', 151, 500, 15, 2, 13.33],
      ['Type 2', 501, 10000, 30, 4, 13.33],
      ['Type 4', 1, 50, 5, 0.5, 10],
      ['Type 4', 51, 150, 10, 1, 10],
      ['Type 4', 151, 500, 25, 2, 8],
      ['Type 4', 501, 10000, 50, 4, 8],
    ];
    matrixSheet.getRange(2, 1, seedMatrix.length, matrixHeaders.length).setValues(seedMatrix);
  }

  // 4. DB_DefectCategories Sheet
  let defectCatSheet = ss.getSheetByName(PURCHASING_SHEET_NAMES.DEFECT_CATEGORIES);
  if (!defectCatSheet) {
    defectCatSheet = ss.insertSheet(PURCHASING_SHEET_NAMES.DEFECT_CATEGORIES);
  }
  const defectCatHeaders = ['id', 'name', 'description', 'isActive'];
  setupPurchasingSheetHeaders(defectCatSheet, defectCatHeaders, '#e11d48');

  if (defectCatSheet.getLastRow() <= 1) {
    const seedDefectCats = [
      ['DEF-01', 'สิ่งแปลกปลอม (Foreign Objects)', 'พบเศษหิน ไม้ แมลง หรือสิ่งแปลกปลอมในวัตถุดิบ', true],
      ['DEF-02', 'กายภาพ/สี/กลิ่น (Physical/Color/Odor)', 'สีเพี้ยน กลิ่นหืน เน่าเสีย หรือผิดปกติ', true],
      ['DEF-03', 'น้ำหนัก/บรรจุภัณฑ์ (Weight/Packaging)', 'น้ำหนักขาด บรรจุภัณฑ์ฉีกขาด หรือชำรุด', true],
      ['DEF-04', 'อุณหภูมิ/ความชื้น (Temp/Moisture)', 'อุณหภูมิขนส่งสูงเกินเกณฑ์ หรือความชื้นสูง', true],
    ];
    defectCatSheet.getRange(2, 1, seedDefectCats.length, defectCatHeaders.length).setValues(seedDefectCats);
  }

  // 5. DB_ReceivingRecords Sheet
  let recSheet = ss.getSheetByName(PURCHASING_SHEET_NAMES.RECEIVING_RECORDS);
  if (!recSheet) {
    recSheet = ss.insertSheet(PURCHASING_SHEET_NAMES.RECEIVING_RECORDS);
  }
  const recHeaders = [
    'id', 'billNo', 'receiveDate', 'supplierId', 'supplierName',
    'rmId', 'rmName', 'rmCategory', 'receiveQty', 'sampleQty',
    'defectQty', 'defectPercent', 'isPass', 'remark', 'createdAt', 'hasIssueLog',
    'postProductionDefectQty', 'postProductionRemark', 'postProductionDate', 'unitPrice',
    'attachments'
  ];
  setupPurchasingSheetHeaders(recSheet, recHeaders, '#059669');

  // 6. DB_IssueLogs Sheet
  let issueSheet = ss.getSheetByName(PURCHASING_SHEET_NAMES.ISSUE_LOGS);
  if (!issueSheet) {
    issueSheet = ss.insertSheet(PURCHASING_SHEET_NAMES.ISSUE_LOGS);
  }
  const issueHeaders = [
    'id', 'receivingRecordId', 'supplierId', 'supplierName',
    'rmId', 'rmName', 'billNo', 'issueDate', 'problemQty',
    'defectCategory', 'problemsFound', 'correctiveAction', 'status', 'createdAt'
  ];
  setupPurchasingSheetHeaders(issueSheet, issueHeaders, '#dc2626');

  // 7. Audit_Logs Sheet (Audit Trail)
  let auditSheet = ss.getSheetByName('Audit_Logs');
  if (!auditSheet) {
    auditSheet = ss.insertSheet('Audit_Logs');
  }
  const auditHeaders = [
    'Timestamp', 'Action', 'Module', 'Record ID / Target',
    'Action Details', 'Client IP', 'Device & OS', 'User Session'
  ];
  setupPurchasingSheetHeaders(auditSheet, auditHeaders, '#0f172a');

  try {
    SpreadsheetApp.getActiveSpreadsheet().toast('✅ ตั้งค่าตารางฐานข้อมูลระบบจัดซื้อสำเร็จ!', 'Purchasing System', 5);
  } catch (e) {
    console.log('✅ ตั้งค่าตารางฐานข้อมูลระบบจัดซื้อสำเร็จ! (รันผ่าน Editor)');
  }
}

/**
 * Clean & Sync Headers for all Purchasing Sheets
 */
function syncAndSanitizePurchasingSheets() {
  setupPurchasingDatabase();
  try {
    SpreadsheetApp.getActiveSpreadsheet().toast('🔄 ล้างและซิงค์หัวตารางระบบจัดซื้อสำเร็จ!', 'Purchasing System', 5);
  } catch (e) {
    console.log('🔄 ล้างและซิงค์หัวตารางระบบจัดซื้อสำเร็จ! (รันผ่าน Editor)');
  }
}

/**
 * Format Sheet Headers with Custom Color and Bold Styling
 */
function setupPurchasingSheetHeaders(sheet, headers, hexColor) {
  const currentMaxCols = sheet.getMaxColumns();
  if (currentMaxCols < headers.length) {
    sheet.insertColumnsAfter(currentMaxCols, headers.length - currentMaxCols);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  } else {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange
    .setFontWeight('bold')
    .setBackground(hexColor)
    .setFontColor('#ffffff')
    .setHorizontalAlignment('center');

  sheet.setFrozenRows(1);
}

/**
 * Run this function from Apps Script Editor or Menu to authorize Google Drive!
 */
function testDriveAuth() {
  const folder = getOrCreateReceivingAttachmentsFolder();
  Logger.log('✅ Google Drive is authorized! Attachments folder ID: ' + folder.getId());
  SpreadsheetApp.getActiveSpreadsheet().toast('✅ อนุญาตสิทธิ์ Google Drive สำเร็จแล้ว! โฟลเดอร์ RM_Receiving_Attachments พร้อมใช้งาน', 'Purchasing System', 6);
  return folder.getId();
}
