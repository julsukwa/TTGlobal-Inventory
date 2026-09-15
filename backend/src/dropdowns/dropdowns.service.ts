import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateDropdownDto } from './dto/create-dropdown.dto.js';
import { UpdateDropdownDto } from './dto/update-dropdown.dto.js';

@Injectable()
export class DropdownsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(category?: string) {
    return this.prisma.dropdownValue.findMany({
      where: category ? { category } : undefined,
      orderBy: [{ category: 'asc' }, { value: 'asc' }],
    });
  }

  findActive(category: string) {
    return this.prisma.dropdownValue.findMany({
      where: { category, isActive: true },
      orderBy: { value: 'asc' },
    });
  }

  async create(dto: CreateDropdownDto) {
    const value = dto.value.trim();

    const existing = await this.prisma.dropdownValue.findUnique({
      where: { category_value: { category: dto.category, value } },
    });

    if (existing) {
      throw new ConflictException(
        `Dropdown value "${value}" already exists in category "${dto.category}"`,
      );
    }

    return this.prisma.dropdownValue.create({
      data: { category: dto.category, value },
    });
  }

  async update(id: number, dto: UpdateDropdownDto) {
    await this.findOneOrThrow(id);

    return this.prisma.dropdownValue.update({
      where: { id },
      data: {
        ...dto,
        ...(typeof dto.value === 'string' ? { value: dto.value.trim() } : {}),
      },
    });
  }

  async deactivate(id: number) {
    await this.findOneOrThrow(id);

    return this.prisma.dropdownValue.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async reactivate(id: number) {
    await this.findOneOrThrow(id);

    return this.prisma.dropdownValue.update({
      where: { id },
      data: { isActive: true },
    });
  }

  private async findOneOrThrow(id: number) {
    const dropdown = await this.prisma.dropdownValue.findUnique({ where: { id } });
    if (!dropdown) {
      throw new NotFoundException(`Dropdown value with id ${id} not found`);
    }
    return dropdown;
  }
}
