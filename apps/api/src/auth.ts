import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { randomUUID } from 'node:crypto';
import { createRemoteJWKSet, errors, jwtVerify } from 'jose';
import { loadConfig } from '@rems/config';
import {
  PrismaExternalIdentityResolver,
  type SecurityEvidencePort,
  type SecurityReasonCode,
} from '@rems/database';

export type AuthenticatedRequest = Request & { executiveId?: string };
export class AuthenticationRejection extends Error {
  constructor(readonly reason: SecurityReasonCode) {
    super('Bearer token verification failed');
  }
}

@Injectable()
export class OidcTokenVerifier {
  private readonly config = loadConfig();
  private readonly jwks = this.config.oidcIssuer
    ? createRemoteJWKSet(new URL('.well-known/jwks.json', `${this.config.oidcIssuer}/`))
    : undefined;
  async verify(token: string): Promise<{ issuer: string; subject: string }> {
    if (!this.jwks || !this.config.oidcIssuer || !this.config.oidcAudience)
      throw new AuthenticationRejection('VERIFICATION_NOT_CONFIGURED');
    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.config.oidcIssuer,
        audience: this.config.oidcAudience,
        algorithms: [...this.config.oidcAlgorithms],
      });
      if (!payload.sub) throw new AuthenticationRejection('MISSING_SUBJECT');
      if (!payload.iss) throw new AuthenticationRejection('WRONG_ISSUER');
      return { issuer: payload.iss, subject: payload.sub };
    } catch (error) {
      if (error instanceof AuthenticationRejection) throw error;
      if (error instanceof errors.JWTExpired) throw new AuthenticationRejection('EXPIRED_TOKEN');
      if (error instanceof errors.JWKSNoMatchingKey)
        throw new AuthenticationRejection('UNKNOWN_SIGNING_KEY');
      if (error instanceof errors.JOSEAlgNotAllowed)
        throw new AuthenticationRejection('DISALLOWED_ALGORITHM');
      if (error instanceof errors.JWSSignatureVerificationFailed)
        throw new AuthenticationRejection('INVALID_SIGNATURE');
      if (error instanceof errors.JWTClaimValidationFailed) {
        if (error.claim === 'iss') throw new AuthenticationRejection('WRONG_ISSUER');
        if (error.claim === 'aud') throw new AuthenticationRejection('WRONG_AUDIENCE');
        if (error.claim === 'nbf') throw new AuthenticationRejection('FUTURE_NOT_BEFORE');
      }
      throw new AuthenticationRejection('MALFORMED_TOKEN');
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
    @Inject('SecurityEvidencePort') private readonly evidence: SecurityEvidencePort,
  ) {}
  private correlation(request: Request): string {
    const supplied = request.header('x-correlation-id');
    return supplied && /^[A-Za-z0-9._:-]{1,128}$/.test(supplied) ? supplied : randomUUID();
  }
  private async reject(reason: SecurityReasonCode, correlationId: string): Promise<never> {
    try {
      await this.evidence.append({
        eventType: 'AUTHENTICATION_REJECTED',
        reasonCode: reason,
        correlationId,
      });
    } catch {
      console.error('Security evidence append failed', { correlationId });
    }
    throw new UnauthorizedException('Unauthorized');
  }
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (
      request.path === '/openapi-json' ||
      request.path.startsWith('/openapi') ||
      request.path.startsWith('/health/')
    )
      return true;
    const authorization = request.header('authorization');
    const correlationId = this.correlation(request);
    if (!authorization?.startsWith('Bearer ') || authorization.length === 7)
      return this.reject('MISSING_BEARER_TOKEN', correlationId);
    let principal: { issuer: string; subject: string };
    try {
      principal = await this.verifier.verify(authorization.slice(7));
    } catch (error) {
      return this.reject(
        error instanceof AuthenticationRejection ? error.reason : 'OTHER_GOVERNED_REJECTION',
        correlationId,
      );
    }
    const result = await this.identities.resolveForAuthentication(
      principal.issuer,
      principal.subject,
    );
    if ('reason' in result) return this.reject(result.reason, correlationId);
    request.executiveId = result.executiveId;
    return true;
  }
}
