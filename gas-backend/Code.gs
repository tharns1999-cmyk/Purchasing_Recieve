/**
 * =========================================================================
 * Production Planning & Purchasing System — Standalone GAS Backend (REST API)
 * =========================================================================
 * Description:
 *   Google Apps Script backend serving both Production Planning and Purchasing/QC modules.
 *   Provides JSON REST API endpoints via doPost(e) and doGet(e) for decoupled Frontend apps.
 */

// =========================================================================
// 1. HTTP ROUTING & API ENTRY POINTS (JSON REST API)
// =========================================================================

function doGet(e) {
  // If API request with query parameters (e.g. ?action=getPurchasingData)
  if (e && e.parameter && e.parameter.action) {
    return handleApiRequest(e.parameter);
  }

  // Default health check / status response
  return ContentService.createTextOutput(JSON.stringify({
    status: 'success',
    message: '🚀 Planning & Purchasing GAS Backend API is running',
    timestamp: getThaiTimestamp(),
    endpoints: [
      'getPurchasingData',
      'getSnapshot',
      'saveSupplierRecord',
      'deleteSupplierRecord',
      'saveRMRecord',
      'deleteRMRecord',
      'saveReceivingRecord',
      'saveReceivingRecordsBatch',
      'deleteReceivingRecord',
      'saveIssueLogRecord',
      'deleteIssueLogRecord',
      'saveDefectMatrixRules',
      'saveDefectCategory',
      'deleteDefectCategory',
      'uploadReceivingAttachmentToDrive',
      'saveReceivingAttachments',
      'deleteReceivingAttachmentFromDrive',
      'updateMasterData',
      'saveSalesOrder',
      'updateSalesOrderStatus',
      'saveWeeklyPlan',
      'recordActualProduction',
      'saveFullSnapshot'
    ]
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  let payload = {};
  if (e && e.postData && e.postData.contents) {
    try {
      payload = JSON.parse(e.postData.contents);
    } catch (err) {
      payload = e.parameter || {};
    }
  } else if (e && e.parameter) {
    payload = e.parameter;
  }

  return handleApiRequest(payload);
}

function handleApiRequest(payload) {
  try {
    const action = payload.action;
    const data = payload.payload || payload;
    let result = { status: 'success' };

    switch (action) {
      // -----------------------------------------------------------------
      // PURCHASING & QC MODULE ACTIONS
      // -----------------------------------------------------------------
      case 'getPurchasingData':
      case 'getPurchasingInitialData':
        result = getPurchasingInitialData(data.forceRefresh === true || data.forceRefresh === 'true' || payload.forceRefresh === true);
        break;

      case 'saveSupplierRecord':
        result = saveSupplierRecord(data.supplier || data, data.clientMeta || payload.clientMeta);
        break;

      case 'deleteSupplierRecord':
        result = deleteSupplierRecord(data.id || payload.id, data.clientMeta || payload.clientMeta);
        break;

      case 'saveRMRecord':
        result = saveRMRecord(data.rmItem || data, data.clientMeta || payload.clientMeta);
        break;

      case 'deleteRMRecord':
        result = deleteRMRecord(data.id || payload.id, data.clientMeta || payload.clientMeta);
        break;

      case 'saveReceivingRecord':
        result = saveReceivingRecord(data.record || data, data.clientMeta || payload.clientMeta);
        break;

      case 'saveReceivingRecordsBatch':
        result = saveReceivingRecordsBatch(data.records || payload.records || (Array.isArray(data) ? data : []), data.clientMeta || payload.clientMeta);
        break;

      case 'deleteReceivingRecord':
        result = deleteReceivingRecord(data.id || payload.id, data.clientMeta || payload.clientMeta);
        break;

      case 'saveIssueLogRecord':
        result = saveIssueLogRecord(data.record || data, data.clientMeta || payload.clientMeta);
        break;

      case 'deleteIssueLogRecord':
        result = deleteIssueLogRecord(data.id || payload.id, data.clientMeta || payload.clientMeta);
        break;

      case 'saveDefectMatrixRules':
        result = saveDefectMatrixRules(data.matrix || payload.matrix || data, data.clientMeta || payload.clientMeta);
        break;

      case 'saveDefectCategory':
        result = saveDefectCategory(data.category || data, data.clientMeta || payload.clientMeta);
        break;

      case 'deleteDefectCategory':
        result = deleteDefectCategory(data.id || payload.id, data.clientMeta || payload.clientMeta);
        break;

      case 'uploadAttachment':
      case 'uploadAttachmentToDrive':
      case 'uploadReceivingAttachmentToDrive':
        result = uploadReceivingAttachmentToDrive(
          data.recordId || data.id || payload.recordId || payload.id,
          data.billNo || data.billNumber || payload.billNo || payload.billNumber,
          data.base64Data || data.fileData || data.image || data.file || payload.base64Data || payload.fileData || payload.image || payload.file,
          data.mimeType || data.type || payload.mimeType || payload.type || 'image/jpeg',
          data.fileName || data.name || payload.fileName || payload.name
        );
        break;

      case 'saveReceivingAttachments':
        result = saveReceivingAttachments(
          data.recordId || payload.recordId,
          data.attachments || payload.attachments,
          data.clientMeta || payload.clientMeta
        );
        break;

      case 'deleteReceivingAttachmentFromDrive':
        result = deleteReceivingAttachmentFromDrive(
          data.fileId || payload.fileId,
          data.recordId || payload.recordId
        );
        break;

      // -----------------------------------------------------------------
      // PRODUCTION PLANNING MODULE ACTIONS
      // -----------------------------------------------------------------
      case 'getSnapshot':
      case 'apiGetSnapshot':
        result = JSON.parse(apiGetSnapshot());
        break;

      case 'updateMasterData':
      case 'apiUpdateMasterData':
        result = apiUpdateMasterData(data.payload || data);
        break;

      case 'saveSalesOrder':
      case 'apiSaveSalesOrder':
        result = apiSaveSalesOrder(data.order || payload.order, data.lines || payload.lines);
        break;

      case 'updateSalesOrderStatus':
      case 'apiUpdateSalesOrderStatus':
        result = apiUpdateSalesOrderStatus(data.orderId || payload.orderId, data.status || payload.status);
        break;

      case 'saveWeeklyPlan':
      case 'apiSaveWeeklyPlan':
        result = apiSaveWeeklyPlan(
          data.plan || payload.plan,
          data.allocations || payload.allocations,
          data.notes || payload.notes
        );
        break;

      case 'recordActualProduction':
      case 'apiRecordActualProduction':
        result = apiRecordActualProduction(data.entry || payload.entry || data);
        break;

      case 'saveFullSnapshot':
      case 'apiSaveFullSnapshot':
        result = apiSaveFullSnapshot(data.snapshot || payload.snapshot || data);
        break;

      // -----------------------------------------------------------------
      // SETUP & MAINTENANCE ACTIONS
      // -----------------------------------------------------------------
      case 'setupDatabase':
        setupDatabase();
        result = { status: 'success', message: 'Production database setup complete' };
        break;

      case 'setupPurchasingDatabase':
        setupPurchasingDatabase();
        result = { status: 'success', message: 'Purchasing database setup complete' };
        break;

      case 'syncAndSanitizeAllSheets':
        result = { status: 'success', data: syncAndSanitizeAllSheets() };
        break;

      case 'syncAndSanitizePurchasingSheets':
        syncAndSanitizePurchasingSheets();
        result = { status: 'success', message: 'Purchasing sheets sanitized' };
        break;

      default:
        result = { status: 'error', message: 'Unknown action: ' + action };
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log('API Request Error: ' + err.toString());
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: err.toString(),
      stack: err.stack
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// =========================================================================
// 2. TIMEZONE & GENERAL HELPERS
// =========================================================================

function getThaiTimestamp(date) {
  const d = date || new Date();
  return Utilities.formatDate(d, 'Asia/Bangkok', "yyyy-MM-dd'T'HH:mm:ss'+07:00'");
}

function _generateUniqueId(prefix) {
  const timestamp = new Date().getTime().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 7);
  return (prefix ? prefix + '-' : '') + timestamp + '-' + randomStr;
}

function _normalizeBoolean(val, defaultValue) {
  if (val === '' || val === null || val === undefined) return defaultValue !== undefined ? defaultValue : true;
  if (typeof val === 'boolean') return val;
  const s = String(val).trim().toUpperCase();
  if (s === 'TRUE' || s === '1' || s === 'YES') return true;
  if (s === 'FALSE' || s === '0' || s === 'NO') return false;
  return defaultValue !== undefined ? defaultValue : true;
}

const DATE_ONLY_FIELDS = {
  weekStart: true, weekEnd: true, productionDate: true,
  dueDate: true, orderDate: true
};

const NUMERIC_FIELDS = {
  orderedQty: true, cancelledQty: true, completedQty: true, shortageQty: true, boxQty: true,
  plannedQty: true, fgOutputQty: true, displayOrder: true,
  goodQty: true, wasteQty: true, reworkQty: true, shortfallQty: true
};

function _formatDateOnly(val) {
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(val || '').trim();
  if (s.length >= 10 && s[4] === '-' && s[7] === '-') {
    return s.substring(0, 10);
  }
  return s;
}

// =========================================================================
// 3. PRODUCTION PLANNING SCHEMA & API
// =========================================================================

const SCHEMA_HEADERS_MAP = {
  Customers: ['customerId', 'customerCode', 'customerName', 'shortName', 'active', 'createdAt', 'updatedAt'],
  Products: ['productId', 'productCode', 'productName', 'shortName', 'defaultUnit', 'customerId', 'estimatedYieldPerBatch', 'active', 'createdAt', 'updatedAt'],
  Orders: ['id', 'orderNo', 'customerName', 'orderDate', 'note', 'status', 'createdAt', 'updatedAt'],
  OrderLines: ['id', 'orderId', 'skuCode', 'skuName', 'orderedQty', 'cancelledQty', 'unit', 'dueDate', 'priority', 'notes', 'packaging', 'completedQty', 'shortageQty', 'boxQty'],
  WipPrepItems: ['itemId', 'itemType', 'itemCode', 'itemName', 'shortName', 'defaultUnit', 'relatedProduct', 'note', 'active', 'createdAt', 'updatedAt'],
  Plans: ['id', 'weekStart', 'weekEnd', 'revisionNumber', 'status', 'sourcePlanId', 'publishedAt', 'cancelledAt', 'createdAt', 'updatedAt'],
  Allocations: ['allocationId', 'planId', 'sourceType', 'salesOrderId', 'salesOrderLineId', 'wipPrepItemId', 'productionDate', 'roomId', 'plannedQty', 'unit', 'plannedUnit', 'fgOutputQty', 'fgOutputUnit', 'note', 'printCustomerTag', 'printNote', 'highlightOnPlan', 'displayOrder', 'sourceAllocationId', 'status', 'createdAt', 'updatedAt'],
  BoardNotes: ['noteId', 'planId', 'productionDate', 'roomId', 'noteText', 'highlightOnPlan', 'displayOrder', 'createdAt', 'updatedAt'],
  ProductionActualEntries: ['actualEntryId', 'allocationId', 'entryType', 'goodQty', 'wasteQty', 'reworkQty', 'shortfallQty', 'shortfallReason', 'boxQty', 'recordedAt', 'recordedBy']
};

function _getStandardKey(sheetName, rawHeader) {
  const h = String(rawHeader || '').trim();
  const clean = h.toLowerCase().replace(/[^a-z0-9]/g, '');

  const expected = SCHEMA_HEADERS_MAP[sheetName] || [];
  for (let i = 0; i < expected.length; i++) {
    const stdKey = expected[i];
    if (stdKey.toLowerCase().replace(/[^a-z0-9]/g, '') === clean) {
      return stdKey;
    }
  }
  return h;
}

function _getValueByFlexibleKey(obj, headerName) {
  if (!obj || typeof obj !== 'object') return '';
  if (obj[headerName] !== undefined) return obj[headerName];

  const cleanHeader = String(headerName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const key of Object.keys(obj)) {
    if (key.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanHeader) {
      return obj[key];
    }
  }
  return '';
}

function _sanitizeAndAutoAssignSheet(sheetName, customerMap) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  const expectedHeaders = SCHEMA_HEADERS_MAP[sheetName] || [];
  let lastRow = sheet.getLastRow();
  let lastCol = sheet.getLastColumn();

  if (lastCol < 1 || lastRow < 1) {
    if (expectedHeaders.length > 0) {
      sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
      sheet.getRange(1, 1, 1, expectedHeaders.length).setFontWeight('bold').setBackground('#f3f4f6');
      sheet.setFrozenRows(1);
      lastCol = expectedHeaders.length;
      lastRow = 1;
    } else {
      return [];
    }
  }

  const rawValues = sheet.getRange(1, 1, Math.max(lastRow, 1), Math.max(lastCol, expectedHeaders.length)).getValues();
  if (!rawValues || rawValues.length < 2) return [];

  const rawHeaders = rawValues[0].map(h => String(h || '').trim());
  const headers = rawHeaders.map(h => _getStandardKey(sheetName, h));

  const idKeyMap = {
    Customers: { key: 'customerId', prefix: 'cust' },
    Products: { key: 'productId', prefix: 'prod' },
    Orders: { key: 'id', prefix: 'ord' },
    OrderLines: { key: 'id', prefix: 'line' },
    WipPrepItems: { key: 'itemId', prefix: 'wip' },
    Plans: { key: 'id', prefix: 'plan' },
    Allocations: { key: 'allocationId', prefix: 'alloc' },
    BoardNotes: { key: 'noteId', prefix: 'note' },
    ProductionActualEntries: { key: 'actualEntryId', prefix: 'actual' }
  };

  const config = idKeyMap[sheetName] || { key: 'id', prefix: 'item' };
  const idColIdx = headers.indexOf(config.key);
  const createdAtIdx = headers.indexOf('createdAt');
  const updatedAtIdx = headers.indexOf('updatedAt');
  const activeIdx = headers.indexOf('active');
  const customerIdIdx = sheetName === 'Products' ? headers.indexOf('customerId') : -1;
  const yieldIdx = sheetName === 'Products' ? headers.indexOf('estimatedYieldPerBatch') : -1;

  let needsWriteBack = false;
  const nowIso = getThaiTimestamp();
  const validObjects = [];

  for (let r = 1; r < rawValues.length; r++) {
    const row = rawValues[r];
    const isEmpty = row.every(cell => cell === '' || cell === null || cell === undefined);
    if (isEmpty) continue;

    const hasData = row.some((cell, idx) => idx !== idColIdx && String(cell || '').trim() !== '');
    if (!hasData) continue;

    let modifiedRow = false;

    if (idColIdx !== -1) {
      const currentId = String(row[idColIdx] || '').trim();
      if (!currentId) {
        row[idColIdx] = _generateUniqueId(config.prefix);
        modifiedRow = true;
      }
    }

    if (createdAtIdx !== -1) {
      const cVal = String(row[createdAtIdx] || '').trim();
      if (!cVal) {
        row[createdAtIdx] = nowIso;
        modifiedRow = true;
      }
    }

    if (updatedAtIdx !== -1) {
      const uVal = String(row[updatedAtIdx] || '').trim();
      if (!uVal) {
        row[updatedAtIdx] = nowIso;
        modifiedRow = true;
      }
    }

    if (sheetName === 'Products' && customerIdIdx !== -1 && customerMap) {
      let custVal = String(row[customerIdIdx] || '').trim();
      if (custVal) {
        if (customerMap[custVal]) {
          row[customerIdIdx] = customerMap[custVal];
          modifiedRow = true;
        } else if (customerMap[custVal.toUpperCase()]) {
          row[customerIdIdx] = customerMap[custVal.toUpperCase()];
          modifiedRow = true;
        }
      }
    }

    if (activeIdx !== -1) {
      const normBool = _normalizeBoolean(row[activeIdx], true);
      if (row[activeIdx] !== normBool) {
        row[activeIdx] = normBool;
        modifiedRow = true;
      }
    }

    if (modifiedRow) {
      needsWriteBack = true;
    }

    const obj = {};
    headers.forEach((header, index) => {
      if (header) {
        let val = row[index];
        if (val instanceof Date) {
          if (DATE_ONLY_FIELDS[header]) {
            val = _formatDateOnly(val);
          } else {
            val = getThaiTimestamp(val);
          }
        } else if (typeof val === 'string' && DATE_ONLY_FIELDS[header]) {
          val = _formatDateOnly(val);
        }
        if (index === activeIdx) {
          val = _normalizeBoolean(val, true);
        }
        if (index === yieldIdx) {
          val = val !== '' && !isNaN(Number(val)) ? Number(val) : undefined;
        }
        if (NUMERIC_FIELDS[header] && val !== '' && val !== null && val !== undefined) {
          const numVal = Number(val);
          if (!isNaN(numVal)) val = numVal;
        }
        obj[header] = val;
      }
    });

    validObjects.push(obj);
  }

  if (needsWriteBack) {
    sheet.getRange(1, 1, rawValues.length, rawValues[0].length).setValues(rawValues);
  }

  return validObjects;
}

function _getSheetData(sheetName, customerMap) {
  return _sanitizeAndAutoAssignSheet(sheetName, customerMap);
}

function _objectsToRows(objects, headers) {
  return objects.map(obj => headers.map(header => _getValueByFlexibleKey(obj, header)));
}

function _writeToSheet(sheetName, objects) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  const expectedHeaders = SCHEMA_HEADERS_MAP[sheetName] || [];
  let headers = [];

  if (sheet.getLastColumn() >= 1) {
    headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h || '').trim());
  }

  if (!headers || headers.filter(Boolean).length === 0) {
    headers = expectedHeaders;
    if (headers.length > 0) {
      const headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setValues([headers]);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#f3f4f6');
      sheet.setFrozenRows(1);
    }
  }

  const lastRow = sheet.getLastRow();
  const lastCol = Math.max(sheet.getLastColumn(), headers.length);
  if (lastRow > 1 && lastCol >= 1) {
    sheet.getRange(2, 1, lastRow - 1, lastCol).clearContent();
  }

  if (!objects || objects.length === 0) return;

  const rows = _objectsToRows(objects, headers);
  if (rows.length > 0 && headers.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
}

function _appendRows(sheetName, objects) {
  if (!objects || objects.length === 0) return;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  const expectedHeaders = SCHEMA_HEADERS_MAP[sheetName] || [];
  let headers = [];
  if (sheet.getLastColumn() >= 1) {
    headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h || '').trim());
  }

  if (!headers || headers.filter(Boolean).length === 0) {
    headers = expectedHeaders;
    if (headers.length > 0) {
      const headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setValues([headers]);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#f3f4f6');
      sheet.setFrozenRows(1);
    }
  }

  const rows = _objectsToRows(objects, headers);
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
}

