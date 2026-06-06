import { Controller, Get, Post, Body, Param, Query, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { LibraryService } from './library.service';

interface CreateLibraryItemDto {
  title: string;
  author: string;
  type: 'book' | 'article' | 'video';
  url: string;
}

@Controller('library')
export class LibraryController {
  constructor(private readonly libraryService: LibraryService) {}

  @Get('resources')
  async findAll() {
    try {
      const resources = await this.libraryService.findAll();
      return { success: true, data: resources };
    } catch (error) {
      console.error(`Error getting all library resources: ${error.message}`);
      throw new InternalServerErrorException('Failed to retrieve library resources');
    }
  }

  @Get('search')
  async search(@Query('q') query: string) {
    try {
      const resources = await this.libraryService.search(query);
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
