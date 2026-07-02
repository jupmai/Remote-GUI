import { jsPDF } from 'jspdf';
import logo from '../../assets/AnyLog_EDM_logo.png';
import { exportToCSV } from '../../utils/tableExport';

export { exportToCSV };

const loadImageDataUrl = (src) => new Promise((resolve, reject) => {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    resolve(canvas.toDataURL('image/png'));
  };
  image.onerror = reject;
  image.src = src;
});

const getPdfPalette = () => {
  const isDark = document.documentElement.dataset.theme === 'dark';
  return isDark ? {
    page: [5, 9, 20],
    topbar: [7, 21, 39],
    topbarMuted: [196, 207, 223],
    surface: [13, 21, 36],
    surfaceMuted: [23, 34, 56],
    text: [247, 251, 255],
    heading: [255, 255, 255],
    muted: [196, 207, 223],
    subtle: [146, 163, 188],
    border: [55, 80, 111],
    borderSoft: [45, 64, 90],
    codeBg: [7, 17, 31],
    codeText: [230, 241, 255],
    primary: [102, 179, 255],
  } : {
    page: [255, 255, 255],
    topbar: [16, 24, 40],
    topbarMuted: [184, 195, 216],
    surface: [255, 255, 255],
    surfaceMuted: [248, 250, 252],
    text: [23, 32, 51],
    heading: [23, 32, 51],
    muted: [70, 85, 110],
    subtle: [102, 116, 139],
    border: [215, 221, 232],
    borderSoft: [200, 210, 224],
    codeBg: [248, 250, 252],
    codeText: [17, 24, 39],
    primary: [37, 99, 235],
  };
};

const formatValue = (value) => {
  if (value == null) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const normalizeUnsPath = (path) => {
  const cleaned = String(path || '')
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)
    .join('/');
  if (!cleaned) return 'Root/uns';
  if (/^root\/uns(\/|$)/i.test(cleaned)) return cleaned.replace(/^root/i, 'Root');
  if (/^root\//i.test(cleaned)) return cleaned.replace(/^root/i, 'Root');
  if (/^uns(\/|$)/i.test(cleaned)) return `Root/${cleaned}`;
  return `Root/uns/${cleaned}`;
};

const getSourcePath = (source = {}) => (
  source.path
    || [source.dbms, source.table, source.name].filter(Boolean).join('/')
    || source.name
);

const formatTimeRangeLabel = ({
  timeMode = 'relative',
  timeRangeValue = 5,
  timeRangeUnit = 'minute',
  startTime = '',
  endTime = '',
  periodReferenceTime = '',
} = {}) => {
  if (timeMode === 'absolute') {
    return `${startTime || 'start'} to ${endTime || 'end'}`;
  }
  if (timeMode === 'period') {
    return [
      'Period',
      `Reference: ${periodReferenceTime || 'now()'}`,
      `Interval: ${timeRangeValue || 1} ${timeRangeUnit}${Number(timeRangeValue) !== 1 ? 's' : ''}`,
    ].filter(Boolean).join(' | ');
  }
  return `Last ${timeRangeValue} ${timeRangeUnit}${Number(timeRangeValue) !== 1 ? 's' : ''}`;
};

const getColumns = (data = [], preferredColumns = []) => {
  const ordered = Array.isArray(preferredColumns) ? preferredColumns.filter(Boolean) : [];
  const seen = new Set(ordered);
  data.forEach((row) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return;
    Object.keys(row).forEach((key) => {
      if (!seen.has(key)) {
        seen.add(key);
        ordered.push(key);
      }
    });
  });
  return ordered;
};

