import * as records from "../storage/records";
export const secureStorage = {
  getItem: (key: string) => records.read<string>("device", "auth", key),
  setItem: (key: string, value: string) =>
    records.write("device", "auth", key, value),
  removeItem: (key: string) => records.remove("device", "auth", key),
};
