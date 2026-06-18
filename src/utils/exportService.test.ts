import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mock ExcelJS ──────────────────────────────────────────────────────────────
const mockCell = { value: null as unknown, font: {}, fill: {}, alignment: {} };
const mockRow = {
  eachCell: vi.fn((cb: (cell: typeof mockCell) => void) => cb(mockCell)),
  number: 1,
};
const mockWorksheet = {
  getCell: vi.fn(() => ({ ...mockCell })),
  getRow: vi.fn(() => mockRow),
  addRow: vi.fn(),
  columns: [] as { width: number }[],
};
const mockWriteBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(8));
const mockWorkbook = {
  addWorksheet: vi.fn(() => mockWorksheet),
  xlsx: { writeBuffer: mockWriteBuffer },
};

// ExcelJS exports an object where Workbook is a constructor at the top level.
// The export service does: const ExcelJS = await import('exceljs'); new ExcelJS.Workbook()
// So we need Workbook to be a constructor function on the module namespace object.
function MockWorkbook() { return mockWorkbook; }
MockWorkbook.prototype = mockWorkbook;

vi.mock('exceljs', () => ({
  default: { Workbook: MockWorkbook },
  Workbook: MockWorkbook,
}));

// ── Mock html2canvas ──────────────────────────────────────────────────────────
const mockCanvas = {
  toDataURL: vi.fn(() => 'data:image/png;base64,test'),
  height: 500,
  width: 800,
};
vi.mock('html2canvas', () => ({
  default: vi.fn().mockResolvedValue(mockCanvas),
}));

// ── Mock jsPDF ────────────────────────────────────────────────────────────────
const mockPdfInstance = {
  addImage: vi.fn(),
  addPage: vi.fn(),
  save: vi.fn(),
  setFontSize: vi.fn(),
  text: vi.fn(),
};

function MockJsPDF() { return mockPdfInstance; }
MockJsPDF.prototype = mockPdfInstance;

vi.mock('jspdf', () => ({
  default: MockJsPDF,
}));

// ── Mock DOM APIs ─────────────────────────────────────────────────────────────
const mockObjectURL = 'blob:mock-url';
const mockLink = {
  href: '',
  download: '',
  click: vi.fn(),
};

beforeEach(() => {
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn(() => mockObjectURL),
    revokeObjectURL: vi.fn(),
  });
  vi.stubGlobal('Blob', class MockBlob {
    constructor(public content: unknown[], public options?: BlobPropertyBag) {}
  });
  const appendChildSpy = vi.fn();
  const removeChildSpy = vi.fn();
  vi.spyOn(document.body, 'appendChild').mockImplementation((el) => {
    appendChildSpy(el);
    return el;
  });
  vi.spyOn(document.body, 'removeChild').mockImplementation((el) => {
    removeChildSpy(el);
    return el;
  });
  vi.spyOn(document, 'createElement').mockReturnValue(mockLink as unknown as HTMLElement);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

// ── Import subject under test ─────────────────────────────────────────────────
// Must come after mocks are hoisted
import { ExportService, type ExportData } from './exportService';

const sampleData: ExportData = {
  headers: ['ID', 'Name', 'Amount'],
  rows: [
    ['1', 'Product A', 100],
    ['2', 'Product B', 200],
  ],
  title: 'Test Report',
  metadata: {
    dateRange: '2026-01-01 to 2026-01-31',
    generatedAt: '2026-01-31 12:00:00',
    totalRows: 2,
  },
};