const splitColumnsForPdf = (columns, data, maxWidth, doc) => {
  const indexColumn = { key: '#', width: 28, rowIndex: true };
  const groups = [];
  let current = [indexColumn];
  let used = indexColumn.width;

  const estimateWidth = (column) => {
    const sampleValues = data.slice(0, 25).map((row) => formatValue(row?.[column]).slice(0, 80));
    const longest = [column, ...sampleValues].reduce((max, value) => Math.max(max, doc.getTextWidth(value)), 0);
    return Math.max(58, Math.min(168, longest + 14));
  };

  columns.forEach((column) => {
    const width = estimateWidth(column);
    if (used + width > maxWidth && current.length > 1) {
      groups.push(current);
      current = [indexColumn];
      used = indexColumn.width;
    }
    current.push({ key: column, width });
    used += width;
  });

  if (current.length > 1) groups.push(current);
  return groups.length ? groups : [[indexColumn]];
};

const setPdfFillColor = (doc, color) => {
  if (Array.isArray(color)) {
    doc.setFillColor(...color);
  } else {
    doc.setFillColor(color);
  }
};

const setPdfDrawColor = (doc, color) => {
  if (Array.isArray(color)) {
    doc.setDrawColor(...color);
  } else {
    doc.setDrawColor(color);
  }
};

