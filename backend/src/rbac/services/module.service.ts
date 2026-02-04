
import { withTransaction, TransactionTask } from '../utils/transaction.utils';
import { IEvaluationService } from './evaluation.service';
import { IAuditService } from './audit.service';
import { ModuleRepository } from '../repositories/modules.repository';
import { Modules } from '../models/modules.model';

export interface IModuleService {
    getAll(actingUserId: string): Promise<Modules[]>;
}
export class ModuleService implements IModuleService {
    constructor(
        private readonly moduleRepository: ModuleRepository,
        private readonly evaluationService: IEvaluationService,
        private readonly auditService: IAuditService
    ) { }

    async getAll(actingUserId: string): Promise<Modules[]> {
        return withTransaction(async (t: TransactionTask) => {
            const modules = await this.moduleRepository.findAll();
            return modules;
        });
    }
}