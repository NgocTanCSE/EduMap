import { Controller, Get, Post, Body, Param, Query, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { LibraryService } from './library.service';
import { AIService } from '../ai/ai.service';

interface CreateLibraryItemDto {
  title: string;
  author: string;
  type: 'book' | 'article' | 'video';
  url: string;
}

@Controller('library')
export class LibraryController {
  constructor(
    private readonly libraryService: LibraryService,
    private readonly aiService: AIService,
  ) {}

  @Get('resources')
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    try {
      const pageNum = page ? parseInt(page, 10) : 1;
      const limitNum = limit ? parseInt(limit, 10) : 10;
      const resources = await this.libraryService.findAll(pageNum, limitNum);
      return { success: true, data: resources };
    } catch (error) {
      console.error(`Error getting all library resources: ${error.message}`);
      throw new InternalServerErrorException('Failed to retrieve library resources');
    }
  }

  @Get('search')
  async search(
    @Query('q') query: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('category') category?: string,
    @Query('type') type?: string,
  ) {
    try {
      const pageNum = page ? parseInt(page, 10) : 1;
      const limitNum = limit ? parseInt(limit, 10) : 10;
      const resources = await this.libraryService.search(query, pageNum, limitNum, category, type);
      return { success: true, data: resources };
    } catch (error) {
      console.error(`Error searching library resources: ${error.message}`);
      throw new InternalServerErrorException('Failed to search library resources');
    }
  }

  @Get('resources/:id')
  async findOne(@Param('id') id: string) {
    try {
      const resource = await this.libraryService.findOne(id);
      return { success: true, data: resource };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error(`Error getting library resource ${id}: ${error.message}`);
      throw new InternalServerErrorException('Failed to retrieve library resource');
    }
  }

  @Get('resources/:id/summary')
  async summarize(@Param('id') id: string) {
    try {
      const resource = await this.libraryService.findOne(id);
      return this.aiService.summarizeMaterial({
        id: resource.id,
        title: resource.title,
        description: resource.description,
        type: resource.type,
        subject: resource.subject,
        tags: resource.tags,
        file_url: resource.file_url,
      });
    } catch (error) {
      console.error(`Error summarizing library resource ${id}: ${error.message}`);
      throw new InternalServerErrorException('Failed to summarize library resource');
    }
  }

  @Post('resources')
  async create(@Body() createItemDto: CreateLibraryItemDto) {
    try {
      const newResource = await this.libraryService.create(createItemDto);
      return { success: true, data: newResource };
    } catch (error) {
      console.error(`Error creating library resource: ${error.message}`);
      throw new InternalServerErrorException('Failed to create library resource');
    }
  }
}