const createUnsPdf = async ({ title, subtitle, filename, sections = [], chartImageDataUrl = null }) => {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const logoDataUrl = await loadImageDataUrl(logo);
  const palette = getPdfPalette();
  const margin = 36;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - margin * 2;
  const exportedAt = new Date();
  let y = 112;

  const drawHeader = () => {
    doc.setFillColor(...palette.page);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    doc.setFillColor(...palette.topbar);
    doc.rect(0, 0, pageWidth, 74, 'F');
    doc.addImage(logoDataUrl, 'PNG', margin, 18, 168, 36);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text(title || 'UNS Report', pageWidth - margin, 28, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...palette.topbarMuted);
    if (subtitle) doc.text(subtitle, pageWidth - margin, 44, { align: 'right' });
    doc.text(exportedAt.toLocaleString(), pageWidth - margin, 59, { align: 'right' });
  };

  const drawFooter = () => {
    const pageNumber = doc.internal.getNumberOfPages();
    doc.setDrawColor(...palette.border);
    doc.line(margin, pageHeight - 32, pageWidth - margin, pageHeight - 32);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...palette.subtle);
    doc.text('AnyLog Remote GUI | UNS', margin, pageHeight - 17);
    doc.text(`Page ${pageNumber}`, pageWidth - margin, pageHeight - 17, { align: 'right' });
  };

  const addPage = () => {
    drawFooter();
    doc.addPage();
    drawHeader();
    y = 104;
  };

  const ensureSpace = (height) => {
    if (y + height > pageHeight - 48) addPage();
  };

  const writeWrapped = (text, {
    x = margin,
    width = contentWidth,
    size = 10,
    style = 'normal',
    color = palette.text,
    lineGap = 4,
  } = {}) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(String(text || ''), width);
    lines.forEach((line) => {
      ensureSpace(size + lineGap + 2);
      doc.text(line, x, y);
      y += size + lineGap;
    });
    return lines.length;
  };

  const drawSectionTitle = (label) => {
    const lines = doc.splitTextToSize(String(label || ''), contentWidth);
    ensureSpace(lines.length * 16 + 10);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...palette.heading);
    doc.text(lines, margin, y);
    y += lines.length * 16 + 6;
  };

  const drawKeyValues = (items) => {
    const rows = items.filter((item) => item?.value != null && String(item.value).trim() !== '');
    if (!rows.length) return;
    rows.forEach(({ label, value }) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      const labelLines = doc.splitTextToSize(String(label).toUpperCase(), 112);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const valueLines = doc.splitTextToSize(String(value), contentWidth - 160);
      const lineCount = Math.max(labelLines.length, valueLines.length);
      const rowHeight = Math.max(22, lineCount * 11 + 10);
      ensureSpace(rowHeight + 4);
      doc.setFillColor(...palette.surfaceMuted);
      doc.setDrawColor(...palette.border);
      doc.roundedRect(margin, y, contentWidth, rowHeight, 4, 4, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...palette.muted);
      doc.text(labelLines, margin + 10, y + 13);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...palette.text);
      doc.text(valueLines, margin + 140, y + 13);
      y += rowHeight + 4;
    });
    y += 4;
  };

  const drawPathRows = (title, rows = []) => {
    const pathRows = rows
      .map((row) => ({
        ...row,
        path: normalizeUnsPath(row.path || row.name),
      }))
      .filter((row) => row.path);
    if (!pathRows.length) return;

    drawSectionTitle(title);
    pathRows.forEach((row, index) => {
      const meta = [row.metric, row.dbms && row.table ? `${row.dbms}.${row.table}` : '', row.rows != null ? `${row.rows} rows` : '']
        .filter(Boolean)
        .join(' | ');
      const metaLines = meta ? doc.splitTextToSize(meta, contentWidth - 26) : [];
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      const nameLines = doc.splitTextToSize(row.name || `Source ${index + 1}`, contentWidth - 42);
      doc.setFontSize(8.5);
      const pathLines = doc.splitTextToSize(row.path, contentWidth - 24);
      const height = Math.max(58, nameLines.length * 12 + pathLines.length * 13 + metaLines.length * 10 + 28);
      ensureSpace(height + 8);
      doc.setFillColor(...palette.surfaceMuted);
      doc.setDrawColor(...palette.border);
      doc.roundedRect(margin, y, contentWidth, height, 6, 6, 'FD');
      if (row.color) {
        setPdfFillColor(doc, row.color);
        doc.circle(margin + 12, y + 15, 4, 'F');
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...palette.heading);
      doc.text(nameLines, margin + 24, y + 17);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...palette.text);
      doc.text(pathLines, margin + 12, y + 22 + nameLines.length * 12);
      if (metaLines.length) {
        doc.setFontSize(8);
        doc.setTextColor(...palette.muted);
        doc.text(metaLines, margin + 12, y + 28 + nameLines.length * 12 + pathLines.length * 13);
      }
      y += height + 8;
    });
  };

  const measureLegend = (items = [], width = contentWidth) => {
    const legendItems = items.filter((item) => item?.label);
    if (!legendItems.length) return 0;
    const rowHeight = 22;
    let x = 0;
    let usedRows = 1;
    legendItems.forEach((item) => {
      const label = item.detail ? `${item.label} - ${item.detail}` : item.label;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      const itemWidth = Math.min(width, Math.max(120, doc.getTextWidth(label) + 42));
      if (x > 0 && x + itemWidth > width) {
        x = 0;
        usedRows += 1;
      }
      x += itemWidth + 12;
    });
    return usedRows * rowHeight + 8;
  };

  const drawLegendInline = (items = [], xStart = margin, yStart = y, width = contentWidth) => {
    const legendItems = items.filter((item) => item?.label);
    if (!legendItems.length) return 0;
    const rowHeight = 22;
    let x = xStart;
    let rowTop = yStart;
    let usedRows = 1;
    legendItems.forEach((item) => {
      const label = item.detail ? `${item.label} - ${item.detail}` : item.label;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      const itemWidth = Math.min(width, Math.max(120, doc.getTextWidth(label) + 42));
      if (x > xStart && x + itemWidth > xStart + width) {
        x = xStart;
        rowTop += rowHeight;
        usedRows += 1;
      }
      const textWidth = Math.max(20, itemWidth - 34);
      const lines = doc.splitTextToSize(label, textWidth).slice(0, 2);
      setPdfDrawColor(doc, item.color || palette.primary);
      doc.setLineWidth(1.8);
      doc.line(x, rowTop + 11, x + 22, rowTop + 11);
      setPdfFillColor(doc, item.color || palette.primary);
      doc.circle(x + 11, rowTop + 11, 3.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...palette.heading);
      doc.text(lines, x + 30, rowTop + 9);
      x += itemWidth + 12;
    });
    return usedRows * rowHeight + 8;
  };

  const drawCodeBlock = (label, value) => {
    if (value == null || String(value).trim() === '') return;
    drawSectionTitle(label);
    const lines = doc.splitTextToSize(String(value), contentWidth - 24);
    const lineHeight = 10;
    let index = 0;
    while (index < lines.length) {
      ensureSpace(72);
      const available = Math.max(5, Math.floor((pageHeight - 58 - y - 22) / lineHeight));
      const chunk = lines.slice(index, index + available);
      const blockHeight = chunk.length * lineHeight + 22;
      doc.setFillColor(...palette.codeBg);
      doc.setDrawColor(...palette.borderSoft);
      doc.roundedRect(margin, y, contentWidth, blockHeight, 5, 5, 'FD');
      doc.setFont('courier', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...palette.codeText);
      let textY = y + 15;
      chunk.forEach((line) => {
        doc.text(line, margin + 12, textY);
        textY += lineHeight;
      });
      y += blockHeight + 10;
      index += chunk.length;
    }
  };

  const drawChart = (imageDataUrl, label = 'Graph', legendItems = []) => {
    if (!imageDataUrl && !legendItems.length) return;
    drawSectionTitle(label);
    const legendHeight = measureLegend(legendItems, contentWidth - 16);
    const chartHeight = imageDataUrl ? 250 : 0;
    const boxHeight = chartHeight + legendHeight + 16;
    ensureSpace(boxHeight + 12);
    try {
      doc.setFillColor(...palette.surface);
      doc.setDrawColor(...palette.border);
      doc.roundedRect(margin, y, contentWidth, boxHeight, 6, 6, 'FD');
      let contentY = y + 8;
      if (legendItems.length) {
        contentY += drawLegendInline(legendItems, margin + 8, contentY, contentWidth - 16);
      }
      if (imageDataUrl) {
        doc.addImage(imageDataUrl, 'PNG', margin + 8, contentY, contentWidth - 16, chartHeight);
      }
      y += boxHeight + 12;
    } catch (error) {
      writeWrapped('Graph image could not be embedded.', { color: palette.muted });
    }
  };

  const drawTable = (label, data = [], preferredColumns = []) => {
    if (!Array.isArray(data) || data.length === 0) return;
    drawSectionTitle(`${label} (${data.length} rows)`);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    const columns = getColumns(data, preferredColumns);
    const columnGroups = splitColumnsForPdf(columns, data, contentWidth, doc);
    const minRowHeight = 22;
    const lineHeight = 8;

    columnGroups.forEach((group, groupIndex) => {
      if (groupIndex > 0) {
        writeWrapped(`Columns ${groupIndex + 1} of ${columnGroups.length}`, {
          size: 9,
          style: 'bold',
          color: palette.muted,
        });
      }

      const tableWidth = group.reduce((sum, column) => sum + column.width, 0);
      const drawHeaderRow = () => {
        ensureSpace(minRowHeight * 2);
        doc.setFillColor(...palette.surfaceMuted);
        doc.setDrawColor(...palette.border);
        doc.rect(margin, y, tableWidth, minRowHeight, 'FD');
        let x = margin;
        group.forEach((column, cellIndex) => {
          doc.setDrawColor(...palette.border);
          doc.rect(x, y, column.width, minRowHeight);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7);
          doc.setTextColor(...palette.heading);
          const lines = doc.splitTextToSize(column.key, column.width - 6);
          doc.text(lines.slice(0, 2), x + 3, y + 8);
          x += column.width;
        });
        y += minRowHeight;
      };

      drawHeaderRow();
      data.forEach((row, rowIndex) => {
        const cellLines = group.map((column) => {
          const value = column.rowIndex ? String(rowIndex + 1) : formatValue(row?.[column.key]);
          return doc.splitTextToSize(value, column.width - 6);
        });
        const rowHeight = Math.max(minRowHeight, Math.min(96, Math.max(...cellLines.map((lines) => lines.length)) * lineHeight + 10));
        if (y + rowHeight > pageHeight - 48) {
          addPage();
          drawHeaderRow();
        }
        let x = margin;
        doc.setFillColor(...(rowIndex % 2 === 0 ? palette.surface : palette.surfaceMuted));
        doc.setDrawColor(...palette.border);
        doc.rect(margin, y, tableWidth, rowHeight, 'FD');
        group.forEach((column, cellIndex) => {
          doc.setDrawColor(...palette.border);
          doc.rect(x, y, column.width, rowHeight);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(6.5);
          doc.setTextColor(...palette.text);
          const lines = cellLines[cellIndex] || [''];
          const visibleLines = lines.slice(0, Math.max(1, Math.floor((rowHeight - 10) / lineHeight)));
          doc.text(visibleLines, x + 3, y + 8);
          x += column.width;
        });
        y += rowHeight;
      });
      y += 12;
    });
  };

  drawHeader();
  sections.forEach((section) => {
    if (section.type === 'keyValues') {
      drawSectionTitle(section.title);
      drawKeyValues(section.items || []);
    } else if (section.type === 'paths') {
      drawPathRows(section.title, section.items || []);
    } else if (section.type === 'chart') {
      drawChart(section.imageDataUrl || chartImageDataUrl, section.title, section.legendItems || []);
    } else if (section.type === 'table') {
      drawTable(section.title, section.data, section.columns);
    } else if (section.type === 'code') {
      drawCodeBlock(section.title, section.value);
    } else if (section.type === 'text') {
      drawSectionTitle(section.title);
      writeWrapped(section.value, { color: palette.text });
      y += 8;
    }
  });
  drawFooter();

  doc.save(`${filename || 'uns-report'}-${exportedAt.toISOString().slice(0, 10)}.pdf`);
};

