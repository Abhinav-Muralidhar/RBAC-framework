/**
 * UserService
 *
 * Business logic for user lifecycle: creation, updates, deactivation, deletion,
 * password management, and login tracking.
 * All mutating operations are audit-logged with before/after snapshots.
 * Password hashes are redacted in audit logs.
 */

import { TransactionTask } from '../../utils/transaction.utils';
import { IUsersRepository, UserDetail } from '../repositories/users.repository';
import { Users, UserStatus } from '../models/users.model';
import { hashPassword, validatePassword } from '../../utils/crypto.utils';
import { IEvaluationService } from './evaluation.service';
import { IAuditService } from './audit.service';
import { UserListFilterDto, CreateUserRequestDto, UpdateUserRequestDto } from '../dto/user.dto';
import { PaginationParams, PaginatedResult } from '../../utils/pagination.utils';
import { CreateUserInput, UpdateUserInput } from '../types/repository.types';
import { IUserRoleRepository } from '../repositories/user_roles.repository';
import { forbidden } from '../errors/api.errors';
import {
    assertRequiredString,
    assertRequiredEmail,
    assertOptionalEmail,
    assertOptionalPhoneNumber,
    assertOptionalE164,
    assertInEnum,
    assertIntRange,
    assertOptionalBoolean,
} from '../../utils/validators';

// Module code for RBAC operations
const MODULE_CODE = 'SETTINGS';

// Valid landing pages — backend is the source of truth
export const VALID_LANDING_PAGES = [
    { key: '/dashboard', label: 'Dashboard' },
    { key: '/profile', label: 'Profile' },
] as const;

const VALID_LANDING_PAGE_KEYS = VALID_LANDING_PAGES.map(p => p.key) as readonly string[];
const USER_STATUS_KEYS = ['active', 'inactive', 'deleted'] as const;

const NAME_FORMAT_KEYS = ['first_last', 'last_first'] as const;
const TIME_ZONE_KEYS = [
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Anchorage',
    'Pacific/Honolulu',
    'America/Sao_Paulo',
    'America/Argentina/Buenos_Aires',
    'America/Toronto',
    'America/Vancouver',
    'America/Mexico_City',
    'Europe/London',
    'Europe/Paris',
    'Europe/Helsinki',
    'Europe/Moscow',
    'Europe/Istanbul',
    'Asia/Dubai',
    'Asia/Karachi',
    'Asia/Kolkata',
    'Asia/Dhaka',
    'Asia/Bangkok',
    'Asia/Shanghai',
    'Asia/Tokyo',
    'Asia/Seoul',
    'Australia/Sydney',
    'Australia/Perth',
    'Pacific/Auckland',
    'Africa/Johannesburg',
    'Africa/Lagos',
    'Africa/Cairo',
] as const;
const CURRENCY_KEYS = [
    'USD', 'EUR', 'GBP', 'INR', 'JPY', 'CNY', 'CAD', 'AUD', 'CHF', 'KRW',
    'SGD', 'AED', 'SAR', 'BRL', 'MXN', 'ZAR', 'RUB', 'TRY', 'SEK', 'NOK',
    'NZD', 'PKR', 'BDT', 'NGN', 'EGP',
] as const;
const DIGIT_GROUPING_PATTERNS = [
    '123,456,789',
    '12,34,56,789',
    '123 456 789',
    '123.456.789',
] as const;
const DECIMAL_SEPARATORS = ['.', ','] as const;
const SELF_UPDATE_ALLOWED_FIELDS = new Set<keyof UpdateUserRequestDto>([
    'version', 'password', 'first_name', 'last_name', 'title', 'department',
    'primary_email', 'secondary_email', 'other_email', 'office_phone', 'mobile_phone', 'home_phone',
    'secondary_phone', 'fax', 'street', 'city', 'state', 'country', 'postal_code', 'name_format',
    'phone_country_code', 'full_screen_preview', 'preferred_currency', 'digit_grouping_pattern',
    'decimal_separator', 'decimal_precision', 'symbol_placement', 'trailing_zero_handling',
    'time_zone', 'signature',
]);

