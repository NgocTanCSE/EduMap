import { Controller, Get, Post, Param, Body, NotFoundException, InternalServerErrorException, BadRequestException, UseGuards, Request } from '@nestjs/common';
import { GamificationService } from './gamification.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('gamification')
export class GamificationController {
  constructor(private readonly gamificationService: GamificationService) {}

  @Get('leaderboard')
  async getLeaderboard() {
    try {
      const leaderboard = await this.gamificationService.getLeaderboard();
      return { success: true, data: leaderboard };
    } catch (error) {
      console.error(`Error getting leaderboard: ${error.message}`);
      throw new InternalServerErrorException('Failed to retrieve leaderboard');
    }
  }

  @Get('my-progress')
  @UseGuards(JwtAuthGuard)
  async getMyProgress(@Request() req: any) {
    try {
      const progress = await this.gamificationService.getUserProgress(req.user.id);
      return {
        success: true,
        data: {
          userId: progress.userId,
          points: progress.points,
          level: Math.floor(progress.points / 100) + 1,
          next_level_points: (Math.floor(progress.points / 100) + 1) * 100,
          progress_percent: progress.points % 100,
          points_needed: 100 - (progress.points % 100),
          achievements: progress.achievements,
        },
      };
    } catch (error) {
      console.error(`Error getting my progress: ${error.message}`);
      throw new InternalServerErrorException('Failed to retrieve my progress');
    }
  }

  @Get('my-badges')
  @UseGuards(JwtAuthGuard)
  async getMyBadges(@Request() req: any) {
    try {
      const progress = await this.gamificationService.getUserProgress(req.user.id);
      return { success: true, data: progress.achievements };
    } catch (error) {
      console.error(`Error getting my badges: ${error.message}`);
      throw new InternalServerErrorException('Failed to retrieve my badges');
    }
  }

  @Post('submit-activity')
  @UseGuards(JwtAuthGuard)
  async submitActivity(@Request() req: any, @Body() body: { activityType?: string; description?: string; proofUrl?: string }) {
    try {
      if (!body.activityType || !body.proofUrl) {
        throw new BadRequestException('activityType và proofUrl là bắt buộc');
      }
      const progress = await this.gamificationService.submitGreenActivity(
        req.user.id,
        body.activityType,
        body.description || '',
        body.proofUrl,
      );
      return { success: true, data: progress };
    } catch (error) {
      console.error(`Error submitting green activity: ${error.message}`);
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException('Failed to submit activity');
    }
  }

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
