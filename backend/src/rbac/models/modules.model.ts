export interface Modules {
  id: string;

  name: string;
  code: string;
  description?: string | null;

  is_active: boolean;
  sort_order: number;
}
