/**
 * Tenant & User Management Service
 * 
 * Strict Single Responsibility:
 * Enforces server-side multi-tenancy, user role authorizations,
 * customer location access restrictions (tenantCountryAccess), and search quota limits.
 * 
 * Zero cross-tenant data leakage.
 */

import { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export type UserRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

export interface CreateTenantDTO {
  name: string;
  slug: string;
  allowedCountries?: string[]; // e.g. ['US', 'CA']
  maxBusinessesPerSearch?: number;
  monthlyBusinessLimit?: number;
}

export interface CreateUserDTO {
  email: string;
  name?: string;
  role?: UserRole;
  tenantId: string;
}

export class TenantService {
  /**
   * Creates a new isolated customer tenant.
   */
  public async createTenant(dto: CreateTenantDTO) {
    const slug = dto.slug.toLowerCase().trim();
    return await prisma.tenant.create({
      data: {
        name: dto.name,
        slug,
        allowedCountries: dto.allowedCountries || ['IN', 'US', 'CA'],
        maxBusinessesPerSearch: dto.maxBusinessesPerSearch || 500,
        monthlyBusinessLimit: dto.monthlyBusinessLimit || 10000,
      },
    });
  }

  /**
   * Retrieves tenant by ID.
   */
  public async getTenantById(tenantId: string) {
    return await prisma.tenant.findUnique({
      where: { id: tenantId },
    });
  }

  /**
   * Retrieves tenant by slug.
   */
  public async getTenantBySlug(slug: string) {
    return await prisma.tenant.findUnique({
      where: { slug: slug.toLowerCase().trim() },
    });
  }

  /**
   * Creates a new user scoped to a tenant.
   */
  public async createUser(dto: CreateUserDTO) {
    return await prisma.user.create({
      data: {
        email: dto.email.toLowerCase().trim(),
        name: dto.name || null,
        role: dto.role || 'MEMBER',
        tenantId: dto.tenantId,
      },
    });
  }

  /**
   * Validates if a tenant has entitlement to query a specific country.
   * Prevents customer with USA-only access from querying Canada by tampering with parameters.
   */
  public async validateCountryAccess(
    tenantId: string,
    countryCode: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    const tenant = await this.getTenantById(tenantId);
    if (!tenant) {
      return { allowed: false, reason: `Tenant "${tenantId}" not found.` };
    }

    const normCode = countryCode.toUpperCase();
    const allowed = tenant.allowedCountries.map((c) => c.toUpperCase());

    if (!allowed.includes(normCode)) {
      return {
        allowed: false,
        reason: `Country "${countryCode}" is not authorized for your organization. Allowed countries: ${allowed.join(', ')}.`,
      };
    }

    return { allowed: true };
  }

  /**
   * Validates search volume against tenant limits.
   */
  public async checkSearchLimits(
    tenantId: string,
    requestedCount: number
  ): Promise<{ allowed: boolean; reason?: string }> {
    const tenant = await this.getTenantById(tenantId);
    if (!tenant) {
      return { allowed: false, reason: `Tenant "${tenantId}" not found.` };
    }

    if (requestedCount > tenant.maxBusinessesPerSearch) {
      return {
        allowed: false,
        reason: `Requested count (${requestedCount}) exceeds maximum allowed per search (${tenant.maxBusinessesPerSearch}) for tenant.`,
      };
    }

    return { allowed: true };
  }

  /**
   * Enforces server-side role permissions.
   */
  public enforcePermission(
    userRole: string,
    action: 'billing' | 'manage_users' | 'create_search' | 'view_leads' | 'modify_leads'
  ): boolean {
    const role = userRole.toUpperCase() as UserRole;
    switch (action) {
      case 'billing':
        return role === 'OWNER';
      case 'manage_users':
        return role === 'OWNER' || role === 'ADMIN';
      case 'create_search':
        return role === 'OWNER' || role === 'ADMIN' || role === 'MEMBER';
      case 'modify_leads':
        return role === 'OWNER' || role === 'ADMIN' || role === 'MEMBER';
      case 'view_leads':
        return role === 'OWNER' || role === 'ADMIN' || role === 'MEMBER' || role === 'VIEWER';
      default:
        return false;
    }
  }

  public canManageTenant(role: string): boolean {
    return this.enforcePermission(role, 'billing');
  }

  public canManageUsers(role: string): boolean {
    return this.enforcePermission(role, 'manage_users');
  }

  public canExecuteSearches(role: string): boolean {
    return this.enforcePermission(role, 'create_search');
  }
}

export const tenantService = new TenantService();