function apiGetSnapshot() {
  const customers = _getSheetData('Customers');
  const customerMap = {};
  customers.forEach(c => {
    if (c.customerCode && c.customerId) {
      customerMap[c.customerCode] = c.customerId;
      customerMap[c.customerCode.toUpperCase()] = c.customerId;
    }
    if (c.customerId) {
      customerMap[c.customerId] = c.customerId;
    }
  });

  const data = {
    customers: customers,
    products: _getSheetData('Products', customerMap),
    salesOrders: _getSheetData('Orders'),
    salesOrderLines: _getSheetData('OrderLines'),
    wipPrepItems: _getSheetData('WipPrepItems'),
    weeklyPlans: _getSheetData('Plans'),
    planAllocations: _getSheetData('Allocations'),
    boardNotes: _getSheetData('BoardNotes'),
    productionActualEntries: _getSheetData('ProductionActualEntries')
  };
  return JSON.stringify(data);
}

function syncAndSanitizeAllSheets() {
  return apiGetSnapshot();
}

function apiUpdateMasterData(payload) {
  if (payload.customers) {
    _writeToSheet('Customers', payload.customers);
  }
  if (payload.products) {
    _writeToSheet('Products', payload.products);
  }
  if (payload.wipPrepItems) {
    _writeToSheet('WipPrepItems', payload.wipPrepItems);
  }
  return { status: 'success', success: true };
}