function validateUserPreferences(data: Partial<CreateUserRequestDto | UpdateUserRequestDto>): void {
    assertInEnum(data.name_format, NAME_FORMAT_KEYS, 'Name format');
    assertInEnum(data.time_zone, TIME_ZONE_KEYS, 'Time zone');
    assertInEnum(data.preferred_currency, CURRENCY_KEYS, 'Preferred currency');
    assertInEnum(data.digit_grouping_pattern, DIGIT_GROUPING_PATTERNS, 'Digit grouping pattern');
    assertInEnum(data.decimal_separator, DECIMAL_SEPARATORS, 'Decimal separator');
    assertInEnum(data.symbol_placement, ['before', 'after'], 'Symbol placement');
    assertInEnum(data.trailing_zero_handling, ['show', 'hide'], 'Trailing zero handling');
    assertIntRange(data.decimal_precision, 0, 6, 'Decimal precision');
    assertOptionalBoolean(data.full_screen_preview, 'Full screen preview');
    assertOptionalE164(data.phone_country_code, 'Phone country code');
}

export interface IUserService {
    /** List users with optional filters and pagination. */
    listPaginated(t: TransactionTask, actingUserId: string, filters?: UserListFilterDto, pagination?: Partial<PaginationParams>): Promise<PaginatedResult<Users>>;
    /** Create a new user, hash password, assign role, and audit-log the creation. */
    create(t: TransactionTask, actingUserId: string, data: CreateUserRequestDto, auditCtx?: AuditContext): Promise<Users>;
    /** Update an existing user's attributes and optionally reassign their role. */
    update(t: TransactionTask, actingUserId: string, id: string, data: UpdateUserRequestDto, auditCtx?: AuditContext): Promise<Users>;
    /** Hard-delete a user record. */
    delete(t: TransactionTask, actingUserId: string, id: string, auditCtx?: AuditContext): Promise<void>;
    /** Retrieve a single user with full detail (manager name, creator name, role). */
    getById(t: TransactionTask, actingUserId: string, id: string): Promise<UserDetail | null>;
    /** Look up a user by username (used during login). */
    findByUsername(t: TransactionTask, username: string): Promise<Users | null>;
    /** Look up a user by email address. */
    findByEmail(t: TransactionTask, email: string): Promise<Users | null>;
    /** Change a user's password and record the timestamp. */
    updatePassword(t: TransactionTask, userId: string, newHashedPassword: string, auditCtx?: AuditContext): Promise<void>;
    /** Update the last_login_at timestamp on successful login. */
    recordLogin(t: TransactionTask, userId: string): Promise<void>;
}

export class UserService implements IUserService {
    constructor(
        private userRepository: IUsersRepository,
        private userRolesRepository: IUserRoleRepository,
        private evaluationService: IEvaluationService,
        private auditService: IAuditService,
    ) { }

    /** Look up a user by their unique username. Returns null if not found. */
    async findByUsername(t: TransactionTask, username: string): Promise<Users | null> {
        return this.userRepository.findByUsername(t, username);
    }

    /** Look up a user by their primary email address. Returns null if not found. */
    async findByEmail(t: TransactionTask, email: string): Promise<Users | null> {
        return this.userRepository.findByEmail(t, email);
    }

    /** List users with optional search/status filters and pagination. */
    async listPaginated(
        t: TransactionTask,
        actingUserId: string,
        filters?: UserListFilterDto,
        pagination?: Partial<PaginationParams>
    ): Promise<PaginatedResult<Users>> {

        return this.userRepository.findAllPaginated(t, filters, pagination);
    }

