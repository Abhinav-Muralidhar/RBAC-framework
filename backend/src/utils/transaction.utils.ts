/**
 * Transaction Utilities
 * 
 * pg-promise transaction wrapper for multi-step operations.
 */

import { IDatabase, ITask } from 'pg-promise';
import { db } from '../db';

export type TransactionTask = ITask<unknown>;
export type TransactionRunner = <T>(callback: (t: TransactionTask) => Promise<T>) => Promise<T>;
type TransactionCallback<T> = (t: TransactionTask) => Promise<T>;

/**
 * Execute callback within a database transaction.
 * 
 * On success: commits the transaction
 * On error: rolls back and re-throws
 */
export async function withTransaction<T>(
    callback: TransactionCallback<T>
): Promise<T>;
export async function withTransaction<T>(
    database: IDatabase<unknown>,
    callback: TransactionCallback<T>
): Promise<T>;
export async function withTransaction<T>(
    databaseOrCallback: IDatabase<unknown> | TransactionCallback<T>,
    maybeCallback?: TransactionCallback<T>
): Promise<T> {
    const database = typeof databaseOrCallback === 'function' ? db : databaseOrCallback;
    const callback = typeof databaseOrCallback === 'function' ? databaseOrCallback : maybeCallback;

    if (!callback) {
        throw new Error('withTransaction requires a callback');
    }

    return database.tx(async (t) => callback(t));
}

export function createTransactionRunner(database: IDatabase<unknown>): TransactionRunner {
    return async <T>(callback: (t: TransactionTask) => Promise<T>): Promise<T> => database.tx(callback);
}
