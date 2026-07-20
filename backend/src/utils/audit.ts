import prisma from '../lib/prisma';

type AuditEntity = 'TABLE' | 'COLUMN' | 'ROW' | 'CELL' | 'VIEW' | 'PERMISSION' | 'FORM';

interface AuditLogInput {
  tableId: string;
  userId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  entity: AuditEntity;
  entityId?: string;
  changes?: any;
}

export async function createAuditLog(input: AuditLogInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        tableId: input.tableId,
        userId: input.userId,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        changes: input.changes || undefined,
      },
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
  }
}
