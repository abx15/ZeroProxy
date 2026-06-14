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

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  // POST /api/users — ADMIN or HR only
  @Post()
  @Roles('ADMIN', 'HR')
  create(@Body() dto: CreateUserDto, @CurrentUser() user: any) {
    return this.usersService.create(dto, user.userId);
  }

  // GET /api/users — ADMIN or HR only (paginated)
  @Get()
  @Roles('ADMIN', 'HR')
  findAll(@CurrentUser() user: any, @Query() dto: PaginationDto) {
    return this.usersService.findAll(user.companyId, dto);
  }

  // GET /api/users/stats — ADMIN or HR only
  @Get('stats')
  @Roles('ADMIN', 'HR')
  getStats(@CurrentUser() user: any) {
    return this.usersService.getStats(user.companyId);
  }

  // GET /api/users/:id — all roles (service handles restriction)
  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ) {
    return this.usersService.findOne(id, user.userId, user.role);
  }

  // PATCH /api/users/:id — all roles (service handles restriction)
  @Patch(':id')
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
  softDelete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ) {
    return this.usersService.softDelete(id, user.role, user.userId);
  }
}
