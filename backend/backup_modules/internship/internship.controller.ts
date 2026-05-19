import { Controller, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InternshipService } from './internship.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('MOD-19: Internship Map')
@Controller('internships')
export class InternshipController {
  constructor(private readonly internService: InternshipService) {}

  @Post(':id/apply')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'N?p CV ?ng tuy?n th?c t?p' })
  async apply(@Request() req: any, @Param('id') id: string, @Body('coverLetter') letter: string) {
    return this.internService.applyInternship(req.user.id, id, letter);
  }
}
