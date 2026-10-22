import { File, Directory, Paths } from "expo-file-system";
import * as Crypto from "expo-crypto";
export async function persistAvatar(owner: string, uri: string) {
  const dir = new Directory(
    Paths.document,
    "avatars",
    encodeURIComponent(owner),
  );
  dir.create({ idempotent: true, intermediates: true });
  const target = new File(dir, Crypto.randomUUID() + ".jpg");
  new File(uri).copy(target);
  return target.uri;
}
