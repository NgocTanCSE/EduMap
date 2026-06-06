// backend/src/modules/role/role.controller.ts
import { Controller, Get, Post, Body, Param, NotFoundException, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RoleService } from './role.service';
import { Role } from './role.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';

@ApiTags('Admin Roles (RBAC)')
@Controller('roles')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
@ApiBearerAuth()
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách tất cả các vai trò (Admin)' })
  findAll(): Promise<Role[]> {
    return this.roleService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin chi tiết một vai trò' })
  async findOne(@Param('id') id: string): Promise<Role> {
    const role = await this.roleService.findOne(+id);
    if (!role) {
      throw new NotFoundException(`Role with ID "${id}" not found`);
    }
    return role;
  }

  @Post()
  @ApiOperation({ summary: 'Tạo vai trò mới' })
  create(@Body() createRoleDto: Partial<Role>): Promise<Role> {
    return this.roleService.create(createRoleDto);
  }

  // You might add PUT/PATCH for update and DELETE later
}
