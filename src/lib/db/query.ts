// SQLite(.all/.get/.run) 와 Postgres(Promise) 공통 실행 헬퍼
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * SELECT 여러 행.
 * better-sqlite3: builder.all() / postgres-js: await builder
 */
export async function qall<T = any>(builder: any): Promise<T[]> {
  if (builder && typeof builder.all === "function" && typeof builder.then !== "function") {
    return builder.all() as T[];
  }
  return (await builder) as T[];
}

/**
 * SELECT 한 행 (없으면 undefined).
 */
export async function qget<T = any>(builder: any): Promise<T | undefined> {
  if (builder && typeof builder.get === "function" && typeof builder.then !== "function") {
    return builder.get() as T | undefined;
  }
  if (builder && typeof builder.all === "function" && typeof builder.then !== "function") {
    const rows = builder.all() as T[];
    return rows[0];
  }
  const rows = await builder;
  return Array.isArray(rows) ? (rows[0] as T | undefined) : (rows as T);
}

/**
 * INSERT / UPDATE / DELETE 실행.
 */
export async function qrun(builder: any): Promise<void> {
  if (builder && typeof builder.run === "function" && typeof builder.then !== "function") {
    builder.run();
    return;
  }
  await builder;
}
