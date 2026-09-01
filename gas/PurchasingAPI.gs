/**
 * Purchasing System — Google Apps Script Data Backend Service
 * Handles reading & writing for Suppliers, RMItems, QC Sampling Matrix, Receiving Records & QC Issue Logs
 */

/**
 * Get All Master & Transaction Data for Purchasing Module
 * Each section is wrapped in its own try/catch for resilience.
 * Returns _meta with source info for frontend debugging.
 */

// -------------------------------------------------------------
// CACHE SERVICE UTILITIES (Speed up initial data loading)
// -------------------------------------------------------------
const PURCHASING_CACHE_KEY = 'purchasing_initial_data_v1';

function clearPurchasingCache() {
  try {
    const cache = CacheService.getScriptCache();
    cache.remove(PURCHASING_CACHE_KEY);
    const chunksStr = cache.get(PURCHASING_CACHE_KEY + '_chunks');
    if (chunksStr) {
      const chunks = parseInt(chunksStr, 10);
      const keys = [];
      for (let i = 0; i < chunks; i++) {
        keys.push(PURCHASING_CACHE_KEY + '_chunk_' + i);
      }
      keys.push(PURCHASING_CACHE_KEY + '_chunks');
      cache.removeAll(keys);
    }
  } catch (e) {
    Logger.log('Cache clear failed: ' + e.toString());
  }
}

function setPurchasingCache(dataString) {
  try {
    const cache = CacheService.getScriptCache();
    const expiration = 21600; // 6 hours (Max allowed by GAS)
    const chunkSize = 100000; // 100KB max per chunk
    
    if (dataString.length <= chunkSize) {
      cache.put(PURCHASING_CACHE_KEY, dataString, expiration);
      return;
    }
    
    const chunks = Math.ceil(dataString.length / chunkSize);
    const cacheObj = {};
    for (let i = 0; i < chunks; i++) {
      cacheObj[PURCHASING_CACHE_KEY + '_chunk_' + i] = dataString.substring(i * chunkSize, (i + 1) * chunkSize);
    }
    cacheObj[PURCHASING_CACHE_KEY + '_chunks'] = chunks.toString();
    cache.putAll(cacheObj, expiration);
  } catch (e) {
    Logger.log('Cache put failed: ' + e.toString());
  }
}

function getPurchasingCache() {
  try {
    const cache = CacheService.getScriptCache();
    const single = cache.get(PURCHASING_CACHE_KEY);
    if (single) return single;
    
    const chunksStr = cache.get(PURCHASING_CACHE_KEY + '_chunks');
    if (!chunksStr) return null;
    
    const chunks = parseInt(chunksStr, 10);
    const keys = [];
    for (let i = 0; i < chunks; i++) {
      keys.push(PURCHASING_CACHE_KEY + '_chunk_' + i);
    }
    
    const chunkData = cache.getAll(keys);
    let result = '';
    for (let i = 0; i < chunks; i++) {
      const chunk = chunkData[PURCHASING_CACHE_KEY + '_chunk_' + i];
      if (!chunk) return null;
      result += chunk;
    }
    return result;
  } catch (e) {
    return null;
  }
}

