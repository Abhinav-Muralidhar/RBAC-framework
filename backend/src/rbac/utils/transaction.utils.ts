/**
 * Transaction Utilities
 * 
 * pg-promise transaction wrapper for multi-step operations.
 */

import pgPromise, { IDatabase, ITask } from 'pg-promise';

export type TransactionTask = ITask<unknown>;

/**
 * Execute callback within a database transaction.
 * 
 * On success: commits the transaction
 * On error: rolls back and re-throws
 */
export async function withTransaction<T>(
    db: IDatabase<unknown>,
    callback: (t: TransactionTask) => Promise<T>
): Promise<T> {
    return db.tx(async (t) => {
        return callback(t);
    });
}
