import { Injectable } from '@nestjs/common';

@Injectable()
export class SanitizeService {
  private purify: any;

  constructor() {
    // Sử dụng require để tránh lỗi biên dịch TypeScript strict types do thiếu @types/dompurify / @types/jsdom
    const { JSDOM } = require('jsdom');
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
