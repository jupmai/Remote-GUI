// import React from 'react';
// import '../styles/DataTable.css'; 


// const DataTable = ({ data }) => {
//   // If no data or empty array, render a message
//   if (!data || data.length === 0) {
//     return <div>No data available.</div>;
//   }

//   // Get table headers from the keys of the first object
//   const headers = Object.keys(data[0]);

//   return (
//     <table className="data-table">
//       <thead>
//         <tr>
//           {headers.map((header, idx) => (
//             <th key={`header-${idx}`}>{header}</th>
//           ))}
//         </tr>
//       </thead>
//       <tbody>
//         {data.map((row, rowIndex) => (
//           <tr key={`row-${rowIndex}`}>
//             {headers.map((header, cellIndex) => (
//               <td key={`cell-${rowIndex}-${cellIndex}`}>
//                 {row[header]}
//               </td>
//             ))}
//           </tr>
//         ))}
//       </tbody>
//     </table>
//   );
// };

// export default DataTable;


import React, { useEffect, useMemo, useRef, useState } from 'react';
import { filterTableData, hasInternalColumns } from '../utils/tableUtils';
import '../styles/DataTable.css';

const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

const renderCellValue = (value) => {
  if (value === null || value === undefined) return '';

  if (typeof value === 'object') {
    return React.createElement(
      'pre',
      { className: 'data-table-json-value' },
      JSON.stringify(value, null, 2)
    );
  }

  return String(value);
};

