class BaseOperationalError extends Error {
  constructor(name, message, statusCode, details = {}) {
    super(message);
    this.name = name;
    this.message = message;
    this.statusCode = statusCode;
    this.isOperational = true;
    Object.assign(this, details);
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: {
        name: this.name,
        message: this.message,
        statusCode: this.statusCode,
        isOperational: this.isOperational,
        ...(this.fields ? { fields: this.fields } : {}),
        ...(this.reason ? { reason: this.reason } : {}),
        ...(this.escalateTo ? { escalateTo: this.escalateTo } : {}),
        ...(this.description ? { description: this.description } : {}),
        ...(this.docType ? { docType: this.docType } : {}),
        ...(this.tradeId ? { tradeId: this.tradeId } : {}),
        ...(this.signatureRequestId ? { signatureRequestId: this.signatureRequestId } : {}),
        ...(this.step ? { step: this.step } : {}),
      },
    };
  }
}

class ValidationError extends BaseOperationalError {
  constructor(message, fields = []) {
    super('ValidationError', message, 400, { fields });
  }
}

class MissingFieldError extends BaseOperationalError {
  constructor(fields = []) {
    super('MissingFieldError', `Missing required field(s): ${fields.join(', ')}`, 400, { fields });
  }
}

class ExceptionFlagError extends BaseOperationalError {
  constructor(reason, escalateTo) {
    super('ExceptionFlagError', `Exception flagged: ${reason}`, 422, { reason, escalateTo });
  }
}

class LegalReviewError extends BaseOperationalError {
  constructor(description) {
    super('LegalReviewError', description, 422, { description });
  }
}

class DocumentGenerationError extends BaseOperationalError {
  constructor(message, docType, tradeId) {
    super('DocumentGenerationError', message, 500, { docType, tradeId });
  }
}

class SignatureError extends BaseOperationalError {
  constructor(message, signatureRequestId) {
    super('SignatureError', message, 502, { signatureRequestId });
  }
}

class AuditPackError extends BaseOperationalError {
  constructor(message, tradeId) {
    super('AuditPackError', message, 500, { tradeId });
  }
}

class WorkflowError extends BaseOperationalError {
  constructor(message, step, tradeId) {
    super('WorkflowError', message, 500, { step, tradeId });
  }
}

module.exports = {
  ValidationError,
  MissingFieldError,
  ExceptionFlagError,
  LegalReviewError,
  DocumentGenerationError,
  SignatureError,
  AuditPackError,
  WorkflowError,
};
