function _generateUniqueId(prefix) {
  const timestamp = new Date().getTime().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 7);
  return (prefix ? prefix + "-" : "") + timestamp + "-" + randomStr;
}

function _normalizeBoolean(val, defaultValue) {
  if (val === "" || val === null || val === undefined) return defaultValue !== undefined ? defaultValue : true;
  if (typeof val === "boolean") return val;
  const s = String(val).trim().toUpperCase();
  if (s === "TRUE" || s === "1" || s === "YES") return true;
  if (s === "FALSE" || s === "0" || s === "NO") return false;
  return defaultValue !== undefined ? defaultValue : true;
}

// Fields that should stay as date-only (YYYY-MM-DD), NOT full ISO datetime
const DATE_ONLY_FIELDS = {
  "weekStart": true, "weekEnd": true, "productionDate": true,
  "dueDate": true, "orderDate": true
};

// Fields that should be coerced to numbers
const NUMERIC_FIELDS = {
  "orderedQty": true, "cancelledQty": true, "completedQty": true, "shortageQty": true, "boxQty": true,
  "plannedQty": true, "fgOutputQty": true, "displayOrder": true,
  "goodQty": true, "wasteQty": true, "reworkQty": true, "shortfallQty": true
};

function _formatDateOnly(val) {
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(val || "").trim();
  // If already "YYYY-MM-DD" or contains "T", extract date portion
  if (s.length >= 10 && s[4] === '-' && s[7] === '-') {
    return s.substring(0, 10);
  }
  return s;
}

const SCHEMA_HEADERS_MAP = {
  "Customers": ["customerId", "customerCode", "customerName", "shortName", "active", "createdAt", "updatedAt"],
  "Products": ["productId", "productCode", "productName", "shortName", "defaultUnit", "customerId", "estimatedYieldPerBatch", "active", "createdAt", "updatedAt"],
  "Orders": ["id", "orderNo", "customerName", "orderDate", "note", "status", "createdAt", "updatedAt"],
  "OrderLines": ["id", "orderId", "skuCode", "skuName", "orderedQty", "cancelledQty", "unit", "dueDate", "priority", "notes", "packaging", "completedQty", "shortageQty", "boxQty"],
  "WipPrepItems": ["itemId", "itemType", "itemCode", "itemName", "shortName", "defaultUnit", "relatedProduct", "note", "active", "createdAt", "updatedAt"],
  "Plans": ["id", "weekStart", "weekEnd", "revisionNumber", "status", "sourcePlanId", "publishedAt", "cancelledAt", "createdAt", "updatedAt"],
  "Allocations": ["allocationId", "planId", "sourceType", "salesOrderId", "salesOrderLineId", "wipPrepItemId", "productionDate", "roomId", "plannedQty", "unit", "plannedUnit", "fgOutputQty", "fgOutputUnit", "note", "printCustomerTag", "printNote", "highlightOnPlan", "displayOrder", "sourceAllocationId", "status", "createdAt", "updatedAt"],
  "BoardNotes": ["noteId", "planId", "productionDate", "roomId", "noteText", "highlightOnPlan", "displayOrder", "createdAt", "updatedAt"],
  "ProductionActualEntries": ["actualEntryId", "allocationId", "entryType", "goodQty", "wasteQty", "reworkQty", "shortfallQty", "shortfallReason", "boxQty", "recordedAt", "recordedBy"]
};

function _getStandardKey(sheetName, rawHeader) {
  const h = String(rawHeader || "").trim();
  const clean = h.toLowerCase().replace(/[^a-z0-9]/g, "");

  const expected = SCHEMA_HEADERS_MAP[sheetName] || [];
  for (let i = 0; i < expected.length; i++) {
    const stdKey = expected[i];
    if (stdKey.toLowerCase().replace(/[^a-z0-9]/g, "") === clean) {
      return stdKey;
    }
  }
  return h;
}

function _getValueByFlexibleKey(obj, headerName) {
  if (!obj || typeof obj !== 'object') return "";
  if (obj[headerName] !== undefined) return obj[headerName];

  const cleanHeader = String(headerName || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const key of Object.keys(obj)) {
    if (key.toLowerCase().replace(/[^a-z0-9]/g, "") === cleanHeader) {
      return obj[key];
    }
  }
  return "";
}

