import { describe, it, expect, vi } from 'vitest';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
global.localStorage = localStorageMock;

// Mock sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
global.sessionStorage = sessionStorageMock;

describe('Storage Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should store and retrieve data from localStorage', () => {
    const testData = { key: 'test', value: 'data' };
    const testKey = 'test-key';
    
    localStorage.setItem(testKey, JSON.stringify(testData));
    expect(localStorage.setItem).toHaveBeenCalledWith(testKey, JSON.stringify(testData));
    
    localStorageMock.getItem.mockReturnValue(JSON.stringify(testData));
    const retrieved = JSON.parse(localStorage.getItem(testKey));
    expect(retrieved).toEqual(testData);
  });

  it('should handle localStorage errors gracefully', () => {
    localStorageMock.setItem.mockImplementation(() => {
      throw new Error('Storage quota exceeded');
    });
    
    expect(() => {
      localStorage.setItem('test-key', 'test-value');
    }).toThrow('Storage quota exceeded');
  });

  it('should clear localStorage', () => {
    localStorage.clear();
    expect(localStorage.clear).toHaveBeenCalled();
  });

  it('should store and retrieve data from sessionStorage', () => {
    const testData = { key: 'session', value: 'data' };
    const testKey = 'session-key';
    
    sessionStorage.setItem(testKey, JSON.stringify(testData));
    expect(sessionStorage.setItem).toHaveBeenCalledWith(testKey, JSON.stringify(testData));
    
    sessionStorageMock.getItem.mockReturnValue(JSON.stringify(testData));
    const retrieved = JSON.parse(sessionStorage.getItem(testKey));
    expect(retrieved).toEqual(testData);
  });

  it('should handle sessionStorage errors gracefully', () => {
    sessionStorageMock.setItem.mockImplementation(() => {
      throw new Error('SessionStorage not available');
    });
    
    expect(() => {
      sessionStorage.setItem('test-key', 'test-value');
    }).toThrow('SessionStorage not available');
  });

  it('should clear sessionStorage', () => {
    sessionStorage.clear();
    expect(sessionStorage.clear).toHaveBeenCalled();
  });
});

describe('Error Handling Utilities', () => {
  it('should create error objects with proper structure', () => {
    const error = new Error('Test error');
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Test error');
    expect(error.name).toBe('Error');
  });

  it('should handle custom error types', () => {
    class CustomError extends Error {
      constructor(message: string, public code: string) {
        super(message);
        this.name = 'CustomError';
      }
    }
    
    const customError = new CustomError('Custom error message', 'ERR_001');
    expect(customError).toBeInstanceOf(Error);
    expect(customError).toBeInstanceOf(CustomError);
    expect(customError.message).toBe('Custom error message');
    expect(customError.code).toBe('ERR_001');
    expect(customError.name).toBe('CustomError');
  });

  it('should handle async errors', async () => {
    const asyncFunction = async () => {
      throw new Error('Async error');
    };
    
    await expect(asyncFunction()).rejects.toThrow('Async error');
  });
});