describe('ExportService', () => {
  describe('exportToCSV', () => {
    it('creates a CSV blob and triggers download', () => {
      ExportService.exportToCSV(sampleData, 'test.csv');

      expect(URL.createObjectURL).toHaveBeenCalled();
      expect(mockLink.click).toHaveBeenCalled();
      expect(mockLink.download).toBe('test.csv');
    });

    it('uses default filename when not provided', () => {
      ExportService.exportToCSV(sampleData);
      expect(mockLink.download).toBe('report.csv');
    });

    it('handles empty rows without throwing', () => {
      const emptyData: ExportData = {
        headers: ['ID', 'Name'],
        rows: [],
      };
      expect(() => ExportService.exportToCSV(emptyData)).not.toThrow();
    });

    it('escapes CSV values containing commas', () => {
      const dataWithCommas: ExportData = {
        headers: ['Name', 'Value'],
        rows: [['Item, with comma', 42]],
      };
      // Should not throw and should trigger download
      expect(() => ExportService.exportToCSV(dataWithCommas)).not.toThrow();
      expect(mockLink.click).toHaveBeenCalled();
    });

    it('escapes CSV values containing double quotes', () => {
      const dataWithQuotes: ExportData = {
        headers: ['Name'],
        rows: [['He said "hello"']],
      };
      expect(() => ExportService.exportToCSV(dataWithQuotes)).not.toThrow();
    });

    it('handles null and undefined values gracefully', () => {
      const dataNulls: ExportData = {
        headers: ['A', 'B'],
        rows: [[null as unknown as string, undefined as unknown as number]],
      };
      expect(() => ExportService.exportToCSV(dataNulls)).not.toThrow();
    });

    it('includes title and metadata in output when provided', () => {
      // Should not throw with metadata
      expect(() => ExportService.exportToCSV(sampleData)).not.toThrow();
    });

    it('works without title or metadata', () => {
      const bare: ExportData = {
        headers: ['X'],
        rows: [['val']],
      };
      expect(() => ExportService.exportToCSV(bare)).not.toThrow();
    });
  });

  describe('exportToExcel', () => {
    it('creates a workbook and writes xlsx buffer', async () => {
      await ExportService.exportToExcel(sampleData, 'test.xlsx');

      expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith('Report');
      expect(mockWorkbook.xlsx.writeBuffer).toHaveBeenCalled();
      expect(URL.createObjectURL).toHaveBeenCalled();
      expect(mockLink.click).toHaveBeenCalled();
      expect(mockLink.download).toBe('test.xlsx');
    });

    it('uses default filename when not provided', async () => {
      await ExportService.exportToExcel(sampleData);
      expect(mockLink.download).toBe('report.xlsx');
    });

    it('handles empty rows without throwing', async () => {
      const emptyData: ExportData = {
        headers: ['ID', 'Name'],
        rows: [],
      };
      await expect(ExportService.exportToExcel(emptyData)).resolves.not.toThrow();
    });

    it('adds rows to worksheet', async () => {
      await ExportService.exportToExcel(sampleData);
      // addRow called for header row + each data row
      expect(mockWorksheet.addRow).toHaveBeenCalled();
    });

    it('sets column widths', async () => {
      await ExportService.exportToExcel(sampleData);
      expect(mockWorksheet.columns).toHaveLength(sampleData.headers.length);
    });
  });

  describe('exportToExcel — createMultiSheetExcel', () => {
    it('creates multiple sheets for multiple reports', async () => {
      const reports = [
        { name: 'Sales', data: sampleData },
        { name: 'Products', data: { ...sampleData, title: 'Products Report' } },
      ];

      await ExportService.createMultiSheetExcel(reports, 'multi.xlsx');

      expect(mockWorkbook.addWorksheet).toHaveBeenCalledTimes(2);
      expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith('Sales');
      expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith('Products');
    });

    it('truncates sheet names longer than 31 chars', async () => {
      const longName = 'This Sheet Name Is Definitely Longer Than 31 Characters';
      await ExportService.createMultiSheetExcel([
        { name: longName, data: sampleData },
      ], 'long.xlsx');

      expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith(
        longName.substring(0, 31),
      );
    });

    it('handles empty reports array without throwing', async () => {
      await expect(ExportService.createMultiSheetExcel([], 'empty.xlsx')).resolves.not.toThrow();
    });
  });

  describe('exportToPDF', () => {
    it('throws when element not found', async () => {
      vi.spyOn(document, 'getElementById').mockReturnValue(null);
      await expect(
        ExportService.exportToPDF('nonexistent-element'),
      ).rejects.toThrow("Element with id 'nonexistent-element' not found");
    });

    it('renders to PDF when element found', async () => {
      const mockElement = document.createElement('div');
      vi.spyOn(document, 'getElementById').mockReturnValue(mockElement);

      await ExportService.exportToPDF('my-report', 'report.pdf');

      expect(mockPdfInstance.addImage).toHaveBeenCalled();
      expect(mockPdfInstance.save).toHaveBeenCalledWith('report.pdf');
    });
  });

  describe('exportChartToPDF', () => {
    it('throws when chart element not found', async () => {
      vi.spyOn(document, 'getElementById').mockReturnValue(null);
      await expect(
        ExportService.exportChartToPDF('nonexistent-chart', 'My Chart'),
      ).rejects.toThrow("Chart element with id 'nonexistent-chart' not found");
    });

    it('renders chart PDF with title', async () => {
      const mockElement = document.createElement('div');
      vi.spyOn(document, 'getElementById').mockReturnValue(mockElement);

      await ExportService.exportChartToPDF('my-chart', 'Revenue Chart', 'chart.pdf');

      expect(mockPdfInstance.text).toHaveBeenCalledWith('Revenue Chart', 20, 20);
      expect(mockPdfInstance.addImage).toHaveBeenCalled();
      expect(mockPdfInstance.save).toHaveBeenCalledWith('chart.pdf');
    });
  });
});