export const exportUNSItemToPDF = async ({
  chartImageDataUrl,
  filename,
  title = 'UNS Item Details',
  path,
  details = {},
  tableData = [],
  tableColumns = [],
  dataNodes = [],
  policy = null,
  timeRangeLabel = '',
  timeMode = 'relative',
  periodReferenceTime = '',
  periodIntervalType = '',
  periodIntervalCount = '',
  legend = [],
}) => {
  const normalizedPath = normalizeUnsPath(path || details.name);
  const sections = [
    {
      type: 'keyValues',
      title: 'UNS Item Details',
      items: [
        { label: 'Name', value: details.name },
        { label: 'Type', value: details.type },
        { label: 'ID', value: details.id },
        { label: 'DBMS', value: details.dbms },
        { label: 'Table', value: details.table },
        { label: 'Column', value: details.column },
        { label: 'Where', value: details.where },
        { label: 'Time Range', value: timeRangeLabel },
        { label: 'Time Range Mode', value: timeMode === 'period' ? 'Period' : timeMode === 'absolute' ? 'Between' : 'Relative' },
        { label: 'Period Reference', value: timeMode === 'period' ? periodReferenceTime || 'now()' : '' },
        { label: 'Period Interval Type', value: timeMode === 'period' ? periodIntervalType : '' },
        { label: 'Period Interval Count', value: timeMode === 'period' ? periodIntervalCount : '' },
        { label: 'Description', value: details.description },
      ],
    },
    {
      type: 'paths',
      title: 'UNS Path Used For Graph',
      items: [{
        name: details.name,
        path: normalizedPath,
        metric: legend[0]?.detail || details.column || details.chartYKey,
        dbms: details.dbms,
        table: details.table,
        rows: Array.isArray(tableData) ? tableData.length : 0,
        color: legend[0]?.color,
      }],
    },
    {
      type: 'chart',
      title: 'Graph',
      imageDataUrl: chartImageDataUrl,
      legendItems: legend,
    },
    { type: 'table', title: 'Table Data', data: tableData, columns: tableColumns },
    { type: 'table', title: 'Data Nodes', data: dataNodes },
    { type: 'code', title: 'UNS Policy', value: policy ? JSON.stringify(policy, null, 2) : '' },
  ];

  return createUnsPdf({
    title,
    subtitle: details.table ? `${details.dbms || 'UNS'}.${details.table}` : 'UNS item export',
    filename,
    sections,
  });
};

