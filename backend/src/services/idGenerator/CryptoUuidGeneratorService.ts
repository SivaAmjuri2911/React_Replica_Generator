import { randomUUID } from 'node:crypto';
import type { IdGeneratorService } from './IdGeneratorService.js';

export class CryptoUuidGeneratorService implements IdGeneratorService {
  generateUuid(): string {
    return randomUUID();
  }
}
