import React, { useState } from 'react';
import { Download, Upload, FileSpreadsheet, BookOpen, Users, CheckCircle2, AlertCircle, Sparkles, X, Copy, Check, ArrowRight } from 'lucide-react';
import { Book, UserProfile } from '../types';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultType?: 'books' | 'parents' | 'staff';
  onImportBooks?: (books: Omit<Book, 'id'>[]) => Promise<void>;
  onImportParents?: (parentsData: Array<{
    name: string;
    email: string;
    phone?: string;
    children?: Array<{ name: string; grade: string; studentIdCode: string }>;
  }>) => Promise<void>;
  onImportStaff?: (staffData: Array<{
    name: string;
    email: string;
    phone?: string;
    staffIdCode?: string;
    staffDepartment?: string;
  }>) => Promise<void>;
}

const SAMPLE_BOOKS_CSV = `title,author,category,isbn,barcode,shelfLocation,totalCopies,isReferenceOnly,publisher,publicationYear,description
"To Kill a Mockingbird","Harper Lee","Fiction / Literature","9780061120084","9780061120084","Aisle 1 - Shelf A",15,false,"J. B. Lippincott & Co.",1960,"A classic novel exploring justice and human nature in the American South."
"Cosmos & Astronomy Atlas","Dr. Carl Sagan","Science & Nature","9780394502946","9780394502946","Aisle 3 - Shelf S1",5,true,"Random House",1980,"Comprehensive reference atlas detailing galaxies and space exploration."
"The Great Gatsby","F. Scott Fitzgerald","Fiction / Literature","9780743273565","9780743273565","Aisle 1 - Shelf F4",10,false,"Scribner",1925,"A story of ambition, wealth, and love in the Roaring Twenties."`;

const SAMPLE_PARENTS_CSV = `parentName,parentEmail,phone,childrenNames,childrenGrades,childrenStudentIds
"Aishath Hassan","aishath.hassan@oakridge.edu","(555) 234-9012","Adam Ali|Mariyam Ali","Grade 6|Grade 8","STU-6012|STU-8015"
"Mohamed Zahir","m.zahir@oakridge.edu","(555) 789-3456","Hussain Zahir","Grade 4","STU-4088"
"Fathimath Riza","f.riza@oakridge.edu","(555) 456-1122","Ahmed Riza|Aminath Riza","Grade 2|Grade 7","STU-2011|STU-7044"`;