function DataTable({
  data,
  minColumnWidth = 60,
  maxColumnWidth = 800,
  defaultColumnWidth = 150,
}) {
  const wrapperRef = useRef(null);
  const tableRef = useRef(null);
  const draggingRef = useRef({
    active: false,
    colIndex: -1,
    side: 'right',
    startX: 0,
    startWidths: [],
  });
  
  // State for showing/hiding internal columns
  const [showInternalColumns, setShowInternalColumns] = useState(false);

  // Check if data has internal columns
  const hasInternal = useMemo(() => hasInternalColumns(data), [data]);

  // Filter data based on internal column visibility
  const { data: filteredData, headers } = useMemo(() => {
    return filterTableData(data, showInternalColumns);
  }, [data, showInternalColumns]);

  // ✅ Hooks are unconditional
  const [colWidths, setColWidths] = useState(() => headers.map(() => defaultColumnWidth));
  const [containerWidth, setContainerWidth] = useState(0);

  const getResizeSide = (index, totalCols) => {
    if (totalCols < 1 || index < 0) return null;
    return 'right';
  };

  const getNeighborIndices = (colIndex, totalCols, side) => {
    if (side === 'right') {
      return Array.from({ length: totalCols - colIndex - 1 }, (_, i) => colIndex + 1 + i);
    }
    return Array.from({ length: colIndex }, (_, i) => colIndex - 1 - i);
  };

  const applyWidthDelta = (prev, colIndex, dx, side) => {
    if (colIndex < 0 || !side) return prev;

    const startWidths = draggingRef.current.startWidths?.length
      ? draggingRef.current.startWidths
      : prev;
    const next = startWidths.slice();
    const neighborIndices = getNeighborIndices(colIndex, next.length, side);

    if (neighborIndices.length === 0) {
      next[colIndex] = clamp(next[colIndex] + dx, minColumnWidth, maxColumnWidth);
      return next;
    }

    const effectiveDx = dx;

    if (effectiveDx > 0) {
      // Grow target by borrowing space from neighbors until they hit minimum.
      const targetGrowthCapacity = maxColumnWidth - next[colIndex];
      const neighborShrinkCapacity = neighborIndices.reduce(
        (sum, idx) => sum + Math.max(0, next[idx] - minColumnWidth),
        0
      );
      let growth = Math.min(effectiveDx, targetGrowthCapacity, neighborShrinkCapacity);
      next[colIndex] += growth;
      for (const idx of neighborIndices) {
        if (growth <= 0) break;
        const take = Math.min(growth, Math.max(0, next[idx] - minColumnWidth));
        next[idx] -= take;
        growth -= take;
      }
    } else if (effectiveDx < 0) {
      // Shrink target and give freed space back to neighbors up to max width.
      let give = Math.min(
        -effectiveDx,
        Math.max(0, next[colIndex] - minColumnWidth),
        neighborIndices.reduce((sum, idx) => sum + Math.max(0, maxColumnWidth - next[idx]), 0)
      );
      next[colIndex] -= give;
      for (const idx of neighborIndices) {
        if (give <= 0) break;
        const add = Math.min(give, Math.max(0, maxColumnWidth - next[idx]));
        next[idx] += add;
        give -= add;
      }
    }

    return next;
  };

  useEffect(() => {
    setColWidths(headers.map(() => defaultColumnWidth));
  }, [headers, defaultColumnWidth]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return undefined;

    const updateContainerWidth = () => {
      const styles = window.getComputedStyle(wrapper);
      const paddingLeft = parseFloat(styles.paddingLeft) || 0;
      const paddingRight = parseFloat(styles.paddingRight) || 0;
      const nextWidth = Math.max(0, wrapper.clientWidth - paddingLeft - paddingRight);
      setContainerWidth(nextWidth);
    };

    updateContainerWidth();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateContainerWidth);
      return () => window.removeEventListener('resize', updateContainerWidth);
    }

    const observer = new ResizeObserver(updateContainerWidth);
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleMouseMove = (e) => {
      const { active, colIndex, side, startX } = draggingRef.current;
      if (!active) return;
      const dx = e.clientX - startX;
      setColWidths((prev) => {
        return applyWidthDelta(prev, colIndex, dx, side);
      });
      e.preventDefault();
    };

    const handleMouseUp = () => {
      if (draggingRef.current.active) {
        draggingRef.current.active = false;
        document.body.classList.remove('col-resizing');
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [minColumnWidth, maxColumnWidth, headers.length]);

  const startDrag = (e, index) => {
    const side = getResizeSide(index, headers.length);
    if (!side) return;

    draggingRef.current = {
      active: true,
      colIndex: index,
      side,
      startX: e.clientX,
      startWidths: colWidths.slice(),
    };
    document.body.classList.add('col-resizing');
    e.preventDefault();
    e.stopPropagation();
  };

  const autoFit = (index) => {
    const table = tableRef.current;
    if (!table) return;
    const side = getResizeSide(index, headers.length);
    if (!side) return;

    const cells = table.querySelectorAll(`[data-col-index="${index}"]`);
    let maxWidth = minColumnWidth;
    cells.forEach((el) => {
      const contentWidth = el.scrollWidth + 16; // padding allowance
      maxWidth = Math.max(maxWidth, contentWidth);
    });
    setColWidths((prev) => {
      draggingRef.current.startWidths = prev.slice();
      const targetWidth = clamp(maxWidth, minColumnWidth, maxColumnWidth);
      const dx = targetWidth - prev[index];
      return applyWidthDelta(prev, index, dx, side);
    });
  };

  const onResizerKeyDown = (e, idx) => {
    if (e.key === 'Enter') {
      autoFit(idx);
    } else if (e.key === 'ArrowLeft') {
      const side = getResizeSide(idx, headers.length);
      if (!side) return;
      setColWidths((prev) => {
        draggingRef.current.startWidths = prev.slice();
        return applyWidthDelta(prev, idx, -10, side);
      });
    } else if (e.key === 'ArrowRight') {
      const side = getResizeSide(idx, headers.length);
      if (!side) return;
      setColWidths((prev) => {
        draggingRef.current.startWidths = prev.slice();
        return applyWidthDelta(prev, idx, 10, side);
      });
    }
  };

  const columnWidthTotal = colWidths.reduce((sum, width) => sum + width, 0);
  const tableWidth = Math.max(columnWidthTotal, containerWidth);
  const renderedColWidths = useMemo(() => {
    if (!headers.length || !containerWidth || columnWidthTotal >= containerWidth) {
      return colWidths;
    }

    const extraWidth = containerWidth - columnWidthTotal;
    const extraPerColumn = extraWidth / headers.length;
    return colWidths.map((width) => width + extraPerColumn);
  }, [colWidths, columnWidthTotal, containerWidth, headers.length]);

  // ⛳ After all Hooks have run, you can early-return UI safely
  if (headers.length === 0) {
    return React.createElement('div', null, 'No data available.');
  }

  // <colgroup>
  const colgroup = React.createElement(
    'colgroup',
    null,
    headers.map((_, i) =>
      React.createElement('col', {
        key: `col-${i}`,
        style: { width: `${renderedColWidths[i] ?? colWidths[i]}px` },
      })
    )
  );

  // <thead>
  const thead = React.createElement(
    'thead',
    null,
    React.createElement(
      'tr',
      null,
      headers.map((header, idx) =>
        React.createElement(
          'th',
          {
            key: `header-${idx}`,
            'data-col-index': idx,
            className: idx === headers.length - 1 ? 'data-table-last-column' : undefined,
          },
          [
            React.createElement('div', { key: 'content', className: 'th-content' }, header),
            React.createElement('div', {
              key: 'resizer',
              className: `col-resizer ${idx === headers.length - 1 ? 'last-col-resizer' : ''}`,
              role: 'separator',
              'aria-orientation': 'vertical',
              'aria-label': `Resize column ${header}`,
              tabIndex: 0,
              onMouseDown: (e) => startDrag(e, idx),
              onDoubleClick: () => autoFit(idx),
              onKeyDown: (e) => onResizerKeyDown(e, idx),
            }),
          ]
        )
      )
    )
  );

  // <tbody>
  const tbody = React.createElement(
    'tbody',
    null,
    (Array.isArray(filteredData) ? filteredData : []).map((row, rowIndex) =>
      React.createElement(
        'tr',
        { key: `row-${rowIndex}` },
        headers.map((header, cellIndex) =>
          React.createElement(
            'td',
            { key: `cell-${rowIndex}-${cellIndex}`, 'data-col-index': cellIndex },
            renderCellValue(row?.[header])
          )
        )
      )
    )
  );

  return React.createElement(
    'div',
    { className: 'data-table-wrapper', ref: wrapperRef },
    [
      // Toggle button for internal columns (only show if internal columns exist)
      hasInternal && React.createElement(
        'div',
        { key: 'toggle-container', className: 'internal-columns-toggle' },
        React.createElement(
          'button',
          {
            key: 'toggle-button',
            className: 'toggle-internal-columns',
            onClick: () => setShowInternalColumns(!showInternalColumns),
            style: {
              marginBottom: '10px',
              padding: '8px 16px',
              backgroundColor: showInternalColumns ? '#007bff' : '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }
          },
          showInternalColumns ? 'Hide Internal Rows' : 'Show Internal Rows'
        )
      ),
      // Table
      React.createElement(
        'table',
        {
          key: 'table',
          ref: tableRef,
          className: 'data-table',
          style: { width: `${tableWidth}px` },
        },
        [colgroup, thead, tbody]
      )
    ]
  );
}

export default DataTable;