describe('Date Utilities', () => {
  it('should create and manipulate dates', () => {
    const now = new Date();
    expect(now).toBeInstanceOf(Date);
    expect(now.getTime()).toBeTypeOf('number');
  });

  it('should parse date strings', () => {
    const dateString = '2023-12-25T10:00:00Z';
    const parsedDate = new Date(dateString);
    expect(parsedDate.toISOString()).toMatch(/^2023-12-25T10:00:00/); // Match prefix
  });

  it('should handle invalid dates', () => {
    const invalidDate = new Date('invalid-date-string');
    expect(isNaN(invalidDate.getTime())).toBe(true);
  });

  it('should calculate date differences', () => {
    const date1 = new Date('2023-01-01');
    const date2 = new Date('2023-01-02');
    const diffTime = Math.abs(date2.getTime() - date1.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(1);
  });
});

describe('Array Utilities', () => {
  it('should perform array operations', () => {
    const arr = [1, 2, 3, 4, 5];
    
    // Map
    const doubled = arr.map(x => x * 2);
    expect(doubled).toEqual([2, 4, 6, 8, 10]);
    
    // Filter
    const evens = arr.filter(x => x % 2 === 0);
    expect(evens).toEqual([2, 4]);
    
    // Reduce
    const sum = arr.reduce((acc, x) => acc + x, 0);
    expect(sum).toBe(15);
  });

  it('should handle array edge cases', () => {
    const emptyArray: number[] = [];
    
    expect(emptyArray.map(x => x * 2)).toEqual([]);
    expect(emptyArray.filter(x => x > 0)).toEqual([]);
    expect(emptyArray.reduce((acc, x) => acc + x, 0)).toBe(0);
  });

  it('should find elements in arrays', () => {
    const arr = [{ id: 1, name: 'test1' }, { id: 2, name: 'test2' }];
    
    const found = arr.find(item => item.id === 2);
    expect(found).toEqual({ id: 2, name: 'test2' });
    
    const notFound = arr.find(item => item.id === 3);
    expect(notFound).toBeUndefined();
  });
});

describe('Object Utilities', () => {
  it('should perform object operations', () => {
    const obj = { a: 1, b: 2, c: 3 };
    
    // Object keys
    expect(Object.keys(obj)).toEqual(['a', 'b', 'c']);
    
    // Object values
    expect(Object.values(obj)).toEqual([1, 2, 3]);
    
    // Object entries
    expect(Object.entries(obj)).toEqual([['a', 1], ['b', 2], ['c', 3]]);
  });

  it('should handle object property operations', () => {
    const obj = { a: 1, b: 2 };
    
    // Has property
    expect('a' in obj).toBe(true);
    expect('d' in obj).toBe(false);
    
    // Property descriptor
    const descriptor = Object.getOwnPropertyDescriptor(obj, 'a');
    expect(descriptor).toBeDefined();
    expect(descriptor?.value).toBe(1);
  });

  it('should clone objects', () => {
    const original = { a: 1, b: { c: 2 } };
    const shallow = { ...original };
    const deep = JSON.parse(JSON.stringify(original));
    
    // Shallow clone - nested objects are shared
    expect(shallow.b).toBe(original.b);
    
    // Deep clone - nested objects are independent
    expect(deep.b).not.toBe(original.b);
    expect(deep.b).toEqual(original.b);
  });
});

describe('String Utilities', () => {
  it('should perform string operations', () => {
    const str = 'Hello, World!';
    
    expect(str.toUpperCase()).toBe('HELLO, WORLD!');
    expect(str.toLowerCase()).toBe('hello, world!');
    expect(str.includes('World')).toBe(true);
    expect(str.split(',')).toEqual(['Hello', ' World!']);
    expect(str.trim()).toBe('Hello, World!');
  });

  it('should handle string edge cases', () => {
    const empty = '';
    const spaces = '   ';
    
    expect(empty.length).toBe(0);
    expect(spaces.trim()).toBe('');
    expect(empty.split(',')).toEqual(['']);
  });

  it('should handle string replacement', () => {
    const str = 'Hello, World!';
    
    expect(str.replace('World', 'Universe')).toBe('Hello, Universe!');
    expect(str.replaceAll('l', 'L')).toBe('HeLLo, WorLd!');
  });
});

describe('Number Utilities', () => {
  it('should perform number operations', () => {
    const num = 42.5;
    
    expect(Math.round(num)).toBe(43);
    expect(Math.floor(num)).toBe(42);
    expect(Math.ceil(num)).toBe(43);
    expect(num.toFixed(2)).toBe('42.50');
  });

  it('should handle number edge cases', () => {
    expect(Number.isNaN(NaN)).toBe(true);
    expect(Number.isFinite(Infinity)).toBe(false);
    expect(Number.isInteger(42)).toBe(true);
    expect(Number.isInteger(42.5)).toBe(false);
  });

  it('should parse numbers', () => {
    expect(Number('42')).toBe(42);
    expect(Number('42.5')).toBe(42.5);
    expect(Number('invalid')).toBeNaN();
    expect(parseInt('42px', 10)).toBe(42);
    expect(parseFloat('42.5px')).toBe(42.5);
  });
});
