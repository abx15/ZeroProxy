import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, ChangePasswordDto, PaginationDto } from './users.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  // POST /api/users — ADMIN or HR only
  @Post()
  @Roles('ADMIN', 'HR')
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden resource' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  create(@Body() dto: CreateUserDto, @CurrentUser() user: any) {
    return this.usersService.create(dto, user.userId);
  }

  // GET /api/users — ADMIN or HR only (paginated)
  @Get()
  @Roles('ADMIN', 'HR')
  @ApiOperation({ summary: 'Get list of users with filtering and pagination' })
  @ApiResponse({ status: 200, description: 'Returns a list of users' })
  findAll(@CurrentUser() user: any, @Query() dto: PaginationDto) {
    return this.usersService.findAll(user.companyId, dto);
  }

  // GET /api/users/stats — ADMIN or HR only
  @Get('stats')
  @Roles('ADMIN', 'HR')
  @ApiOperation({ summary: 'Get employee stats' })
  @ApiResponse({ status: 200, description: 'Returns counts of total, active, and role-based users' })
  getStats(@CurrentUser() user: any) {
    return this.usersService.getStats(user.companyId);
  }

  // GET /api/users/:id — all roles (service handles restriction)
  @Get(':id')
  @ApiOperation({ summary: 'Get a specific user by UUID' })
  @ApiResponse({ status: 200, description: 'User profile returned' })
  @ApiResponse({ status: 403, description: 'Forbidden access to other user profiles' })
  @ApiResponse({ status: 404, description: 'User not found' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ) {
    return this.usersService.findOne(id, user.userId, user.role);
  }

  // PATCH /api/users/:id — all roles (service handles restriction)
  @Patch(':id')
  @ApiOperation({ summary: 'Update user details' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden update of other users' })
  @ApiResponse({ status: 404, description: 'User not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: any,
  ) {
    return this.usersService.update(id, dto, user.userId, user.role);
  }

  // PATCH /api/users/:id/password — own password only
  @Patch(':id/password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change own password' })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid current password or request' })
  changePassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: any,
  ) {
    // Can only change own password
    if (id !== user.userId) {
      throw new Error('You can only change your own password.');
    }
    return this.usersService.changePassword(id, dto);
  }

  // DELETE /api/users/:id — ADMIN only (soft delete)
  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Soft delete a user' })
  @ApiResponse({ status: 200, description: 'User successfully deactivated/soft-deleted' })
  @ApiResponse({ status: 403, description: 'Forbidden (requires ADMIN role)' })
  @ApiResponse({ status: 404, description: 'User not found' })
  softDelete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ) {
    return this.usersService.softDelete(id, user.role, user.userId);
  }
}