function apiSaveSalesOrder(order, lines) {
  const existingOrders = _getSheetData('Orders');
  const idx = existingOrders.findIndex(o => o.id === order.id);

  if (idx >= 0) {
    existingOrders[idx] = order;
  } else {
    existingOrders.push(order);
  }
  _writeToSheet('Orders', existingOrders);

  if (lines) {
    let existingLines = _getSheetData('OrderLines');
    existingLines = existingLines.filter(l => l.orderId !== order.id);
    existingLines = existingLines.concat(lines);
    _writeToSheet('OrderLines', existingLines);
  }
  return { status: 'success', success: true };
}

function apiUpdateSalesOrderStatus(orderId, status) {
  const existingOrders = _getSheetData('Orders');
  const idx = existingOrders.findIndex(o => o.id === orderId);
  if (idx >= 0) {
    existingOrders[idx].status = status;
    existingOrders[idx].updatedAt = getThaiTimestamp();
    _writeToSheet('Orders', existingOrders);
  }
  return { status: 'success', success: true };
}

function apiSaveWeeklyPlan(plan, allocations, notes) {
  const existingPlans = _getSheetData('Plans');
  const idx = existingPlans.findIndex(p => String(p.id).trim() === String(plan.id).trim());

  const planRecord = Object.assign({}, plan);
  delete planRecord.allocations;

  if (idx >= 0) {
    existingPlans[idx] = planRecord;
  } else {
    existingPlans.push(planRecord);
  }
  _writeToSheet('Plans', existingPlans);

  if (allocations) {
    _writeToSheet('Allocations', allocations);
  }

  if (notes) {
    _writeToSheet('BoardNotes', notes);
  }

  return { status: 'success', success: true };
}

function apiRecordActualProduction(entry) {
  _appendRows('ProductionActualEntries', [entry]);
  return { status: 'success', success: true };
}