function getPurchasingInitialData(forceRefresh) {
  if (forceRefresh) {
    clearPurchasingCache();
  } else {
    const cachedDataStr = getPurchasingCache();
    if (cachedDataStr) {
      try {
        const parsed = JSON.parse(cachedDataStr);
        parsed._meta.cacheHit = true;
        return parsed;
      } catch(e) {}
    }
  }

  const errors = [];
  let suppliers = [];
  let rmItems = [];
  let defectMatrix = {};
  let defectCategories = [];
  let formattedReceiving = [];
  let formattedIssues = [];

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Auto-setup if essential sheet is missing
    if (!ss.getSheetByName('DB_Suppliers') || !ss.getSheetByName('DB_DefectMatrix') || !ss.getSheetByName('DB_DefectCategories') || !ss.getSheetByName('Audit_Logs')) {
      setupPurchasingDatabase();
    }

    // --- Suppliers ---
    try {
      const rawSuppliers = getSheetDataAsObjects(ss, 'DB_Suppliers') || [];
      suppliers = rawSuppliers.map((s) => {
        let codeStr = s.code != null ? String(s.code).trim() : '';
        let p = s.phone != null ? String(s.phone).trim() : '';
        if (p && /^[1-9]/.test(p)) {
          p = '0' + p;
        }
        return { ...s, code: codeStr, phone: p };
      });
    } catch (e) {
      errors.push('Suppliers: ' + e.toString());
    }

    // --- RM Items ---
    try {
      const rawRms = getSheetDataAsObjects(ss, 'DB_RMItems') || [];
      rmItems = rawRms.map((rm) => {
        let parsedSupplierIds = [rm.supplierId || ''];
        if (typeof rm.supplierIds === 'string' && rm.supplierIds.trim() !== '') {
          try {
            parsedSupplierIds = JSON.parse(rm.supplierIds);
          } catch (e2) {
            parsedSupplierIds = rm.supplierIds.split(',').map(s => s.trim()).filter(s => s !== '');
          }
        } else if (Array.isArray(rm.supplierIds)) {
          parsedSupplierIds = rm.supplierIds;
        }
        return {
          id: rm.id || '',
          code: rm.code != null ? String(rm.code) : '',
          name: rm.name || '',
          category: rm.category != null ? String(rm.category).trim() : '',
          categoryLabel: rm.categoryLabel != null ? String(rm.categoryLabel).trim() : '',
          unit: rm.unit || '',
          supplierId: rm.supplierId || '',
          supplierName: rm.supplierName || '',
          supplierIds: parsedSupplierIds,
        };
      });
    } catch (e) {
      errors.push('RMItems: ' + e.toString());
    }

    // --- Defect Matrix ---
    try {
      const rawMatrix = getSheetDataAsObjects(ss, 'DB_DefectMatrix') || [];
      rawMatrix.forEach((rule) => {
        const cat = rule.category;
        if (!defectMatrix[cat]) defectMatrix[cat] = [];
        defectMatrix[cat].push({
          minQty: Number(rule.minQty),
          maxQty: Number(rule.maxQty),
          sampleQty: Number(rule.sampleQty),
          acceptMaxDefectQty: Number(rule.acceptMaxDefectQty),
          acceptMaxDefectPercent: Number(rule.acceptMaxDefectPercent),
        });
      });
    } catch (e) {
      errors.push('DefectMatrix: ' + e.toString());
    }

    // --- Defect Categories (Master Data) ---
    try {
      const rawDefectCats = getSheetDataAsObjects(ss, 'DB_DefectCategories') || [];
      defectCategories = rawDefectCats.map((c) => ({
        id: String(c.id || ''),
        name: String(c.name || ''),
        description: String(c.description || ''),
        isActive: c.isActive !== false && String(c.isActive).toLowerCase() !== 'false',
      }));
    } catch (e) {
      errors.push('DefectCategories: ' + e.toString());
    }

    // --- Receiving Records ---
    try {
      ensureReceivingRecordsSheet(ss);
      const receivingRecords = getSheetDataAsObjects(ss, 'DB_ReceivingRecords') || [];
      const seenIds = new Set();
      formattedReceiving = [];
      receivingRecords.forEach((r) => {
        const recId = String(r.id || '').trim();
        if (recId && !seenIds.has(recId)) {
          seenIds.add(recId);
          const parsedAttachments = parseAttachmentsFromSheet(r.attachments);
          formattedReceiving.push({
            ...r,
            receiveQty: Number(r.receiveQty),
            sampleQty: Number(r.sampleQty),
            defectQty: Number(r.defectQty),
            defectPercent: Number(r.defectPercent),
            isPass: String(r.isPass).toLowerCase() === 'true' || r.isPass === true,
            hasIssueLog: String(r.hasIssueLog).toLowerCase() === 'true' || r.hasIssueLog === true,
            postProductionDefectQty: r.postProductionDefectQty !== undefined && r.postProductionDefectQty !== '' ? Number(r.postProductionDefectQty) : undefined,
            postProductionRemark: r.postProductionRemark || '',
            postProductionDate: r.postProductionDate || '',
            unitPrice: r.unitPrice !== undefined && r.unitPrice !== '' ? Number(r.unitPrice) : undefined,
            attachments: parsedAttachments,
          });
        }
      });
    } catch (e) {
      errors.push('ReceivingRecords: ' + e.toString());
    }

    // --- Issue Logs ---
    try {
      const issueLogs = getSheetDataAsObjects(ss, 'DB_IssueLogs') || [];
      formattedIssues = issueLogs.map((i) => ({
        ...i,
        problemQty: Number(i.problemQty),
      }));
    } catch (e) {
      errors.push('IssueLogs: ' + e.toString());
    }

    const payload = {
      status: 'success',
      _meta: {
        source: 'google_sheet',
        timestamp: new Date().toISOString(),
        counts: {
          suppliers: suppliers.length,
          rmItems: rmItems.length,
          defectMatrixCategories: Object.keys(defectMatrix).length,
          defectCategories: defectCategories.length,
          receivingRecords: formattedReceiving.length,
          issueLogs: formattedIssues.length,
        },
        errors: errors.length > 0 ? errors : undefined,
      },
      data: {
        suppliers: suppliers,
        rmItems: rmItems,
        defectMatrix: defectMatrix,
        defectCategories: defectCategories,
        receivingRecords: formattedReceiving,
        issueLogs: formattedIssues,
      },
    };

    // PURE JSON SANITIZATION to guarantee google.script.run never fails to serialize
    const cleanJsonString = JSON.stringify(payload, function(key, val) {
      if (typeof val === 'number' && (isNaN(val) || !isFinite(val))) {
        return 0;
      }
      return val;
    });

    setPurchasingCache(cleanJsonString);
    return JSON.parse(cleanJsonString);
  } catch (err) {
    return { status: 'error', message: err.toString(), errors: errors };
  }
}

/**
 * Diagnostic: Test RM Items reading from Sheet.
 * Run this from the GAS Script Editor to verify data.
 */
function testPurchasingRMItems() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('DB_RMItems');
  if (!sheet) {
    Logger.log('❌ Sheet DB_RMItems not found');
    return;
  }
  const data = sheet.getDataRange().getValues();
  Logger.log('Headers: ' + JSON.stringify(data[0]));
  Logger.log('Total rows (incl header): ' + data.length);

  for (let i = 1; i < Math.min(data.length, 10); i++) {
    const row = data[i];
    const obj = {};
    for (let j = 0; j < data[0].length; j++) {
      obj[data[0][j]] = row[j];
    }
    Logger.log('Row ' + (i+1) + ': ' + JSON.stringify(obj));
  }

  // Show last 5 rows
  if (data.length > 10) {
    Logger.log('--- Last 5 rows ---');
    for (let i = Math.max(data.length - 5, 1); i < data.length; i++) {
      const row = data[i];
      const obj = {};
      for (let j = 0; j < data[0].length; j++) {
        obj[data[0][j]] = row[j];
      }
      Logger.log('Row ' + (i+1) + ': ' + JSON.stringify(obj));
    }
  }

  // Test getPurchasingInitialData
  Logger.log('--- Full API Response _meta ---');
  const result = getPurchasingInitialData();
  Logger.log('Status: ' + result.status);
  if (result._meta) {
    Logger.log('Meta: ' + JSON.stringify(result._meta));
  }
  if (result.data && result.data.rmItems) {
    const lastItems = result.data.rmItems.slice(-5);
    lastItems.forEach((rm, idx) => {
      Logger.log('RM[' + (result.data.rmItems.length - 5 + idx) + ']: id=' + rm.id + ' name=' + rm.name + ' category=' + rm.category + ' categoryLabel=' + rm.categoryLabel);
    });
  }
}

const RECEIVING_RECORDS_HEADERS = [
  'id', 'billNo', 'receiveDate', 'supplierId', 'supplierName',
  'rmId', 'rmName', 'rmCategory', 'receiveQty', 'sampleQty',
  'defectQty', 'defectPercent', 'isPass', 'remark', 'createdAt', 'hasIssueLog',
  'postProductionDefectQty', 'postProductionRemark', 'postProductionDate', 'unitPrice',
  'attachments'
];

/**
 * Ensure DB_ReceivingRecords sheet exists and has all 21 columns and correct headers.
 */
