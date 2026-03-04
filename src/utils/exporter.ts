
// Convert array of objects to CSV string
export const convertToCSV = (data: any[], fileName: string) => {
    if (!data || data.length === 0) return;
  
    const header = Object.keys(data[0]).join(',');
    const rows = data.map(obj => 
      Object.values(obj)
        .map(val => (typeof val === 'string' ? `"${val}"` : val)) // Escape strings
        .join(',')
    );
  
    const csvContent = [header, ...rows].join('\n');
    
    // Create Blob and Trigger Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
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
