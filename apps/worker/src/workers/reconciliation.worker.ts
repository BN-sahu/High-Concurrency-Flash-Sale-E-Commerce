import { getPrisma } from '@flash-sale/database';
import pino from 'pino';

const logger = pino({ level: 'info' }).child({ module: 'reconciliation' });

/**
 * Periodic reconciliation: verify inventory invariants.
 * Ensures: totalQuantity = availableQuantity + reservedQuantity + soldQuantity
 */
export async function processReconciliationJob(): Promise<void> {
  const prisma = getPrisma();

  const inventories = await prisma.inventory.findMany({
    include: { product: { select: { name: true } } },
  });

  let inconsistencies = 0;

  for (const inv of inventories) {
    const sum = inv.availableQuantity + inv.reservedQuantity + inv.soldQuantity;

    if (sum !== inv.totalQuantity) {
      inconsistencies++;
      logger.error(
        {
          inventoryId: inv.id,
          productName: inv.product.name,
          totalQuantity: inv.totalQuantity,
          available: inv.availableQuantity,
          reserved: inv.reservedQuantity,
          sold: inv.soldQuantity,
          computed: sum,
          drift: sum - inv.totalQuantity,
        },
        'INVENTORY INCONSISTENCY DETECTED'
      );

      // Create audit log for the inconsistency
      await prisma.auditLog.create({
        data: {
          action: 'reconciliation.inconsistency',
          resource: 'Inventory',
          resourceId: inv.id,
          changes: {
            totalQuantity: inv.totalQuantity,
            available: inv.availableQuantity,
            reserved: inv.reservedQuantity,
            sold: inv.soldQuantity,
            drift: sum - inv.totalQuantity,
          },
        },
      });
    }
  }

  if (inconsistencies === 0) {
    logger.info({ checked: inventories.length }, 'Reconciliation passed: all inventories consistent');
  } else {
    logger.error({ inconsistencies, total: inventories.length }, 'Reconciliation found inconsistencies');
  }
}