function ensureReceivingRecordsSheet(ss) {
  let sheet = ss.getSheetByName('DB_ReceivingRecords');
  if (!sheet) {
    sheet = ss.insertSheet('DB_ReceivingRecords');
  }

  const expectedHeaders = RECEIVING_RECORDS_HEADERS;
  const currentMaxCols = sheet.getMaxColumns();
  if (currentMaxCols < expectedHeaders.length) {
    sheet.insertColumnsAfter(currentMaxCols, expectedHeaders.length - currentMaxCols);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(expectedHeaders);
    const hRange = sheet.getRange(1, 1, 1, expectedHeaders.length);
    hRange.setFontWeight('bold').setBackground('#059669').setFontColor('#ffffff').setHorizontalAlignment('center');
    sheet.setFrozenRows(1);
  } else {
    const currentHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), expectedHeaders.length)).getValues()[0];
    const missingOrDifferent = expectedHeaders.some((h, idx) => String(currentHeaders[idx] || '').trim().toLowerCase() !== h.toLowerCase());
    
    if (missingOrDifferent) {
      sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
      const hRange = sheet.getRange(1, 1, 1, expectedHeaders.length);
      hRange.setFontWeight('bold').setBackground('#059669').setFontColor('#ffffff').setHorizontalAlignment('center');
      sheet.setFrozenRows(1);
    }
  }

  return sheet;
}

/**
 * Build a row array for DB_ReceivingRecords mapped dynamically by header names
 */
function buildReceivingRow(record, headers) {
  const targetHeaders = headers || RECEIVING_RECORDS_HEADERS;
  const headerMap = {};
  targetHeaders.forEach((h, idx) => {
    headerMap[String(h).trim()] = idx;
  });

  const row = new Array(targetHeaders.length).fill('');

  const setVal = (key, val) => {
    if (key in headerMap) {
      row[headerMap[key]] = val !== undefined && val !== null ? val : '';
    }
  };

  setVal('id', record.id);
  setVal('billNo', record.billNo);
  setVal('receiveDate', record.receiveDate);
  setVal('supplierId', record.supplierId);
  setVal('supplierName', record.supplierName);
  setVal('rmId', record.rmId);
  setVal('rmName', record.rmName);
  setVal('rmCategory', record.rmCategory);
  setVal('receiveQty', record.receiveQty !== undefined ? record.receiveQty : '');
  setVal('sampleQty', record.sampleQty !== undefined ? record.sampleQty : '');
  setVal('defectQty', record.defectQty !== undefined ? record.defectQty : '');
  setVal('defectPercent', record.defectPercent !== undefined ? record.defectPercent : '');
  setVal('isPass', record.isPass !== undefined ? record.isPass : true);
  setVal('remark', record.remark || '');
  setVal('createdAt', record.createdAt || getThaiTimestamp());
  setVal('hasIssueLog', record.hasIssueLog !== undefined ? record.hasIssueLog : false);
  setVal('postProductionDefectQty', record.postProductionDefectQty !== undefined && record.postProductionDefectQty !== '' ? record.postProductionDefectQty : '');
  setVal('postProductionRemark', record.postProductionRemark || '');
  setVal('postProductionDate', record.postProductionDate || '');
  setVal('unitPrice', record.unitPrice !== undefined && record.unitPrice !== '' ? record.unitPrice : '');
  setVal('attachments', formatAttachmentsForSheet(record.id, record.billNo, record.attachments));

  return row;
}

/**
 * Save New or Edit Receiving Record
 */
function saveReceivingRecord(record, clientMeta) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ensureReceivingRecordsSheet(ss);

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
    const idColIdx = headers.indexOf('id');
    const actualIdCol = idColIdx !== -1 ? idColIdx : 0;

    const data = sheet.getDataRange().getValues();
    let rowIndex = -1;

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][actualIdCol]).trim() === String(record.id).trim()) {
        rowIndex = i + 1;
        break;
      }
    }

    const row = buildReceivingRow(record, headers);

    if (rowIndex > 0) {
      sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
    } else {
      sheet.appendRow(row);
    }

    SpreadsheetApp.flush();
    clearPurchasingCache();

    const detailParts = [
      `Bill: ${record.billNo}`,
      `Date: ${record.receiveDate}`,
      `Supplier: ${record.supplierName} (${record.supplierId})`,
      `RM: ${record.rmName} (${record.rmId}, Cat: ${record.rmCategory})`,
      `Receive Qty: ${record.receiveQty} kg`,
      `Sample Qty: ${record.sampleQty} kg`,
      `Defect Qty: ${record.defectQty} kg (${record.defectPercent}%)`,
      `QC Status: ${record.isPass ? 'PASS' : 'FAIL'}`,
      `Attachments: ${record.attachments ? record.attachments.length : 0} files`,
      `Remark: ${record.remark || '-'}`
    ];
    if (record.postProductionDefectQty !== undefined && record.postProductionDefectQty !== '') {
      detailParts.push(`Post-Prod Defect: ${record.postProductionDefectQty} kg`);
      detailParts.push(`Post-Prod Date: ${record.postProductionDate || '-'}`);
      detailParts.push(`Post-Prod Remark: ${record.postProductionRemark || '-'}`);
    }

    logAuditEntry(
      clientMeta,
      rowIndex > 0 ? 'UPDATE' : 'CREATE',
      'ReceivingRecord',
      record.id,
      detailParts.join(' | ')
    );

    return { status: 'success', data: record };
  } catch (err) {
    Logger.log('saveReceivingRecord error: ' + err.toString());
    return { status: 'error', message: err.toString() };
  }
}

/**
 * Save Multiple Receiving Records (Batch Insert)
 */
