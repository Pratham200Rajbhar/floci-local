declare module "pg" {
  export interface ClientConfig {
    host?: string;
    port?: number;
    user?: string;
    password?: string;
    database?: string;
    connectionTimeoutMillis?: number;
    ssl?: boolean | object;
  }

  export interface QueryResultRow {
    [column: string]: unknown;
  }

  export interface QueryResult<R extends QueryResultRow = QueryResultRow> {
    rows: R[];
    fields: unknown[];
    rowCount: number;
    command: string;
  }

  export class Client {
    constructor(config?: ClientConfig | string);
    connect(): Promise<void>;
    query<R extends QueryResultRow = QueryResultRow>(queryText: string, values?: unknown[]): Promise<QueryResult<R>>;
    end(): Promise<void>;
  }

  const pg: {
    Client: typeof Client;
  };

  export default pg;
}
