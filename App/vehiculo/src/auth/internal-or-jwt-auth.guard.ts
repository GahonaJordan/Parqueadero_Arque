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
    const internalKey = request.headers['x-internal-key'];
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
