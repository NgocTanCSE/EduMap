import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Career')
@Controller('careers')
export class CareerController {
  
  @Get('paths')
  @ApiOperation({ summary: 'Lay danh sach lo trinh nghe nghiep' })
  async getPaths(@Query('field') field: string) {
    return { paths: [] };
  }
}
