import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('STEM')
@Controller('stem')
export class StemController {
  @Get('labs')
  @ApiOperation({ summary: 'Tim phong Lab STEM' })
  async getLabs(@Query() query: any) {
    return { labs: [] };
  }
}
