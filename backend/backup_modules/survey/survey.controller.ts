import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Survey')
@Controller('surveys')
export class SurveyController {
  @Get()
  @ApiOperation({ summary: 'Danh sach khao sat' })
  async getSurveys() {
    return { surveys: [] };
  }
}
