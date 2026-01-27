export interface Module {
  id: bigint;

  name: string;
  code: string;
  description?: string | null;

  is_active: boolean;
  sort_order: number;
}