function apiSaveFullSnapshot(snapshotStr) {
  let snap = snapshotStr;
  if (typeof snapshotStr === 'string') {
    try {
      snap = JSON.parse(snapshotStr);
    } catch (e) {}
  }
  if (!snap || !snap.entities) return { status: 'error', success: false };

  const ent = snap.entities;
  if (ent.customers) _writeToSheet('Customers', ent.customers);
  if (ent.products) _writeToSheet('Products', ent.products);
  if (ent.salesOrders) _writeToSheet('Orders', ent.salesOrders);
  if (ent.salesOrderLines) _writeToSheet('OrderLines', ent.salesOrderLines);
  if (ent.wipPrepItems) _writeToSheet('WipPrepItems', ent.wipPrepItems);
  if (ent.weeklyPlans) {
    const cleanPlans = ent.weeklyPlans.map(p => {
      const copy = Object.assign({}, p);
      delete copy.allocations;
      return copy;
    });
    _writeToSheet('Plans', cleanPlans);
  }
  if (ent.planAllocations) _writeToSheet('Allocations', ent.planAllocations);
  if (ent.boardNotes) _writeToSheet('BoardNotes', ent.boardNotes);
  if (ent.productionActualEntries) _writeToSheet('ProductionActualEntries', ent.productionActualEntries);

  return { status: 'success', success: true };
}

// =========================================================================
// 4. PURCHASING & QC MODULE DATABASE & API
// =========================================================================

const PURCHASING_SHEET_NAMES = {
  SUPPLIERS: 'DB_Suppliers',
  RM_ITEMS: 'DB_RMItems',
  DEFECT_MATRIX: 'DB_DefectMatrix',
  RECEIVING_RECORDS: 'DB_ReceivingRecords',
  ISSUE_LOGS: 'DB_IssueLogs',
  DEFECT_CATEGORIES: 'DB_DefectCategories',
};

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
    const expiration = 21600; // 6 hours
    const chunkSize = 100000;
    
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
      } catch (e) {}
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

    // --- Defect Categories ---
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

    const cleanJsonString = JSON.stringify(payload, function (key, val) {
      if (typeof val === 'number') {
        if (isNaN(val) || val === Infinity || val === -Infinity) return 0;
      }
      return val;
    });

    setPurchasingCache(cleanJsonString);
    return JSON.parse(cleanJsonString);
  } catch (err) {
    Logger.log('Critical failure in getPurchasingInitialData: ' + err.toString());
    return {
      status: 'error',
      message: err.toString(),
      _meta: { source: 'gas_error', timestamp: new Date().toISOString() },
      data: {
        suppliers: [],
        rmItems: [],
        defectMatrix: {},
        defectCategories: [],
        receivingRecords: [],
        issueLogs: [],
      },
    };
  }
}

function ensureReceivingRecordsSheet(ss) {
  const sheet = ss.getSheetByName(PURCHASING_SHEET_NAMES.RECEIVING_RECORDS);
  if (!sheet) return;
  const headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0].map(h => String(h || '').trim());
  
  if (headers.indexOf('postProductionDefectQty') === -1 || headers.indexOf('unitPrice') === -1 || headers.indexOf('attachments') === -1) {
    const requiredHeaders = [
      'id', 'billNo', 'receiveDate', 'supplierId', 'supplierName',
      'rmId', 'rmName', 'rmCategory', 'receiveQty', 'sampleQty',
      'defectQty', 'defectPercent', 'isPass', 'remark', 'createdAt', 'hasIssueLog',
      'postProductionDefectQty', 'postProductionRemark', 'postProductionDate', 'unitPrice',
      'attachments'
    ];
    setupPurchasingSheetHeaders(sheet, requiredHeaders, '#059669');
  }
}

function buildReceivingRow(record, headers) {
  let attachmentString = '';
  if (record.attachments) {
    attachmentString = formatAttachmentsForSheet(record.id, record.billNo, record.attachments);
  }

  return headers.map((header) => {
    switch (header) {
      case 'id': return record.id || _generateUniqueId('REC');
      case 'billNo': return record.billNo || '';
      case 'receiveDate': return _formatDateOnly(record.receiveDate);
      case 'supplierId': return record.supplierId || '';
      case 'supplierName': return record.supplierName || '';
      case 'rmId': return record.rmId || '';
      case 'rmName': return record.rmName || '';
      case 'rmCategory': return record.rmCategory != null ? String(record.rmCategory).trim() : '';
      case 'receiveQty': return Number(record.receiveQty) || 0;
      case 'sampleQty': return Number(record.sampleQty) || 0;
      case 'defectQty': return Number(record.defectQty) || 0;
      case 'defectPercent': return Number(record.defectPercent) || 0;
      case 'isPass': return record.isPass === true;
      case 'remark': return record.remark || '';
      case 'createdAt': return record.createdAt || getThaiTimestamp();
      case 'hasIssueLog': return record.hasIssueLog === true;
      case 'postProductionDefectQty': return record.postProductionDefectQty !== undefined && record.postProductionDefectQty !== '' ? Number(record.postProductionDefectQty) : '';
      case 'postProductionRemark': return record.postProductionRemark || '';
      case 'postProductionDate': return record.postProductionDate ? _formatDateOnly(record.postProductionDate) : '';
      case 'unitPrice': return record.unitPrice !== undefined && record.unitPrice !== '' ? Number(record.unitPrice) : '';
      case 'attachments': return attachmentString;
      default: return record[header] !== undefined ? record[header] : '';
    }
  });
}

function saveReceivingRecord(record, clientMeta) {
  clearPurchasingCache();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(PURCHASING_SHEET_NAMES.RECEIVING_RECORDS);
  ensureReceivingRecordsSheet(ss);
  
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const data = sheet.getDataRange().getValues();
  const idCol = headers.indexOf('id') + 1;
  let rowIndex = -1;

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol - 1]).trim() === String(record.id).trim()) {
      rowIndex = i + 1;
      break;
    }
  }

  const row = buildReceivingRow(record, headers);

  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
    logAuditEntry(clientMeta, 'UPDATE_RECEIVING', 'Purchasing', record.id, `แก้ไขบันทึกรับเข้า Bill: ${record.billNo}, RM: ${record.rmName}`);
  } else {
    sheet.appendRow(row);
    logAuditEntry(clientMeta, 'CREATE_RECEIVING', 'Purchasing', record.id, `บันทึกรับเข้าใหม่ Bill: ${record.billNo}, RM: ${record.rmName}, Qty: ${record.receiveQty}`);
  }

  return { status: 'success', recordId: record.id };
}

function saveReceivingRecordsBatch(records, clientMeta) {
  if (!records || records.length === 0) return { status: 'success', count: 0 };
  clearPurchasingCache();
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(PURCHASING_SHEET_NAMES.RECEIVING_RECORDS);
  ensureReceivingRecordsSheet(ss);

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const data = sheet.getDataRange().getValues();
  const idCol = headers.indexOf('id') + 1;

  const idToRowIndex = new Map();
  for (let i = 1; i < data.length; i++) {
    const cellId = String(data[i][idCol - 1]).trim();
    if (cellId) {
      idToRowIndex.set(cellId, i + 1);
    }
  }

  const newRows = [];
  const billNos = new Set();

  records.forEach((record) => {
    const row = buildReceivingRow(record, headers);
    const existingRowIndex = idToRowIndex.get(String(record.id).trim());

    if (existingRowIndex) {
      sheet.getRange(existingRowIndex, 1, 1, row.length).setValues([row]);
    } else {
      newRows.push(row);
    }
    if (record.billNo) billNos.add(record.billNo);
  });

  if (newRows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, headers.length).setValues(newRows);
  }

  logAuditEntry(clientMeta, 'BATCH_RECEIVING', 'Purchasing', Array.from(billNos).join(', '), `บันทึกรับเข้าแบบชุด ${records.length} รายการ (บิล: ${Array.from(billNos).join(', ')})`);

  return { status: 'success', count: records.length };
}

