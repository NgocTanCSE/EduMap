import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PinService } from './pin.service';
import { CreatePinDto } from './dto/create-pin.dto';
import { UpdatePinDto } from './dto/update-pin.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PinType, PinStatus } from './entities/pin.entity';

@ApiTags('Pins')
@Controller('pins')
export class PinController {
  constructor(private readonly pinService: PinService) {}

  @Get()
  @ApiOperation({
    summary:
      'Danh sách pin lên bản đồ. Công khai chỉ hiển thị đã duyệt (published). ' +
      'Thêm ?mine=true để lấy pin của mình, ?type= và ?bbox=w,s,e,n để lọc.',
  })
  async findAll(
    @Query('type') type?: PinType,
    @Query('status') status?: PinStatus,
    @Query('mine') mine?: string,
    @Query('bbox') bbox?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Request() req?: any,
  ) {
    const userId = req?.user?.id;
    const pins = await this.pinService.findAll({
      type,
      status,
      my: mine === 'true',
      userId,
      bbox,
      limit: Number(limit) || 100,
      offset: Number(offset) || 0,
    });
    return { success: true, data: pins };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết một pin (công khai chỉ thấy pin đã duyệt của người khác)' })
  async findOne(@Param('id') id: string, @Request() req: any) {
    const pin = await this.pinService.findOne(
      id,
      req?.user?.id,
      req?.user?.role === 'admin',
    );
    return { success: true, data: pin };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Tạo pin đăng tin lên bản đồ. Poster gán tự động; mặc định pending để admin duyệt.',
  })
  async create(@Body() dto: CreatePinDto, @Request() req: any) {
    const pin = await this.pinService.create(req.user.id, dto);
    return {
      success: true,
      data: pin,
      message: 'Pin đã tạo, đang chờ quản trị viên duyệt.',
    };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Sửa pin (chủ sở hữu). Admin cũng có thể cập nhật status.' })
  async update(@Param('id') id: string, @Body() dto: UpdatePinDto, @Request() req: any) {
    const isAdmin = req?.user?.role === 'admin';
    const pin = await this.pinService.update(id, dto, req.user.id, isAdmin);
    return { success: true, data: pin };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Xóa mềm pin (chủ sở hữu hoặc admin)' })
  async remove(@Param('id') id: string, @Request() req: any) {
    const isAdmin = req?.user?.role === 'admin';
    await this.pinService.remove(id, req.user.id, isAdmin);
    return { success: true, message: 'Pin đã bị xóa.' };
  }
}
