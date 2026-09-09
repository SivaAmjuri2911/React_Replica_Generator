import { randomUUID } from 'node:crypto';
/**
 * @implements {IdGeneratorService}
 */
export class CryptoUuidGeneratorService {
    generateUuid() {
        return randomUUID();
    }
}