function saveReceivingAttachments(recordId, attachments, clientMeta) {
  clearPurchasingCache();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(PURCHASING_SHEET_NAMES.RECEIVING_RECORDS);
  ensureReceivingRecordsSheet(ss);

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const data = sheet.getDataRange().getValues();
  const idCol = headers.indexOf('id');
  const billNoCol = headers.indexOf('billNo');
  const attCol = headers.indexOf('attachments');

  let rowIndex = -1;
  let billNo = '';

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol]).trim() === String(recordId).trim()) {
      rowIndex = i + 1;
      billNo = String(data[i][billNoCol] || '');
      break;
    }
  }

  if (rowIndex > 0 && attCol >= 0) {
    const formatted = formatAttachmentsForSheet(recordId, billNo, attachments);
    sheet.getRange(rowIndex, attCol + 1).setValue(formatted);
    logAuditEntry(clientMeta, 'UPDATE_ATTACHMENTS', 'Purchasing', recordId, `อัปเดตรูปภาพแนบ ${attachments ? attachments.length : 0} ไฟล์`);
    return { status: 'success', recordId: recordId, count: attachments ? attachments.length : 0 };
  }

  return { status: 'error', message: 'Record not found: ' + recordId };
}

function saveIssueLogRecord(record, clientMeta) {
  clearPurchasingCache();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(PURCHASING_SHEET_NAMES.ISSUE_LOGS);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const data = sheet.getDataRange().getValues();
  const idCol = headers.indexOf('id') + 1;
  let rowIndex = -1;

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol - 1]).trim() === String(record.id).trim()) {
      rowIndex = i + 1;
      break;
    }
  }

  const row = headers.map((header) => {
    switch (header) {
      case 'id': return record.id || _generateUniqueId('ISS');
      case 'receivingRecordId': return record.receivingRecordId || '';
      case 'supplierId': return record.supplierId || '';
      case 'supplierName': return record.supplierName || '';
      case 'rmId': return record.rmId || '';
      case 'rmName': return record.rmName || '';
      case 'billNo': return record.billNo || '';
      case 'issueDate': return _formatDateOnly(record.issueDate);
      case 'problemQty': return Number(record.problemQty) || 0;
      case 'defectCategory': return record.defectCategory || '';
      case 'problemsFound': return record.problemsFound || '';
      case 'correctiveAction': return record.correctiveAction || '';
      case 'status': return record.status || 'OPEN';
      case 'createdAt': return record.createdAt || getThaiTimestamp();
      default: return record[header] !== undefined ? record[header] : '';
    }
  });

  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
    logAuditEntry(clientMeta, 'UPDATE_ISSUE_LOG', 'QC Issue Log', record.id, `แก้ไข Issue Log: ${record.id}, ปัญหา: ${record.problemsFound}`);
  } else {
    sheet.appendRow(row);
    logAuditEntry(clientMeta, 'CREATE_ISSUE_LOG', 'QC Issue Log', record.id, `สร้าง Issue Log ใหม่: ${record.id}, Supplier: ${record.supplierName}, ปัญหา: ${record.problemsFound}`);
  }

  if (record.receivingRecordId) {
    try {
      const recSheet = ss.getSheetByName(PURCHASING_SHEET_NAMES.RECEIVING_RECORDS);
      const recHeaders = recSheet.getRange(1, 1, 1, recSheet.getLastColumn()).getValues()[0];
      const recData = recSheet.getDataRange().getValues();
      const recIdCol = recHeaders.indexOf('id');
      const hasIssueCol = recHeaders.indexOf('hasIssueLog');

      for (let i = 1; i < recData.length; i++) {
        if (String(recData[i][recIdCol]).trim() === String(record.receivingRecordId).trim()) {
          recSheet.getRange(i + 1, hasIssueCol + 1).setValue(true);
          break;
        }
      }
    } catch (e) {}
  }

  return { status: 'success', recordId: record.id };
}

function deleteReceivingRecord(id, clientMeta) {
  clearPurchasingCache();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(PURCHASING_SHEET_NAMES.RECEIVING_RECORDS);
  const data = sheet.getDataRange().getValues();
  const idCol = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].indexOf('id');

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol]).trim() === String(id).trim()) {
      sheet.deleteRow(i + 1);
      logAuditEntry(clientMeta, 'DELETE_RECEIVING', 'Purchasing', id, `ลบประวัติการรับเข้า ID: ${id}`);
      return { status: 'success' };
    }
  }
  return { status: 'error', message: 'Record not found' };
}

function saveSupplierRecord(supplier, clientMeta) {
  clearPurchasingCache();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(PURCHASING_SHEET_NAMES.SUPPLIERS);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const data = sheet.getDataRange().getValues();
  const idCol = headers.indexOf('id') + 1;
  let rowIndex = -1;

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol - 1]).trim() === String(supplier.id).trim()) {
      rowIndex = i + 1;
      break;
    }
  }

  let cleanPhone = String(supplier.phone || '').trim();
  if (cleanPhone && cleanPhone !== '-' && !cleanPhone.startsWith("'")) {
    cleanPhone = "'" + cleanPhone;
  }

  const row = headers.map((header) => {
    switch (header) {
      case 'id': return supplier.id || _generateUniqueId('sup');
      case 'code': return supplier.code != null ? String(supplier.code).trim() : '';
      case 'name': return supplier.name || '';
      case 'phone': return cleanPhone;
      case 'contactPerson': return supplier.contactPerson || '';
      case 'email': return supplier.email || '';
      case 'address': return supplier.address || '';
      case 'createdAt': return supplier.createdAt || getThaiTimestamp();
      default: return supplier[header] !== undefined ? supplier[header] : '';
    }
  });

  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
    logAuditEntry(clientMeta, 'UPDATE_SUPPLIER', 'Master Data', supplier.id, `แก้ไขข้อมูล Supplier: ${supplier.name} (${supplier.code || '-'})`);
  } else {
    sheet.appendRow(row);
    logAuditEntry(clientMeta, 'CREATE_SUPPLIER', 'Master Data', supplier.id, `เพิ่ม Supplier ใหม่: ${supplier.name} (${supplier.code || '-'})`);
  }

  return { status: 'success', supplierId: supplier.id };
}

function deleteSupplierRecord(id, clientMeta) {
  clearPurchasingCache();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(PURCHASING_SHEET_NAMES.SUPPLIERS);
  const data = sheet.getDataRange().getValues();
  const idCol = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].indexOf('id');

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol]).trim() === String(id).trim()) {
      sheet.deleteRow(i + 1);
      logAuditEntry(clientMeta, 'DELETE_SUPPLIER', 'Master Data', id, `ลบ Supplier ID: ${id}`);
      return { status: 'success' };
    }
  }
  return { status: 'error', message: 'Supplier not found' };
}

