import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateShipmentDto } from './dto/create-shipment.dto.js';
import { UpdateShipmentDto } from './dto/update-shipment.dto.js';

type ShipmentStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETE';

const shipmentInclude = {
  vendor: { select: { id: true, vendorId: true, name: true } },
  _count: { select: { inventory: true } },
} satisfies Prisma.ShipmentInclude;

type ShipmentWithCounts = Prisma.ShipmentGetPayload<{ include: typeof shipmentInclude }>;

@Injectable()
export class ShipmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(search?: string) {
    const shipments = await this.prisma.shipment.findMany({
      where: search
        ? {
            OR: [
              { shipmentId: { contains: search, mode: 'insensitive' } },
              { shipmentName: { contains: search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      include: shipmentInclude,
      orderBy: { shipmentReceivedDate: 'desc' },
    });

    const issuedByShipmentId = await this.countIssuedByShipmentIds(shipments.map((s) => s.id));

    return shipments.map((shipment) =>
      this.toSummary(shipment, issuedByShipmentId.get(shipment.id) ?? 0),
    );
  }

  async findOne(id: number) {
    const shipment = await this.findOneOrThrow(id);
    const issuedCount = await this.countIssued(id);
    return this.toSummary(shipment, issuedCount);
  }

  async create(dto: CreateShipmentDto) {
    const shipmentId = dto.shipmentId.trim();

    if (!Number.isInteger(dto.itemsSent) || dto.itemsSent <= 0) {
      throw new BadRequestException('itemsSent must be a positive integer');
    }

    const existing = await this.prisma.shipment.findUnique({ where: { shipmentId } });
    if (existing) {
      throw new ConflictException(`Shipment with id "${shipmentId}" already exists`);
    }

    await this.assertVendorExists(dto.vendorId);

    const shipment = await this.prisma.shipment.create({
      data: {
        shipmentId,
        shipmentName: dto.shipmentName.trim(),
        vendorId: dto.vendorId,
        itemsSent: dto.itemsSent,
        shipmentReceivedDate: new Date(dto.shipmentReceivedDate),
        remarks: dto.remarks ?? '',
      },
      include: shipmentInclude,
    });

    // A brand-new shipment has no inventory linked yet, so issuedCount is
    // always 0 — no need for an extra query here.
    return this.toSummary(shipment, 0);
  }

  async update(id: number, dto: UpdateShipmentDto) {
    await this.findRawOrThrow(id);

    if (dto.vendorId !== undefined) {
      await this.assertVendorExists(dto.vendorId);
    }

    if (dto.itemsSent !== undefined && (!Number.isInteger(dto.itemsSent) || dto.itemsSent <= 0)) {
      throw new BadRequestException('itemsSent must be a positive integer');
    }

    const shipment = await this.prisma.shipment.update({
      where: { id },
      data: {
        ...(dto.shipmentName !== undefined ? { shipmentName: dto.shipmentName.trim() } : {}),
        ...(dto.vendorId !== undefined ? { vendorId: dto.vendorId } : {}),
        ...(dto.itemsSent !== undefined ? { itemsSent: dto.itemsSent } : {}),
        ...(dto.shipmentReceivedDate !== undefined
          ? { shipmentReceivedDate: new Date(dto.shipmentReceivedDate) }
          : {}),
        ...(dto.remarks !== undefined ? { remarks: dto.remarks } : {}),
      },
      include: shipmentInclude,
    });

    const issuedCount = await this.countIssued(id);
    return this.toSummary(shipment, issuedCount);
  }

  async remove(id: number) {
    await this.findRawOrThrow(id);

    const inventoryCount = await this.prisma.inventoryItem.count({ where: { shipmentId: id } });
    if (inventoryCount > 0) {
      throw new ConflictException('Cannot delete a shipment that contains inventory');
    }

    return this.prisma.shipment.delete({ where: { id } });
  }

  async getReconciliation(id: number) {
    const shipment = await this.findOneOrThrow(id);
    const issuedCount = await this.countIssued(id);
    const itemsReceived = shipment._count.inventory;
    const remaining = itemsReceived - issuedCount;
    const percentageReceived =
      shipment.itemsSent > 0
        ? Math.round((itemsReceived / shipment.itemsSent) * 10000) / 100
        : 0;

    return {
      id: shipment.id,
      shipmentId: shipment.shipmentId,
      shipmentName: shipment.shipmentName,
      vendor: shipment.vendor,
      itemsSent: shipment.itemsSent,
      itemsReceived,
      issuedCount,
      remaining,
      status: this.computeStatus(itemsReceived, shipment.itemsSent),
      percentageReceived,
    };
  }

  private async assertVendorExists(vendorId: number) {
    const vendor = await this.prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor) {
      throw new NotFoundException(`Vendor with id ${vendorId} not found`);
    }
  }

  private countIssued(shipmentId: number) {
    return this.prisma.inventoryItem.count({ where: { shipmentId, status: 'ISSUED' } });
  }

  private async countIssuedByShipmentIds(shipmentIds: number[]) {
    if (shipmentIds.length === 0) {
      return new Map<number, number>();
    }

    const rows = await this.prisma.inventoryItem.groupBy({
      by: ['shipmentId'],
      where: { status: 'ISSUED', shipmentId: { in: shipmentIds } },
      _count: { _all: true },
    });

    return new Map(rows.map((row) => [row.shipmentId, row._count._all]));
  }

  private async findOneOrThrow(id: number) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id },
      include: shipmentInclude,
    });
    if (!shipment) {
      throw new NotFoundException(`Shipment with id ${id} not found`);
    }
    return shipment;
  }

  private async findRawOrThrow(id: number) {
    const shipment = await this.prisma.shipment.findUnique({ where: { id } });
    if (!shipment) {
      throw new NotFoundException(`Shipment with id ${id} not found`);
    }
    return shipment;
  }

  private toSummary(shipment: ShipmentWithCounts, issuedCount: number) {
    const { _count, ...rest } = shipment;
    const itemsReceived = _count.inventory;
    return {
      ...rest,
      itemsReceived,
      issuedCount,
      status: this.computeStatus(itemsReceived, rest.itemsSent),
    };
  }

  private computeStatus(itemsReceived: number, itemsSent: number): ShipmentStatus {
    if (itemsReceived === 0) return 'PENDING';
    if (itemsReceived >= itemsSent) return 'COMPLETE';
    return 'IN_PROGRESS';
  }
}