function saveReceivingRecordsBatch(records, clientMeta) {
  try {
    if (!records || !Array.isArray(records) || records.length === 0) {
      return { status: 'error', message: 'No records provided' };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ensureReceivingRecordsSheet(ss);

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
    const idColIdx = headers.indexOf('id');
    const actualIdCol = idColIdx !== -1 ? idColIdx : 0;

    const data = sheet.getDataRange().getValues();
    const existingIds = new Map();
    for (let i = 1; i < data.length; i++) {
      const idVal = String(data[i][actualIdCol]).trim();
      if (idVal) existingIds.set(idVal, i + 1);
    }

    const rowsToAppend = [];
    let updatedCount = 0;

    for (const record of records) {
      const row = buildReceivingRow(record, headers);
      const rowIndex = existingIds.get(String(record.id).trim());
      if (rowIndex) {
        sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
        updatedCount++;
      } else {
        rowsToAppend.push(row);
      }
    }

    if (rowsToAppend.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAppend.length, rowsToAppend[0].length).setValues(rowsToAppend);
    }

    SpreadsheetApp.flush();
    clearPurchasingCache();

    const itemSummaries = records.map((r, idx) => 
      `Item #${idx+1}: RM: ${r.rmName} (${r.rmCategory}) | Rec: ${r.receiveQty}kg | Sample: ${r.sampleQty}kg | Defect: ${r.defectQty}kg (${r.defectPercent}%) | QC: ${r.isPass ? 'PASS' : 'FAIL'}${r.remark ? ` | Remark: ${r.remark}` : ''}`
    ).join('\n');

    logAuditEntry(
      clientMeta,
      'CREATE_BATCH',
      'ReceivingRecord',
      `BATCH_${records[0].billNo}`,
      `Bill: ${records[0].billNo} | Date: ${records[0].receiveDate} | Supplier: ${records[0].supplierName} (${records[0].supplierId})\nTotal Items: ${records.length} (${rowsToAppend.length} Created, ${updatedCount} Updated)\nItems List:\n${itemSummaries}`
    );

    return { status: 'success', added: rowsToAppend.length, updated: updatedCount };
  } catch (err) {
    Logger.log('saveReceivingRecordsBatch error: ' + err.toString());
    return { status: 'error', message: err.toString() };
  }
}

/**
 * Direct Save / Update Attachments for a Receiving Record
 */
function saveReceivingAttachments(recordId, attachments, clientMeta) {
  try {
    if (!recordId) return { status: 'error', message: 'recordId is required' };

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ensureReceivingRecordsSheet(ss);

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
    const idColIdx = headers.indexOf('id');
    const attColIdx = headers.indexOf('attachments');

    if (idColIdx === -1 || attColIdx === -1) {
      return { status: 'error', message: 'Required columns not found in sheet' };
    }

    const formattedAttStr = formatAttachmentsForSheet(recordId, '', attachments);

    const data = sheet.getDataRange().getValues();
    let targetRow = -1;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idColIdx]).trim() === String(recordId).trim()) {
        targetRow = i + 1;
        break;
      }
    }

    if (targetRow > 0) {
      sheet.getRange(targetRow, attColIdx + 1).setValue(formattedAttStr);
    }

    SpreadsheetApp.flush();
    clearPurchasingCache();

    logAuditEntry(
      clientMeta,
      'UPDATE_ATTACHMENTS',
      'ReceivingRecord',
      recordId,
      `Attachments updated: ${Array.isArray(attachments) ? attachments.length : 0} files`
    );

    return {
      status: 'success',
      data: {
        recordId: recordId,
        attachments: parseAttachmentsFromSheet(formattedAttStr)
      }
    };
  } catch (err) {
    Logger.log('saveReceivingAttachments error: ' + err.toString());
    return { status: 'error', message: err.toString() };
  }
}

/**
 * Save New or Edit Issue Log Record
 */
function saveIssueLogRecord(record, clientMeta) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('DB_IssueLogs');
    if (!sheet) {
      setupPurchasingDatabase();
      sheet = ss.getSheetByName('DB_IssueLogs');
    }

    const data = sheet.getDataRange().getValues();
    let rowIndex = -1;

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(record.id)) {
        rowIndex = i + 1;
        break;
      }
    }

    const row = [
      record.id,
      record.receivingRecordId || '',
      record.supplierId,
      record.supplierName,
      record.rmId,
      record.rmName,
      record.billNo,
      record.issueDate,
      record.problemQty,
      record.defectCategory,
      record.problemsFound,
      record.correctiveAction || '',
      record.status,
      record.createdAt || getThaiTimestamp(),
    ];

    if (rowIndex > 0) {
      sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
    } else {
      sheet.appendRow(row);
    }

    // Also update hasIssueLog in DB_ReceivingRecords if applicable
    if (record.receivingRecordId) {
      const recSheet = ss.getSheetByName('DB_ReceivingRecords');
      if (recSheet) {
        const recData = recSheet.getDataRange().getValues();
        for (let j = 1; j < recData.length; j++) {
          if (String(recData[j][0]) === String(record.receivingRecordId)) {
            recSheet.getRange(j + 1, 16).setValue(true); // Column 16: hasIssueLog
            break;
          }
        }
      }
    }

    SpreadsheetApp.flush();
    clearPurchasingCache();

    logAuditEntry(
      clientMeta,
      rowIndex > 0 ? 'UPDATE' : 'CREATE',
      'IssueLogRecord',
      record.id,
      `Bill: ${record.billNo} | Issue Date: ${record.issueDate} | Supplier: ${record.supplierName} (${record.supplierId}) | RM: ${record.rmName} (${record.rmId}) | Problem Qty: ${record.problemQty} kg | Defect Category: ${record.defectCategory} | Status: ${record.status} | Problems Found: ${record.problemsFound || '-'} | Corrective Action: ${record.correctiveAction || '-'}${record.receivingRecordId ? ` | Linked Receiving ID: ${record.receivingRecordId}` : ''}`
    );

    return { status: 'success', data: record };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}

function deleteReceivingRecord(id, clientMeta) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('DB_ReceivingRecords');
    if (!sheet) return { status: 'error', message: 'Sheet not found' };

    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(id)) {
        const recData = data[i];
        const detailStr = `Bill: ${recData[1]} | Date: ${recData[2]} | Supplier: ${recData[4]} (${recData[3]}) | RM: ${recData[6]} (${recData[5]}, Cat: ${recData[7]}) | Qty: ${recData[8]} kg | Sample: ${recData[9]} kg | Defect: ${recData[10]} kg (${recData[11]}%) | QC Status: ${recData[12] ? 'PASS' : 'FAIL'} | Remark: ${recData[13] || '-'}`;
        sheet.deleteRow(i + 1);
        SpreadsheetApp.flush();
        clearPurchasingCache();

        logAuditEntry(clientMeta, 'DELETE', 'ReceivingRecord', id, detailStr);

        return { status: 'success' };
      }
    }
    return { status: 'error', message: 'Record not found' };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}

/**
 * Save or Update Supplier
 */
