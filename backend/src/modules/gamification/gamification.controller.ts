import { Controller, Get, Post, Param, Body, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { GamificationService } from './gamification.service';

@Controller('gamification')
export class GamificationController {
  constructor(private readonly gamificationService: GamificationService) {}

  @Get('progress/:userId')
  async getUserProgress(@Param('userId') userId: string) {
    try {
      const progress = await this.gamificationService.getUserProgress(userId);
      if (!progress) {
        throw new NotFoundException(`User progress for ID ${userId} not found`);
      }
      return { success: true, data: progress };
    } catch (error) {
      console.error(`Error getting user progress for ${userId}: ${error.message}`);
      throw new InternalServerErrorException('Failed to retrieve user progress');
    }
  }

  @Post('grant-points')
  async grantPoints(@Body('userId') userId: string, @Body('points') points: number) {
    try {
      const updatedProgress = await this.gamificationService.awardPoints(userId, points);
      return { success: true, data: updatedProgress };
    } catch (error) {
      console.error(`Error granting points to user ${userId}: ${error.message}`);
      throw new InternalServerErrorException('Failed to grant points');
    }
  }

  @Post('grant-achievement')
  async grantAchievement(@Body('userId') userId: string, @Body('achievement') achievement: string) {
    try {
      const updatedProgress = await this.gamificationService.grantAchievement(userId, achievement);
      return { success: true, data: updatedProgress };
    } catch (error) {
      console.error(`Error granting achievement to user ${userId}: ${error.message}`);
      throw new InternalServerErrorException('Failed to grant achievement');
    }
  }
}