export const exportUNSCompareToPDF = async ({
  graph,
  chartImageDataUrl,
  filename,
}) => {
  if (!graph) return;
  const timeRangeLabel = graph.timeMode === 'absolute'
    ? `${graph.startTime || 'start'} to ${graph.endTime || 'end'}`
    : formatTimeRangeLabel(graph);

  const sources = (graph.sources || []).map((source, index) => ({
    ...source,
    normalizedPath: normalizeUnsPath(getSourcePath(source)),
    displayColor: source.color,
    sourceIndex: index,
  }));

  const sections = [
    {
      type: 'keyValues',
      title: 'Compare Graph Details',
      items: [
        { label: 'Graph', value: graph.name },
        { label: 'Time Range', value: timeRangeLabel },
        { label: 'Time Range Mode', value: graph.timeMode === 'period' ? 'Period' : graph.timeMode === 'absolute' ? 'Between' : 'Relative' },
        { label: 'Period Reference', value: graph.timeMode === 'period' ? graph.periodReferenceTime || 'now()' : '' },
        { label: 'Period Interval Type', value: graph.timeMode === 'period' ? graph.timeRangeUnit : '' },
        { label: 'Period Interval Count', value: graph.timeMode === 'period' ? graph.timeRangeValue : '' },
        { label: 'Time Column', value: graph.timeColumn },
        { label: 'Sources', value: graph.sources?.length },
      ],
    },
    {
      type: 'paths',
      title: 'Sources And UNS Paths Used For Graph',
      items: sources.map((source) => ({
        name: source.name,
        path: source.normalizedPath,
        metric: source.chartYKey || source.column,
        dbms: source.dbms,
        table: source.table,
        rows: Array.isArray(source.data) ? source.data.length : 0,
        color: source.displayColor,
      })),
    },
    ...sources.map((source) => ({
      type: 'keyValues',
      title: `Source ${source.sourceIndex + 1}: ${source.name}`,
      items: [
        { label: 'Full UNS Path', value: source.normalizedPath },
        { label: 'Type', value: source.type },
        { label: 'DBMS', value: source.dbms },
        { label: 'Table', value: source.table },
        { label: 'Column', value: source.column },
        { label: 'Metric', value: source.chartYKey },
        { label: 'Where', value: source.where },
        { label: 'Rows', value: Array.isArray(source.data) ? source.data.length : 0 },
        { label: 'Last Fetched', value: source.lastFetchedAt ? new Date(source.lastFetchedAt).toLocaleString() : '' },
      ],
    })),
    {
      type: 'chart',
      title: 'Compare Graph',
      imageDataUrl: chartImageDataUrl,
      legendItems: sources.map((source) => ({
        label: source.name,
        detail: source.chartYKey || source.column || `${source.dbms || ''}.${source.table || ''}`,
        color: source.displayColor,
      })),
    },
  ];

  sources.forEach((source) => {
    sections.push({
      type: 'table',
      title: `${source.name} Table Data`,
      data: source.data || [],
      columns: source.columns || [],
    });
  });

  return createUnsPdf({
    title: 'UNS Compare Graph',
    subtitle: graph.name,
    filename: filename || `uns-compare-${graph.name || 'graph'}`,
    sections,
  });
};

export const exportToPDF = (data, chartImageDataUrl, options = {}) => (
  exportUNSItemToPDF({
    chartImageDataUrl,
    filename: options.filename,
    title: options.title,
    path: options.path,
    details: options,
    tableData: data,
    tableColumns: options.columns || [],
    dataNodes: options.dataNodes || [],
    policy: options.policy || null,
    timeRangeLabel: options.timeRangeLabel || '',
    timeMode: options.timeMode || 'relative',
    periodReferenceTime: options.periodReferenceTime || '',
    periodIntervalType: options.periodIntervalType || '',
    periodIntervalCount: options.periodIntervalCount || '',
    legend: options.legend || [],
  })
);
