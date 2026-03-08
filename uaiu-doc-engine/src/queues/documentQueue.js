const { Queue, Worker, QueueEvents } = require('bullmq');
const { PrismaClient } = require('@prisma/client');
const { redisConnection } = require('../config/redis');
const { assembleDocument } = require('../engine/aiAssembler');
const logger = require('../utils/logger');
const { generatePDF } = require('../pdf/pdfGenerator');
const { assemblePack } = require('../audit/auditPackAssembler');
const { generateHash } = require('../audit/hashGenerator');
const { generateVerificationRecord } = require('../audit/verificationLink');
const { sendEmail } = require('../notifications/emailService');

const prisma = new PrismaClient();

const documentQueue = new Queue('document-generation', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});

const auditPackQueue = new Queue('audit-pack-assembly', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2,
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});

const documentQueueEvents = new QueueEvents('document-generation', { connection: redisConnection });
const auditPackQueueEvents = new QueueEvents('audit-pack-assembly', { connection: redisConnection });

const documentWorker = new Worker('document-generation', async (job) => {
  const { tradeId, docType, isDraft = false, triggerEvent } = job.data;
  const trade = await prisma.trade.findUnique({ where: { tradeId } });
  if (!trade) throw new Error(`Trade ${tradeId} not found`);

  try {
    const { html } = await assembleDocument(trade, docType, isDraft);
    const pdfResult = await generatePDF(html, tradeId, docType, isDraft);

    await prisma.document.create({
      data: {
        tradeId: trade.id,
        docType,
        triggerEvent,
        status: 'GENERATED',
        isDraft,
        generatedHtml: html,
        pdfS3Key: pdfResult.s3Key,
        pdfPresignedUrl: pdfResult.presignedUrl,
        presignedUrlExpiresAt: pdfResult.expiresAt,
      },
    });

    const workflowManager = require('../engine/workflowManager');
    await workflowManager.advanceWorkflow({ tradeId, triggerEvent, docType });
    return { ok: true };
  } catch (error) {
    logger.error({ event: 'document_generation_failed', tradeId, docType, triggerEvent, message: error.message, attempt: job.attemptsMade + 1 });

    const existing = await prisma.document.findFirst({ where: { tradeId: trade.id, docType, triggerEvent }, orderBy: { createdAt: 'desc' } });
    if (existing) {
      await prisma.document.update({ where: { id: existing.id }, data: { status: 'FAILED' } });
    } else {
      await prisma.document.create({ data: { tradeId: trade.id, docType, triggerEvent, status: 'FAILED', isDraft } });
    }

    if (job.attemptsMade + 1 >= 3) {
      await sendEmail({
        to: process.env.UAIU_DEALS_EMAIL,
        subject: `Document generation failed for ${tradeId}`,
        text: `Document generation failed after 3 attempts. tradeId=${tradeId} docType=${docType} error=${error.message}`,
      });
    }

    throw error;
  }
}, { connection: redisConnection, concurrency: 3 });

const auditPackWorker = new Worker('audit-pack-assembly', async (job) => {
  const { tradeId } = job.data;
  const trade = await prisma.trade.findUnique({ where: { tradeId } });
  if (!trade) throw new Error(`Trade ${tradeId} not found`);

  const pack = await assemblePack(tradeId);
  const sha256Hash = await generateHash(pack.s3Key);
  const verification = await generateVerificationRecord(trade, { ...pack, sha256Hash });

  await prisma.auditPack.upsert({
    where: { tradeId: trade.id },
    create: {
      tradeId: trade.id,
      s3Key: pack.s3Key,
      sha256Hash,
      publicVerificationUrl: verification.publicVerificationUrl,
      documentCount: pack.documentCount,
      status: 'COMPLETE',
      assembledAt: new Date(),
    },
    update: {
      s3Key: pack.s3Key,
      sha256Hash,
      publicVerificationUrl: verification.publicVerificationUrl,
      documentCount: pack.documentCount,
      status: 'COMPLETE',
      assembledAt: new Date(),
    },
  });

  const workflowManager = require('../engine/workflowManager');
  await workflowManager.advanceWorkflow({ tradeId, triggerEvent: 'closing_summary', docType: 'CLOSING_SUMMARY' });

  return { ok: true };
}, { connection: redisConnection, concurrency: 1 });

async function addDocumentJob(data) {
  return documentQueue.add('generate-document', data);
}

async function addAuditPackJob(data) {
  return auditPackQueue.add('assemble-audit-pack', data);
}

module.exports = {
  documentQueue,
  auditPackQueue,
  documentQueueEvents,
  auditPackQueueEvents,
  documentWorker,
  auditPackWorker,
  addDocumentJob,
  addAuditPackJob,
};
