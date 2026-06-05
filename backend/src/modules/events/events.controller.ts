import { Controller, Post, Put, Get, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EventsService } from './events.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('MOD-WS: Workshop & Sự kiện')
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách tất cả các workshop/sự kiện' })
  async getEvents() {
    return this.eventsService.getEvents();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết sự kiện theo ID' })
  async getEventById(@Param('id') id: string) {
    return this.eventsService.getEventById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'F-12: Tạo workshop/sự kiện mới' })
  async createEvent(@Request() req: any, @Body() data: any) {
    return this.eventsService.createEvent(req.user.id, data);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'F-12: Cập nhật thông tin sự kiện' })
  async updateEvent(@Param('id') id: string, @Body() data: any) {
    return this.eventsService.updateEvent(id, data);
  }

  @Post(':id/register')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'F-13: Đăng ký tham gia workshop (Tạo ticket)' })
  async register(@Param('id') id: string, @Request() req: any) {
    return this.eventsService.registerEvent(id, req.user.id);
  }
}
