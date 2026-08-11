import prisma from '../lib/prisma';
import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

import { authenticate, generateToken, AuthRequest } from '../middleware/auth';
import { isLdapEnabled, isLdapAdminUsername, ldapEmailFor, authenticateLdap } from '../services/ldapAuth';
import { Role } from '@prisma/client';

const router = Router();

// Domaine email optionnel : permet la connexion avec l'identifiant seul (ex. « styapo »)
// au lieu de l'adresse complète (ex. « styapo@prosuma.ci »). Vide = désactivé.
const AUTH_EMAIL_DOMAIN = process.env.AUTH_EMAIL_DOMAIN?.trim() || '';

function resolveLoginIdentifier(input: string): string {
  const value = String(input).trim().toLowerCase();
  if (value.includes('@')) return value;
  return AUTH_EMAIL_DOMAIN ? `${value}@${AUTH_EMAIL_DOMAIN}` : value;
}

// POST /api/auth/register
router.post('/register', async (req: AuthRequest, res: Response) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    if (!email || !password || !firstName || !lastName) {
      res.status(400).json({ error: 'All fields are required' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(400).json({ error: 'Email already in use' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, password: hashedPassword, firstName, lastName },
    });

    const token = generateToken(user);
    res.status(201).json({
      token,
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req: AuthRequest, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const normalizedEmail = resolveLoginIdentifier(email);
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    // 1) Authentification locale (comptes en base)
    if (user) {
      if (!user.isActive) {
        res.status(403).json({ error: 'Account deactivated' });
        return;
      }

      const valid = await bcrypt.compare(password, user.password);
      if (valid) {
        const token = generateToken(user);
        res.json({
          token,
          user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role },
        });
        return;
      }
    }

    // 2) Fallback LDAP/Active Directory (même patron que le projet PROSUMA)
    if (isLdapEnabled()) {
      const username = normalizedEmail.split('@')[0];
      const ldapUser = await authenticateLdap(username, password);
      if (ldapUser) {
        const isAdmin = isLdapAdminUsername(ldapUser.username);
        let account = await prisma.user.findUnique({ where: { email: ldapUser.email } });

        if (!account) {
          account = await prisma.user.create({
            data: {
              email: ldapUser.email,
              // Mot de passe aléatoire : la connexion locale est impossible pour ce compte
              password: crypto.randomBytes(32).toString('hex'),
              firstName: username,
              lastName: username,
              role: isAdmin ? Role.ADMIN : Role.READER,
              authProvider: 'ldap',
            },
          });
        } else {
          if (!account.isActive) {
            res.status(403).json({ error: 'Account deactivated' });
            return;
          }
          account = await prisma.user.update({
            where: { id: account.id },
            data: {
              authProvider: 'ldap',
              role: isAdmin ? Role.ADMIN : account.role,
            },
          });
        }

        const token = generateToken(account);
        res.json({
          token,
          user: {
            id: account.id,
            email: account.email,
            firstName: account.firstName,
            lastName: account.lastName,
            role: account.role,
          },
        });
        return;
      }
    }

    res.status(401).json({ error: 'Invalid credentials' });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/profile
router.get('/profile', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, avatar: true, createdAt: true },
    });
    res.json(user);
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// PUT /api/auth/profile
router.put('/profile', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { firstName, lastName } = req.body;
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { firstName, lastName },
      select: { id: true, email: true, firstName: true, lastName: true, role: true },
    });
    res.json(user);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

export default router;