function saveSupplierRecord(supplier, clientMeta) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('DB_Suppliers');
    if (!sheet) {
      setupPurchasingDatabase();
      sheet = ss.getSheetByName('DB_Suppliers');
    }

    const data = sheet.getDataRange().getValues();
    let rowIndex = -1;

    let duplicateCode = false;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(supplier.id)) {
        rowIndex = i + 1;
      }
      if (data[i][1] != null && String(data[i][1]).trim().toLowerCase() === String(supplier.code).trim().toLowerCase()) {
        if (String(data[i][0]) !== String(supplier.id)) {
          duplicateCode = true;
        }
      }
    }

    if (duplicateCode) {
      return { status: 'error', message: 'รหัส Supplier นี้มีในระบบแล้ว กรุณาระบุรหัสใหม่' };
    }

    let suppCode = supplier.code != null ? String(supplier.code).trim() : '';
    let cleanPhone = supplier.phone ? String(supplier.phone).trim() : '';
    if (cleanPhone && /^[1-9]/.test(cleanPhone)) {
      cleanPhone = `0${cleanPhone}`;
    }

    const row = [
      supplier.id,
      suppCode,
      supplier.name,
      cleanPhone,
      supplier.contactPerson || '',
      supplier.email || '',
      supplier.address || '',
      supplier.createdAt || getThaiTimestamp(),
    ];

    if (rowIndex > 0) {
      sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
    } else {
      sheet.appendRow(row);
    }

    // Force Code (Col 2) and Phone (Col 4) columns to text format '@' so leading zeros like '01', '02' are preserved
    const lastRow = rowIndex > 0 ? rowIndex : sheet.getLastRow();
    if (suppCode) {
      sheet.getRange(lastRow, 2).setNumberFormat('@').setValue(suppCode);
    }
    if (cleanPhone) {
      sheet.getRange(lastRow, 4).setNumberFormat('@').setValue(cleanPhone);
    }

    SpreadsheetApp.flush();
    clearPurchasingCache();

    logAuditEntry(
      clientMeta,
      rowIndex > 0 ? 'UPDATE' : 'CREATE',
      'Supplier',
      supplier.id,
      `Code: ${supplier.code} | Name: ${supplier.name} | Phone: ${cleanPhone || '-'} | Contact Person: ${supplier.contactPerson || '-'} | Email: ${supplier.email || '-'} | Address: ${supplier.address || '-'}`
    );

    return { status: 'success', data: supplier };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}

/**
 * Delete Supplier
 */
function deleteSupplierRecord(id, clientMeta) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('DB_Suppliers');
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(id)) {
        const suppData = data[i];
        const detailStr = `Code: ${suppData[1]} | Name: ${suppData[2]} | Phone: ${suppData[3] || '-'} | Contact Person: ${suppData[4] || '-'} | Email: ${suppData[5] || '-'} | Address: ${suppData[6] || '-'}`;
        sheet.deleteRow(i + 1);
        SpreadsheetApp.flush();
        clearPurchasingCache();

        logAuditEntry(clientMeta, 'DELETE', 'Supplier', id, detailStr);

        return { status: 'success', id: id };
      }
    }
    return { status: 'error', message: `Supplier not found: ${id}` };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}

/**
 * Save or Update RM Item
 */
function saveRMRecord(rmItem, clientMeta) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('DB_RMItems');
    const data = sheet.getDataRange().getValues();
    let rowIndex = -1;

    let duplicateCode = false;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(rmItem.id)) {
        rowIndex = i + 1;
      }
      if (data[i][1] != null && String(data[i][1]).trim().toLowerCase() === String(rmItem.code).trim().toLowerCase()) {
        if (String(data[i][0]) !== String(rmItem.id)) {
          duplicateCode = true;
        }
      }
    }

    if (duplicateCode) {
      return { status: 'error', message: 'รหัส RM นี้มีในระบบแล้ว กรุณาระบุรหัสใหม่' };
    }

    let rmCode = rmItem.code != null ? String(rmItem.code).trim() : '';

    const row = [
      rmItem.id,
      rmCode,
      rmItem.name,
      rmItem.category,
      rmItem.categoryLabel,
      rmItem.unit,
      rmItem.supplierId,
      rmItem.supplierName,
      JSON.stringify(rmItem.supplierIds || [rmItem.supplierId]),
    ];

    if (rowIndex > 0) {
      sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
    } else {
      sheet.appendRow(row);
    }

    // Force Code (Col 2) column to text format '@' so leading zeros are preserved
    const lastRow = rowIndex > 0 ? rowIndex : sheet.getLastRow();
    if (rmCode) {
      sheet.getRange(lastRow, 2).setNumberFormat('@').setValue(rmCode);
    }

    SpreadsheetApp.flush();
    clearPurchasingCache();

    const supplierIdsStr = Array.isArray(rmItem.supplierIds) ? rmItem.supplierIds.join(', ') : String(rmItem.supplierIds || '');
    logAuditEntry(
      clientMeta,
      rowIndex > 0 ? 'UPDATE' : 'CREATE',
      'RMItem',
      rmItem.id,
      `Code: ${rmItem.code} | Name: ${rmItem.name} | Category: ${rmItem.categoryLabel || rmItem.category} | Unit: ${rmItem.unit} | Primary Supplier: ${rmItem.supplierName} (${rmItem.supplierId}) | Associated Supplier IDs: [${supplierIdsStr}]`
    );

    return { status: 'success', data: rmItem };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}

/**
 * Delete RM Item
 */
function deleteRMRecord(id, clientMeta) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('DB_RMItems');
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(id)) {
        const rmData = data[i];
        const detailStr = `Code: ${rmData[1]} | Name: ${rmData[2]} | Category: ${rmData[4]} (${rmData[3]}) | Unit: ${rmData[5]} | Primary Supplier: ${rmData[7]} (${rmData[6]})`;
        sheet.deleteRow(i + 1);
        SpreadsheetApp.flush();
        clearPurchasingCache();

        logAuditEntry(clientMeta, 'DELETE', 'RMItem', id, detailStr);

        return { status: 'success', id: id };
      }
    }
    return { status: 'error', message: `RM Item not found: ${id}` };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}

/**
 * Save QC Defect Matrix Rules
 */
