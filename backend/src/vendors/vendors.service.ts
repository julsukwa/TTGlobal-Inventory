import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateVendorDto } from './dto/create-vendor.dto.js';
import { UpdateVendorDto } from './dto/update-vendor.dto.js';

@Injectable()
export class VendorsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.vendor.findMany({ orderBy: { name: 'asc' } });
  }

  findActive() {
    return this.prisma.vendor.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async create(dto: CreateVendorDto) {
    const vendorId = dto.vendorId.trim();
    const name = dto.name.trim();

    const existing = await this.prisma.vendor.findUnique({ where: { vendorId } });
    if (existing) {
      throw new ConflictException(`Vendor with id "${vendorId}" already exists`);
    }

    return this.prisma.vendor.create({ data: { vendorId, name } });
  }

  async update(id: number, dto: UpdateVendorDto) {
    await this.findOneOrThrow(id);

    return this.prisma.vendor.update({
      where: { id },
      data: {
        ...dto,
        ...(typeof dto.name === 'string' ? { name: dto.name.trim() } : {}),
      },
    });
  }

  async deactivate(id: number) {
    await this.findOneOrThrow(id);

    return this.prisma.vendor.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async reactivate(id: number) {
    await this.findOneOrThrow(id);

    return this.prisma.vendor.update({
      where: { id },
      data: { isActive: true },
    });
  }

  private async findOneOrThrow(id: number) {
    const vendor = await this.prisma.vendor.findUnique({ where: { id } });
    if (!vendor) {
      throw new NotFoundException(`Vendor with id ${id} not found`);
    }
    return vendor;
  }
}
