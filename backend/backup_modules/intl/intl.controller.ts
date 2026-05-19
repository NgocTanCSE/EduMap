import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { IntlService } from './intl.service';

@ApiTags('International Programs')
@Controller('intl')
export class IntlController {
  constructor(private readonly intlService: IntlService) {}

  @Get('programs')
  @ApiOperation({ summary: 'Get all international exchange/workshop programs' })
  async findAll(@Query('type') type: string) {
    return this.intlService.findAll(type);
  }
}
