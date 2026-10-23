import type { DevicePushToken } from "expo-notifications";
export async function pushStatus(_owner: string): Promise<boolean> {
  return false;
}
export async function connectPush(_owner: string): Promise<void> {
  throw Error("Open the iPhone or Android app to enable push notifications.");
}
export async function disablePush(_owner: string): Promise<void> {}
export async function disconnectPush(): Promise<void> {}
export async function refreshPush(
  _owner: string,
  _token?: DevicePushToken,
): Promise<void> {}
export async function testPush(): Promise<void> {
  throw Error("Open the iPhone or Android app to test push notifications.");
}
export function observePushToken(
  _listener: (token: DevicePushToken) => void,
): () => void {
  return () => {};
}

export async function quietPush(): Promise<boolean> {
  return false;
}
