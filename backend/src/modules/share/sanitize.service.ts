import { Injectable } from '@nestjs/common';
@Injectable()
export class SanitizeService {
    private purify: any;
    constructor() {
        const { JSDOM } = require('jsdom');
        const createDOMPurify = require('dompurify');
        const window = new JSDOM('').window;
        this.purify = createDOMPurify(window);
    }
    clean(dirty: string): string {
        if (!dirty)
            return '';
        return this.purify.sanitize(dirty);
    }
}