function _sanitizeAndAutoAssignSheet(sheetName, customerMap) {
  const ss = SpreadsheetApp.openById('13xLjgBYXZYqC-RAP8rodNtkMeRykJr9rpD4UA2jkkkE');
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
      sheet.getRange(1, 1, 1, expectedHeaders.length).setFontWeight("bold").setBackground("#f3f4f6");
      sheet.setFrozenRows(1);
      lastCol = expectedHeaders.length;
      lastRow = 1;
    } else {
      return [];
    }
  }

  const rawValues = sheet.getRange(1, 1, Math.max(lastRow, 1), Math.max(lastCol, expectedHeaders.length)).getValues();
  if (!rawValues || rawValues.length < 2) return [];

  const rawHeaders = rawValues[0].map(h => String(h || "").trim());
  const headers = rawHeaders.map(h => _getStandardKey(sheetName, h));

  const idKeyMap = {
    "Customers": { key: "customerId", prefix: "cust" },
    "Products": { key: "productId", prefix: "prod" },
    "Orders": { key: "id", prefix: "ord" },
    "OrderLines": { key: "id", prefix: "line" },
    "WipPrepItems": { key: "itemId", prefix: "wip" },
    "Plans": { key: "id", prefix: "plan" },
    "Allocations": { key: "allocationId", prefix: "alloc" },
    "BoardNotes": { key: "noteId", prefix: "note" },
    "ProductionActualEntries": { key: "actualEntryId", prefix: "actual" }
  };

  const config = idKeyMap[sheetName] || { key: "id", prefix: "item" };
  const idColIdx = headers.indexOf(config.key);
  const createdAtIdx = headers.indexOf("createdAt");
  const updatedAtIdx = headers.indexOf("updatedAt");
  const activeIdx = headers.indexOf("active");
  const customerIdIdx = sheetName === "Products" ? headers.indexOf("customerId") : -1;
  const yieldIdx = sheetName === "Products" ? headers.indexOf("estimatedYieldPerBatch") : -1;

  let needsWriteBack = false;
  const nowIso = getThaiTimestamp();
  const validObjects = [];

  for (let r = 1; r < rawValues.length; r++) {
    const row = rawValues[r];
    const isEmpty = row.every(cell => cell === "" || cell === null || cell === undefined);
    if (isEmpty) continue;

    const hasData = row.some((cell, idx) => idx !== idColIdx && String(cell || "").trim() !== "");
    if (!hasData) continue;

    let modifiedRow = false;

    if (idColIdx !== -1) {
      const currentId = String(row[idColIdx] || "").trim();
      if (!currentId) {
        row[idColIdx] = _generateUniqueId(config.prefix);
        modifiedRow = true;
      }
    }

    if (createdAtIdx !== -1) {
      const cVal = String(row[createdAtIdx] || "").trim();
      if (!cVal) {
        row[createdAtIdx] = nowIso;
        modifiedRow = true;
      }
    }

    if (updatedAtIdx !== -1) {
      const uVal = String(row[updatedAtIdx] || "").trim();
      if (!uVal) {
        row[updatedAtIdx] = nowIso;
        modifiedRow = true;
      }
    }

    if (sheetName === "Products" && customerIdIdx !== -1 && customerMap) {
      let custVal = String(row[customerIdIdx] || "").trim();
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
        // Date-only fields → "YYYY-MM-DD", datetime fields → full ISO
        if (val instanceof Date) {
          if (DATE_ONLY_FIELDS[header]) {
            val = _formatDateOnly(val);
          } else {
            val = getThaiTimestamp(val);
          }
        } else if (typeof val === 'string' && DATE_ONLY_FIELDS[header]) {
          // Even string dates may contain "T" from previous bad serialization
          val = _formatDateOnly(val);
        }
        if (index === activeIdx) {
          val = _normalizeBoolean(val, true);
        }
        if (index === yieldIdx) {
          val = val !== "" && !isNaN(Number(val)) ? Number(val) : undefined;
        }
        // Coerce numeric fields
        if (NUMERIC_FIELDS[header] && val !== "" && val !== null && val !== undefined) {
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
  const ss = SpreadsheetApp.openById('13xLjgBYXZYqC-RAP8rodNtkMeRykJr9rpD4UA2jkkkE');
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  const expectedHeaders = SCHEMA_HEADERS_MAP[sheetName] || [];
  let headers = [];

  if (sheet.getLastColumn() >= 1) {
    headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h || "").trim());
  }

  if (!headers || headers.filter(Boolean).length === 0) {
    headers = expectedHeaders;
    if (headers.length > 0) {
      const headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setValues([headers]);
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#f3f4f6");
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
  const ss = SpreadsheetApp.openById('13xLjgBYXZYqC-RAP8rodNtkMeRykJr9rpD4UA2jkkkE');
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  const expectedHeaders = SCHEMA_HEADERS_MAP[sheetName] || [];
  let headers = [];
  if (sheet.getLastColumn() >= 1) {
    headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h || "").trim());
  }

  if (!headers || headers.filter(Boolean).length === 0) {
    headers = expectedHeaders;
    if (headers.length > 0) {
      const headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setValues([headers]);
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#f3f4f6");
      sheet.setFrozenRows(1);
    }
  }

  const rows = _objectsToRows(objects, headers);
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
}

