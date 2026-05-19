import { extname } from 'path';
import { BadRequestException } from '@nestjs/common';

export const multerOptions = {
  limits: {
    fileSize: 5 * 1024 * 1024, // 🛡️ Gioi han 5MB
  },
  fileFilter: (req: any, file: any, callback: any) => {
    // 🛡️ Chi cho phep cac dinh dang an toan
    if (file.mimetype.match(/\/(jpg|jpeg|png|webp|pdf|docx)$/)) {
      callback(null, true);
    } else {
      callback(new BadRequestException('Dinh dang file khong duoc ho tro!'), false);
    }
  },
};
