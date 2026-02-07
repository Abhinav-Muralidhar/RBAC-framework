
import { TransactionTask } from '../utils/transaction.utils';
import { IEvaluationService } from './evaluation.service';
import { IAuditService } from './audit.service';
import { ModuleRepository } from '../repositories/modules.repository';
import { Modules } from '../models/modules.model';

export interface IModuleService {
    getAll(t: TransactionTask, actingUserId: string): Promise<Modules[]>;
}
export class ModuleService implements IModuleService {
    constructor(
        private readonly moduleRepository: ModuleRepository,
        private readonly evaluationService: IEvaluationService,
        private readonly auditService: IAuditService
    ) { }

    async getAll(t: TransactionTask, actingUserId: string): Promise<Modules[]> {
        const modules = await this.moduleRepository.findAll();
        return modules;
    }
}