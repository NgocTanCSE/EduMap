import { Injectable } from '@nestjs/common';
import * as createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

@Injectable()
export class SanitizeService {
  private purify: createDOMPurify.DOMPurifyI;

  constructor() {
    const window = new JSDOM('').window;
    this.purify = createDOMPurify(window);
  }

  /**
   * 🛡️ Loc sạch ma doc XSS khoi chuoi van ban
   */
  clean(dirty: string): string {
    return this.purify.sanitize(dirty);
  }
}
