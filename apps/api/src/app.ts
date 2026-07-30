import {
  Body,
  Controller,
  Get,
  HttpException,
  Inject,
  Injectable,
  Module,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiTags,
  DocumentBuilder,
  SwaggerModule,
} from '@nestjs/swagger';
import type { INestApplication } from '@nestjs/common';
import { DomainError, Red001Service } from '@rems/red-001';
import {
  PrismaAuditEventPort,
  PrismaAuthorizationPort,
  PrismaExecutiveIdentityRepository,
  PrismaOrganizationRepository,
  PrismaService,
  PrismaTransactionContext,
  PrismaExternalIdentityResolver,
  PrismaSecurityEvidencePort,
} from '@rems/database';
import { OidcAuthenticationGuard, OidcTokenVerifier, type AuthenticatedRequest } from './auth.js';
class CreateIdentityDto {
  @ApiProperty({ example: 'synthetic-executive' }) id!: string;
  @ApiProperty({ example: 'Synthetic Executive' }) displayName!: string;
  @ApiProperty({ required: false }) externalSubject?: string;
}
class CreateUnitDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: ['ORGANIZATION', 'DEPARTMENT', 'TEAM'] }) kind!:
    'ORGANIZATION' | 'DEPARTMENT' | 'TEAM';
  @ApiProperty({ required: false }) parentId?: string;
}
@Injectable()
export class Red001Facade extends Red001Service {
  constructor(
    identities: PrismaExecutiveIdentityRepository,
    organizations: PrismaOrganizationRepository,
    audit: PrismaAuditEventPort,
    authorization: PrismaAuthorizationPort,
    transaction: PrismaTransactionContext,
  ) {
    super(identities, organizations, audit, authorization, undefined, undefined, transaction);
  }
}
type ActorRequest = AuthenticatedRequest;
@ApiTags('RED-001')
@ApiBearerAuth()
@Controller('v1/red-001')
export class Red001Controller {
  constructor(@Inject(Red001Facade) private readonly service: Red001Facade) {}
  private actor(req: ActorRequest): string {
    const actor = req.executiveId;
    if (!actor) throw new HttpException('Authenticated actor context is required', 401);
    return actor;
  }
  private async execute<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof DomainError)
        throw new HttpException(
          error.message,
          error.message.startsWith('Missing permission') ? 403 : 400,
        );
      throw error;
    }
  }
  @Get('identities') @ApiOperation({ summary: 'List executive identities' }) async list(
    @Req() req: ActorRequest,
  ) {
    return (await this.execute(() => this.service.listIdentities(this.actor(req)))).map(
      (x) => x.snapshot,
    );
  }
  @Post('identities') @ApiOperation({ summary: 'Create an executive identity' }) async create(
    @Req() req: ActorRequest,
    @Body() body: CreateIdentityDto,
  ) {
    return (await this.execute(() => this.service.createIdentity(this.actor(req), body))).snapshot;
  }
  @Patch('identities/:id/:transition')
  @ApiOperation({ summary: 'Apply an identity lifecycle transition' })
  async transition(
    @Req() req: ActorRequest,
    @Param('id') id: string,
    @Param('transition') transition: string,
  ) {
    if (!['suspend', 'reactivate', 'deactivate'].includes(transition))
      throw new HttpException('Unknown lifecycle transition', 400);
    return (
      await this.execute(() =>
        this.service.transitionIdentity(
          this.actor(req),
          id,
          transition as 'suspend' | 'reactivate' | 'deactivate',
        ),
      )
    ).snapshot;
  }
  @Post('organization-units')
  @ApiOperation({ summary: 'Create an organizational hierarchy unit' })
  async unit(@Req() req: ActorRequest, @Body() body: CreateUnitDto) {
    await this.execute(() => this.service.createUnit(this.actor(req), body));
    return body;
  }
}
@Module({
  controllers: [Red001Controller],
  providers: [
    PrismaService,
    PrismaTransactionContext,
    PrismaExecutiveIdentityRepository,
    PrismaOrganizationRepository,
    PrismaAuditEventPort,
    PrismaAuthorizationPort,
    PrismaExternalIdentityResolver,
    OidcTokenVerifier,
    PrismaSecurityEvidencePort,
    { provide: 'SecurityEvidencePort', useExisting: PrismaSecurityEvidencePort },
    { provide: APP_GUARD, useClass: OidcAuthenticationGuard },
    Red001Facade,
  ],
})
export class AppModule {}
export function configureOpenApi(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('REMS RED-001 API')
    .setDescription('Executive identity and organizational authority boundary')
    .setVersion('0.1.0')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'OIDC JWT',
      description: 'Verified OIDC JWT; issuer and audience are deployment configuration',
    })
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('openapi', app, document);
  return document;
}
