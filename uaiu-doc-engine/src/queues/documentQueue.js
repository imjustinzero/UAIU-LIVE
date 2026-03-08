const { Queue, Worker, QueueEvents } = require('bullmq');
const { PrismaClient } = require('@prisma/client');
const IORedis = require('ioredis');
const { assembleDocument } = require('../engine/aiAssembler');

const prisma = new PrismaClient();
const redis = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', { maxRetriesPerRequest: null });

const logger = require('../utils/logger');
const { generatePDF } = require('../pdf/pdfGenerator');
const workflowManager = require('../engine/workflowManager');
const { assemblePack } = require('../audit/auditPackAssembler');
const { generateHash } = require('../audit/hashGenerator');
const { generateVerificationRecord } = require('../audit/verificationLink');
const { sendEmail } = require('../notifications/emailService');

const documentQueue = new Queue('document-generation', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});

const auditPackQueue = new Queue('audit-pack-assembly', {
  connection: redis,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 50,
    removeOnFail: 100,
  },
});

const documentQueueEvents = new QueueEvents('document-generation', { connection: redis });
const auditPackQueueEvents = new QueueEvents('audit-pack-assembly', { connection: redis });

const documentWorker = new Worker(
  'document-generation',
  async (job) => {
    const { tradeId, docType, isDraft = false, triggerEvent } = job.data;

    try {
      const trade = await prisma.trade.findUnique({ where: { tradeId } });
      if (!trade) throw new Error(`Trade ${tradeId} not found`);

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

      await workflowManager.advanceWorkflow({ tradeId, triggerEvent, docType });
      return { ok: true };
    } catch (error) {
      logger.error({ event: 'document_generation_failed', tradeId, docType, triggerEvent, message: error.message });

      const trade = await prisma.trade.findUnique({ where: { tradeId } });
      if (trade) {
        await prisma.document.upsert({
          where: { id: `${trade.id}:${docType}:${triggerEvent}` },
          create: {
            id: `${trade.id}:${docType}:${triggerEvent}`,
            tradeId: trade.id,
            docType,
            triggerEvent,
            status: 'FAILED',
            isDraft,
          },
          update: {
            status: 'FAILED',
            updatedAt: new Date(),
          },
        }).catch(() => undefined);
      }

      if ((job.attemptsMade + 1) >= 3) {
        await sendEmail({
          to: process.env.UAIU_DEALS_EMAIL,
          subject: `Document generation failed after retries for ${tradeId}`,
          text: `Document generation for trade ${tradeId} and docType ${docType} failed after 3 attempts. Error: ${error.message}`,
        });
      }

      throw error;
    }
  },
  { concurrency: 3, connection: redis }
);

const auditPackWorker = new Worker(
  'audit-pack-assembly',
  async (job) => {
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

    await workflowManager.advanceWorkflow({ tradeId, triggerEvent: 'closing_summary', docType: 'CLOSING_SUMMARY' });
    return { ok: true };
  },
  { concurrency: 1, connection: redis }
);

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
