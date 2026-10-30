// Format PH mobile numbers (e.g. 0928-521-1953) so Excel never turns them into 9.28E+09
export function formatPhoneReadable(raw) {
  if (!raw || raw === 'Not provided' || raw === '—') return '—';
  const cleaned = String(raw).replace(/^['"`’‘]+|['"`]+$/g, '').trim();
  if (!cleaned) return '—';
  const digits = cleaned.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('09')) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10 && digits.startsWith('9')) {
    return `0${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 12 && digits.startsWith('639')) {
    return `0${digits.slice(2, 5)}-${digits.slice(5, 8)}-${digits.slice(8)}`;
  }
  return cleaned;
}

// Format YYYY-MM-DD as "Nov 2, 2026"
export function formatDateReadable(rawDate) {
  if (!rawDate) return 'Unscheduled';
  const parts = String(rawDate).trim().split('-').map(Number);
  const d =
    parts.length === 3 && parts.every(Number.isFinite)
      ? new Date(parts[0], parts[1] - 1, parts[2])
      : new Date(rawDate);
  if (Number.isNaN(d.getTime())) return String(rawDate);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// Strip auto-generated KML import text so only real planter notes appear
export function cleanFieldNotes(rawNotes) {
  if (!rawNotes) return '';
  const str = String(rawNotes).trim();
  if (/^Imported (from KML|& merged \d+ KML slices)/i.test(str)) {
    return '';
  }
  return str;
}

export const REPORT_HEADERS = [
  'No.',
  'Planter Name',
  'Contact Number',
  'Association',
  'Hacienda',
  'Barangay',
  'City / Municipality',
  'Area (Ha)',
  'Est. Cane (MT)',
  'Target Harvest Date',
  'Harvest Timeline',
  'Schedule Status',
  'Latitude',
  'Longitude',
  'Planter Notes / Remarks',
];

export function buildReportData(lots = []) {
  const rows = lots.map((l, idx) => {
    const areaNum = Number(Number(l.areaHa || 0).toFixed(2));
    const tonsNum = Math.round(
      Number(l.estimatedTons || areaNum * 75)
    );
    return [
      idx + 1,
      l.planter || '',
      formatPhoneReadable(l.contactNumber),
      l.association || 'Private',
      l.hacienda || '',
      l.barangay || '',
      l.city || '',
      areaNum,
      tonsNum,
      l.formattedHarvestDate || formatDateReadable(l.plannedHarvestDate),
      l.plannedHarvestDate ? l.harvestTimelineLabel || '' : 'No date set',
      l.status || 'No Date Set',
      Number(Number(l.latitude || 0).toFixed(5)),
      Number(Number(l.longitude || 0).toFixed(5)),
      cleanFieldNotes(l.harvestNotes),
    ];
  });

  const totalAreaHa = Number(
    lots.reduce((sum, l) => sum + (Number(l.areaHa) || 0), 0).toFixed(2)
  );
  const totalEstTons = Math.round(
    lots.reduce(
      (sum, l) =>
        sum + Number(l.estimatedTons || Number(l.areaHa || 0) * 75),
      0
    )
  );

  return { rows, totalAreaHa, totalEstTons, totalLots: lots.length };
}

function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// 1. CSV Exporter (.csv)
// ---------------------------------------------------------------------------
export function exportReportCsv(lots = [], baseFilename = 'CaneReadyPH_Harvest_Schedule') {
  const { rows, totalAreaHa, totalEstTons, totalLots } = buildReportData(lots);

  const escapeCsvField = (value) => {
    if (value === null || value === undefined) return '';
    const str = String(value).trim();
    if (/[",\r\n]/.test(str)) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  };

  const formattedRows = rows.map((r) => [
    r[0],
    r[1],
    r[2],
    r[3],
    r[4],
    r[5],
    r[6],
    Number(r[7]).toFixed(2),
    r[8],
    r[9],
    r[10],
    r[11],
    Number(r[12]).toFixed(5),
    Number(r[13]).toFixed(5),
    r[14],
  ]);

  const summaryRow = [
    '',
    `TOTAL (${totalLots} Planter Lots)`,
    '',
    '',
    '',
    '',
    '',
    totalAreaHa.toFixed(2),
    totalEstTons,
    '',
    '',
    '',
    '',
    '',
    '',
  ];

  const nl = '\r\n';
  const csvContent =
    '\uFEFF' +
    [
      REPORT_HEADERS.map(escapeCsvField).join(','),
      ...formattedRows.map((row) => row.map(escapeCsvField).join(',')),
      '',
      summaryRow.map(escapeCsvField).join(','),
    ].join(nl);

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  triggerBlobDownload(blob, `${baseFilename}.csv`);
}

// ---------------------------------------------------------------------------
// 2. Native Excel Workbook Exporter (.xlsx) — Zero external dependencies
// ---------------------------------------------------------------------------
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function buildZipBlob(files, mimeType) {
  const encoder = new TextEncoder();
  const entries = files.map((f) => {
    const nameBytes = encoder.encode(f.name);
    const dataBytes =
      typeof f.content === 'string' ? encoder.encode(f.content) : f.content;
    return {
      nameBytes,
      dataBytes,
      crc: crc32(dataBytes),
    };
  });

  let offset = 0;
  const localParts = [];
  const centralParts = [];

  for (const entry of entries) {
    const { nameBytes, dataBytes, crc } = entry;
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true); // UTF-8 flag
    lv.setUint16(8, 0, true); // STORE (no compression)
    lv.setUint16(10, 0, true);
    lv.setUint16(12, 0, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, dataBytes.length, true);
    lv.setUint32(22, dataBytes.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    localParts.push(localHeader, dataBytes);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, dataBytes.length, true);
    cv.setUint32(24, dataBytes.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);

    centralParts.push(centralHeader);
    offset += localHeader.length + dataBytes.length;
  }

  const centralSize = centralParts.reduce((s, p) => s + p.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  return new Blob([...localParts, ...centralParts, eocd], { type: mimeType });
}

function escapeXml(val) {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function colIndexToLetter(colIdx) {
  let n = colIdx + 1;
  let str = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    str = String.fromCharCode(65 + rem) + str;
    n = Math.floor((n - 1) / 26);
  }
  return str;
}

export function exportReportXlsx(lots = [], baseFilename = 'CaneReadyPH_Harvest_Schedule') {
  const { rows, totalAreaHa, totalEstTons, totalLots } = buildReportData(lots);

  // Column widths tailored so every header and cell fits cleanly in Excel
  const colWidths = [6, 26, 17, 14, 24, 22, 18, 13, 15, 19, 22, 16, 13, 13, 42];
  const colsXml =
    '<cols>' +
    colWidths
      .map(
        (w, i) =>
          `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`
      )
      .join('') +
    '</cols>';

  const makeCellXml = (colIdx, rowNumber, val, styleId = 0, forceType = null) => {
    const ref = `${colIndexToLetter(colIdx)}${rowNumber}`;
    const isNum =
      forceType === 'n' ||
      (forceType === null && typeof val === 'number' && Number.isFinite(val));
    if (isNum) {
      return `<c r="${ref}" s="${styleId}"><v>${val}</v></c>`;
    }
    return `<c r="${ref}" s="${styleId}" t="inlineStr"><is><t>${escapeXml(
      val
    )}</t></is></c>`;
  };

  const sheetRowsXml = [];

  // Row 1: Header Row (Style 1 = Dark Emerald Fill, Bold White Text)
  const headerCells = REPORT_HEADERS.map((h, cIdx) =>
    makeCellXml(cIdx, 1, h, 1, 's')
  ).join('');
  sheetRowsXml.push(`<row r="1" ht="24" customHeight="1">${headerCells}</row>`);

  // Data Rows
  rows.forEach((r, idx) => {
    const rowNum = idx + 2;
    const cells = r
      .map((cellVal, cIdx) => {
        if (cIdx === 0 || cIdx === 8) {
          return makeCellXml(cIdx, rowNum, cellVal, 2, 'n'); // Integer
        }
        if (cIdx === 7) {
          return makeCellXml(cIdx, rowNum, cellVal, 3, 'n'); // 2-decimal Ha
        }
        if (cIdx === 12 || cIdx === 13) {
          return makeCellXml(cIdx, rowNum, cellVal, 4, 'n'); // 5-decimal Lat/Lng
        }
        return makeCellXml(cIdx, rowNum, cellVal, 0, 's');
      })
      .join('');
    sheetRowsXml.push(`<row r="${rowNum}" ht="19" customHeight="1">${cells}</row>`);
  });

  // Summary Total Row (Style 5 = Bold Text + Top/Bottom Border, Style 6 = Bold 2-dec Ha, Style 7 = Bold Int MT)
  const totalRowNum = rows.length + 2;
  const totalCells = [
    makeCellXml(0, totalRowNum, '', 5, 's'),
    makeCellXml(1, totalRowNum, `TOTAL (${totalLots} Planter Lots)`, 5, 's'),
    makeCellXml(2, totalRowNum, '', 5, 's'),
    makeCellXml(3, totalRowNum, '', 5, 's'),
    makeCellXml(4, totalRowNum, '', 5, 's'),
    makeCellXml(5, totalRowNum, '', 5, 's'),
    makeCellXml(6, totalRowNum, '', 5, 's'),
    makeCellXml(7, totalRowNum, totalAreaHa, 6, 'n'),
    makeCellXml(8, totalRowNum, totalEstTons, 7, 'n'),
    makeCellXml(9, totalRowNum, '', 5, 's'),
    makeCellXml(10, totalRowNum, '', 5, 's'),
    makeCellXml(11, totalRowNum, '', 5, 's'),
    makeCellXml(12, totalRowNum, '', 5, 's'),
    makeCellXml(13, totalRowNum, '', 5, 's'),
    makeCellXml(14, totalRowNum, '', 5, 's'),
  ].join('');
  sheetRowsXml.push(
    `<row r="${totalRowNum}" ht="22" customHeight="1">${totalCells}</row>`
  );

  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  ${colsXml}
  <sheetData>${sheetRowsXml.join('')}</sheetData>
</worksheet>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="2">
    <numFmt numFmtId="164" formatCode="#,##0.00"/>
    <numFmt numFmtId="165" formatCode="0.00000"/>
  </numFmts>
  <fonts count="3">
    <font><sz val="10"/><color rgb="FF0F172A"/><name val="Calibri"/></font>
    <font><b/><sz val="10.5"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
    <font><b/><sz val="10.5"/><color rgb="FF065F46"/><name val="Calibri"/></font>
  </fonts>
  <fills count="4">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF065F46"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFECFDF5"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left style="thin"><color rgb="FFE2E8F0"/></left><right style="thin"><color rgb="FFE2E8F0"/></right><top style="thin"><color rgb="FFE2E8F0"/></top><bottom style="thin"><color rgb="FFE2E8F0"/></bottom></border>
    <border><top style="medium"><color rgb="FF059669"/></top><bottom style="double"><color rgb="FF059669"/></bottom></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="8">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyBorder="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment vertical="center"/></xf>
    <xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyBorder="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyBorder="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyBorder="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment vertical="center"/></xf>
    <xf numFmtId="164" fontId="2" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="3" fontId="2" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="right" vertical="center"/></xf>
  </cellXfs>
</styleSheet>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Harvest Schedule" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;

  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

  const xlsxBlob = buildZipBlob(
    [
      { name: '[Content_Types].xml', content: contentTypesXml },
      { name: '_rels/.rels', content: rootRelsXml },
      { name: 'xl/workbook.xml', content: workbookXml },
      { name: 'xl/_rels/workbook.xml.rels', content: workbookRelsXml },
      { name: 'xl/styles.xml', content: stylesXml },
      { name: 'xl/worksheets/sheet1.xml', content: sheetXml },
    ],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );

  triggerBlobDownload(xlsxBlob, `${baseFilename}.xlsx`);
}

// ---------------------------------------------------------------------------
// 3. Native Landscape A4 PDF Exporter (.pdf) — Zero external dependencies
// ---------------------------------------------------------------------------
function pdfEscapeText(str) {
  return String(str ?? '')
    .replace(/[^\x20-\x7E]/g, (ch) => {
      if (ch === '•') return '-';
      if (ch === '—' || ch === '–') return '-';
      if (ch === 'ñ') return 'n';
      if (ch === 'Ñ') return 'N';
      return '';
    })
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function clipText(str, maxChars) {
  const s = String(str ?? '').trim();
  return s.length > maxChars ? s.slice(0, maxChars - 1) + '...' : s;
}

export function exportReportPdf(lots = [], baseFilename = 'CaneReadyPH_Harvest_Schedule') {
  const { rows, totalAreaHa, totalEstTons, totalLots } = buildReportData(lots);

  // Landscape A4 dimensions in points (842 x 595)
  const pageW = 842;
  const pageH = 595;
  const marginX = 24;
  const tableW = pageW - marginX * 2; // 794 pt
  const rowsPerPage = 22;

  // Column definitions (total = 794 pt)
  const cols = [
    { title: 'No.', w: 22, chars: 4 },
    { title: 'Planter Name', w: 98, chars: 21 },
    { title: 'Contact No.', w: 68, chars: 14 },
    { title: 'Assoc.', w: 38, chars: 8 },
    { title: 'Hacienda', w: 86, chars: 18 },
    { title: 'Barangay', w: 72, chars: 15 },
    { title: 'City', w: 58, chars: 12 },
    { title: 'Area (Ha)', w: 44, chars: 9 },
    { title: 'Est. MT', w: 40, chars: 8 },
    { title: 'Target Harvest', w: 62, chars: 13 },
    { title: 'Status', w: 58, chars: 12 },
    { title: 'Coordinates', w: 74, chars: 16 },
    { title: 'Planter Notes', w: 74, chars: 16 },
  ];

  const totalPages = Math.max(1, Math.ceil(rows.length / rowsPerPage));
  const generatedDate = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const pageStreams = [];

  for (let p = 0; p < totalPages; p++) {
    const pageRows = rows.slice(p * rowsPerPage, (p + 1) * rowsPerPage);
    const cmds = [];

    // Top Header Banner (Dark Emerald #065f46)
    cmds.push('0.024 0.373 0.275 rg');
    cmds.push(`${marginX} ${pageH - 58} ${tableW} 36 re f`);

    // Banner Title
    cmds.push('BT /F2 13 Tf 1 1 1 rg');
    cmds.push(
      `${marginX + 12} ${pageH - 38} Td (${pdfEscapeText(
        'CaneReadyPH - Planter Harvest Schedule & Field Hectarage Report'
      )}) Tj ET`
    );

    // Banner Subtitle & KPI Summary
    cmds.push('BT /F1 8.5 Tf 0.82 0.98 0.90 rg');
    cmds.push(
      `${marginX + 12} ${pageH - 51} Td (${pdfEscapeText(
        `Generated: ${generatedDate}   |   Registered Lots: ${totalLots}   |   Total Area: ${totalAreaHa.toFixed(
          2
        )} Ha   |   Est. Cane: ${totalEstTons.toLocaleString()} MT   |   Page ${
          p + 1
        } of ${totalPages}`
      )}) Tj ET`
    );

    // Table Header Bar
    const tableTopY = pageH - 68;
    const headerH = 20;
    cmds.push('0.059 0.090 0.165 rg');
    cmds.push(`${marginX} ${tableTopY - headerH} ${tableW} ${headerH} re f`);

    let curX = marginX;
    for (const c of cols) {
      cmds.push('BT /F2 7.5 Tf 1 1 1 rg');
      cmds.push(
        `${curX + 4} ${tableTopY - 13} Td (${pdfEscapeText(c.title)}) Tj ET`
      );
      curX += c.w;
    }

    // Table Data Rows
    const rowH = 19;
    let curY = tableTopY - headerH;

    pageRows.forEach((r, idx) => {
      const rowBottomY = curY - rowH;

      // Zebra stripe background
      if (idx % 2 === 1) {
        cmds.push('0.96 0.97 0.98 rg');
        cmds.push(`${marginX} ${rowBottomY} ${tableW} ${rowH} re f`);
      }

      // Row bottom border line
      cmds.push('0.88 0.91 0.94 RG 0.5 w');
      cmds.push(
        `${marginX} ${rowBottomY} m ${marginX + tableW} ${rowBottomY} l S`
      );

      const cellValues = [
        String(r[0]),
        clipText(r[1], cols[1].chars),
        clipText(r[2], cols[2].chars),
        clipText(r[3], cols[3].chars),
        clipText(r[4], cols[4].chars),
        clipText(r[5], cols[5].chars),
        clipText(r[6], cols[6].chars),
        Number(r[7]).toFixed(2),
        Number(r[8]).toLocaleString(),
        clipText(r[9], cols[9].chars),
        clipText(r[11], cols[10].chars),
        `${Number(r[12]).toFixed(4)}, ${Number(r[13]).toFixed(4)}`,
        clipText(r[14] || '—', cols[12].chars),
      ];

      let cellX = marginX;
      cellValues.forEach((val, cIdx) => {
        const isBoldCol = cIdx === 1 || cIdx === 7 || cIdx === 9;
        const fontRef = isBoldCol ? '/F2' : '/F1';
        cmds.push(`BT ${fontRef} 7.2 Tf 0.06 0.09 0.16 rg`);
        cmds.push(
          `${cellX + 4} ${rowBottomY + 6} Td (${pdfEscapeText(val)}) Tj ET`
        );
        cellX += cols[cIdx].w;
      });

      curY = rowBottomY;
    });

    // Summary Total Row on the final page
    if (p === totalPages - 1) {
      const totalBottomY = curY - 22;
      cmds.push('0.92 0.99 0.96 rg');
      cmds.push(`${marginX} ${totalBottomY} ${tableW} 22 re f`);
      cmds.push('0.02 0.59 0.41 RG 1 w');
      cmds.push(
        `${marginX} ${totalBottomY} m ${marginX + tableW} ${totalBottomY} l S`
      );

      cmds.push('BT /F2 8 Tf 0.024 0.373 0.275 rg');
      cmds.push(
        `${marginX + 26} ${totalBottomY + 7} Td (${pdfEscapeText(
          `TOTAL (${totalLots} Planter Lots)`
        )}) Tj ET`
      );

      // X offset for Area (Ha) and Est. MT columns
      const areaX = cols.slice(0, 7).reduce((s, c) => s + c.w, marginX);
      const tonsX = areaX + cols[7].w;

      cmds.push('BT /F2 8 Tf 0.024 0.373 0.275 rg');
      cmds.push(
        `${areaX + 4} ${totalBottomY + 7} Td (${pdfEscapeText(
          `${totalAreaHa.toFixed(2)} ha`
        )}) Tj ET`
      );
      cmds.push('BT /F2 8 Tf 0.024 0.373 0.275 rg');
      cmds.push(
        `${tonsX + 4} ${totalBottomY + 7} Td (${pdfEscapeText(
          `${totalEstTons.toLocaleString()} MT`
        )}) Tj ET`
      );
    }

    pageStreams.push(cmds.join('\n'));
  }

  // Assemble valid PDF-1.4 document
  const objects = [];
  const addObj = (body) => {
    objects.push(body);
    return objects.length;
  };

  const fontRegularId = addObj(
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'
  );
  const fontBoldId = addObj(
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'
  );

  const pagesRootId = addObj(''); // placeholder for Pages catalog
  const pageIds = [];

  for (const stream of pageStreams) {
    const contentId = addObj(
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
    );
    const pageId = addObj(
      `<< /Type /Page /Parent ${pagesRootId} 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`
    );
    pageIds.push(pageId);
  }

  objects[pagesRootId - 1] = `<< /Type /Pages /Kids [${pageIds
    .map((id) => `${id} 0 R`)
    .join(' ')}] /Count ${pageIds.length} >>`;

  const catalogId = addObj(`<< /Type /Catalog /Pages ${pagesRootId} 0 R >>`);

  let pdfText = '%PDF-1.4\n';
  const offsets = [0];

  objects.forEach((body, idx) => {
    offsets.push(pdfText.length);
    pdfText += `${idx + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefOffset = pdfText.length;
  pdfText += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    pdfText += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }

  pdfText += `trailer\n<< /Size ${
    objects.length + 1
  } /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  const pdfBlob = new Blob([pdfText], { type: 'application/pdf' });
  triggerBlobDownload(pdfBlob, `${baseFilename}.pdf`);
}