function saveDefectMatrixRules(matrix, clientMeta) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('DB_DefectMatrix');
    sheet.clearContents();

    const headers = ['category', 'minQty', 'maxQty', 'sampleQty', 'acceptMaxDefectQty', 'acceptMaxDefectPercent'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

    const rows = [];
    Object.keys(matrix).forEach((cat) => {
      const rules = matrix[cat] || [];
      rules.forEach((r) => {
        rows.push([cat, r.minQty, r.maxQty, r.sampleQty, r.acceptMaxDefectQty, r.acceptMaxDefectPercent]);
      });
    });

    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    }

    SpreadsheetApp.flush();
    clearPurchasingCache();

    const catSummaries = Object.keys(matrix).map(cat => {
      const rules = matrix[cat] || [];
      const ruleStrs = rules.map(r => `Range ${r.minQty}-${r.maxQty}kg -> Sample: ${r.sampleQty}kg, MaxDefect: ${r.acceptMaxDefectQty}kg (${r.acceptMaxDefectPercent}%)`).join('; ');
      return `Category [${cat}] (${rules.length} rules): ${ruleStrs}`;
    }).join('\n');

    logAuditEntry(
      clientMeta,
      'UPDATE',
      'DefectMatrix',
      'ALL_RULES',
      `Updated QC matrix rules for ${Object.keys(matrix).length} categories:\n${catSummaries}`
    );

    return { status: 'success', data: matrix };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}

/**
 * Delete Issue Log Record (Also resets hasIssueLog in DB_ReceivingRecords if applicable)
 */
function deleteIssueLogRecord(id, clientMeta) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('DB_IssueLogs');
    if (!sheet) return { status: 'error', message: 'DB_IssueLogs not found' };
    
    const data = sheet.getDataRange().getValues();
    let deletedReceivingId = null;
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(id)) {
        deletedReceivingId = data[i][1]; // Column 2 (index 1) is receivingRecordId
        const issueData = data[i];
        const detailStr = `Bill: ${issueData[6]} | Issue Date: ${issueData[7]} | Supplier: ${issueData[3]} (${issueData[2]}) | RM: ${issueData[5]} (${issueData[4]}) | Problem Qty: ${issueData[8]} kg | Defect Category: ${issueData[9]} | Status: ${issueData[12]} | Problems: ${issueData[10] || '-'} | Action: ${issueData[11] || '-'}`;
        sheet.deleteRow(i + 1);
        
        // Reset hasIssueLog in DB_ReceivingRecords
        if (deletedReceivingId) {
          const recSheet = ss.getSheetByName('DB_ReceivingRecords');
          if (recSheet) {
            const recData = recSheet.getDataRange().getValues();
            for (let j = 1; j < recData.length; j++) {
              if (String(recData[j][0]) === String(deletedReceivingId)) {
                recSheet.getRange(j + 1, 16).setValue(false); // Column 16: hasIssueLog
                break;
              }
            }
          }
        }
        
        SpreadsheetApp.flush();
        clearPurchasingCache();

        logAuditEntry(clientMeta, 'DELETE', 'IssueLogRecord', id, detailStr);

        return { status: 'success', id: id };
      }
    }
    return { status: 'error', message: `Issue Log not found: ${id}` };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}

/**
 * Save / Update Defect Category (Master Data)
 */
function saveDefectCategory(categoryObj, clientMeta) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('DB_DefectCategories');
    if (!sheet) {
      setupPurchasingDatabase();
      sheet = ss.getSheetByName('DB_DefectCategories');
    }
    const data = sheet.getDataRange().getValues();
    const id = categoryObj.id || 'DEF-' + Date.now();
    const rowData = [
      id,
      categoryObj.name || '',
      categoryObj.description || '',
      categoryObj.isActive !== false
    ];

    let found = false;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(id)) {
        sheet.getRange(i + 1, 1, 1, rowData.length).setValues([rowData]);
        found = true;
        break;
      }
    }
    if (!found) {
      sheet.appendRow(rowData);
    }

    SpreadsheetApp.flush();
    clearPurchasingCache();

    logAuditEntry(
      clientMeta,
      found ? 'UPDATE' : 'CREATE',
      'DefectCategory',
      id,
      `Name: ${categoryObj.name} | Description: ${categoryObj.description || '-'} | Status: ${categoryObj.isActive !== false ? 'Active' : 'Inactive'}`
    );

    return { status: 'success', data: { ...categoryObj, id: id } };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}

/**
 * Delete Defect Category (Master Data)
 */
function deleteDefectCategory(id, clientMeta) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('DB_DefectCategories');
    if (!sheet) return { status: 'error', message: 'DB_DefectCategories not found' };
    
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(id)) {
        const catData = data[i];
        const detailStr = `Name: ${catData[1]} | Description: ${catData[2] || '-'} | Status: ${catData[3] ? 'Active' : 'Inactive'}`;
        sheet.deleteRow(i + 1);
        SpreadsheetApp.flush();
        clearPurchasingCache();

        logAuditEntry(clientMeta, 'DELETE', 'DefectCategory', id, detailStr);

        return { status: 'success', id: id };
      }
    }
    return { status: 'error', message: `Defect Category not found: ${id}` };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}

/**
 * Helper: Convert Sheet to Array of JSON Objects with serialization safety
 */
function getSheetDataAsObjects(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const headers = data[0];
  const results = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    
    // Skip empty rows
    let isEmpty = true;
    for (let k = 0; k < row.length; k++) {
      if (row[k] !== '' && row[k] != null) {
        isEmpty = false;
        break;
      }
    }
    if (isEmpty) continue;

    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      const headerName = String(headers[j]).trim();
      if (!headerName) continue;
      
      let val = row[j];
      if (val instanceof Date) {
        val = Utilities.formatDate(val, "Asia/Bangkok", "yyyy-MM-dd'T'HH:mm:ss'+07:00'");
      } else if (val === null || val === undefined) {
        val = '';
      }
      obj[headerName] = val;
    }
    results.push(obj);
  }

  return results;
}

/**
 * Log Audit Entry into Audit_Logs sheet
 */