function saveRMRecord(rmItem, clientMeta) {
  clearPurchasingCache();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(PURCHASING_SHEET_NAMES.RM_ITEMS);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const data = sheet.getDataRange().getValues();
  const idCol = headers.indexOf('id') + 1;
  let rowIndex = -1;

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol - 1]).trim() === String(rmItem.id).trim()) {
      rowIndex = i + 1;
      break;
    }
  }

  let supplierIdsJson = '';
  if (Array.isArray(rmItem.supplierIds) && rmItem.supplierIds.length > 0) {
    supplierIdsJson = JSON.stringify(rmItem.supplierIds);
  } else if (rmItem.supplierId) {
    supplierIdsJson = JSON.stringify([rmItem.supplierId]);
  }

  const row = headers.map((header) => {
    switch (header) {
      case 'id': return rmItem.id || _generateUniqueId('rm');
      case 'code': return rmItem.code != null ? String(rmItem.code).trim() : '';
      case 'name': return rmItem.name || '';
      case 'category': return rmItem.category != null ? String(rmItem.category).trim() : '';
      case 'categoryLabel': return rmItem.categoryLabel != null ? String(rmItem.categoryLabel).trim() : '';
      case 'unit': return rmItem.unit || '';
      case 'supplierId': return rmItem.supplierId || (rmItem.supplierIds && rmItem.supplierIds[0]) || '';
      case 'supplierName': return rmItem.supplierName || '';
      case 'supplierIds': return supplierIdsJson;
      default: return rmItem[header] !== undefined ? rmItem[header] : '';
    }
  });

  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
    logAuditEntry(clientMeta, 'UPDATE_RM', 'Master Data', rmItem.id, `แก้ไขวัตถุดิบ: ${rmItem.name} (${rmItem.code || '-'}) หมวดหมู่: ${rmItem.category}`);
  } else {
    sheet.appendRow(row);
    logAuditEntry(clientMeta, 'CREATE_RM', 'Master Data', rmItem.id, `เพิ่มวัตถุดิบใหม่: ${rmItem.name} (${rmItem.code || '-'}) หมวดหมู่: ${rmItem.category}`);
  }

  return { status: 'success', rmId: rmItem.id };
}

function deleteRMRecord(id, clientMeta) {
  clearPurchasingCache();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(PURCHASING_SHEET_NAMES.RM_ITEMS);
  const data = sheet.getDataRange().getValues();
  const idCol = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].indexOf('id');

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol]).trim() === String(id).trim()) {
      sheet.deleteRow(i + 1);
      logAuditEntry(clientMeta, 'DELETE_RM', 'Master Data', id, `ลบวัตถุดิบ ID: ${id}`);
      return { status: 'success' };
    }
  }
  return { status: 'error', message: 'RM Item not found' };
}

function saveDefectMatrixRules(matrix, clientMeta) {
  clearPurchasingCache();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(PURCHASING_SHEET_NAMES.DEFECT_MATRIX);
  const headers = ['category', 'minQty', 'maxQty', 'sampleQty', 'acceptMaxDefectQty', 'acceptMaxDefectPercent'];
  
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
  }

  const rows = [];
  Object.keys(matrix).forEach((category) => {
    matrix[category].forEach((rule) => {
      rows.push([
        category,
        Number(rule.minQty),
        Number(rule.maxQty),
        Number(rule.sampleQty),
        Number(rule.acceptMaxDefectQty),
        Number(rule.acceptMaxDefectPercent),
      ]);
    });
  });

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

  logAuditEntry(clientMeta, 'UPDATE_DEFECT_MATRIX', 'Master Data', 'QC Matrix', `ปรับปรุงเกณฑ์การสุ่มตรวจ QC Matrix (${rows.length} กฎ)`);

  return { status: 'success' };
}

function deleteIssueLogRecord(id, clientMeta) {
  clearPurchasingCache();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(PURCHASING_SHEET_NAMES.ISSUE_LOGS);
  const data = sheet.getDataRange().getValues();
  const idCol = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].indexOf('id');

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol]).trim() === String(id).trim()) {
      sheet.deleteRow(i + 1);
      logAuditEntry(clientMeta, 'DELETE_ISSUE_LOG', 'QC Issue Log', id, `ลบ Issue Log ID: ${id}`);
      return { status: 'success' };
    }
  }
  return { status: 'error', message: 'Issue log record not found' };
}

function saveDefectCategory(categoryObj, clientMeta) {
  clearPurchasingCache();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(PURCHASING_SHEET_NAMES.DEFECT_CATEGORIES);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const data = sheet.getDataRange().getValues();
  const idCol = headers.indexOf('id') + 1;
  let rowIndex = -1;

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol - 1]).trim() === String(categoryObj.id).trim()) {
      rowIndex = i + 1;
      break;
    }
  }

  const row = headers.map((header) => {
    switch (header) {
      case 'id': return categoryObj.id || _generateUniqueId('DEF');
      case 'name': return categoryObj.name || '';
      case 'description': return categoryObj.description || '';
      case 'isActive': return categoryObj.isActive !== false;
      default: return categoryObj[header] !== undefined ? categoryObj[header] : '';
    }
  });

  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
    logAuditEntry(clientMeta, 'UPDATE_DEFECT_CAT', 'Master Data', categoryObj.id, `แก้ไขประเภทข้อบกพร่อง: ${categoryObj.name}`);
  } else {
    sheet.appendRow(row);
    logAuditEntry(clientMeta, 'CREATE_DEFECT_CAT', 'Master Data', categoryObj.id, `เพิ่มประเภทข้อบกพร่องใหม่: ${categoryObj.name}`);
  }

  return { status: 'success', categoryId: categoryObj.id };
}

function deleteDefectCategory(id, clientMeta) {
  clearPurchasingCache();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(PURCHASING_SHEET_NAMES.DEFECT_CATEGORIES);
  const data = sheet.getDataRange().getValues();
  const idCol = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].indexOf('id');

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol]).trim() === String(id).trim()) {
      sheet.deleteRow(i + 1);
      logAuditEntry(clientMeta, 'DELETE_DEFECT_CAT', 'Master Data', id, `ลบประเภทข้อบกพร่อง ID: ${id}`);
      return { status: 'success' };
    }
  }
  return { status: 'error', message: 'Defect category not found' };
}

function getSheetDataAsObjects(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() <= 1) return [];

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(h => String(h || '').trim());
  const objects = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const isEmpty = row.every(cell => cell === '' || cell === null || cell === undefined);
    if (isEmpty) continue;

    const obj = {};
    headers.forEach((header, index) => {
      if (header) {
        let val = row[index];
        if (val instanceof Date) {
          if (DATE_ONLY_FIELDS[header] || header.toLowerCase().includes('date')) {
            val = _formatDateOnly(val);
          } else {
            val = getThaiTimestamp(val);
          }
        }
        obj[header] = val;
      }
    });
    objects.push(obj);
  }

  return objects;
}

function logAuditEntry(clientMeta, action, moduleName, recordId, details) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('Audit_Logs');
    if (!sheet) {
      sheet = ss.insertSheet('Audit_Logs');
      const auditHeaders = [
        'Timestamp', 'Action', 'Module', 'Record ID / Target',
        'Action Details', 'Client IP', 'Device & OS', 'User Session'
      ];
      setupPurchasingSheetHeaders(sheet, auditHeaders, '#0f172a');
    }

    const timestamp = getThaiTimestamp();
    const meta = clientMeta || {};
    const ip = meta.clientIp || meta.ip || '-';
    const device = meta.device || meta.userAgent || '-';
    const user = meta.userId || meta.userSession || meta.username || 'System';

    sheet.appendRow([
      timestamp,
      action,
      moduleName,
      recordId || '-',
      details || '-',
      ip,
      device,
      user
    ]);
  } catch (e) {
    Logger.log('logAuditEntry failed: ' + e.toString());
  }
}

// =========================================================================
// 5. GOOGLE DRIVE ATTACHMENTS & MEDIA STORAGE
// =========================================================================

function getOrCreateReceivingAttachmentsFolder() {
  const folderNames = ['RM_Attachments', 'RM_Receiving_Attachments'];
  for (let i = 0; i < folderNames.length; i++) {
    const folders = DriveApp.getFoldersByName(folderNames[i]);
    if (folders.hasNext()) {
      return folders.next();
    }
  }
  
  try {
    const newFolder = DriveApp.createFolder('RM_Attachments');
    try {
      newFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (e) {
      Logger.log('Could not set public sharing on folder: ' + e.toString());
    }
    return newFolder;
  } catch (err) {
    Logger.log('DriveApp.createFolder failed, using Root folder: ' + err.toString());
    return DriveApp.getRootFolder();
  }
}

function extractDriveFileId(url) {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/[-\w]{25,}/);
  return match ? match[0] : null;
}

