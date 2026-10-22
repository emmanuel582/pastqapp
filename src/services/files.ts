import * as DocumentPicker from "expo-document-picker";
export async function shareJson(name: string, text: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function chooseJson() {
  const result = await DocumentPicker.getDocumentAsync({
    type: "application/json",
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if ((asset.size || 0) > 200 * 1048576)
    throw new Error("This backup is too large. Use a file below 200 MB.");
  return asset.file
    ? asset.file.text()
    : fetch(asset.uri).then((r) => r.text());
}
export const readTextFile = (uri: string) => fetch(uri).then((r) => r.text());
