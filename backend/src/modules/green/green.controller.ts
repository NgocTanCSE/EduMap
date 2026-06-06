import { Controller, Get, Post, Body, InternalServerErrorException } from '@nestjs/common';
import { GreenService } from './green.service';

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
  async getAllChallenges() {
    try {
      const challenges = await this.greenService.getAllChallenges();
      return { success: true, data: challenges };
    } catch (error) {
      console.error(`Error getting all green challenges: ${error.message}`);
      throw new InternalServerErrorException('Failed to retrieve green challenges');
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
