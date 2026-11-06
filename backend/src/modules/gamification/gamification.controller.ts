import { Controller, Get, Post, Param, Body, NotFoundException, InternalServerErrorException, BadRequestException, ForbiddenException, UseGuards, Request } from '@nestjs/common';
import { GamificationService } from './gamification.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';
@Controller('gamification')
export class GamificationController {
    constructor(private readonly gamificationService: GamificationService) { }
    @Get('leaderboard')
    async getLeaderboard() {
        try {
            const leaderboard = await this.gamificationService.getLeaderboard();
            return { success: true, data: leaderboard };
        }
        catch (error: any) {
            console.error(`Error getting leaderboard: ${error.message}`);
            throw new InternalServerErrorException('Failed to retrieve leaderboard');
        }
    }
    @Get('my-progress')
    @UseGuards(JwtAuthGuard)
    async getMyProgress(
    @Request()
    req: any) {
        try {
            const progress = await this.gamificationService.getUserProgress(req.user.id);
            const rankInfo = await this.gamificationService.getUserRank(req.user.id);
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
                    rank: rankInfo.rank,
                    total_users: rankInfo.total,
                },
            };
        }
        catch (error: any) {
            console.error(`Error getting my progress: ${error.message}`);
            throw new InternalServerErrorException('Failed to retrieve my progress');
        }
    }
    @Get('my-badges')
    @UseGuards(JwtAuthGuard)
    async getUserBadges(
    @Request()
    req: any) {
        try {
            const badges = await this.gamificationService.getUserBadges(req.user.id);
            return { success: true, data: badges };
        }
        catch (error: any) {
            console.error(`Error getting user badges: ${error.message}`);
            throw new InternalServerErrorException('Failed to retrieve user badges');
        }
    }
    @Post('submit-activity')
    @UseGuards(JwtAuthGuard)
    async submitActivity(
    @Request()
    req: any, 
    @Body()
    body: {
        activityType?: string;
        description?: string;
        proofUrl?: string;
    }) {
        try {
            if (!body.activityType || !body.proofUrl) {
                throw new BadRequestException('activityType và proofUrl là bắt buộc');
            }
            const progress = await this.gamificationService.submitGreenActivity(req.user.id, body.activityType, body.description || '', body.proofUrl);
            return { success: true, data: progress };
        }
        catch (error: any) {
            console.error(`Error submitting green activity: ${error.message}`);
            if (error instanceof BadRequestException)
                throw error;
            throw new InternalServerErrorException('Failed to submit activity');
        }
    }
    @Get('progress/:userId')
    @UseGuards(JwtAuthGuard)
    async getUserProgress(
    @Param('userId')
    userId: string, 
    @Request()
    req: any) {
        const isStaff = [UserRole.ADMIN, UserRole.MODERATOR, UserRole.SUPER_ADMIN].includes(req.user.role);
        if (req.user.id !== userId && !isStaff) {
            throw new ForbiddenException('Bạn chỉ có thể xem tiến độ của chính mình.');
        }
        try {
            const progress = await this.gamificationService.getUserProgress(userId);
            if (!progress) {
                throw new NotFoundException(`User progress for ID ${userId} not found`);
            }
            return { success: true, data: progress };
        }
        catch (error: any) {
            console.error(`Error getting user progress for ${userId}: ${error.message}`);
            if (error instanceof NotFoundException)
                throw error;
            throw new InternalServerErrorException('Failed to retrieve user progress');
        }
    }
    @Post('grant-points')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.MODERATOR)
    async grantPoints(
    @Body('userId')
    userId: string, 
    @Body('points')
    points: number) {
        try {
            const updatedProgress = await this.gamificationService.awardPoints(userId, points);
            return { success: true, data: updatedProgress };
        }
        catch (error: any) {
            console.error(`Error granting points to user ${userId}: ${error.message}`);
            throw new InternalServerErrorException('Failed to grant points');
        }
    }
    @Post('grant-achievement')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.MODERATOR)
    async grantAchievement(
    @Body('userId')
    userId: string, 
    @Body('achievement')
    achievement: string) {
        try {
            const updatedProgress = await this.gamificationService.grantAchievement(userId, achievement);
            return { success: true, data: updatedProgress };
        }
        catch (error: any) {
            console.error(`Error granting achievement to user ${userId}: ${error.message}`);
            throw new InternalServerErrorException('Failed to grant achievement');
        }
    }
}
