import { Injectable } from '@nestjs/common';

@Injectable()
export class SanitizeService {
  private purify: any;

  constructor() {
    // Sử dụng require để tránh lỗi biên dịch TypeScript strict types do thiếu @types/dompurify / @types/jsdom
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { JSDOM } = require('jsdom');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const createDOMPurify = require('dompurify');
    const window = new JSDOM('').window;
    this.purify = createDOMPurify(window);
  }

  /**
   * 🛡️ Lọc sạch mã độc XSS khỏi chuỗi văn bản đầu vào
   */
  clean(dirty: string): string {
    if (!dirty) return '';
    return this.purify.sanitize(dirty);
  }
}
