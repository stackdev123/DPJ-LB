
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export const formatDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

// Helper to generate a text description of changes between two objects
export const generateDiff = (original: any, updated: any, fields: { key: string, label: string, isCurrency?: boolean }[]) => {
  const changes: string[] = [];
  
  fields.forEach(f => {
    const oldVal = original[f.key];
    const newVal = updated[f.key];
    
    // Use loose equality to catch 100 vs "100"
    if (oldVal != newVal) {
      let oldDisplay = oldVal;
      let newDisplay = newVal;

      if (f.isCurrency) {
        oldDisplay = formatCurrency(Number(oldVal) || 0);
        newDisplay = formatCurrency(Number(newVal) || 0);
      }

      changes.push(`${f.label}: ${oldDisplay} ➜ ${newDisplay}`);
    }
  });

  return changes.length > 0 ? changes.join(', ') : 'No significant changes';
};

export const downloadAsImage = async (elementId: string, fileName: string) => {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element with id ${elementId} not found`);
    return;
  }

  try {
    const canvas = await html2canvas(element, {
      scale: 1.5, // Reduced from 2 to 1.5 for optimization
      useCORS: true,
      backgroundColor: '#ffffff', // Ensure white background
      logging: false
    });

    const link = document.createElement('a');
    link.download = `${fileName}.jpg`;
    link.href = canvas.toDataURL('image/jpeg', 0.8); // 80% quality JPG
    link.click();
  } catch (err) {
    console.error("Error generating image:", err);
    alert("Gagal mengunduh gambar. Silakan coba lagi.");
  }
};

export const downloadAsPDF = async (elementId: string, fileName: string) => {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element with id ${elementId} not found`);
    return;
  }

  try {
    const canvas = await html2canvas(element, {
      scale: 1.2, // Reduced scale for smaller file size
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff'
    });

    // Use JPEG with 0.60 quality to significantly reduce file size
    const imgData = canvas.toDataURL('image/jpeg', 0.60);
    
    // A4 size: 210mm x 297mm
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    
    const imgProps = pdf.getImageProperties(imgData);
    const pdfImgHeight = (imgProps.height * pdfWidth) / imgProps.width;

    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfImgHeight);
    pdf.save(`${fileName}.pdf`);
  } catch (err) {
    console.error("Error generating PDF:", err);
    alert("Gagal mengunduh PDF. Silakan coba lagi.");
  }
};
