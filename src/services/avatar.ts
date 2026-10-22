export async function persistAvatar(_owner: string, uri: string) {
  const blob = await (await fetch(uri)).blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not save your photo."));
    reader.readAsDataURL(blob);
  });
}
