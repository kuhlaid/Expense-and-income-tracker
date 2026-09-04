export interface TagTypeItem {
  id: number;
  name: string;
  created_at?: string | null;
}

export interface CategoryTypeItem {
  id: number;
  name: string;
  created_at?: string | null;
}

export interface LogTagRef {
  assnId: number;
  tagId: number;
  tagName: string;
}

export interface LogItem {
  id: number;
  logDate: string;
  logDescription?: string | null;
  logAmount?: string | null;
  logCategory?: number | null;
  reconciled?: boolean | null;
  createdAt?: string | null;
  categoryName?: string | null;
  tags?: LogTagRef[];
}

export interface StarterLogItem {
  id: number;
  logDate: string;
  logDescription?: string | null;
  logAmount?: string | null;
  logCategory?: number | null;
  reconciled?: boolean | null;
  createdAt?: string | null;
  categoryName?: string | null;
}

export interface TagLogAssnItem {
  id: number;
  tagId: number;
  logId: number;
  createdAt?: string | null;
  tagName?: string | null;
  logDescription?: string | null;
  logDate?: string | null;
}

export interface SchemaColumn {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
}

