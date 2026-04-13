import * as XLSX from 'xlsx';

// Normalize a header string: trim, lowercase, collapse whitespace
const normalize = (s) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

// Maps normalized header text → internal field name
const HEADER_MAP = {
  'last name': 'lastName',
  'first name': 'firstName',
  'position': 'position',
  'year': 'year',
  'on/off campus': 'campus',
  'rev share $': 'revShare',
  'contract length (6 months vs 12 months)': 'contractLength',
  'stipend': 'stipend',
  'total compensation': 'totalCompensation',
  'total budget': 'totalBudget',
};

function toNum(val) {
  if (val === null || val === undefined || val === '') return 0;
  const n = parseFloat(String(val).replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? 0 : n;
}

/**
 * Parse an Excel file (.xlsx / .xls) and return normalized player data.
 * @param {File} file
 * @returns {Promise<{ players, totalBudget, errors, fileName, sheetName }>}
 */
export function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, {
          header: 1,
          defval: null,
          blankrows: false,
        });

        // Find the first row that has at least 2 non-empty cells → treat as header
        let headerIdx = -1;
        let rawHeaders = [];
        for (let i = 0; i < Math.min(rows.length, 15); i++) {
          const filled = rows[i].filter((v) => v !== null && String(v).trim() !== '').length;
          if (filled >= 2) {
            rawHeaders = rows[i];
            headerIdx = i;
            break;
          }
        }

        if (headerIdx === -1) {
          reject(new Error('Could not find a header row. Make sure the first row contains column names.'));
          return;
        }

        // Build column index map from normalized header → field
        const colIdx = {};
        rawHeaders.forEach((h, i) => {
          const key = normalize(h);
          if (key && HEADER_MAP[key]) colIdx[HEADER_MAP[key]] = i;
        });

        // Extract Total Budget: first non-null value in the totalBudget column
        let totalBudget = null;
        if (colIdx.totalBudget !== undefined) {
          for (let i = headerIdx + 1; i < rows.length; i++) {
            const v = rows[i]?.[colIdx.totalBudget];
            if (v !== null && v !== undefined && String(v).trim() !== '') {
              totalBudget = toNum(v);
              break;
            }
          }
        }

        // Parse player rows
        const players = [];
        const errors = [];

        for (let i = headerIdx + 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.every((v) => v === null || String(v).trim() === '')) continue;

          const lastName =
            colIdx.lastName !== undefined ? String(row[colIdx.lastName] ?? '').trim() : '';
          const firstName =
            colIdx.firstName !== undefined ? String(row[colIdx.firstName] ?? '').trim() : '';

          // Skip rows with no name (e.g. totals rows that sit below the player list)
          if (!lastName && !firstName) continue;

          const revShare = colIdx.revShare !== undefined ? toNum(row[colIdx.revShare]) : 0;
          const stipend = colIdx.stipend !== undefined ? toNum(row[colIdx.stipend]) : 0;
          const contractLength =
            colIdx.contractLength !== undefined && row[colIdx.contractLength] !== null
              ? toNum(row[colIdx.contractLength])
              : null;

          const player = {
            id: i,
            lastName,
            firstName,
            position:
              colIdx.position !== undefined ? String(row[colIdx.position] ?? '').trim() : '',
            year: colIdx.year !== undefined ? String(row[colIdx.year] ?? '').trim() : '',
            campus:
              colIdx.campus !== undefined ? String(row[colIdx.campus] ?? '').trim() : '',
            revShare,
            stipend,
            contractLength,
            // Always compute from source fields — don't trust the Excel formula cache
            totalCompensation: revShare + stipend,
          };

          if (!player.lastName || !player.firstName) {
            errors.push({ row: i + 1, message: `Row ${i + 1}: Missing player name` });
          }

          players.push(player);
        }

        resolve({
          players,
          totalBudget,
          errors,
          fileName: file.name,
          sheetName: wb.SheetNames[0],
        });
      } catch (err) {
        reject(new Error(`Failed to parse file: ${err.message}`));
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsArrayBuffer(file);
  });
}