function logAuditEntry(clientMeta, action, moduleName, recordId, details) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('Audit_Logs');
    if (!sheet) {
      sheet = ss.insertSheet('Audit_Logs');
      sheet.appendRow([
        'Timestamp',
        'Action',
        'Module',
        'Record ID / Target',
        'Action Details',
        'Client IP',
        'Device & OS',
        'User Session'
      ]);
      const headerRange = sheet.getRange(1, 1, 1, 8);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#0f172a');
      headerRange.setFontColor('#ffffff');
      sheet.setFrozenRows(1);
    }

    const timestamp = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');
    const ip = (clientMeta && clientMeta.ip) ? clientMeta.ip : 'Unknown IP';
    const deviceInfo = (clientMeta && clientMeta.deviceInfo) ? clientMeta.deviceInfo : (clientMeta && clientMeta.userAgent ? clientMeta.userAgent : 'Unknown Device');
    let userEmail = 'Session User';
    try {
      const activeUser = Session.getActiveUser().getEmail();
      if (activeUser) userEmail = activeUser;
      else if (clientMeta && clientMeta.sessionId) userEmail = clientMeta.sessionId;
    } catch(e) {
      if (clientMeta && clientMeta.sessionId) userEmail = clientMeta.sessionId;
    }

    const detailsStr = typeof details === 'object' ? JSON.stringify(details) : String(details || '');

    sheet.appendRow([
      timestamp,
      action,
      moduleName,
      String(recordId || ''),
      detailsStr,
      ip,
      deviceInfo,
      userEmail
    ]);
  } catch (err) {
    Logger.log('logAuditEntry error: ' + err.toString());
  }
}

// -------------------------------------------------------------
// GOOGLE DRIVE ATTACHMENTS REPOSITORY
// -------------------------------------------------------------
const ATTACHMENT_FOLDER_NAME = 'RM_Receiving_Attachments';

function getOrCreateReceivingAttachmentsFolder() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let parentFolder = DriveApp.getRootFolder();
    try {
      const ssFile = DriveApp.getFileById(ss.getId());
      const parents = ssFile.getParents();
      if (parents.hasNext()) {
        parentFolder = parents.next();
      }
    } catch (e) {
      Logger.log('Could not get parent folder of spreadsheet: ' + e.toString());
    }

    const folders = parentFolder.getFoldersByName(ATTACHMENT_FOLDER_NAME);
    if (folders.hasNext()) {
      const folder = folders.next();
      try {
        folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (e2) {}
      return folder;
    }

    const newFolder = parentFolder.createFolder(ATTACHMENT_FOLDER_NAME);
    try {
      newFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (e3) {}
    return newFolder;
  } catch (err) {
    Logger.log('getOrCreateReceivingAttachmentsFolder fallback to root: ' + err.toString());
    const rootFolders = DriveApp.getFoldersByName(ATTACHMENT_FOLDER_NAME);
    if (rootFolders.hasNext()) return rootFolders.next();
    return DriveApp.createFolder(ATTACHMENT_FOLDER_NAME);
  }
}

/**
 * Extract Google Drive File ID from various URL patterns
 */
function extractDriveFileId(url) {
  if (!url || typeof url !== 'string') return '';
  const dMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (dMatch && dMatch[1]) return dMatch[1];
  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch && idMatch[1]) return idMatch[1];
  return '';
}

/**
 * Upload an attachment to Google Drive, return attachment metadata,
 * and auto-save directly to DB_ReceivingRecords sheet row if recordId is provided.
 */
function uploadReceivingAttachmentToDrive(recordId, billNo, base64Data, mimeType, fileName) {
  try {
    if (!base64Data || typeof base64Data !== 'string') {
      return { status: 'error', success: false, message: 'No base64 data provided' };
    }

    const folder = getOrCreateReceivingAttachmentsFolder();
    
    let cleanBase64 = base64Data;
    let detectedMime = mimeType || 'image/jpeg';
    
    if (cleanBase64.indexOf('data:') === 0 || cleanBase64.indexOf('base64,') > -1) {
      const parts = cleanBase64.split('base64,');
      if (parts.length > 1) {
        cleanBase64 = parts[1];
        const match = parts[0].match(/data:(.*?);/);
        if (match && match[1]) {
          detectedMime = match[1];
        }
      }
    }

    cleanBase64 = cleanBase64.replace(/[\s\r\n]+/g, '');

    const ext = detectedMime === 'image/png' ? 'png' : detectedMime === 'image/webp' ? 'webp' : 'jpg';
    const cleanBillNo = (billNo || recordId || 'RM').replace(/[^a-zA-Z0-9_-]/g, '_');
    const timeStampStr = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyyMMdd-HHmmss');
    const uniqueSuffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const finalFileName = fileName || `RM-${cleanBillNo}-${timeStampStr}-${uniqueSuffix}.${ext}`;

    const decodedBytes = Utilities.base64Decode(cleanBase64);
    const blob = Utilities.newBlob(decodedBytes, detectedMime, finalFileName);
    const file = folder.createFile(blob);

    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (shareErr) {
      Logger.log('Warning: Could not set public sharing on file: ' + shareErr.toString());
    }

    const fileId = file.getId();
    const driveViewUrl = 'https://drive.google.com/file/d/' + fileId + '/view?usp=drivesdk';
    const directUrl = 'https://lh3.googleusercontent.com/d/' + fileId;
    const downloadUrl = file.getDownloadUrl ? file.getDownloadUrl() : driveViewUrl;

    const attachmentItem = {
      id: fileId,
      name: finalFileName,
      url: directUrl,
      driveViewUrl: driveViewUrl,
      downloadUrl: downloadUrl,
      uploadedAt: new Date().toISOString(),
      sizeBytes: decodedBytes.length
    };

    // Auto-update DB_ReceivingRecords immediately if recordId is provided
    if (recordId) {
      try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const sheet = ensureReceivingRecordsSheet(ss);
        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
        const idColIdx = headers.indexOf('id');
        const attColIdx = headers.indexOf('attachments');

        if (idColIdx !== -1 && attColIdx !== -1) {
          const data = sheet.getDataRange().getValues();
          for (let i = 1; i < data.length; i++) {
            if (String(data[i][idColIdx]).trim() === String(recordId).trim()) {
              const currentAttStr = String(data[i][attColIdx] || '').trim();
              const existingList = parseAttachmentsFromSheet(currentAttStr);
              if (!existingList.some(item => item.id === fileId || item.url === directUrl)) {
                existingList.push(attachmentItem);
                const updatedAttStr = formatAttachmentsForSheet(recordId, billNo, existingList);
                sheet.getRange(i + 1, attColIdx + 1).setValue(updatedAttStr);
                SpreadsheetApp.flush();
                clearPurchasingCache();
              }
              break;
            }
          }
        }
      } catch (sheetSyncErr) {
        Logger.log('Warning: uploadReceivingAttachmentToDrive could not auto-sync to sheet: ' + sheetSyncErr.toString());
      }
    }

    return {
      status: 'success',
      success: true,
      fileUrl: directUrl,
      driveViewUrl: driveViewUrl,
      downloadUrl: downloadUrl,
      fileId: fileId,
      data: attachmentItem
    };
  } catch (err) {
    Logger.log('uploadReceivingAttachmentToDrive error: ' + err.toString());
    return { status: 'error', success: false, message: err.toString() };
  }
}

