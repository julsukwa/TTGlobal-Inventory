import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateCustomerDto } from './dto/create-customer.dto.js';
import { UpdateCustomerDto } from './dto/update-customer.dto.js';

function escapeCsvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(search?: string) {
    if (!search) {
      return this.prisma.customer.findMany({ orderBy: { createdAt: 'desc' } });
    }

    return this.prisma.customer.findMany({
      where: {
        OR: [
          { fullName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) {
      throw new NotFoundException(`Customer with id ${id} not found`);
    }
    return customer;
  }

  create(dto: CreateCustomerDto) {
    return this.prisma.customer.create({ data: dto });
  }

  async update(id: number, dto: UpdateCustomerDto) {
    await this.findOne(id);
    return this.prisma.customer.update({ where: { id }, data: dto });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.customer.delete({ where: { id } });
  }

  async exportCsv() {
    const customers = await this.prisma.customer.findMany({ orderBy: { createdAt: 'desc' } });

    const header = ['Full Name', 'Email', 'Phone Number', 'Location', 'Date Added'];
    const rows = customers.map((customer) => [
      customer.fullName,
      customer.email,
      customer.phone,
      customer.location,
      customer.createdAt.toISOString(),
    ]);

    return [header, ...rows].map((row) => row.map(escapeCsvField).join(',')).join('\n');
  }
}
