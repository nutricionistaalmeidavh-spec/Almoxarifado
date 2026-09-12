export class DomainError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.details = { ...details };
  }
}

export function requireId(value, name) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new DomainError('INVALID_INPUT', `${name} is required`, { field: name });
  }
  return value;
}

export function requirePositiveNumber(value, name = 'quantity') {
  if (!Number.isFinite(value) || value <= 0) {
    throw new DomainError('INVALID_INPUT', `${name} must be greater than zero`, { field: name, value });
  }
  return value;
}

export function requireNonNegativeNumber(value, name = 'quantity') {
  if (!Number.isFinite(value) || value < 0) {
    throw new DomainError('INVALID_INPUT', `${name} must be zero or greater`, { field: name, value });
  }
  return value;
}
