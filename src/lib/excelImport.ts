import * as XLSX from 'xlsx';
import type { Task, TaskType } from './types';

export interface ImportedTask {
  day: number;
  type: TaskType;
  title: string;
  description: string;
  url?: string;
  requiresSubmission: boolean;
  submissionType?: 'audio' | 'text' | 'link';
}

export interface ImportResult {
  tasks: ImportedTask[];
  errors: string[];
  skipped: number;
}

const TYPE_MAP: Record<string, TaskType> = {
  'فيديو': 'video',
  'video': 'video',
  'pdf': 'pdf',
  'ملف': 'pdf',
  'حفظ': 'memorization',
  'memorization': 'memorization',
  'قراءة': 'text',
  'text': 'text',
  'نص': 'text',
  'رابط': 'link',
  'link': 'link',
  'صوتي': 'audio',
  'audio': 'audio',
  'اختبار': 'quiz',
  'quiz': 'quiz',
};

const SUBMISSION_MAP: Record<string, 'audio' | 'text' | 'link'> = {
  'صوتي': 'audio',
  'audio': 'audio',
  'صوت': 'audio',
  'نص': 'text',
  'text': 'text',
  'كتابة': 'text',
  'رابط': 'link',
  'link': 'link',
};

/**
 * Parses an Excel/CSV file and extracts task definitions.
 * Expected columns (Arabic or English headers):
 *   اليوم / Day | النوع / Type | العنوان / Title | الوصف / Description | الرابط / URL | تسليم / Submission
 */
export function parseTasksFromExcel(file: File): Promise<ImportResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        const tasks: ImportedTask[] = [];
        const errors: string[] = [];
        let skipped = 0;

        rows.forEach((row, idx) => {
          const rowNum = idx + 2; // +1 for 0-index, +1 for header row
          // Normalize keys — try Arabic and English
          const get = (...keys: string[]): string => {
            for (const k of keys) {
              for (const rowKey of Object.keys(row)) {
                if (rowKey.trim().toLowerCase() === k.trim().toLowerCase()) {
                  return String(row[rowKey] ?? '').trim();
                }
              }
            }
            return '';
          };

          const dayStr = get('اليوم', 'day', 'Day');
          const typeStr = get('النوع', 'type', 'Type');
          const title = get('العنوان', 'title', 'Title', 'المهمة');
          const description = get('الوصف', 'description', 'Description', 'التفاصيل');
          const url = get('الرابط', 'url', 'URL', 'Link');
          const submissionStr = get('التسليم', 'submission', 'Submission', 'تسليم');

          // Validate required fields
          if (!title && !description && !dayStr) {
            skipped++;
            return;
          }

          if (!title) {
            errors.push(`الصف ${rowNum}: العنوان مفقود — تم تخطي الصف`);
            skipped++;
            return;
          }

          const day = parseInt(dayStr) || 1;
          if (day < 1 || day > 90) {
            errors.push(`الصف ${rowNum}: رقم اليوم غير صالح (${dayStr}) — سيتم استخدام اليوم 1`);
          }

          const type: TaskType = TYPE_MAP[typeStr.toLowerCase()] || 'text';

          let requiresSubmission = false;
          let submissionType: 'audio' | 'text' | 'link' | undefined;
          if (submissionStr) {
            const sub = SUBMISSION_MAP[submissionStr.toLowerCase()];
            if (sub) {
              requiresSubmission = true;
              submissionType = sub;
            } else if (submissionStr === 'نعم' || submissionStr === 'yes' || submissionStr === '1' || submissionStr === 'true') {
              requiresSubmission = true;
              submissionType = 'text';
            }
          }

          tasks.push({
            day: Math.max(1, Math.min(day, 90)),
            type,
            title,
            description: description || title,
            url: url || undefined,
            requiresSubmission,
            submissionType,
          });
        });

        resolve({ tasks, errors, skipped });
      } catch {
        resolve({ tasks: [], errors: ['فشل في قراءة الملف. تأكد من أنه ملف Excel أو CSV صالح.'], skipped: 0 });
      }
    };
    reader.onerror = () => resolve({ tasks: [], errors: ['فشل في قراءة الملف.'], skipped: 0 });
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Downloads a template Excel file with the correct column headers.
 */
export function downloadTaskTemplate() {
  const template = [
    { 'اليوم': 1, 'النوع': 'فيديو', 'العنوان': 'محاضرة أصول الفقه 1', 'الوصف': 'مشاهدة المحاضرة الأولى', 'الرابط': 'https://youtube.com/...', 'التسليم': '' },
    { 'اليوم': 1, 'النوع': 'حفظ', 'العنوان': 'حفظ سورة الملك', 'الوصف': 'حفظ السورة كاملة', 'الرابط': '', 'التسليم': 'صوتي' },
    { 'اليوم': 1, 'النوع': 'قراءة', 'العنوان': 'قراءة كتاب أصول الفقه', 'الوصف': 'قراءة الصفحات 10-20', 'الرابط': '', 'التسليم': 'نص' },
    { 'اليوم': 2, 'النوع': 'pdf', 'العنوان': 'ملخص الحديث', 'الوصف': 'قراءة الملخص', 'الرابط': 'https://example.com/file.pdf', 'التسليم': '' },
    { 'اليوم': 2, 'النوع': 'اختبار', 'العنوان': 'اختبار قصير', 'الوصف': 'اختبار على ما سبق', 'الرابط': 'https://example.com/quiz', 'التسليم': 'رابط' },
  ];

  const ws = XLSX.utils.json_to_sheet(template);
  ws['!cols'] = [{ wch: 8 }, { wch: 12 }, { wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 12 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'المهام');
  XLSX.writeFile(wb, 'قالب-استيراد-المهام.xlsx');
}
