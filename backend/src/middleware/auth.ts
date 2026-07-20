import { Request, Response, NextFunction } from 'express';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: Role;
    firstName: string;
    lastName: string;
  };
}

export function generateToken(user: {
  id: string;
  email: string;
  role: Role;
  firstName: string;
  lastName: string;
}): string {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName },
    JWT_SECRET as string,
    { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') } as SignOptions
  );
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      email: string;
      role: Role;
      firstName: string;
      lastName: string;
    };
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function authorize(...roles: Role[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (roles.length > 0 && !roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
}

export async function checkTablePermission(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  // Admin bypass
  if (req.user.role === Role.ADMIN) {
    next();
    return;
  }

  const tableId = req.params.tableId || req.params.id || req.body?.tableId;
  
  if (!tableId) {
    // For creating new tables, any authenticated user can proceed
    next();
    return;
  }

  // Check if user is the creator
  const table = await prisma.table.findUnique({
    where: { id: tableId },
    select: { createdBy: true },
  });

  if (table?.createdBy === req.user.id) {
    next();
    return;
  }

  // Check explicit permissions
  const permission = await prisma.permission.findFirst({
    where: {
      tableId,
      userId: req.user.id,
    },
  });

  if (!permission) {
    res.status(403).json({ error: 'No access to this table' });
    return;
  }

  next();
}
