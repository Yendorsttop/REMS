import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { URL } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const [command, ...arguments_] = process.argv.slice(2);
const options = Object.fromEntries(
  arguments_.map((value) => {
    const [key, ...rest] = value.replace(/^--/, '').split('=');
    return [key, rest.join('=')];
  }),
);
const required = (name) => {
  const value = options[name];
  if (!value) throw new Error(`Missing --${name}`);
  return value;
};
const pair = () => {
  const issuer = required('issuer');
  new URL(issuer);
  const subject = required('subject');
  if (subject.length > 255 || [...subject].some((character) => character.charCodeAt(0) < 32))
    throw new Error('Malformed subject');
  return { issuer, subject };
};
const bootstrapCommand = command === 'bootstrap';
const databaseVariable = bootstrapCommand
  ? 'FOUNDER_BOOTSTRAP_DATABASE_URL'
  : 'IDENTITY_ADMIN_DATABASE_URL';
const expectedRole = bootstrapCommand ? 'rems_founder_bootstrap' : 'rems_identity_admin';
const databaseUrl = process.env[databaseVariable];
if (!databaseUrl) throw new Error(`${databaseVariable} is required`);
const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
const audit = (tx, actorId, type, subjectId, payload = {}) =>
  tx.auditEvent.create({
    data: { id: randomUUID(), occurredAt: new Date(), actorId, type, subjectId, payload },
  });
const requireConnectionAuthority = async (tx) => {
  const [{ role }] = await tx.$queryRaw`SELECT current_user AS role`;
  if (role !== expectedRole) throw new Error(`Command requires database role ${expectedRole}`);
};

async function founderActor(tx) {
  const token = process.env.REMS_ADMIN_BEARER_TOKEN;
  const configuredIssuer = process.env.OIDC_ISSUER;
  const audience = process.env.OIDC_AUDIENCE;
  if (!token || !configuredIssuer || !audience)
    throw new Error('Verified actor configuration is required');
  const jwks = createRemoteJWKSet(new URL('.well-known/jwks.json', `${configuredIssuer}/`));
  const { payload } = await jwtVerify(token, jwks, { issuer: configuredIssuer, audience });
  if (!payload.iss || !payload.sub) throw new Error('Verified issuer and subject are required');
  const link = await tx.externalIdentityLink.findUnique({
    where: { issuer_subject: { issuer: payload.iss, subject: payload.sub } },
    include: { executive: { include: { memberships: true } } },
  });
  if (
    !link?.active ||
    link.executive.status !== 'ACTIVE' ||
    !link.executive.memberships.some((m) => m.role === 'FOUNDER')
  )
    throw new Error('An authenticated active Founder must authorize this command');
  return link.executiveId;
}

async function bootstrap() {
  if (required('confirm') !== 'ESTABLISH-INITIAL-FOUNDER')
    throw new Error('Exact bootstrap confirmation is required');
  const { issuer, subject } = pair();
  const executiveId = required('executive-id');
  const displayName = required('display-name').trim();
  if (
    !/^[a-z0-9][a-z0-9-]{2,63}$/.test(executiveId) ||
    displayName.length < 2 ||
    displayName.length > 120
  )
    throw new Error('Malformed Founder identity input');
  await prisma.$transaction(async (tx) => {
    await requireConnectionAuthority(tx);
    const [founderIdentity, founderAuthority, founderLink, migration] = await Promise.all([
      tx.executiveIdentity.findFirst({ where: { memberships: { some: { role: 'FOUNDER' } } } }),
      tx.membership.findFirst({ where: { role: 'FOUNDER' } }),
      tx.externalIdentityLink.findFirst({
        where: { executive: { memberships: { some: { role: 'FOUNDER' } } } },
      }),
      tx.$queryRaw`SELECT migration_name FROM "_prisma_migrations" WHERE migration_name = '20260730020000_fip_005e_founder_identity_governance' AND finished_at IS NOT NULL`,
    ]);
    if (founderIdentity || founderAuthority || founderLink)
      throw new Error('Founder bootstrap is permanently closed or conflicting state exists');
    if (migration.length !== 1)
      throw new Error('Database is not in the expected initialized state');
    const unitId = 'rems-root';
    if (await tx.organizationUnit.findUnique({ where: { id: unitId } }))
      throw new Error('Conflicting bootstrap organization state exists');
    await tx.organizationUnit.create({ data: { id: unitId, name: 'REMS', kind: 'ORGANIZATION' } });
    await tx.executiveIdentity.create({ data: { id: executiveId, displayName } });
    await tx.membership.create({
      data: { id: `founder-${executiveId}`, executiveId, unitId, role: 'FOUNDER' },
    });
    await tx.externalIdentityLink.create({ data: { issuer, subject, executiveId } });
    await audit(tx, executiveId, 'red001.founder.bootstrapped', executiveId, {
      ceremony: 'FIP-005E',
      linkEstablished: true,
    });
  });
}

async function lifecycle() {
  const { issuer, subject } = pair();
  await prisma.$transaction(async (tx) => {
    await requireConnectionAuthority(tx);
    const actorId = await founderActor(tx);
    const existing = await tx.externalIdentityLink.findUnique({
      where: { issuer_subject: { issuer, subject } },
    });
    const targetExecutiveId = options['executive-id'];
    if (command === 'add') {
      if (
        !targetExecutiveId ||
        !(await tx.executiveIdentity.findUnique({ where: { id: targetExecutiveId } }))
      )
        throw new Error('Existing target executive is required');
      await tx.externalIdentityLink.create({
        data: { issuer, subject, executiveId: targetExecutiveId },
      });
    } else {
      if (!existing) throw new Error('External identity link not found');
      const founder = await tx.membership.findFirst({
        where: { executiveId: existing.executiveId, role: 'FOUNDER' },
      });
      if ((command === 'suspend' || command === 'remove' || command === 'replace') && founder) {
        const usable = await tx.externalIdentityLink.count({
          where: { executiveId: existing.executiveId, active: true },
        });
        if (usable <= 1 && command !== 'replace')
          throw new Error('Final usable Founder link is protected');
      }
      if (command === 'suspend')
        await tx.externalIdentityLink.update({
          where: { id: existing.id },
          data: { active: false },
        });
      else if (command === 'reactivate')
        await tx.externalIdentityLink.update({
          where: { id: existing.id },
          data: { active: true },
        });
      else if (command === 'remove')
        await tx.externalIdentityLink.delete({ where: { id: existing.id } });
      else if (command === 'replace') {
        const replacementIssuer = required('replacement-issuer');
        new URL(replacementIssuer);
        const replacementSubject = required('replacement-subject');
        if (
          replacementSubject.length > 255 ||
          [...replacementSubject].some((character) => character.charCodeAt(0) < 32)
        )
          throw new Error('Malformed replacement subject');
        await tx.externalIdentityLink.create({
          data: {
            issuer: replacementIssuer,
            subject: replacementSubject,
            executiveId: existing.executiveId,
          },
        });
        await tx.externalIdentityLink.delete({ where: { id: existing.id } });
      } else throw new Error('Unknown lifecycle command');
    }
    await audit(
      tx,
      actorId,
      `red001.external-link.${command}`,
      targetExecutiveId ?? existing.executiveId,
      { governed: true },
    );
  });
}

try {
  if (command === 'bootstrap') await bootstrap();
  else await lifecycle();
  process.stdout.write(`Founder identity administration command '${command}' completed\n`);
} finally {
  await prisma.$disconnect();
}
