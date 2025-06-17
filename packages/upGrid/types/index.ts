export interface ColumnDefinition {
  headerName: string;
  field: string;
  textAlign?: 'left' | 'center' | 'right';
  sortable?: boolean;
  width?: number;
  minWidth?: number;
  visible?: boolean;
  cellRenderer?: 'checkbox' | string;
  editable?: boolean;
  filter?: boolean | 'text' | 'number';
  filterParams?: {
    filterType?: 'text' | 'number';
    condition?: 'contains' | 'startsWith' | 'equals' | 'notEqual' | 'greaterThan' | 'lessThan' | 'inRange';
  };
}

export interface RowDataItem {
  [key: string]: any;
}