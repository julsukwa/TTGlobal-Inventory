import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateStaffDto } from './dto/create-staff.dto.js';
import { UpdateStaffDto } from './dto/update-staff.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';

const SYSTEM_ADMIN_USERNAME = 'admin';
const MIN_PASSWORD_LENGTH = 6;
const BCRYPT_ROUNDS = 10;

const staffSelect = {
  id: true,
  fullName: true,
  username: true,
  role: true,
  email: true,
  status: true,
  lastLogin: true,
  createdAt: true,
} as const;

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(search?: string) {
    return this.prisma.user.findMany({
      where: search
        ? {
            OR: [
              { fullName: { contains: search, mode: 'insensitive' } },
              { username: { contains: search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      select: staffSelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: staffSelect });
    if (!user) {
      throw new NotFoundException(`Staff member with id ${id} not found`);
    }
    return user;
  }

  async create(dto: CreateStaffDto) {
    const username = dto.username.trim();

    if (dto.password.length < MIN_PASSWORD_LENGTH) {
      throw new BadRequestException(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      );
    }

    this.assertValidRole(dto.role);

    const existing = await this.prisma.user.findUnique({ where: { username } });
    if (existing) {
      throw new ConflictException(`Staff member with username "${username}" already exists`);
    }

    const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    return this.prisma.user.create({
      data: {
        fullName: dto.fullName.trim(),
        username,
        password: hashedPassword,
        role: dto.role as Role,
        email: dto.email ?? '',
      },
      select: staffSelect,
    });
  }

  async update(id: number, dto: UpdateStaffDto) {
    await this.findRawOrThrow(id);

    if (dto.role !== undefined) {
      this.assertValidRole(dto.role);
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.fullName !== undefined ? { fullName: dto.fullName.trim() } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.role !== undefined ? { role: dto.role as Role } : {}),
      },
      select: staffSelect,
    });
  }

  async changePassword(id: number, dto: ChangePasswordDto) {
    await this.findRawOrThrow(id);

    if (dto.newPassword.length < MIN_PASSWORD_LENGTH) {
      throw new BadRequestException(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      );
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);

    await this.prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    });

    return { message: 'Password updated successfully' };
  }

  async toggleStatus(id: number) {
    const user = await this.findRawOrThrow(id);

    if (user.username === SYSTEM_ADMIN_USERNAME) {
      throw new ForbiddenException('The system admin cannot be deactivated');
    }

    return this.prisma.user.update({
      where: { id },
      data: { status: user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' },
      select: staffSelect,
    });
  }

  async remove(id: number) {
    const user = await this.findRawOrThrow(id);

    if (user.username === SYSTEM_ADMIN_USERNAME) {
      throw new ForbiddenException('The system admin cannot be deleted');
    }

    return this.prisma.user.delete({ where: { id }, select: staffSelect });
  }

  private assertValidRole(role: string) {
    if (!Object.values(Role).includes(role as Role)) {
      throw new BadRequestException(
        `role must be one of: ${Object.values(Role).join(', ')}`,
      );
    }
  }

  private async findRawOrThrow(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`Staff member with id ${id} not found`);
    }
    return user;
  }
}
