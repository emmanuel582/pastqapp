import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
export async function shareJson(name: string, text: string) {
  const file = new File(Paths.cache, name);
  file.write(text);
  if (!(await Sharing.isAvailableAsync()))
    throw new Error("Sharing is unavailable on this device.");
  await Sharing.shareAsync(file.uri, {
    mimeType: "application/json",
    dialogTitle: "Save your PastQ study backup",
  });
}
export async function chooseJson() {
  const result = await DocumentPicker.getDocumentAsync({
    type: "application/json",
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if ((asset.size || 0) > 200 * 1048576)
    throw new Error("This backup is too large. Use a file below 200 MB.");
  return new File(asset.uri).text();
}
export const readTextFile = (uri: string) => new File(uri).text();
