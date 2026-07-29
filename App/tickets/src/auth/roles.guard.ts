import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ROLES_KEY } from './roles.decorator';

/**
 * No confía solo en roles del JWT.
 * Revalida contra usuarios GET /api/auth/validate (roles desde BD).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(
    private reflector: Reflector,
    private config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Llamadas internas (X-Internal-Key → SERVICE)
    if (user?.roles?.includes('SERVICE')) {
      return requiredRoles.some((role) => user.roles.includes(role));
    }

    const authHeader = request.headers?.authorization as string | undefined;
    if (!authHeader?.startsWith('Bearer ')) {
      return false;
    }

    const validateUrl =
      this.config.get<string>('MS_AUTH_VALIDATE') ||
      'http://localhost:9090/api/auth/validate';

    try {
      const res = await fetch(validateUrl, {
        method: 'GET',
        headers: { Authorization: authHeader },
      });
      if (!res.ok) {
        this.logger.warn(`Auth validate failed: ${res.status}`);
        return false;
      }
      const data = (await res.json()) as {
        valid?: boolean;
        roles?: string[];
        username?: string;
        tenantId?: string | null;
      };
      if (!data.valid || !Array.isArray(data.roles)) {
        return false;
      }

      // Sobrescribe roles/tenant del JWT con datos reales de BD
      request.user = {
        ...user,
        username: data.username ?? user?.username,
        roles: data.roles,
        tenantId: data.tenantId ?? user?.tenantId ?? null,
      };

      // SUPER_ADMIN puede realizar cualquier acción
      if (data.roles.includes('SUPER_ADMIN')) {
        return true;
      }

      return requiredRoles.some((role) => data.roles!.includes(role));
    } catch (err) {
      this.logger.error(`Auth validate error: ${err}`);
      return false;
    }
  }
}
