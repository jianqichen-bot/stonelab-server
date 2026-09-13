import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { PrismaService } from '../prisma/prisma.service.js';
import type { RequestUser } from './auth.types.js';
import { PERMISSIONS_KEY } from './permissions.decorator.js';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const required =
      this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    if (!required.length) return true;

    const request = context.switchToHttp().getRequest<FastifyRequest & { user: RequestUser }>();
    const user = await this.prisma.adminUser.findUnique({
      where: { id: request.user.sub },
      select: {
        roleRecords: {
          where: { status: 'ENABLED' },
          select: {
            menus: {
              where: { status: 'ENABLED', permission: { in: required } },
              select: { permission: true },
            },
          },
        },
      },
    });
    const granted = new Set(
      user?.roleRecords.flatMap((role) => role.menus.map((menu) => menu.permission)) ?? [],
    );
    if (required.every((permission) => granted.has(permission))) return true;
    throw new ForbiddenException('没有执行该操作的权限');
  }
}
