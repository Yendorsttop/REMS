import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { loadConfig } from '@rems/config';
import { PrismaExternalIdentityResolver } from '@rems/database';

export type AuthenticatedRequest = Request & { executiveId?: string };

@Injectable()
export class OidcTokenVerifier {
  private readonly config = loadConfig();
  private readonly jwks = this.config.oidcIssuer
    ? createRemoteJWKSet(new URL('.well-known/jwks.json', `${this.config.oidcIssuer}/`))
    : undefined;
  async verify(token: string): Promise<{ issuer: string; subject: string }> {
    if (!this.jwks || !this.config.oidcIssuer || !this.config.oidcAudience)
      throw new UnauthorizedException('OIDC verification is not configured');
    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.config.oidcIssuer,
        audience: this.config.oidcAudience,
        algorithms: [...this.config.oidcAlgorithms],
      });
      if (!payload.iss || !payload.sub) throw new Error('Required identity claims are absent');
      return { issuer: payload.iss, subject: payload.sub };
    } catch {
      throw new UnauthorizedException('Bearer token verification failed');
    }
  }
}

@Injectable()
export class OidcAuthenticationGuard implements CanActivate {
  constructor(
    @Inject(OidcTokenVerifier)
    private readonly verifier: OidcTokenVerifier,
    @Inject(PrismaExternalIdentityResolver)
    private readonly identities: PrismaExternalIdentityResolver,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (request.path === '/openapi-json' || request.path.startsWith('/openapi')) return true;
    const authorization = request.header('authorization');
    if (!authorization?.startsWith('Bearer '))
      throw new UnauthorizedException('Bearer token required');
    const principal = await this.verifier.verify(authorization.slice(7));
    const executiveId = await this.identities.resolve(principal.issuer, principal.subject);
    if (!executiveId)
      throw new UnauthorizedException('External identity is not linked to an active executive');
    request.executiveId = executiveId;
    return true;
  }
}
