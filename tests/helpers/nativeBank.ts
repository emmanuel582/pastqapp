import { practiceKey } from "../../src/domain/contracts";
import { DatabaseSync } from "node:sqlite";
import ts from "typescript";
import vm from "node:vm";
import fs from "node:fs";
export function nativeBankFixture() {
  const sqlite = new DatabaseSync(":memory:");
  const adapter = {
    execAsync: async (sql: string) => {
      sqlite.exec(sql);
    },
    runAsync: async (sql: string, ...params: any[]) =>
      sqlite.prepare(sql).run(...params),
    getAllAsync: async (sql: string, ...params: any[]) =>
      sqlite.prepare(sql).all(...params),
    getFirstAsync: async (sql: string, ...params: any[]) =>
      sqlite.prepare(sql).get(...params) || null,
    withExclusiveTransactionAsync: async (work: any) => {
      sqlite.exec("BEGIN");
      try {
        await work(adapter);
        sqlite.exec("COMMIT");
      } catch (e) {
        sqlite.exec("ROLLBACK");
        throw e;
      }
    },
  };
  const values = new Map<string, unknown>(),
    records = {
      read: async (o: string, k: string, id: string) =>
        values.get(JSON.stringify([o, k, id])) || null,
      remove: async (o: string, k: string, id: string) => {
        values.delete(JSON.stringify([o, k, id]));
      },
      write: async (o: string, k: string, id: string, v: any) => {
        values.set(JSON.stringify([o, k, id]), v);
      },
    };
  const compiled = ts.transpileModule(
    fs.readFileSync("src/storage/bank.native.ts", "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const exported: any = {};
  vm.runInNewContext(compiled, {
    exports: exported,
    require: (path: string) =>
      path === "../domain/contracts"
        ? { practiceKey }
        : path === "./records.native"
          ? { database: async () => adapter, mutate: (work: any) => work() }
          : path === "./records"
            ? records
            : (() => {
                throw Error(path);
              })(),
    console,
  });
  return { bank: exported, sqlite, records, values };
}