const SAMPLE_STAFF_CSV = `staffName,staffEmail,phone,staffIdCode,staffDepartment
"Ibrahim Naeem","i.naeem@fmagoodhoo.edu.mv","960-7788111","STF-3001","Science Faculty"
"Mariyam Shiyama","m.shiyama@fmagoodhoo.edu.mv","960-7788222","STF-3002","Mathematics Dept"
"Ahmed Hussain","a.hussain@fmagoodhoo.edu.mv","960-7788333","STF-3003","Primary School Faculty"`;

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  defaultType = 'books',
  onImportBooks,
  onImportParents,
  onImportStaff,
}) => {
  const [importType, setImportType] = useState<'books' | 'parents' | 'staff'>(defaultType);
  const [rawText, setRawText] = useState('');
  const [parsedItems, setParsedItems] = useState<any[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [copiedTemplate, setCopiedTemplate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  if (!isOpen) return null;

  // Helper to trigger browser CSV file download
  const downloadTemplate = () => {
    const csvContent = importType === 'books' ? SAMPLE_BOOKS_CSV : importType === 'parents' ? SAMPLE_PARENTS_CSV : SAMPLE_STAFF_CSV;
    const filename = importType === 'books' ? 'books_import_template.csv' : importType === 'parents' ? 'parent_accounts_import_template.csv' : 'staff_accounts_import_template.csv';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper to copy template to clipboard
  const copyTemplateToClipboard = () => {
    const csvContent = importType === 'books' ? SAMPLE_BOOKS_CSV : importType === 'parents' ? SAMPLE_PARENTS_CSV : SAMPLE_STAFF_CSV;
    navigator.clipboard.writeText(csvContent);
    setCopiedTemplate(true);
    setTimeout(() => setCopiedTemplate(false), 2000);
  };

  // Populate sample data into textarea
  const loadSampleData = () => {
    const csvContent = importType === 'books' ? SAMPLE_BOOKS_CSV : importType === 'parents' ? SAMPLE_PARENTS_CSV : SAMPLE_STAFF_CSV;
    setRawText(csvContent);
    parseCSVText(csvContent, importType);
  };

  // Basic CSV Parser supporting quoted fields
  const parseCSVLine = (text: string): string[] => {
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') {
        inQuotes = !inQuotes;
      } else if (c === ',' && !inQuotes) {
        result.push(cur.trim().replace(/^"|"$/g, ''));
        cur = '';
      } else {
        cur += c;
      }
    }
    result.push(cur.trim().replace(/^"|"$/g, ''));
    return result;
  };

  const parseCSVText = (content: string, type: 'books' | 'parents' | 'staff') => {
    const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length < 2) {
      setParsedItems([]);
      setParseErrors(['CSV content must contain a header row and at least 1 data row.']);
      return;
    }

    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
    const items: any[] = [];
    const errors: string[] = [];

    if (type === 'books') {
      for (let i = 1; i < lines.length; i++) {
        const row = parseCSVLine(lines[i]);
        if (row.length === 0 || (row.length === 1 && !row[0])) continue;

        const getCol = (name: string) => {
          const idx = headers.indexOf(name);
          return idx !== -1 && row[idx] !== undefined ? row[idx] : '';
        };

        const title = getCol('title');
        const author = getCol('author');
        if (!title || !author) {
          errors.push(`Row ${i + 1}: Missing required title or author.`);
          continue;
        }

        const isbn = getCol('isbn') || `978${Math.floor(1000000000 + Math.random() * 9000000000)}`;
        const barcode = getCol('barcode') || isbn;
        const barcodeImageUrl = getCol('barcodeimageurl') || getCol('barcodeurl') || undefined;
        const category = getCol('category') || 'General Literature';
        const shelfLocation = getCol('shelflocation') || 'General Stacks';
        const totalCopies = parseInt(getCol('totalcopies') || '5', 10) || 5;
        const isReferenceOnly = getCol('isreferenceonly').toLowerCase() === 'true';
        const publisher = getCol('publisher') || 'Academic Press';
        const publicationYear = parseInt(getCol('publicationyear') || '2024', 10) || 2024;
        const description = getCol('description') || 'Imported library catalog volume.';

        items.push({
          title,
          author,
          category,
          isbn,
          barcode,
          barcodeImageUrl,
          shelfLocation,
          totalCopies,
          availableCopies: totalCopies,
          isReferenceOnly,
          publisher,
          publicationYear,
          description,
          coverUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80&w=400',
          addedAt: new Date().toISOString().split('T')[0],
        });
      }
    } else if (type === 'parents') {
      // Parents Import
      for (let i = 1; i < lines.length; i++) {
        const row = parseCSVLine(lines[i]);
        if (row.length === 0 || (row.length === 1 && !row[0])) continue;

        const getCol = (name: string) => {
          const idx = headers.indexOf(name.toLowerCase());
          return idx !== -1 && row[idx] !== undefined ? row[idx] : '';
        };

        const parentName = getCol('parentName') || getCol('name');
        const parentEmail = getCol('parentEmail') || getCol('email');
        const phone = getCol('phone') || '(555) 000-0000';

        if (!parentName || !parentEmail) {
          errors.push(`Row ${i + 1}: Missing parentName or parentEmail.`);
          continue;
        }

        // Parse optional pipe-separated children (|)
        const childrenNames = getCol('childrenNames').split('|').map(s => s.trim()).filter(Boolean);
        const childrenGrades = getCol('childrenGrades').split('|').map(s => s.trim()).filter(Boolean);
        const childrenStudentIds = getCol('childrenStudentIds').split('|').map(s => s.trim()).filter(Boolean);

        const children = childrenNames.map((cName, idx) => ({
          name: cName,
          grade: childrenGrades[idx] || 'Grade 6',
          studentIdCode: childrenStudentIds[idx] || `STU-${Math.floor(1000 + Math.random() * 9000)}`,
        }));

        items.push({
          name: parentName,
          email: parentEmail,
          phone,
          children,
        });
      }
    } else {
      // Staff Import
      for (let i = 1; i < lines.length; i++) {
        const row = parseCSVLine(lines[i]);
        if (row.length === 0 || (row.length === 1 && !row[0])) continue;

        const getCol = (name: string) => {
          const idx = headers.indexOf(name.toLowerCase());
          return idx !== -1 && row[idx] !== undefined ? row[idx] : '';
        };

        const staffName = getCol('staffName') || getCol('name');
        const staffEmail = getCol('staffEmail') || getCol('email');
        const phone = getCol('phone') || '(555) 000-0000';
        const staffIdCode = getCol('staffIdCode') || `STF-${Math.floor(3000 + Math.random() * 1000)}`;
        const staffDepartment = getCol('staffDepartment') || getCol('department') || 'Teaching Faculty';

        if (!staffName || !staffEmail) {
          errors.push(`Row ${i + 1}: Missing staffName or staffEmail.`);
          continue;
        }

        items.push({
          name: staffName,
          email: staffEmail,
          phone,
          staffIdCode,
          staffDepartment,
        });
      }
    }

    setParsedItems(items);
    setParseErrors(errors);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setRawText(content);
      parseCSVText(content, importType);
    };
    reader.readAsText(file);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setRawText(val);
    parseCSVText(val, importType);
  };

  const handleExecuteImport = async () => {
    if (parsedItems.length === 0) return;

    setIsSubmitting(true);
    try {
      if (importType === 'books' && onImportBooks) {
        await onImportBooks(parsedItems);
      } else if (importType === 'parents' && onImportParents) {
        await onImportParents(parsedItems);
      } else if (importType === 'staff' && onImportStaff) {
        await onImportStaff(parsedItems);
      }
      setSuccessCount(parsedItems.length);
      setIsSubmitting(false);
      setTimeout(() => {
        onClose();
        setSuccessCount(null);
        setRawText('');
        setParsedItems([]);
      }, 1500);
    } catch (err) {
      console.error('Import execution error:', err);
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 max-sm:items-end max-sm:p-0"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-3xl max-sm:rounded-b-none max-sm:rounded-t-3xl shadow-2xl max-w-3xl w-full p-6 border border-slate-200 max-h-[90vh] overflow-y-auto space-y-5 text-slate-800 animate-in fade-in zoom-in-95 duration-200 safe-bottom">
        {/* Mobile Drag Indicator / Pull Handle */}
        <div className="sm:hidden flex justify-center pb-2">
          <div className="w-12 h-1.5 bg-slate-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b pb-4 border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-2xl">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">Bulk Data Import & Scalable Catalog Manager</h3>
              <p className="text-xs text-slate-500 font-medium">Import 9,000+ catalog books, student/parent rosters, or staff accounts via CSV</p>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className="text-slate-400 hover:text-slate-700 p-1.5 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Type Selector Tabs */}
        <div className="flex flex-wrap sm:flex-nowrap bg-slate-100 p-1.5 rounded-2xl border border-slate-200 gap-1">
          <button
            onClick={() => {
              setImportType('books');
              setRawText('');
              setParsedItems([]);
            }}
            className={`flex-1 py-2.5 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              importType === 'books'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-4 h-4" /> Books Catalog
          </button>
          <button
            onClick={() => {
              setImportType('parents');
              setRawText('');
              setParsedItems([]);
            }}
            className={`flex-1 py-2.5 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              importType === 'parents'
                ? 'bg-purple-600 text-white shadow'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4" /> Parents & Students
          </button>
          <button
            onClick={() => {
              setImportType('staff');
              setRawText('');
              setParsedItems([]);
            }}
            className={`flex-1 py-2.5 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              importType === 'staff'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4" /> Faculty & Staff (50+)
          </button>
        </div>

        {/* Action Toolbar: Download Template & Copy Template */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" />
                {importType === 'books' ? 'Books Catalog CSV Template' : importType === 'parents' ? 'Parent Accounts CSV Template' : 'Faculty & Staff CSV Template'}
              </div>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                Download pre-formatted CSV template or copy sample structure to clipboard.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={downloadTemplate}
                className="bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold px-3 py-2 rounded-xl transition border border-slate-300 shadow-sm flex items-center gap-1.5"
                id="download-import-template-btn"
              >
                <Download className="w-3.5 h-3.5 text-indigo-600" /> Download .CSV Template
              </button>
              <button
                onClick={copyTemplateToClipboard}
                className="bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold px-3 py-2 rounded-xl transition border border-slate-300 shadow-sm flex items-center gap-1.5"
                id="copy-import-template-btn"
              >
                {copiedTemplate ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-purple-600" />}
                {copiedTemplate ? 'Copied!' : 'Copy Format'}
              </button>
              <button
                onClick={loadSampleData}
                className="bg-indigo-100 hover:bg-indigo-200 text-indigo-900 border border-indigo-200 text-xs font-extrabold px-3 py-2 rounded-xl transition flex items-center gap-1.5"
                id="load-sample-import-data-btn"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> Load Demo Data
              </button>
            </div>
          </div>
        </div>

        {/* Upload Box or Textarea */}
        <div className="space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <label className="font-bold text-slate-700">
              Upload CSV File or Paste CSV Data Below:
            </label>
            <label className="cursor-pointer bg-white hover:bg-slate-100 text-slate-800 px-3 py-1.5 rounded-xl border border-slate-300 font-bold transition flex items-center gap-1.5 shadow-sm">
              <Upload className="w-3.5 h-3.5 text-indigo-600" /> Choose .CSV File
              <input type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>

          <textarea
            rows={5}
            value={rawText}
            onChange={handleTextChange}
            placeholder={`Paste CSV content here...\n\nExample Header:\n${importType === 'books' ? 'title,author,category,isbn,barcode,shelfLocation,totalCopies' : 'parentName,parentEmail,phone,childrenNames,childrenGrades,childrenStudentIds'}`}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-2xl text-xs font-mono font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            id="import-raw-csv-textarea"
          />
        </div>

        {/* Validation Errors */}
        {parseErrors.length > 0 && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 space-y-1">
            <div className="font-extrabold flex items-center gap-1.5 text-rose-900">
              <AlertCircle className="w-4 h-4 text-rose-600" /> Validation Warnings ({parseErrors.length})
            </div>
            {parseErrors.map((err, idx) => (
              <p key={idx} className="text-[11px] text-rose-700 font-medium">• {err}</p>
            ))}
          </div>
        )}

        {/* Parsed Preview Table */}
        {parsedItems.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-extrabold text-emerald-800">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Ready for Import ({parsedItems.length} records parsed)
              </span>
              <span className="text-[10px] text-slate-500 font-medium">Review before confirming</span>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-2xl bg-white max-h-48 overflow-y-auto shadow-sm">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-100 text-slate-600 font-extrabold uppercase text-[10px] border-b border-slate-200 sticky top-0">
                  <tr>
                    {importType === 'books' ? (
                      <>
                        <th className="p-2.5">Title</th>
                        <th className="p-2.5">Author</th>
                        <th className="p-2.5">Category</th>
                        <th className="p-2.5">ISBN</th>
                        <th className="p-2.5">Shelf</th>
                        <th className="p-2.5">Copies</th>
                      </>
                    ) : (
                      <>
                        <th className="p-2.5">Parent Name</th>
                        <th className="p-2.5">Email</th>
                        <th className="p-2.5">Phone</th>
                        <th className="p-2.5">Linked Children</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsedItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      {importType === 'books' ? (
                        <>
                          <td className="p-2.5 font-extrabold text-slate-900">{item.title}</td>
                          <td className="p-2.5 text-slate-700 font-medium">{item.author}</td>
                          <td className="p-2.5 text-indigo-700 font-bold">{item.category}</td>
                          <td className="p-2.5 font-mono text-[11px] text-slate-500 font-bold">{item.isbn}</td>
                          <td className="p-2.5 text-slate-700 font-medium">{item.shelfLocation}</td>
                          <td className="p-2.5 font-extrabold text-emerald-600">{item.totalCopies}</td>
                        </>
                      ) : (
                        <>
                          <td className="p-2.5 font-extrabold text-slate-900">{item.name}</td>
                          <td className="p-2.5 text-purple-700 font-bold">{item.email}</td>
                          <td className="p-2.5 text-slate-500 font-medium">{item.phone}</td>
                          <td className="p-2.5 text-slate-700 font-medium">
                            {item.children?.length > 0 ? (
                              <span>{item.children.map((c: any) => `${c.name} (${c.grade})`).join(', ')}</span>
                            ) : (
                              <span className="text-slate-400 italic">No children listed</span>
                            )}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Success Banner */}
        {successCount !== null && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 font-bold flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span>Successfully imported {successCount} {importType === 'books' ? 'book records to catalog' : 'parent accounts with student links'}!</span>
          </div>
        )}

        {/* Modal Action Buttons */}
        <div className="pt-3 flex justify-end gap-3 border-t border-slate-100">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition border border-slate-300 text-xs cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={parsedItems.length === 0 || isSubmitting}
            onClick={handleExecuteImport}
            className={`px-5 py-2.5 text-white font-extrabold rounded-xl shadow transition flex items-center gap-2 text-xs ${
              parsedItems.length === 0
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                : importType === 'books'
                ? 'bg-indigo-600 hover:bg-indigo-700'
                : 'bg-purple-600 hover:bg-purple-700'
            }`}
            id="submit-execute-import-btn"
          >
            <ArrowRight className="w-4 h-4" />
            {isSubmitting ? 'Importing Data...' : `Import ${parsedItems.length} ${importType === 'books' ? 'Books' : 'Parent Accounts'}`}
          </button>
        </div>

      </div>
    </div>
  );
};