/**
 * Delete an attachment file from Google Drive and remove from DB_ReceivingRecords
 */
function deleteReceivingAttachmentFromDrive(fileId, recordId) {
  try {
    if (!fileId) return { status: 'error', message: 'No fileId provided' };
    const file = DriveApp.getFileById(fileId);
    if (file) {
      file.setTrashed(true);
    }

    if (recordId) {
      try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const sheet = ensureReceivingRecordsSheet(ss);
        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
        const idColIdx = headers.indexOf('id');
        const attColIdx = headers.indexOf('attachments');

        if (idColIdx !== -1 && attColIdx !== -1) {
          const data = sheet.getDataRange().getValues();
          for (let i = 1; i < data.length; i++) {
            if (String(data[i][idColIdx]).trim() === String(recordId).trim()) {
              const currentAttStr = String(data[i][attColIdx] || '').trim();
              const existingList = parseAttachmentsFromSheet(currentAttStr);
              const filteredList = existingList.filter(item => item.id !== fileId);
              const updatedAttStr = formatAttachmentsForSheet(recordId, '', filteredList);
              sheet.getRange(i + 1, attColIdx + 1).setValue(updatedAttStr);
              SpreadsheetApp.flush();
              clearPurchasingCache();
              break;
            }
          }
        }
      } catch (e) {
        Logger.log('Warning: deleteReceivingAttachmentFromDrive sheet sync failed: ' + e.toString());
      }
    }

    return { status: 'success', fileId: fileId };
  } catch (err) {
    Logger.log('deleteReceivingAttachmentFromDrive error: ' + err.toString());
    return { status: 'error', message: err.toString() };
  }
}

/**
 * Format attachments for Google Sheet cell:
 * Returns clean Drive URLs separated by comma:
 * e.g. "https://drive.google.com/file/d/1ABC.../view"
 */
function formatAttachmentsForSheet(recordId, billNo, attachments) {
  if (!attachments || !Array.isArray(attachments) || attachments.length === 0) {
    return '';
  }

  const driveUrls = [];
  let uploadFailed = false;

  for (let i = 0; i < attachments.length; i++) {
    const item = attachments[i];
    if (typeof item === 'string') {
      if (item.indexOf('http') === 0) {
        driveUrls.push(item);
      } else if (item.indexOf('data:') === 0) {
        const res = uploadReceivingAttachmentToDrive(recordId, billNo, item, 'image/jpeg');
        if (res && res.status === 'success' && res.data && res.data.driveViewUrl) {
          driveUrls.push(res.data.driveViewUrl);
        } else {
          uploadFailed = true;
        }
      }
    } else if (typeof item === 'object' && item !== null) {
      if (item.driveViewUrl) {
        driveUrls.push(item.driveViewUrl);
      } else if (item.url && item.url.indexOf('http') === 0) {
        driveUrls.push(item.url);
      } else if (item.url && item.url.indexOf('data:') === 0) {
        const res = uploadReceivingAttachmentToDrive(recordId, billNo, item.url, 'image/jpeg', item.name);
        if (res && res.status === 'success' && res.data && res.data.driveViewUrl) {
          driveUrls.push(res.data.driveViewUrl);
        } else {
          uploadFailed = true;
        }
      }
    }
  }

  if (uploadFailed) {
    return JSON.stringify(attachments);
  }

  return driveUrls.join(', ');
}

/**
 * Parse Google Sheet cell content into Array of ReceivingAttachmentItems
 */
function parseAttachmentsFromSheet(rawAttachments) {
  if (!rawAttachments) return [];
  
  if (Array.isArray(rawAttachments)) {
    return rawAttachments.map(function(item) { return parseSingleAttachment(item); }).filter(Boolean);
  }

  const rawStr = String(rawAttachments).trim();
  if (!rawStr) return [];

  // If JSON array
  if (rawStr.charAt(0) === '[') {
    try {
      const parsed = JSON.parse(rawStr);
      if (Array.isArray(parsed)) {
        return parsed.map(function(item) { return parseSingleAttachment(item); }).filter(Boolean);
      }
    } catch (e) {}
  }

  // Comma or newline separated Drive URLs
  const parts = rawStr.split(/[\n,]+/).map(function(s) { return s.trim(); }).filter(Boolean);
  return parts.map(function(url) { return parseSingleAttachment(url); }).filter(Boolean);
}

function parseSingleAttachment(item) {
  if (!item) return null;
  if (typeof item === 'object' && item !== null) {
    if (item.url || item.driveViewUrl) {
      const fileId = item.id || extractDriveFileId(item.driveViewUrl || item.url);
      return {
        id: fileId || item.id || ('att-' + Date.now()),
        name: item.name || (fileId ? `RM-Attachment-${fileId.slice(0, 6)}.jpg` : 'รูปภาพแนบ'),
        url: item.url || (fileId ? `https://lh3.googleusercontent.com/d/${fileId}` : ''),
        driveViewUrl: item.driveViewUrl || (fileId ? `https://drive.google.com/file/d/${fileId}/view?usp=drivesdk` : undefined),
        uploadedAt: item.uploadedAt || new Date().toISOString(),
        sizeBytes: item.sizeBytes
      };
    }
    return item;
  }

  const str = String(item).trim();
  if (!str) return null;

  const fileId = extractDriveFileId(str);
  if (fileId) {
    return {
      id: fileId,
      name: 'RM-Attachment-' + fileId.slice(0, 6) + '.jpg',
      url: 'https://lh3.googleusercontent.com/d/' + fileId,
      driveViewUrl: 'https://drive.google.com/file/d/' + fileId + '/view?usp=drivesdk',
      uploadedAt: new Date().toISOString()
    };
  }

  // Plain URL or Base64
  return {
    id: 'att-' + Date.now(),
    name: 'รูปภาพแนบ',
    url: str,
    driveViewUrl: str.indexOf('http') === 0 ? str : undefined,
    uploadedAt: new Date().toISOString()
  };
}


