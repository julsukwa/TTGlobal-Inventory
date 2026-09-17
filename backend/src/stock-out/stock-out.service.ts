import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ItemStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateStockOutDto, StockOutItemDto } from './dto/create-stock-out.dto.js';

const ELIGIBLE_STATUSES = [ItemStatus.OK, ItemStatus.FAULTY];

const stockOutInclude = {
  customer: {
    select: { id: true, fullName: true, email: true, phone: true, location: true },
  },
  processedBy: { select: { id: true, username: true } },
  items: {
    include: {
      inventory: {
        include: { batch: { select: { batchId: true } } },
      },
    },
  },
} satisfies Prisma.StockOutTransactionInclude;

type StockOutTransactionWithRelations = Prisma.StockOutTransactionGetPayload<{
  include: typeof stockOutInclude;
}>;

function formatDMY(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

@Injectable()
export class StockOutService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(year?: number) {
    const where: Prisma.StockOutTransactionWhereInput = {};

    if (year !== undefined) {
      where.createdAt = {
        gte: new Date(Date.UTC(year, 0, 1)),
        lt: new Date(Date.UTC(year + 1, 0, 1)),
      };
    }

    const transactions = await this.prisma.stockOutTransaction.findMany({
      where,
      include: stockOutInclude,
      orderBy: { createdAt: 'desc' },
    });

    return transactions.map((transaction) => this.toTransactionShape(transaction));
  }

  async findOne(invoiceNumber: string) {
    const transaction = await this.prisma.stockOutTransaction.findUnique({
      where: { invoiceNumber },
      include: stockOutInclude,
    });

    if (!transaction) {
      throw new NotFoundException(`Stock out transaction "${invoiceNumber}" not found`);
    }

    return this.toTransactionShape(transaction);
  }

  async create(dto: CreateStockOutDto, userId: number) {
    const invoiceNumber = dto.invoiceNumber?.trim();
    if (!invoiceNumber) {
      throw new BadRequestException('invoiceNumber must not be empty');
    }

    if (!dto.items?.length && !dto.assetIds?.length) {
      throw new BadRequestException('At least one of assetIds or items must be provided');
    }

    const requestedItems: StockOutItemDto[] = dto.items?.length
      ? dto.items
      : (dto.assetIds ?? []).map((assetId) => ({ assetId, source: 'scan' as const }));

    // De-duplicate by assetId, keeping the first source given for each.
    const sourceByAssetId = new Map<string, StockOutItemDto['source']>();
    for (const item of requestedItems) {
      if (!sourceByAssetId.has(item.assetId)) {
        sourceByAssetId.set(item.assetId, item.source);
      }
    }

    const existingInvoice = await this.prisma.stockOutTransaction.findUnique({
      where: { invoiceNumber },
    });
    if (existingInvoice) {
      throw new ConflictException(`Invoice number "${invoiceNumber}" already exists`);
    }

    const customer = await this.prisma.customer.findUnique({ where: { id: dto.customerId } });
    if (!customer) {
      throw new NotFoundException(`Customer with id ${dto.customerId} not found`);
    }

    const uniqueAssetIds = [...sourceByAssetId.keys()];

    const inventoryItems = await this.prisma.inventoryItem.findMany({
      where: { assetId: { in: uniqueAssetIds } },
    });

    const foundAssetIds = new Set(inventoryItems.map((item) => item.assetId));
    const missingAssetIds = uniqueAssetIds.filter((assetId) => !foundAssetIds.has(assetId));
    if (missingAssetIds.length > 0) {
      throw new NotFoundException(`Asset ID(s) not found: ${missingAssetIds.join(', ')}`);
    }

    const alreadyIssued = inventoryItems.filter((item) => item.status === ItemStatus.ISSUED);
    if (alreadyIssued.length > 0) {
      throw new ConflictException(
        `Asset ID(s) already issued: ${alreadyIssued.map((item) => item.assetId).join(', ')}`,
      );
    }

    const inventoryIds = inventoryItems.map((item) => item.id);

    const transaction = await this.prisma.$transaction(async (tx) => {
      // Re-check freshly inside the transaction: two concurrent requests could
      // both pass the check above for the same asset, so the actual guard
      // against double-issuing an item lives in the guarded updateMany below.
      const freshItems = await tx.inventoryItem.findMany({
        where: { id: { in: inventoryIds } },
      });

      const stillIssued = freshItems.filter((item) => item.status === ItemStatus.ISSUED);
      if (stillIssued.length > 0) {
        throw new ConflictException(
          `Asset ID(s) already issued: ${stillIssued.map((item) => item.assetId).join(', ')}`,
        );
      }

      const created = await tx.stockOutTransaction.create({
        data: {
          invoiceNumber,
          customerId: dto.customerId,
          processedById: userId,
          notes: dto.notes ?? '',
        },
      });

      await tx.stockOutItem.createMany({
        data: freshItems.map((item) => ({
          transactionId: created.id,
          inventoryId: item.id,
          priorStatus: item.status,
          source: sourceByAssetId.get(item.assetId) ?? 'scan',
        })),
      });

      const updateResult = await tx.inventoryItem.updateMany({
        where: { id: { in: inventoryIds }, status: { in: ELIGIBLE_STATUSES } },
        data: { status: ItemStatus.ISSUED },
      });

      if (updateResult.count !== freshItems.length) {
        // Something was issued concurrently between the check above and this
        // update — abort so nothing partially commits (Prisma rolls back the
        // whole transaction when the callback throws).
        throw new ConflictException(
          'One or more items were issued concurrently by another transaction. Please retry.',
        );
      }

      return tx.stockOutTransaction.findUniqueOrThrow({
        where: { id: created.id },
        include: stockOutInclude,
      });
    });

    return this.toTransactionShape(transaction);
  }

  async getLookupByListNumber(listNumber: string) {
    const items = await this.prisma.inventoryItem.findMany({
      where: {
        listNumber: { equals: listNumber, mode: 'insensitive' },
        status: { in: ELIGIBLE_STATUSES },
      },
      include: {
        shipment: { select: { id: true, shipmentName: true, vendor: { select: { vendorId: true } } } },
        batch: { select: { batchId: true } },
      },
      orderBy: { importedAt: 'desc' },
    });

    const shipmentIds = new Set(items.map((item) => item.shipmentId));

    if (shipmentIds.size <= 1) {
      return {
        items: items.map(({ shipment: _shipment, batch, ...item }) => ({
          ...item,
          batchId: batch.batchId,
        })),
        requiresDisambiguation: false,
      };
    }

    const shipmentsMap = new Map<
      number,
      { shipmentId: number; shipmentName: string; vendorId: string; eligibleCount: number }
    >();

    for (const item of items) {
      const existing = shipmentsMap.get(item.shipmentId);
      if (existing) {
        existing.eligibleCount += 1;
        continue;
      }
      shipmentsMap.set(item.shipmentId, {
        shipmentId: item.shipment.id,
        shipmentName: item.shipment.shipmentName,
        vendorId: item.shipment.vendor.vendorId,
        eligibleCount: 1,
      });
    }

    return { shipments: [...shipmentsMap.values()], requiresDisambiguation: true };
  }

  async getLookupByListNumberAndShipment(listNumber: string, shipmentId: number) {
    const items = await this.prisma.inventoryItem.findMany({
      where: {
        listNumber: { equals: listNumber, mode: 'insensitive' },
        shipmentId,
        status: { in: ELIGIBLE_STATUSES },
      },
      include: { batch: { select: { batchId: true } } },
      orderBy: { importedAt: 'desc' },
    });

    return items.map(({ batch, ...item }) => ({ ...item, batchId: batch.batchId }));
  }

  async getLookupByBatch(batchId: string) {
    const batch = await this.prisma.stockInBatch.findUnique({ where: { batchId } });
    if (!batch) {
      throw new NotFoundException(`Batch "${batchId}" not found`);
    }

    const items = await this.prisma.inventoryItem.findMany({
      where: {
        batchId: batch.id,
        status: { in: ELIGIBLE_STATUSES },
      },
      include: { batch: { select: { batchId: true } } },
      orderBy: { importedAt: 'desc' },
    });

    return items.map(({ batch: batchRelation, ...item }) => ({
      ...item,
      batchId: batchRelation.batchId,
    }));
  }

  private toTransactionShape(transaction: StockOutTransactionWithRelations) {
    return {
      invoiceNumber: transaction.invoiceNumber,
      customerId: transaction.customerId,
      customerName: transaction.customer.fullName,
      customerEmail: transaction.customer.email,
      customerPhone: transaction.customer.phone,
      customerLocation: transaction.customer.location,
      notes: transaction.notes,
      date: formatDMY(transaction.createdAt),
      processedBy: transaction.processedBy.username,
      totalItems: transaction.items.length,
      items: transaction.items.map((item) => ({
        assetId: item.inventory.assetId,
        category: item.inventory.category,
        brand: item.inventory.brand,
        model: item.inventory.model,
        processor: item.inventory.processor,
        generation: item.inventory.generation,
        ram: item.inventory.ram,
        storage: item.inventory.storage,
        speed: item.inventory.speed,
        screenType: item.inventory.screenType,
        status: item.priorStatus,
        listNumber: item.inventory.listNumber,
        batchId: item.inventory.batch.batchId,
        source: item.source,
      })),
    };
  }
}
