import { Controller, Post, Put, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EventsService } from './events.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('MOD-04: Workshop & S? ki?n')
@Controller('api/events') // Kh?p ðúng ðý?ng d?n Excel
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'F-12: T?o workshop/s? ki?n m?i' })
  async createEvent(@Request() req: any, @Body() data: any) {
    return this.eventsService.createEvent(req.user.id, data);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'F-12: C?p nh?t thông tin s? ki?n' })
  async updateEvent(@Param('id') id: string, @Body() data: any) {
    return this.eventsService.updateEvent(id, data);
  }

  @Post(':id/register')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'F-13: Ðãng k? tham gia workshop (T?o ticket)' })
  async register(@Param('id') id: string, @Request() req: any) {
    return this.eventsService.registerEvent(id, req.user.id);
  }
}

