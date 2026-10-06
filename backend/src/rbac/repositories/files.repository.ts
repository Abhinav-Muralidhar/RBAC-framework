import { IDatabase, ITask } from 'pg-promise';
import { Files } from '../models/files.model';
import { TransactionTask } from '../../utils/transaction.utils';
import { CreateFileInput } from '../types/repository.types';

export interface IFilesRepository {
    create(t: TransactionTask | undefined, input: CreateFileInput): Promise<Files>;
    getById(t: TransactionTask | undefined, id: string): Promise<Files | null>;
    delete(t: TransactionTask | undefined, id: string): Promise<void>;
}

export class FilesRepository implements IFilesRepository {
    private readonly tableName = 'files';
    private readonly baseColumns = 'id, version, storage_path, original_name, mime_type, size_bytes, created_at, created_by, updated_at, updated_by';

    constructor(private db: IDatabase<unknown>) { }

    async create(t: ITask<unknown> | undefined, input: CreateFileInput): Promise<Files> {
        return (t ?? this.db).one<Files>(
            `INSERT INTO ${this.tableName} (storage_path, original_name, mime_type, size_bytes, created_by)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING ${this.baseColumns}`,
            [
                input.storage_path,
                input.original_name,
                input.mime_type ?? null,
                input.size_bytes ?? null,
                input.created_by ?? null
            ]
        );
    }

    async getById(t: ITask<unknown> | undefined, id: string): Promise<Files | null> {
        return (t ?? this.db).oneOrNone<Files>(
            `SELECT ${this.baseColumns} FROM ${this.tableName} WHERE id = $1`,
            [id]
        );
    }

    async delete(t: ITask<unknown> | undefined, id: string): Promise<void> {
        await (t ?? this.db).none(
            `DELETE FROM ${this.tableName} WHERE id = $1`,
            [id]
        );
    }
}