function apiGetSnapshot() {
  const customers = _getSheetData("Customers");
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
    products: _getSheetData("Products", customerMap),
    salesOrders: _getSheetData("Orders"),
    salesOrderLines: _getSheetData("OrderLines"),
    wipPrepItems: _getSheetData("WipPrepItems"),
    weeklyPlans: _getSheetData("Plans"),
    planAllocations: _getSheetData("Allocations"),
    boardNotes: _getSheetData("BoardNotes"),
    productionActualEntries: _getSheetData("ProductionActualEntries")
  };
  return JSON.stringify(data);
}

function syncAndSanitizeAllSheets() {
  return apiGetSnapshot();
}

function apiUpdateMasterData(payload) {
  if (payload.customers) {
    _writeToSheet("Customers", payload.customers);
  }
  if (payload.products) {
    _writeToSheet("Products", payload.products);
  }
  if (payload.wipPrepItems) {
    _writeToSheet("WipPrepItems", payload.wipPrepItems);
  }
  return { success: true };
}

function apiSaveSalesOrder(order, lines) {
  const existingOrders = _getSheetData("Orders");
  const idx = existingOrders.findIndex(o => o.id === order.id);

  if (idx >= 0) {
    existingOrders[idx] = order;
  } else {
    existingOrders.push(order);
  }
  _writeToSheet("Orders", existingOrders);

  if (lines) {
    let existingLines = _getSheetData("OrderLines");
    existingLines = existingLines.filter(l => l.orderId !== order.id);
    existingLines = existingLines.concat(lines);
    _writeToSheet("OrderLines", existingLines);
  }
  return { success: true };
}

function apiUpdateSalesOrderStatus(orderId, status) {
  const existingOrders = _getSheetData("Orders");
  const idx = existingOrders.findIndex(o => o.id === orderId);
  if (idx >= 0) {
    existingOrders[idx].status = status;
    existingOrders[idx].updatedAt = getThaiTimestamp();
    _writeToSheet("Orders", existingOrders);
  }
  return { success: true };
}

function apiSaveWeeklyPlan(plan, allocations, notes) {
  const existingPlans = _getSheetData("Plans");
  const idx = existingPlans.findIndex(p => String(p.id).trim() === String(plan.id).trim());

  const planRecord = Object.assign({}, plan);
  delete planRecord.allocations;

  if (idx >= 0) {
    existingPlans[idx] = planRecord;
  } else {
    existingPlans.push(planRecord);
  }
  _writeToSheet("Plans", existingPlans);

  if (allocations) {
    _writeToSheet("Allocations", allocations);
  }

  if (notes) {
    _writeToSheet("BoardNotes", notes);
  }

  return { success: true };
}

function apiRecordActualProduction(entry) {
  _appendRows("ProductionActualEntries", [entry]);
  return { success: true };
}

function apiSaveFullSnapshot(snapshotStr) {
  let snap = snapshotStr;
  if (typeof snapshotStr === 'string') {
    try {
      snap = JSON.parse(snapshotStr);
    } catch (e) {}
  }
  if (!snap || !snap.entities) return { success: false };

  const ent = snap.entities;
  if (ent.customers) _writeToSheet("Customers", ent.customers);
  if (ent.products) _writeToSheet("Products", ent.products);
  if (ent.salesOrders) _writeToSheet("Orders", ent.salesOrders);
  if (ent.salesOrderLines) _writeToSheet("OrderLines", ent.salesOrderLines);
  if (ent.wipPrepItems) _writeToSheet("WipPrepItems", ent.wipPrepItems);
  if (ent.weeklyPlans) {
    const cleanPlans = ent.weeklyPlans.map(p => {
      const copy = Object.assign({}, p);
      delete copy.allocations;
      return copy;
    });
    _writeToSheet("Plans", cleanPlans);
  }
  if (ent.planAllocations) _writeToSheet("Allocations", ent.planAllocations);
  if (ent.boardNotes) _writeToSheet("BoardNotes", ent.boardNotes);
  if (ent.productionActualEntries) _writeToSheet("ProductionActualEntries", ent.productionActualEntries);

  return { success: true };
}
