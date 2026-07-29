import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class InternalOrJwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers?.authorization as string | undefined;

    // Preferir JWT de usuario (no elevar a SERVICE si el browser envió ambas)
    if (authHeader?.startsWith('Bearer ')) {
      return super.canActivate(context);
    }

    let internalKey = request.headers['x-internal-key'] || request.headers['X-Internal-Key'];
    if (Array.isArray(internalKey)) {
      internalKey = internalKey[0];
    }
    const expectedKey = this.configService.get<string>(
      'INTERNAL_API_KEY',
      'internal-service-key-parcial2',
    );

    if (internalKey && internalKey === expectedKey) {
      request.user = {
        userId: 'internal-service',
        username: 'internal-service',
        roles: ['SERVICE'],
      };
      return true;
    }

    return super.canActivate(context);
  }
}