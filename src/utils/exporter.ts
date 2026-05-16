
const escapeCSVValue = (val: unknown): string => {
  if (val === null || val === undefined) return '';
  const str = String(val);
  // Strip CSV formula injection prefixes
  const sanitized = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  // Quote and escape internal double-quotes
  return `"${sanitized.replace(/"/g, '""')}"`;
};

export const convertToCSV = (data: any[], fileName: string) => {
  if (!data || data.length === 0) return;

  const header = Object.keys(data[0]).map(escapeCSVValue).join(',');
  const rows = data.map(obj =>
    Object.values(obj).map(escapeCSVValue).join(',')
  );

  const csvContent = [header, ...rows].join('\n');

  // UTF-8 BOM ensures Excel opens the file with correct encoding
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${fileName}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};
