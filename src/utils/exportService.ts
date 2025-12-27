import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import * as ExcelJS from 'exceljs';

export interface ExportData {
  headers: string[];
  rows: (string | number)[][];
  title?: string;
  metadata?: {
    dateRange: string;
    generatedAt: string;
    totalRows: number;
  };
}

export class ExportService {
  static async exportToPDF(
    elementId: string, 
    filename: string = 'report.pdf',
    options: { scale?: number; format?: 'a4' | 'letter' } = {}
  ): Promise<void> {
    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error(`Element with id '${elementId}' not found`);
    }

    const canvas = await html2canvas(element, {
      scale: options.scale || 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: options.format || 'a4'
    });

    const imgWidth = 297; // A4 width in mm (landscape)
    const pageHeight = 210; // A4 height in mm (landscape)
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(filename);
  }

  static exportToCSV(data: ExportData, filename: string = 'report.csv'): void {
    const escapeCsv = (value: string | number | null | undefined) => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (/[",\n]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    let csvContent = '';
    
    // Add title and metadata if provided
    if (data.title) {
      csvContent += `"${data.title}"\n\n`;
    }
    
    if (data.metadata) {
      csvContent += `"Generated: ${data.metadata.generatedAt}"\n`;
      csvContent += `"Date Range: ${data.metadata.dateRange}"\n`;
      csvContent += `"Total Rows: ${data.metadata.totalRows}"\n\n`;
    }

    // Add headers
    csvContent += data.headers.map(escapeCsv).join(',') + '\n';
    
    // Add rows
    csvContent += data.rows
      .map(row => row.map(escapeCsv).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  static async exportToExcel(data: ExportData, filename: string = 'report.xlsx'): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Report');
    
    // Add title and metadata if provided
    let currentRow = 1;
    
    if (data.title) {
      worksheet.getCell(`A${currentRow}`).value = data.title;
      worksheet.getCell(`A${currentRow}`).font = { bold: true, size: 16 };
      currentRow += 2;
    }
    
    if (data.metadata) {
      worksheet.getCell(`A${currentRow}`).value = `Generated: ${data.metadata.generatedAt}`;
      currentRow++;
      worksheet.getCell(`A${currentRow}`).value = `Date Range: ${data.metadata.dateRange}`;
      currentRow++;
      worksheet.getCell(`A${currentRow}`).value = `Total Rows: ${data.metadata.totalRows}`;
      currentRow += 2;
    }

    // Add headers
    worksheet.addRow(data.headers);
    const headerRow = worksheet.getRow(currentRow);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE6E6FA' }
      };
      cell.alignment = { horizontal: 'center' };
    });
    currentRow++;

    // Add data rows
    data.rows.forEach(row => {
      worksheet.addRow(row);
    });

    // Set column widths
    worksheet.columns = data.headers.map(() => ({ width: 15 }));

    // Generate Excel file
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  static async exportChartToPDF(
    chartElementId: string,
    title: string,
    filename: string = 'chart-report.pdf'
  ): Promise<void> {
    const element = document.getElementById(chartElementId);
    if (!element) {
      throw new Error(`Chart element with id '${chartElementId}' not found`);
    }

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF();
    
    // Add title
    pdf.setFontSize(16);
    pdf.text(title, 20, 20);
    
    // Add timestamp
    pdf.setFontSize(10);
    pdf.text(`Generated: ${new Date().toLocaleString()}`, 20, 30);
    
    // Add chart image
    const imgWidth = 170; // PDF width in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 20, 40, imgWidth, imgHeight);

    pdf.save(filename);
  }

  static async createMultiSheetExcel(reports: { name: string; data: ExportData }[], filename: string = 'multi-report.xlsx'): Promise<void> {
    const workbook = new ExcelJS.Workbook();

    reports.forEach(report => {
      const worksheet = workbook.addWorksheet(report.name.substring(0, 31)); // Excel sheet name limit
      
      let currentRow = 1;
      
      // Add title and metadata
      if (report.data.title) {
        worksheet.getCell(`A${currentRow}`).value = report.data.title;
        worksheet.getCell(`A${currentRow}`).font = { bold: true, size: 16 };
        currentRow += 2;
      }
      
      if (report.data.metadata) {
        worksheet.getCell(`A${currentRow}`).value = `Generated: ${report.data.metadata.generatedAt}`;
        currentRow++;
        worksheet.getCell(`A${currentRow}`).value = `Date Range: ${report.data.metadata.dateRange}`;
        currentRow++;
        worksheet.getCell(`A${currentRow}`).value = `Total Rows: ${report.data.metadata.totalRows}`;
        currentRow += 2;
      }

      // Add headers and data
      worksheet.addRow(report.data.headers);
      const headerRow = worksheet.getRow(currentRow);
      headerRow.eachCell((cell) => {
        cell.font = { bold: true };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE6E6FA' }
        };
        cell.alignment = { horizontal: 'center' };
      });
      currentRow++;

      report.data.rows.forEach(row => {
        worksheet.addRow(row);
      });

      // Set column widths
      worksheet.columns = report.data.headers.map(() => ({ width: 15 }));
    });

    // Generate Excel file
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