    /**
     * Retrieve a single user with full detail including manager name, creator name, and assigned role.
     * Users can view their own profile; viewing others requires 'read' permission on SETTINGS.
     */
    async getById(t: TransactionTask, actingUserId: string, id: string): Promise<UserDetail | null> {
        if (actingUserId !== id) {
            await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'read', t);
        }
        return this.userRepository.findByIdWithDetails(t, id);
    }

    /**
     * Create a new user record.
     * Validates all input fields, hashes password, assigns the specified role,
     * and logs an audit entry (with password redacted).
     * @throws Error if landing page is invalid.
     */
    async create(t: TransactionTask, actingUserId: string, data: CreateUserRequestDto, auditCtx?: AuditContext): Promise<Users> {
        assertRequiredString(data.username, 'Username');
        assertRequiredString(data.password, 'Password');
        assertRequiredEmail(data.primary_email, 'Primary email');
        assertRequiredString(data.last_name, 'Last name');
        assertRequiredString(data.rolesid, 'Role');
        assertOptionalEmail(data.secondary_email, 'Secondary email');
        assertOptionalEmail(data.other_email, 'Other email');
        assertOptionalPhoneNumber(data.office_phone, 'Office phone');
        assertOptionalPhoneNumber(data.mobile_phone, 'Mobile phone');
        assertOptionalPhoneNumber(data.home_phone, 'Home phone');
        assertOptionalPhoneNumber(data.secondary_phone, 'Secondary phone');
        assertOptionalPhoneNumber(data.fax, 'Fax');
        validateUserPreferences(data);
        if (data.password) {
            validatePassword(data.password);
            data.password = await hashPassword(data.password);
        }

        // Validate landing page if provided
        if (data.default_landing_page && !VALID_LANDING_PAGE_KEYS.includes(data.default_landing_page)) {
            throw new Error(`Invalid landing page: ${data.default_landing_page}. Valid options: ${VALID_LANDING_PAGE_KEYS.join(', ')}`);
        }

        const userData: CreateUserInput = {
            ...data,
            username: data.username,
            password: data.password,
            primary_email: data.primary_email,
            last_name: data.last_name,

        };

        const user = await this.userRepository.create(t, userData);
        await this.userRolesRepository.assign(t, user.id, data.rolesid as string);

        await this.auditService.log(t, {
            user_id: actingUserId,
            action: 'create',
            module_code: MODULE_CODE,
            entity_type: 'user',
            entity_id: user.id,
            old_values: null,
            new_values: { ...data, password: '[PASSWORD]' } as Record<string, unknown>,
            ip_address: auditCtx?.ip_address,
            user_agent: auditCtx?.user_agent,
            status: 'success'
        })

        return user;
    }

    /**
     * Update an existing user's attributes.
     * Validates all provided fields, re-hashes password only if changed,
     * updates password_changed_at accordingly, and reassigns role if provided.
     * @throws Error if user not found or landing page is invalid.
     */
    async update(
        t: TransactionTask,
        actingUserId: string,
        id: string,
        data: UpdateUserRequestDto,
        auditCtx?: AuditContext
    ): Promise<Users> {
        if (actingUserId !== id) {
            await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'update', t);
        } else {
            const disallowedFields = Object.keys(data).filter(
                (key) => !SELF_UPDATE_ALLOWED_FIELDS.has(key as keyof UpdateUserRequestDto)
            );
            if (disallowedFields.length > 0) {
                throw forbidden('You can only update your own profile fields.', 'SELF_UPDATE_FIELD_FORBIDDEN', {
                    fields: disallowedFields,
                });
            }
        }

        if (data.username !== undefined) {
            assertRequiredString(data.username, 'Username');
        }
        if (data.primary_email !== undefined) {
            assertRequiredEmail(data.primary_email, 'Primary email');
        }
        if (data.last_name !== undefined) {
            assertRequiredString(data.last_name, 'Last name');
        }
        if (data.rolesid !== undefined) {
            assertRequiredString(data.rolesid, 'Role');
        }
        assertOptionalEmail(data.secondary_email, 'Secondary email');
        assertOptionalEmail(data.other_email, 'Other email');
        assertOptionalPhoneNumber(data.office_phone, 'Office phone');
        assertOptionalPhoneNumber(data.mobile_phone, 'Mobile phone');
        assertOptionalPhoneNumber(data.home_phone, 'Home phone');
        assertOptionalPhoneNumber(data.secondary_phone, 'Secondary phone');
        assertOptionalPhoneNumber(data.fax, 'Fax');
        assertInEnum(data.status, USER_STATUS_KEYS, 'Status');
        validateUserPreferences(data);
        const oldUser = await this.userRepository.findById(t, id);
        if (!oldUser) throw new Error('User not found');

        const userData: any = { ...data };

        // Validate landing page if provided
        if (userData.default_landing_page && !VALID_LANDING_PAGE_KEYS.includes(userData.default_landing_page)) {
            throw new Error(`Invalid landing page: ${userData.default_landing_page}. Valid options: ${VALID_LANDING_PAGE_KEYS.join(', ')}`);
        }

        if (userData.password) {
            validatePassword(userData.password);
            userData.password = await hashPassword(userData.password);
        }

        const cleanData = Object.fromEntries(
            Object.entries(userData).filter(([_, v]) => v !== undefined)
        );

        const updateUserData: Users = {
            ...oldUser,
            ...cleanData,
            id,
            version: data.version,
            password: (cleanData.password as string) ?? oldUser.password,
            created_at: oldUser.created_at,
            status: data.status ?? oldUser.status,
            last_login_at: cleanData.last_login_at !== undefined ? (cleanData.last_login_at as Date | null) : (oldUser.last_login_at ?? null),
            password_changed_at: cleanData.password ? new Date() : (oldUser.password_changed_at ?? null),
            updated_by: actingUserId
        };

        const updatedUser = await this.userRepository.update(t, updateUserData);
        const updateUserDetail = await this.userRepository.findByIdWithDetails(t, id);
        if (!updateUserDetail) throw new Error('User not found');
        if (data.rolesid) {
            await this.userRolesRepository.revokeAllByUser(t, id);
            await this.userRolesRepository.assign(t, id, data.rolesid);
        }


        await this.auditService.log(t, {
            user_id: actingUserId,
            action: 'update',
            module_code: MODULE_CODE,
            entity_type: 'user',
            entity_id: id,
            old_values: { ...oldUser, password: '[PASSWORD]' } as Record<string, unknown>,
            new_values: { ...updatedUser, password: '[PASSWORD]' } as Record<string, unknown>,
            ip_address: auditCtx?.ip_address,
            user_agent: auditCtx?.user_agent,
            status: 'success'
        })

        return updatedUser;
    }


    /** Hard-delete a user and log the deletion with a before-snapshot. */
    async delete(t: TransactionTask, actingUserId: string, id: string, auditCtx?: AuditContext): Promise<void> {
        const oldUser = await this.userRepository.findById(t, id);

        await this.userRepository.delete(t, id);

        await this.auditService.log(t, {
            user_id: actingUserId,
            action: 'delete',
            module_code: MODULE_CODE,
            entity_type: 'user',
            entity_id: id,
            old_values: oldUser ? { ...oldUser, password: '[PASSWORD]' } as Record<string, unknown> : null,
            new_values: oldUser ? { delete: true, actingUserId: actingUserId } as Record<string, unknown> : {},
            ip_address: auditCtx?.ip_address,
            user_agent: auditCtx?.user_agent,
            status: 'success'
        })
    }

    /** Soft-delete (deactivate) a user by setting status to inactive. */
    async deactivate(t: TransactionTask, actingUserId: string, id: string, auditCtx?: AuditContext): Promise<void> {
        const oldUser = await this.userRepository.findById(t, id);

        await this.userRepository.deactivate(t, id);

        await this.auditService.log(t, {
            user_id: actingUserId,
            action: 'delete',
            module_code: MODULE_CODE,
            entity_type: 'user',
            entity_id: id,
            old_values: oldUser ? { ...oldUser, password: '[PASSWORD]' } as Record<string, unknown> : null,
            new_values: oldUser ? { delete: true, actingUserId: actingUserId } as Record<string, unknown> : {},
            ip_address: auditCtx?.ip_address,
            user_agent: auditCtx?.user_agent,
            status: 'success'
        })
    }

    /**
     * Change a user's password.
     * Updates the password hash and records the password_changed_at timestamp.
     * Audit log entries have passwords fully redacted.
     * @throws Error if user not found.
     */
    async updatePassword(
        t: TransactionTask,
        userId: string,
        newHashedPassword: string,
        auditCtx?: AuditContext
    ): Promise<void> {

        const oldUser = await this.userRepository.findById(t, userId);
        if (!oldUser) throw new Error('User not found');

        const updatedUser: Users = {
            ...oldUser,
            version: oldUser.version,
            password: newHashedPassword,
            password_changed_at: new Date()
        };

        await this.userRepository.update(t, updatedUser);

        // ✅ Audit only here (important change)
        await this.auditService.log(t, {
            user_id: userId,
            action: 'update',
            module_code: MODULE_CODE,
            entity_type: 'user',
            entity_id: userId,
            old_values: { password: '[REDACTED]' },
            new_values: { password: '[REDACTED]' },
            ip_address: auditCtx?.ip_address,
            user_agent: auditCtx?.user_agent,
            status: 'success'
        });
    }

    /** Record the current timestamp as the user's last login time. */
    async recordLogin(t: TransactionTask, userId: string): Promise<void> {
        await this.userRepository.updateLastLoginAt(t, userId, new Date());
    }
}