function uploadReceivingAttachmentToDrive(recordId, billNo, base64Data, mimeType, fileName) {
  try {
    if (!base64Data || typeof base64Data !== 'string') {
      return { status: 'error', success: false, message: 'No image data provided' };
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
    
    // Remove all whitespace, line breaks or carriage returns from base64 string
    cleanBase64 = cleanBase64.replace(/[\s\r\n]+/g, '');
    
    const bytes = Utilities.base64Decode(cleanBase64);
    let ext = 'jpg';
    if (detectedMime.indexOf('png') !== -1) ext = 'png';
    else if (detectedMime.indexOf('webp') !== -1) ext = 'webp';
    else if (detectedMime.indexOf('pdf') !== -1) ext = 'pdf';
    
    const timestamp = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyyMMdd_HHmmss');
    const safeBillNo = (billNo || 'NOBILL').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeRecordId = (recordId || 'REC').replace(/[^a-zA-Z0-9_-]/g, '_');
    const finalFileName = fileName || `RM_${safeBillNo}_${safeRecordId}_${timestamp}.${ext}`;
    
    const blob = Utilities.newBlob(bytes, detectedMime, finalFileName);
    const file = folder.createFile(blob);
    
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (e) {
      Logger.log('Could not set public sharing on uploaded file: ' + e.toString());
    }
    
    const fileId = file.getId();
    const driveViewUrl = `https://drive.google.com/file/d/${fileId}/view?usp=drivesdk`;
    const directImageUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
    const downloadUrl = file.getDownloadUrl ? file.getDownloadUrl() : driveViewUrl;
    
    return {
      status: 'success',
      success: true,
      fileUrl: directImageUrl,
      driveViewUrl: driveViewUrl,
      downloadUrl: downloadUrl,
      fileId: fileId,
      data: {
        id: fileId,
        name: finalFileName,
        url: directImageUrl,
        driveViewUrl: driveViewUrl,
        downloadUrl: downloadUrl,
        mimeType: detectedMime,
        size: bytes.length,
        uploadedAt: getThaiTimestamp()
      }
    };
  } catch (err) {
    Logger.log('uploadReceivingAttachmentToDrive failed: ' + err.toString());
    return {
      status: 'error',
      success: false,
      message: err.toString()
    };
  }
}

function deleteReceivingAttachmentFromDrive(fileId, recordId) {
  try {
    if (!fileId) return { status: 'error', message: 'Missing fileId' };
    
    let targetFileId = fileId;
    if (fileId.indexOf('http') === 0 || fileId.indexOf('drive.google.com') !== -1) {
      targetFileId = extractDriveFileId(fileId);
    }
    
    if (!targetFileId) {
      return { status: 'error', message: 'Could not extract Google Drive File ID' };
    }
    
    const file = DriveApp.getFileById(targetFileId);
    file.setTrashed(true);
    
    if (recordId) {
      try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const sheet = ss.getSheetByName(PURCHASING_SHEET_NAMES.RECEIVING_RECORDS);
        if (sheet) {
          const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
          const data = sheet.getDataRange().getValues();
          const idCol = headers.indexOf('id');
          const attCol = headers.indexOf('attachments');
          
          if (idCol >= 0 && attCol >= 0) {
            for (let i = 1; i < data.length; i++) {
              if (String(data[i][idCol]).trim() === String(recordId).trim()) {
                const currentAttachments = parseAttachmentsFromSheet(data[i][attCol]);
                const filtered = currentAttachments.filter(a => a.id !== targetFileId && !a.url.includes(targetFileId));
                sheet.getRange(i + 1, attCol + 1).setValue(formatAttachmentsForSheet(recordId, '', filtered));
                clearPurchasingCache();
                break;
              }
            }
          }
        }
      } catch (e) {}
    }
    
    return { status: 'success', fileId: targetFileId };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}

function formatAttachmentsForSheet(recordId, billNo, attachments) {
  if (!attachments || !Array.isArray(attachments) || attachments.length === 0) {
    return '';
  }

  const cleanList = attachments.map((att) => {
    if (typeof att === 'string') {
      const fileId = extractDriveFileId(att) || '';
      return {
        id: fileId,
        name: fileId ? `File_${fileId.substring(0, 8)}` : 'Attachment',
        url: att,
        driveViewUrl: fileId ? `https://drive.google.com/file/d/${fileId}/view` : att
      };
    }
    return {
      id: att.id || extractDriveFileId(att.url) || '',
      name: att.name || 'Attachment',
      url: att.url || '',
      driveViewUrl: att.driveViewUrl || (att.id ? `https://drive.google.com/file/d/${att.id}/view` : att.url)
    };
  });

  return JSON.stringify(cleanList);
}

function parseAttachmentsFromSheet(rawAttachments) {
  if (!rawAttachments) return [];
  
  if (Array.isArray(rawAttachments)) {
    return rawAttachments.map(function (item) { return parseSingleAttachment(item); }).filter(Boolean);
  }
  
  const rawStr = String(rawAttachments).trim();
  if (!rawStr) return [];
  
  if (rawStr.startsWith('[') && rawStr.endsWith(']')) {
    try {
      const parsed = JSON.parse(rawStr);
      if (Array.isArray(parsed)) {
        return parsed.map(function (item) { return parseSingleAttachment(item); }).filter(Boolean);
      }
    } catch (e) {}
  }
  
  const parts = rawStr.split(/[\n,]+/).map(function (s) { return s.trim(); }).filter(Boolean);
  return parts.map(function (url) { return parseSingleAttachment(url); }).filter(Boolean);
}

function parseSingleAttachment(item) {
  if (!item) return null;
  if (typeof item === 'object') {
    return {
      id: item.id || extractDriveFileId(item.url) || '',
      name: item.name || 'รูปภาพแนบ',
      url: item.url || '',
      driveViewUrl: item.driveViewUrl || item.url || ''
    };
  }
  
  const url = String(item).trim();
  if (!url) return null;
  
  const fileId = extractDriveFileId(url) || '';
  return {
    id: fileId,
    name: fileId ? `ภาพแนบ (${fileId.substring(0, 6)})` : 'รูปภาพแนบ',
    url: url,
    driveViewUrl: fileId ? `https://drive.google.com/file/d/${fileId}/view` : url
  };
}

// =========================================================================
// 6. SETUP & SPREADSHEET UI MENUS
// =========================================================================

function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  const sheetsToSetup = [
    { name: 'Customers', headers: SCHEMA_HEADERS_MAP['Customers'] },
    { name: 'Products', headers: SCHEMA_HEADERS_MAP['Products'] },
    { name: 'Orders', headers: SCHEMA_HEADERS_MAP['Orders'] },
    { name: 'OrderLines', headers: SCHEMA_HEADERS_MAP['OrderLines'] },
    { name: 'WipPrepItems', headers: SCHEMA_HEADERS_MAP['WipPrepItems'] },
    { name: 'Plans', headers: SCHEMA_HEADERS_MAP['Plans'] },
    { name: 'Allocations', headers: SCHEMA_HEADERS_MAP['Allocations'] },
    { name: 'BoardNotes', headers: SCHEMA_HEADERS_MAP['BoardNotes'] },
    { name: 'ProductionActualEntries', headers: SCHEMA_HEADERS_MAP['ProductionActualEntries'] }
  ];

  sheetsToSetup.forEach(config => {
    let sheet = ss.getSheetByName(config.name);
    if (!sheet) {
      sheet = ss.insertSheet(config.name);
    }
    
    if (sheet.getLastColumn() < config.headers.length || sheet.getLastRow() < 1) {
      const range = sheet.getRange(1, 1, 1, config.headers.length);
      range.setValues([config.headers]);
      range.setFontWeight('bold');
      range.setBackground('#f3f4f6');
      sheet.setFrozenRows(1);
    } else {
      const currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      if (!currentHeaders || currentHeaders.filter(Boolean).length === 0) {
        const range = sheet.getRange(1, 1, 1, config.headers.length);
        range.setValues([config.headers]);
        range.setFontWeight('bold');
        range.setBackground('#f3f4f6');
        sheet.setFrozenRows(1);
      }
    }
  });

  const defaultSheet = ss.getSheetByName('Sheet1') || ss.getSheetByName('แผ่นงาน1');
  if (defaultSheet && ss.getSheets().length > 1) {
    try {
      ss.deleteSheet(defaultSheet);
    } catch (e) {}
  }
}

function setupPurchasingDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. DB_Suppliers
  let supSheet = ss.getSheetByName(PURCHASING_SHEET_NAMES.SUPPLIERS);
  if (!supSheet) supSheet = ss.insertSheet(PURCHASING_SHEET_NAMES.SUPPLIERS);
  setupPurchasingSheetHeaders(supSheet, ['id', 'code', 'name', 'phone', 'contactPerson', 'email', 'address', 'createdAt'], '#10b981');

  // 2. DB_RMItems
  let rmSheet = ss.getSheetByName(PURCHASING_SHEET_NAMES.RM_ITEMS);
  if (!rmSheet) rmSheet = ss.insertSheet(PURCHASING_SHEET_NAMES.RM_ITEMS);
  setupPurchasingSheetHeaders(rmSheet, ['id', 'code', 'name', 'category', 'categoryLabel', 'unit', 'supplierId', 'supplierName', 'supplierIds'], '#0284c7');

  // 3. DB_DefectMatrix
  let matrixSheet = ss.getSheetByName(PURCHASING_SHEET_NAMES.DEFECT_MATRIX);
  if (!matrixSheet) matrixSheet = ss.insertSheet(PURCHASING_SHEET_NAMES.DEFECT_MATRIX);
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

  // 4. DB_DefectCategories
  let defectCatSheet = ss.getSheetByName(PURCHASING_SHEET_NAMES.DEFECT_CATEGORIES);
  if (!defectCatSheet) defectCatSheet = ss.insertSheet(PURCHASING_SHEET_NAMES.DEFECT_CATEGORIES);
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

  // 5. DB_ReceivingRecords
  let recSheet = ss.getSheetByName(PURCHASING_SHEET_NAMES.RECEIVING_RECORDS);
  if (!recSheet) recSheet = ss.insertSheet(PURCHASING_SHEET_NAMES.RECEIVING_RECORDS);
  const recHeaders = [
    'id', 'billNo', 'receiveDate', 'supplierId', 'supplierName',
    'rmId', 'rmName', 'rmCategory', 'receiveQty', 'sampleQty',
    'defectQty', 'defectPercent', 'isPass', 'remark', 'createdAt', 'hasIssueLog',
    'postProductionDefectQty', 'postProductionRemark', 'postProductionDate', 'unitPrice',
    'attachments'
  ];
  setupPurchasingSheetHeaders(recSheet, recHeaders, '#059669');

  // 6. DB_IssueLogs
  let issueSheet = ss.getSheetByName(PURCHASING_SHEET_NAMES.ISSUE_LOGS);
  if (!issueSheet) issueSheet = ss.insertSheet(PURCHASING_SHEET_NAMES.ISSUE_LOGS);
  const issueHeaders = [
    'id', 'receivingRecordId', 'supplierId', 'supplierName',
    'rmId', 'rmName', 'billNo', 'issueDate', 'problemQty',
    'defectCategory', 'problemsFound', 'correctiveAction', 'status', 'createdAt'
  ];
  setupPurchasingSheetHeaders(issueSheet, issueHeaders, '#dc2626');

  // 7. Audit_Logs
  let auditSheet = ss.getSheetByName('Audit_Logs');
  if (!auditSheet) auditSheet = ss.insertSheet('Audit_Logs');
  const auditHeaders = [
    'Timestamp', 'Action', 'Module', 'Record ID / Target',
    'Action Details', 'Client IP', 'Device & OS', 'User Session'
  ];
  setupPurchasingSheetHeaders(auditSheet, auditHeaders, '#0f172a');
}

function syncAndSanitizePurchasingSheets() {
  setupPurchasingDatabase();
}

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

function testDriveAuth() {
  const folder = getOrCreateReceivingAttachmentsFolder();
  Logger.log('✅ Google Drive is authorized! Attachments folder ID: ' + folder.getId());
  return folder.getId();
}

function onOpen() {
  try {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu('🚀 ระบบวางแผนการผลิต')
      .addItem('⚙️ ตั้งค่าฐานข้อมูลการผลิต (Setup Production DB)', 'setupDatabase')
      .addItem('🔄 ล้างและซิงค์หัวตาราง (Sync Production Headers)', 'syncAndSanitizeAllSheets')
      .addToUi();

    ui.createMenu('🛒 ระบบจัดซื้อ & QC')
      .addItem('⚙️ ตั้งค่าฐานข้อมูลจัดซื้อ (Setup Purchasing DB)', 'setupPurchasingDatabase')
      .addItem('🔄 ล้างและซิงค์หัวตาราง (Sync Purchasing Headers)', 'syncAndSanitizePurchasingSheets')
      .addItem('🔓 ยืนยันสิทธิ์ Google Drive (Auth Drive)', 'testDriveAuth')
      .addToUi();
  } catch (e) {}
}

function onEdit(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  const sheetName = sheet.getName();
  const startRow = e.range.getRow();
  const numRows = e.range.getNumRows();
  
  if (startRow <= 1 && numRows === 1) return;
  
  const purchasingSheets = {
    DB_Suppliers: { idPrefix: 'sup-', length: 4, idCol: 1, createdCol: 8 },
    DB_RMItems: { idPrefix: 'rm-', length: 4, idCol: 1, createdCol: null },
    DB_ReceivingRecords: { idPrefix: 'REC-', length: 6, idCol: 1, createdCol: 15 },
    DB_IssueLogs: { idPrefix: 'ISS-', length: 6, idCol: 1, createdCol: 14 }
  };
  
  const config = purchasingSheets[sheetName];
  if (!config) return;

  const tsBase = new Date().getTime();
  const currentIso = getThaiTimestamp();
  let changesMade = false;

  for (let i = 0; i < numRows; i++) {
    const row = startRow + i;
    if (row <= 1) continue;

    const hasData = sheet.getRange(row, 2, 1, 3).getValues()[0].some(val => val !== '');
    if (!hasData) continue;

    const idRange = sheet.getRange(row, config.idCol);
    if (!idRange.getValue()) {
      const uniqueSuffix = (tsBase + i).toString().slice(-config.length);
      const newId = config.idPrefix + uniqueSuffix;
      idRange.setValue(newId);
      changesMade = true;
    }
    
    if (config.createdCol) {
      const createdRange = sheet.getRange(row, config.createdCol);
      if (!createdRange.getValue()) {
        createdRange.setValue(currentIso);
        changesMade = true;
      }
    }
  }

  if (changesMade) {
    SpreadsheetApp.flush();
  }
}
