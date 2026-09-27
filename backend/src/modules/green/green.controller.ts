import { Controller, Get, Post, Body, InternalServerErrorException, UseGuards, Request } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { GreenService } from './green.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface AddImpactDto {
  initiative: string;
  carbonSavedKg: number;
}

@Controller('green')
export class GreenController {
  constructor(private readonly greenService: GreenService) {}

  @Get('impacts')
  async getAllImpacts() {
    try {
      const impacts = await this.greenService.getAllImpacts();
      return { success: true, data: impacts };
    } catch (error) {
      console.error(`Error getting all green impacts: ${error.message}`);
      throw new InternalServerErrorException('Failed to retrieve green impacts');
    }
  }
  @Get('challenges')
  async getChallenges() {
    try {
      const challenges = await this.greenService.getChallenges();
      return { success: true, data: challenges };
    } catch (error) {
      console.error(`Error getting all green challenges: ${error.message}`);
      throw new InternalServerErrorException('Failed to retrieve green challenges');
    }
  }

  @Post('activities')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Ghi nhận hoạt động tham gia thử thách Sống Xanh' })
  async logActivity(@Request() req: any, @Body() body: { challengeId: string; carbonSavedKg?: number }) {
    try {
      const activity = await this.greenService.logActivity(
        req.user.id,
        body.challengeId,
        body.carbonSavedKg || 0,
      );
      return { success: true, data: activity };
    } catch (error) {
      console.error(`Error logging green activity: ${error.message}`);
      throw new InternalServerErrorException('Failed to log green activity');
    }
  }

  @Post('impacts')
  async addImpact(@Body() addImpactDto: AddImpactDto) {
    try {
      const newImpact = await this.greenService.addImpact(addImpactDto.initiative, addImpactDto.carbonSavedKg);
      return { success: true, data: newImpact };
    } catch (error) {
      console.error(`Error adding green impact: ${error.message}`);
      throw new InternalServerErrorException('Failed to add green impact');
    }
  }
}
