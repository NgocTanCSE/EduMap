import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { HsConnectionService } from './hs-connection.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('MOD-29: K?t n?i THPT - ÐH')
@Controller('hs-connection')
export class HsConnectionController {
  constructor(private readonly hsService: HsConnectionService) {}

  @Post('campus-tour')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ðãng k? Campus Tour ?o và ghép c?p tý v?n viên ÐH' })
  async registerTour(@Request() req: any, @Body('universityName') uniName: string) {
    return this.hsService.registerCampusTour(req.user.id, uniName);
  }
}

